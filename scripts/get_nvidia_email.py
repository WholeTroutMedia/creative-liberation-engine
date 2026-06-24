import sqlite3
import requests
import json
import os

url = "https://api.cloudflare.com/client/v4/accounts/8d718b480ea7c11a85e6f99bd12ad7af/d1/database/f52d2b74-ce2e-4fac-89d3-985572998ede/query"
headers = {
    "Content-Type": "application/json",
    "X-Auth-Email": "inquiries@creativeliberationengine.org",
    "X-Auth-Key": "194cd811a221fbc654784a0c87019f67aebde"
}
data = {
    "sql": "SELECT * FROM emails WHERE from_address LIKE '%nvidia%' ORDER BY received_at DESC LIMIT 1;"
}
r = requests.post(url, headers=headers, json=data)
res = r.json()
print(json.dumps(res, indent=2))
