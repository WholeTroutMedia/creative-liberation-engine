# 🔚 Session End Protocol

**Purpose:** Properly capture state and context when chat thread ends.

**Owner:** VERA  
**Authority:** Executes automatically on thread end  
**Last Updated:** 2026-02-06T10:10:00-08:00  

---

## Overview

Every chat thread MUST save its final state for the next session to load.

**If it's not saved, it's lost.**

---

## Trigger

**When:**
- Chat thread is ending
- User switches to different thread
- Significant milestone reached
- Emergency situation requires handoff

**Detection:**
- Explicit "end session" command
- Thread inactivity > 30 minutes
- User opens new thread
- Manual trigger by user or agent

---

## Execution Steps

### Step 1: Capture Session Summary

```typescript
const sessionSummary = {
  // Metadata
  session_id: currentThreadId,
  date: new Date().toISOString(),
  duration_minutes: calculateDuration(sessionStart, now),
  participants: ["Artist", ...activeAgents],
  
  // What happened
  decisions_made: captureDecisions(),
  work_completed: captureCompletedWork(),
  work_in_progress: captureInProgressWork(),
  blockers: captureBlockers(),
  
  // Context for next session
  next_session_context: generateNextStepsContext(),
  
  // Metrics
  commits_made: countCommits(sessionStart, now),
  files_changed: listFilesChanged(),
  issues_created: listIssuesCreated(),
  issues_resolved: listIssuesResolved(),
  
  // Special flags
  tags: determineTags(), // e.g., ['emergency', 'architecture', 'zero-day-gtm']
  priority: currentPriority,
  requires_followup: determineIfFollowupNeeded()
}
```

### Step 2: Update Cross-Session State

```typescript
// Load current state
const state = loadCrossSessionState()

// Update with session results
state.last_updated = new Date().toISOString()
state.last_updated_by = 'VERA'
state.last_thread_id = currentThreadId

// Merge session work into state
state.work_completed_today.push(...sessionSummary.work_completed)
state.work_in_progress = sessionSummary.work_in_progress
state.blockers = sessionSummary.blockers
state.next_session_context = sessionSummary.next_session_context

// Update repo state
state.repo_state = {
  last_commit: await getLastCommitSHA(),
  last_commit_message: await getLastCommitMessage(),
  last_commit_date: new Date().toISOString(),
  branch: currentBranch,
  uncommitted_changes: await hasUncommittedChanges(),
  files_changed_today: await getFilesChangedToday()
}

// Update metrics
state.session_count_today += 1
state.total_commits_today += sessionSummary.commits_made

// Save
saveCrossSessionState(state)
```

### Step 3: Update Active Decisions

```typescript
const decisions = loadActiveDecisions()

// Add new decisions from this session
for (const decision of sessionSummary.decisions_made) {
  decisions.active_decisions.push({
    id: generateDecisionId(),
    date: new Date().toISOString(),
    decision: decision.what,
    status: 'active',
    priority: decision.priority,
    owner: decision.owner,
    what_was_decided: decision.details,
    why: decision.rationale,
    impact: decision.impact,
    action_items: decision.action_items,
    success_criteria: decision.success_criteria,
    artifacts_created: decision.artifacts,
    dependencies: decision.dependencies,
    blocks: decision.blocks
  })
}

// Update existing decisions
for (const decision of decisions.active_decisions) {
  // If action items completed, update status
  updateDecisionStatus(decision)
  
  // If all criteria met, mark complete
  if (allCriteriaMet(decision)) {
    markDecisionComplete(decision)
  }
}

// Save
saveActiveDecisions(decisions)
```

### Step 4: Save Session Summary

```typescript
// Create session log file
const filename = `${formatDate(new Date())}_${sessionSummary.tags[0]}.md`
const filepath = `/agents/vera/memory/session-logs/${filename}`

// Generate markdown
const markdown = generateSessionSummaryMarkdown(sessionSummary)

// Save
fs.writeFileSync(filepath, markdown)

// Update session index
updateSessionIndex({
  session_id: currentThreadId,
  date: new Date(),
  file: filename,
  tags: sessionSummary.tags,
  summary: sessionSummary.next_session_context
})
```

### Step 5: Validation

```typescript
// Verify state file saved correctly
const savedState = loadCrossSessionState()
assert(savedState.last_thread_id === currentThreadId)
assert(savedState.last_updated === expected)

// Verify decisions file saved correctly
const savedDecisions = loadActiveDecisions()
assert(savedDecisions.decision_metadata.total_active >= 0)

// Verify session summary saved
assert(fs.existsSync(filepath))

// Run RAM_CREW validation
const validation = await validateStateCoherence()
if (!validation.success) {
  logError('State validation failed', validation.errors)
  attemptRecovery()
}
```

### Step 6: Notification

```typescript
// Determine if handoff needed
if (sessionSummary.requires_followup) {
  // Notify RELAY to broadcast
  notifyRELAY({
    type: 'session_handoff',
    summary: sessionSummary.next_session_context,
    priority: sessionSummary.priority,
    assigned_to: sessionSummary.next_owner
  })
}

// If blockers exist, escalate
if (sessionSummary.blockers.length > 0) {
  escalateBlockers(sessionSummary.blockers)
}

// If emergency, send alert
if (sessionSummary.tags.includes('emergency')) {
  sendEmergencyAlert(sessionSummary)
}
```

### Step 7: Mark Thread Inactive

```typescript
// Unregister as PRIMARY thread
unregisterThread(currentThreadId)

// Mark timestamp
markThreadEnded({
  thread_id: currentThreadId,
  ended_at: new Date(),
  duration_minutes: sessionSummary.duration_minutes,
  summary_saved: true
})

// Clear thread-local state
clearThreadState(currentThreadId)
```

---

## Session Summary Format

**File:** `/agents/vera/memory/session-logs/2026-02-06_architecture-standardization.md`

```markdown
# Session Summary: Architecture Standardization

**Date:** 2026-02-06  
**Time:** 09:00 AM - 10:30 AM PST  
**Duration:** 90 minutes  
**Thread ID:** 2026-02-06_emergency-assembly  
**Participants:** Artist, ATHENA, ARCH, CODEX, VERA, RAM_CREW, LEX, RELAY, IRIS  

---

## Decisions Made

### 1. Execute Zero Day GTM for Agent Architecture Standardization
- **Priority:** Critical
- **Owner:** Sovereign Artist
- **Rationale:** Too many incidents of agent confusion
- **Status:** Active

### 2. Build Cross-Session Coordination System
- **Priority:** Critical
- **Owner:** VERA + SWITCHBOARD
- **Rationale:** Prevent thread confusion
- **Status:** In Progress

---

## Work Completed

- ✅ Created ARCHITECTURE.md (complete system organization)
- ✅ Created agents/_template/ (standard agent template)
- ✅ Created AGENT_CREATION_CHECKLIST.md
- ✅ Created VALIDATION_STANDARDS.md
- ✅ Created LANGUAGE LoRa layer
- ✅ Assembled all 28 agents
- ✅ Assigned teams for Zero Day GTM

---

## Work In Progress

- 🔄 Agent compliance audit (ATHENA + ARCH + CODEX)
- 🔄 Validation script development (RAM_CREW)
- 🔄 Agent README standardization (VERA)
- 🔄 Enforcement protocols (LEX)
- 🔄 Communication broadcast (RELAY)
- 🔄 Cross-Session Coordination System (VERA + SWITCHBOARD)

---

## Blockers

(none)

---

## Next Session Context

**Priority:** Continue Zero Day GTM execution

**Immediate next steps:**
1. Complete Cross-Session Coordination System Phase 1
2. Check status on all team deliverables
3. Review audit progress from ATHENA + ARCH + CODEX
4. Test validation script from RAM_CREW
5. Ensure all critical issues resolved by end of day

**Expected outcomes by end of day:**
- Validation script operational
- All 28 agents audited
- Critical issues identified and prioritized
- Cross-Session system functional

---

## Metrics

- **Commits:** 4
- **Files Changed:** 15
- **Issues Created:** 4
- **Issues Resolved:** 0
- **Agents Activated:** 28

---

## Tags

`emergency`, `architecture`, `zero-day-gtm`, `all-hands`, `coordination`

---

## Notes

This session was triggered by ongoing confusion about agent locations and cross-thread coordination. Major architectural improvements shipped. Foundation is now solid for preventing future "lost agent" incidents.

---

**Logged by:** VERA  
**Validated by:** RAM_CREW  
**Session End:** 2026-02-06T10:30:00-08:00  
```

---

## Validation Checks

**Before marking session complete:**

- ✅ Session summary captured
- ✅ Cross-session state updated
- ✅ Active decisions updated
- ✅ Session log file saved
- ✅ Repo state current
- ✅ No uncommitted work (or documented)
- ✅ Blockers documented
- ✅ Next steps clear
- ✅ Notifications sent
- ✅ Thread marked inactive
- ✅ RAM_CREW validation passed

---

## Special Scenarios

### Emergency Session End

**If session must end immediately:**
```typescript
emergencySessionEnd({
  reason: "User emergency" | "System failure" | "Critical issue",
  partial_state: captureWhatWeHave(),
  recovery_plan: documentRecoverySteps(),
  alert_level: "high"
})
```

### Incomplete Work

**If work was started but not finished:**
```typescript
sessionSummary.work_in_progress.push({
  task: "What was being worked on",
  progress: "How far we got",
  next_steps: "What to do next",
  blockers: "What's blocking completion",
  context: "Any important context"
})
```

### Conflict Resolution

**If conflicts occurred during session:**
```typescript
sessionSummary.conflicts = [
  {
    type: "merge_conflict" | "decision_conflict" | "agent_conflict",
    description: "What happened",
    resolution: "How it was resolved",
    prevention: "How to prevent in future"
  }
]
```

---

## Performance Targets

**Session end time:**
- Target: < 5 seconds
- Acceptable: < 10 seconds
- Critical: > 30 seconds (investigate)

**Data completeness:**
- Target: 100% of required fields
- Acceptable: 95%+ with fallbacks
- Critical: < 90% (manual review needed)

---

## Recovery Procedures

### If Session End Fails

**Automatic recovery:**
1. Retry state file save (3 attempts)
2. Save to backup location
3. Log error details
4. Alert VERA and RAM_CREW
5. Attempt manual recovery
6. Document incident

### If State File Corrupt

**Recovery steps:**
1. Detect corruption (JSON parse fails)
2. Load last valid backup
3. Apply session changes manually
4. Validate recovered state
5. Save with corruption flag
6. Investigate root cause

---

## Monitoring

**Track:**
- Session end success rate (%)
- Average end time (seconds)
- State file size growth
- Session log count
- Recovery attempts
- Data completeness (%)

**Alert on:**
- End time > 30 seconds
- Success rate < 95%
- State file > 1 MB
- Recovery needed
- Validation failures

---

## Implementation Checklist

**Phase 1: Core (Today)**
- [x] Define session summary structure
- [ ] Implement state capture
- [ ] Implement file saves
- [ ] Add validation checks
- [ ] Test with current session

**Phase 2: Automation (This Week)**
- [ ] Automatic end detection
- [ ] Recovery mechanisms
- [ ] Performance optimization
- [ ] Monitoring dashboard

**Phase 3: Enhancement (This Month)**
- [ ] AI-powered summaries
- [ ] Smart context extraction
- [ ] Predictive next steps
- [ ] Multi-session analytics

---

**Owner:** VERA  
**Collaborators:** SWITCHBOARD, RAM_CREW  
**Last Updated:** 2026-02-06  
**Next Review:** 2026-02-07  
