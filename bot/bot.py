import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes, CallbackQueryHandler

import sheets

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# Verify environment variables
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID')

if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN not found in environment")

REMINDER_WINDOWS = {
    '1d': timedelta(hours=24),
    '2h': timedelta(hours=2),
    '30m': timedelta(minutes=30),
    'ondue': timedelta(hours=24),
}

def format_date(date_str):
    """Convert ISO date to a more readable format."""
    try:
        dt = datetime.fromisoformat(date_str)
        return dt.strftime("%b %d, %Y at %I:%M %p")
    except:
        return date_str

def calculate_next_due(current_due_str, recurring_type):
    """Calculate the next due date based on recurrence type."""
    try:
        due = datetime.fromisoformat(current_due_str)
        if recurring_type == 'daily':
            next_due = due + timedelta(days=1)
        elif recurring_type == 'weekly':
            next_due = due + timedelta(weeks=1)
        elif recurring_type == 'monthly':
            next_due = due + relativedelta(months=1)
        else:
            return None
        return next_due.isoformat()
    except Exception as e:
        log.error(f"Error calculating next due date: {e}")
        return None

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button clicks."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    status_map = {
        "done_": ("Done", "✅"),
        "progress_": ("In Progress", "🚧"),
        "blocked_": ("Blocked", "🚫")
    }
    
    action = next((k for k in status_map.keys() if data.startswith(k)), None)
    
    if action:
        task_id = data.replace(action, "")
        new_status, emoji = status_map[action]
        
        # Get current task to check for recurrence
        tasks = sheets.get_tasks()
        task = next((t for t in tasks if str(t.get('id')) == task_id), None)
        
        if not task:
            await query.message.reply_text("❌ Error: Task not found.")
            return

        recurring = str(task.get('recurring', 'none')).lower()
        
        if new_status == "Done" and recurring != "none" and recurring != "":
            next_due = calculate_next_due(task.get('due_date'), recurring)
            if next_due:
                fields = {
                    "status": "Todo",
                    "due_date": next_due,
                    "reminder_sent": "FALSE"
                }
                sheets.update_task_fields(task_id, fields)
                
                clean_text = query.message.text.split("💡")[0].strip()
                updated_text = (
                    f"{clean_text}\n\n"
                    f"🔁 *RECURRING TASK UPDATED!*\n"
                    f"Status reset to TODO and date bumped to:\n"
                    f"`{format_date(next_due)}`"
                )
                await query.edit_message_text(text=updated_text, parse_mode='Markdown')
                log.info(f"Recurring task {task_id} bumped to {next_due}")
                return

        # Regular status update
        success = sheets.update_task_fields(task_id, {"status": new_status})
        
        if success:
            clean_text = query.message.text.split("💡")[0].strip()
            updated_text = (
                f"{clean_text}\n\n"
                f"{emoji} *Status updated to {new_status.upper()} in Sheets!*"
            )
            await query.edit_message_text(text=updated_text, parse_mode='Markdown')
            log.info(f"Task {task_id} marked as {new_status} via Telegram.")
        else:
            await query.message.reply_text("❌ Error updating sheet.")

async def check_reminders(context: ContextTypes.DEFAULT_TYPE):
    """Job to check for upcoming task reminders."""
    bot = context.bot
    log.info('Checking reminders...')
    try:
        tasks = sheets.get_tasks()
    except Exception as e:
        log.error('Failed to fetch tasks: %s', e)
        return

    now = datetime.now(timezone.utc)

    for task in tasks:
        if not task.get('id'):
            continue
        if str(task.get('status', '')).lower() == 'done':
            continue
        if str(task.get('reminder_sent', '')).upper() == 'TRUE':
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

            # Support multiple comma-separated TG IDs
            tg_raw = str(task.get('assignee_tg', '')).strip()
            chat_ids = [cid.strip() for cid in tg_raw.split(',') if cid.strip()] if tg_raw else []
            if not chat_ids and CHAT_ID:
                chat_ids = [CHAT_ID]

            if not chat_ids:
                continue

            priority_emoji = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🔵'
            }.get(str(task.get('priority', '')).lower(), '⚪')

            pretty_date = format_date(due_raw)
            recurring_label = f"\n🔁 *Recurring:* {task.get('recurring', 'No').title()}" if task.get('recurring') and task.get('recurring') != 'none' else ""

            keyboard = [
                [InlineKeyboardButton("✅ Done", callback_data=f"done_{task['id']}")],
                [
                    InlineKeyboardButton("🚧 In Progress", callback_data=f"progress_{task['id']}"),
                    InlineKeyboardButton("🚫 Blocked", callback_data=f"blocked_{task['id']}")
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)

            msg = (
                f"⏰ *TASK REMINDER*\n\n"
                f"📌 *{task.get('name', 'Untitled Task')}*\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"📅 *Due:* {pretty_date}{recurring_label}\n"
                f"🚦 *Priority:* {priority_emoji} {task.get('priority', 'N/A').title()}\n"
                f"👤 *Assigned to:* {assignee_name}\n"
                f"📂 *Event:* {task.get('event', 'General')}\n\n"
                f"💡 _Update the status directly:_ "
            )

            sent_any = False
            for chat_id in chat_ids:
                try:
                    await bot.send_message(
                        chat_id=chat_id,
                        text=msg,
                        parse_mode='Markdown',
                        reply_markup=reply_markup
                    )
                    sent_any = True
                    log.info(f"Sent reminder for task {task['id']} to chat {chat_id}")
                except Exception as e:
                    log.error(f"Failed to send reminder for task {task['id']} to {chat_id}: {e}")

            if sent_any:
                sheets.mark_reminder_sent(task['id'])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /start command."""
    chat_id = update.effective_chat.id
    name = update.effective_user.first_name or 'there'
    await update.message.reply_text(
        f"👋 *Welcome, {name}!*\n\n"
        f"I'm your Task Manager Bot. I'll send you reminders when your tasks are due.\n\n"
        f"🚀 *Key Features:*\n"
        f"• Automated reminders (1d, 2h, 30m, or on due)\n"
        f"• Quick Status Updates (Done, In Progress, Blocked)\n"
        f"• *NEW:* Recurring task support (Daily, Weekly, Monthly)\n"
        f"• Multi-user support via Chat IDs\n\n"
        f"🆔 *Your Chat ID:* `{chat_id}`\n\n"
        f"📍 _Add this ID to your task sheet to start receiving reminders!_",
        parse_mode='Markdown'
    )
    log.info(f"User {name} started bot, chat_id={chat_id}")

def main():
    """Start the bot."""
    app = Application.builder().token(BOT_TOKEN).build()
    
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    
    job_queue = app.job_queue
    if job_queue:
        job_queue.run_repeating(check_reminders, interval=900, first=5)
        log.info("Reminder job scheduled every 15 minutes.")
    
    log.info("Bot started. Listening for commands...")
    app.run_polling(drop_pending_updates=True)

if __name__ == '__main__':
    main()
