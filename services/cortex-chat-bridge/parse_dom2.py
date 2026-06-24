import re
import json

try:
    with open('/app/chat_dom.html', encoding='utf-8') as f:
        html = f.read()
except FileNotFoundError:
    print("chat_dom.html not found!")
    exit(1)

roles = set(re.findall(r'role="([^"]+)"', html))
print(f"Roles found: {roles}")

# Find elements with jsaction that contain click
clicks = re.findall(r'<div[^>]*jsaction="[^"]*click:[^"]*"[^>]*>', html)
print(f"\nDivs with click jsaction: {len(clicks)}")
for c in clicks[:5]:
    print(c)

# Let's see how the name "Artist" appears
justin = re.findall(r'<[^>]*>[^<]*Artist[^<]*</[^>]*>', html)
print(f"\nElements containing Artist: {len(justin)}")
for j in justin:
    print(j)
