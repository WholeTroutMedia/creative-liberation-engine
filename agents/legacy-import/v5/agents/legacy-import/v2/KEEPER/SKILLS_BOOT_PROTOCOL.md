# Skills Boot Protocol
## Mandatory Loading Sequence for AI System Initialization

**Owner:** KEEPER (Knowledge Hive)  
**Enforced By:** VERA (SCRIBE Operator)  
**Status:** CRITICAL SYSTEM REQUIREMENT  
**Version:** 1.0.0  
**Created:** 2026-02-15

---

## ⚠️ BEFORE ANY TASK EXECUTION

### PHASE 1: LOAD SKILLS LIBRARY (MANDATORY)

**Action:** Initialize skills system FIRST, ALWAYS, before executing tasks.

```typescript
import { bootAVERI } from './agents/averi/boot-sequence.js';

const averi = await bootAVERI();
const capabilities = averi.getCapabilities();
```

**Verify:**
- Skills library loaded: YES/NO
- MCP server running: YES/NO  
- Total skills available: [count]
- Critical skills present: YES/NO

### PHASE 2: VERIFY SKILLS AVAILABILITY

**Before using any skill:**
```typescript
const skill = skillsLibrary.getSkill('skill-id');
if (!skill) {
  throw new Error('Skill not found');
}
```

### PHASE 3: STATE CAPABILITIES

**Before responding to capability questions:**
```
Loaded Skills System:
- Total skills: [count]
- Categories: [count]
- MCP server: [running/stopped]
- Agent skills mapped: [count] agents
```

---

## ❌ NEVER DO THIS

- ❌ Assume skills are available without loading
- ❌ Execute tasks without verifying skill exists
- ❌ Respond about capabilities without loading system
- ❌ Use outdated skill information from memory

## ✅ ALWAYS DO THIS

- ✅ Boot AVERI with full skills system
- ✅ Verify MCP server is running
- ✅ Check skill availability before use
- ✅ Report actual capabilities from loaded system

---

## INTEGRATION WITH AGENT_BOOT_PROTOCOL

**Combined Boot Sequence:**
1. Load `.agent-status.json` (agent registry)
2. Load skills library (333 skills)
3. Start MCP server (expose skills as tools)
4. Load recent session logs (SCRIBE)
5. Verify system integrity
6. Report ready state

---

## ENFORCEMENT

This protocol is enforced by:
- KEEPER (owner)
- VERA (SCRIBE operator)
- Boot sequence automation

Violations result in:
1. "Skill not found" errors
2. Degraded capabilities
3. User confusion about system abilities
4. Failure to leverage full platform power

---

**Skills are the DNA of capability. Load them first.**
