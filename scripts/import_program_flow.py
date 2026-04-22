"""
import_program_flow.py — Bulk import program flow blocks into Google Sheets

Usage:
    python scripts/import_program_flow.py              # preview draft
    python scripts/import_program_flow.py --confirm    # upload
    python scripts/import_program_flow.py --file other.csv --confirm

How dates work
--------------
The script reads your Events sheet to find "Create - 3rd Anniversary".
If that event has a start_date + recurring=weekly, it auto-generates the
weekly dates and re-maps blocks from the CSV to those dates.
If the event is not found (or has no start_date), it uses the dates already
in the CSV exactly as-is.

Sheet required: ProgramFlow
Headers (row 1): id | event | date | title | start_time | end_time | assignee | color | notes
"""

import argparse
import csv
import json
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

# ── Colours ──────────────────────────────────────────────────────────────────
RED    = '\033[91m'
GREEN  = '\033[92m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'
def c(text, col): return f"{col}{text}{RESET}"

# ── Sheet helpers ─────────────────────────────────────────────────────────────
def get_sheet_client():
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print(c("ERROR: gspread not installed.  pip install gspread google-auth", RED))
        sys.exit(1)

    creds_json = os.environ.get('GOOGLE_CREDENTIALS_JSON')
    sheet_id   = os.environ.get('GOOGLE_SHEET_ID')
    if not creds_json:
        print(c("ERROR: GOOGLE_CREDENTIALS_JSON not set.", RED))
        sys.exit(1)
    if not sheet_id:
        print(c("ERROR: GOOGLE_SHEET_ID not set.", RED))
        sys.exit(1)

    creds  = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    client = __import__('gspread').authorize(creds)
    wb     = client.open_by_key(sheet_id)
    return wb


def fetch_event_dates(wb, event_name: str) -> list[date] | None:
    """
    Look up event_name in the Events sheet.
    Expected columns: id | name | start_date | end_date | recurring
    Returns a sorted list of dates, or None if not found / no start_date.
    """
    try:
        sheet = wb.worksheet('Events')
        rows  = sheet.get_all_records()
    except Exception as e:
        print(c(f"  Warning: could not read Events sheet — {e}", YELLOW))
        return None

    event = next((r for r in rows if str(r.get('name', '')).strip().lower() == event_name.lower()), None)
    if not event:
        print(c(f"  Warning: event '{event_name}' not found in Events sheet.", YELLOW))
        return None

    start_raw = str(event.get('start_date', '') or event.get('Start Date', '') or '').strip()
    end_raw   = str(event.get('end_date',   '') or event.get('End Date',   '') or '').strip()
    recurring = str(event.get('recurring',  '') or '').strip().lower()

    if not start_raw:
        print(c(f"  Warning: event '{event_name}' has no start_date.", YELLOW))
        return None

    try:
        start = date.fromisoformat(start_raw)
    except ValueError:
        print(c(f"  Warning: cannot parse start_date '{start_raw}'.", YELLOW))
        return None

    # Single date
    if recurring == 'none' or not recurring:
        return [start]

    # Weekly recurrence up to end_date
    if recurring == 'weekly':
        end = date.fromisoformat(end_raw) if end_raw else start + timedelta(weeks=8)
        dates, d = [], start
        while d <= end:
            dates.append(d)
            d += timedelta(weeks=1)
        return dates

    # Monthly
    if recurring == 'monthly':
        end = date.fromisoformat(end_raw) if end_raw else start + timedelta(weeks=24)
        from dateutil.relativedelta import relativedelta
        dates, d = [], start
        while d <= end:
            dates.append(d)
            d += relativedelta(months=1)
        return dates

    return [start]


def load_csv(path: str) -> list[dict]:
    blocks = []
    with open(path, newline='', encoding='utf-8') as f:
        for i, row in enumerate(csv.DictReader(f), 1):
            if not row.get('title', '').strip():
                print(c(f"  Row {i} skipped — no title", YELLOW))
                continue
            blocks.append({k: v.strip() for k, v in row.items()})
    return blocks


def remap_dates(blocks: list[dict], new_dates: list[date]) -> list[dict]:
    """
    The CSV has blocks for specific dates.  Re-map them to new_dates by position:
    unique CSV dates (sorted) → new_dates (sorted).
    If counts differ, warn and keep extras unchanged.
    """
    csv_dates = sorted(set(b['date'] for b in blocks if b['date']))
    if len(csv_dates) == len(new_dates):
        mapping = {old: str(new) for old, new in zip(csv_dates, sorted(new_dates))}
        print(c("\n  Date re-mapping from Events sheet:", CYAN))
        for old, new in mapping.items():
            print(f"    {old}  →  {new}")
        return [{ **b, 'date': mapping.get(b['date'], b['date']) } for b in blocks]
    else:
        print(c(f"\n  Warning: CSV has {len(csv_dates)} unique dates, Events sheet has {len(new_dates)} dates.", YELLOW))
        print(c("  Using CSV dates as-is.", YELLOW))
        return blocks


# ── Pretty print draft ────────────────────────────────────────────────────────
def print_draft(blocks: list[dict]):
    from itertools import groupby
    print()
    print(c('━' * 80, CYAN))
    print(c(f"  PROGRAM FLOW DRAFT — {len(blocks)} block(s)", BOLD))
    print(c('━' * 80, CYAN))

    by_date = {}
    for b in blocks:
        by_date.setdefault(b['date'], []).append(b)

    for date_str in sorted(by_date):
        day_blocks = by_date[date_str]
        event      = day_blocks[0].get('event', '')
        print()
        print(c(f"  📅 {date_str}  [{event}]", BOLD))
        print(f"  {'TIME':<20} {'SEGMENT':<35} {'ASSIGNEE'}")
        print(f"  {'─'*20} {'─'*35} {'─'*20}")
        for b in day_blocks:
            time_range = f"{b['start_time']} – {b['end_time']}"
            print(f"  {time_range:<20} {b['title']:<35} {b.get('assignee', '')}")
        print(f"  {len(day_blocks)} segments")

    print()
    print(c('━' * 80, CYAN))
    print()


# ── Upload ────────────────────────────────────────────────────────────────────
def upload(blocks: list[dict], wb):
    sheet = wb.worksheet('ProgramFlow')
    rows  = [[
        str(uuid.uuid4()),
        b.get('event', ''),
        b.get('date', ''),
        b.get('title', ''),
        b.get('start_time', ''),
        b.get('end_time', ''),
        b.get('assignee', ''),
        b.get('color', 'blue'),
        b.get('notes', ''),
    ] for b in blocks]

    print(c(f"  Uploading {len(rows)} block(s) to ProgramFlow sheet…", CYAN))
    sheet.append_rows(rows, value_input_option='RAW', insert_data_option='INSERT_ROWS')
    print(c(f"\n  ✓ Done — {len(rows)} blocks added.", GREEN))


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file',    default=str(Path(__file__).parent / 'program_flow_draft.csv'))
    parser.add_argument('--event',   default='Create - 3rd Year Anniversary',
                        help='Event name to look up in Events sheet for date re-mapping')
    parser.add_argument('--no-remap', action='store_true',
                        help='Skip Events sheet lookup — use CSV dates exactly')
    parser.add_argument('--confirm', action='store_true')
    args = parser.parse_args()

    if not Path(args.file).exists():
        print(c(f"ERROR: File not found — {args.file}", RED))
        sys.exit(1)

    blocks = load_csv(args.file)
    if not blocks:
        print(c("No blocks found in CSV.", YELLOW))
        sys.exit(0)

    # ── Try to get dates from Events sheet ────────────────────────────────────
    if not args.no_remap and (args.confirm or True):  # always try, even in preview
        print(c(f"\n  Looking up '{args.event}' in Events sheet…", CYAN))
        try:
            wb    = get_sheet_client()
            dates = fetch_event_dates(wb, args.event)
            if dates:
                print(c(f"  Found {len(dates)} date(s): {', '.join(str(d) for d in dates)}", GREEN))
                blocks = remap_dates(blocks, dates)
            else:
                print(c("  Using CSV dates as-is.", YELLOW))
                wb = None
        except Exception as e:
            print(c(f"  Could not connect to Sheets — {e}", YELLOW))
            print(c("  Using CSV dates as-is.", YELLOW))
            wb = None
    else:
        wb = None

    print_draft(blocks)

    if not args.confirm:
        print(c("  ▶ PREVIEW only — nothing uploaded.", YELLOW))
        print(c("  ▶ Edit program_flow_draft.csv if needed, then run:", YELLOW))
        print()
        print(f"      python scripts/import_program_flow.py --confirm")
        print()
        return

    if wb is None:
        wb = get_sheet_client()

    answer = input(c(f"\n  Upload {len(blocks)} block(s) to ProgramFlow sheet? [y/N] ", BOLD)).strip().lower()
    if answer != 'y':
        print(c("  Aborted.", YELLOW))
        return

    upload(blocks, wb)


if __name__ == '__main__':
    main()
