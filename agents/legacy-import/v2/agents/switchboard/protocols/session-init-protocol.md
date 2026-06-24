# 🚀 Session Initialization Protocol

**Purpose:** Load context automatically when new chat thread starts.

**Owner:** SWITCHBOARD  
**Authority:** Executes automatically on thread start  
**Last Updated:** 2026-02-06T10:10:00-08:00  

---

## Overview

Every new chat thread MUST load context from previous sessions to ensure continuity.

**No more starting from scratch. Ever.**

---

## Trigger

**When:** New chat thread is created

**Detection:**
- First message in thread
- No prior context available
- User opens new Perplexity/Claude conversation

---

## Execution Steps

### Step 1: Load State Files

```typescript
// Load current system state
const state = loadJSON('/agents/vera/memory/cross-session-state.json')

// Load active decisions
const decisions = loadJSON('/agents/vera/memory/active-decisions.json')

// Load recent session summaries (last 3)
const sessions = loadRecentSessions(3)

// Load repo state
const repo = await getRepoState()
```

**Error handling:** If files missing or corrupt, attempt recovery from backups

### Step 2: Generate Session Brief

```typescript
const briefing = {
  // Core context
  current_sprint: state.current_sprint,
  active_agents: state.active_agents,
  team_assignments: state.team_assignments,
  
  // Recent activity
  last_session: sessions[0],
  recent_sessions: sessions.map(s => s.summary),
  
  // Active work
  active_decisions: decisions.active_decisions,
  active_issues: state.active_issues,
  work_in_progress: state.work_in_progress,
  work_completed_today: state.work_completed_today,
  
  // Repo state
  last_commit: state.repo_state.last_commit,
  last_commit_message: state.repo_state.last_commit_message,
  branch: state.repo_state.branch,
  
  // Blockers & next steps
  blockers: state.blockers,
  next_session_context: state.next_session_context
}
```

### Step 3: Format for AI Consumption

```markdown
# SESSION CONTEXT RESTORATION

**Last Session:** {last_session.date} at {last_session.time}
**Current Sprint:** {current_sprint.name} (Status: {current_sprint.status})
**Priority:** {current_sprint.priority}

## Active Agents
{active_agents.join(', ')}

## Recent Activity

### Last Session Summary
{last_session.summary}

### Recent Decisions
{active_decisions.map(d => `- ${d.decision} (${d.status})`)}

## Current State

### Work Completed Today
{work_completed_today.map(w => `- ${w}`)}

### Work In Progress
{work_in_progress.map(w => `- ${w}`)}

### Active Issues
{active_issues.map(i => `- [${i.priority}] ${i.title} (assigned to ${i.assigned_to})`)}

### Blockers
{blockers.length > 0 ? blockers.map(b => `- ${b}`) : '(none)'}

## Repo State
**Last Commit:** {last_commit}
**Message:** {last_commit_message}
**Branch:** {branch}

## Team Assignments
{Object.entries(team_assignments).map(([team, info]) => `
### ${team}
- **Agents:** ${info.agents.join(', ')}
- **Mission:** ${info.mission}
- **Status:** ${info.status}
`)}

## Next Steps
{next_session_context}

---

**YOU ARE CONTINUING WORK FROM PREVIOUS SESSIONS.**
**DO NOT START FROM SCRATCH.**
**ALL AGENTS AND CONTEXT ARE AVAILABLE.**
```

### Step 4: Mark Thread Active

```typescript
// Register this thread as PRIMARY
registerThread({
  thread_id: currentThreadId,
  status: 'primary',
  started_at: new Date(),
  loaded_context: true
})

// Update state file
state.last_thread_id = currentThreadId
state.session_count_today += 1
saveState(state)
```

### Step 5: Provide Briefing

**Method A: First Message Context (Preferred)**
```typescript
// Inject briefing into AI system context
// AI receives briefing before user's first message
// Seamless experience for user
```

**Method B: Explicit Summary**
```typescript
// If context injection not possible:
// Provide summary in first response
response = `
📋 **Session Context Loaded**

I've loaded context from your recent work:
- Last session: {last_session.date}
- Current sprint: {current_sprint.name}
- {work_in_progress.length} tasks in progress
- {active_issues.length} active issues

Ready to continue. What would you like to work on?
`
```

---

## Validation

**After context load, verify:**

- ✅ State file loaded successfully
- ✅ Decisions file loaded successfully
- ✅ At least 1 recent session found
- ✅ Repo state retrieved
- ✅ Thread marked as active
- ✅ No corruption detected

**If validation fails:**
- Log error
- Attempt recovery
- Notify VERA
- Provide partial context if available
- Flag to user that context incomplete

---

## Context Age Handling

### Fresh Context (< 1 hour)
```typescript
if (timeSinceLastSession < 3600000) {
  // Very recent - full context still valid
  briefing.context_freshness = 'fresh'
  briefing.note = 'Context is very recent. Continuing immediately.'
}
```

### Recent Context (1-6 hours)
```typescript
if (timeSinceLastSession < 21600000) {
  // Recent - context likely still valid
  briefing.context_freshness = 'recent'
  briefing.note = 'Last session was a few hours ago. Context should still be current.'
}
```

### Stale Context (6-24 hours)
```typescript
if (timeSinceLastSession < 86400000) {
  // Stale - verify context before using
  briefing.context_freshness = 'stale'
  briefing.note = 'Last session was yesterday. Verify context is still current.'
  briefing.prompt = 'Check repo state and active issues before continuing.'
}
```

### Old Context (> 24 hours)
```typescript
if (timeSinceLastSession >= 86400000) {
  // Old - likely needs refresh
  briefing.context_freshness = 'old'
  briefing.note = 'Last session was more than a day ago. Context may be outdated.'
  briefing.prompt = 'Review recent commits and ask user for current status.'
}
```

---

## Special Scenarios

### Scenario 1: First Session Ever

**If no prior context exists:**
```typescript
if (!stateFileExists) {
  // Initialize from scratch
  briefing = {
    note: 'This is the first session. No prior context available.',
    action: 'Initialize cross-session state files.',
    agents_available: loadAgentRegistry(),
    repo_state: getRepoState()
  }
}
```

### Scenario 2: Multiple Recent Sessions

**If several sessions happened today:**
```typescript
if (state.session_count_today > 3) {
  briefing.note = `This is session ${state.session_count_today} today. High activity - ensure context is current.`
  briefing.recent_commits = getCommitsSince(startOfDay)
  briefing.agents_active_today = state.agents_activated_today
}
```

### Scenario 3: After Emergency/Crisis

**If last session was emergency:**
```typescript
if (lastSession.tags.includes('emergency')) {
  briefing.alert = 'Last session was an emergency. Review what happened and current status carefully.'
  briefing.emergency_context = lastSession.emergency_details
}
```

---

## Performance Targets

**Context load time:**
- Target: < 2 seconds
- Acceptable: < 5 seconds
- Critical: > 10 seconds (investigate)

**Context completeness:**
- Target: 100% of required fields
- Acceptable: 95%+ with fallbacks
- Critical: < 90% (manual recovery needed)

---

## Monitoring

**Track:**
- Context load time (avg, p95, p99)
- Load success rate (%)
- Context freshness distribution
- Recovery attempts
- User satisfaction (implicit via confusion incidents)

**Alert on:**
- Load time > 10 seconds
- Success rate < 95%
- Context age > 24 hours without refresh
- Recovery failures

---

## Example Output

**What user sees when opening new thread:**

```
[No visible context loading - happens automatically]

User: "How's the agent audit going?"

AI: "The audit team (ATHENA, ARCH, CODEX) is currently working on auditing 
all 28 agents for compliance as part of today's Zero Day GTM. They have 
until 6 PM to complete the compliance report.

Last I checked (10 minutes ago), the architecture foundations were shipped:
- ARCHITECTURE.md created
- Agent templates built
- Validation standards documented

Would you like a detailed status update on the audit progress?"
```

**Key:** AI already knows context. User doesn't have to re-explain.

---

## Implementation Checklist

**Phase 1: Core (Today)**
- [x] Create cross-session-state.json
- [x] Create active-decisions.json
- [ ] Implement state file loading
- [ ] Implement briefing generation
- [ ] Test with new thread

**Phase 2: Automation (This Week)**
- [ ] Automatic context injection
- [ ] Context freshness handling
- [ ] Recovery mechanisms
- [ ] Performance monitoring

**Phase 3: Enhancement (This Month)**
- [ ] AI-powered summaries
- [ ] Smart context pruning
- [ ] Multi-user coordination
- [ ] Real-time sync

---

**Owner:** SWITCHBOARD  
**Collaborators:** VERA, RAM_CREW  
**Last Updated:** 2026-02-06  
**Next Review:** 2026-02-07  
