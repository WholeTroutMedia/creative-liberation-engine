const fs = require('fs');
const file = '/app/genesis-deploy/docker-compose.nas.yml';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('disable-email-verification disable-smtp', `enable-smtp
      PENPOT_SMTP_DEFAULT_FROM: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_DEFAULT_REPLY_TO: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_HOST: "smtp.gmail.com"
      PENPOT_SMTP_PORT: 587
      PENPOT_SMTP_USERNAME: "inquiries@creativeliberationengine.org"
      PENPOT_SMTP_PASSWORD: "\${PENPOT_SMTP_PASSWORD}"
      PENPOT_SMTP_TLS: "true"
      PENPOT_SMTP_SSL: "false"`);
fs.writeFileSync(file, content);
