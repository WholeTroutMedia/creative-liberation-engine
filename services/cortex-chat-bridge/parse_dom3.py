import re
try:
    with open('/app/chat_dom.html', encoding='utf-8') as f:
        html = f.read()
except FileNotFoundError:
    print("chat_dom.html not found!")
    exit(1)

reqs = re.findall(r'<[^>]*Message request[^>]*>', html, re.IGNORECASE)
for r in reqs:
    print(r)
