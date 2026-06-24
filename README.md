# Creative Liberation Engine V6

Welcome to the **Creative Liberation Engine V6** monorepo—a sovereign, contract-first AI infrastructure designed for artist liberation and autonomous creative workflows. 

This repository acts as the clean-root orchestrator for a multi-agent system composed of TypeScript/Node.js services, package layers, schemas, and verification systems.

---

## 🎨 What is Creative Liberation Engine?

Creative Liberation Engine is a decentralized execution platform that coordinates virtual agent swarms across media, intelligence, and backend operations. It is built to ensure that creative intelligence remains open, local, and sovereign.

### Key Pillars
*   **Contract-First Orchestration**: Machine-checkable JSON schemas enforce system state, routes, and memory structures before code executes.
*   **Decentralized Agent Mesh**: Specialized subagents run in isolated or peer-to-peer contexts, communicating via low-latency mTLS gateways.
*   **Unified Local Runtime**: Offloads processing (inference, media rendering, and database logic) to local hosts or private NAS networks to maximize performance.

---

## 🗺️ Showing You Around (Root Layout)

Here is a map of the codebase to help you find your way:

```
├── apps/               # User-facing applications and UI dashboards
├── services/           # TypeScript/Node.js Express microservices (Helix, Gateway, Scribe)
├── packages/           # Shared libraries, SDKs, and local MCP servers
├── schemas/            # Strict JSON Schemas validating system state and contracts
├── docs/               # Architecture decision records, governance contracts, and system constraints
├── tests/              # Contract validation, E2E flow tests, and verification suite
└── tools/              # Scaffolding, PKI certificate managers, and development utilities
```

---

## 🚀 Getting Started

Follow these steps to set up and verify the monorepo in your environment.

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   **Node.js** (v22.x recommended)
*   **pnpm** (v8.15.4)
*   **Docker** (for containerized execution)

### 2. Installation
Install all dependencies across the workspace:
```bash
pnpm install
```

### 3. Running the Verification Suite
Before writing code or running services, run the contract and integrity tests to confirm the environment is valid:
```bash
pnpm run test
```
This runs the AJV schema validators against all schemas, checks example payloads, and runs sovereignty checks.

### 4. Running Locally
To spin up the core services and backing databases (PostgreSQL, Redis, ChromaDB, etc.) in a local Docker environment:
```bash
pnpm run local:up
```

---

## 🛠️ Key Commands

*   `pnpm run test` — Run all contract and validation checks.
*   `pnpm run local:up` — Start local Docker Compose services.
*   `pnpm run local:down` — Stop local Docker Compose services and clean volumes.
*   `pnpm run local:smoke` — Run a diagnostic smoke test on local endpoints.


## ⚖ Licensing & Contact

This project is open-source and licensed under the terms of the Apache License 2.0. See the LICENSE file for the full terms and conditions.

For partnerships, inquiries, or community coordination, reach out to: inquiries@creativeliberationengine.org

*A Creative Liberation Collective project.*
