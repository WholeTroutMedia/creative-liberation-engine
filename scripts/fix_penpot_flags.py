import os
import re

file_path = '/app/genesis-deploy/docker-compose.nas.yml'
with open(file_path, 'r', encoding='utf-8') as f:
    data = f.read()

# Replace PENPOT_FLAGS
data = data.replace(
    'PENPOT_FLAGS: "enable-registration enable-login-with-password enable-smtp"',
    'PENPOT_FLAGS: "enable-registration enable-login-with-password enable-smtp enable-prepl-server disable-email-verification"'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(data)

print("Updated PENPOT_FLAGS in docker-compose.nas.yml")
