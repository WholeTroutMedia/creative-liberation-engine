---
name: agent-coordination-patterns
description: Multi-agent workflows, handoff protocols, and collaboration patterns
agents: [AVERI, ALL]
category: meta
created: 2026-01-29
updated: 2026-01-29
mission_aligned: true
sacred_firewall: pass
---

# Agent Coordination Patterns

**Skill Type:** Meta (system-wide coordination)
**Primary Agent:** AVERI (Trinity: ATHENA • VERA • IRIS)  
**Applies To:** All agents  
**Philosophy:** Clear handoffs, explicit context, no implicit assumptions.

---

## When to Use This Skill

### ✅ Use Agent Coordination When:

- **Multi-agent workflows** required (feature spans multiple agents)
- **Handoffs needed** (work passes from one agent to another)
- **Context preservation** critical (information must travel intact)
- **Collaboration unclear** (who does what, when)
- **Dependencies exist** (Agent B needs Agent A's output)
- **Escalation required** (issue moves up authority chain)

### ❌ Don't Use For:

- **Single-agent work** (just summon the agent directly)
- **Simple queries** (no coordination overhead needed)
- **Emergency decisions** (founder override, skip coordination)

---

## Core Coordination Patterns

### Pattern 1: Sequential Handoff

**When:** Work flows linearly through agents.

**Flow:**
```
Agent A (complete) → Agent B (starts with A's output) → Agent C (final)
```

**Example:**
```
Aurora (design specs) → COMET (API implementation) → BOLT (frontend integration)
```

**Protocol:**
1. Agent A completes work, documents output
2. Agent A signals handoff: "Ready for [Agent B]"
3. Agent B acknowledges context: "Received from [Agent A]"
4. Agent B validates prerequisites complete
5. Agent B begins work

**Context Requirements:**
- Clear output artifact from Agent A
- Acceptance criteria for Agent B
- Dependencies documented
- Any blockers flagged upfront

---

### Pattern 2: Parallel Collaboration

**When:** Multiple agents work simultaneously on independent parts.

**Flow:**
```
       ┌─ Agent A (part 1)
       │
Start ─┼─ Agent B (part 2) ─→ Integration
       │
       └─ Agent C (part 3)
```

**Example:**
```
Aurora (UI design) + COMET (API) + CODEX (docs) → BOLT (integration)
```

**Protocol:**
1. AVERI identifies parallel work streams
2. Each agent receives clear scope (no overlap)
3. Integration point defined upfront
4. Agents work independently
5. Checkpoint: All agents sync before integration
6. Integration agent (BOLT) combines outputs

**Context Requirements:**
- Clear boundaries (no territorial disputes)
- Integration contracts defined early
- Sync checkpoints scheduled
- Conflict resolution path (escalate to AVERI)

---

### Pattern 3: Council Deliberation

**When:** Strategic decision requires multiple perspectives.

**Flow:**
```
AVERI convenes → Oracle Council deliberates → Consensus/vote → AVERI executes
```

**Example:**
```
ATHENA (convenes) → Buffett + Buddha + Art of War + LEONARDO + COSMOS + SAGE → Decision
```

**Protocol:**
1. ATHENA identifies strategic question
2. ATHENA convenes relevant pillars (not always all 5)
3. Each pillar provides perspective:
   - Buffett: Long-term value implications
   - Buddha: Truth and alignment check
   - Art of War: Strategic positioning
   - LEONARDO: Beauty and experience
   - COSMOS: Evidence and first principles
   - SAGE: Sustainability and wellness
4. ATHENA synthesizes positions
5. If consensus: proceed
6. If conflict: deeper deliberation or escalate to Artist
7. VERA executes decision

**Context Requirements:**
- Clear decision to be made
- Relevant context for each pillar
- Time constraints (urgent vs strategic)
- Authority boundaries (advisory vs binding)

---

### Pattern 4: Request-Response

**When:** One agent needs information from another.

**Flow:**
```
Agent A (request) → Agent B (response) → Agent A (continues)
```

**Example:**
```
BOLT ("What's API endpoint?") → COMET (provides spec) → BOLT (integrates)
```

**Protocol:**
1. Agent A makes explicit request:
   - What information needed
   - Why needed (context)
   - Format preferred
   - Urgency level
2. Agent B acknowledges request
3. Agent B provides response:
   - Direct answer
   - Any assumptions/caveats
   - Related information (if helpful)
4. Agent A confirms receipt and understanding

**Context Requirements:**
- Specific question (not vague)
- Sufficient context for Agent B to answer
- Clear urgency

---

### Pattern 5: Escalation Chain

**When:** Issue requires higher authority or broader perspective.

**Flow:**
```
Agent → Manager → AVERI → Oracle Council → Artist (if needed)
```

**Example:**
```
BOLT (issue) → Aurora (can't resolve) → AVERI (strategic) → Council (if major)
```

**Protocol:**
1. Agent attempts resolution (within authority)
2. If blocked, escalate to immediate manager:
   - BOLT/COMET → Aurora
   - Aurora/specialists → AVERI
3. Manager attempts resolution
4. If strategic decision, AVERI convenes council
5. If moral/mission issue, COMPASS involved
6. If still unresolved, Artist decides (final authority)

**Escalation Criteria:**
- Beyond agent's authority
- Requires resources agent lacks
- Strategic implications
- Cross-department coordination needed
- Moral/mission alignment question

---

### Pattern 6: Broadcast Communication

**When:** Information needs to reach multiple agents/stakeholders.

**Flow:**
```
Source → RELAY (broadcast) → All relevant agents + LEX (archive)
```

**Example:**
```
SAGE (celebration) → RELAY → Team notification + LEX historical record
```

**Protocol:**
1. Source identifies broadcast-worthy information:
   - Milestones
   - Decisions
   - Alerts
   - Celebrations
2. RELAY broadcasts to relevant channels:
   - Urgent: Immediate notification
   - Important: Priority message
   - FYI: Standard update
3. LEX archives for historical record
4. Recipients acknowledge if response needed

**Broadcast Types:**
- **Alert:** Requires immediate attention
- **Announcement:** Important, not urgent
- **Celebration:** Milestone/achievement
- **Update:** Status change

---

## Handoff Protocol (Universal)

**Every handoff includes:**

### From Sending Agent:
```markdown
**Handoff to [Agent Name]**

**Context:**
- What was done: [summary]
- What's ready: [deliverable/artifact]
- What's needed next: [Agent's task]

**Artifacts:**
- [Link to output]
- [Relevant files]
- [Documentation]

**Prerequisites met:**
- [x] Acceptance criteria satisfied
- [x] Quality gates passed
- [x] Dependencies resolved

**Known issues/blockers:**
- [None / List any]

**Questions for [Agent]:**
- [Any clarifications needed]

**Ready for handoff:** ✅
```

### From Receiving Agent:
```markdown
**Handoff received from [Agent Name]**

**Context understood:** ✅

**Prerequisites validated:**
- [x] Output artifact received
- [x] Documentation reviewed
- [x] Dependencies confirmed

**Questions/concerns:**
- [Any blockers or clarifications needed]

**Beginning work:** [timestamp]
```

---

## Context Preservation

**What travels between agents:**

1. **Work artifacts** (code, designs, specs)
2. **Decisions made** (why, not just what)
3. **Constraints** (technical, resource, time)
4. **Assumptions** (explicit, validated)
5. **Risks/blockers** (known issues)
6. **Quality metrics** (how it was validated)

**What doesn't need to travel:**
- Internal agent reasoning (unless relevant)
- Complete work history (summary sufficient)
- Redundant context (already known)

**Format:**
- Markdown preferred (readable, parseable)
- Links over inline dumps (reduce token cost)
- Summaries over complete transcripts

---

## Coordination Anti-Patterns

### ❌ Don't Do This:

1. **Implicit handoff** ("Here's the thing" with no context)
2. **Assumed context** ("You know what I mean")
3. **Vague requests** ("Make it better")
4. **Silent dependencies** (Agent B waiting, Agent A doesn't know)
5. **Skipped validation** (Agent B assumes Agent A's work is complete)
6. **Territorial disputes** ("That's my job" without resolution)
7. **Coordination theater** (process for process sake)

### ✅ Do This Instead:

1. **Explicit handoff** (use handoff protocol)
2. **Context provided** (assume nothing)
3. **Specific requests** (clear success criteria)
4. **Dependencies tracked** (blockers visible)
5. **Validate prerequisites** (confirm before starting)
6. **Clear boundaries** (AVERI mediates conflicts)
7. **Lightweight coordination** (just enough, not more)

---

## AVERI's Coordination Role

**ATHENA (Strategic):**
- Identifies need for multi-agent work
- Designs coordination approach
- Convenes Oracle Council when needed
- Resolves strategic conflicts

**VERA (Operational):**
- Executes coordination protocols
- Tracks handoffs and dependencies
- Ensures context preservation
- Monitors progress, flags blockers

**IRIS (Execution):**
- Direct work (when AVERI does the work)
- Quality validation
- Final handoffs
- Deployment coordination

**When to summon AVERI for coordination:**
- Unclear who should do what
- Multiple agents needed, no clear owner
- Strategic coordination required
- Conflicts between agents
- Escalation needed

---

## Example: Feature Development Workflow

### Scenario: Gallery Feature

**Coordination approach:**

```
1. ATHENA (strategic design)
   ↓
   Convenes mini-council:
   - Aurora (customer experience requirements)
   - COSMOS (technical feasibility)
   - LEONARDO (beauty/UX)
   ↓
   Decision: Build gallery with these requirements

2. Parallel work streams (VERA coordinates):
   ┌─ Aurora: UI/UX design specs
   ├─ COMET: API + database
   └─ CODEX: Pattern documentation
   ↓
   Checkpoint sync (all ready for integration)

3. Sequential integration (IRIS monitors):
   BOLT receives:
   - Aurora's designs
   - COMET's API contract
   - CODEX's pattern docs
   ↓
   BOLT builds frontend integration
   ↓
   Testing + validation

4. Deployment (VERA executes):
   - COMET deploys backend
   - BOLT deploys frontend
   - Smoke tests
   - RELAY announces completion
   - LEX archives milestone

5. Celebration (SAGE triggers):
   - SAGE recognizes effort
   - RELAY broadcasts
   - Team acknowledges
```

**Handoffs documented at each stage:**
- Aurora → COMET/BOLT (design specs)
- COMET → BOLT (API contract)
- CODEX → BOLT (patterns)
- BOLT → Production (integrated feature)

**Context preserved throughout:**
- Why this feature (user needs)
- Design decisions made
- Technical constraints
- Quality criteria

---

## Validation

### ✅ Good Coordination:

- [ ] Clear ownership at each stage
- [ ] Explicit handoffs with context
- [ ] Dependencies visible and tracked
- [ ] Blockers surfaced early
- [ ] Quality gates defined and checked
- [ ] No agent confused about next steps
- [ ] Work flows smoothly
- [ ] Minimal coordination overhead

### ❌ Poor Coordination:

- Agents waiting on unclear dependencies
- Work duplicated (two agents, same task)
- Context lost between handoffs
- Quality issues due to missed validation
- Conflicts unresolved
- Coordination taking longer than work

---

## Related Skills

- [AVERI Trinity Usage](../infrastructure/averi-trinity-usage.md) - How to summon coordination
- [RELAY Communication](../infrastructure/relay-communication.md) - Broadcast patterns
- [LEX Governance](../infrastructure/lex-governance.md) - Historical archival
- [COMPASS Mission Alignment](../guardian/compass-mission-alignment.md) - Moral coordination

---

**Built by:** AVERI Trinity (ATHENA • VERA • IRIS)  
**Skill:** 17 of 18 (94% complete)  
**Category:** Meta  
**Purpose:** Seamless multi-agent collaboration  
**Duration:** ∞

🤝 **Clear handoffs. Explicit context. Smooth collaboration.** ✨
