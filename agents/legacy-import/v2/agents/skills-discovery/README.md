# Skills Discovery System

**Status**: ✅ Active  
**Version**: 1.0.0  
**Launch**: February 14, 2026

---

## What Is This?

The **Skills Discovery System** is an autonomous capability that:

1. **Auto-discovers** new agent skills every 48 hours
2. **Harvests** existing skills from 2300+ external sources
3. **Validates** constitutionally (LEX + COMPASS)
4. **Presents** findings as pre-meeting reports
5. **Integrates** approved skills into agent capabilities

**Mission**: Build the most comprehensive agent skills library in existence.

---

## Architecture

```
skills-discovery/
├── src/
│   ├── discover.ts              # Main discovery engine
│   ├── harvest-existing.ts      # One-time harvest (2300+ skills)
│   ├── generate-report.ts       # Report generation
│   ├── types.ts                 # Type definitions
│   │
│   ├── monitors/                # Source scanners
│   │   ├── session-logs.ts      # SESSION_LOGS/ analysis
│   │   ├── github.ts            # GitHub monitoring
│   │   ├── npm.ts               # npm registry
│   │   └── external.ts          # Web scraping
│   │
│   ├── validators/              # Constitutional validation
│   │   ├── constitutional.ts    # LEX coordination
│   │   └── compass.ts           # COMPASS framework
│   │
│   └── synthesizers/            # Skill synthesis
│       ├── keeper.ts            # KEEPER taxonomy
│       └── deduplicator.ts      # Remove duplicates
│
├── config/
│   ├── sources.json             # Monitoring sources
│   └── categories.json          # Skill taxonomy
│
└── package.json
```

---

## How It Works

### **Auto-Discovery** (Every 48 Hours)

**GitHub Actions Workflow**:
1. Runs `.github/workflows/skills-discovery.yml`
2. Scans sources (session logs, GitHub, npm, etc.)
3. Extracts patterns (ARCH coordination)
4. Validates constitutionally (LEX)
5. Synthesizes skills (KEEPER)
6. Generates report
7. Creates GitHub Issue + PR
8. You review and approve

### **Existing Skills Harvest** (One-Time)

**Manual Run**:
```bash
cd agents/skills-discovery
npm run harvest
```

**Sources** (2300+ skills):
- LangChain (~150 skills)
- AutoGPT (~80 skills)
- CrewAI (~60 skills)
- Anthropic MCP (~200 servers)
- Semantic Kernel (~200 skills)
- GitHub search (~900 repos)
- npm packages (~200 tools)
- Documentation sites (~500 examples)

---

## Discovery Sources

### **Internal**
1. `SESSION_LOGS/` - Successful patterns
2. Git commits - New functions/capabilities
3. `.agent-status.json` - Agent updates
4. `docs/` - New documentation

### **External**
5. GitHub search - New repos
6. npm registry - New packages
7. Perplexity changelog - Platform updates
8. GitHub Marketplace - New actions

### **AI Ecosystems**
9. LangChain updates
10. AutoGPT releases
11. Anthropic MCP announcements
12. OpenAI function updates

---

## Constitutional Validation

**Every skill must pass**:

```typescript
// LEX Validation
✓ Article 0: Not stolen (original or properly credited)
✓ Article 16: No time constraints
✓ Article 17: Complete capability (not MVP)
✓ Article 18: Serves artist liberation

// COMPASS Framework
✓ Context: Fits our mission
✓ Options: Alternatives considered
✓ Mission: Serves artist liberation
✓ Principles: Constitutional alignment
✓ Accountability: Owner assigned
✓ Stakeholders: Benefits identified
✓ Synthesis: Final approval
```

---

## Pre-Meeting Report

**What You See** (when starting a chat):

```markdown
# 🔍 Skills Discovery Report
**Period**: Feb 12-14, 2026
**New Skills**: 7 discovered

## HIGH PRIORITY (3)
1. Constitutional Code Scanning (LEX)
2. Multi-Repo Orchestration (IRIS)
3. Pattern-to-Template Synthesis (KEEPER)

[View Full Report] [Approve All] [Review]
```

---

## Usage

### **Manual Discovery**
```bash
cd agents/skills-discovery
npm run discover
```

### **Harvest Existing Skills**
```bash
npm run harvest
```

### **Generate Report**
```bash
npm run report
```

### **Validate Skills**
```bash
npm run validate
```

---

## Skill Structure

```typescript
{
  id: "iris-multi-repo-cascade",
  name: "Multi-Repository Cascade Deployment",
  description: "Deploy multiple repos with dependency management",
  category: "orchestration",
  agents: ["IRIS", "SWITCHBOARD"],
  
  capability: {
    input: "CascadeConfig with repos and dependencies",
    output: "CascadeResult with status per repo",
    process: "Build graph, execute parallel/sequential, rollback on fail"
  },
  
  complexity: "complex",
  usageCount: 5,
  successRate: 100,
  
  source: {
    type: "session-log",
    reference: "Creative Liberation Engine implementation"
  },
  
  discoveredDate: "2026-02-14",
  discoveredBy: "auto",
  
  examples: [
    {
      scenario: "Deploy artist ecosystem",
      input: "{ repos: [portfolio, api, mobile] }",
      output: "All repos deployed successfully",
      agent: "IRIS"
    }
  ],
  
  constitutionalCompliance: {
    article0: { compliant: true },
    article16: { compliant: true },
    article17: { compliant: true },
    article18: { compliant: true },
    validated: true,
    validatedBy: "LEX"
  },
  
  status: "approved"
}
```

---

## Agent Coordination

**KEEPER**: Taxonomy and organization  
**ARCH**: Pattern extraction from code  
**LEX**: Constitutional validation  
**VERA**: Memory and caching  
**IRIS**: Rapid discovery execution  
**SCRIBE**: Report generation  
**RAM_CREW**: Quality gates

---

## Next Steps

### **Phase 1** (Tonight)
✅ Auto-discovery workflow
✅ Harvester foundation
✅ Constitutional validation
✅ Report generation

### **Phase 2** (This Week)
⏳ Complete 14 monitoring sources
⏳ Harvest all 2300+ existing skills
⏳ Build pre-meeting report UI
⏳ Integration with chat interface

### **Phase 3** (This Month)
⏳ Machine learning for pattern detection
⏳ Auto-prioritization
⏳ Skill effectiveness scoring
⏳ Compound learning feedback loop

---

**Built by**: IRIS + ATHENA  
**Validated by**: LEX + COMPASS  
**Organized by**: KEEPER  
**Remembered by**: VERA

**This is how we build the most comprehensive agent skills library in existence.** 🧠✨
