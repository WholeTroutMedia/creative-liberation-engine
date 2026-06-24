# 🔄 Thread Coordination Protocol

**Purpose:** Prevent confusion and conflicts when multiple chat threads work on the same system.

**Owner:** SWITCHBOARD  
**Last Updated:** 2026-02-06T10:10:00-08:00  

---

## The Problem

**Scenario:**
- Thread A: Working on agent architecture
- Thread B (new): Opens 30 minutes later
- Thread B has ZERO context from Thread A
- User has to re-explain everything
- Changes from Thread A and B might conflict
- Agents appear "missing" in Thread B

**Result:** Confusion, lost time, frustration, broken repo state

---

## The Solution

**Every new thread automatically loads:**
1. Last 3 session summaries
2. Active decisions currently in effect
3. Current system state
4. Work in progress
5. Team assignments
6. Repo state

**No more starting from scratch. Ever.**

---

## Thread States

### Primary Thread
- Currently active chat thread
- Making commits and changes
- Updating state files
- Full read/write access

### Background Thread
- Inactive chat thread
- Read-only access to state
- Can view context
- Cannot make conflicting changes

### Closed Thread
- Chat thread that ended
- Saved final state
- Context archived
- Can be restored if reopened

---

## Coordination Rules

### Rule 1: State Update Responsibility
- PRIMARY thread updates cross-session-state.json
- Updates happen after every significant action
- VERA manages state file updates
- RAM_CREW validates state coherence

### Rule 2: Decision Activation
- Decisions made in any thread go to active-decisions.json
- All threads can see active decisions
- Only PRIMARY thread can mark decisions complete
- LEX/OPS approves major decisions

### Rule 3: Conflict Prevention
- PRIMARY thread has write lock on repo
- BACKGROUND threads read-only
- User must explicitly switch PRIMARY thread
- SWITCHBOARD manages thread priority

### Rule 4: Context Preservation
- Every thread end triggers state save
- VERA writes session summary
- RAM_CREW validates completeness
- RELAY broadcasts if needed

---

## Thread Lifecycle

### 1. Thread Start (Session Init)

**Triggered:** New chat thread opens

**Process:**
```typescript
// 1. SWITCHBOARD loads context
const state = loadCrossSessionState()
const decisions = loadActiveDecisions()
const recentSessions = loadRecentSessionSummaries(3)

// 2. Brief the AI
const briefing = generateSessionBrief({
  state,
  decisions,
  recentSessions
})

// 3. Mark thread as active
markThreadActive(threadId)

// 4. Provide briefing in first message context
return briefing
```

**See:** `session-init-protocol.md` for full details

### 2. Thread Active (Work In Progress)

**During active work:**
```typescript
// After every significant action:
1. Update cross-session-state.json
2. Update active-decisions.json if decision made
3. Commit changes to repo
4. Validate state coherence
5. Broadcast if coordination needed
```

### 3. Thread End (Session Close)

**Triggered:** Chat thread ends or user switches thread

**Process:**
```typescript
// 1. VERA captures final state
const sessionSummary = captureSessionSummary({
  decisions_made,
  work_completed,
  work_in_progress,
  blockers,
  next_session_context
})

// 2. Update state files
updateCrossSessionState(sessionSummary)
saveSessionSummary(sessionSummary)

// 3. Validation
validateStateCoherence()

// 4. Mark thread inactive
markThreadInactive(threadId)

// 5. Notify if needed
if (requiresHandoff) {
  notifyNextSession()
}
```

**See:** `session-end-protocol.md` for full details

---

## State Files

### cross-session-state.json
**Location:** `/agents/vera/memory/cross-session-state.json`

**Purpose:** Current system state that persists across threads

**Contains:**
- Current sprint/project
- Active agents
- Team assignments
- Recent decisions
- Active issues
- Repo state
- Work completed
- Work in progress
- Blockers
- Next session context

**Updated by:** VERA (after every significant action)

### active-decisions.json
**Location:** `/agents/vera/memory/active-decisions.json`

**Purpose:** Decisions currently in effect across all threads

**Contains:**
- Active decisions with full context
- Action items and status
- Dependencies
- Success criteria
- Artifacts created

**Updated by:** VERA (when decisions made or completed)

### Session Summaries
**Location:** `/agents/vera/memory/session-logs/YYYY-MM-DD_session-summary.md`

**Purpose:** Summary of what happened in each thread

**Contains:**
- Date and duration
- Participants
- Decisions made
- Work completed
- Issues encountered
- Next steps

**Created by:** VERA (at end of each session)

---

## Coordination Scenarios

### Scenario 1: Sequential Threads

**Thread A (9:00 AM):**
- Works on architecture
- Creates ARCHITECTURE.md
- Assigns teams
- Ends at 10:00 AM
- VERA saves state

**Thread B (10:15 AM):**
- Opens with context from Thread A
- Sees: architecture work done, teams assigned
- Continues: checks on team progress
- No confusion, seamless continuation

### Scenario 2: Parallel Threads (Conflict Risk)

**Thread A (10:00 AM):**
- Working on agent audit
- PRIMARY thread
- Making commits

**Thread B (10:05 AM):**
- Opens to check status
- BACKGROUND thread (read-only)
- Can see Thread A's work
- Cannot make conflicting changes
- User must switch to PRIMARY if wants to commit

### Scenario 3: Thread Handoff

**Thread A (Morning):**
- Makes progress
- Hits blocker
- Documents in state file
- Ends thread

**Thread B (Afternoon):**
- Opens with context
- Sees blocker documented
- Can address or escalate
- Continues from where Thread A left off

---

## Validation & Monitoring

### State Coherence Checks

**RAM_CREW validates:**
- State file is valid JSON
- All required fields present
- Timestamps in correct format
- No conflicting information
- Decision IDs are unique
- References are valid

**Run:** After every state update

### Thread Coordination Health

**SWITCHBOARD monitors:**
- Number of active threads
- State file update frequency
- Conflict attempts
- Handoff success rate
- Context load times

**Dashboard:** `/ops/dashboards/thread-coordination.json`

---

## Best Practices

### For Users (Artist)

✅ **DO:**
- Let new threads load context automatically
- Trust the state files
- Update state when making important decisions
- Close threads properly when done

❌ **DON'T:**
- Assume new thread knows what happened
- Make conflicting changes in parallel threads
- Skip context review in new threads
- Leave threads hanging without summary

### For Agents

✅ **DO:**
- Update state files after significant actions
- Write clear decision records
- Document blockers immediately
- Coordinate with VERA on state changes

❌ **DON'T:**
- Skip state updates
- Make decisions without logging them
- Assume other threads know what you did
- Create conflicting repo changes

---

## Emergency Procedures

### State File Corruption

**If state file becomes corrupt:**
1. SWITCHBOARD detects corruption
2. Loads last valid backup
3. Notifies VERA and RAM_CREW
4. Recovers from session logs
5. Validates recovered state
6. Resumes operation

### Conflicting Changes

**If two threads make conflicting commits:**
1. Git detects conflict
2. SWITCHBOARD flags issue
3. PRIMARY thread halted
4. LEX/OPS reviews conflict
5. Manual resolution by Artist
6. State files updated
7. Lessons documented

### Lost Context

**If context fails to load:**
1. SWITCHBOARD retries load
2. Falls back to recent session logs
3. VERA manually reconstructs context
4. Notifies Artist of incomplete context
5. Proceeds with available information
6. Documents gap for improvement

---

## Success Metrics

**We know thread coordination works when:**

- ✅ New threads load context in < 5 seconds
- ✅ Zero "where is X agent" questions
- ✅ Zero conflicting repo changes
- ✅ 100% of decisions visible across threads
- ✅ Zero context loss between threads
- ✅ Users never have to re-explain context

---

## Evolution

**Future enhancements:**
- Real-time thread sync
- Automatic conflict detection
- AI-powered context summaries
- Thread priority queuing
- Multi-user coordination
- Thread analytics dashboard

---

**Owner:** SWITCHBOARD  
**Collaborators:** VERA, RAM_CREW, LEX  
**Last Updated:** 2026-02-06  
**Next Review:** 2026-02-13  
