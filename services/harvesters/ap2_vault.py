#!/usr/bin/env python3
"""
CORTEX AP2-Vault Agent Payments Ledger
======================================
Secure micro-payment ledger implementing the Agent Payments Protocol (AP2) contract-first.
Grants, audits, and tracks cryptographic token or dollar expenditure requests by autonomous agents.
Enforces daily budgets, cryptographically signs transactions via HMAC-SHA256, and generates
a gorgeous, premium glassmorphic visual ledger dashboard.
"""

import os
import sys
import json
import time
import hmac
import hashlib
import argparse
from datetime import datetime, timezone, timedelta

ACADEMY_CODEX_DIR = r"y:\creative-liberation-engine\academy\codex\ap2-vault"
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Sovereign_Academy_RAG\AP2Vault"
LEDGER_FILE = os.path.join(ACADEMY_CODEX_DIR, "ledger.json")
DASHBOARD_FILE = os.path.join(ACADEMY_CODEX_DIR, "dashboard.html")

# System wide limits
DAILY_BUDGET_LIMIT = 100.00
SINGLE_TX_APPROVAL_THRESHOLD = 50.00
HMAC_SECRET = b"cortex_sovereign_secure_key_v6"

def ensure_directories(dry_run: bool = False):
    if not dry_run:
        os.makedirs(ACADEMY_CODEX_DIR, exist_ok=True)
        os.makedirs(NAS_RAG_DATA, exist_ok=True)
        if not os.path.exists(LEDGER_FILE):
            with open(LEDGER_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

def calculate_daily_spent() -> float:
    try:
        if not os.path.exists(LEDGER_FILE):
            return 0.0
        with open(LEDGER_FILE, 'r', encoding='utf-8') as f:
            ledger = json.load(f)
        
        now = datetime.now(timezone.utc)
        one_day_ago = now - timedelta(days=1)
        
        spent = 0.0
        for tx in ledger:
            tx_time = datetime.fromisoformat(tx["timestamp"].replace("Z", "+00:00"))
            if tx_time > one_day_ago and tx["status"] == "APPROVED":
                spent += tx["amount_usd"]
        return spent
    except Exception:
        return 0.0

def generate_tx_signature(tx_id: str, agent: str, amount: float, purpose: str) -> str:
    msg = f"{tx_id}:{agent}:{amount:.2f}:{purpose}".encode('utf-8')
    return hmac.new(HMAC_SECRET, msg, hashlib.sha256).hexdigest()

def update_ledger(agent: str, amount: float, purpose: str, dry_run: bool = False) -> dict:
    tx_timestamp_ms = int(time.time() * 1000)
    transaction_id = f"ap2-tx-{tx_timestamp_ms}"
    current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    daily_spent = calculate_daily_spent()
    
    # Policy checks
    if daily_spent + amount > DAILY_BUDGET_LIMIT:
        status = "REJECTED_DAILY_BUDGET_EXCEEDED"
        reason = f"Adding ${amount:.2f} exceeds daily limit of ${DAILY_BUDGET_LIMIT:.2f} (Spent: ${daily_spent:.2f})"
    elif amount > SINGLE_TX_APPROVAL_THRESHOLD:
        status = "PENDING_HUMAN_APPROVAL"
        reason = f"Transaction amount ${amount:.2f} exceeds auto-approval threshold of ${SINGLE_TX_APPROVAL_THRESHOLD:.2f}"
    else:
        status = "APPROVED"
        reason = "Within daily budget and single transaction threshold limits"
        
    sig = generate_tx_signature(transaction_id, agent, amount, purpose)
    
    tx_entry = {
        "txId": transaction_id,
        "agent": agent,
        "amount_usd": amount,
        "purpose": purpose,
        "timestamp": current_time,
        "status": status,
        "policy_reason": reason,
        "hmac_signature": sig
    }
    
    if dry_run:
        print(f"  [DRY-RUN] Would append transaction: {json.dumps(tx_entry, indent=2)}")
        return tx_entry
        
    try:
        with open(LEDGER_FILE, 'r', encoding='utf-8') as f:
            ledger = json.load(f)
    except Exception:
        ledger = []
        
    ledger.append(tx_entry)
    with open(LEDGER_FILE, 'w', encoding='utf-8') as f:
        json.dump(ledger, f, indent=2)
    print(f"  [+] Transaction {transaction_id} recorded successfully inside {LEDGER_FILE} [Status: {status}]")
    
    # Regenerate dashboard to show visual confirmation
    generate_dashboard(ledger)
    return tx_entry

def write_obsidian_audit_note(tx: dict, dry_run: bool = False):
    tx_id = tx["txId"]
    agent = tx["agent"]
    amount = tx["amount_usd"]
    purpose = tx["purpose"]
    status = tx["status"]
    reason = tx["policy_reason"]
    sig = tx["hmac_signature"]
    current_time = tx["timestamp"]
    
    memory_id = f"mem_ap2_vault_{tx_id}"
    
    status_alert = "> [!NOTE]"
    if "REJECTED" in status:
        status_alert = "> [!CAUTION]\n> **Transaction Rejected**: " + reason
    elif "PENDING" in status:
        status_alert = "> [!WARNING]\n> **Transaction Pending Approval**: " + reason
    else:
        status_alert = "> [!TIP]\n> **Transaction Approved**: " + reason

    frontmatter = f"""---
memoryId: "{memory_id}"
kind: "decision"
title: "AP2-Vault: Agent Micro-Payment {tx_id}"
summary: "Agent: {agent} | Amount: ${amount:.2f} | Status: {status}"
source: "KI"
provenance:
  recordedBy: "ap2_vault_ledger"
  recordedAt: "{current_time}"
confidence: 1.0
retentionClass: "canonical"
tags:
  - "ap2-vault"
  - "agent-payment"
  - "ledger-audit"
createdAt: "{current_time}"
updatedAt: "{current_time}"
lifecycleState: "active"
---

# AP2-Vault: Agent Micro-Payment {tx_id}

**Agent ID:** `{agent}`
**Requested Amount:** `${amount:.2f}`
**Authorized Purpose:** `{purpose}`
**Authorization Status:** `{status}`
**Transaction Timestamp:** `{current_time}`

## Security Policy Result
{status_alert}

## Cryptographic Validation
* **Protocol standard**: AP2 V6-Secure
* **HMAC-SHA256 Signature**: `{sig}`
* **Daily Budget Threshold**: ${DAILY_BUDGET_LIMIT:.2f}
* **Auto-Approval Limit**: ${SINGLE_TX_APPROVAL_THRESHOLD:.2f}

---
Generated by autonomous micro-payment compliance suite.
"""
    note_path = os.path.join(ACADEMY_CODEX_DIR, f"{tx_id}.md")
    if dry_run:
        print(f"  [DRY-RUN] Would write AP2 Audit note to: {note_path}")
        return
    with open(note_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter)
    print(f"  [+] Saved AP2 Audit Codex Note to {note_path}")

def generate_dashboard(ledger: list):
    # Generates a premium dark-mode, glassmorphic UI ledger dashboard
    rows_html = ""
    total_approved = 0.0
    total_pending = 0.0
    total_rejected = 0.0
    
    for tx in reversed(ledger):
        amount = tx.get("amount_usd", 0.0)
        status = tx.get("status", "UNKNOWN")
        tx_id = tx.get("txId", "ap2-tx-legacy")
        agent = tx.get("agent", "legacy-agent")
        purpose = tx.get("purpose", "Legacy transactional ingest")
        timestamp = tx.get("timestamp", "2026-05-26T00:00:00Z")
        sig = tx.get("hmac_signature", "legacy_no_signature")
        
        if status == "APPROVED":
            total_approved += amount
            status_class = "status-approved"
        elif "PENDING" in status:
            total_pending += amount
            status_class = "status-pending"
        else:
            total_rejected += amount
            status_class = "status-rejected"
            
        rows_html += f"""
        <tr>
            <td>{tx_id}</td>
            <td><span class="agent-badge">{agent}</span></td>
            <td>${amount:.2f}</td>
            <td class="purpose-cell">{purpose}</td>
            <td><span class="status-badge {status_class}">{status}</span></td>
            <td class="sig-cell">{sig[:16]}...</td>
            <td>{timestamp}</td>
        </tr>
        """
        
    dashboard_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CORTEX AP2-Vault - Agent Payment Ledger</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #08070b;
            --card-bg: rgba(18, 16, 26, 0.7);
            --accent-glow: rgba(139, 92, 246, 0.15);
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --primary: #8b5cf6;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --border: rgba(255, 255, 255, 0.06);
        }}
        body {{
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 40px 20px;
            background-image: radial-gradient(circle at 50% -20%, rgba(139, 92, 246, 0.25), transparent 70%);
            min-height: 100vh;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 20px;
        }}
        h1 {{
            font-size: 2.2rem;
            font-weight: 800;
            margin: 0;
            background: linear-gradient(135deg, #a78bfa, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }}
        .logo-container {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .vault-badge {{
            background: rgba(139, 92, 246, 0.2);
            color: #c084fc;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            border: 1px solid rgba(139, 92, 246, 0.3);
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        .card {{
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        .card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, transparent, var(--primary), transparent);
            opacity: 0;
            transition: opacity 0.3s;
        }}
        .card:hover {{
            transform: translateY(-4px);
            border-color: rgba(139, 92, 246, 0.2);
            box-shadow: 0 12px 40px 0 rgba(139, 92, 246, 0.1);
        }}
        .card:hover::before {{
            opacity: 1;
        }}
        .card-title {{
            font-size: 0.9rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 600;
        }}
        .card-value {{
            font-size: 2.2rem;
            font-weight: 800;
            margin: 0;
        }}
        .val-approved {{ color: var(--success); }}
        .val-pending {{ color: var(--warning); }}
        .val-rejected {{ color: var(--danger); }}
        
        .table-container {{
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            overflow-x: auto;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}
        th {{
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 16px;
            border-bottom: 1px solid var(--border);
        }}
        td {{
            padding: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 0.95rem;
        }}
        tr:hover td {{
            background: rgba(255, 255, 255, 0.01);
        }}
        .agent-badge {{
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            padding: 4px 10px;
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}
        .status-badge {{
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .status-approved {{
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}
        .status-pending {{
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }}
        .status-rejected {{
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}
        .sig-cell {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }}
        .purpose-cell {{
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-container">
                <h1>CORTEX AP2-Vault</h1>
                <span class="vault-badge">Active Ledger</span>
            </div>
            <div class="sig-cell">Security standard: AP2-V6</div>
        </header>
        
        <div class="stats-grid">
            <div class="card">
                <div class="card-title">Approved Spend</div>
                <div class="card-value val-approved">${total_approved:.2f}</div>
            </div>
            <div class="card">
                <div class="card-title">Pending Authorizations</div>
                <div class="card-value val-pending">${total_pending:.2f}</div>
            </div>
            <div class="card">
                <div class="card-title">Rejected Volume</div>
                <div class="card-value val-rejected">${total_rejected:.2f}</div>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Transaction ID</th>
                        <th>Requesting Agent</th>
                        <th>Amount (USD)</th>
                        <th>Payment Purpose</th>
                        <th>Status</th>
                        <th>HMAC Signature</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
"""
    with open(DASHBOARD_FILE, 'w', encoding='utf-8') as f:
        f.write(dashboard_html)
    print(f"  [+] Dynamic glassmorphic dashboard compiled at {DASHBOARD_FILE}")

def run_vault(agent: str, amount: float, purpose: str, dry_run: bool = False):
    ensure_directories(dry_run)
    print(f"[*] AP2-Vault: Authorizing request by agent '{agent}' for ${amount:.2f}...")
    
    tx = update_ledger(agent, amount, purpose, dry_run=dry_run)
    
    if not dry_run:
        write_obsidian_audit_note(tx, dry_run=False)
        
        # Stage payload for RAG
        target_path = os.path.join(NAS_RAG_DATA, f"{tx['txId']}_ap2_ledger.json")
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(tx, f, indent=2)
        print(f"  [+] Staged AP2 RAG transaction log at {target_path}")
    else:
        write_obsidian_audit_note(tx, dry_run=True)
        print("  [DRY-RUN] AP2-Vault execution complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AP2-Vault Ledger")
    parser.add_argument("agent", help="Requesting agent identifier")
    parser.add_argument("amount", type=float, help="Transaction amount in USD")
    parser.add_argument("purpose", help="Payment purpose declaration")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry-run")
    args = parser.parse_args()
    
    run_vault(args.agent, args.amount, args.purpose, dry_run=args.dry_run)
