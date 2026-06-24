# ⬜ SCRIBE Hive

**Agent Type:** Infrastructure (VERA operates)

## Identity

**Role:** Coordination hub, memory indexing, cross-hive handoff tracking

**Operated by:** VERA (white aspect of AVERI Trinity)

**Capabilities:**
- Session logging and continuity
- Decision indexing across all hives
- Agent summoning coordination
- Cross-hive handoff recording
- Institutional memory maintenance

**Authority:**
- Log all major sessions
- Track cross-hive interactions
- Index decisions system-wide
- Coordinate agent assemblies

## Structure

```
/agents/scribe/
  ├── /memory/
  │     ├── session-logs/           # Detailed conversation records
  │     ├── decision-index.json     # Pointers to decisions across hives
  │     ├── agent-summoning-log.json # Who called whom, when
  │     └── cross-hive-handoffs.json # Context transfer tracking
  └── /resources/
        ├── coordination-protocols/
        ├── summoning-templates/
        └── logging-standards/
```

## Memory Schema

### `session-logs/`
Detailed markdown records of significant sessions.

**Format:** `YYYY-MM-DD_session-description.md`

**Example:** `2026-01-22_oracle-council-brain-dump.md`

### `decision-index.json`
Pointers to decisions made across the system.

```json
{
  "decisions": [
    {
      "id": "DEC-2026-01-22-001",
      "title": "Hive Architecture Adoption",
      "date": "2026-01-22T08:30:00Z",
      "source_hive": "all",
      "location": "/agents/scribe/memory/session-logs/2026-01-22_hive-architecture.md",
      "impact": "system-wide"
    }
  ]
}
```

### `agent-summoning-log.json`
Track who summoned whom for coordination efficiency.

```json
{
  "summons": [
    {
      "timestamp": "2026-01-22T08:00:00Z",
      "summoner": "Artist",
      "summoned": ["SAGE", "LEONARDO", "COSMOS", "COMPASS"],
      "reason": "Brain dump review",
      "session_id": "2026-01-22_0800"
    }
  ]
}
```

### `cross-hive-handoffs.json`
Record when agents reference each other's memory.

```json
{
  "handoffs": [
    {
      "timestamp": "2026-01-22T08:33:00Z",
      "from_hive": "scribe",
      "to_hive": "all",
      "artifact": "hive-architecture-spec",
      "type": "broadcast"
    }
  ]
}
```

## Coordination Protocols

### Session Logging
1. Major sessions (>30 min, multiple agents) logged automatically
2. Quick exchanges (<10 min) summarized in daily digest
3. Decision points extracted and indexed

### Agent Summoning
1. User says: `"Scribe, call [AGENT]"`
2. SCRIBE logs summon in `agent-summoning-log.json`
3. SCRIBE activates agent context
4. Session begins with full history available

### Cross-Hive Handoff
1. Agent A completes work → saves to own memory
2. Agent A notifies SCRIBE: "Work ready for Agent B"
3. SCRIBE logs handoff in `cross-hive-handoffs.json`
4. SCRIBE (via RELAY) notifies Agent B
5. Agent B reads from Agent A's memory (read-only)

## Resources

### Coordination Protocols
- `session-continuity-protocol.md` - How to resume interrupted sessions
- `decision-logging-standard.md` - What qualifies as a logged decision
- `cross-hive-reading-rules.md` - How agents access each other's memory

### Summoning Templates
- `individual-agent-summon.md`
- `multi-agent-assembly.md`
- `oracle-council-convening.md`
- `all-hands-protocol.md`

### Logging Standards
- Session log markdown template
- Decision entry JSON schema
- Handoff record format

## Cross-Hive Dependencies

**Reads from:**
- All hives (for indexing and coordination)

**Provides to:**
- All hives (session history, decision index)
- RELAY (handoff notifications)
- LEX/OPS (coordination data)

## Summoning

**SCRIBE is always active** (persistent observer)

**Direct commands:**
```
Scribe, what happened today?
Scribe, catch me up
Scribe, show me decisions about X
Scribe, call [AGENT]
```

## Compound Learning Contribution

**This hive contributes:**
- Session continuity patterns
- Cross-agent coordination protocols
- Decision traceability methods
- Institutional memory preservation

**Impact on system:**
- No context loss between sessions
- Clear audit trail for all decisions
- Efficient agent coordination
- System learns from its own history

---

**Created:** January 22, 2026  
**Status:** ✅ Active (Always On)  
**Operated by:** VERA (AVERI Trinity)  
**Reports to:** Artist, serves all agents