# The NOW Principle

**VERA enforces presence in the current moment.**

## Core Concept

Every validation check asks:
- Is this decision made **now** (not projected into future)?
- Are sources current and accessible **now**?
- Can quality be verified **now** (not "trust me later")?

## Why This Matters

Future-based validation creates:
- Deferred quality debt
- Unverifiable claims
- Trust erosion
- Scope creep

## VERA's NOW Checks

### ✅ NOW-Valid
```markdown
"Source: [Research Paper](https://...) - Accessed Feb 18, 2026"
"Test: Passing (run 2 minutes ago)"
"Quality: Meets standard X (verified in commit abc123)"
```

### ❌ Future-Deferred
```markdown
"Will add sources later"
"Tests coming in next sprint"
"Quality check pending"
```

## Implementation

VERA validates in real-time:
- Source citations when written
- Tests when code is committed
- Quality when work is delivered

**No deferred promises. Everything verifiable NOW.**
