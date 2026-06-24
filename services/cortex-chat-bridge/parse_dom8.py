from bs4 import BeautifulSoup

with open('/app/creative-liberation-engine/services/cortex-chat-bridge/data/chat_dom_in_dm.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

texts = []
for t in soup.stripped_strings:
    texts.append(t)

print("Total strings:", len(texts))
print("=" * 40)
print("\n".join(texts[-150:]))
