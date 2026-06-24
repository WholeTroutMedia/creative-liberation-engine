---
description: Start the Creative Liberation Engine Genkit server — required for all Level 2+ features
---

# /start-engine — Boot the Creative Liberation Engine

Starts the Genkit provider runtime so all AVERI agent flows are available for invocation.

// turbo

1. Check if the engine is already running:

```powershell
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4100/health" -UseBasicParsing -TimeoutSec 3
    $health = $response.Content | ConvertFrom-Json
    Write-Host "Engine already running: $($health.status) v$($health.version)"
} catch {
    Write-Host "Engine not running. Starting..."
}
```

1. If not running, start the Genkit server:

```powershell
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm run dev --prefix "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages\genkit"' -WindowStyle Minimized
```

// turbo
3. Wait for the engine to become healthy:

```powershell
$maxWait = 30
$elapsed = 0
do {
    Start-Sleep -Seconds 1
    $elapsed++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:4100/health" -UseBasicParsing -TimeoutSec 2
        Write-Host "Engine online after ${elapsed}s"
        $r.Content | ConvertFrom-Json | Format-List
        break
    } catch { Write-Host "Waiting... ($elapsed/${maxWait}s)" }
} while ($elapsed -lt $maxWait)
```

// turbo
4. List all available flows via Genkit MCP:

Use the `genkit-mcp-server` `list_flows` tool with `projectRoot` = `D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages\genkit`

Report: "Engine online. [N] flows available: IRIS, KEEPER, LEX, VERA, AURORA, BOLT, COMET, ARCH-CODEX, COMPASS..."
