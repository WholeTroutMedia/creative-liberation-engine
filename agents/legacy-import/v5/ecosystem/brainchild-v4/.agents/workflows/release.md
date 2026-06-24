---
description: Full release pipeline — commit, PR, deploy, memory write in one chain
---

# /release — Full Release Pipeline

The complete chain: VALIDATE → commit → PR → deploy → memory. One command, full production delivery.

## Steps

1. Confirm the release scope with user: "What are we releasing? Any blockers before the chain starts?"

// turbo
2. **Run VALIDATE** — Execute the full `/validate` workflow. Stop here if verdict is REJECTED.

// turbo
3. **Final commit**:

```powershell
git -C "[repo-root]" add .
git -C "[repo-root]" commit -m "release([workstream]): [feature] — production ready"
git -C "[repo-root]" push origin [branch]
```

// turbo
4. **Create PR** — Run the `/pr` workflow. This includes LEX review and GitHub MCP PR creation.

1. **Deploy** — Run the `/deploy` workflow to deploy the service to Cloud Run.

// turbo
6. **Health check loop** — Verify the deployed service is healthy:

```powershell
$attempts = 0
do {
    Start-Sleep -Seconds 5
    $attempts++
    try {
        $r = Invoke-WebRequest -Uri "[service-url]/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "Health check passed after $($attempts * 5)s: $($r.Content)"
        break
    } catch { Write-Host "Not yet healthy... attempt $attempts" }
} while ($attempts -lt 12)
```

// turbo
7. **Write release memory to SCRIBE**:

```powershell
python "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\cli\scribe.py" "Released [feature/service] to production. PR: [PR URL]. Deploy: [service URL]. LEX: PASS. COMPASS: PASS. Validate: APPROVED." --tags release production ship milestone
```

1. Announce: "**RELEASE COMPLETE.** [feature] is live at [URL]. PR: [link]. SCRIBE memory updated."
