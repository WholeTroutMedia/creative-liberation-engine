from bs4 import BeautifulSoup
import sys

with open('/app/creative-liberation-engine/services/cortex-chat-bridge/chat_dom_accepted.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

buttons = soup.find_all(lambda tag: tag.name == 'button' or tag.get('role') == 'button' or tag.name == 'span')
texts = set()
for b in buttons:
    text = b.get_text(strip=True)
    if text and len(text) < 30 and text not in texts:
        texts.add(text)
        print(text)
