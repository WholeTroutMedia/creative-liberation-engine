#!/usr/bin/env python3
import asyncio
import os
import sys
import json
import logging
from urllib.parse import parse_qs, urlencode, urlparse
import aiohttp
from toyota_na.client import ToyotaOneClient
from toyota_na.auth import ToyotaOneAuth
from toyota_na.exceptions import LoginError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] Toyota-Setup: %(message)s'
)

TOKENS_FILE = "/app/creative-liberation-engine/runtime/session/toyota-tokens.json"

# Dynamic patch to support ui_locales and interactive OTP inputs
async def patched_authorize(self, username, password):
    async with aiohttp.ClientSession() as session:
        headers = {
            "Accept-API-Version": "resource=2.1, protocol=1.0",
            "Accept-Language": "en-US",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        }
        data = {}
        
        for step in range(15):
            if "callbacks" in data:
                for cb in data["callbacks"]:
                    cb_type = cb.get("type")
                    prompt_val = cb.get("output", [{}])[0].get("value")
                    
                    if cb_type == "NameCallback":
                        if prompt_val == "ui_locales":
                            cb["input"][0]["value"] = "en-US"
                        elif prompt_val == "User Name" or "user" in prompt_val.lower():
                            cb["input"][0]["value"] = username
                        else:
                            cb["input"][0]["value"] = username
                            
                    elif cb_type == "PasswordCallback":
                        if "one time password" in prompt_val.lower() or "otp" in prompt_val.lower():
                            print(f"\n[SECURITY] {prompt_val}")
                            otp_code = os.getenv("TOYOTA_OTP")
                            if not otp_code and len(sys.argv) > 1:
                                otp_code = sys.argv[1].strip()
                            if not otp_code:
                                otp_code = input("Enter the 6-digit OTP code received on your phone/email: ").strip()
                            cb["input"][0]["value"] = otp_code
                        else:
                            cb["input"][0]["value"] = password
                            
                    elif cb_type == "TextOutputCallback":
                        print(f"\n[INFO] Message from Toyota: {prompt_val}")
                        if "invalid" in prompt_val.lower() or "error" in prompt_val.lower():
                            raise LoginError(f"Toyota error: {prompt_val}")
            
            async with session.post(
                ToyotaOneAuth.AUTHENTICATE_URL, json=data, headers=headers
            ) as resp:
                if resp.status != 200:
                    print(f"\n[ERROR] Server returned HTTP {resp.status}")
                    raise LoginError()
                data = await resp.json()
                if "tokenId" in data:
                    break
        
        if "tokenId" not in data:
            raise LoginError("Failed to authenticate.")
            
        # Get Auth Code
        headers["Cookie"] = f"iPlanetDirectoryPro={data['tokenId']}"
        auth_params = {
            "client_id": "oneappsdkclient",
            "scope": "openid profile write",
            "response_type": "code",
            "redirect_uri": "com.toyota.oneapp:/oauth2Callback",
            "code_challenge": "plain",
            "code_challenge_method": "plain",
        }
        AUTHORIZE_URL_QS = f"{ToyotaOneAuth.AUTHORIZE_URL}?{urlencode(auth_params)}"
        async with session.get(
            AUTHORIZE_URL_QS, headers=headers, allow_redirects=False
        ) as resp:
            if resp.status != 302:
                raise LoginError()
            redir = resp.headers["Location"]
            query = parse_qs(urlparse(redir).query)
            if "code" not in query:
                raise LoginError()
            return query["code"][0]

ToyotaOneAuth.authorize = patched_authorize

async def main():
    print("==================================================")
    print("   Sovereign Mesh: Toyota Telematics Setup        ")
    print("==================================================")
    
    # Load credentials from .env
    # We parse the file manually to ensure we always have the latest writes
    username = None
    password = None
    env_file = "/app/creative-liberation-engine/.env"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if line.startswith("TOYOTA_USERNAME="):
                    username = line.split("=")[1].strip().strip('"').strip("'")
                elif line.startswith("TOYOTA_PASSWORD="):
                    password = line.split("=")[1].strip().strip('"').strip("'")
    
    if not username or not password:
        print("[ERROR] Credentials not found in .env file.")
        sys.exit(1)
        
    print(f"Target Account: {username}")
    client = ToyotaOneClient()
    
    try:
        print("Starting secure authentication handshake with Toyota Cloud...")
        await client.auth.login(username, password)
        
        # Save tokens
        tokens = client.auth.get_tokens()
        os.makedirs(os.path.dirname(TOKENS_FILE), exist_ok=True)
        with open(TOKENS_FILE, 'w') as f:
            json.dump(tokens, f, indent=2)
            
        print("\n==================================================")
        print("[SUCCESS] Telematics Token successfully generated!")
        print(f"Saved secure token database to: {TOKENS_FILE}")
        print("==================================================")
        
    except Exception as e:
        print(f"\n[ERROR] Setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
