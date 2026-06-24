---
description: Windows workstation multipliers Ã¢â‚¬â€ set up SSH keys, PowerShell aliases, and auto-start services to eliminate manual friction
---

# /windows-setup

One-time workstation hardening for zero-friction agent operations.
Run each section once. After completion, SSH, NAS access, and engine startup are fully automated.

---

## 1 Ã¢â‚¬â€ NAS SSH Key (Eliminates `password` + `sudo` Blockers)

> **Biggest win.** All NAS tasks become non-blocking after this.

// turbo
**Check if key exists:**

```powershell
Test-Path "$env:USERPROFILE\.ssh\id_ed25519"
```

**If no key Ã¢â‚¬â€ generate:**

```powershell
ssh-keygen -t ed25519 -C "cle-nas" -f "$env:USERPROFILE\.ssh\id_ed25519" -N ""
```

**Copy to NAS:**

```powershell
$pub = Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
# SSH in once with password, then add key:
ssh justin@127.0.0.1 "mkdir -p ~/.ssh && echo '$pub' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

**Add to ssh-agent (auto-starts with Windows):**

```powershell
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add "$env:USERPROFILE\.ssh\id_ed25519"
```

**Verify:**

```powershell
ssh justin@127.0.0.1 "echo NAS SSH OK"
```

---

## 2 Ã¢â‚¬â€ PowerShell Profile Aliases

**Open profile:**

```powershell
notepad $PROFILE
```

**Add these aliases:**

```powershell
# Creative Liberation Engine shortcuts
Set-Alias nas { ssh justin@127.0.0.1 }
function pickup { Write-Host "Run /pickup in Creative Liberation Engine window" }
function engine-status { Invoke-RestMethod http://127.0.0.1:5050/api/status | ConvertTo-Json -Depth 3 }
function dispatch { Invoke-RestMethod http://127.0.0.1:5050/api/status }
function blockers { Invoke-RestMethod http://127.0.0.1:5050/api/blockers }

# Quick nav (v5 repo only â€” no creative-liberation-engine-v4)
function bc5 { Set-Location "Y:\creative-liberation-engine" }
```

**Reload:**

```powershell
. $PROFILE
```

---

## 3 Ã¢â‚¬â€ Task Scheduler: Auto-Start Services on Login

**Create a startup task for ssh-agent (if not already set above):**

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command `"Start-Service ssh-agent`""
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName "SSH Agent Start" -Action $action -Trigger $trigger -RunLevel Highest -Force
```

**For VPN auto-connect:** use your VPN client's built-in auto-connect on login feature.

**For Redis (if running locally):**

```powershell
# Only if Redis runs on Windows (most likely it's on NAS Ã¢â‚¬â€ skip this)
$action = New-ScheduledTaskAction -Execute "redis-server.exe" -WorkingDirectory "C:\Redis"
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName "Redis Start" -Action $action -Trigger $trigger -RunLevel Highest -Force
```

---

## 4 Ã¢â‚¬â€ Windows Terminal Profiles

Open **Windows Terminal** Ã¢â€ â€™ Settings Ã¢â€ â€™ `settings.json` and add these profiles:

```json
{
  "name": "NAS Shell",
  "commandline": "ssh justin@127.0.0.1",
  "icon": "Ã°Å¸â€“Â¥Ã¯Â¸Â",
  "colorScheme": "One Half Dark"
},
{
  "name": "creative-liberation-engine",
  "commandline": "powershell.exe -NoExit -Command \"Set-Location 'D:\Google Antigravity\Infusion Engine Brainchild\\creative-liberation-engine'\"",
  "icon": "Ã¢Å¡Â¡",
  "colorScheme": "Tango Dark"
}
```

---

## 5 Ã¢â‚¬â€ PowerToys: Keyboard Shortcuts

Install [PowerToys](https://github.com/microsoft/PowerToys) if not already installed.

**Keyboard Manager mappings (PowerToys Ã¢â€ â€™ Keyboard Manager Ã¢â€ â€™ Remap shortcuts):**

| Shortcut | Action |
|----------|--------|
| `Win + Shift + A` | Open Creative Liberation Engine (Chrome Ã¢â€ â€™ localhost:3000 or IDE) |
| `Win + Shift + N` | Open NAS SSH terminal tab |
| `Win + Shift + D` | Open dispatch console in browser |
| `Win + Shift + S` | Show `/status` panel (run in active terminal) |

**PowerToys Run** (`Alt+Space`) Ã¢â‚¬â€ pin these:

- `dispatch` Ã¢â€ â€™ `http://127.0.0.1:5050/api/status`
- `console` Ã¢â€ â€™ `http://localhost:3000`

---

## 6 Ã¢â‚¬â€ Second Monitor: Dispatch Console

Pin the Creative Liberation Engine Console (`http://localhost:3000` Ã¢â€ â€™ DispatchCenter tab) to your
second monitor in a dedicated browser window. This gives live visibility into:

- All active agent windows
- Task queue (queued / active / done)
- BLOCKER alerts (P0/P1 surface immediately)
- Heartbeat map Ã¢â‚¬â€ see every window's current task in real-time

---

## Verification Checklist

- [ ] `ssh justin@127.0.0.1 "echo OK"` Ã¢â‚¬â€ returns `OK` with no password prompt
- [ ] `engine-status` in PowerShell Ã¢â‚¬â€ returns live dispatch JSON
- [ ] ssh-agent starts automatically after reboot (check Services)
- [ ] Windows Terminal has `NAS Shell` and `creative-liberation-engine` profiles
- [ ] Second monitor shows live dispatch console

