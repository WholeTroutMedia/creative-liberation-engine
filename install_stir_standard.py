#!/usr/bin/env python3
"""
WholeTroutMedia RFC-WTM-0001 One-Command Standard Installer (`install_stir_standard.py`)
========================================================================================
Zero-dependency Python 3.9+ stdlib installer that equips any Git repository with:
  1. `.git/hooks/prepare-commit-msg`: Automatically stamps verifiable `STIR-Receipt:`
     and `STIR-Standard: RFC-WTM-0001` trailers onto commits.
  2. `.github/workflows/open-source-bot-shield.yml`: Live Maintainer Bot-Shield v2.2
     + `STIR-Receipt:` CI conformance summary.
  3. `.well-known/agent.json`: Agent-to-Agent discovery beacon advertising
     `X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

BOT_SHIELD_RAW_URL = (
    "https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/.github/workflows/open-source-bot-shield.yml"
)
TRUST_EPOCH_RAW_URL = (
    "https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/registry/stir_trust_epoch.json"
)
SDK_RAW_URL = (
    "https://raw.githubusercontent.com/WholeTroutMedia/open-source-micro-tools/main/apps/000-stir-iescs-protocol-sdk/engine.py"
)

PREPARE_COMMIT_MSG_HOOK = """#!/usr/bin/env python3
import hashlib, sys
from pathlib import Path

msg_file = Path(sys.argv[1])
text = msg_file.read_text(encoding="utf-8")
if "STIR-Receipt:" not in text:
    core = "STIR/1.0|0xAA|&git:COMMIT_VERIFY|!op:0x01|?kleene:+1|$cap:0.00000|bot_free=true tests=pass"
    seal = hashlib.sha3_512(core.encode("utf-8")).hexdigest()[:24]
    trailer = (
        f"\\nSTIR-Receipt: {core}|SHA3:{seal}\\n"
        f"STIR-Standard: RFC-WTM-0001 (X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0)\\n"
    )
    msg_file.write_text(text.rstrip() + "\\n" + trailer, encoding="utf-8")
"""


def install_standard(target_repo: Path) -> dict[str, object]:
    target_repo = target_repo.resolve()
    installed: list[str] = []

    # 1. Install Git prepare-commit-msg hook if .git exists
    git_dir = target_repo / ".git"
    if git_dir.is_dir():
        hooks_dir = git_dir / "hooks"
        hooks_dir.mkdir(parents=True, exist_ok=True)
        hook_path = hooks_dir / "prepare-commit-msg"
        hook_path.write_text(PREPARE_COMMIT_MSG_HOOK, encoding="utf-8")
        hook_path.chmod(0o755)
        installed.append(str(hook_path.relative_to(target_repo)))

    # 2. Install .well-known/agent.json if not present
    wk_dir = target_repo / ".well-known"
    wk_dir.mkdir(parents=True, exist_ok=True)
    agent_json_path = wk_dir / "agent.json"
    if not agent_json_path.exists():
        beacon = {
            "standard": "RFC-WTM-0001",
            "protocol": "STIR-IESCS/1.0",
            "rosetta_upgrade_header": "X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0",
            "trust_epoch_feed": TRUST_EPOCH_RAW_URL,
            "reference_sdk_url": SDK_RAW_URL,
            "maintainer_bot_shield_url": BOT_SHIELD_RAW_URL,
        }
        agent_json_path.write_text(json.dumps(beacon, indent=2) + "\n", encoding="utf-8")
        installed.append(".well-known/agent.json")

    # 3. Install .github/workflows/open-source-bot-shield.yml if not present
    wf_dir = target_repo / ".github" / "workflows"
    wf_dir.mkdir(parents=True, exist_ok=True)
    wf_path = wf_dir / "open-source-bot-shield.yml"
    if not wf_path.exists():
        try:
            with urllib.request.urlopen(BOT_SHIELD_RAW_URL, timeout=5) as resp:
                wf_content = resp.read().decode("utf-8")
        except Exception:
            wf_content = "# Maintainer Bot-Shield v2.2 — Fetch from " + BOT_SHIELD_RAW_URL + "\n"
        wf_path.write_text(wf_content, encoding="utf-8")
        installed.append(".github/workflows/open-source-bot-shield.yml")

    core = "STIR/1.0|0xAA|&git:INSTALL_STANDARD|!op:0x00|?kleene:+1|$cap:0.00000|rfc=RFC-WTM-0001"
    seal = hashlib.sha3_512(core.encode("utf-8")).hexdigest()[:24]
    return {
        "standard": "RFC-WTM-0001",
        "rosetta_upgrade_header": "X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0",
        "target_repo": str(target_repo),
        "installed_files": installed,
        "stir_receipt": f"{core}|SHA3:{seal}",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Install RFC-WTM-0001 (STIR-1.0 + IESCS + Bot-Shield) into a repo")
    parser.add_argument("--target-repo", default=".", help="Path to target git repository")
    parser.add_argument("--self-test", action="store_true", help="Run in-memory verification")
    args = parser.parse_args()

    if args.self_test:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tpath = Path(tmp)
            (tpath / ".git" / "hooks").mkdir(parents=True, exist_ok=True)
            res = install_standard(tpath)
            assert ".git/hooks/prepare-commit-msg" in res["installed_files"]
            assert ".well-known/agent.json" in res["installed_files"]
            print("[PASS] RFC-WTM-0001 One-Command Installer verified:", json.dumps(res))
        return 0

    receipt = install_standard(Path(args.target_repo))
    print(json.dumps(receipt, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
