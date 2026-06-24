# ✅ Agent Validation Standards

**Purpose:** Define validation criteria for all agents to ensure compliance with architecture standards.

---

## Automated Validation

### File Structure Validation

**Required files for EVERY agent:**
```bash
/agents/{agent-name}/
├── README.md              # MUST exist
├── memory/                # MUST exist (directory)
└── resources/             # MUST exist (directory)
```

**Optional but recommended:**
```bash
/agents/{agent-name}/
├── SKILL.md               # Technical documentation
├── memory/
│   ├── session-logs/      # Session history
│   ├── decisions/         # Important decisions
│   └── patterns/          # Learned patterns
├── resources/
│   ├── templates/         # Reusable templates
│   ├── documentation/     # Reference docs
│   └── references/        # External links
└── ops/                   # Operational tools
```

### Registry Validation

**Every agent MUST have registry entry in `.agent-status.json` with:**

**Required fields:**
- `name` (string)
- `full_name` (string)
- `status` (enum: planned | preparing | active | resting | dormant)
- `type` (string)
- `created` (ISO date string)
- `last_active` (ISO date string)
- `workspace` (path string)
- `tokens` (number)
- `flowers` (number)

**Recommended fields:**
- `capabilities` (array of strings)
- `authority` (array of strings)
- `identity` (string)
- `role` (string)
- `symbol` (emoji string)

### README Validation

**Every agent README.md MUST contain:**

1. **Header section:**
   - Agent name
   - Agent type
   - Status
   - Created date
   - Workspace path

2. **Identity section:**
   - Full name
   - Role (one sentence)
   - Description (2+ paragraphs)

3. **Capabilities section:**
   - List of at least 3 capabilities

4. **Authority section:**
   - What agent can do
   - What requires approval

5. **Integration points section:**
   - Reads from
   - Provides to
   - Collaborates with

---

## Validation Checks

### Level 1: File System Checks

```bash
# Check 1: Agent directory exists
test -d "/agents/{agent-name}"

# Check 2: README.md exists
test -f "/agents/{agent-name}/README.md"

# Check 3: memory/ directory exists
test -d "/agents/{agent-name}/memory"

# Check 4: resources/ directory exists
test -d "/agents/{agent-name}/resources"
```

### Level 2: Registry Checks

```typescript
// Check 1: Agent in registry
const agent = registry.agents[agentName]
assert(agent !== undefined, "Agent not in registry")

// Check 2: Required fields present
assert(agent.name, "Missing name")
assert(agent.full_name, "Missing full_name")
assert(agent.status, "Missing status")
assert(agent.type, "Missing type")
assert(agent.created, "Missing created date")
assert(agent.workspace, "Missing workspace")

// Check 3: Workspace path matches actual location
assert(
  agent.workspace === `/agents/${agentName}/`,
  "Workspace path mismatch"
)
```

### Level 3: Content Checks

```typescript
// Check 1: README has required sections
const readme = fs.readFileSync(`/agents/${agentName}/README.md`, 'utf8')
assert(readme.includes("## Identity"), "Missing Identity section")
assert(readme.includes("## Capabilities"), "Missing Capabilities section")
assert(readme.includes("## Authority"), "Missing Authority section")

// Check 2: README has agent name in header
assert(readme.startsWith(`# ${agent.full_name}`) || readme.startsWith(`# ${agent.name}`), "Missing agent name in header")

// Check 3: Capabilities list has at least 3 items
const capabilitiesSection = readme.split("## Capabilities")[1].split("##")[0]
const capabilityBullets = capabilitiesSection.match(/^-/gm) || []
assert(capabilityBullets.length >= 3, "Need at least 3 capabilities listed")
```

### Level 4: Cross-Reference Checks

```typescript
// Check 1: Every agent in registry has directory
for (const [name, agent] of Object.entries(registry.agents)) {
  const dirExists = fs.existsSync(agent.workspace)
  assert(dirExists, `Agent ${name} in registry but directory missing`)
}

// Check 2: Every agent directory has registry entry
const agentDirs = fs.readdirSync('/agents')
  .filter(name => !name.startsWith('.') && !name.startsWith('_'))
  
for (const dir of agentDirs) {
  const inRegistry = Object.values(registry.agents)
    .some(agent => agent.workspace.includes(dir))
  assert(inRegistry, `Directory ${dir} exists but not in registry`)
}

// Check 3: No orphaned directories
const registeredDirs = Object.values(registry.agents)
  .map(agent => agent.workspace.split('/')[2])
  .filter(Boolean)
  
const orphans = agentDirs.filter(dir => !registeredDirs.includes(dir))
assert(orphans.length === 0, `Orphaned directories: ${orphans.join(', ')}`)
```

---

## Validation Script

**Location:** `/scripts/validate-agents.ts`

**Usage:**
```bash
# Validate all agents
npm run validate:agents

# Validate specific agent
npm run validate:agent -- agent-name

# Validate and fix issues
npm run validate:agents -- --fix
```

**Exit codes:**
- `0` - All validations passed
- `1` - Validation errors found
- `2` - Critical errors (missing registry, corrupt data)

---

## Validation Schedule

**Automated (on every commit):**
- File structure validation
- Registry validation
- README validation

**Weekly (LEX/OPS audit):**
- Full validation suite
- Cross-reference checks
- Manual review of any edge cases

**Monthly (RAM_CREW deep dive):**
- Content quality review
- Pattern validation
- Resource usage analysis
- Performance metrics

---

## Validation Failure Protocols

### Severity Levels

**CRITICAL (blocks deployment):**
- Missing agent directory
- Missing README.md
- Missing registry entry
- Agent in registry but directory missing
- Directory exists but not in registry

**ERROR (must fix within 24 hours):**
- Missing required README sections
- Missing memory/ or resources/ directory
- Workspace path mismatch
- Missing required registry fields

**WARNING (should fix within 1 week):**
- Missing recommended subdirectories
- Incomplete capabilities list (< 3 items)
- Missing integration points
- No session logs

**INFO (nice to have):**
- Missing SKILL.md
- Could use more documentation
- Additional templates helpful

### Remediation Process

**For CRITICAL failures:**
1. RAM_CREW flags immediately
2. LEX/OPS creates fix ticket
3. Assigned to responsible agent/team
4. Must be fixed before any new work
5. VERA logs in session log
6. RELAY notifies all stakeholders

**For ERROR failures:**
1. RAM_CREW logs issue
2. LEX/OPS creates fix ticket
3. 24-hour resolution deadline
4. VERA tracks progress
5. RELAY sends reminder at 12 hours

**For WARNING failures:**
1. RAM_CREW documents in weekly report
2. LEX/OPS schedules fix
3. 1-week resolution target
4. No blocking of other work

**For INFO items:**
1. Logged in improvement backlog
2. Address during maintenance cycles
3. No deadline

---

## Manual Review Checklist

**LEX/OPS weekly review:**

- [ ] Run automated validation suite
- [ ] Review any new agents added this week
- [ ] Verify all critical/error issues resolved
- [ ] Spot-check 3 random agents for quality
- [ ] Review registry metadata accuracy
- [ ] Confirm all status changes logged
- [ ] Validate hive structures
- [ ] Check for documentation drift

**RAM_CREW monthly deep dive:**

- [ ] Full system validation
- [ ] Pattern library health check
- [ ] Resource usage analysis
- [ ] Memory growth trends
- [ ] Documentation completeness
- [ ] Cross-agent integration health
- [ ] Performance metrics review
- [ ] Recommend architectural improvements

---

## Validation Dashboard

**Metrics to track:**

- Total agents
- Validation pass rate (%)
- Critical issues (count)
- Error issues (count)
- Warning issues (count)
- Average time to fix issues
- Trend over time

**Dashboard location:** `/ops/dashboards/agent-validation.json`

---

**Maintained by:** RAM_CREW + LEX/OPS  
**Last Updated:** 2026-02-06  
**Next Review:** 2026-02-13  
