#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Creative Liberation Engine V6 — Alpon X5 Edge Node Bootstrapper
# Executed on the Alpon X5 (Debian Bookworm, arm64) to install runtimes & launch
# the CAMERA_INGEST daemon.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "=== [BOOTSTRAP] Starting CLE Edge Bootstrapper ==="
echo "Target: Alpon X5 (RPi CM5, arm64)"
echo "Current User: $(whoami)"

# 1. Update package list and install baseline utilities
echo "=== [BOOTSTRAP] Updating apt and installing baselines ==="
sudo apt-get update
sudo apt-get install -y git curl build-essential sqlite3 libsqlite3-dev

# 2. Install Node.js v20 (LTS)
if ! command -v node &> /dev/null; then
    echo "=== [BOOTSTRAP] Installing Node.js v20 ==="
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "=== [BOOTSTRAP] Node.js is already installed: $(node -v)"
fi

# 3. Install PM2 (Process Manager) globally
if ! command -v pm2 &> /dev/null; then
    echo "=== [BOOTSTRAP] Installing PM2 ==="
    sudo npm install -g pm2
else
    echo "=== [BOOTSTRAP] PM2 is already installed: $(pm2 -v)"
fi

# 4. Prepare directory structure
echo "=== [BOOTSTRAP] Creating service directories ==="
sudo mkdir -p /opt/camera-ingest
sudo chown -R alpon:alpon /opt/camera-ingest

# 5. Initialize credentials & environment variables
echo "=== [BOOTSTRAP] staging environment file ==="
cat << 'EOF' > /opt/camera-ingest/.env
NODE_ENV=production
PORT=3015
DISPATCH_URL=http://127.0.0.1:5160
STORAGE_POOL=NAS_PRIMARY
NAS_INGESTION_DIR=/app/creative-liberation-engine/runtime/ingestion/dropzone
EOF

echo "=== [BOOTSTRAP] Edge Node Provisioning Completed! ==="
echo "Next step: copy the service code and start the process using pm2."
