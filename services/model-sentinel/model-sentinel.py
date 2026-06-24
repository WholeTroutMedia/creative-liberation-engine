#!/usr/bin/env python3
"""
Model Sentinel — Automated AI Model Fleet Management
Creative Liberation Engine V6

Performs weekly sweeps across all inference endpoints, discovers new model
releases, generates upgrade/sunset recommendations, and maintains the
canonical model registry.

Usage:
    python model-sentinel.py --sweep          # Full sweep with report
    python model-sentinel.py --inventory      # Inventory only
    python model-sentinel.py --discover       # Check for new releases
    python model-sentinel.py --dry-run        # Full sweep, no changes
    python model-sentinel.py --apply-report   # Execute approved recommendations
"""

import argparse
import json
import datetime
import subprocess
import sys
import io
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import yaml
import requests
import smtplib
from email.message import EmailMessage
import time

# ---------------------------------------------------------------------------
# Paths & Env
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config.yaml"

def load_env():
    env_file = SCRIPT_DIR / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip()

load_env()
REPO_ROOT = SCRIPT_DIR.parent.parent  # creative-liberation-engine
REGISTRY_PATH = REPO_ROOT / "runtime" / "registry" / "models.canonical.json"
BLESSED_PATH = REPO_ROOT / "runtime" / "registry" / "models.blessed.md"

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class InstalledModel:
    name: str
    tag: str
    size_gb: float
    modified: str
    endpoint: str  # which hardware this is on
    full_name: str = ""

    def __post_init__(self):
        self.full_name = f"{self.name}:{self.tag}" if self.tag else self.name


@dataclass
class UpstreamModel:
    name: str
    source: str  # ollama, huggingface, openrouter
    latest_tag: str = ""
    size_gb: float = 0.0
    released: str = ""
    description: str = ""
    license: str = ""
    downloads: int = 0
    tags: list = field(default_factory=list)
    pricing: Optional[dict] = None


@dataclass
class Recommendation:
    action: str  # UPGRADE, ADD, SUNSET, RELOCATE
    tier: str
    current_model: str
    recommended_model: str
    reason: str
    size_delta_gb: float = 0.0
    priority: str = "medium"  # low, medium, high, critical
    sandbox_result: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Load sentinel configuration from YAML."""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Phase 1: Inventory
# ---------------------------------------------------------------------------

def inventory_ollama(endpoint_name: str, url: str) -> list[InstalledModel]:
    """Query an Ollama endpoint for installed models."""
    models = []
    try:
        resp = requests.get(f"{url}/api/tags", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for m in data.get("models", []):
            name_parts = m["name"].split(":")
            name = name_parts[0]
            tag = name_parts[1] if len(name_parts) > 1 else "latest"
            size_gb = round(m.get("size", 0) / (1024 ** 3), 2)
            modified = m.get("modified_at", "unknown")
            models.append(InstalledModel(
                name=name, tag=tag, size_gb=size_gb,
                modified=modified, endpoint=endpoint_name
            ))
    except requests.exceptions.ConnectionError:
        print(f"  ⚠ Cannot reach {endpoint_name} at {url}")
    except Exception as e:
        print(f"  ✗ Error querying {endpoint_name}: {e}")
    return models


def run_inventory(config: dict) -> list[InstalledModel]:
    """Inventory all configured endpoints."""
    print("\n━━━ Phase 1: INVENTORY ━━━")
    all_models = []
    for ep_name, ep_config in config.get("endpoints", {}).items():
        url = ep_config["url"]
        print(f"  Scanning {ep_name} ({url})...")
        models = inventory_ollama(ep_name, url)
        if models:
            for m in models:
                print(f"    ✓ {m.full_name} ({m.size_gb} GB)")
        else:
            print(f"    (no models found)")
        all_models.extend(models)
    print(f"  Total models across fleet: {len(all_models)}")
    return all_models


# ---------------------------------------------------------------------------
# Phase 2: Discovery
# ---------------------------------------------------------------------------

def discover_ollama_library(config: dict) -> list[UpstreamModel]:
    """Check Ollama library for model updates via the search endpoint."""
    models = []
    source_cfg = config.get("sources", {}).get("ollama_library", {})
    if not source_cfg.get("enabled"):
        return models

    print("  Checking Ollama library...")
    families = source_cfg.get("watch_families", [])
    for family in families:
        try:
            # Use the Ollama library page to check for latest tags
            resp = requests.get(
                f"https://ollama.com/api/show",
                params={"name": family},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                models.append(UpstreamModel(
                    name=family,
                    source="ollama",
                    latest_tag=data.get("details", {}).get("parameter_size", ""),
                    description=data.get("modelinfo", {}).get("general.description", ""),
                    license=data.get("license", "unknown"),
                ))
        except Exception:
            pass  # Silently skip failed checks

    # Fallback: use ollama CLI to search
    try:
        result = subprocess.run(
            ["ollama", "list", "--json"],
            capture_output=True, text=True, timeout=15
        )
    except Exception:
        pass

    print(f"    Found {len(models)} tracked families")
    return models


def discover_huggingface(config: dict) -> list[UpstreamModel]:
    """Check HuggingFace for new model releases from watched organizations."""
    models = []
    source_cfg = config.get("sources", {}).get("huggingface", {})
    if not source_cfg.get("enabled"):
        return models

    print("  Checking HuggingFace...")
    orgs = source_cfg.get("watch_orgs", [])
    min_downloads = source_cfg.get("min_downloads", 10000)
    relevant_tasks = source_cfg.get("relevant_tasks", [])

    # Only check models from the last 7 days
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat()

    for org in orgs:
        try:
            resp = requests.get(
                "https://huggingface.co/api/models",
                params={
                    "author": org,
                    "sort": "lastModified",
                    "direction": -1,
                    "limit": 10,
                },
                timeout=15
            )
            if resp.status_code == 200:
                for m in resp.json():
                    downloads = m.get("downloads", 0)
                    if downloads < min_downloads:
                        continue
                    pipeline_tag = m.get("pipeline_tag", "")
                    if relevant_tasks and pipeline_tag not in relevant_tasks:
                        continue
                    models.append(UpstreamModel(
                        name=m.get("modelId", ""),
                        source="huggingface",
                        latest_tag=m.get("sha", "")[:8],
                        released=m.get("lastModified", ""),
                        description=pipeline_tag,
                        license=m.get("license", "unknown") if isinstance(m.get("license"), str) else "unknown",
                        downloads=downloads,
                        tags=m.get("tags", []),
                    ))
        except Exception as e:
            print(f"    ⚠ Failed to query {org}: {e}")

    print(f"    Found {len(models)} recent releases from {len(orgs)} orgs")
    return models


def discover_openrouter(config: dict) -> list[UpstreamModel]:
    """Check OpenRouter for available cloud models and pricing."""
    models = []
    source_cfg = config.get("sources", {}).get("openrouter", {})
    if not source_cfg.get("enabled"):
        return models

    print("  Checking OpenRouter...")
    watch = source_cfg.get("watch_providers", [])

    try:
        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            for m in data.get("data", []):
                model_id = m.get("id", "")
                provider = model_id.split("/")[0] if "/" in model_id else ""
                if watch and provider not in watch:
                    continue
                pricing = m.get("pricing", {})
                models.append(UpstreamModel(
                    name=model_id,
                    source="openrouter",
                    description=m.get("description", "")[:120],
                    pricing={
                        "input_per_m": float(pricing.get("prompt", 0)) * 1_000_000 if pricing.get("prompt") else None,
                        "output_per_m": float(pricing.get("completion", 0)) * 1_000_000 if pricing.get("completion") else None,
                    },
                    tags=[],
                ))
    except Exception as e:
        print(f"    ⚠ OpenRouter query failed: {e}")

    print(f"    Found {len(models)} cloud models from watched providers")
    return models


def run_discovery(config: dict) -> dict:
    """Run all discovery phases."""
    print("\n━━━ Phase 2: DISCOVERY ━━━")
    return {
        "ollama": discover_ollama_library(config),
        "huggingface": discover_huggingface(config),
        "openrouter": discover_openrouter(config),
    }


# ---------------------------------------------------------------------------
# Phase 3: Analysis
# ---------------------------------------------------------------------------

def load_registry() -> dict:
    """Load the canonical model registry."""
    try:
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"modelTiers": [], "fleetServices": []}


def run_sandbox_test(model_name: str, endpoint_url: str, config: dict) -> dict:
    """Pull, test, and optionally delete a model to sandbox test its performance."""
    sb_cfg = config.get("sandbox_testing", {})
    if not sb_cfg.get("enabled"):
        return {}

    print(f"\n    [Sandbox] Testing {model_name}...")
    try:
        # 1. Pull model
        print(f"      Pulling {model_name} (this may take a while)...")
        pull_resp = requests.post(f"{endpoint_url}/api/pull", json={"name": model_name, "stream": False}, timeout=600)
        pull_resp.raise_for_status()

        # 2. Run test prompt
        prompt = sb_cfg.get("test_prompt", "Write a Python function to compute the Fibonacci sequence. Return only code.")
        print(f"      Running benchmark prompt...")
        t0 = time.time()
        gen_resp = requests.post(f"{endpoint_url}/api/generate", json={
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": 200, "temperature": 0.1}
        }, timeout=120)
        t1 = time.time()
        gen_resp.raise_for_status()
        data = gen_resp.json()

        output = data.get("response", "")
        eval_metrics = data.get("eval_count", 0) / (data.get("eval_duration", 1) / 1e9) if data.get("eval_duration") else 0
        success = "def " in output or "function" in output

        result = {
            "tested": True,
            "tokens_per_sec": round(eval_metrics, 1),
            "latency_sec": round(t1 - t0, 2),
            "success": success
        }
        
        icon = "✅" if success else "❌"
        print(f"      {icon} Test complete: {result['tokens_per_sec']} t/s, {result['latency_sec']}s total latency")

        # 3. Cleanup
        if sb_cfg.get("cleanup_after_test") and not config.get("sentinel", {}).get("auto_pull"):
            print(f"      Cleaning up {model_name} from sandbox...")
            requests.delete(f"{endpoint_url}/api/delete", json={"name": model_name}, timeout=30)

        return result

    except Exception as e:
        print(f"      ❌ Sandbox test failed: {e}")
        return {"tested": False, "error": str(e)}


def analyze_gaps(inventory: list[InstalledModel], registry: dict, config: dict) -> list[Recommendation]:
    """Compare inventory against registry to find gaps and upgrade opportunities."""
    print("\n━━━ Phase 3: ANALYSIS ━━━")
    recommendations = []

    installed_names = {m.full_name for m in inventory}
    installed_families = {m.name for m in inventory}

    for tier in registry.get("modelTiers", []):
        tier_name = tier.get("tier", "")
        fallback = tier.get("fallbackModel", "")
        locality = tier.get("locality", "")

        if locality != "local":
            continue  # Only analyze local tiers for pull recommendations

        # Check if the fallback model is installed
        if fallback and fallback not in installed_names:
            # Determine internal endpoint for sandbox
            # We assume the first endpoint mapped in config, or NAS.
            # We can find the endpoint from the config.
            endpoints = config.get("endpoints", {})
            first_ep_url = list(endpoints.values())[0]["url"] if endpoints else "http://localhost:11434"
            
            # Check if even the family is present
            family = fallback.split(":")[0]
            if family not in installed_families:
                rec = Recommendation(
                    action="ADD",
                    tier=tier_name,
                    current_model="(none)",
                    recommended_model=fallback,
                    reason=f"Tier '{tier_name}' has no installed model. Registry declares '{fallback}'.",
                    priority="high",
                )
            else:
                # Family present but different version
                current = [m for m in inventory if m.name == family]
                current_name = current[0].full_name if current else "(unknown version)"
                rec = Recommendation(
                    action="UPGRADE",
                    tier=tier_name,
                    current_model=current_name,
                    recommended_model=fallback,
                    reason=f"Tier '{tier_name}' has '{current_name}' but registry declares '{fallback}'.",
                    priority="medium",
                )
            
            # Sandbox Test
            test_res = run_sandbox_test(fallback, first_ep_url, config)
            if test_res:
                rec.sandbox_result = test_res
                if not test_res.get("success"):
                    rec.reason += " (WARNING: Sandbox test failed/timed out)"
            
            recommendations.append(rec)
    
    print("  Phase 4: Reporting")
    
    if not recommendations:
        print("    [Report] Fleet is optimal. No action required.")
        report_text = "Fleet is optimal. No action required.\n"
    else:
        print("    [Report] Recommended Actions:")
        report_text = "Recommended Actions:\n"
        for rec in recommendations:
            line = f"      [{rec.priority.upper()}] {rec.action} {rec.tier}: {rec.current_model} -> {rec.recommended_model} ({rec.reason})"
            print(line)
            report_text += line + "\n"
            if getattr(rec, 'sandbox_result', None):
                sb_line = f"        Sandbox: {rec.sandbox_result.get('tokens_per_sec', 0)} t/s, {rec.sandbox_result.get('latency_sec', 0)}s latency, Success: {rec.sandbox_result.get('success', False)}"
                print(sb_line)
                report_text += sb_line + "\n"

    # Save local report
    report_path = Path(__file__).parent / "reports"
    report_path.mkdir(exist_ok=True)
    report_file = report_path / f"sweep_{int(time.time())}.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"    [Report] Saved to {report_file}")
    
    # Dispatch Email Report
    dispatch_email_report(report_text, config)

    print(f"  Generated {len(recommendations)} recommendations")
    for r in recommendations:
        icon = {"UPGRADE": "🔄", "ADD": "➕", "SUNSET": "🗑️", "RELOCATE": "📦"}.get(r.action, "•")
        print(f"    {icon} {r.action} {r.tier}: {r.current_model} → {r.recommended_model}")

    return recommendations


# ---------------------------------------------------------------------------
# Phase 4: Report
# ---------------------------------------------------------------------------

def dispatch_email_report(report_text: str, config: dict):
    """Sends the weekly report via SMTP if configured."""
    notify_cfg = config.get("notifications", {})
    if not notify_cfg.get("enabled"):
        return
        
    smtp_cfg = notify_cfg.get("smtp", {})
    server = smtp_cfg.get("server")
    port = smtp_cfg.get("port", 587)
    username = smtp_cfg.get("username")
    recipient = smtp_cfg.get("recipient")
    password = os.getenv("SMTP_PASSWORD")

    if not all([server, username, recipient, password]):
        print("    [Email] Missing SMTP configuration or SMTP_PASSWORD in .env. Skipping email dispatch.")
        return

    print(f"    [Email] Dispatching report to {recipient}...")
    try:
        msg = MIMEMultipart()
        msg['From'] = username
        msg['To'] = recipient
        msg['Subject'] = f"Sentinel Fleet Health Report - {time.strftime('%Y-%m-%d')}"
        
        body = "Creative Liberation Engine - Model Sentinel Weekly Report\n\n"
        body += report_text
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        server_conn = smtplib.SMTP(server, port)
        server_conn.starttls()
        server_conn.login(username, password)
        text = msg.as_string()
        server_conn.sendmail(username, recipient, text)
        server_conn.quit()
        print("    [Email] Report dispatched successfully.")
    except Exception as e:
        print(f"    [Email] ❌ Failed to send email: {e}")


def generate_report(
    inventory: list[InstalledModel],
    discoveries: dict,
    recommendations: list[Recommendation],
    registry: dict,
    config: dict,
) -> str:
    """Generate a comprehensive markdown report."""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    report_date = datetime.datetime.now().strftime("%Y-%m-%d")

    lines = [
        f"# Model Sentinel Report — {report_date}",
        f"",
        f"> Generated at {now} by Model Sentinel v1.0.0",
        f"",
        f"---",
        f"",
        f"## Fleet Inventory",
        f"",
    ]

    if inventory:
        lines.append("| Endpoint | Model | Size | Last Modified |")
        lines.append("|----------|-------|------|---------------|")
        for m in sorted(inventory, key=lambda x: x.endpoint):
            lines.append(f"| {m.endpoint} | `{m.full_name}` | {m.size_gb} GB | {m.modified[:10] if len(m.modified) >= 10 else m.modified} |")
    else:
        lines.append("*No models found across any endpoint.*")

    lines.append("")
    total_size = sum(m.size_gb for m in inventory)
    lines.append(f"**Total fleet size:** {total_size:.1f} GB across {len(inventory)} models")

    # Tier coverage
    lines.extend(["", "## Tier Coverage", ""])
    lines.append("| Tier | Declared Model | Installed | Status |")
    lines.append("|------|---------------|-----------|--------|")
    installed_names = {m.full_name for m in inventory}
    installed_families = {m.name for m in inventory}
    for tier in registry.get("modelTiers", []):
        tier_name = tier.get("tier", "")
        fallback = tier.get("fallbackModel", "")
        locality = tier.get("locality", "")
        if fallback in installed_names:
            status = "✅ Matched"
        elif fallback.split(":")[0] in installed_families:
            status = "⚠️ Version mismatch"
        elif locality == "local":
            status = "🔴 Missing"
        else:
            status = "☁️ Cloud/Web"
        lines.append(f"| `{tier_name}` | `{fallback}` | {fallback in installed_names} | {status} |")

    # Recommendations
    lines.extend(["", "## Recommendations", ""])
    if recommendations:
        for i, r in enumerate(recommendations, 1):
            icon = {"UPGRADE": "🔄", "ADD": "➕", "SUNSET": "🗑️", "RELOCATE": "📦"}.get(r.action, "•")
            priority_badge = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(r.priority, "")
            lines.append(f"{i}. {icon} **{r.action}** `{r.tier}` — {r.current_model} → `{r.recommended_model}`")
            lines.append(f"   {priority_badge} *{r.reason}*")
            if r.size_delta_gb:
                lines.append(f"   Size delta: {r.size_delta_gb:+.1f} GB")
            lines.append("")
    else:
        lines.append("*No recommendations — fleet is current.*")

    # HuggingFace discoveries
    hf_models = discoveries.get("huggingface", [])
    if hf_models:
        lines.extend(["", "## New Releases (Last 7 Days)", ""])
        lines.append("| Source | Model | Downloads | License | Task |")
        lines.append("|--------|-------|-----------|---------|------|")
        for m in sorted(hf_models, key=lambda x: x.downloads, reverse=True)[:20]:
            lines.append(f"| HuggingFace | `{m.name}` | {m.downloads:,} | {m.license} | {m.description} |")

    # OpenRouter cloud pricing
    or_models = discoveries.get("openrouter", [])
    if or_models:
        lines.extend(["", "## Cloud Model Pricing Watch", ""])
        lines.append("| Model | Input $/M | Output $/M |")
        lines.append("|-------|-----------|------------|")
        priced = [m for m in or_models if m.pricing and m.pricing.get("input_per_m")]
        for m in sorted(priced, key=lambda x: x.pricing.get("input_per_m", 999))[:15]:
            inp = m.pricing.get("input_per_m")
            out = m.pricing.get("output_per_m")
            inp_str = f"${inp:.2f}" if inp else "—"
            out_str = f"${out:.2f}" if out else "—"
            lines.append(f"| `{m.name}` | {inp_str} | {out_str} |")

    lines.extend(["", "---", f"*Next sweep scheduled per cron: `{config.get('sentinel', {}).get('schedule', 'not set')}`*"])

    return "\n".join(lines)


def save_report(report: str, config: dict) -> Path:
    """Save report to disk."""
    report_dir = REPO_ROOT / config.get("sentinel", {}).get("report_dir", "runtime/reports/model-sentinel")
    report_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")
    report_path = report_dir / f"sweep-{date_str}.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"\n  📄 Report saved: {report_path}")
    return report_path


# ---------------------------------------------------------------------------
# Phase 5: Registry Update
# ---------------------------------------------------------------------------

def update_registry(inventory: list[InstalledModel], registry: dict) -> dict:
    """Update the canonical registry with sweep metadata."""
    registry["lastSweep"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    registry["installedModels"] = [
        {
            "name": m.full_name,
            "endpoint": m.endpoint,
            "size_gb": m.size_gb,
            "modified": m.modified,
        }
        for m in inventory
    ]
    return registry


def save_registry(registry: dict):
    """Write updated registry to disk."""
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)
    print(f"  📋 Registry updated: {REGISTRY_PATH}")


def regenerate_blessed(registry: dict):
    """Regenerate the blessed model markdown from canonical JSON."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    lines = [
        "# V6 Blessed Model Registry",
        "",
        f"Generated from `runtime/registry/models.canonical.json` at {now}.",
        "",
        "## Counts",
        "",
        f"- Model tiers: {len(registry.get('modelTiers', []))}",
        f"- Fleet services: {len(registry.get('fleetServices', []))}",
        f"- Installed models: {len(registry.get('installedModels', []))}",
        "",
        "## Model Tiers",
        "",
    ]
    for tier in registry.get("modelTiers", []):
        lines.append(f"- `{tier['tier']}` -> `{tier['fallbackModel']}` ({tier['locality']})")

    installed = registry.get("installedModels", [])
    if installed:
        lines.extend(["", "## Installed Models", ""])
        for m in installed:
            lines.append(f"- `{m['name']}` on **{m['endpoint']}** ({m['size_gb']} GB)")

    lines.extend(["", "## Fleet Services", ""])
    for svc in registry.get("fleetServices", []):
        lines.append(f"- `{svc}`")
    lines.append("")

    with open(BLESSED_PATH, "w") as f:
        f.write("\n".join(lines))
    print(f"  📋 Blessed registry regenerated: {BLESSED_PATH}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Model Sentinel — AI Model Fleet Management")
    parser.add_argument("--sweep", action="store_true", help="Full sweep: inventory + discover + analyze + report")
    parser.add_argument("--inventory", action="store_true", help="Inventory only")
    parser.add_argument("--discover", action="store_true", help="Discovery only")
    parser.add_argument("--dry-run", action="store_true", help="Full sweep without modifying registry")
    parser.add_argument("--update-registry", action="store_true", help="Update registry with current inventory")
    args = parser.parse_args()

    if not any([args.sweep, args.inventory, args.discover, args.dry_run, args.update_registry]):
        args.sweep = True  # Default to full sweep

    print("╔══════════════════════════════════════════════╗")
    print("║       MODEL SENTINEL — Creative Liberation Engine      ║")
    print("║       Automated Model Fleet Management       ║")
    print("╚══════════════════════════════════════════════╝")

    config = load_config()

    # Phase 1: Inventory
    inventory = run_inventory(config)

    if args.inventory:
        return

    # Phase 2: Discovery
    discoveries = {"ollama": [], "huggingface": [], "openrouter": []}
    if args.sweep or args.discover or args.dry_run:
        discoveries = run_discovery(config)

    if args.discover:
        return

    # Phase 3: Analysis
    registry = load_registry()
    recommendations = analyze_gaps(inventory, registry, config)

    # Phase 4: Report
    report = generate_report(inventory, discoveries, recommendations, registry, config)
    report_path = save_report(report, config)

    # Phase 5: Registry update (unless dry-run)
    if not args.dry_run:
        registry = update_registry(inventory, registry)
        save_registry(registry)
        regenerate_blessed(registry)

    print("\n━━━ SWEEP COMPLETE ━━━")
    print(f"  Models inventoried: {len(inventory)}")
    print(f"  Recommendations: {len(recommendations)}")
    print(f"  Report: {report_path}")


if __name__ == "__main__":
    main()
