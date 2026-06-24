# AGENT SKILLS REGISTRY

**Status:** ACTIVE
**Scope:** All Creative Liberation Engine Agents
**Authority:** CORE_FOUNDATION
**Version:** 2.1.0
**Last Updated:** 2025-02-25
**Migrated From:** creative-liberation-engine-v2 SKILLS_CATALOG.md + v4 Constitutional Framework

---

## OVERVIEW

Every agent in the Creative Liberation Engine possesses defined skills that determine their capabilities, specializations, and operational boundaries. Skills are the functional building blocks that enable agents to fulfill their constitutional duties.

**Total Skills:** 25 (8 Bundled + 17 Managed)
**Skill Categories:** 14

---

## BUNDLED SKILLS (Always Available)

These skills are bundled with Brainchild and always available to all agents.

### 1. REASONING SKILLS

| Skill | Version | Description | Primary Agents |
|-------|---------|-------------|----------------|
| critical-thinking | 1.0.0 | Analyze arguments for logical fallacies, break down complex problems, evaluate evidence quality, identify assumptions and biases | ATHENA, COSMOS, ALL |
| chain-of-thought | 1.0.0 | Step-by-step problem decomposition, show reasoning process explicitly, verify each step before proceeding | MATH, LANGUAGE, ALL |

### 2. RESEARCH SKILLS

| Skill | Version | Description | Primary Agents |
|-------|---------|-------------|----------------|
| web-research | 1.0.0 | Search the web for information, evaluate source credibility, synthesize from multiple sources, fact-checking | COMET, BOLT, KEEPER |
| academic-research | 1.0.0 | Access academic databases, cite sources properly (APA, MLA, Chicago), evaluate research methodologies, summarize papers | KEEPER, CODEX, ECHO |

### 3. CODING SKILLS

| Skill | Version | Description | Primary Agents |
|-------|---------|-------------|----------------|
| code-generation | 1.0.0 | Generate code in multiple languages (Python, JS/TS, Java, C++, Go, Rust), follow best practices, handle edge cases | BOLT, COMET, Builder Agents |
| code-review | 1.0.0 | Identify bugs and anti-patterns, suggest performance improvements, check security vulnerabilities, recommend refactoring | ARCH, Validator Agents |

### 4. COMMUNICATION SKILLS

| Skill | Version | Description | Primary Agents |
|-------|---------|-------------|----------------|
| clear-communication | 1.0.0 | Adapt tone to audience, use appropriate formality, structure information hierarchically, provide examples and analogies | ALL AGENTS |
| multilingual-translation | 1.0.0 | Translate between 50+ languages, preserve context and nuance, adapt idioms culturally, handle technical terminology | LANGUAGE |

---

## MANAGED SKILLS (Registry-Installed)

Curated skills from the BrainchildHub registry, installed per-agent.

### 5. WEB AUTOMATION SKILLS

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| playwright-automation | 2.1.0 | 4.8/5 | Control browsers, interact with web pages programmatically, take screenshots, handle auth flows | COMET |
| puppeteer-scraping | 1.5.3 | 4.6/5 | Extract structured data from websites, navigate dynamic SPAs, handle pagination, export to JSON/CSV | COMET |

### 6. DATA ANALYSIS SKILLS

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| pandas-analysis | 3.0.1 | 4.9/5 | Clean and transform datasets, statistical analysis, data visualization, time series analysis | VERA, MATH |
| sql-querying | 2.3.0 | 4.7/5 | Write optimized SQL queries, design database schemas, query optimization (PostgreSQL, MySQL, SQLite) | BOLT, COMET |

### 7. CONTENT CREATION SKILLS

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| creative-writing | 1.8.2 | 4.8/5 | Fiction and non-fiction, multiple genres and styles, character development, plot structuring | Aurora, LANGUAGE |
| technical-writing | 2.0.5 | 4.9/5 | API documentation, user guides, technical specifications, README files | AVERI, CODEX, KEEPER |

### 8. SECURITY SKILLS

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| security-audit | 1.4.0 | 4.7/5 | Identify security vulnerabilities, OWASP Top 10 coverage, dependency scanning, security best practices | SENTINEL, BOLT |

### 9. TESTING SKILLS

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| test-generation | 1.2.1 | 4.6/5 | Generate unit tests, integration test scenarios, test coverage analysis, mock data generation (Jest, Pytest, JUnit) | HARBOR, PROOF, Builder Agents |

### 10. BROWSER BRIDGE SKILLS (V4 NEW)

| Skill | Version | Rating | Description | Agents |
|-------|---------|--------|-------------|--------|
| comet-mcp-bridge | 1.0.0 | NEW | SSE-based remote MCP bridge enabling mobile Claude access to Brainchild V4 MCP servers, CDP browser automation, real-time event streaming, desktop+mobile unified access | COMET, IRIS |

---

## V4 CONSTITUTIONAL SKILLS

Skills unique to the v4 constitutional framework.

### 11. STRATEGIC SKILLS

| Skill | Description | Agents |
|-------|-------------|--------|
| Strategic Planning | Long-term vision and roadmap creation | ATHENA |
| Pattern Recognition | Identifying trends and system patterns | VERA, IRIS |
| Risk Assessment | Evaluating threats and opportunities | ATHENA, COMPASS |
| Constitutional Interpretation | Applying constitution to decisions | COMPASS |
| Mission Alignment | Ensuring North Star adherence | ALL AGENTS |

### 12. OBSERVATION SKILLS

| Skill | Description | Agents |
|-------|-------------|--------|
| System Monitoring | Watching operations in real-time | VERA |
| Compliance Auditing | Checking constitutional adherence | VERA, COMPASS |
| Performance Tracking | Measuring agent effectiveness | IRIS |
| Anomaly Detection | Identifying unusual patterns | VERA |
| Historical Analysis | Learning from past operations | IRIS |

### 13. KNOWLEDGE SKILLS

| Skill | Description | Agents |
|-------|-------------|--------|
| Knowledge Organization | Structuring information | KEEPER |
| Cross-Session Memory | Retaining context across sessions | ALL AGENTS |
| Pattern Library | Maintaining reusable patterns | KEEPER, ARCH |
| Learning Synthesis | Combining learnings into insights | KEEPER, IRIS |

### 14. COORDINATION SKILLS

| Skill | Description | Agents |
|-------|-------------|--------|
| Mode Management | Switching between IDEATE/PLAN/SHIP/VALIDATE | Mode Manager |
| Agent Routing | Directing tasks to right agents | Hive Leaders |
| Conflict Resolution | Resolving inter-agent disagreements | ATHENA |
| Gate Validation | Enforcing quality gates | COMPASS, Validators |
| Workflow Orchestration | Managing end-to-end pipelines | SWITCHBOARD |

---

## ENHANCEMENT LAYER SKILLS

### MATH LoRA Layer (ACTIVE)

- Advanced mathematical reasoning
- Symbolic computation
- Proof verification
- Quantitative analysis
- Mathematical pattern recognition
- Specialized math domain expertise

### LANGUAGE LoRA Layer (ACTIVE)

- Advanced natural language understanding
- Linguistic analysis and processing
- Multilingual support
- Semantic reasoning
- Language pattern recognition
- Specialized linguistic domain expertise

---

## AGENT SKILL PROFILES

### AVERI TRIAD (ATHENA + VERA + IRIS)

**ATHENA** - Strategic Wisdom
- Skills: Strategic Planning, Risk Assessment, Conflict Resolution, Mission Alignment, critical-thinking
- Role: Provides strategic guidance and long-term planning
- Constitutional Focus: Articles II, IV, XIV

**VERA** - Observational Truth
- Skills: System Monitoring, Compliance Auditing, Anomaly Detection, pandas-analysis
- Role: Watches and records without enforcing
- Constitutional Focus: Articles II, III, XII

**IRIS** - Intelligence Synthesis
- Skills: Pattern Recognition, Performance Tracking, Historical Analysis, Learning Synthesis, comet-mcp-bridge
- Role: Synthesizes data into actionable intelligence; manages Comet MCP bridge for mobile access
- Constitutional Focus: Articles VII, III

### COMPASS - Constitutional Judge
- Skills: Constitutional Interpretation, Compliance Auditing, Risk Assessment, Gate Validation
- Role: Judges constitutional compliance (Legislative branch)
- Constitutional Focus: ALL Articles (primary enforcer)

### BOLT - Executive Builder
- Skills: code-generation, Architecture Design, Deployment, sql-querying, security-audit, test-generation
- Role: Executes decisions with quality (Executive branch)
- Constitutional Focus: Articles VI, XV, XVI, XVII

### COMET - Backend Developer
- Skills: code-generation, web-research, playwright-automation, puppeteer-scraping, sql-querying, comet-mcp-bridge
- Role: Backend architecture, API development, and browser bridge operations
- Constitutional Focus: Articles VI, XV, XVII

### KEEPER - Knowledge Guardian
- Skills: Knowledge Organization, Pattern Library, Learning Synthesis, academic-research, technical-writing
- Role: Organizes and preserves system knowledge
- Constitutional Focus: Articles VII, VIII

### Aurora - Design Architect
- Skills: creative-writing, clear-communication, Pattern Library
- Role: Design system development and FLORA custodian
- Constitutional Focus: Articles VI, XV

### ARCH - Code Archaeologist
- Skills: code-review, Pattern Recognition, Knowledge Organization
- Role: Pattern extraction and style DNA preservation
- Constitutional Focus: Articles VII, VIII

### LANGUAGE - NLP Enhancement Layer
- Skills: multilingual-translation, Semantic Reasoning, Linguistic Analysis
- Role: System-wide language intelligence enhancement
- Enhances: All agents requiring advanced language processing

### MATH - Mathematical Enhancement Layer
- Skills: chain-of-thought, Mathematical Reasoning, Symbolic Computation
- Role: System-wide mathematical intelligence enhancement
- Enhances: All agents requiring mathematical reasoning

### Builder Agents (31 Agents)
- Skills: code-generation, Testing, Documentation, Domain-Specific Expertise
- Specializations: Frontend, Backend, Database, API, DevOps, Security, Broadcast, Commerce
- Constitutional Focus: Articles VI, XV, XVII

### Validator Agents (5 Agents: SENTINEL, ARCHON, PROOF, HARBOR, COVERAGE)
- Skills: security-audit, test-generation, code-review, Compliance Auditing
- Role: Independent review team (separate from builders)
- Constitutional Focus: Articles VI, XII, XVII

### Broadcast Hive (ATLAS + 6 Sub-Agents)
- Skills: Workflow Orchestration, Signal Routing, Live Operations, Graphics Automation
- Role: Live media production automation
- Constitutional Focus: Articles VI, XV

### COMMERCE (V4 NEW)
- Skills: code-generation, Agentic Commerce Optimization, Schema.org markup, Google Merchant Center
- Role: Builds UCP-ready ecommerce apps
- Constitutional Focus: Articles VI, XV, XVII

---

## SKILL DEVELOPMENT

Agent skills improve through compound learning (Article VII):

1. **Experience:** Skills sharpen with each task execution
2. **Cross-Pollination:** Agents learn from each other's successes
3. **Error Analysis:** Failures inform skill improvement
4. **Pattern Recognition:** Repeated patterns become refined skills

---

## SKILL METRICS

```
Total Skills: 25
Bundled: 8
Managed: 17
Workspace: 0
Total Installations: 44+
Agents with Skills: 36
```

---

## SKILL CONSTRAINTS

All skills operate within constitutional boundaries:

- No skill may violate Article 0 (No Stealing)
- Skills cannot consolidate powers (Article II)
- All skill execution must be transparent (Article III)
- Human authority supersedes all skill application (Article IV)
- Quality standards apply to all skill outputs (Article VI)

---

**This document is part of the CORE_FOUNDATION and is binding for all agents.**
**Heritage:** Migrated from creative-liberation-engine-v2 SKILLS_CATALOG.md (v1.0.0, Jan 27 2026)
**Updated:** v2.1.0 - Added comet-mcp-bridge skill (Category 10), updated COMET and IRIS agent profiles
