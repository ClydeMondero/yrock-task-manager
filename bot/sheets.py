import os
import json
import gspread
from google.oauth2.service_account import Credentials

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SHEET_NAME = 'Tasks'
COLUMNS = ['id', 'name', 'event', 'status', 'priority', 'due_date', 'assignee', 'assignee_tg', 'reminder', 'reminder_sent', 'recurring', 'remarks', 'gdrive_link']

def get_client():
    creds_json = os.environ['GOOGLE_CREDENTIALS_JSON']
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    return gspread.authorize(creds)

def get_sheet():
    client = get_client()
    sheet_id = os.environ['GOOGLE_SHEET_ID']
    wb = client.open_by_key(sheet_id)
    return wb.worksheet(SHEET_NAME)

def get_tasks():
    sheet = get_sheet()
    rows = sheet.get_all_records(expected_headers=COLUMNS)
    return rows

def mark_reminder_sent(task_id: str):
    sheet = get_sheet()
    all_vals = sheet.get_all_values()
    for i, row in enumerate(all_vals[1:], start=2):
        if row[0] == task_id:
            reminder_sent_col = COLUMNS.index('reminder_sent') + 1
            sheet.update_cell(i, reminder_sent_col, 'TRUE')
            return

def update_task_status(task_id: str, new_status: str):
    return update_task_fields(task_id, {"status": new_status})

def update_task_fields(task_id: str, fields: dict):
    """Update multiple fields for a task at once."""
    sheet = get_sheet()
    all_vals = sheet.get_all_values()
    for i, row in enumerate(all_vals[1:], start=2):
        if row[0] == task_id:
            cells_to_update = []
            for field, value in fields.items():
                if field in COLUMNS:
                    col_idx = COLUMNS.index(field) + 1
                    cells_to_update.append(gspread.cell.Cell(row=i, col=col_idx, value=value))
            
            if cells_to_update:
                sheet.update_cells(cells_to_update)
                return True
    return False
