# Creative Liberation Engine V6 — Sovereign PKI Toolkit

> Part of WS-01: Sovereign Agent Identity & Zero-Trust Mesh

## Overview

This directory contains the tools for managing cryptographic identities
for all agents in the Creative Liberation Engine mesh. Every agent gets an X.509
certificate signed by the Creative Liberation Engine Root CA.

## Files

| File | Purpose |
|------|---------|
| `generate-ca.ts` | Generate the self-signed Root CA (once) |
| `generate-agent-cert.ts` | Generate per-agent identity certificates |
| `build-identity-index.ts` | Build the fingerprint index from certs |
| `sign-identity-token.ts` | Client-side token signing for agents |

## Workflow

```bash
# 1. Generate Root CA (one-time)
npx ts-node tools/pki/generate-ca.ts

# 2. Generate certs for all canonical agents
npx ts-node tools/pki/generate-agent-cert.ts --all

# 3. Build identity index
npx ts-node tools/pki/build-identity-index.ts

# 4. Deploy to NAS
Copy-Item tools/pki/ca/cle-ca.crt \\127.0.0.1\docker\genesis-deploy\tools\pki\ca\
Copy-Item tools/pki/agents\* \\127.0.0.1\docker\genesis-deploy\tools\pki\agents\
```

## Security

- **NEVER** commit `*.key` files to version control
- The `.gitignore` in this directory prevents key leaks
- CA key is 4096-bit RSA, agent keys are 2048-bit RSA
- Agent certs expire after 365 days (annual rotation enforced)
- CA cert expires after 3650 days (10 years)

## Integration Points

- **Dispatch middleware**: `services/dispatch/src/middleware/agent-identity-auth.ts`
- **Schema**: `schemas/AGENT_IDENTITY.schema.json`
- **Agent registry**: `schemas/AGENTS_CANONICAL.schema.json` (identity block)
- **Route contract**: `schemas/ROUTE_CONTRACT.schema.json` (agentAuth block)
