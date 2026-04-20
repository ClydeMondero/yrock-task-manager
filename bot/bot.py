import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram import Bot
from telegram.ext import Application

import sheets

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

BOT_TOKEN = os.environ['TELEGRAM_BOT_TOKEN']
CHAT_ID = os.environ['TELEGRAM_CHAT_ID']

REMINDER_WINDOWS = {
    '1d': timedelta(hours=24),
    '2h': timedelta(hours=2),
    '30m': timedelta(minutes=30),
    'ondue': timedelta(hours=24),
}

async def check_reminders(bot: Bot):
    log.info('Checking reminders…')
    try:
        tasks = sheets.get_tasks()
    except Exception as e:
        log.error('Failed to fetch tasks: %s', e)
        return

    now = datetime.now(timezone.utc)

    for task in tasks:
        if not task.get('id'):
            continue
        if task.get('reminder_sent', '').upper() == 'TRUE':
            continue
        reminder = task.get('reminder', 'none')
        if reminder == 'none' or not reminder:
            continue
        due_raw = task.get('due_date', '')
        if not due_raw:
            continue

        try:
            due = datetime.fromisoformat(due_raw).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        window = REMINDER_WINDOWS.get(reminder)
        if window is None:
            continue

        time_to_due = due - now
        if timedelta(0) <= time_to_due <= window:
            assignee_name = task.get('assignee', '') or 'You'
            chat_id = task.get('assignee_tg', '').strip() or CHAT_ID
            msg = f"🔔 Reminder: *{task['name']}* is due {due_raw}\nAssigned to: {assignee_name}"
            try:
                await bot.send_message(chat_id=chat_id, text=msg, parse_mode='Markdown')
                sheets.mark_reminder_sent(task['id'])
                log.info('Sent reminder for task %s to chat %s', task['id'], chat_id)
            except Exception as e:
                log.error('Failed to send/update task %s: %s', task['id'], e)

async def main():
    app = Application.builder().token(BOT_TOKEN).build()
    bot = app.bot

    scheduler = AsyncIOScheduler()
    scheduler.add_job(check_reminders, 'interval', minutes=15, args=[bot], next_run_time=datetime.now())
    scheduler.start()

    log.info('Bot started. Scheduler running every 15 minutes.')
    await app.initialize()
    await app.start()

    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown()
        await app.stop()
        await app.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
