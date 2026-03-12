# Deployment Topologies — Hardware & Setup

Where the Creative Liberation Engine runs. Single machine, laptop, network mesh, cloud mesh — and how to get there.

---

## Overview

The engine is designed for **portability** (Article XVIII). It runs on:

- **Single computer** — Laptop, desktop, dev machine
- **Network mesh** — Multiple machines on a LAN (workstation + NAS, etc.)
- **Cloud mesh** — Hybrid or full cloud (Genkit on Cloud Run, Dispatch behind a tunnel, etc.)

Each topology has different setup steps, hardware expectations, and trade-offs. This doc maps them.

---

## Hardware Options

| Hardware | Notes | Best for |
|----------|-------|----------|
| **Laptop** (M1/M2/M3, x86) | Node 20+, pnpm 9+. M1 MacBook works. | Dev, portable, first boot |
| **Desktop** | Same as laptop. More RAM = better for local models. | Full local stack, Ollama |
| **NAS** (Synology, etc.) | Docker. Dispatch, SAR, static assets. | Always-on orchestration, shared storage |
| **Raspberry Pi** | ARM. Lightweight services only; Genkit prefers more RAM. | Edge nodes, sensors |
| **Cloud VM** | GCP, AWS, etc. Standard Node/Docker. | Production, multi-region |

**Minimum:** Node 20+, 4GB RAM for Genkit. For local models (Ollama), 8GB+ recommended.

---

## Topology 0 — Single Computer

**One machine. Everything local.**

### What runs

- Genkit server (port 4100)
- Genkit UI (port 4000)
- Optional: Ollama, ChromaDB, Python CLI

### Setup

Follow [GETTING-STARTED.md](GETTING-STARTED.md): clone, install, configure, build, boot.

```bash
pnpm run dev
pnpm run genkit:ui   # second terminal
```

### Laptop

Same as above. M1 MacBook is supported. No extra config for ARM.

### Offline / Sovereign Mode

- No API keys required. Set `OLLAMA_HOST` if Ollama runs elsewhere.
- Use Ollama for local models. See `.env.example` for `OLLAMA_HOST`.

---

## Topology 1 — Network Mesh (LAN)

**Multiple machines on your network.** Workstation + NAS, or multiple workstations.

### Typical layout

| Node | Role | Services |
|------|------|----------|
| **Workstation** | Dev / primary | Genkit, Genkit UI, agents |
| **NAS** | Always-on | Dispatch (5050), SAR (5051), static assets |

### Setup on NAS

1. SSH into the NAS.
2. Deploy Dispatch: see [packages/dispatch/README.md](../packages/dispatch/README.md).
3. Point agents at `http://<NAS-IP>:5050/sse` for MCP.

### Config

- `.env` on workstation: `DISPATCH_URL=http://<NAS-IP>:5050`
- Agents use `http://<NAS-IP>:5050/sse` in MCP config.

### Trade-offs

- **LAN only** — Not reachable from outside (5G, etc.) unless you add a tunnel.
- **Sovereign** — All data stays on your hardware.

---

## Topology 2 — Hybrid Cloud (Partial)

**Some services in the cloud; core orchestration local.**

### Typical layout

| Service | Location | Notes |
|---------|----------|-------|
| Genkit | Cloud Run | `--allow-unauthenticated` for public access |
| Dispatch | NAS or local | Behind Cloudflare Tunnel or proxy |

### Setup

1. Deploy Genkit to Cloud Run (us-central1).
2. Deploy Dispatch on NAS (or Docker host).
3. Expose Dispatch via Cloudflare Tunnel or proxy if you need remote access.

### Config

- Mobile / web clients: point at Cloud Run Genkit URL.
- Agents: point at Dispatch URL (local or tunnel).

---

## Topology 3 — Full Cloud Mesh

**Multiple regions, cloud-native routing.** Cloud-mesh package provides types and routing; implementation is in progress.

### Planned

- `@cle/cloud-mesh` — Router for workload routing (local, Cloudflare, GCP).
- Targets: cost, latency, health checks.
- Sovereign-only flag for tasks that must stay local.

### Current state

- Stub implementation. Defaults to local target.
- See [packages/cloud-mesh/](../packages/cloud-mesh/).

---

## Setup Summary

| Topology | Start here | Extra steps |
|----------|------------|-------------|
| **0 — Single** | [GETTING-STARTED.md](GETTING-STARTED.md) | None |
| **1 — LAN mesh** | GETTING-STARTED + [Dispatch README](../packages/dispatch/README.md) | Deploy Dispatch on NAS |

---

## Founder's Setup (Current)

*This is how the founder operates today — proof it works.*

| Node | Role | What runs |
|------|------|-----------|
| **Windows workstation** | Dev / primary | Genkit (4100), Genkit UI, agents, Python CLI |
| **Synology NAS** | Always-on | Dispatch (5050), SAR (5051), Docker stack, SMB media shares |
| **Cloud** | Public access | Genkit on Cloud Run (us-central1), CORE Mobile on Firebase Hosting |

**Workflow:** Dev on workstation, production on NAS Docker. Media (photos, video) on NAS SMB shares. CORE Mobile for session capture from phone; Firebase Hosting for public access. Dispatch stays LAN-only until Cloudflare Tunnel is wired.

**Use case:** Creative production — weddings, lifestyle, portrait. Autonomous editing pipeline. Sovereign-first: data on NAS, compute where it makes sense.

---

## Zero Day Note

> From [AGENTS.md](../AGENTS.md): **Zero Day** means a person can use the thing from their phone, without setup.

- NAS SMB + local IP ≠ deployed. Static app must be served (Firebase Hosting, nginx).
- API URLs must be public, not 192.168.x.x.
- Verify from 5G / outside LAN before calling it live.

---

## Related

- [GETTING-STARTED.md](GETTING-STARTED.md) — First boot
- [packages/dispatch/README.md](../packages/dispatch/README.md) — NAS Dispatch deployment
- [packages/sovereign-mesh/](../packages/sovereign-mesh/) — Workstation, NAS, GCP tiers
- [CONSTITUTION.md](../CONSTITUTION.md) Article XVIII — Anti-Lock-In, portability
