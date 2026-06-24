#!/usr/bin/env bash
# fix(infra): Resolve Docker API version mismatch on NAS runner
# Issue: #45 — client 1.43 < required 1.44
#
# Root cause: Docker client on Gitea Actions runner (NAS) is v1.43,
# but Docker daemon requires API v1.44+. This blocks ALL deploy-genesis.yml runs.
#
# Solution: Update Docker on the NAS, or set DOCKER_API_VERSION env fallback.

set -euo pipefail

echo "=== Docker API Version Fix ==="
echo "Current Docker version:"
docker version --format '{{.Client.APIVersion}}' 2>/dev/null || echo "Docker client not found"
echo ""

# Option 1: Update Docker via Synology package manager
if command -v synopkg &>/dev/null; then
  echo "Synology NAS detected. Updating Docker..."
  sudo synopkg stop Docker
  sudo synopkg update Docker
  sudo synopkg start Docker
  echo "Docker updated. New version:"
  docker version --format '{{.Client.APIVersion}}'
  exit 0
fi

# Option 2: Update Docker on generic Linux
if command -v apt-get &>/dev/null; then
  echo "Debian/Ubuntu detected. Updating Docker..."
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io
  sudo systemctl restart docker
  echo "Docker updated. New version:"
  docker version --format '{{.Client.APIVersion}}'
  exit 0
fi

# Option 3: Set DOCKER_API_VERSION as fallback for act_runner
echo "Could not auto-update Docker. Setting DOCKER_API_VERSION=1.43 as fallback."
echo "Add to your act_runner config or .env:"
echo "  export DOCKER_API_VERSION=1.43"
echo ""
echo "Or update the runner's docker binary manually."
exit 1