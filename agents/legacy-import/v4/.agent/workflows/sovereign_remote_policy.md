---
description: Sovereign Infrastructure Policy — Gitea-Only Remote Policy
---

# Sovereign Remote Policy: Gitea/Forgejo ONLY

## Rule

**ALL git operations (push, pull, clone, CI/CD) use the self-hosted Forgejo instance exclusively.**

```
Remote: http://127.0.0.1:3000/WholeTroutMedia/
```

GitHub.com cloud is **PROHIBITED** unless the user explicitly directs it in the current session.

## Rationale

The Creative Liberation Engine is a sovereign AI OS. Storing code on third-party cloud platforms violates the sovereignty principle.

- Forgejo on NAS = sovereign, private, physically controlled
- GitHub = third-party cloud, Microsoft-owned, not sovereign

## Constitutional Reference

**Article XVIII — Anti-Lock-In**: Users must always be able to export their data and leave.  
**Article 0 — Sacred Mission**: Sovereign technology, free from gatekeepers.

## Enforcement

When any workflow, script, or tool requires a git remote:

1. ✅ Use `http://127.0.0.1:3000/WholeTroutMedia/{repo}.git`
2. ❌ Never use `github.com` remotes unless user explicitly says "use GitHub"

## Public Access

For public-facing releases, expose Forgejo via public domain (e.g., `git.wholetrout.media`) with TLS. Do NOT mirror to GitHub unless explicitly directed.

## Applies To

All workflows, CI/CD, README clone URLs, agent-generated scripts, and environment configs.
