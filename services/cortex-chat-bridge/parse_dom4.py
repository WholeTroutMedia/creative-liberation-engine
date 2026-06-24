import re
try:
    with open('/app/chat_dom.html', encoding='utf-8') as f:
        html = f.read()
except FileNotFoundError:
    print("chat_dom.html not found!")
    exit(1)

# Find the Sovereign Artist span and get its surrounding context
idx = html.find('Sovereign Artist')
if idx != -1:
    start = max(0, idx - 500)
    end = min(len(html), idx + 500)
    print("Context around Sovereign Artist:")
    print(html[start:end])
