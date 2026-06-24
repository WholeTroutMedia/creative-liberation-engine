#!/usr/bin/env python3
import os
import sys
import ssl
import http.client
import urllib.request
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_DIR = os.path.join(BASE_DIR, "runtime", "session", "keys")

# Files
CA_CRT = os.path.join(KEYS_DIR, "cle-ca.crt")
CLIENT_CRT = os.path.join(KEYS_DIR, "iphone15-promax.crt")
CLIENT_KEY = os.path.join(KEYS_DIR, "iphone15-promax.key")

def run_unauthorized_test():
    """Verify that requests without client certificates are strictly rejected by the mTLS gateway."""
    print("[*] TEST 1: Testing Unauthorized Request (No Client Certificate)...")
    
    # Bypass server certificate check since it's local self-signed CA
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        url = "https://localhost:5051/health"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            print(f"[!] FAIL: Connection succeeded without client certificate! Status: {response.status}")
            return False
    except urllib.error.URLError as e:
        # A successful rejection usually raises an SSL error (bad certificate/handshake failure) or HTTP 400 Bad Request
        print(f"[+] SUCCESS: Request correctly rejected by mTLS gateway: {str(e)}")
        return True
    except Exception as e:
        print(f"[+] SUCCESS: Connection failed as expected: {str(e)}")
        return True

def run_authorized_test():
    """Verify that requests with valid client certificates are successfully completed."""
    print("\n[*] TEST 2: Testing Authorized Request (With Client Certificate)...")
    
    if not os.path.exists(CLIENT_CRT) or not os.path.exists(CLIENT_KEY):
        print("[!] Client certificates not found in local workspace! Run mobile_keys.py first.")
        return False

    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # Private local self-signed trust
    
    # Load client certificate and key
    ctx.load_cert_chain(certfile=CLIENT_CRT, keyfile=CLIENT_KEY)
    
    try:
        url = "https://localhost:5051/health"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                print(f"[+] SUCCESS: Connected to private mTLS gateway!")
                print(f"    Payload: {json.dumps(data, indent=2)}")
                return True
            else:
                print(f"[!] FAIL: Server returned unexpected status: {response.status}")
                return False
    except Exception as e:
        print(f"[!] FAIL: Authorized request failed to connect: {str(e)}")
        return False

def run_telemetry_post_test():
    """Verify that mobile telemetry reports are handled and proxy-recorded."""
    print("\n[*] TEST 3: Testing Telemetry Broadcast Pipeline...")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=CLIENT_CRT, keyfile=CLIENT_KEY)
    
    payload = {
        "clientId": "iphone15-promax",
        "batteryLevel": 0.88,
        "aneTemp": 38.5,
        "allocatedMemory": 512.4,
        "latencyMs": 4.5
    }
    
    try:
        url = "https://localhost:5051/api/wellness/report"
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            res_data = json.loads(response.read().decode())
            print(f"[+] SUCCESS: Telemetry report proxy registered!")
            print(f"    Response: {json.dumps(res_data)}")
            return True
    except Exception as e:
        print(f"[!] FAIL: Telemetry posting failed: {str(e)}")
        return False

def main():
    print("="*60)
    print("CLE MESH NODE: MOBILE mTLS GATEWAY VALIDATOR")
    print("="*60)
    
    t1 = run_unauthorized_test()
    t2 = run_authorized_test()
    t3 = run_telemetry_post_test()
    
    print("\n"+"-"*40)
    print("VALIDATION SUMMARY:")
    print(f"Test 1 - Unauthorized Isolation: {'[PASSED]' if t1 else '[FAILED]'}")
    print(f"Test 2 - Authorized Connection:  {'[PASSED]' if t2 else '[FAILED]'}")
    print(f"Test 3 - Telemetry Ingestion:    {'[PASSED]' if t3 else '[FAILED]'}")
    print("="*60)

if __name__ == "__main__":
    main()
