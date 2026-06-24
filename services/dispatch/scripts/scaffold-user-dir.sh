#!/bin/bash
# Creative Liberation Engine - Sovereign User Directory Scaffold
# Run this on the live NAS to provision physical file trees for users.

UID_PARAM=$1

if [ -z "$UID_PARAM" ]; then
    echo "Error: UID parameter is required."
    echo "Usage: ./scaffold-user-dir.sh <uid>"
    echo "Example: ./scaffold-user-dir.sh jaharoni"
    exit 1
fi

BASE_DIR="/volume1/cle/users/$UID_PARAM"

echo "Scaffolding sovereign directory tree for user: $UID_PARAM at $BASE_DIR"

# Core structural directories
mkdir -p "$BASE_DIR/identity/auth"
mkdir -p "$BASE_DIR/memory/episodic"
mkdir -p "$BASE_DIR/memory/semantic"
mkdir -p "$BASE_DIR/memory/procedural"
mkdir -p "$BASE_DIR/projects/archive"
mkdir -p "$BASE_DIR/inbox/tasks"
mkdir -p "$BASE_DIR/inbox/signals"
mkdir -p "$BASE_DIR/inbox/digests"
mkdir -p "$BASE_DIR/vault/credentials"
mkdir -p "$BASE_DIR/vault/documents"
mkdir -p "$BASE_DIR/vault/finance/transactions"
mkdir -p "$BASE_DIR/vault/finance/reports"
mkdir -p "$BASE_DIR/comms/gmail"
mkdir -p "$BASE_DIR/comms/calendar"
mkdir -p "$BASE_DIR/comms/contacts"
mkdir -p "$BASE_DIR/agents/sessions"
mkdir -p "$BASE_DIR/media/photos"
mkdir -p "$BASE_DIR/media/audio"
mkdir -p "$BASE_DIR/media/exports"
mkdir -p "$BASE_DIR/meta"

# Set restrictive permissions (assuming standard Linux execution context on the NAS)
chmod 700 "$BASE_DIR"

echo "Directory scaffold complete for $UID_PARAM."
# Note: chown to the desired user/group depending on the NAS setup if run as root.
# Example: chown -R jaharoni:users "$BASE_DIR"
