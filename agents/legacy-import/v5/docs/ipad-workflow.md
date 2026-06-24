# iPad / Remote Workflow — Work From Anywhere

Access the full Creative Liberation Engine from your iPad (or any device) via the existing Tailscale mesh.
No new infrastructure needed — Tailscale is already installed on the NAS and workstations.

## Step 1 — Add iPad to Tailscale

1. Install **Tailscale** from the App Store on your iPad
2. Sign in with the same account used on the workstation (`WholeTroutMedia` tailnet)
3. Enable VPN — the iPad will receive a `100.x.x.x` Tailscale IP
4. Verify: ping the NAS Tailscale IP from iPad Safari — you should see the gateway

> The NAS Tailscale IP is visible in the Tailscale admin console at `https://login.tailscale.com/admin/machines`

## Step 2 — Access Dispatch Board

Once on Tailscale, open Safari and navigate to:

```
http://<nas-tailscale-ip>:5050/api/status
```

This is the live CLE Dispatch board. All task queues, agent status, and blockers are here.

## Step 3 — Push Notifications (ntfy)

The `mobile-bridge` service at port `4800` already forwards all agent events to ntfy.

1. Install **ntfy** from the App Store
2. Subscribe to topic: `cle-averi`
3. Set the server URL to: `http://<nas-tailscale-ip>` (self-hosted instance)

You'll receive push notifications for:
- New tasks (`dispatch:task:new`)
- Completed tasks (`dispatch:task:done`)
- Failed tasks (`dispatch:task:failed`) — urgent priority
- Blockers filed (`dispatch:blocker:filed`) — urgent priority
- Handoff phase changes (`dispatch:handoff`)
- AVERI alerts (`averi:alert`) — urgent priority

## Step 4 — IDE Access from iPad (Kade in Cursor)

For active coding from the iPad, use **Cursor Mobile** or connect via SSH to the workstation:

### Option A — Cursor SSH Remote
Cursor supports SSH remote development. Connect to the workstation via Tailscale IP:
```
ssh jahar@<workstation-tailscale-ip>
```
Then open the repo in Cursor remotely. Full TypeScript, Kade, and all extensions work.

### Option B — VS Code Server (code-server)
Run `code-server` on the workstation — accessible in any browser on the tailnet:
```powershell
# Install once
npm install -g code-server
# Start
code-server --bind-addr 0.0.0.0:8080 "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5"
```
Access at: `http://<workstation-tailscale-ip>:8080`
Kade, all extensions, and the full workspace are available in iPad Safari.

## Reference — Key Service URLs (on Tailscale)

| Service | URL | Purpose |
|---------|-----|---------|
| Dispatch | `http://<nas-ts-ip>:5050` | Task queue, agent mesh, blockers |
| Genkit | `http://<nas-ts-ip>:4100` | AI flows, CORTEX, LOGD, VAULT |
| Mobile Bridge | `http://<nas-ts-ip>:4800` | ntfy push adapter, /notify endpoint |
| Gitea | `http://<nas-ts-ip>:3000` | Source control, CI/CD triggers |
| Portainer | `http://<nas-ts-ip>:9000` | Docker management |
| code-server | `http://<workstation-ts-ip>:8080` | Full VS Code in browser |

## Quick Test

From the iPad (on Tailscale), run this in Safari's console or use a REST client:

```
POST http://<nas-tailscale-ip>:4800/notify
Content-Type: application/json

{"title": "iPad Test", "message": "Creative Liberation Engine reachable from iPad ✅", "priority": "high"}
```

You should receive a push notification on the ntfy app within seconds.

---

## Desktop Setup — No Monthly Subscriptions

Both tools use your existing API keys from `.env`. No monthly fees.

### Claude Code (Terminal)

Requires an Anthropic API key — `ANTHROPIC_API_KEY` is currently empty in `.env`.
To use Claude Code, add one at https://console.anthropic.com — pay per token, no subscription.

Then install:

```powershell
npm install -g @anthropic-ai/claude-code
```

Run from the repo root — reads `CLAUDE.md` and `HANDOFF.md` automatically on boot.

### Cursor — BYOK (Bring Your Own Key)

1. Open Cursor → **Settings** (Ctrl+,) → **Cursor Settings**
2. Go to **Models** tab
3. Toggle **"Use your own API key"**
4. Paste `GEMINI_API_KEY` from `.env` (Google AI models) or `PERPLEXITY_API_KEY` for Sonar

Full model access, no $20/month — billed through Google at cost.

### Kade (VS Code Extension — Free)

Install from the VS Code/Cursor extension marketplace. BYOK built-in.
Use `GEMINI_API_KEY` or `PERPLEXITY_API_KEY` from `.env`.
Reads `KADE.md` + `.kade/rules.md` from the repo root on session start.
