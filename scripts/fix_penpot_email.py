import os
import re

file_path = '/app/genesis-deploy/docker-compose.nas.yml'
with open(file_path, 'r', encoding='utf-8') as f:
    data = f.read()

# Replace ${PENPOT_SMTP_PASSWORD} with ${GMAIL_APP_PASSWORD}
data = data.replace('${PENPOT_SMTP_PASSWORD}', '${GMAIL_APP_PASSWORD}')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(data)

print("Updated docker-compose.nas.yml with GMAIL_APP_PASSWORD")
