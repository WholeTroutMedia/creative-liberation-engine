#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import urllib.request
from datetime import datetime

ENV_PATH = '/app/creative-liberation-engine/.env'
REPORT_PATH = '/app/creative-liberation-engine/reports/cost_report.md'
JSON_PATH = '/app/creative-liberation-engine/runtime/session/cost-summary.json'

def load_env():
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    parts = line.strip().split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip().replace('export ', '').replace('"', '').replace("'", "")
                        val = parts[1].strip().replace('"', '').replace("'", "")
                        os.environ[key] = val

def get_telnyx_data(api_key):
    balance = "0.00"
    esim_used_mb = 0.0
    esim_status = "unknown"
    esim_msisdn = "unknown"

    # 1. Balance
    try:
        req = urllib.request.Request(
            "https://api.telnyx.com/v2/balance",
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=5.0) as res:
            data = json.loads(res.read().decode())
            balance = data.get('data', {}).get('balance', '0.00')
    except Exception as e:
        print(f"[Warning] Failed to fetch Telnyx balance: {e}")

    # 2. SIM Card / eSIM Usage
    try:
        req = urllib.request.Request(
            "https://api.telnyx.com/v2/sim_cards",
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=5.0) as res:
            data = json.loads(res.read().decode())
            sims = data.get('data', [])
            if sims:
                sim = sims[0]
                esim_status = sim.get('status', {}).get('value', 'enabled')
                esim_msisdn = sim.get('msisdn', 'unknown')
                consumed = sim.get('current_billing_period_consumed_data', {})
                amount = float(consumed.get('amount', 0))
                unit = consumed.get('unit', 'MB')
                if unit == 'MB':
                    esim_used_mb = amount
                elif unit == 'GB':
                    esim_used_mb = amount * 1024.0
                elif unit == 'KB':
                    esim_used_mb = amount / 1024.0
    except Exception as e:
        print(f"[Warning] Failed to fetch Telnyx SIM cards: {e}")

    return {
        "balance": float(balance),
        "esim_used_mb": esim_used_mb,
        "esim_used_gb": round(esim_used_mb / 1024.0, 3),
        "esim_status": esim_status,
        "esim_msisdn": esim_msisdn
    }

def get_db_tokens():
    used_tokens = 0
    tasks_count = 0
    failed_tasks = 0
    completed_tasks = 0

    # We use docker exec to query postgres container
    try:
        # Fetch token budgets from tasks
        cmd = [
            "docker", "exec", "creative-liberation-engine-postgres-1", "psql", "-U", "cle", "-d", "cle_genesis",
            "-t", "-A", "-c", "SELECT token_budget::text FROM tasks WHERE token_budget IS NOT NULL;"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            lines = res.stdout.strip().split('\n')
            for line in lines:
                if line.strip():
                    try:
                        budget = json.loads(line)
                        used_tokens += budget.get('used_tokens', 0)
                        tasks_count += 1
                    except Exception:
                        pass

        # Fetch token budgets from tasks_archive
        cmd_archive = [
            "docker", "exec", "creative-liberation-engine-postgres-1", "psql", "-U", "cle", "-d", "cle_genesis",
            "-t", "-A", "-c", "SELECT token_budget::text FROM tasks_archive WHERE token_budget IS NOT NULL;"
        ]
        res_archive = subprocess.run(cmd_archive, capture_output=True, text=True, timeout=10)
        if res_archive.returncode == 0:
            lines_archive = res_archive.stdout.strip().split('\n')
            for line in lines_archive:
                if line.strip():
                    try:
                        budget = json.loads(line)
                        used_tokens += budget.get('used_tokens', 0)
                        tasks_count += 1
                    except Exception:
                        pass

        # Query status breakdown
        cmd_status = [
            "docker", "exec", "creative-liberation-engine-postgres-1", "psql", "-U", "cle", "-d", "cle_genesis",
            "-t", "-A", "-c", "SELECT status, count(*) FROM tasks GROUP BY status;"
        ]
        res_status = subprocess.run(cmd_status, capture_output=True, text=True, timeout=10)
        if res_status.returncode == 0:
            lines_status = res_status.stdout.strip().split('\n')
            for line in lines_status:
                if '|' in line:
                    status, count = line.split('|', 1)
                    if status.strip() == 'failed':
                        failed_tasks += int(count)
                    elif status.strip() == 'done' or status.strip() == 'completed':
                        completed_tasks += int(count)

    except Exception as e:
        print(f"[Warning] Failed to fetch database tokens: {e}")

    return {
        "used_tokens": used_tokens,
        "tasks_with_tokens": tasks_count,
        "failed_tasks": failed_tasks,
        "completed_tasks": completed_tasks
    }

def main():
    load_env()
    api_key = os.environ.get('TELNYX_API_KEY')

    if not api_key:
        print("Error: TELNYX_API_KEY not found in env.")
        sys.exit(1)

    print("Retrieving Telnyx API data...")
    telnyx = get_telnyx_data(api_key)

    print("Retrieving DB task tokens...")
    db_data = get_db_tokens()

    # Calculate standard vs fast tier costs
    # Standard: Gemini 2.5 Flash / Local models ($0.15 per 1M tokens average)
    # Fast: Gemini 1.5 Pro / Claude 3.5 Sonnet ($5.00 per 1M tokens average)
    tokens = db_data["used_tokens"]
    std_rate = 0.15 / 1000000.0
    fast_rate = 5.00 / 1000000.0

    standard_cost = tokens * std_rate
    fast_cost = tokens * fast_rate
    saved_arbitrage = fast_cost - standard_cost

    # Telnyx eSIM data pricing estimates
    # Standard rate: $2.00 / GB of data
    esim_data_cost = telnyx["esim_used_gb"] * 2.00

    report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Generate JSON summary
    summary = {
        "timestamp": report_time,
        "telnyx": {
            "balance_usd": telnyx["balance"],
            "esim_used_mb": telnyx["esim_used_mb"],
            "esim_used_gb": telnyx["esim_used_gb"],
            "esim_status": telnyx["esim_status"],
            "esim_msisdn": telnyx["esim_msisdn"],
            "estimated_data_cost_usd": round(esim_data_cost, 2)
        },
        "tokens": {
            "total_used": tokens,
            "tasks_tracked": db_data["tasks_with_tokens"],
            "failed_tasks": db_data["failed_tasks"],
            "completed_tasks": db_data["completed_tasks"],
            "standard_tier_equivalent_usd": round(standard_cost, 4),
            "fast_tier_equivalent_usd": round(fast_cost, 4),
            "arbitrage_savings_usd": round(saved_arbitrage, 4)
        }
    }

    # Write JSON Summary
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(summary, f, indent=2)

    # Generate Markdown Report
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, 'w') as f:
        f.write(f"""# CLE V6 — Cost & Token Arbitrage Dashboard

Report Generated: `{report_time}`

## 1. Sovereign Telecommunications (Telnyx)
* **API Portal Balance:** `${telnyx["balance"]:.2f} USD`
* **Mesh eSIM Status:** `{telnyx["esim_status"].upper()}` (Node: `+17256770567`)
* **Cellular Data Usage:** `{telnyx["esim_used_gb"]} GB` ({telnyx["esim_used_mb"]:.2f} MB consumed)
* **Estimated Data Cost:** `${esim_data_cost:.2f} USD` (At $2.00/GB base rate)

## 2. Neural Architecture Token Consumption
* **Total Tracked Tokens:** `{tokens:,}` across `{db_data["tasks_with_tokens"]}` tasks.
* **Standard Tier Equivalent (Gemini 2.5 Flash / Local):** `${standard_cost:.4f} USD` (At $0.15/1M tokens)
* **Fast Tier Equivalent (Gemini 1.5 Pro / Claude 3.5 Sonnet):** `${fast_cost:.4f} USD` (At $5.00/1M tokens)
* **CLE Arbitrage Savings:** `${saved_arbitrage:.4f} USD`

## 3. Active Telemetry Diagnostics
* **Active eSIM Node:** `{telnyx["esim_msisdn"]}`
* **Database Task Queue Health:**
  * Completed/Done: `{db_data["completed_tasks"]}`
  * Failed Tasks: `{db_data["failed_tasks"]}`

---
*Sovereignty Protocol Article XX Active — Auto-Arbitrage Optimization Enabled.*
""")

    print("\n==================================================")
    print("CLE V6 COST & ARBITRAGE DASHBOARD")
    print(f"Report Generated: {report_time}")
    print("--------------------------------------------------")
    print(f"Telnyx Balance:     ${telnyx['balance']:.2f} USD")
    print(f"eSIM Data Usage:    {telnyx['esim_used_gb']} GB ({telnyx['esim_used_mb']:.2f} MB)")
    print("--------------------------------------------------")
    print(f"Total Model Tokens: {tokens:,}")
    print(f"Standard Tier Cost: ${standard_cost:.4f} USD")
    print(f"Fast Tier Cost:     ${fast_cost:.4f} USD")
    print(f"Arbitrage Savings:  ${saved_arbitrage:.4f} USD")
    print("==================================================\n")

if __name__ == '__main__':
    main()
