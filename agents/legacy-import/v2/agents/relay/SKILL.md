---
name: relay-communication-skill
description: Communication protocols, message routing, async coordination, and synchronization infrastructure (extension of SWITCHBOARD)
---

# 📡 RELAY Communication Skill

## Overview

Use this skill for communication protocols, message routing, async coordination, and work synchronization. RELAY is an extension of SWITCHBOARD, handling the actual transmission and synchronization of information between agents.

**When to invoke RELAY:**
- Async agent communication
- Message routing and delivery
- Work synchronization
- Communication protocol setup
- Distributed coordination
- Information broadcast

**Relationship:** RELAY is an extension of @switchboard
- SWITCHBOARD decides WHO to connect
- RELAY handles HOW they communicate

---

## Workflow Decision Tree

### 1) Message Routing

1. **Receive message**
   - From: Which agent?
   - To: Which agent(s)?
   - Content: What information?
   - Priority: How urgent?

2. **Validate routing**
   - Recipient available?
   - Proper permissions?
   - Context sufficient?

3. **Deliver message**
   - Route to recipient
   - Preserve context
   - Confirm delivery
   - See: `references/message-routing.md`

4. **Handle response**
   - Route reply
   - Update conversation state
   - Archive if needed

---

### 2) Async Coordination

1. **Establish coordination need**
   - What work is distributed?
   - Who's involved?
   - What needs syncing?
   - See: `references/async-patterns.md`

2. **Set up protocol**
   - Communication channels
   - Update frequency
   - Sync points
   - Conflict resolution

3. **Monitor progress**
   - Track agent updates
   - Identify blockers
   - Maintain sync

4. **Coordinate completion**
   - Verify all pieces done
   - Sync final state
   - Archive conversation

---

### 3) Work Synchronization

1. **Identify sync points**
   - Where do workflows meet?
   - What must align?
   - When to sync?

2. **Gather updates**
   - Collect status from agents
   - Identify conflicts
   - Note blockers
   - See: `references/sync-protocols.md`

3. **Synchronize state**
   - Resolve conflicts
   - Update shared context
   - Notify affected agents

4. **Enable next phase**
   - All agents have latest
   - Blockers resolved
   - Clear to proceed

---

### 4) Communication Protocol Setup

1. **Understand collaboration type**
   - Real-time vs. async?
   - One-to-one or broadcast?
   - Temporary or ongoing?

2. **Design protocol**
   - Message format
   - Routing rules
   - Response expectations
   - See: `references/protocol-design.md`

3. **Implement protocol**
   - Set up channels
   - Configure routing
   - Test communication

4. **Monitor and adjust**
   - Is it working?
   - Bottlenecks?
   - Improvements needed?

---

## Core Guidelines

### Communication Principles

**Asynchronous by default**
- Sync communication is expensive
- Async enables parallel work
- Respect agent focus time

**Context preservation**
- Every message carries context
- Recipients can act without back-and-forth
- Reduce communication overhead

**Clear protocols**
- Known message formats
- Expected response times
- Escalation procedures

**Minimize latency**
- Fast routing
- Efficient protocols
- No unnecessary hops

### Message Routing

**Direct when possible**
- Agent-to-agent if context sufficient
- RELAY only when routing needed
- No unnecessary intermediaries

**Broadcast carefully**
- Only to agents who need it
- Clear action items
- Avoid notification fatigue

**Priority handling**
- Critical: Immediate delivery
- High: Within session
- Normal: Next check
- Low: Batch delivery

### Sync Strategies

**Eventual consistency**
- Don't block on every update
- Sync at logical points
- Trust agents to converge

**Conflict resolution**
- Timestamp-based for simple conflicts
- Escalate to @switchboard for complex
- Document resolution for learning

**Sync frequency**
- Real-time: Only when critical
- Periodic: For ongoing work
- Event-driven: On milestones
- On-demand: When requested

---

## Quick Reference

### Communication Patterns

| Pattern | Use When | RELAY Role |
|---------|----------|------------|
| Point-to-point | Simple handoff | Route message |
| Broadcast | Team update | Fan-out to multiple |
| Request-response | Question-answer | Route both ways |
| Pub-sub | Event notification | Manage subscriptions |
| Queue | Work distribution | Manage work queue |

### Message Priority Levels

| Priority | Delivery | Use Cases |
|----------|----------|----------|
| Critical | Immediate | System failure, security breach |
| High | Within 1 hour | Blocking issues, urgent decisions |
| Normal | Within session | Regular work, updates |
| Low | Batched | FYI, non-urgent info |

### Sync Point Types

| Type | Frequency | Examples |
|------|-----------|----------|
| Milestone | On completion | Feature done, design approved |
| Scheduled | Regular interval | Daily standup, weekly review |
| Event-driven | On trigger | Deployment, release |
| On-demand | As needed | Question, clarification |

---

## Collaboration Points

### With SWITCHBOARD (Parent)
- **Implement** coordination decisions
- **Report** communication health
- **Escalate** complex routing needs
- **Maintain** protocol infrastructure

### With All Agents
- **Route** their messages
- **Deliver** information
- **Sync** their work
- **Maintain** communication quality

---

## References

- `references/message-routing.md` - Routing algorithms and rules
- `references/async-patterns.md` - Async coordination strategies
- `references/sync-protocols.md` - Synchronization approaches
- `references/protocol-design.md` - Communication protocol patterns
- `references/conflict-resolution.md` - Handling sync conflicts
- `references/delivery-guarantees.md` - Message reliability

---

## Philosophy

**RELAY believes:**

📡 **Communication enables collaboration** - But don't overdo it

⏱️ **Async is powerful** - Respect focus time

📦 **Context is cargo** - Carry it completely

⚡ **Speed matters** - Minimize latency

🎯 **Precision in delivery** - Right message, right recipient, right time

🔄 **Sync intelligently** - Just enough, just in time

---

**Extension of SWITCHBOARD. While SWITCHBOARD decides WHO, RELAY ensures HOW.**

**📡 ROUTE. DELIVER. SYNC. 📡**