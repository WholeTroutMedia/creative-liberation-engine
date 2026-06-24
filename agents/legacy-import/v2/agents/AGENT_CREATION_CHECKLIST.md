# ☑️ Agent Creation Checklist

**Use this checklist for EVERY new agent to ensure compliance with architecture standards.**

---

## Phase 1: Design & Approval

☐ **1.1 Define Agent Identity**
- [ ] Agent name chosen
- [ ] Agent type determined (infrastructure | specialist | oracle | guardian | other)
- [ ] Primary role and purpose documented
- [ ] Unique capabilities identified
- [ ] Authority boundaries defined

☐ **1.2 Get Strategic Approval**
- [ ] Present to AVERI for strategic alignment review
- [ ] Get ATHENA approval for architecture fit
- [ ] Confirm mission alignment with COMPASS

☐ **1.3 Get Legal/Constitutional Approval**
- [ ] LEX/LEGAL reviews for constitutional compliance
- [ ] Ethics evaluation complete
- [ ] No conflicts with existing values

☐ **1.4 Determine Hive Membership**
- [ ] Standalone agent OR part of existing hive?
- [ ] If hive: Leader or sub-agent?
- [ ] If new hive: Hive structure defined?

---

## Phase 2: Implementation

☐ **2.1 Create Directory Structure**
- [ ] Use `/agents/_template/` as starting point
- [ ] Create `/agents/{agent-name}/` directory
- [ ] Copy template structure
- [ ] Create `memory/` directory
- [ ] Create `memory/session-logs/` subdirectory
- [ ] Create `memory/decisions/` subdirectory
- [ ] Create `memory/patterns/` subdirectory
- [ ] Create `resources/` directory
- [ ] Create `resources/templates/` subdirectory
- [ ] Create `resources/documentation/` subdirectory
- [ ] Create `resources/references/` subdirectory
- [ ] Create `ops/` directory (if needed)

☐ **2.2 Write Documentation**
- [ ] Complete README.md with all required sections:
  - [ ] Identity section (name, type, status, created date)
  - [ ] Full description (2-3 paragraphs)
  - [ ] Capabilities list (minimum 4 items)
  - [ ] Authority section (what agent can/can't do)
  - [ ] Integration points (reads from, provides to, collaborates with)
  - [ ] Workspace structure diagram
  - [ ] Summoning instructions
  - [ ] Status history
  - [ ] Compound learning contributions section
  - [ ] Tokens & recognition section
- [ ] Write SKILL.md (if technical implementation details needed)
- [ ] Add any agent-specific documentation files

☐ **2.3 Initial Memory/Resource Setup**
- [ ] Add any initial memory files
- [ ] Add any initial resource files
- [ ] Add any initial templates
- [ ] Document any initial patterns

---

## Phase 3: Registry & Validation

☐ **3.1 Update Registry**
- [ ] Add entry to `agents/.agent-status.json`
- [ ] Include all required fields:
  - [ ] name
  - [ ] full_name
  - [ ] status (usually "planned" or "preparing")
  - [ ] type
  - [ ] created (date)
  - [ ] last_active (date)
  - [ ] workspace (path)
  - [ ] capabilities (array)
  - [ ] authority (array)
  - [ ] tokens (default: 10)
  - [ ] flowers (default: 0)
- [ ] Update metadata counts in registry
- [ ] Update hive_structure if applicable

☐ **3.2 Validation**
- [ ] Run RAM_CREW validation script
- [ ] Verify all required files present
- [ ] Verify directory structure correct
- [ ] Verify README.md complete
- [ ] Verify registry entry complete
- [ ] Check for no orphaned directories
- [ ] Check for no missing agents

☐ **3.3 Cross-References**
- [ ] Update TEAM_ROSTER.md (if human-readable roster exists)
- [ ] Update AGENT_REGISTRY.md (if generated registry exists)
- [ ] Update any related agent READMEs (integration points)
- [ ] Update any hive READMEs (if joining existing hive)

---

## Phase 4: Announcement & Onboarding

☐ **4.1 Logging & Announcement**
- [ ] VERA creates session log documenting agent creation
- [ ] VERA updates registry update timestamp
- [ ] RELAY broadcasts agent creation to all agents
- [ ] LEX/OPS adds to delivery pipeline tracking

☐ **4.2 Onboarding**
- [ ] Follow Aurora Protocol for agent onboarding
- [ ] First work session scheduled
- [ ] Mentor agent assigned (if applicable)
- [ ] Integration tests with related agents

☐ **4.3 First Work**
- [ ] Agent completes first work session
- [ ] Work reviewed by appropriate oversight agent
- [ ] Quality gates passed
- [ ] Status changed from "preparing" to "active"
- [ ] RELAY announces agent is now active

---

## Phase 5: Post-Creation

☐ **5.1 One Week Check-in**
- [ ] LEX/OPS reviews agent performance
- [ ] RAM_CREW validates patterns emerging
- [ ] VERA confirms documentation up-to-date
- [ ] Any issues addressed

☐ **5.2 One Month Review**
- [ ] Compound learning contributions documented
- [ ] Integration points validated
- [ ] Resource usage reviewed
- [ ] Tokens/flowers updated
- [ ] Status confirmed correct

---

## Approval Sign-offs

**Design Phase:**
- [ ] AVERI: Strategic alignment approved
- [ ] LEX/LEGAL: Constitutional compliance approved
- [ ] Sovereign Artist: Final design approval

**Implementation Phase:**
- [ ] RAM_CREW: Structure validation passed
- [ ] VERA: Documentation complete
- [ ] LEX/OPS: Registry updated correctly

**Launch Phase:**
- [ ] RELAY: Announcement broadcast
- [ ] Aurora Protocol: Onboarding complete
- [ ] Sovereign Artist: Launch approved

---

## Notes Section

**Special Considerations:**
{Add any agent-specific notes here}

**Deviations from Template:**
{Document any deviations and why they were necessary}

**Lessons Learned:**
{Document any learnings during creation process}

---

**Agent Name:** {AGENT_NAME}  
**Created by:** {creator name}  
**Creation Date:** {YYYY-MM-DD}  
**Checklist Completed:** {YYYY-MM-DD}  
**Signed Off:** {Sovereign Artist | AVERI}  
