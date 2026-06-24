import os
import shutil
import re

SOURCE_DIR = r"y:\creative-liberation-engine"
TARGET_DIR = r"y:\CLE_FULL"

# Exclude directories
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
    "archive",
}

# Exclude files (exact match or suffix match)
EXCLUDE_FILES = {
    "Cookies",
    "weavy_token.txt",
    "mobile_gateway.db-shm",
    "mobile_gateway.db-wal",
    "mobile_gateway.db",
    "build.log",
    "build2.log",
    "build3.log",
    "build4.log",
    "build5.log",
    "build6.log",
    "build7.log",
    "err.log",
    "out.log",
    "test_import.log",
    "test_simple.log",
    "cortex_harvest_log.txt",
    "cortex_harvest_log_2.txt",
    "cortex_storage_dump.json",
    "cortex_state.json",
    "cortex_signup_agent.py",
    "cortex_signup_agent_utf8.py",
    "run_cortex_signups.py",
    "cortex-chat-bridge.tar.gz",
    "creative-liberation-engine.tar.gz",
    "creative-liberation-engine.zip",
    "comet.tar",
    "dispatch.tar",
    "genkit.tar",
    "genkit.zip",
    "sentinel.tar",
    "sync.tar",
    "latent-space-theme.zip",
    "v6_architecture_docs.zip",
    "v6_codebase_report_source.txt",
}

EXCLUDE_FILE_PATTERNS = [
    r".*\.png$",
    r".*\.jpg$",
    r".*\.jpeg$",
    r".*\.db$",
    r".*\.html$", # wait, we have some html screenshots/dom dumps we should exclude, but keep actual frontend html if any. Let's just exclude known dom dumps.
]

# Explicit document exclusions
EXCLUDE_DOCS = {
    r"docs\barnstorm_vlan_topology.md",
    r"docs\nas-path-registry.json",
    r"docs\NAS_PATH_REGISTRY.md",
    r"docs\GOVERNANCE_PRECEDENCE.md",
}

# String Replacements
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
    
    # AI Agents / Roles (Scrubbing CLE leadership collective)
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

def is_binary(file_path):
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            if b'\x00' in chunk:
                return True
            return False
    except Exception:
        return True

def rename_path_segment(segment):
    # Perform renaming of files/directories containing branding keywords
    seg_lower = segment.lower()
    if "cle" in seg_lower:
        segment = re.sub("cle", "cle", segment, flags=re.IGNORECASE)
    if "creative-liberation-engine" in seg_lower:
        segment = re.sub("creative-liberation-engine", "cle", segment, flags=re.IGNORECASE)
    if "averi" in seg_lower:
        segment = re.sub("averi", "cle_core", segment, flags=re.IGNORECASE)
    return segment

def clean_and_obfuscate_env(source_path, target_path):
    # Read .env file and obfuscate values to make an example file
    try:
        with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            line_strip = line.strip()
            if not line_strip or line_strip.startswith('#'):
                new_lines.append(line)
                continue
            if '=' in line_strip:
                key, val = line_strip.split('=', 1)
                # Obfuscate credentials or keys
                if any(x in key.upper() for x in ["KEY", "SECRET", "PASSWORD", "TOKEN", "PASS", "AUTH", "CREDENTIALS"]):
                    new_lines.append(f"{key}=your_{key.lower()}_here\n")
                elif "127.0.0.1" in val:
                    new_lines.append(f"{key}={val.replace('127.0.0.1', 'localhost')}\n")
                else:
                    new_lines.append(f"{key}={val}\n")
            else:
                new_lines.append(line)
        
        with open(target_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Created obfuscated env template: {target_path}")
    except Exception as e:
        print(f"Error handling env file {source_path}: {e}")

def scrub_text(text):
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text

def copy_and_scrub():
    if os.path.exists(TARGET_DIR):
        print(f"Removing existing target directory: {TARGET_DIR}")
        shutil.rmtree(TARGET_DIR)
    
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    for root, dirs, files in os.walk(SOURCE_DIR):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            # Check exclusions
            if file in EXCLUDE_FILES:
                continue
            
            # Suffix/pattern checks
            skip = False
            for pat in EXCLUDE_FILE_PATTERNS:
                if re.match(pat, file, re.IGNORECASE):
                    skip = True
                    break
            if skip:
                continue
            
            src_file_path = os.path.join(root, file)
            rel_path = os.path.relpath(src_file_path, SOURCE_DIR)
            
            # Exclude docs
            if rel_path in EXCLUDE_DOCS:
                continue
            
            # Suffix/name exclusions for local files
            if "dom.html" in file or "screenshot" in file or file.endswith(".png") or file.endswith(".jpg"):
                continue
                
            # Build target path with renamed segments
            path_parts = rel_path.split(os.sep)
            renamed_parts = [rename_path_segment(p) for p in path_parts]
            dest_file_path = os.path.join(TARGET_DIR, *renamed_parts)
            
            dest_dir = os.path.dirname(dest_file_path)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Check if env file
            if file.startswith(".env"):
                # Always write it to .env.example
                env_example_path = os.path.join(dest_dir, ".env.example")
                clean_and_obfuscate_env(src_file_path, env_example_path)
                continue
            
            # Copy and scrub
            if is_binary(src_file_path):
                shutil.copy2(src_file_path, dest_file_path)
            else:
                try:
                    with open(src_file_path, 'r', encoding='utf-8', errors='ignore') as sf:
                        content = sf.read()
                    
                    scrubbed_content = scrub_text(content)
                    
                    with open(dest_file_path, 'w', encoding='utf-8') as df:
                        df.write(scrubbed_content)
                except Exception as e:
                    print(f"Failed to scrub text file {src_file_path}, copying binary: {e}")
                    shutil.copy2(src_file_path, dest_file_path)

if __name__ == "__main__":
    print("Starting copy and scrub process...")
    copy_and_scrub()
    print("Process complete!")
