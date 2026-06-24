import os

TARGET_DIR = r"y:\CLE_FULL"

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".pnpm-store",
    ".kilocode",
    ".kade",
    "playwright-profile",
    "__pycache__",
    "dist",
    "build",
    ".next",
    ".turbo",
}

BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.gz', '.tar', '.db', 
    '.db-shm', '.db-wal', '.sqlite', '.exe', '.dll', '.so', '.bin', '.woff', '.woff2', 
    '.ttf', '.eot', '.mp3', '.mp4', '.wav', '.ogg', '.webm'
}

REPLACEMENTS = [
    ("Creative Liberation Engine V6", "Creative Liberation Engine Full"),
    ("Creative Liberation Engine", "Creative Liberation Engine"),
    ("cle engine", "creative liberation engine"),
    ("CLE ENGINE", "CREATIVE LIBERATION ENGINE"),
    ("Creative Liberation Engine", "Creative Liberation OS"),
    ("cle os", "creative liberation os"),
    ("CLE OS", "CREATIVE LIBERATION OS"),
    ("CLE", "Creative Liberation"),
    ("cle", "cle"),
    ("CLE", "CLE"),
    
    # Workspaces / Projects
    ("creative-liberation-engine", "cle-full"),
    ("creative-liberation-engine_v6", "cle_full"),
    ("creative-liberation-engine", "cle-full"),
    ("creative-liberation-engine_v7", "cle_full"),
    ("creative-liberation-engine", "cle"),
    ("Infusion Engine", "Creative Liberation Engine"),
    
    # AI Agents / Roles
    ("AVERI (ATHENA, VERA, IRIS)", "CLE CORE ORCHESTRATOR"),
    ("AVERI", "CLE_CORE"),
    ("Averi", "CleCore"),
    ("averi", "cle_core"),
    ("ATHENA", "ORCHESTRATOR"),
    ("Athena", "Orchestrator"),
    ("athena", "orchestrator"),
    ("VERA", "SECURITY"),
    ("Vera", "Security"),
    ("vera", "security"),
    ("IRIS", "INTERFACE"),
    ("Iris", "Interface"),
    ("iris", "interface"),
    
    # Author details
    ("jaharoni", "cle_user"),
    ("jahar", "cle_user"),
    ("Sovereign Artist", "CLE Creator"),
    ("justin-aharoni", "cle-creator"),
    ("justin_aharoni", "cle_creator"),
]

def scrub_text(text):
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text

def re_scrub():
    print("Starting post-copy universal re-scrub and UTF-16 to UTF-8 conversion...")
    count_scrubbed = 0
    
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in BINARY_EXTENSIONS:
                continue
                
            file_path = os.path.join(root, file)
            
            # Read file raw bytes to inspect BOM or encoding
            try:
                with open(file_path, 'rb') as f:
                    raw = f.read()
            except Exception as e:
                print(f"Error reading file bytes {file_path}: {e}")
                continue
                
            if not raw:
                continue
                
            # Determine encoding
            encoding = 'utf-8'
            if raw.startswith(b'\xff\xfe'):
                encoding = 'utf-16'
            elif raw.startswith(b'\xfe\xff'):
                encoding = 'utf-16'
            elif b'\x00' in raw:
                # Likely UTF-16 or containing null bytes
                encoding = 'utf-16'
                
            # Try to decode
            decoded = None
            try:
                decoded = raw.decode(encoding)
            except Exception:
                # Fallback to utf-8 or latin-1 if utf-16 failed
                for enc in ['utf-8', 'latin-1', 'utf-16']:
                    try:
                        decoded = raw.decode(enc)
                        encoding = enc
                        break
                    except Exception:
                        pass
                        
            if decoded is None:
                print(f"Skipping un-decodable file: {file_path}")
                continue
                
            # Check if any replacement keyword is in the decoded text
            keywords = [old for old, _ in REPLACEMENTS]
            contains_keywords = any(kw in decoded for kw in keywords)
            
            if contains_keywords or encoding == 'utf-16':
                scrubbed = scrub_text(decoded)
                
                # Write back as standard UTF-8
                try:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(scrubbed)
                    if encoding == 'utf-16':
                        print(f"Converted and scrubbed UTF-16 -> UTF-8: {file_path}")
                    else:
                        print(f"Scrubbed missed branding in UTF-8: {file_path}")
                    count_scrubbed += 1
                except Exception as e:
                    print(f"Error writing scrubbed file {file_path}: {e}")
                    
    print(f"Post-scrub complete. Total files scrubbed/converted: {count_scrubbed}")

if __name__ == "__main__":
    re_scrub()
