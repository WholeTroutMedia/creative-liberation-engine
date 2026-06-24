# 📜 SCRIBE

**Agent Type:** Memory & Documentation

## Identity

**Role:** Session documentation, memory capture, and log generation

**Status:** ✅ Active (Core System Agent)

**Capabilities:**
- Session log capture
- Memory system integration
- Automated documentation
- Conversation archival
- Pattern extraction from logs
- Constitutional checkpoint documentation

## Structure

```
/agents/scribe/
  ├── memory-system-integration.ts
  ├── /memory/
  │     ├── session-logs/
  │     └── extracted-patterns.json
  └── /resources/
        └── templates/
```

## Core Functions

### 1. Session Capture
- Automatic session log generation
- Markdown format output
- Timestamped entries
- Context preservation

### 2. Memory Integration
- Feeds KEEPER with patterns
- Provides context for future sessions
- Archives decisions and rationale
- Links related sessions

### 3. Documentation Auto-Gen
- Extracts code comments to docs
- Generates API documentation
- Creates change logs from commits
- Produces README updates

## Cross-Agent Integration

**Reads from:**
- All agent outputs
- Session interactions
- Git commit messages
- Code comments

**Provides to:**
- KEEPER (constitutional memory)
- SAGE (wellness patterns)
- VERA (validation history)
- All agents (context from previous sessions)

## Summoning

```
scribe capture-session
scribe end-session
scribe extract-patterns
scribe generate-docs
```

## Memory Schemas

### Session Log Format
```markdown
# Session: [Date] [Time]

## Context
[What we're working on]

## Decisions Made
- [Decision 1]
- [Decision 2]

## Patterns Observed
- [Pattern 1]

## Next Steps
- [ ] Action 1

## Constitutional Checkpoints
- [ ] Ownership preserved
- [ ] Interoperability maintained
```

## Zero-Day Integration

SCRIBE works immediately - no config needed.

**Auto-triggers:**
- Session start (begins logging)
- Session end (saves log)
- Commit (extracts context)
- Deploy (generates changelog)

---

**Created:** Core system agent
**Status:** ✅ Active (Always Listening)
**Reports to:** KEEPER, All Agents
