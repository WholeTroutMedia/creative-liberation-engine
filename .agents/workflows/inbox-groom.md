---
description: Groom untriaged articles from the Inbox into structured IDEATE phase templates
---

# `/inbox-groom` — Convert Inbox Tickets into IDEATE Templates

This workflow acts as the bridge between the raw `harvester` / `mobile-bridge` inbox and structured `IDEATE` creative sessions. It solves the problem of "What do I do with all these articles I just saved?" by converting them into actionable starting points.

## Prerequisites
- Requires `universal-prompter` skill.
- Requires `VAULT` to read external article content.

---

## Workflow Steps

1. **Pull the Raw Inbox**
   Query the dispatch board (`http://127.0.0.1:5050/api/tasks`) for all incomplete tasks where `source` is `harvester` or `mobile-bridge` AND `agent` is `VAULT`.

2. **Read the Context**
   For each task retrieved, identify the `url` from the `context` metadata.
   Use `VAULT`/`COMET` to securely read the article content or scrape the raw HTML.

3. **Universal Prompt Engineer Application**
   Run the UPE Skill on the article contents. You must generate:
   - **The Core Signal**: A 2-sentence summary of why this article matters for our system architecture, agent orchestration, or backend infrastructure.
   - **3 System Upgrade Trajectories**: How this concept could be integrated into the Creative Liberation Engine's core infrastructure, agent mesh, or deployment pipeline. STRICTLY avoid framing these as visual "design" or "UI" ideas. Focus entirely on backend features, automation, and system upgrades.
   - **Contrarian Stance**: What architectural or systemic reality is the article missing that we could exploit?

4. **Duplicate Checks & Balances Validation**
   Before creating a new IDEATE artifact, query the central sharded registry index by running the deduplication guard:
   ```bash
   ssh -p 2000 jaharoni@127.0.0.1 "python3 /app/creative-liberation-engine/scripts/ideation-dedup-guard.py --url '<url>' --guid '<guid>'"
   ```
   If the command exits with code 1 (duplicate found), skip creating a new file. If there is no exact metadata match, you may also run a `grep_search` across `apps/ideate-sessions/` to see if a similar topic is already being brainstormed.
   - If a duplicate or highly similar session exists, DO NOT create a new duplicate file.
   - Instead, append novel findings or trajectories to the existing file.

5. **Generate the IDEATE Template**
   If no duplicate exists, create a new file in `apps/ideate-sessions/`.
   Use the name format: `[YYYYMMDD]-[slugified-article-title].md`

   *Format:*
   ```markdown
   # IDEATE Session: [Article Title]
   **Source:** [URL]
   **Date:** [YYYY-MM-DD]
   
   ## The Core Signal
   [UPE Output Core Signal]

   ## System Upgrade Trajectories
   1. [Trajectory 1]
   2. [Trajectory 2]
   3. [Trajectory 3]

   ## Contrarian Stance
   [UPE Output Contrarian Stance]

   ---
   
   ## User Direction
   *(User: Drop your initial thoughts here, select a trajectory, and then run `/ideate [session-filename]`)*
   ```

6. **Update Rosters & Queues**
   - Resolve the raw `VAULT` task on the dispatch board by setting its status to done (`PATCH http://127.0.0.1:5050/api/tasks/[id]` with JSON body `{"status": "done"}`).
   - Open `.agents/dispatch/session-roster.md`.
   - Remove the item from `1. The Inlet`.
   - Add the new `.md` file link to `2. Active IDEATE Sessions` with the status `Awaiting User Input`.

7. **Notify the User**
   Tell the user how many articles were successfully groomed and provide hyperlinked paths to the generated IDEATE templates so they can instantly start exploring. If you appended to an existing template due to duplicate checks, link to that template and note the additions.
