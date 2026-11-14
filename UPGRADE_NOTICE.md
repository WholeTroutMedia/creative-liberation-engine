# Creative Liberation Engine · Release & Upgrade Notice `v2.1.0` (2026-11-14 12:19 UTC)

If you previously cloned **`WholeTroutMedia/creative-liberation-engine`** (or any companion repository), run `git pull origin main` to receive the `v2.1.0` updates:

1. **Single Canonical Home for Creative Liberation Engine**:
   - **`WholeTroutMedia/creative-liberation-engine`** is the sole canonical repository for the Creative Liberation Engine.
   - The legacy duplicate seed folder (`apps/000-cle-foundation-seed-os`) inside `WholeTroutMedia/open-source-micro-tools` has been retired and replaced by [`apps/000-stir-iescs-protocol-sdk`](https://github.com/WholeTroutMedia/open-source-micro-tools/tree/main/apps/000-stir-iescs-protocol-sdk).
2. **New Community Gift #7: `stir-iescs-rosetta-doctor` (`gifts/stir_iescs_rosetta_doctor.py`)**:
   - Runnable zero-dependency implementation of **STIR-1.0** (Kleene 3-valued `{-1, 0, +1}` wire framing + CRC32C) and **IESCS** (`&domain:op{...}` call-words + plain-English human receipts).
   - Run `./bin/cle gifts --run stir-iescs-rosetta-doctor` or `python3 gifts/stir_iescs_rosetta_doctor.py --json`.
3. **Free Maintainer Bot-Shield (`v2.1`)**:
   - Available for one-step copy-paste at [`WholeTroutMedia/open-source-bounties/.github/workflows/open-source-bot-shield.yml`](https://github.com/WholeTroutMedia/open-source-bounties/blob/main/.github/workflows/open-source-bot-shield.yml) (and mirrored at `templates/open-source-bot-shield.yml`).

## Quick Upgrade Commands for Existing Clones
```bash
git fetch --all --tags
git pull origin main
./bin/cle gifts --run stir-iescs-rosetta-doctor
make test
```
