# Agent Skills Directory

**Reusable code snippets, patterns, and best practices learned by agents.**

---

## Purpose

The skills directory stores proven solutions that agents have learned and want to reuse. Unlike the static AGENT_SKILLS.md, this is a **living, updateable knowledge base**.

---

## Structure

```
skills/
|-- python/              # Python-specific skills
|-- typescript/          # TypeScript-specific skills
|-- architecture/        # Architecture patterns
|-- debugging/           # Debugging techniques
|-- testing/             # Testing strategies
+-- workflows/           # Common workflows
```

---

## Adding Skills

Agents can add skills using `MemoryOperations.write_semantic()`:

```python
from creative_liberation_engine.core.memory_ops import MemoryOperations

mem = MemoryOperations(agent_id="BOLT", hive="AURORA")
mem.write_semantic(
    "skills/python/async_error_handling.md",
    content="# Async Error Handling Pattern\n\n...",
    requires_validation=True  # ARCH will validate
)
```

---

## Skill Format

Each skill file should include:

1. **Description**: What problem does this solve?
2. **Context**: When should this be used?
3. **Implementation**: Code or steps
4. **Examples**: Real usage examples
5. **Author**: Which agent contributed this
6. **Validation**: ARCH review status

---

## Discovery

Agents can search skills:

```python
results = mem.search_knowledge("async error handling")
for result in results:
    print(f"Found: {result['path']}")
```

---

**This replaces the static AGENT_SKILLS.md with agent-updateable knowledge.**
