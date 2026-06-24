from bs4 import BeautifulSoup

with open('nvidia_dom.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

inputs = soup.find_all('input')
for i in inputs:
    if i.get('type') in ['password', 'text', 'email']:
        print(f"ID: {i.get('id')}, Name: {i.get('name')}, Type: {i.get('type')}, Class: {i.get('class')}")

buttons = soup.find_all('button')
for b in buttons:
    if b.text.strip():
        print(f"Button ID: {b.get('id')}, Text: {b.text.strip()}")
