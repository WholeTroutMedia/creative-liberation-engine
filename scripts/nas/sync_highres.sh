#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Creative Liberation Engine V6 — Alpon X5 High-Resolution Sync Wrapper
# Triggers the Python high-res sync manager targeting the local NAS.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/sync_high_res.py"
