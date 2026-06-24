import os
import json
import sys
import re
import requests
from datetime import datetime

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

WORKSPACE_DIR = r"y:\creative-liberation-engine"
STATE_DIR = os.path.join(WORKSPACE_DIR, "runtime", "state")
IDEATION_QUEUE_DIR = os.path.join(WORKSPACE_DIR, "runtime", "ideation-queue")
PROCESSED_LEDGER_PATH = os.path.join(STATE_DIR, "processed_emails.json")
DISPATCH_URL = "http://127.0.0.1:5160"
CLASSIFICATION_MODEL = "deepseek-r1:8b"

# Active targets to try for Ollama
OLLAMA_TARGETS = [
    "http://localhost:11434",
    "http://127.0.0.1:11434"
]

CF_ACCOUNT_ID = "8d718b480ea7c11a85e6f99bd12ad7af"
CF_D1_DB_ID = "f52d2b74-ce2e-4fac-89d3-985572998ede"
CF_API_TOKEN = "0ec569a759d9d9b5a100aa875425be52f164e"

url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_D1_DB_ID}/query"
headers = {"X-Auth-Email": "inquiries@creativeliberationengine.org", "X-Auth-Key": CF_API_TOKEN, "Content-Type": "application/json"}

def load_processed_ledger():
    if not os.path.exists(STATE_DIR):
        os.makedirs(STATE_DIR, exist_ok=True)
    if os.path.exists(PROCESSED_LEDGER_PATH):
        try:
            with open(PROCESSED_LEDGER_PATH, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_processed_ledger(processed_set):
    with open(PROCESSED_LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(list(processed_set), f, indent=2)

def fetch_emails():
    # Query database for recent inbound emails targeting cortex
    sql = "SELECT id, subject, to_addr, from_addr, created_at, body_text FROM messages WHERE to_addr LIKE '%inquiries@creativeliberationengine.org%' AND direction='inbound' ORDER BY created_at ASC LIMIT 20"
    try:
        resp = requests.post(url, headers=headers, json={'sql': sql})
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") and data.get("result") and data["result"][0]:
            return data["result"][0].get("results", [])
    except Exception as e:
        print(f"[Email Ingestion] Error querying Cloudflare D1: {e}")
    return []

def classify_email(email):
    """Uses local DeepSeek R1 via Ollama to dynamically classify intent & creative phase."""
    subject = email["subject"]
    body = email["body_text"]
    
    prompt = f"""Analyze this incoming message and classify it against these two operational axes:

1. Axis A: Intent Type
   - TASK: Direct command or action item. Modifies files, runs scripts, deploys services, requires done-when assertions.
   - CONVERSATION: Open-ended dialog, general question, greeting, check-in, or relational feedback. Read-only context retrieval.

2. Axis B: Creative Phase
   - BRAINSTORM: Divergent exploration, hypothetical, blue-sky ideas, unconstrained analogies ("what if we combined X and Y").
   - IDEATION: Convergent planning, formal workstream targets, contract mapping, structured next steps.

Message Subject: {subject}
Message Body:
{body}

Respond strictly in valid JSON format. Do not include any reasoning thoughts or wrappers outside of the JSON. The JSON structure must match this:
{{
  "intent_type": "TASK" or "CONVERSATION",
  "creative_phase": "BRAINSTORM" or "IDEATION",
  "primary_objective": "A clear one-sentence summary of the user objective",
  "suggested_routing": "Where to direct this in the Creative Liberation Engine OS",
  "reasoning": "Brief technical logic for this classification"
}}"""

    for target in OLLAMA_TARGETS:
        try:
            print(f"[Cognitive Classifier] Running local classification via {target} for: \"{subject}\"...")
            resp = requests.post(
                f"{target}/api/chat",
                json={
                    "model": CLASSIFICATION_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1}
                },
                timeout=12
            )
            if resp.ok:
                content = resp.json()["message"]["content"]
                # Strip DeepSeek thoughts (<think>...</think>)
                content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                
                # Find JSON block
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    print(f"[Cognitive Classifier] Resolved: Intent={parsed.get('intent_type')}, Phase={parsed.get('creative_phase')}")
                    return parsed
        except Exception as e:
            print(f"[Cognitive Classifier] Target {target} unavailable: {e}")
            
    # Heuristics Fallback
    print("[Cognitive Classifier] Falling back to heuristics classification...")
    return heuristic_fallback(subject, body)

def heuristic_fallback(subject, body):
    s = (subject + " " + body).lower()
    intent = "CONVERSATION"
    phase = "BRAINSTORM"
    
    if any(w in s for w in ["deploy", "run", "compile", "test", "fix", "create", "scaffold", "update"]):
        intent = "TASK"
    if any(w in s for w in ["briefing", "idx-", "workstream", "agenda", "athena", "fwd"]):
        phase = "IDEATION"
        
    return {
        "intent_type": intent,
        "creative_phase": phase,
        "primary_objective": subject[:80],
        "suggested_routing": "DISPATCH" if intent == "TASK" else "ATELIER",
        "reasoning": "Classified via rules-based heuristic fallback engine."
    }

def forward_to_dispatch(email, classification):
    payload = {
        "title": email["subject"],
        "description": email["body_text"],
        "source": "inbound-email",
        "priority": "critical" if any(w in email["subject"].lower() for w in ["urgent", "asap", "fire"]) else "high",
        "metadata": {
            "emailId": email["id"],
            "sender": email["from_addr"],
            "recipient": email["to_addr"],
            "receivedAt": datetime.fromtimestamp(email["created_at"]).isoformat(),
            "agent": "CORTEX",
            "channel": "cloudflare-email",
            "classification": classification
        }
    }
    
    try:
      resp = requests.post(f"{DISPATCH_URL}/api/tasks", json=payload, headers={"Content-Type": "application/json"}, timeout=20)
      if resp.ok:
          task_data = resp.json()
          task_id = task_data.get("task", {}).get("id") or task_data.get("id") or "queued"
          print(f"[Email Ingestion] Success! Dispatch Task ID generated: {task_id}")
          return True
    except Exception as e:
      print(f"[Email Ingestion] Connection failed to Dispatch server: {e}")
    return False

def scaffold_ideation_canvas(email, classification):
    """Scaffolds a local markdown canvas document for a brainstorm/ideation."""
    os.makedirs(IDEATION_QUEUE_DIR, exist_ok=True)
    
    # Safe filename from subject
    safe_subject = re.sub(r'[^a-zA-Z0-9_\-]', '_', email["subject"])[:60]
    filename = f"{classification['creative_phase'].lower()}_{email['id']}_{safe_subject}.md"
    file_path = os.path.join(IDEATION_QUEUE_DIR, filename)
    
    title_label = "🧠 BRAINSTORM CANVAS" if classification["creative_phase"] == "BRAINSTORM" else "📐 IDEATION MATRIX"
    
    content = f"""# {title_label} — {email['subject']}

> **Signal ID:** {email['id']}
> **From:** {email['from_addr']}
> **Created At:** {datetime.fromtimestamp(email['created_at']).isoformat()}
> **Classification Reasoning:** {classification['reasoning']}
> **Suggested Routing:** {classification['suggested_routing']}

---

## 🎯 Primary Objective

{classification['primary_objective']}

---

## 📥 Inbound Signal Body

```text
{email['body_text']}
```

---

## 🧭 Next Operational Steps

- [ ] Review raw signal components
- [ ] Map relevant capabilities from `inventory/CAPABILITY_MATRIX.json`
- [ ] Determine if target is local compute or cloud-relay offload
- [ ] Refine into active V6 Workstream (PLAN / DESIGN)
"""
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[Email Ingestion] Scaffolded local canvas: {file_path}")
        return True
    except Exception as e:
        print(f"[Email Ingestion] Failed to write canvas: {e}")
        return False

def main():
    print("=" * 60)
    print("Creative Liberation Engine V6 — Inbound Email Cognitive Ingestion Daemon starting...")
    print(f"  Target Inbox: inquiries@creativeliberationengine.org")
    print("=" * 60)

    processed_set = load_processed_ledger()
    new_emails = fetch_emails()
    if not new_emails:
        print("[Email Ingestion] No new messages found in Cloudflare D1.")
        return

    ingested_count = 0
    for email in new_emails:
        email_id = email["id"]
        if email_id in processed_set:
            continue
        
        # 1. Classify incoming email dynamically using local DeepSeek
        classification = classify_email(email)
        
        # 2. Route based on classification
        success = False
        if classification["intent_type"] == "TASK":
            success = forward_to_dispatch(email, classification)
        else:
            # Route to local Atelier canvas directory (Brainstorm or Ideation)
            success = scaffold_ideation_canvas(email, classification)
            
        if success:
            processed_set.add(email_id)
            ingested_count += 1
            
    if ingested_count > 0:
        save_processed_ledger(processed_set)
        print(f"[Email Ingestion] Finished! Successfully ingested & classified {ingested_count} new signals.")
    else:
        print("[Email Ingestion] No outstanding signals found in this sweep.")

if __name__ == "__main__":
    main()
