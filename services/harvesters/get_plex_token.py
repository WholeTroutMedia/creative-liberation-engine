#!/usr/bin/env python3
"""Get Plex token interactively and write to .env"""
import json, urllib.request, getpass, re

PLEX_AUTH_URL = 'https://plex.tv/api/v2/users/signin'
ENV_PATH = '/app/creative-liberation-engine/.env'

username = input('Plex username/email: ')
password = getpass.getpass('Plex password: ')

payload = json.dumps({'login': username, 'password': password}).encode()
headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Plex-Client-Identifier': 'cle-engine-academy',
    'X-Plex-Product': 'CLE Academy'
}
req = urllib.request.Request(PLEX_AUTH_URL, data=payload, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        token = data.get('authToken', '')
        if token:
            print(f'Token obtained: {token[:8]}...')
            # Update .env
            with open(ENV_PATH) as f:
                content = f.read()
            content = re.sub(r'PLEX_TOKEN=.*', f'PLEX_TOKEN={token}', content)
            with open(ENV_PATH, 'w') as f:
                f.write(content)
            print(f'Written to {ENV_PATH}')
        else:
            print(f'No token: {json.dumps(data)[:200]}')
except Exception as e:
    print(f'Failed: {e}')
