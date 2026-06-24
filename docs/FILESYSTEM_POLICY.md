# V6 Filesystem Policy

## Purpose

Define where code, generated artifacts, archives, and migrations are allowed to live in V6. This policy prevents scatter — every file has exactly one canonical home.

## Directory Taxonomy

### Active Code

| Directory | Purpose | Ownership | Contents |
|---|---|---|---|
| `packages/` | Shared libraries and core engine packages | Package owners | TypeScript/JS modules, tests, configs |
| `apps/` | V6-native applications and UIs | App owners | Next.js/Vite apps, static sites |
| `services/` | V6-native backend services | Service owners | Docker-ready services, API handlers |

**Rules:**
- Every package, app, or service must have a `package.json` with `name`, `version`, and `description`.
- No cross-package imports without explicit dependency declaration.
- Test files co-located with source (e.g., `__tests__/` or `*.test.ts`).

### Configuration and Contracts

| Directory | Purpose | Contents |
|---|---|---|
| `docs/` | Human-readable contracts, decisions, and governance | Markdown documents |
| `schemas/` | Machine-readable contracts (JSON Schema) | `*.schema.json` files |
| `runtime/` | Runtime manifests and composition files | Route manifests, registries, memory indexes, hardening configs |

**Rules:**
- Every schema must follow `<NAME>.schema.json` naming convention.
- Every doc must be referenced from at least one operational file or PHASES.md.
- `runtime/` subdirectories are namespaced by domain: `routes/`, `registry/`, `memory/`, `hardening/`, `interop/`.

### Inventory and Heritage

| Directory | Purpose | Contents |
|---|---|---|
| `inventory/` | Heritage census, salvage backlog, capability matrix | `CAPABILITY_MATRIX.json`, `HERITAGE_BASELINE.md`, `SALVAGE_BACKLOG.md`, seed files |

**Rules:**
- Seed files (`*.seed.json`) are read-only reference once the canonical version exists.
- Every inventory item must validate against `HERITAGE_CAPABILITY.schema.json`.

### Wiki and Knowledge Projection

| Directory | Purpose | Contents |
|---|---|---|
| `wiki/` | Obsidian-compatible knowledge surface | Wiki notes, templates, sync rules, architecture docs |
| `wiki/examples/` | Round-trip demonstration notes | Frontmatter-aligned markdown notes |
| `wiki/obsidian/` | Obsidian vault configuration | `.obsidian/` settings (when active) |

**Rules:**
- Every wiki note must have valid `MEMORY_CONTRACT` frontmatter.
- Wiki is a projection — canonical truth lives in `runtime/memory/`.

### Agent Definitions

| Directory | Purpose | Contents |
|---|---|---|
| `agents/` | Agent manifests and legacy import staging | Agent YAML/JSON definitions |
| `agents/legacy-import/` | V1–V5 agent definitions staged for V6 promotion | Raw imports, not yet contracted |

**Rules:**
- No agent enters `agents/` root without a matching entry in `runtime/registry/agents.canonical.json`.
- Legacy imports must be promoted through the heritage matrix classification workflow.

### Design System

| Directory | Purpose | Contents |
|---|---|---|
| `design-system/` | Visual design tokens, components, and guidelines | Token definitions, component specs |

**Rules:**
- Design tokens are the single source of visual truth.
- Theme variations derive from tokens, not override them.

### Tools and Scripts

| Directory | Purpose | Contents |
|---|---|---|
| `tools/` | Build tools, CLI utilities, development helpers | Scripts, generators |
| `scripts/` | Operational scripts (deployment, migration, maintenance) | Shell/PowerShell/Node scripts |

**Rules:**
- No script modifies production state without explicit confirmation or `--dry-run` default.
- Scripts must be documented in their directory's README.

### Tests

| Directory | Purpose | Contents |
|---|---|---|
| `tests/` | Cross-cutting validation suites | Contract validation, integration tests |

**Rules:**
- Package-specific tests live with their package.
- `tests/` is for system-wide contract and integration validation only.

## Forbidden Locations

The following patterns are **never** valid locations for V6 canonical content:

| Location | Why Forbidden |
|---|---|
| `D:\` paths (Local Workstation) | **NAS SUPREMACY RULE:** All writes MUST target the NAS (`\\127.0.0.1\docker\...`). The local workstation is read-only for agents. |
| `node_modules/` | Dependency artifacts — not source |
| `dist/`, `build/`, `.next/`, `.turbo/` | Generated build output |
| `/tmp/`, `~/.gemini/`, Desktop | Outside workspace — ephemeral |
| `creative-liberation-engine-v5/` (direct writes) | V5 is read-only reference |
| Root directory loose files | Root is for config and boot files only (`AGENTS.md`, `HANDOFF.md`, `README.md`, `package.json`, `.env`, `.gitignore`, `docker-compose.*.yml`) |

## Generated and Temporary Assets

| Type | Rule |
|---|---|
| Build output | Never committed. Listed in `.gitignore`. |
| Generated code | Committed only if it's a contract-validated output (e.g., generated route configs from manifests). Must be documented. |
| Cache files | Never committed. Listed in `.gitignore`. |
| IDE config | `.vscode/` may be committed for shared settings. Other IDE dirs are gitignored. |
| Lock files | `package-lock.json` is committed. Other lock files evaluated case-by-case. |

## Migration Paths (Completed & Closed)

### V1–V5 Content Entry Points

All heritage migration paths have been successfully completed, and the entry points are now closed:
* The `agents/legacy-import/` staging folder is inactive.
* All capability triages are completed and the census inventory is archived at `archive/migration/inventory/`.
* Legacy bridges are decommissioned; V6 operates as a fully independent, sovereign runtime.

**Rules:**
- No new V5 content is allowed to be imported or written.
- All forward capabilities must be built natively in V6 under active code directories (`packages/`, `apps/`, `services/`).

### Archive Policy

When content is retired or superseded:

1. Move to `archive/<category>/<item>/` (create when needed).
2. Add `ARCHIVE_INDEX.md` documenting what was archived and why.
3. Set `lifecycleState: archived` on any related memory records.
4. Never hard-delete committed content without an archive trail.

## .gitignore Alignment

The `.gitignore` must reflect this policy. Current enforced exclusions:

```
node_modules/
dist/
build/
.next/
.turbo/
*.log
.env.local
.env.*.local
.DS_Store
Thumbs.db
```

Any new generated output category must be added to both this document and `.gitignore`.
