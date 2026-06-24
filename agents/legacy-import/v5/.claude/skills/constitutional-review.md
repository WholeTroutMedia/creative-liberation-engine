---
description: Run a LOGD constitutional review on the current staged changes before committing. Checks Article I (sovereignty), Article IV (TypeScript quality), Article IX (completeness), and Article XX (no human wait time).
---

# Skill: constitutional-review

Run a structured LOGD-style constitutional review on all staged or recently modified files before committing.

## Steps

1. Run `git diff --staged` (or `git diff HEAD` if nothing is staged) to get the current changeset
2. For each changed TypeScript/JavaScript file:
   - Check for `any` types — flag every occurrence
   - Check for `require()` — ESM only allowed
   - Check for swallowed errors (empty catch blocks)
   - Check for unhandled Promise rejections
3. Review intent of changes against constitutional articles:
   - **Article I:** Does it increase or maintain sovereignty? (no new cloud vendor lock-in)
   - **Article IV:** TypeScript strict compliant?
   - **Article IX:** Is the implementation complete (no stubs, no TODO placeholders in production paths)?
   - **Article XX:** Are there any synchronous blocking operations that should be async?
4. Produce the LOGD review format:

```
## LOGD Constitutional Review
Timestamp: [ISO timestamp]
Files reviewed: [count]
Status: ✅ APPROVED | ⚠️ CONDITIONAL | ❌ BLOCKED

### Issues
[list with severity: Critical/Major/Minor]

### Constitutional Status
- Article I (Sovereignty): ✅/❌
- Article IV (Quality):     ✅/❌
- Article IX (Completeness): ✅/❌
- Article XX (Zero Wait):   ✅/❌

### Verdict
[Clear recommendation: commit, fix first, or escalate]
```

1. If approved, proceed with `git commit -m "type(scope): description"`
2. If blocked, surface the issues and wait for resolution before committing
