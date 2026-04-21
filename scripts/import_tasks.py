"""
import_tasks.py — Bulk import tasks from CSV into Google Sheets

Usage:
    python scripts/import_tasks.py                      # preview draft
    python scripts/import_tasks.py --confirm            # actually upload
    python scripts/import_tasks.py --file other.csv     # use different CSV

Needs env vars (same as bot):
    GOOGLE_CREDENTIALS_JSON   — full service account JSON as a string
    GOOGLE_SHEET_ID           — your spreadsheet ID

Or place a .env file in the scripts/ folder or project root.
"""

import argparse
import csv
import json
import os
import sys
import uuid
from pathlib import Path

# ── Try to load .env from project root ──────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass  # dotenv not installed — rely on actual env vars

# ── Column order must match your Tasks sheet exactly ────────────────────────
SHEET_COLUMNS = [
    'id', 'name', 'event', 'status', 'priority', 'due_date',
    'assignee', 'assignee_tg', 'reminder', 'reminder_sent',
    'recurring', 'remarks', 'gdrive_link', 'ministry',
]

# CSV columns the user fills in (id / assignee_tg / reminder_sent are auto)
CSV_COLUMNS = [
    'name', 'event', 'status', 'priority', 'due_date',
    'assignee', 'reminder', 'recurring', 'remarks', 'gdrive_link', 'ministry',
]

SHEET_NAME = 'Tasks'

# ── Colours for terminal output ──────────────────────────────────────────────
RED    = '\033[91m'
GREEN  = '\033[92m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'

def col(text, colour): return f"{colour}{text}{RESET}"

# ── Load tasks from CSV ──────────────────────────────────────────────────────
def load_csv(path: str) -> list[dict]:
    tasks = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            # Validate required field
            if not row.get('name', '').strip():
                print(col(f"  Row {i}: skipped — no name", YELLOW))
                continue
            tasks.append({k: row.get(k, '').strip() for k in CSV_COLUMNS})
    return tasks

# ── Build a full sheet row from CSV row ─────────────────────────────────────
def build_row(task: dict) -> list:
    full = {
        'id':            str(uuid.uuid4()),
        'assignee_tg':   '',
        'reminder_sent': 'FALSE',
        **task,
    }
    return [full.get(col, '') for col in SHEET_COLUMNS]

# ── Pretty-print the draft table ────────────────────────────────────────────
def print_draft(tasks: list[dict]):
    print()
    print(col('━' * 80, CYAN))
    print(col(f"  DRAFT — {len(tasks)} task(s) to import", BOLD))
    print(col('━' * 80, CYAN))

    for i, t in enumerate(tasks, 1):
        overdue_flag = ''
        due = t.get('due_date', '')
        if due:
            from datetime import date
            try:
                d = date.fromisoformat(due)
                if d < date.today():
                    overdue_flag = col('  ⚠ PAST DUE', RED)
            except ValueError:
                pass

        print()
        print(col(f"  [{i}] {t['name']}", BOLD) + overdue_flag)

        rows = [
            ('Status',    t.get('status', '—')),
            ('Priority',  t.get('priority', '—')),
            ('Due Date',  due or '—'),
            ('Assignee',  t.get('assignee', '—') or '—'),
            ('Ministry',  t.get('ministry', '—') or '—'),
            ('Event',     t.get('event', '—') or '—'),
            ('Reminder',  t.get('reminder', '—') or '—'),
            ('Recurring', t.get('recurring', '—') or '—'),
            ('Remarks',   (t.get('remarks', '') or '—')[:80]),
        ]
        for label, value in rows:
            print(f"      {col(label + ':', CYAN):<20} {value}")

    print()
    print(col('━' * 80, CYAN))
    print()

# ── Upload to Google Sheets ──────────────────────────────────────────────────
def upload(tasks: list[dict]):
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print(col("ERROR: gspread not installed.", RED))
        print("Run:  pip install gspread google-auth")
        sys.exit(1)

    creds_json = os.environ.get('GOOGLE_CREDENTIALS_JSON')
    sheet_id   = os.environ.get('GOOGLE_SHEET_ID')

    if not creds_json:
        print(col("ERROR: GOOGLE_CREDENTIALS_JSON env var not set.", RED))
        sys.exit(1)
    if not sheet_id:
        print(col("ERROR: GOOGLE_SHEET_ID env var not set.", RED))
        sys.exit(1)

    print(col("Connecting to Google Sheets…", CYAN))
    try:
        creds_dict = json.loads(creds_json)
    except json.JSONDecodeError as e:
        print(col(f"ERROR: Could not parse GOOGLE_CREDENTIALS_JSON — {e}", RED))
        sys.exit(1)

    creds  = Credentials.from_service_account_info(
        creds_dict,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    client = gspread.authorize(creds)
    wb     = client.open_by_key(sheet_id)
    sheet  = wb.worksheet(SHEET_NAME)

    print(col(f"Uploading {len(tasks)} task(s)…", CYAN))
    rows = [build_row(t) for t in tasks]

    # Append all rows in one API call
    sheet.append_rows(rows, value_input_option='RAW', insert_data_option='INSERT_ROWS')

    print()
    print(col(f"✓ {len(tasks)} task(s) added to sheet '{SHEET_NAME}'.", GREEN))
    print()

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Bulk import tasks from CSV to Google Sheets')
    parser.add_argument('--file',    default=str(Path(__file__).parent / 'tasks_draft.csv'),
                        help='Path to CSV file (default: scripts/tasks_draft.csv)')
    parser.add_argument('--confirm', action='store_true',
                        help='Actually upload — without this flag only preview is shown')
    args = parser.parse_args()

    csv_path = args.file
    if not Path(csv_path).exists():
        print(col(f"ERROR: File not found — {csv_path}", RED))
        sys.exit(1)

    tasks = load_csv(csv_path)
    if not tasks:
        print(col("No valid tasks found in CSV.", YELLOW))
        sys.exit(0)

    print_draft(tasks)

    if not args.confirm:
        print(col("  ▶ This is a PREVIEW only. Nothing was uploaded.", YELLOW))
        print(col("  ▶ Review the draft above, edit tasks_draft.csv if needed,", YELLOW))
        print(col("  ▶ then run with --confirm to upload:", YELLOW))
        print()
        print(f"      python scripts/import_tasks.py --confirm")
        print()
        return

    # Confirmation prompt
    answer = input(col(f"  Upload {len(tasks)} task(s) to Google Sheets? [y/N] ", BOLD)).strip().lower()
    if answer != 'y':
        print(col("  Aborted.", YELLOW))
        return

    upload(tasks)

if __name__ == '__main__':
    main()
