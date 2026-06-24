#!/usr/bin/env python3
import os
import sys
import subprocess
import argparse

# Base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_DIR = os.path.join(BASE_DIR, "runtime", "session", "keys")

def run_cmd(cmd):
    """Executes a command and raises an exception on failure."""
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Error executing command: {result.stderr}", file=sys.stderr)
        raise RuntimeError(result.stderr)
    return result.stdout

def setup_directories():
    """Ensure the target directories exist."""
    os.makedirs(KEYS_DIR, exist_ok=True)
    print(f"Keys directory verified: {KEYS_DIR}")

def generate_ca():
    """Generates the CLE Root CA if it doesn't exist."""
    ca_key = os.path.join(KEYS_DIR, "cle-ca.key")
    ca_crt = os.path.join(KEYS_DIR, "cle-ca.crt")
    
    if os.path.exists(ca_key) and os.path.exists(ca_crt):
        print("CLE Root CA already exists. Skipping CA generation.")
        return ca_key, ca_crt
        
    print("Generating CLE Root CA (ECC prime256v1)...")
    # Generate private key for CA
    run_cmd(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", ca_key])
    
    # Self-sign Root CA
    subj = "/C=US/O=CLEEngine/CN=CLERootCA"
    run_cmd([
        "openssl", "req", "-new", "-x509", "-days", "3650", 
        "-key", ca_key, "-out", ca_crt, 
        "-subj", subj
    ])
    
    print(f"CA generated successfully:\n  Key: {ca_key}\n  Cert: {ca_crt}")
    return ca_key, ca_crt

def generate_client_cert(client_name, passphrase):
    """Generates a client key, cert, and packages into a .p12 bundle."""
    ca_key = os.path.join(KEYS_DIR, "cle-ca.key")
    ca_crt = os.path.join(KEYS_DIR, "cle-ca.crt")
    
    client_key = os.path.join(KEYS_DIR, f"{client_name}.key")
    client_csr = os.path.join(KEYS_DIR, f"{client_name}.csr")
    client_crt = os.path.join(KEYS_DIR, f"{client_name}.crt")
    client_p12 = os.path.join(KEYS_DIR, f"{client_name}.p12")
    
    print(f"Generating Client Certificate for: {client_name}...")
    
    # Generate Client Private Key (ECC)
    run_cmd(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", client_key])
    
    # Generate CSR
    subj = f"/C=US/O=CLEEngine/OU=MobileClient/CN={client_name}"
    run_cmd([
        "openssl", "req", "-new", "-key", client_key, 
        "-out", client_csr, "-subj", subj
    ])
    
    # Sign client cert using our CA
    run_cmd([
        "openssl", "x509", "-req", "-days", "1825", 
        "-in", client_csr, "-CA", ca_crt, "-CAkey", ca_key, 
        "-CAcreateserial", "-out", client_crt
    ])
    
    # Package into PKCS#12 bundle (.p12) for iOS import
    p12_cmd = [
        "openssl", "pkcs12", "-export", 
        "-out", client_p12, 
        "-inkey", client_key, 
        "-in", client_crt, 
        "-certfile", ca_crt,
        "-passout", f"pass:{passphrase}"
    ]
    run_cmd(p12_cmd)
    
    # Cleanup temporary CSR
    if os.path.exists(client_csr):
        os.remove(client_csr)
        
    print("\n" + "="*50)
    print(f"SUCCESS: Client '{client_name}' configured!")
    print(f"ECC Key:  {client_key}")
    print(f"Cert:     {client_crt}")
    print(f"P12 Pack: {client_p12} (Import to iOS with your passphrase)")
    print("="*50)

def generate_server_cert(server_name="cle-core.local", ip_address="127.0.0.1"):
    """Generates a server private key and certificate signed by the CA, with SANs."""
    ca_key = os.path.join(KEYS_DIR, "cle-ca.key")
    ca_crt = os.path.join(KEYS_DIR, "cle-ca.crt")
    
    server_key = os.path.join(KEYS_DIR, "cle-server.key")
    server_csr = os.path.join(KEYS_DIR, "cle-server.csr")
    server_crt = os.path.join(KEYS_DIR, "cle-server.crt")
    server_ext = os.path.join(KEYS_DIR, "cle-server.ext")
    
    if os.path.exists(server_key) and os.path.exists(server_crt):
        print("CLE Server Cert already exists. Skipping.")
        return server_key, server_crt
        
    print(f"Generating Server Certificate for: {server_name}...")
    
    # Generate Server Private Key (ECC)
    run_cmd(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", server_key])
    
    # Generate CSR
    subj = f"/C=US/O=CLEEngine/CN={server_name}"
    run_cmd([
        "openssl", "req", "-new", "-key", server_key, 
        "-out", server_csr, "-subj", subj
    ])
    
    # Create extension file for SAN
    ext_content = f"""authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = {server_name}
DNS.2 = localhost
DNS.3 = cle-core.local
IP.1 = 127.0.0.1
IP.2 = {ip_address}
"""
    with open(server_ext, "w") as f:
        f.write(ext_content)
        
    # Sign server cert using CA
    run_cmd([
        "openssl", "x509", "-req", "-days", "1825", 
        "-in", server_csr, "-CA", ca_crt, "-CAkey", ca_key, 
        "-CAcreateserial", "-out", server_crt,
        "-extfile", server_ext
    ])
    
    # Cleanup temporary files
    if os.path.exists(server_csr):
        os.remove(server_csr)
    if os.path.exists(server_ext):
        os.remove(server_ext)
        
    print(f"Server Cert generated successfully:\n  Key: {server_key}\n  Cert: {server_crt}")
    return server_key, server_crt

def main():
    parser = argparse.ArgumentParser(description="Creative Liberation Engine Mobile Mesh mTLS Key Generator")
    parser.add_argument("--client", default="iphone15-promax", help="Name of the client certificate (default: iphone15-promax)")
    parser.add_argument("--passphrase", default="cle-secure", help="Passphrase to encrypt the P12 file for import (default: cle-secure)")
    parser.add_argument("--server-name", default="cle-core.local", help="Common Name for server certificate (default: cle-core.local)")
    parser.add_argument("--server-ip", default="127.0.0.1", help="IP address for server certificate SAN (default: 127.0.0.1)")
    
    args = parser.parse_args()
    
    try:
        setup_directories()
        generate_ca()
        generate_server_cert(args.server_name, args.server_ip)
        generate_client_cert(args.client, args.passphrase)
    except Exception as e:
        print(f"\nFATAL ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

