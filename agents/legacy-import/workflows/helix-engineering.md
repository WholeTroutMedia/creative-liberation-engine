# Helix: Engineering & Code

> Parent: [IPSV-SPINE.md](./IPSV-SPINE.md)
> Helix ID: `helix-engineering`

---

## IDEATE

### Outputs
- Problem framing: what's broken, what's missing, what's needed
- Solution sketches (2–3 approaches when non-obvious)
- Prior art: existing patterns in the codebase, relevant SCRIBE episodes
- Technical constraints identified (stack, APIs, performance, security)
- Scope boundaries: what's in, what's deferred

### Questions to Resolve
- What user/system problem does this solve?
- What's the simplest thing that could work?
- Does this touch existing architecture or is it greenfield?
- What are the failure modes?
- What's the testing strategy?

---

## PLAN

### Outputs
- Spec / ticket: scope, acceptance criteria, edge cases
- Implementation plan: ordered steps, estimated complexity
- Environment requirements (deps, envs, services needed)
- Observability plan: what to log, what to monitor
- Test plan: unit, integration, smoke

### Constraints
- Reference CONSTITUTION.md Article XIV (Testing Mandate)
- Reference CONSTITUTION.md Article VI (Quality Gates)
- Never start coding without acceptance criteria
- Break into PRs < 400 lines when possible

---

## SHIP

### Phases
1. **Branch + scaffold** — Create branch, stub files, set up test harness
2. **Implement** — Build against the spec. Test as you go.
3. **Self-review** — Read your own diff. Fix obvious issues.
4. **PR + CI** — Push, run CI, address failures
5. **Deploy** — Merge to main, deploy to target environment

### Outputs
- Code committed and merged
- Tests passing in CI
- Deployed to target environment
- Handoff notes if another agent/helix needs to continue

---

## VALIDATE

### Checks
- **Correctness:** Does it solve the stated problem?
- **Test coverage:** Are critical paths covered?
- **Performance:** No regressions, acceptable latency
- **Security:** No new vulnerabilities, secrets managed properly
- **Architecture fit:** Consistent with existing patterns, no unnecessary complexity
- **Constitution compliance:** Article VI (quality gates), Article XIV (testing)

### Learning Log
- What patterns should be extracted for reuse?
- Were there unexpected blockers? How to prevent next time?
- Did the estimate match reality? What caused drift?
- What should be refactored in a follow-up?

---

## Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-27 |
| Author | COMET + Artist |
| Parent | IPSV-SPINE.md |