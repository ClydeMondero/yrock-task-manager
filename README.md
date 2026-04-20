# Task Manager

React + Vite + Tailwind frontend with Google Sheets as the database and a Python Telegram bot for reminders.

---

## 1. Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a new project.
2. Enable the **Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable.
3. Create a Service Account: APIs & Services → Credentials → Create Credentials → Service Account.
4. Give it a name, click Done.
5. Click the service account → Keys tab → Add Key → JSON → Download.
6. Note the `client_email` field in the JSON — you'll share the sheet with this address.

---

## 2. Google Sheet Setup

1. Create a new Google Sheet.
2. Rename the first sheet tab to **Tasks** (exact spelling).
3. Add these headers in row 1 (A1:H1):

   ```
   id | name | status | priority | due_date | assignee | reminder | reminder_sent
   ```

4. Share the sheet with your service account `client_email` as **Editor**.
5. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

---

## 3. Telegram Bot Setup

1. Open Telegram → search **@BotFather** → `/newbot` → follow prompts → copy the **token**.
2. Search **@userinfobot** → start it → it replies with your **Chat ID**.

---

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

For `VITE_GOOGLE_PRIVATE_KEY`, paste the entire `private_key` value from the credentials JSON. Keep `\n` as literal `\n` — the app replaces them.

For `GOOGLE_CREDENTIALS_JSON` (bot), paste the **entire JSON file contents** as one line.

---

## 5. Run Frontend Locally

```bash
npm install
npm run dev
```

App opens at `http://localhost:5173`.

---

## 6. Deploy Frontend to Vercel

```bash
npm install -g vercel
vercel
```

Add env vars in Vercel dashboard: Project → Settings → Environment Variables.

---

## 7. Run Bot Locally

```bash
cd bot
pip install -r requirements.txt
python bot.py
```

---

## 8. Deploy Bot to Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
2. Set **Root Directory** to `bot/`.
3. Add environment variables (Settings → Variables):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_CREDENTIALS_JSON`
4. Railway uses `Procfile` to run `python bot.py` as a worker.

---

## Architecture

```
Vercel (React + Vite)
      ↕ Google Sheets API v4
  Google Sheets (Tasks)
      ↕ gspread
  Python Bot (Railway)
    APScheduler checks every 15 min
      ↕ Telegram Bot API
  Your Telegram
```
