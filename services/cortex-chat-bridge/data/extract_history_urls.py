import sqlite3
import shutil
import os

def check_history(path):
    print(f"Checking History file: {path}")
    if not os.path.exists(path):
        print("Path does not exist!")
        return
        
    copy_path = "/tmp/History_copy"
    try:
        shutil.copy2(path, copy_path)
        conn = sqlite3.connect(copy_path)
        cursor = conn.cursor()
        cursor.execute("SELECT url, title, visit_count FROM urls ORDER BY id DESC LIMIT 500;")
        rows = cursor.fetchall()
        print(f"Extracted {len(rows)} URLs.")
        for row in rows:
            url = row[0]
            title = row[1]
            if "code=" in url or "callback" in url or "oauth" in url:
                print(f"*** FOUND MATCH: {url} | Title: {title} ***")
            elif "cle-engine-systems" in url or "371742310401" in url:
                print(f"App-related URL: {url}")
        conn.close()
    except Exception as e:
        print("Failed to read SQLite history:", e)

check_history("/home/seluser/cortex-profile/Default/History")
check_history("/home/seluser/.config/google-chrome/Default/History")
