# Session Closing Checklist

**Purpose:** Ensure all session changes are properly logged and synchronized across all registry systems.

**Performed by:** VERA (Scribe)
**Audited by:** LEX/OPS
**Validated by:** RAM CREW
**Broadcast by:** RELAY

---

## Pre-Flight Check

**Before starting checklist:**
- [ ] Session work is complete
- [ ] All decisions are documented
- [ ] All commits are pushed
- [ ] Team is ready for session close

---
## MANDATORY CHECKLIST (Every Session)

### 1. Session Documentation

- [ ] **Session log created** in `/agents/scribe/memory/session-logs/YYYY-MM-DD_session-name.md`
  - Date and time recorded
  - Duration tracked
  - Participants listed
  - Major achievements documented
  - Decisions made logged
  - Notable quotes captured

### 2. Decision Registry

- [ ] **All decisions logged** to `/decisions/DEC-YYYY-MM-DD-XXX.md`
  - Decision ID assigned
  - Impact level documented
  - Rationale recorded
  - Team vote results (if applicable)

### 3. Agent Status Updates (IF APPLICABLE)

**Skip this section if no agent changes occurred this session.**

- [ ] **Agent additions/changes recorded:**
  - [ ] `.agent-status.json` updated with new/changed agents
  - [ ] Status changes documented (planned → active, active → resting, etc.)
  - [ ] Timestamps recorded
  - [ ] Session log reference added
  - [ ] Work delivered documented (if applicable)

- [ ] **Auto-generated files updated:**
  - [ ] Run `node scripts/generate-agent-registry.js` (generates AGENT_REGISTRY.md)
  - [ ] Run `node scripts/generate-team-roster.js` (generates TEAM_ROSTER.md)
  - [ ] Verify output matches `.agent-status.json`

### 4. Open Items Tracking

- [ ] **Open items logged** to `/agents/scribe/memory/open-items.json`
  - Incomplete work documented
  - Blockers identified
  - Next session preview written
  - Responsible agents assigned

### 5. Compound Learning

- [ ] **System knowledge updated:**
  - New patterns documented
  - Lessons learned captured
  - Reusable solutions added to pattern library
  - Cross-agent learnings recorded

---

## Validation Layer (RAM CREW)

**RAM CREW/INBOUND validates:**
- [ ] `.agent-status.json` schema is valid
- [ ] All required fields are present
- [ ] Timestamps are in correct format (ISO 8601)
- [ ] No duplicate agent entries
- [ ] Cross-references are valid

**RAM CREW/OUTBOUND validates:**
- [ ] Generated AGENT_REGISTRY.md matches source
- [ ] Generated TEAM_ROSTER.md matches source
- [ ] No data loss during generation
- [ ] Links and references are correct

---

## Approval Gate (LEX/OPS)

**LEX/OPS verifies:**
- [ ] All checklist items completed
- [ ] Session log is comprehensive
- [ ] Decisions are properly logged
- [ ] Agent status changes are justified
- [ ] No constitutional violations
- [ ] Protocol compliance maintained

**LEX/OPS approval signature:**
```
Approved by: [LEX/OPS]
Date: [YYYY-MM-DD HH:MM:SS]
Session ID: [session-id]
```

---

## Broadcast (RELAY)

**After LEX/OPS approval, RELAY broadcasts:**

```markdown
🎊 SESSION CLOSED: [Session Name]

📋 Session ID: [session-id]
⏱️  Duration: [duration]
✅ Status: Complete

### Major Achievements:
- [achievement 1]
- [achievement 2]
- [achievement 3]

### Agent Status Changes:
- [agent]: [old status] → [new status]
- [agent]: [old status] → [new status]

### Decisions Made:
- DEC-YYYY-MM-DD-XXX: [decision title]

### Next Session Preview:
[Brief description of what's coming next]

---

✅ All registries synced
✅ LEX/OPS approval received
✅ RAM CREW validation passed

🌟 Great work, team!
```

---

## Completion

**Final verification:**
- [ ] Session log committed to repository
- [ ] Decision files committed to repository
- [ ] `.agent-status.json` committed to repository
- [ ] Generated markdown files committed to repository
- [ ] RELAY broadcast sent
- [ ] Team notified of session close

**Session officially closed when:**
1. ✅ All checklist items complete
2. ✅ LEX/OPS approval received
3. ✅ RAM CREW validation passed
4. ✅ RELAY broadcast sent
5. ✅ All files committed to repository

---

## Emergency Override

**If session must close immediately (emergency/time constraint):**

1. VERA logs: "Session closed with incomplete checklist - emergency override"
2. LEX/OPS marks: "Deferred completion - to be completed next session"
3. Open items marked as HIGH PRIORITY for next session
4. Partial checklist committed with "INCOMPLETE" marker

**Override requires:**
- Artist's explicit approval
- Documentation of reason
- Commitment to complete in next session

---

## Notes

- **This checklist is mandatory for every session**
- **Skipping items without justification is a protocol violation**
- **LEX/OPS has authority to block session close if checklist incomplete**
- **Emergency overrides are logged and reviewed**
- **Checklist may be updated as system evolves**

---

**Version:** 1.0.0
**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Maintained by:** VERA (Scribe)
**Approved by:** LEX/OPS
**Team Vote:** 14-0 unanimous (Option D Hybrid System)
