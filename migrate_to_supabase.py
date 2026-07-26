import os
import json
import urllib.request
import urllib.parse
import pandas as pd

SUPABASE_URL = "https://hdyojqbsbtptbsohgwlg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkeW9qcWJzYnRwdGJzb2hnd2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzMzNjEsImV4cCI6MjA5OTkwOTM2MX0.95b7QbRS0nXTwTLsbtu2PhD7veehe8KQFWhaPCV-_RU"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def supabase_delete_all(table_name):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?id=gt.0"
    req = urllib.request.Request(url, method="DELETE", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            pass
    except Exception as e:
        print(f"Delete error on {table_name}: {e}")

def supabase_insert_chunk(table_name, records):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    data_bytes = json.dumps(records).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        pass

excel_path = os.path.join(os.path.dirname(__file__), "RRC UPTO DATE 1.xlsx")
if not os.path.exists(excel_path):
    print(f"Error: {excel_path} not found.")
    exit(1)

excel_file = pd.ExcelFile(excel_path)
print(f"Sheet names in Excel: {excel_file.sheet_names}")

# 1. Migrate Master Sheet
master_sheet = excel_file.sheet_names[0]
df_master = pd.read_excel(excel_path, sheet_name=master_sheet)
df_master.columns = df_master.columns.str.strip()

print(f"Master Sheet Columns: {list(df_master.columns)}")

master_records = []
for idx, row in df_master.iterrows():
    def get_num(col_name):
        val = row.get(col_name, 0)
        num = pd.to_numeric(val, errors='coerce')
        return 0.0 if pd.isna(num) else float(num)

    def get_str(col_name):
        val = row.get(col_name, "")
        if pd.isna(val):
            return ""
        s = str(val).strip()
        if s.endswith(".0"):
            s = s[:-2]
        return s if s != "nan" else ""

    if not get_str("EST CODE") and not get_str("RRC No"):
        continue

    record = {
        "rrc_no": get_str("RRC No"),
        "est_code": get_str("EST CODE"),
        "est_name": get_str("EST NAME"),
        "type": get_str("Type"),
        "period": get_str("Period"),
        "recovery_officer": get_str("Recovery Officer"),
        "enforcement_officer": get_str("ENFORCEMENT OFFICER"),
        "acc_1_ob": get_num("1 OB"),
        "acc_2_ob": get_num("2 OB"),
        "acc_10_ob": get_num("10 OB"),
        "acc_21_ob": get_num("21 OB"),
        "acc_22_ob": get_num("22 OB"),
        "acc_1_paid": get_num("1 paid (26-27)"),
        "acc_2_paid": get_num("2 paid (26-27)"),
        "acc_10_paid": get_num("10 paid (26-27)"),
        "acc_21_paid": get_num("21 paid (26-27)"),
        "acc_22_paid": get_num("22 paid (26-27)"),
        "acc_1_pending": get_num("1 pending"),
        "acc_2_pending": get_num("2 pending"),
        "acc_10_pending": get_num("10 pending"),
        "acc_21_pending": get_num("21 pending"),
        "acc_22_pending": get_num("22 pending"),
        "recovery_ob": get_num("Recovery OB"),
        "recovered_curr_year": get_num("Recovered in current year (26-27)"),
        "pending_curr_year": get_num("Recovery pending for current year"),
        "fully_recovered": get_str("Fully Recovered"),
        "district": get_str("District"),
        "rrc_date": get_str("RRC Date"),
        "issued_year": get_str("Issued year"),
        "action_taken": get_str("ACTION TAKEN"),
        "mode_of_collection": get_str("MODE OF COLLECTION")
    }
    master_records.append(record)

print(f"Clearing and inserting {len(master_records)} records into rrc_master...")
supabase_delete_all("rrc_master")

chunk_size = 100
for i in range(0, len(master_records), chunk_size):
    chunk = master_records[i:i + chunk_size]
    supabase_insert_chunk("rrc_master", chunk)
    print(f"Inserted {i + len(chunk)} / {len(master_records)} master records.")

# 2. Migrate Recovery Log Sheet
if "Recovery Log" in excel_file.sheet_names:
    df_log = pd.read_excel(excel_path, sheet_name="Recovery Log")
    log_records = []
    for idx, row in df_log.iterrows():
        def get_str_l(col):
            val = row.get(col, "")
            if pd.isna(val):
                return ""
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s if s != "nan" else ""

        def get_num_l(col):
            v = pd.to_numeric(row.get(col, 0), errors='coerce')
            return 0.0 if pd.isna(v) else float(v)

        dt_val = row.get("Date", None)
        dt_str = str(dt_val)[:10] if pd.notna(dt_val) else None

        log_records.append({
            "txn_id": get_str_l("Txn_ID"),
            "date": dt_str,
            "receipt_no": get_str_l("Receipt No"),
            "est_name": get_str_l("EST NAME"),
            "est_code": get_str_l("EST CODE"),
            "rrc_no": get_str_l("RRC No"),
            "type": get_str_l("Type"),
            "account": get_str_l("Account"),
            "amount_deposited": get_num_l("Amount Deposited"),
            "period": get_str_l("Period")
        })

    print(f"Clearing and inserting {len(log_records)} records into recovery_log...")
    supabase_delete_all("recovery_log")
    if log_records:
        for i in range(0, len(log_records), chunk_size):
            chunk = log_records[i:i + chunk_size]
            supabase_insert_chunk("recovery_log", chunk)
            print(f"Inserted {i + len(chunk)} / {len(log_records)} log records.")

# 3. Migrate Fully Recovered Log Sheet
if "Fully Recovered Log" in excel_file.sheet_names:
    df_fr = pd.read_excel(excel_path, sheet_name="Fully Recovered Log")
    fr_records = []
    for idx, row in df_fr.iterrows():
        def get_str_fr(col):
            val = row.get(col, "")
            if pd.isna(val):
                return ""
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s if s != "nan" else ""

        def get_num_fr(col):
            v = pd.to_numeric(row.get(col, 0), errors='coerce')
            return 0.0 if pd.isna(v) else float(v)

        dt_val = row.get("Date", None)
        dt_str = str(dt_val)[:10] if pd.notna(dt_val) else None

        fr_records.append({
            "date": dt_str,
            "month": get_str_fr("Month"),
            "est_name": get_str_fr("EST NAME"),
            "est_code": get_str_fr("EST CODE"),
            "rrc_no": get_str_fr("RRC No"),
            "type": get_str_fr("Type"),
            "period": get_str_fr("Period"),
            "total_due": get_num_fr("Total Due"),
            "total_recovered": get_num_fr("Total Recovered")
        })

    print(f"Clearing and inserting {len(fr_records)} records into fully_recovered_log...")
    supabase_delete_all("fully_recovered_log")
    if fr_records:
        for i in range(0, len(fr_records), chunk_size):
            chunk = fr_records[i:i + chunk_size]
            supabase_insert_chunk("fully_recovered_log", chunk)
            print(f"Inserted {i + len(chunk)} / {len(fr_records)} fully recovered records.")

print("DATA MIGRATION TO SUPABASE COMPLETED SUCCESSFULLY!")
