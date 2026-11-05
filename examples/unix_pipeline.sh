#!/bin/sh
# Demonstrate composable Unix stdin/stdout piping with Creative Liberation Engine
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 1. Environment Check ==="
"$ROOT_DIR/bin/cle" doctor

echo ""
echo "=== 2. Pipe Stream Through Ideate -> Plan -> Verify ==="
echo "Build a minimal command-line soundscape generator" \
  | "$ROOT_DIR/bin/cle" pipe --stages ideate,plan,verify
