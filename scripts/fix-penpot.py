import re
file_path = '/app/genesis-deploy/docker-compose.nas.yml'
with open(file_path, 'r') as f:
    content = f.read()

new_env = '''enable-smtp"
      PENPOT_SMTP_DEFAULT_FROM: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_DEFAULT_REPLY_TO: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_HOST: "smtp.gmail.com"
      PENPOT_SMTP_PORT: 587
      PENPOT_SMTP_USERNAME: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_PASSWORD: "${PENPOT_SMTP_PASSWORD:-""}"
      PENPOT_SMTP_TLS: "true"
      PENPOT_SMTP_SSL: "false"'''

content = content.replace('disable-email-verification disable-smtp"', new_env)

with open(file_path, 'w') as f:
    f.write(content)
