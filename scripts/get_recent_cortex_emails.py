import requests
import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

CF_ACCOUNT_ID = "8d718b480ea7c11a85e6f99bd12ad7af"
CF_D1_DB_ID = "f52d2b74-ce2e-4fac-89d3-985572998ede"
CF_API_TOKEN = "0ec569a759d9d9b5a100aa875425be52f164e"

url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_D1_DB_ID}/query"
headers = {"X-Auth-Email": "inquiries@creativeliberationengine.org", "X-Auth-Key": CF_API_TOKEN, "Content-Type": "application/json"}

# Query for the single latest email
sql = "SELECT id, subject, to_addr, from_addr, created_at, body_text FROM messages WHERE to_addr LIKE '%inquiries@creativeliberationengine.org%' ORDER BY created_at DESC LIMIT 1"
resp = requests.post(url, headers=headers, json={'sql': sql})
results = resp.json()['result'][0]['results']

if results:
    email = results[0]
    print(f"ID: {email['id']}")
    print(f"From: {email['from_addr']}")
    print(f"To: {email['to_addr']}")
    print(f"Subject: {email['subject']}")
    print(f"Created At: {email['created_at']}")
    print("-" * 50)
    print("Body:")
    # Print clean text
    print(email['body_text'][:3000].encode('utf-8', errors='ignore').decode('utf-8'))
else:
    print("No recent email found for inquiries@creativeliberationengine.org")
