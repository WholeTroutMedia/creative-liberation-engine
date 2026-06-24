import re
file_path = '/app/genesis-deploy/docker-compose.nas.yml'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('PENPOT_SMTP_PASSWORD: "${PENPOT_SMTP_PASSWORD:-""}"', 'PENPOT_SMTP_PASSWORD: "${PENPOT_SMTP_PASSWORD}"')

with open(file_path, 'w') as f:
    f.write(content)
