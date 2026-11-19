# Creative Liberation Engine · Release & Upgrade Notice `v2.2.0`

Install directly with one command via `pip` (zero external dependencies) or upgrade an existing checkout:

```bash
# 1-Command Release Wheel Install (Python >= 3.9, 0 external deps)
pip install https://github.com/WholeTroutMedia/creative-liberation-engine/releases/download/v2.2.0/creative_liberation_engine-2.2.0-py3-none-any.whl
cle gifts --run stir-iescs-rosetta-doctor
```

1. **Single Canonical Home & Clean Wheel Packaging (`v2.2.0`)**:
   - **`WholeTroutMedia/creative-liberation-engine`** is the sole canonical repository for the Creative Liberation Engine and now ships self-contained `v2.2.0` wheel (`.whl`), source tarball (`.tar.gz`), and standalone single-file release assets.
   - The legacy duplicate seed folder (`apps/000-cle-foundation-seed-os`) inside `WholeTroutMedia/open-source-micro-tools` has been retired in favor of [`apps/000-stir-iescs-protocol-sdk`](https://github.com/WholeTroutMedia/open-source-micro-tools/tree/main/apps/000-stir-iescs-protocol-sdk).
2. **Community Gift #7: `stir-iescs-rosetta-doctor` (`gifts/stir_iescs_rosetta_doctor.py`)**:
   - Runnable zero-dependency implementation of **STIR-1.0** (Kleene 3-valued `{-1, 0, +1}` wire framing + CRC32C) and **IESCS** (`&domain:op{...}` call-words + plain-English human receipts).
   - Run `cle gifts --run stir-iescs-rosetta-doctor` or download the standalone file directly from [`v2.2.0` Release Assets](https://github.com/WholeTroutMedia/creative-liberation-engine/releases/tag/v2.2.0).
3. **Free Maintainer Bot-Shield (`v2.2`)**:
   - Install in one command inside any repository (`curl -fsSL https://github.com/WholeTroutMedia/open-source-bounties/releases/download/v2.2.0/open-source-bot-shield.yml -o .github/workflows/bot-shield.yml`), or view [`templates/open-source-bot-shield.yml`](https://github.com/WholeTroutMedia/open-source-bounties/blob/main/templates/open-source-bot-shield.yml).

## Quick Upgrade Commands for Existing Clones
```bash
git fetch --all --tags
git pull origin main
./bin/cle gifts --run stir-iescs-rosetta-doctor
make test
```
