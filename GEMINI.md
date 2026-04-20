# GEMINI Context: Task Manager

A comprehensive task management system with a React frontend, Google Sheets backend, and a Python Telegram bot for reminders.

## Project Overview

- **Frontend**: React 19 (Vite) with Tailwind CSS 4.
- **Database**: Google Sheets (acting as a lightweight NoSQL database).
- **Communication**: Frontend uses a custom implementation in `src/lib/sheets.js` to perform JWT-authenticated requests directly to the Google Sheets API v4.
- **Bot**: Python-based Telegram bot (`bot/bot.py`) that checks for reminders and notifies the user.
- **Key Features**: List view, Kanban view (with drag-and-drop), and Calendar view. Event-based filtering.

## Architecture

```
Vercel (React + Vite)
      ↕ Google Sheets API v4 (JWT Auth)
  Google Sheets (Tasks)
      ↕ gspread
  Python Bot (Railway/Worker)
    APScheduler checks every 15 min
      ↕ Telegram Bot API
  Your Telegram
```

## Key Commands

### Frontend
- **Install Dependencies**: `npm install`
- **Development**: `npm run dev` (Runs at http://localhost:5173)
- **Build**: `npm run build`
- **Lint**: `npm run lint`

### Bot
- **Install Dependencies**: `cd bot && pip install -r requirements.txt`
- **Run Locally**: `python bot/bot.py`

## Development Conventions

- **State Management**: Uses React Context (`src/context/TaskContext.jsx`) for global task state.
- **Sheets API**: 
    - Columns in the sheet: `id | name | status | priority | due_date | assignee | reminder | reminder_sent`
    - Logic for CRUD operations is centralized in `src/lib/sheets.js`.
    - Private keys are handled in the frontend by replacing `\n` literals with actual newlines.
- **Styling**: Tailwind CSS 4 is used for styling. Note that `@tailwindcss/vite` is used in `vite.config.js`.
- **Drag and Drop**: Kanban view uses `@dnd-kit/core` and `@dnd-kit/sortable`.
- **Task Identity**: Uses `uuid` for generating task IDs before appending to Google Sheets.

## Environment Variables (.env)

| Variable | Description |
| :--- | :--- |
| `VITE_GOOGLE_SHEET_ID` | The ID of the Google Sheet. |
| `VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email. |
| `VITE_GOOGLE_PRIVATE_KEY` | Service account private key (include `\n`). |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather. |
| `TELEGRAM_CHAT_ID` | Your Telegram Chat ID. |
| `GOOGLE_CREDENTIALS_JSON` | Entire Google credentials JSON (for the bot). |

## File Structure Highlights

- `src/lib/sheets.js`: Low-level Sheets API wrapper with JWT authentication.
- `src/context/TaskContext.jsx`: High-level hooks for task operations.
- `src/components/`: View components (`ListView`, `KanbanView`, `CalendarView`) and UI elements.
- `bot/`: Python environment and reminder bot logic.
- `api/tasks/`: Reserved for future serverless function migration (currently empty).
