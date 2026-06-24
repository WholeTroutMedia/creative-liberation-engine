#!/usr/bin/env python3
"""Debug Plex — check account details and try alternative endpoints."""
from __future__ import annotations
import json, os, urllib.request

# Load env
for env_path in ["/app/creative-liberation-engine/.env"]:
    if os.path.isfile(env_path):
        with open(env_path) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ[k] = v

token = os.environ.get("PLEX_TOKEN", "")
headers = {
    "Accept": "application/json",
    "X-Plex-Token": token,
    "X-Plex-Client-Identifier": "cle-engine-academy",
}

# 1. Check account
print("=== ACCOUNT INFO ===")
try:
    req = urllib.request.Request("https://plex.tv/api/v2/user", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        user = json.loads(resp.read())
        print(f"  Username: {user.get('username')}")
        print(f"  Email: {user.get('email')}")
        print(f"  Subscription: {user.get('subscription', {}).get('active')}")
        print(f"  Home: {user.get('home')}")
        print(f"  ID: {user.get('id')}")
except Exception as e:
    print(f"  Error: {e}")

# 2. Check shared servers (friend shares)
print("\n=== SHARED SERVERS ===")
try:
    req = urllib.request.Request("https://plex.tv/api/v2/shared-servers", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        shared = json.loads(resp.read())
        if isinstance(shared, list):
            print(f"  Found {len(shared)} shared servers")
            for s in shared[:5]:
                print(f"    • Name: {s.get('name')} Machine: {s.get('machineIdentifier')}")
        else:
            print(f"  Response: {json.dumps(shared, indent=2)[:1000]}")
except Exception as e:
    print(f"  Error: {e}")

# 3. Try resources without filter
print("\n=== ALL RESOURCES (unfiltered) ===")
try:
    req = urllib.request.Request("https://plex.tv/api/v2/resources", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        res = json.loads(resp.read())
        print(f"  Found {len(res)} resources")
        for r in res[:10]:
            print(f"    • {r.get('name')} provides={r.get('provides')} owned={r.get('owned')}")
            for c in r.get('connections', [])[:2]:
                print(f"      URI: {c.get('uri')}")
except Exception as e:
    print(f"  Error: {e}")

# 4. Try XML API (older format)
print("\n=== XML RESOURCES (legacy) ===")
try:
    headers_xml = {**headers, "Accept": "application/xml"}
    req = urllib.request.Request(f"https://plex.tv/api/resources?X-Plex-Token={token}", headers=headers_xml)
    with urllib.request.urlopen(req, timeout=15) as resp:
        xml_data = resp.read().decode()
        print(f"  Response length: {len(xml_data)}")
        # Quick parse
        import re
        names = re.findall(r'name="([^"]*)"', xml_data)
        provides = re.findall(r'provides="([^"]*)"', xml_data)
        for n, p in zip(names[:10], provides[:10]):
            print(f"    • {n} provides={p}")
except Exception as e:
    print(f"  Error: {e}")
