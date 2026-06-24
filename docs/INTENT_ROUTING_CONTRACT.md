# INTENT_ROUTING_CONTRACT.md — Creative Liberation Engine V6

> **Version:** 1.0.0  
> **Status:** ACTIVE  
> **Owner:** AVERI Collective (ATHENA · VERA · IRIS)  
> **Governance:** `docs/GOVERNANCE_PRECEDENCE.md` — Layer 3  
> **Last Updated:** 2026-05-22

---

## 1. Purpose

This contract defines how natural-language user requests are routed to the correct **skill**, **workflow**, or **report template** at runtime. It is the authoritative specification for intent resolution within the Creative Liberation Engine V6 agent operating system.

Every user utterance enters the system as unstructured text. This contract ensures that utterance is:
1. Classified into a canonical intent category
2. Matched against the registered capability surface
3. Routed to the correct execution path — skill, workflow, or report pipeline
4. Never silently dropped

> **Governing principle:** The user should never need to know the internal name of a skill, workflow, or template. Natural language is the interface.

---

## 2. Intent Classification Taxonomy

All user intents are classified into one of the following canonical categories:

| Category | Trigger Signals | Example Utterances |
|---|---|---|
| `report` | "report", "brief", "summary", "deck", "write up" | "Give me a strategy report on vendor lock-in" |
| `audit` | "audit", "check", "verify", "validate", "compliance" | "Audit our security posture" |
| `forecast` | "forecast", "predict", "project", "estimate", "model" | "Forecast GPU capacity for Q3" |
| `troubleshoot` | "fix", "debug", "why is", "broken", "incident", "down" | "Why is the media pipeline failing?" |
| `create` | "create", "build", "generate", "new", "scaffold" | "Create a new workflow for onboarding" |
| `configure` | "configure", "set up", "change", "update", "toggle" | "Configure the retention policy for logs" |
| `analyze` | "analyze", "investigate", "deep dive", "compare", "assess" | "Analyze agent drift over the last sprint" |
| `monitor` | "monitor", "watch", "track", "alert", "status", "health" | "Show me service health status" |

### 2.1 Compound Intents

A single user request may contain multiple intents. Example:
> "Audit our security posture and generate a CISO board brief"

This decomposes into:
1. `audit` → `attack-surface-mapper` + `security-hardener`
2. `report` → `ciso-board-brief` template

The router MUST detect compound intents and execute both paths.

### 2.2 Implicit Intents

Some requests contain no explicit trigger word but carry implicit intent:
> "How are we doing on sovereignty?"

Implicit mapping: `analyze` + `report` → `vendor-sovereignty-audit` template

The router MUST perform semantic analysis on ambiguous requests before falling back.

---

## 3. Routing Algorithm

### 3.1 Overview Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER NATURAL-LANGUAGE REQUEST                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  STEP 1: EXTRACT      │
              │  Intent Keywords      │
              │  & Category           │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  STEP 2: MATCH        │
              │  skills.canonical     │
              │  triggers[] field     │
              └───────────┬───────────┘
                          │
                   ┌──────┴──────┐
                   │  Matches?   │
                   └──────┬──────┘
                    yes ╱   ╲ no
                       ╱     ╲
                      ▼       ▼
         ┌──────────────┐  ┌──────────────────┐
         │ STEP 3:      │  │ STEP 5b: FUZZY   │
         │ Filter by    │  │ Match on skill   │
         │ domain &     │  │ summaries        │
         │ outputTypes  │  └────────┬─────────┘
         └──────┬───────┘           │
                │              ┌────┴────┐
                ▼              │ Match?  │
         ┌──────────────┐      └────┬────┘
         │ STEP 4:      │     yes╱    ╲no
         │ Disambiguate │       ╱      ╲
         │ by specif-   │      ▼        ▼
         │ icity score  │  [Continue] ┌─────────────┐
         └──────┬───────┘   at Step 3 │ ESCALATE    │
                │                     │ to Operator │
                ▼                     └─────────────┘
         ┌──────────────┐
         │ STEP 5:      │
         │ Report/      │
         │ Analysis?    │
         │ Cross-ref    │
         │ templates    │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ STEP 6:      │
         │ Resolve      │
         │ leadAgents[] │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ STEP 7:      │
         │ Workflow      │
         │ composition? │
         │ Chain skills │
         └──────┬───────┘
                │
                ▼
        ┌───────────────┐
        │   EXECUTE     │
        └───────────────┘
```

### 3.2 Step Details

#### Step 1 — Extract Intent Keywords

Parse the user request to extract:
- **Primary intent category** from the taxonomy (§2)
- **Domain keywords** (e.g., "security", "media", "design", "memory")
- **Entity references** (agent names, skill names, file paths)
- **Temporal qualifiers** ("last week", "Q3", "since v5")
- **Output format hints** ("as a PDF", "in a table", "brief")

**Algorithm:**
```
INPUT:  raw_user_text
OUTPUT: { category: string, keywords: string[], domain: string, entities: string[] }

1. Tokenize raw_user_text
2. Match tokens against INTENT_TAXONOMY trigger signals
3. If multiple categories match, mark as COMPOUND intent
4. Extract domain from context words (security, ops, design, data, etc.)
5. Extract named entities (agent names from agents.canonical.json aliases)
```

#### Step 2 — Match Against Skills Registry

Load `runtime/registry/skills.canonical.json` and match against registered skills.

**Match criteria (in priority order):**
1. Exact match on `skillId` or `aliases[]`
2. Match on `triggers[]` field (when populated in enriched registry)
3. Keyword overlap with `summary` field
4. Domain alignment with skill's operational domain

**Current registry surface:** 83 skills, all `next_skill` kind, 81 agent-callable.

```
INPUT:  { category, keywords, domain }
OUTPUT: candidate_skills[]  (0..N matches)

FOR each skill IN skills.canonical.json:
  score = 0
  IF keywords ∩ skill.aliases     → score += 100
  IF keywords ∩ skill.triggers    → score += 80
  IF domain == skill.domain       → score += 40
  IF keywords ∩ skill.summary     → score += 20
  IF score > THRESHOLD (20):
    candidate_skills.append({ skill, score })
```

#### Step 3 — Filter by Domain and Output Types

Narrow candidates using contextual filters:
- **Domain filter:** If the user request is clearly about "security", eliminate non-security skills
- **Output type filter:** If the user wants a "report", prefer skills that produce document outputs
- **Status filter:** Only match skills with `status: "active"`
- **Callable filter:** Only match skills with `agentCallable: true`

#### Step 4 — Disambiguate by Specificity Score

When multiple skills remain after filtering:

| Factor | Weight | Description |
|---|---|---|
| Alias exact match | +100 | User said the skill's exact name |
| Trigger match | +80 | Matches a declared trigger phrase |
| Domain alignment | +40 | Skill's domain matches request domain |
| Summary keyword overlap | +20 | Words overlap with skill summary |
| Recency bias | +10 | Skill was used recently in this session |

**Tie-breaking rules:**
1. Prefer the skill with the highest specificity score
2. If tied, prefer the skill with fewer aliases (more specialized)
3. If still tied, present options to the user (max 3)

#### Step 5 — Report Template Cross-Reference

If the intent category is `report`, `audit`, or `analyze`, cross-reference against `strategic-report-templates.registry.json`.

**Template inventory (10 templates):**

| Template ID | Name | Min Tier | Trigger Patterns |
|---|---|---|---|
| `mckinsey-strategy` | Decision Pyramid Strategy Brief | free | "strategy", "strategic", "decision" |
| `big4-risk-controls` | Risk And Controls Assessment | pro | "risk", "controls", "assessment" |
| `gartner-capability-maturity` | Capability Maturity Roadmap | pro | "maturity", "capability", "roadmap" |
| `pe-commercial-diligence` | Commercial Diligence Pack | pro | "commercial", "diligence", "market" |
| `pe-technical-diligence` | Technical Diligence Pack | pro | "technical", "architecture", "debt" |
| `cfo-operating-review` | CFO Operating Review | pro | "operating", "economics", "cash" |
| `ciso-board-brief` | CISO Board Brief | sovereign | "security", "cyber", "CISO", "board" |
| `regulatory-readiness` | Regulatory Readiness Matrix | sovereign | "regulatory", "compliance", "audit" |
| `board-value-creation` | Board Value Creation Plan | sovereign | "value creation", "board", "transformation" |
| `vendor-sovereignty-audit` | Vendor Sovereignty Audit | sovereign | "vendor", "sovereignty", "lock-in" |

**Selection algorithm:**
```
IF intent_category IN [report, audit, analyze]:
  FOR each template IN templates.registry:
    IF keywords ∩ template.trigger_patterns:
      template_candidates.append(template)
  IF len(template_candidates) == 1:
    auto_select(template_candidates[0])
  ELIF len(template_candidates) > 1:
    present_options_to_user(template_candidates)
  ELSE:
    use_default_report_format()
```

#### Step 6 — Resolve Lead Agents

Once skill(s) are identified, resolve executing agent(s) from `agents.canonical.json`:

**Domain → Agent mapping (primary routing):**

| Domain | Primary Agents | Hive |
|---|---|---|
| Security | SENTINEL, VAULT | core, VAULT |
| Runtime Ops | SYSTEMS, CONTROL_ROOM | core |
| Design / UI | GRAPHICS, STUDIO, LEONARDO | core |
| Data Integration | RELAY, HARBOR | core |
| Memory / Knowledge | KEEPER, STRATA | core, CORTEX |
| Delivery Governance | PROOF, SCRIBE | core |
| Model / Agent Quality | SAGE, ATHENA | core |
| Media Production | SHOWRUNNER, AURORA | core |

**Resolution:**
```
INPUT:  matched_skill
OUTPUT: lead_agents[]

1. Read skill.domain → map to agent roster via domain table
2. If skill has explicit leadAgents[] → use those
3. If skill.domain is ambiguous → route to SWITCHBOARD for dispatch
4. Always include ATHENA for oversight on sovereign-tier operations
```

#### Step 7 — Workflow Composition Check

Before executing individual skills, check if a registered workflow chains the matched skills:

**Workflow inventory (7 workflows):**

| Workflow ID | Kind | Composable Skills |
|---|---|---|
| `client-feedback` | ops | eval-harness, experience-telemetry-correlator |
| `content-delivery` | ops | davinci-resolve-automation, design-system-sync |
| `eval-capability` | evaluation | eval-harness, benchmark-suite-runner, eval-dataset-curator |
| `eval-regression` | evaluation | eval-harness, prompt-regression-guard, a11y-regression-tracker |
| `incident-response` | ops | incident-commander, incident-forensics, service-health-triage |
| `media-production` | ops | davinci-resolve-automation, design-asset-provenance |
| `vendor-approval` | ops | vendor-sovereignty-audit template, compliance-evidence-packager |

**Decision logic:**
```
IF matched_skills ⊂ workflow.composable_skills:
  USE workflow (preserves execution ordering, error handling, checkpoints)
ELSE:
  EXECUTE skills individually via lead_agents
```

---

## 4. Report Routing Pipeline

Report requests follow an enhanced pipeline that combines skill execution with template formatting.

### 4.1 End-to-End Report Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER: "Give me a strategy report on our vendor sovereignty"         │
└─────────────────────────┬────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 1. CLASSIFY           │
              │ category: report      │
              │ domain: sovereignty   │
              │ keywords: [vendor,    │
              │   sovereignty,        │
              │   strategy]           │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 2. TEMPLATE SELECT    │
              │ Match: vendor-        │
              │   sovereignty-audit   │
              │ Sections:             │
              │  • Dependency graph   │
              │  • Lock-in profile    │
              │  • Exit feasibility   │
              │  • Sovereignty road-  │
              │    map                │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 3. DATA SOURCING      │
              │ Skills invoked:       │
              │  • attack-surface-    │
              │    mapper             │
              │  • compliance-        │
              │    evidence-packager  │
              │  • vendor-approval    │
              │    workflow           │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 4. ASSEMBLY           │
              │ Lead: SCRIBE          │
              │ Oversight: ATHENA     │
              │ Template applied      │
              │ Sections populated    │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 5. DELIVERY           │
              │ Format: Markdown      │
              │ Location: artifacts/  │
              │ Notify: user          │
              └───────────────────────┘
```

### 4.2 Template-to-Skill Mapping

Each report template has recommended data-sourcing skills:

| Template | Data Skills | Assembly Agent |
|---|---|---|
| `mckinsey-strategy` | deep-research, cost-arbitrage | ATHENA |
| `big4-risk-controls` | attack-surface-mapper, authz-policy-verifier | SENTINEL |
| `gartner-capability-maturity` | eval-harness, benchmark-suite-runner | SAGE |
| `pe-commercial-diligence` | deep-research, cost-arbitrage | COMMERCE |
| `pe-technical-diligence` | dependency-auditor, sbom-vulnerability-gate | ARCH |
| `cfo-operating-review` | runtime-cost-observer, capacity-forecast | MATH |
| `ciso-board-brief` | security-hardener, secret-scanner, threat-model-updater | SENTINEL |
| `regulatory-readiness` | compliance-evidence-packager, constitutional-policy-linter | LEX |
| `board-value-creation` | deep-research, change-impact-estimator | ATHENA |
| `vendor-sovereignty-audit` | attack-surface-mapper, compliance-evidence-packager | PROOF |

### 4.3 Report Quality Gates

Before delivery, all reports must pass:
1. **Completeness check:** Every template section has content
2. **Source attribution:** All data points reference their source skill
3. **Staleness check:** Data is from within the configured freshness window
4. **Constitutional alignment:** Report does not contradict V6 Constitution principles

---

## 5. Fallback Behavior

**Cardinal rule:** Intent is NEVER silently dropped.

### 5.1 Fallback Cascade

```
┌─────────────────────────────────────────────────────────┐
│                   NO DIRECT MATCH                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ LEVEL 1: FUZZY      │
              │ Semantic similarity │
              │ on skill summaries  │
              │ (threshold: 0.6)    │
              └──────────┬──────────┘
                         │
                  ┌──────┴──────┐
                  │  Match?     │
                  └──────┬──────┘
                   yes ╱   ╲ no
                      ╱     ╲
                     ▼       ▼
          ┌────────────┐  ┌─────────────────────┐
          │ Route to   │  │ LEVEL 2: WORKFLOW   │
          │ matched    │  │ Check if intent     │
          │ skill with │  │ maps to a workflow  │
          │ confidence │  │ by workflow summary │
          │ warning    │  └──────────┬──────────┘
          └────────────┘             │
                              ┌──────┴──────┐
                              │  Match?     │
                              └──────┬──────┘
                               yes ╱   ╲ no
                                  ╱     ╲
                                 ▼       ▼
                      ┌────────────┐  ┌─────────────────────┐
                      │ Route to   │  │ LEVEL 3: AGENT      │
                      │ workflow   │  │ Route to domain      │
                      └────────────┘  │ agent by hive        │
                                      └──────────┬──────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │  Agent      │
                                           │  accepts?   │
                                           └──────┬──────┘
                                            yes ╱   ╲ no
                                               ╱     ╲
                                              ▼       ▼
                                   ┌────────────┐  ┌──────────────┐
                                   │ Agent      │  │ LEVEL 4:     │
                                   │ handles    │  │ ESCALATE     │
                                   │ request    │  │ to Operator  │
                                   └────────────┘  └──────────────┘
```

### 5.2 Escalation Protocol

When all fallback levels are exhausted:

1. **Log the unroutable intent** to `runtime/logs/unroutable-intents.jsonl`
2. **Notify the operator** with:
   - Original user text
   - Attempted matches and their scores
   - Suggested new skill or trigger to register
3. **Respond to user** with:
   - Honest acknowledgment: "I don't have a specific skill for that yet"
   - Nearest capability: "The closest thing I can do is [X]"
   - Offer to create: "Want me to scaffold a new skill for this?"

### 5.3 Anti-Patterns (FORBIDDEN)

- ❌ Silently ignoring an intent and responding with generic text
- ❌ Hallucinating a skill that doesn't exist in the registry
- ❌ Routing to a skill that is `status: "inactive"` or `agentCallable: false`
- ❌ Executing a sovereign-tier report template without confirming tier access
- ❌ Skipping the workflow check and running skills individually when a workflow exists

---

## 6. Canonical Files Referenced

| File | Purpose | Read Frequency |
|---|---|---|
| `runtime/registry/skills.canonical.json` | Skill discovery, trigger matching, domain filtering | Every intent resolution |
| `runtime/registry/workflows.canonical.json` | Workflow composition check | Every intent resolution |
| `runtime/registry/strategic-report-templates.registry.json` | Report template selection | On report/audit/analyze intents |
| `runtime/registry/agents.canonical.json` | Agent dispatch, lead agent resolution | Every intent resolution |
| `docs/ROUTING_CONTRACT.md` | General routing governance | Reference only |
| `docs/GOVERNANCE_PRECEDENCE.md` | Precedence hierarchy | Reference only |

### 6.1 Registry Surface Summary

As of v6.1:
- **83 skills** registered (81 agent-callable, 2 non-callable)
- **10 report templates** across 3 tier levels (1 free, 5 pro, 4 sovereign)
- **7 workflows** (5 ops, 2 evaluation)
- **78 agents** (58 core, 5 platform, 5 LoRA layers)

---

## 7. Validation Rules

### 7.1 Routing Correctness Tests

| Test ID | Description | Pass Criteria |
|---|---|---|
| `IR-001` | Exact skill name routes correctly | "Run incident-commander" → `incident-commander` skill |
| `IR-002` | Alias routing works | "Run the security scanner" → `secret-scanner` or `attack-surface-mapper` |
| `IR-003` | Report intent selects template | "CISO board brief" → `ciso-board-brief` template |
| `IR-004` | Compound intent decomposes | "Audit security and brief the board" → audit + report |
| `IR-005` | Workflow detected when skills chain | "Full incident response" → `incident-response` workflow |
| `IR-006` | Fallback fires on unknown intent | "Bake me a cake" → escalation, not hallucination |
| `IR-007` | Inactive skills are excluded | Skill with `status: inactive` never matches |
| `IR-008` | Non-callable skills are excluded | `chrome-agent` (`agentCallable: false`) never auto-routes |
| `IR-009` | Domain filter narrows candidates | "Security audit" does not route to `design-system-sync` |
| `IR-010` | Template tier is respected | Free-tier user cannot auto-route to `ciso-board-brief` |

### 7.2 Routing Telemetry

Every intent resolution MUST emit a telemetry event:

```json
{
  "event": "intent.routed",
  "timestamp": "2026-05-22T10:00:00Z",
  "input": "Give me a CISO board brief",
  "category": "report",
  "matched_skills": ["security-hardener", "secret-scanner"],
  "matched_template": "ciso-board-brief",
  "matched_workflow": null,
  "lead_agents": ["SENTINEL"],
  "confidence": 0.95,
  "fallback_level": 0,
  "resolution_ms": 12
}
```

### 7.3 Continuous Improvement Loop

1. **Weekly:** Review `unroutable-intents.jsonl` for patterns
2. **On pattern detection:** Propose new triggers or skills via `DESIGN_HOLD_QUEUE.json`
3. **On skill creation:** Re-run validation suite `IR-001` through `IR-010`
4. **Monthly:** Audit routing telemetry for accuracy drift

---

## 8. Concrete Example: End-to-End Routing

### User says: "Give me a report on our security posture"

```
STEP 1 — EXTRACT
  category:  report
  keywords:  [report, security, posture]
  domain:    security
  entities:  []

STEP 2 — MATCH SKILLS
  Candidate 1: attack-surface-mapper    (keyword: "security")     score: 60
  Candidate 2: security-hardener        (keyword: "security")     score: 60
  Candidate 3: authz-policy-verifier    (keyword: "security")     score: 40
  Candidate 4: secret-scanner           (keyword: "security")     score: 40
  Candidate 5: sbom-vulnerability-gate  (keyword: "security")     score: 40

STEP 3 — FILTER
  Domain filter (security): All 5 pass
  Output filter (report):   attack-surface-mapper, security-hardener preferred

STEP 4 — DISAMBIGUATE
  attack-surface-mapper:  score 60 (broad security posture analysis)
  security-hardener:      score 60 (hardening recommendations)
  → Both selected (compound execution)

STEP 5 — TEMPLATE CROSS-REFERENCE
  category = report, domain = security
  Match: ciso-board-brief (keywords: security + board)
  Match: big4-risk-controls (keywords: risk + controls)
  → "posture" is more CISO-style → auto-select: ciso-board-brief
  Sections: [Threat model, Exposure score, Control status, Board actions]

STEP 6 — RESOLVE AGENTS
  domain = security → SENTINEL (primary), VAULT (data)
  assembly agent: SCRIBE

STEP 7 — WORKFLOW CHECK
  No workflow chains attack-surface-mapper + security-hardener
  → Execute individually, assemble via template

EXECUTE
  1. SENTINEL runs attack-surface-mapper → threat model data
  2. SENTINEL runs security-hardener → control status data
  3. SCRIBE assembles ciso-board-brief with collected data
  4. Deliver to user as artifact
```

---

## 9. Schema Evolution

When the skills registry is enriched with `triggers[]`, `domain`, and `outputTypes[]` fields:

1. This contract's Step 2 matching becomes deterministic (no fuzzy fallback needed)
2. Step 3 filtering becomes a simple field comparison
3. Step 4 disambiguation becomes rare (triggers are specific)

**Target schema additions for `skills.canonical.json` entries:**
```json
{
  "skillId": "attack-surface-mapper",
  "triggers": ["map attack surface", "security posture", "exposure analysis"],
  "domain": "security",
  "outputTypes": ["report", "json", "markdown"],
  "leadAgents": ["SENTINEL"],
  "composableWith": ["security-hardener", "threat-model-updater"]
}
```

Until enrichment is complete, the router MUST use the fuzzy-match algorithm defined in §3.2 Step 2.

---

## 10. Constitutional Alignment

This contract enforces:
- **Article IX** — No incomplete routing. Every intent resolves to action or acknowledged gap.
- **Article XX** — No human wait time in routing. Resolution target: <50ms.
- **Anti-scatter** — One canonical routing path per intent. No parallel competing routers.
- **Sovereignty** — All routing logic runs on sovereign infrastructure. No external API calls for intent classification.

---

*End of Intent Routing Contract.*
