import requests
import json

CF_ACCOUNT_ID = "8d718b480ea7c11a85e6f99bd12ad7af"
CF_D1_DB_ID = "f52d2b74-ce2e-4fac-89d3-985572998ede"
CF_API_TOKEN = "0ec569a759d9d9b5a100aa875425be52f164e"

url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_D1_DB_ID}/query"
headers = {"X-Auth-Email": "inquiries@creativeliberationengine.org", "X-Auth-Key": CF_API_TOKEN, "Content-Type": "application/json"}

sql = "SELECT id, subject, created_at FROM messages WHERE direction='inbound' AND from_addr LIKE '%nvidia%' ORDER BY created_at DESC LIMIT 5"
resp = requests.post(url, headers=headers, json={'sql': sql})
print(json.dumps(resp.json()['result'][0]['results'], indent=2))
