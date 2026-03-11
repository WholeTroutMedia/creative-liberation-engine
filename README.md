# Creative Liberation Engine v5

> **The AI That Builds With You**
>
> Every user explores their own Wonderland. Every design element is discoverable. Every interaction teaches through delight.
>
> *The Alice Principle — Learning through wonder, exploration through play.*

The Creative Liberation Engine is a compound-learning, multi-agent AI operating system for artists, creators, and studios. Built on Google's Genkit framework, governed by a 20-article Constitution, and wired for compound intelligence through the hierarchical Live Memory Bus.

> âš ï¸ **Disclaimer: AI-Generated Documentation**  
> Notice: A large portion of this repository's documentation is generated and maintained autonomously by AI agents. While we strive for hyper-accuracy, there may be discrepancies, outdated context, or hallucinated facts. Please verify any critical information and report inaccuracies. We believe in being fully honest about the role of AI in maintaining this project.

![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-violet) ![Version](https://img.shields.io/badge/version-5.0.0--GENESIS-gold) ![Agents](https://img.shields.io/badge/agents-25-blue)

---

## What Makes It Different

| Platform             | What you get                                                                  |
|----------------------|-------------------------------------------------------------------------------|
| ChatGPT              | A chatbot                                                                     |
| Midjourney           | An image generator                                                            |
| Runway               | A video generator                                                             |
| **Creative Liberation Engine** | **A full creative team with memory, specialization, and constitutional governance** |

The engine doesn't just respond — it *learns*, *remembers*, and *compounds* every creative decision across all runs.

---

## The Scale

- **25+ Total Agents**
- **1 ARCHAEON Global LoRA**

---

## Architecture

```text
+-------------------------------------------------------------------------+
|                    Creative Liberation Engine v5                        |
|                                                                         |
|  [averid TRINITY]              [aurorad HIVE]                           |
|  stratad      (Strategy)      aurorad      (Architect)                  |
|  logd         (Truth/Scribe)  boltd        (Code Gen)                   |
|  prismd       (Execution)     cometd       (Backend)                    |
|                                                                         |
|  [keeperd HIVE]                [lexd HIVE]                              |
|  keeperd      (Knowledge)     lexd         (Constitutional)             |
|  archd        (Patterns)      compassd     (Ethics)                     |
|  codexd       (Docs)                                                    |
|                                                                         |
|  [switchd HIVE]               [VALIDATOR HIVE]                          |
|  relayd       (Routing)       sentineld    (Security)                   |
|  signald      (Integrations)  archond      (Architecture)               |
|  switchd      (Ops)           proofd       (Correctness)                |
|                               harbord      (Test Coverage)              |
|  [BROADCAST HIVE]             ramcrewd     (Ship Decision)              |
|  atlasd       (Lead)                                                    |
|  controlroomd (LiveOps)       ----------------------------------------- |
|  showrunnerd  (Prod.)         [LIVE MEMORY BUS]                         |
|  graphicsd    (Motion)        Every execution -> SCRIBE pattern         |
|  studiod      (Studio)        extraction -> compound learning           |
|  systemsd     (Infra)                                                   |
+-------------------------------------------------------------------------+
|  [GENMEDIA studiod v5] Unified Provider Abstraction                     |
|  Imagen3 / Flux Pro / Wan 2.1 / Veo2 / Lyria / SDXL                     |
+-------------------------------------------------------------------------+
```

---

## The 20-Article Constitution

The engine is governed by 20 immutable articles. Selected highlights:

- **Article 0** — Sacred Mission: *"Artist liberation through sovereign technology"* — immutable
- **Article V** — User Sovereignty: user creative vision is supreme
- **Article VI** — Quality Gates: code doesn't ship without VALIDATE approval (`ramcrewd`)
- **Article VII** — Knowledge Compounding: every execution teaches the system
- **Article XIV** — Testing Mandate: untested code is unshipped code
- **Article XVIII** — Anti-Lock-In: you can always export and leave

---

## Live Memory Bus

The engine's compound intelligence layer. Every agent execution:

1. **Pre-flight recall** — queries past episodes via tag similarity
2. **Execution** — runs with historical context in mind
3. **Post-flight SCRIBE** — Gemini extracts a reusable pattern; persists to JSONL + Git

This means `boltd` gets better at your codebase with every run. `aurorad` remembers your design decisions. `keeperd` tracks what works.

---

## The OmniMedia Orchestrator

The God Node. A single creative brief produces:

```typescript
const result = await OmniMediaOrchestratorFlow({
    brief: "Bold campaign for a new streetwear drop in NYC",
    brand: "Raw, authentic, anti-corporate",
    outputTypes: ['all'],    // concept + copy + images + video + audio
    quality: 'ultra',
    format: 'vertical',     // 9:16 for social
});

// result.concept         → aurorad creative concept
// result.copy            → logd campaign copy
// result.assets.images   → ["/path/to/imagen3_output.png", ...]
// result.assets.videos   → ["/path/to/wan21_output.mp4", ...]
// result.assets.audio    → ["/path/to/lyria_track.mp3", ...]
// result.lexdApproval     → "PASS"  // Constitutional validation
```

---

## Quick Start

```bash
git clone https://github.com/Creative Liberation Engine Community/creative-liberation-engine.git
cd creative-liberation-engine
pnpm install
```

Set your environment variables:

```bash
cp .env.example .env
# Fill in at minimum: GOOGLE_API_KEY
```

Run the engine (Genkit):

```bash
cd packages/genkit
pnpm run dev          # Starts the Genkit dev server
pnpm run genkit:ui    # Opens the Genkit developer UI at http://localhost:4000
```

Or run the full stack with Docker:

```bash
docker compose up     # Genkit + FastAPI engine + Console UI + ChromaDB
```

---

## Constitutional Preflight (Public SDK)

```typescript
import { constitutionalPreflight, CONSTITUTION, HIVES } from '@inception/core';

// Lightweight check before submitting to the engine
const { pass, flags } = constitutionalPreflight("Generate brand assets for our new campaign");
// → { pass: true, flags: [] }

// Query the Constitution
console.log(CONSTITUTION[0].summary);
// → "Artist liberation through sovereign technology"

// Explore hives
console.log(HIVES.aurorad.members);
// → ["aurorad", "boltd", "cometd"]
```

---

## Access Tiers

| Tier            | Who        | Capabilities                                        |
|-----------------|------------|-----------------------------------------------------|
| **Studio**      | WholeTrout | Full 25-agent system, all providers, Living Archive |
| **Client**      | Projects   | Project-scoped agents, client memory isolated       |
| **Merch**       | Public     | OmniMedia only, rate-limited, no private memory     |

---

## The Numbers

| Metric                | Value                              |
|-----------------------|------------------------------------|
| Active Agents         | 25                                 |
| Hives                 | 7                                  |
| Constitution Articles | 20                                 |
| Memory Provider       | Hierarchical JSONL + ChromaDB + Git |
| LLM Providers         | Gemini 2.5 Pro, Claude 3.5, GPT-4o, Perplexity Sonar, Grok, DeepSeek |
| Media Providers       | Imagen3, Flux Pro, Wan 2.1, Veo2, Lyria |
| Offline Mode          | Ollama (Llama 3, Mistral, Gemma)   |
| Compound Learning     | Live Memory Bus — CLS hierarchical, per-agent SCRIBE |

---

## Correspondence

For correspondence, reach out to `operator@gmail.com`.

> *"Artist liberation through sovereign technology."*

---

## Repository Navigation

| Area | Link | Description |
|---|---|---|
| **System** | | |
| Boot Config | [`.averi/boot.json`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.averi/boot.json) | Engine manifest — 36 agents, 6 hives |
| Agent Charters | [`.averi/agents/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.averi/agents) | Constitution + agent definitions |
| Inbox Pipeline | [`.averi/inbox/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.averi/inbox) | Phone-to-execution capture pipeline |
| **Agent Orchestration** | | |
| ANTIGRAVITY Protocol | [`.agent/ANTIGRAVITY.md`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.agent/ANTIGRAVITY.md) | Agent identity + coordination rules |
| Project Board | [`.agent/project_dispatch.md`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.agent/project_dispatch.md) | Live workstream kanban |
| Instance Registry | [`.agent/dispatch/registry.md`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.agent/dispatch/registry.md) | Multi-instance coordination |
| Agent Workflows | [`.agent/workflows/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.agent/workflows) | Claim, dispatch, handoff, sync |
| **Core Packages** | | |
| Genkit Orchestration | [`packages/genkit/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/packages/genkit) | AI flow engine |
| Console UI | [`apps/console/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/apps/console) | Spatial OS interface |
| cometd Browser | [`packages/comet/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/packages/comet) | Sovereign Playwright browser |
| **Infrastructure** | | |
| Docker | [`docker/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/docker) | Container configs |
| CI/CD | [`.forgejo/workflows/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/.forgejo/workflows) | Forgejo Actions |
| Deploy | [`deploy/orchestrator/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/deploy/orchestrator) | GCP Cloud Run deployment |
| **Services** | | |
| Inbox Webhook | [`services/inbox-webhook/`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/services/inbox-webhook) | iOS Share Sheet + Flipboard RSS ingestion |
| **Docs** | | |
| iOS Shortcut Guide | [`docs/ios-shortcut-setup.md`](/Creative Liberation Engine Community/brainchild-v5/src/branch/main/docs/ios-shortcut-setup.md) | Phone capture setup |
