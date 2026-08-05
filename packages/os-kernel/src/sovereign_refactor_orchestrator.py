#!/usr/bin/env python3
"""
Sovereign Refactoring Engine - Master Orchestrator
Part of CLE-OS Beta v1.5 Upgrade Suite.

Main execution loop bridging Context Packing, Dual Model API Bridging,
Sandboxed Fuzzy Verification, Git Checkpointing, and NAS Container Deployment.
Supports scoped execution via --target-path for incremental validation.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from refactor_context_packer import ContextPacker
from refactor_model_bridge import ModelBridge
from refactor_verification_sandbox import VerificationSandbox

AUDIT_LOG_PATH = Path("runtime/registry/refactor_v1.5_audit.json")

class SovereignRefactorOrchestrator:
    def __init__(self, repo_root: str = "Y:/creative-liberation-engine", target_path: Optional[str] = None, macro_model: Optional[str] = None, patch_model: Optional[str] = None):
        self.repo_root = Path(repo_root).resolve()
        self.target_dir = (self.repo_root / target_path).resolve() if target_path else self.repo_root
        self.packer = ContextPacker(str(self.target_dir))
        self.bridge = ModelBridge(macro_model=macro_model, patch_model=patch_model)
        self.sandbox = VerificationSandbox(str(self.repo_root))
        self.audit_log: List[Dict[str, Any]] = []

    def ensure_audit_log(self):
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if AUDIT_LOG_PATH.exists():
            try:
                self.audit_log = json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
            except Exception:
                self.audit_log = []

    def save_audit_log(self):
        AUDIT_LOG_PATH.write_text(json.dumps(self.audit_log, indent=2), encoding="utf-8")
        print(f"[AUDIT] Saved execution record to {AUDIT_LOG_PATH}")

    def execute_phase(self, phase_name: str, dry_run: bool = False):
        print(f"\n=======================================================")
        print(f"  STARTING PHASE: {phase_name.upper()} [Target: {self.target_dir.name}]")
        print(f"=======================================================\n")

        # Step 1: Context Ingestion & Repository AST Map Generation
        print("[1/4] Packing codebase AST structural skeleton & Table of Contents...")
        ast_map = self.packer.generate_ast_map()
        formatted_ast = "<repository_map>\n" + "\n".join(f"## `{k}`\n```\n{v}\n```" for k, v in ast_map.items()) + "\n</repository_map>"
        print(f"      Packed AST skeleton & ToC index across {len(ast_map)} files.")

        # Step 2: Model API Task DAG Generation
        print("[2/4] Communicating with High-Context Model API to build topological Task DAG...")
        tasks = self.bridge.generate_task_dag(formatted_ast[:150000], phase_name)
        print(f"      Generated {len(tasks)} actionable refactoring tasks.")

        if dry_run:
            print("[DRY-RUN] Task DAG output preview:")
            print(json.dumps(tasks, indent=2))
            return

        # Step 3: Sandboxed Execution & Auto-Remediation Loop
        print("[3/4] Executing sandboxed refactoring loop with Fuzzy Matcher & Unit Tests...")
        for task in tasks:
            task_id = task.get("id", "UNKNOWN")
            file_path = task.get("file_path")
            issue = task.get("issue")
            component = task.get("component", "Core")

            print(f"\n---> Task [{task_id}] Target: {file_path}")
            print(f"     Issue: {issue}")

            target_full_path = self.target_dir / file_path
            if not target_full_path.exists():
                target_full_path = self.repo_root / file_path
            if not target_full_path.exists():
                print(f"     [SKIP] Target file {file_path} does not exist.")
                continue
            
            rel_file_path = str(target_full_path.relative_to(self.repo_root)).replace("\\", "/")

            current_content = target_full_path.read_text(encoding="utf-8", errors="ignore")
            
            # Generate diff patch
            chunks = self.bridge.generate_search_replace_patch(task, current_content)
            if not chunks:
                print(f"     [WARN] Could not parse valid SEARCH/REPLACE chunks for {task_id}.")
                continue

            # Apply patch via Fuzzy Matcher
            applied, apply_msg = self.sandbox.apply_patch(rel_file_path, chunks)
            if not applied:
                print(f"     [FAIL] Patch application failed: {apply_msg}")
                continue

            # Verify build, linting, & unit tests
            verified, verify_log = self.sandbox.verify_file(rel_file_path)
            
            # Retry loop if verification failed
            retries = 0
            while not verified and retries < 2:
                retries += 1
                print(f"     [RETRY {retries}/2] Verification failed. Feeding error log back to Model API...")
                task["issue"] += f"\n\nPrevious attempt failed with error:\n{verify_log}"
                chunks = self.bridge.generate_search_replace_patch(task, current_content)
                if chunks:
                    applied, apply_msg = self.sandbox.apply_patch(rel_file_path, chunks)
                    if applied:
                        verified, verify_log = self.sandbox.verify_file(rel_file_path)

            if verified:
                committed, commit_msg = self.sandbox.git_commit(task_id, component, issue[:50])
                print(f"     [SUCCESS] {commit_msg}")
                self.audit_log.append({
                    "task_id": task_id,
                    "phase": phase_name,
                    "file": rel_file_path,
                    "status": "SUCCESS",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                })
            else:
                rollback_msg = self.sandbox.rollback_file(rel_file_path)
                print(f"     [REVERTED] Verification failed after retries: {rollback_msg}")
                self.audit_log.append({
                    "task_id": task_id,
                    "phase": phase_name,
                    "file": rel_file_path,
                    "status": "ROLLED_BACK",
                    "error": verify_log,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                })

        # Step 4: Audit Save
        self.ensure_audit_log()
        self.save_audit_log()
        print(f"\n[4/4] Phase {phase_name} complete.")

def main():
    parser = argparse.ArgumentParser(description="Sovereign Refactoring Engine Orchestrator (CLE-OS Beta v1.5)")
    parser.add_argument("--root", default="Y:/creative-liberation-engine", help="Repo root directory")
    parser.add_argument("--target-path", help="Optional relative subfolder path to target (e.g. 'scripts' or 'packages/ui')")
    parser.add_argument("--phase", choices=["1_macro", "2_infra", "3_domain", "all"], default="1_macro", help="Phase to execute")
    parser.add_argument("--dry-run", action="store_true", help="Generate task DAG without modifying files")
    parser.add_argument("--macro-model", help="High-Context model for Phase 1 Task DAG generation")
    parser.add_argument("--patch-model", help="Granular model for Phase 2/3 patch generation")
    args = parser.parse_args()

    orchestrator = SovereignRefactorOrchestrator(
        repo_root=args.root,
        target_path=args.target_path,
        macro_model=args.macro_model,
        patch_model=args.patch_model
    )

    if args.phase == "all":
        for p in ["1_macro", "2_infra", "3_domain"]:
            orchestrator.execute_phase(p, dry_run=args.dry_run)
    else:
        orchestrator.execute_phase(args.phase, dry_run=args.dry_run)

if __name__ == "__main__":
    main()

