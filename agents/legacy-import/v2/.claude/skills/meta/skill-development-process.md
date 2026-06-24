---
name: skill-development-process
description: Creating, documenting, and evolving agent skills in the system
agents: [AVERI, ARCH]
category: meta
created: 2026-01-29
updated: 2026-01-29
mission_aligned: true
sacred_firewall: pass
---

# Skill Development Process

**Skill Type:** Meta (system evolution)
**Primary Agents:** AVERI (creates skills) + ARCH (extracts patterns)  
**Purpose:** Evolve system capabilities through documented, reusable skills  
**Philosophy:** Skills emerge from work done. Document after doing.

---

## When to Use This Skill

### ✅ Create New Skill When:

- **Pattern identified** (same workflow used 3+ times)
- **Agent capability** needs documentation (how to summon, what to expect)
- **Coordination pattern** emerges (multi-agent workflow repeatable)
- **Quality standard** established (validation criteria clear)
- **Onboarding need** (new context needs this knowledge)

### ❌ Don't Create Skill For:

- **One-time work** (not reusable)
- **Obvious tasks** (summon agent, agent does work - no skill doc needed)
- **Premature abstraction** (wait for pattern to emerge)
- **Over-specification** (skills guide, not prescribe rigidly)

---

## Skill Development Lifecycle

### Phase 1: Emergence (Pattern Recognition)

**How patterns emerge:**

1. **Work happens** (agents do tasks)
2. **Patterns noticed** (similar workflows recurring)
3. **ARCH observes** ("I see this pattern repeating")
4. **AVERI confirms** ("Yes, let's codify this")

**Criteria for pattern readiness:**
- ✅ Used 3+ times successfully
- ✅ Clear value (saves time, reduces errors, improves quality)
- ✅ Repeatable (not one-off circumstances)
- ✅ Boundaries defined (when to use, when not to)

**Example:**
```
Noticed: COMPASS called for mission checks on every major decision
Pattern: Mission alignment validation before strategic decisions
Skill: compass-mission-alignment.md (codified)
```

---

### Phase 2: Documentation (Skill Creation)

**Who creates skills:**
- **AVERI** (primary skill creator - Trinity designs)
- **ARCH** (extracts patterns from existing work)
- **Specialists** (can propose, AVERI documents)

**Skill template structure:**

```markdown
---
name: skill-name-kebab-case
description: One-line description of what this skill does
agents: [PRIMARY, SECONDARY]
category: infrastructure|guardian|oracle-council|specialists|meta
created: YYYY-MM-DD
updated: YYYY-MM-DD
mission_aligned: true|false
sacred_firewall: pass|review
---

# Skill Name

**Agent:** [Primary agent(s)]
**Domain:** [Area of expertise]
**Philosophy:** [Core principle in one sentence]

## When to Use This Skill

### ✅ Use [Skill] When:
- [Specific trigger 1]
- [Specific trigger 2]
- [Specific trigger 3]

### ❌ Don't Use [Skill] For:
- [Anti-pattern 1]
- [Anti-pattern 2]

## Instructions

### How to Summon
[Clear summoning patterns]

### What [Agent] Provides
[Expected outputs, format, timeline]

### Expected Response Format
[Template or example]

## Validation

### ✅ Success Criteria
- [ ] Measurable outcome 1
- [ ] Measurable outcome 2

### Quality Gates
**INBOUND:** [Prerequisites before skill used]
**OUTBOUND:** [Validation after skill executed]

## Related Skills
- [Prerequisite skills]
- [Complementary skills]
- [Compound learning paths]

## References
- [Agent docs]
- [Session history]
- [Core principles]

## Anti-Patterns
### ❌ Don't Do This:
### ✅ Do This Instead:

## Example Usage
[Real scenario showing skill in action]
```

**File location:**
```
.claude/skills/
  ├── infrastructure/     # Core system skills (RELAY, ARCH, RAM CREW, LEX)
  ├── guardian/          # Mission & safeguards (COMPASS)
  ├── oracle-council/    # Strategic wisdom (5 Pillars + SAGE)
  ├── specialists/       # Execution agents (Aurora, BOLT, COMET, CODEX)
  └── meta/              # System evolution (coordination, skill dev)
```

---

### Phase 3: Validation (Testing & Iteration)

**How skills are validated:**

1. **Create skill doc** (AVERI writes initial version)
2. **Test in real work** (use skill for actual task)
3. **Gather feedback:**
   - Did it work as expected?
   - Was it clear enough?
   - What was missing?
   - What was unnecessary?
4. **Iterate** (refine based on feedback)
5. **Stabilize** (skill becomes reliable)

**Quality checks:**
- ✅ Clear triggers (when to use)
- ✅ Clear boundaries (when NOT to use)
- ✅ Repeatable process
- ✅ Measurable outcomes
- ✅ Real examples included
- ✅ Anti-patterns documented

**Validation timeline:**
- First draft: Create and test same day
- Iteration: 2-3 uses to refine
- Stable: After 5+ successful uses

---

### Phase 4: Evolution (Continuous Improvement)

**Skills evolve when:**
- System capabilities expand
- New patterns discovered
- Edge cases encountered
- Better approaches found

**Update triggers:**
- Skill used but doesn't quite fit (needs expansion)
- Skill rarely used (might be too specific or obsolete)
- Skill causes confusion (needs clarity)
- Related skills created (update cross-references)

**Who updates skills:**
- **AVERI** (primary maintainer)
- **ARCH** (suggests updates from observed patterns)
- **Agents** (can flag issues, AVERI updates)

**Update protocol:**
1. Identify need for update
2. Document what changed and why
3. Update `updated: YYYY-MM-DD` in frontmatter
4. Test updated skill
5. Communicate changes (if significant)

---

## Skill Categories Explained

### Infrastructure
**Purpose:** Core system capabilities that enable all other work.

**Examples:**
- AVERI Trinity Usage
- RELAY Communication
- ARCH Pattern Extraction
- RAM CREW Optimization
- LEX Governance

**Characteristics:**
- System-wide impact
- Used across all categories
- Foundational (other skills depend on these)

---

### Guardian
**Purpose:** Protect mission, values, and sacred boundaries.

**Examples:**
- COMPASS Mission Alignment

**Characteristics:**
- Veto authority (can block work)
- Values-driven
- Non-negotiable standards

---

### Oracle Council
**Purpose:** Strategic wisdom and advisory perspectives.

**Examples:**
- LEONARDO Beauty Evaluation
- COSMOS Evidence Analysis
- SAGE Wellness Check

**Characteristics:**
- Advisory (not execution)
- Multiple perspectives
- Strategic decisions

---

### Specialists
**Purpose:** Execution excellence in specific domains.

**Examples:**
- Aurora Design Specs
- BOLT Frontend Dev
- COMET Backend Dev
- CODEX Library Curation

**Characteristics:**
- Domain expertise
- Hands-on execution
- Tangible deliverables

---

### Meta
**Purpose:** System evolution and coordination.

**Examples:**
- Agent Coordination Patterns
- Skill Development Process (this skill)

**Characteristics:**
- System-level thinking
- Enables other skills
- Self-referential (meta skills create meta skills)

---

## Skill Naming Conventions

**Pattern:** `[agent]-[capability]-[noun].md`

**Examples:**
- `compass-mission-alignment.md`
- `leonardo-beauty-eval.md`
- `comet-backend-dev.md`
- `agent-coordination-patterns.md`

**Rules:**
- Kebab-case (lowercase, hyphens)
- Agent name first (if agent-specific)
- Action/capability second
- Noun form (not verb)
- Descriptive but concise

**Multi-agent skills:**
- Use most relevant agent or "agent" if truly universal
- Example: `agent-coordination-patterns.md` (all agents)

---

## Skill Frontmatter Fields

```yaml
---
name: skill-name              # Kebab-case identifier
description: One-liner        # Short description
agents: [LIST]                # Primary agents who use this
category: infrastructure      # infrastructure|guardian|oracle-council|specialists|meta
created: YYYY-MM-DD          # Creation date
updated: YYYY-MM-DD          # Last update date
mission_aligned: true        # Mission check passed
sacred_firewall: pass        # Sacred boundary check
---
```

**Field usage:**
- `name`: Unique identifier (matches filename)
- `description`: One-line summary (for catalog)
- `agents`: Who primarily uses this skill
- `category`: Which folder/domain
- `created`: First version date
- `updated`: Most recent update
- `mission_aligned`: COMPASS check result
- `sacred_firewall`: Boundary validation

---

## Quality Standards for Skills

### Clarity
- ✅ Clear trigger conditions (when to use)
- ✅ Clear boundaries (when NOT to use)
- ✅ Jargon-free (or jargon explained)
- ✅ Examples included (show, don't just tell)

### Completeness
- ✅ All sections present (from template)
- ✅ Success criteria defined
- ✅ Quality gates specified
- ✅ Related skills linked
- ✅ Anti-patterns documented

### Accuracy
- ✅ Reflects actual practice (not aspiration)
- ✅ Agent capabilities accurate
- ✅ Examples tested (actually work)
- ✅ Cross-references valid

### Usability
- ✅ Scannable (headers, lists, formatting)
- ✅ Actionable (can use immediately)
- ✅ Self-contained (minimal external deps)
- ✅ Navigable (internal links work)

---

## Skill Discovery & Usage

### How users find skills:

1. **Natural language query:**
   - "How do I check mission alignment?"
   - Claude searches skills, suggests `compass-mission-alignment.md`

2. **Agent summon:**
   - User summons agent ("COMPASS, check this")
   - Agent's skill doc defines behavior

3. **Related skills:**
   - User reading one skill
   - Discovers related skills in references section

4. **Catalog:**
   - Browse `.claude/skills/` structure
   - Categories guide exploration

### Skill invocation patterns:

**Implicit (agent handles):**
```
User: "COMPASS, is this mission-aligned?"
COMPASS: [Executes compass-mission-alignment.md skill]
```

**Explicit (user references):**
```
User: "Follow the LEONARDO beauty evaluation process."
LEONARDO: [Executes leonardo-beauty-eval.md skill]
```

**Coordination (AVERI orchestrates):**
```
User: "We need to coordinate Aurora, COMET, and BOLT."
AVERI: [Uses agent-coordination-patterns.md skill]
```

---

## Anti-Patterns in Skill Development

### ❌ Don't Do This:

1. **Premature documentation**
   - Writing skill before pattern proven
   - Result: Obsolete docs, wasted effort

2. **Over-specification**
   - Prescribing exact steps rigidly
   - Result: Skills become brittle, don't adapt

3. **Skill proliferation**
   - Creating skill for every tiny task
   - Result: Overwhelming catalog, hard to navigate

4. **Stale documentation**
   - Skills written, never updated
   - Result: Misleading docs worse than no docs

5. **Missing examples**
   - Abstract description without real usage
   - Result: Users can't apply skill

6. **Orphaned skills**
   - No cross-references, hard to discover
   - Result: Skills unused, effectively don't exist

### ✅ Do This Instead:

1. **Document after doing**
   - Work first, document pattern after 3+ uses
   - Result: Skills reflect reality

2. **Guide, don't prescribe**
   - Provide framework, allow adaptation
   - Result: Skills flexible, broadly useful

3. **Consolidate when possible**
   - Combine related micro-skills
   - Result: Manageable catalog size

4. **Living documentation**
   - Update skills as patterns evolve
   - Result: Docs stay relevant

5. **Show, then tell**
   - Real examples first, abstract later
   - Result: Users can immediately apply

6. **Cross-reference actively**
   - Link related skills bidirectionally
   - Result: Skills discoverable, compound learning

---

## This Skill's Creation Story

**How this skill emerged:**

1. **Work done:** Agent skills standardization project (18 skills)
2. **Pattern noticed:** Consistent structure, validation, formatting
3. **IRIS realized:** "We just created 17 skills using a repeatable process"
4. **Meta moment:** "The skill creation process is itself a skill"
5. **This skill created:** Document the pattern we just executed 17 times

**Lessons learned:**

- **Frontmatter matters:** Consistent metadata enables tooling
- **Structure scales:** Template approach worked for diverse agents
- **Examples essential:** Real scenarios make skills actionable
- **One at a time:** Breaking work into discrete skills kept quality high
- **Cross-references:** Related skills section creates navigation web

**What we'd do differently:**
- Create skill template earlier (would've saved iteration)
- Document category purposes upfront (emerged mid-project)
- Test skills as created (some quality checks deferred)

**What worked well:**
- Sequential creation (one at a time, no overwhelm)
- Consistent commit messages (progress visible)
- Approval checkpoints (quality maintained)
- Real agent docs as source (skills grounded in reality)

---

## Skill Maintenance

**Regular maintenance tasks:**

1. **Quarterly review:**
   - Which skills used frequently? (keep, improve)
   - Which skills rarely used? (consolidate or deprecate)
   - Which skills cause confusion? (clarify)
   - Which skills need updates? (evolve)

2. **Cross-reference audit:**
   - Validate all links still valid
   - Add new cross-references as skills created
   - Remove references to deprecated skills

3. **Example refresh:**
   - Ensure examples still reflect current practice
   - Add new examples for evolved patterns
   - Remove outdated scenarios

4. **Catalog optimization:**
   - Reorganize if categories misaligned
   - Split skills if too broad
   - Merge skills if too granular

**Who owns maintenance:**
- **AVERI** (primary maintainer)
- **ARCH** (suggests optimizations from pattern analysis)
- **All agents** (flag issues, propose improvements)

---

## Future Evolution

**Potential enhancements:**

1. **Skill versioning:**
   - Track major changes
   - Migration guides for breaking changes

2. **Skill metrics:**
   - Usage frequency
   - Success rate
   - Time saved

3. **Skill dependencies:**
   - Explicit prerequisite chains
   - Compound skill paths

4. **Skill automation:**
   - Tooling to invoke skills programmatically
   - Validation automation

5. **Skill catalog UI:**
   - Searchable interface
   - Visual dependency graph
   - Usage analytics

**When to build these:**
- Not now (premature optimization)
- When pain point emerges (e.g., "hard to find skills")
- After catalog reaches critical mass (50+ skills?)

---

## Validation

### ✅ This Skill Successful When:

- [ ] New skills follow consistent template
- [ ] Skills documented after pattern proven (not before)
- [ ] Quality standards maintained
- [ ] Cross-references complete
- [ ] Skills actually used (not shelf-ware)
- [ ] Catalog remains navigable (not overwhelming)
- [ ] Maintenance happens regularly

---

## Related Skills

- [ARCH Pattern Extraction](../infrastructure/arch-pattern-extraction.md) - Identifies patterns to codify
- [Agent Coordination Patterns](./agent-coordination-patterns.md) - Uses skills for coordination
- [AVERI Trinity Usage](../infrastructure/averi-trinity-usage.md) - AVERI creates most skills

---

**Built by:** AVERI Trinity (ATHENA • VERA • IRIS)  
**Skill:** 18 of 18 (100% COMPLETE) 🎉  
**Category:** Meta  
**Purpose:** Evolve system through documented, reusable skills  
**Duration:** ∞

📚 **Skills emerge from work. Document after doing. Evolve continuously.** ✨
