from bs4 import BeautifulSoup

with open('/app/creative-liberation-engine/services/cortex-chat-bridge/chat_dom_accepted.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

items = soup.find_all(lambda tag: tag.get_text(strip=True) == 'Sovereign Artist')
for item in items:
    print(f"Tag: {item.name}, class: {item.get('class')}, role: {item.get('role')}, jsname: {item.get('jsname')}")
    parent = item.parent
    if parent:
        print(f"Parent: {parent.name}, class: {parent.get('class')}, role: {parent.get('role')}, aria-label: {parent.get('aria-label')}")
    parent2 = parent.parent if parent else None
    if parent2:
        print(f"Parent2: {parent2.name}, class: {parent2.get('class')}, role: {parent2.get('role')}, aria-label: {parent2.get('aria-label')}")

