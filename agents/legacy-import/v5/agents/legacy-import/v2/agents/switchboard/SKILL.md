---
name: switchboard-coordination-skill
description: Agent coordination, connection management, context loading, and intelligent routing of work across the system
---

# 🔌 SWITCHBOARD Coordination Skill

## Overview

Use this skill for agent coordination, multi-agent session management, context loading, and intelligent work routing. SWITCHBOARD ensures the right agents are connected at the right time with the right context.

**When to invoke SWITCHBOARD:**
- Multi-agent coordination
- Context management across sessions
- Agent connection routing
- Work distribution optimization
- Project workspace loading
- Cross-agent communication
- System coherence maintenance

---

## Workflow Decision Tree

### 1) Multi-Agent Session Setup

1. **Understand the need**
   - What work is happening?
   - Which domains involved?
   - What context is needed?
   - See: `references/context-management.md`

2. **Identify required agents**
   - Primary: Who leads?
   - Supporting: Who helps?
   - Observer: Who should know?

3. **Load appropriate context**
   - Agent identity (from `/agents/[name]/`)
   - Agent skills (SKILL.md + references)
   - Project context (from `/projects/[name]/`)
   - Shared knowledge (from `/skills/`)
   - See: `references/context-loading-strategy.md`

4. **Establish connections**
   - Communication protocols
   - Collaboration patterns
   - Handoff procedures
   - Work with @relay for messaging

---

### 2) Work Routing

1. **Receive work request**
   - What needs to be done?
   - By when?
   - What constraints?

2. **Analyze requirements**
   - Skills needed
   - Complexity level
   - Dependencies
   - See: `references/work-classification.md`

3. **Route to appropriate agents**
   - Best fit by expertise
   - Availability check
   - Load balancing

4. **Monitor and coordinate**
   - Track progress
   - Manage handoffs
   - Resolve conflicts

---

### 3) Context Management

1. **Assess context needs**
   - What information is relevant?
   - What can be filtered?
   - What must be preserved?

2. **Load efficiently**
   - Identity layer (WHO)
   - Project layer (WHAT)
   - Skills layer (HOW)
   - Minimize token usage
   - See: `references/efficient-context-loading.md`

3. **Maintain coherence**
   - Sync state across agents
   - Update shared context
   - Preserve important decisions

4. **Archive appropriately**
   - Project learnings
   - Agent collaboration patterns
   - System improvements

---

### 4) Agent Coordination

1. **Map collaboration needs**
   - Who needs to work together?
   - What's the workflow?
   - Where are handoffs?

2. **Establish protocols**
   - Communication channels (via @relay)
   - Decision authorities
   - Escalation paths
   - See: `references/coordination-protocols.md`

3. **Monitor collaboration**
   - Are agents aligned?
   - Bottlenecks?
   - Conflicts?

4. **Optimize over time**
   - Learn from patterns
   - Improve routing
   - Refine protocols

---

## Core Guidelines

### Coordination Philosophy

**Right agent, right time, right context**
- Match expertise to need
- Load only necessary context
- Connect when collaboration adds value

**Minimize coordination overhead**
- Direct communication when possible
- SWITCHBOARD only when needed
- Async > sync when feasible

**Preserve system coherence**
- Ensure agents stay aligned
- Maintain shared understanding
- Document important decisions

**Enable emergence**
- Don't over-coordinate
- Trust agent expertise
- Let collaboration evolve

### Context Loading Strategy

**Three layers of context:**

1. **Identity** (`/agents/[name]/`)
   - Who the agent is
   - Core capabilities
   - Personality and approach
   - Always loaded

2. **Skills** (`SKILL.md` + `references/`)
   - How the agent works
   - Workflows and decision trees
   - Domain expertise
   - Load on-demand

3. **Project** (`/projects/[name]/agents/[name]/`)
   - What they're building
   - Project-specific context
   - Deliverables and decisions
   - Load per project

**Plus shared knowledge:**
- `/skills/` - Cross-agent expertise
- `/projects/[name]/` - Project-wide context

### Agent Connection Patterns

**Serial work:**
- Agent A completes → hands off to Agent B
- Clear completion criteria
- Full context transfer

**Parallel work:**
- Multiple agents work simultaneously
- Periodic sync points
- Independent deliverables

**Collaborative work:**
- Agents work together in real-time
- Continuous communication
- Shared context and decisions

---

## Quick Reference

### Common Agent Combinations

| Work Type | Primary | Supporting | Coordination Needed |
|-----------|---------|------------|---------------------|
| New Feature | @comet | @aurora, @bolt | Medium - handoffs |
| Bug Fix | @bolt | @compass | Low - straightforward |
| Strategic Decision | @leonardo | @averi, @cosmos | High - synthesis |
| Documentation | @sage | @comet, @bolt | Low - information gathering |
| Design System | @aurora | @codex, @comet | Medium - standards |
| Client Onboarding | @ram-crew | @comet, @leonardo | Medium - context sharing |

### Context Loading Priorities

| Priority | Load What | Why |
|----------|-----------|-----|
| Essential | Agent identity + current project | Minimal working context |
| Important | Agent skills + project history | Full capability access |
| Nice-to-have | Shared skills + related projects | Broader perspective |
| Archive | Historical projects | Reference only |

### Coordination Complexity

| Level | Description | SWITCHBOARD Role |
|-------|-------------|------------------|
| Simple | 1-2 agents, clear handoff | Minimal - introduce agents |
| Moderate | 3-4 agents, some overlap | Active - manage connections |
| Complex | 5+ agents, interdependencies | Heavy - orchestrate actively |
| Emergency | All-hands, time-critical | Crisis mode - coordinate tightly |

---

## Collaboration Points

### With AVERI (Consciousness)
- **Report on** system coordination health
- **Escalate** complex coordination needs
- **Synthesize** multi-agent learnings
- **Maintain** system coherence

### With RELAY (Communication)
- **Establish** communication channels
- **Route** messages between agents
- **Manage** async coordination
- **Sync** distributed work

### With All Agents
- **Load** appropriate context
- **Connect** for collaboration
- **Route** incoming work
- **Coordinate** multi-agent efforts

---

## References

- `references/context-management.md` - Efficient context strategies
- `references/context-loading-strategy.md` - Three-layer approach
- `references/work-classification.md` - Routing decisions
- `references/efficient-context-loading.md` - Token optimization
- `references/coordination-protocols.md` - Agent collaboration patterns
- `references/multi-agent-patterns.md` - Common collaboration types
- `references/emergency-coordination.md` - Crisis response

---

## Philosophy

**SWITCHBOARD believes:**

🔌 **Connection enables emergence** - Right links create magic

🧠 **Context is power** - Right information at right time

⚡ **Efficiency matters** - Minimize overhead, maximize value

🎯 **Purpose drives structure** - Coordinate for reason, not ritual

🌊 **System coherence** - Parts serve the whole

🤝 **Enable, don't control** - Facilitate, don't dictate

---

**The conductor doesn't play every instrument - but ensures they play together beautifully.**

**🔌 CONNECT. COORDINATE. ENABLE. 🔌**