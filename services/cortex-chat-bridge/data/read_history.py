import sqlite3
import shutil
import os

db_path = '/tmp/clean-profile/Default/History'
copy_path = '/tmp/History_temp'

if os.path.exists(db_path):
    shutil.copy2(db_path, copy_path)
    conn = sqlite3.connect(copy_path)
    c = conn.cursor()
    c.execute('SELECT url, title, last_visit_time FROM urls ORDER BY id DESC LIMIT 100;')
    rows = c.fetchall()
    print(f"Extracted {len(rows)} rows.")
    for idx, row in enumerate(rows):
        url = row[0]
        title = row[1]
        print(f"{idx}: {url} | Title: {title}")
    conn.close()
else:
    print("History file not found at:", db_path)
