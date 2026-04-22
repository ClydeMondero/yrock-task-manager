"""
seed_ministries.py — Add ministry entries to the Ministries sheet.

Usage:
    python scripts/seed_ministries.py              # preview
    python scripts/seed_ministries.py --confirm    # upload

Only adds ministries that don't already exist (checks by name).
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass

RED    = '\033[91m'
GREEN  = '\033[92m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'
def c(text, col): return f"{col}{text}{RESET}"

# ── Ministries to seed ────────────────────────────────────────────────────────
MINISTRIES = [
    'PM',
    'WORSHIP',
    'MEDIA',
    'HOST',
    'CHI',
    'LEO',
    'LOGISTICS',
    'WELCOMING',
    'ALL',
]

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
    return client.open_by_key(sheet_id)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--confirm', action='store_true')
    args = parser.parse_args()

    wb = get_sheet_client()

    # Read existing ministries
    try:
        sheet = wb.worksheet('Ministries')
        rows  = sheet.get_all_records()
        existing = {str(r.get('name', '')).strip().upper() for r in rows}
    except Exception as e:
        print(c(f"ERROR reading Ministries sheet: {e}", RED))
        sys.exit(1)

    to_add = [m for m in MINISTRIES if m.upper() not in existing]
    skip   = [m for m in MINISTRIES if m.upper() in existing]

    print()
    print(c('━' * 50, CYAN))
    print(c('  MINISTRY SEED', BOLD))
    print(c('━' * 50, CYAN))

    if skip:
        print(c(f"\n  Already exist ({len(skip)}) — skipping:", YELLOW))
        for m in skip:
            print(f"    ✓  {m}")

    if not to_add:
        print(c("\n  Nothing to add — all ministries already exist.", GREEN))
        return

    print(c(f"\n  Will add ({len(to_add)}):", CYAN))
    for m in to_add:
        print(f"    +  {m}")
    print()

    if not args.confirm:
        print(c("  ▶ PREVIEW only — nothing uploaded.", YELLOW))
        print(c("  ▶ Run with --confirm to apply:", YELLOW))
        print()
        print("      python scripts/seed_ministries.py --confirm")
        print()
        return

    rows_to_add = [[str(uuid.uuid4()), m] for m in to_add]
    sheet.append_rows(rows_to_add, value_input_option='RAW', insert_data_option='INSERT_ROWS')
    print(c(f"  ✓ Added {len(rows_to_add)} ministries.", GREEN))


if __name__ == '__main__':
    main()
