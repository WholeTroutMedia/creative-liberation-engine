from bs4 import BeautifulSoup
import re

with open('/app/creative-liberation-engine/services/cortex-chat-bridge/chat_dom_accepted.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

texts = []
for t in soup.stripped_strings:
    texts.append(t)

print("\n".join(texts[-50:]))
