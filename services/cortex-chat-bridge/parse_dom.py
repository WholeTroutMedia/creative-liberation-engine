import re
import json

try:
    with open('/app/chat_dom.html', encoding='utf-8') as f:
        html = f.read()
except FileNotFoundError:
    print("chat_dom.html not found!")
    exit(1)

# Search for any tag containing a typical message structure, or just find all text
# Google Chat messages are often inside div blocks. 
# Let's find divs containing text longer than 20 chars
divs = re.findall(r'<div[^>]*>([^<]{20,})</div>', html)
print(f"Found {len(divs)} divs with >20 chars")
for d in divs[:10]:
    print(d.strip())

# Let's also look for Aria labels
labels = re.findall(r'aria-label="([^"]*message[^"]*)"', html, re.IGNORECASE)
print(f"\nAria labels with 'message': {len(labels)}")
for l in set(labels):
    print(l)

# Looking for unread
unreads = re.findall(r'aria-label="([^"]*unread[^"]*)"', html, re.IGNORECASE)
print(f"\nAria labels with 'unread': {len(unreads)}")
for u in set(unreads):
    print(u)
