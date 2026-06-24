---
name: SCRIBE Memory Skill
description: Activates SCRIBE mode for writing memories to ChromaDB/NAS â€” structured memory tagging, episodic vs semantic classification, and cross-session knowledge preservation.
---

# SCRIBE Memory â€” Creative Liberation Engine Skill

## When to Activate

Activate this skill when:

- A significant decision was made that should persist
- A pattern or lesson was learned that applies broadly
- A session is ending and key context should be preserved
- The user says "remember this", "log this", "save that"
- Cross-session sync shutdown protocol runs

## Memory Types

| Type | Use When | TTL |
|------|----------|-----|
| **Episodic** | Specific events, decisions, session outcomes | 90 days |
| **Semantic** | Patterns, principles, architectural decisions | Permanent |
| **Procedural** | How-to knowledge, workflow steps | Until superseded |

## Memory Writing Protocol

### Format

```
python cli/scribe.py "[MEMORY_CONTENT]" --tags [tag1] [tag2] --type [episodic|semantic|procedural]
```

### Memory Content Format

A well-formed memory has:

1. **What happened** (1-2 sentences, past tense, specific)
2. **Why it matters** (1 sentence â€” the principle or lesson)
3. **Action implication** (1 sentence â€” what to do differently or same next time)

### Tagging Convention

Always include:

- Component tag: `genkit`, `console`, `browser`, `infra`, `design`, etc.
- Type tag: `decision`, `lesson`, `pattern`, `blocker`, `breakthrough`
- Version tag: `v4` or `v5`

## Examples

**Good episodic memory:**
> "Switched from Docker-in-Docker to socket passthrough for Gitea CI runners â€” DinD caused iptables exhaustion on the NAS. Socket passthrough is stable. Tag: infra, decision, v5"

**Good semantic memory:**
> "Creative Liberation Engine reads AGENTS.md automatically at session start â€” use this file for any project-specific boot instructions. No slash commands needed. Tag: cle, pattern, v5"

## NAS ChromaDB Endpoint

- Host: `127.0.0.1:8000`
- Collection: `creative_liberation_engine_memory`
- Fallback: GitHub `.sync/` protocol if NAS unavailable
