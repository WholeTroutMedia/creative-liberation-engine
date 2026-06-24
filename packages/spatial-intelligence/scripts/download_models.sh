#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MD="$DIR/../models"
mkdir -p "$MD/utonia" "$MD/da3" "$MD/depthpro"
huggingface-cli download Pointcept/Utonia --local-dir "$MD/utonia"
huggingface-cli download depth-anything/DA3MONO-LARGE --local-dir "$MD/da3"
huggingface-cli download apple/DepthPro-hf --local-dir "$MD/depthpro"
echo Done && du -sh "$MD"