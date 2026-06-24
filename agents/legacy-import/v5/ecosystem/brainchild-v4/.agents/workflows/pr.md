---
description: Create a pull request with constitutional review summary via GitHub MCP
---

# /pr — Create Pull Request

Create a GitHub pull request with a built-in constitutional compliance summary. Every PR gets LEX-reviewed before it goes up.

## Steps

// turbo

1. Get current branch and recent commits:

```powershell
git -C "[repo-root]" branch --show-current
git -C "[repo-root]" log main..[current-branch] --oneline
git -C "[repo-root]" diff main --stat
```

// turbo
2. **LEX preflight on the diff** — Run constitutional review:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `LEX`
- `input`: `{"scanType": "preflight", "content": "[summary of changes from git log and diff stat]", "agentName": "PR-creator"}`

If LEX returns `HALT` → fix violations before creating PR.

1. **Draft PR description** — Generate a PR body including:
   - **What changed** (feature/fix summary)
   - **Why** (links back to task ID or IDEATE doc if applicable)
   - **Constitutional review**: "LEX: [PASS/WARNING] — [any notes]"
   - **Test coverage**: what was tested
   - **Deployment notes**: any infra changes

2. **Create the PR** via GitHub MCP:

Use `github-mcp-server` `create_pull_request` with:

- `owner`: `WholeTroutMedia`
- `repo`: `creative-liberation-engine-v4` or `creative-liberation-engine-v5`
- `title`: `[feat/fix/chore]([scope]): [one-line summary]`
- `head`: [current branch]
- `base`: `main`
- `body`: [generated PR description]

1. Report PR URL to user. Offer: "Run `/deploy` to deploy this branch to Cloud Run for review?"
