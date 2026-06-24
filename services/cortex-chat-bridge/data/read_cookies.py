import json

path = "/app/creative-liberation-engine/runtime/session/cookies.json"
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print("SUCCESS: Cookies loaded!")
    cookies = data.get("cookies", [])
    print(f"Total cookies: {len(cookies)}")
    shopify_cookies = [c for c in cookies if "shopify" in c.get("domain", "").lower()]
    print(f"Shopify cookies found: {len(shopify_cookies)}")
    for c in shopify_cookies[:10]:
        print(f"  Name: {c.get('name')} | Domain: {c.get('domain')} | Expires: {c.get('expires')}")
except Exception as e:
    print("Error:", e)
