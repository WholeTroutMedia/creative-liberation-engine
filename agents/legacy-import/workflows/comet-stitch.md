---
description: Pipe a single design spec prompt into Google Stitch via Comet, export the output HTML, and save it to the target file — fully automated, no manual copy-paste
---

# /comet-stitch — Automated Stitch Build via Comet

// turbo-all

## Variables (set these before running)

- `SPEC_FILE` — path to the Stitch mega-prompt text file (usually output of a design spec)
- `TASK_ID` — the dispatch task ID that spawned this stitch run
- `STITCH_URL` — `https://stitch.withgoogle.com` (Comet must already be authenticated)

---

## Step 1 — Read the mega-prompt

Read the content of `SPEC_FILE` into memory. This is the single prompt that will be pasted into Stitch.

## Step 2 — Open Stitch

Navigate to `STITCH_URL`. Wait for the editor to fully load (look for the prompt input or "New Project" button).

## Step 3 — Start a new project

Click "New Project" or the equivalent CTA to open a blank Stitch canvas.

## Step 4 — Paste the mega-prompt

Find the prompt input (usually a text area or chat input at the bottom of the canvas). Paste the full content of `SPEC_FILE` in one shot. Submit.

## Step 5 — Wait for generation

Wait for Stitch to complete generation. Monitor for the preview to stabilize (no loading spinners). This typically takes 20–60 seconds.

## Step 6 — Inspect output

Take a screenshot of the generated UI. Verify:
- Dark background is present (#04070F range)
- Magenta/cyan color accents are visible
- Step indicator rail with 5 steps is rendered
- INITIALIZE button is present

If any of these fail, use the Stitch chat to send a correction: "Add the missing [element] per the spec." Then re-verify.

## Step 7 — Export HTML

Click the export or code button (usually labeled "Export", "Code", or "</>"). Copy the full HTML output.

## Step 8 — Attach Artifact Payload

Resolve the task you are working on by attaching the full exported HTML string as the `artifact_payload` parameter when calling the dispatch server API.

// turbo
```powershell
   $body = @{ agent_id = "comet-stitch"; note = "Stitch generation complete"; artifact_payload = $exportedHtml } | ConvertTo-Json -Depth 10
   Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/tasks/$TASK_ID/resolve" -Method POST -ContentType "application/json" -Body $body
```

## Step 9 — Report back

Return to the IDE and report:
- Screenshot of the final Stitch output
- Confirmation that the artifact was attached via task resolution
- Any elements Stitch didn't generate (JS logic, health check fetch, etc.) that the IDE agent needs to add

---

## Handoff

After this workflow completes, the IDE agent (Antigravity) takes over to:
1. Pull the artifact via `/pickup-artifact`
2. Add the JavaScript logic layer (health check fetches, env generation, copy-to-clipboard)
3. Validate the file opens correctly in a browser
4. Commit via `/commit`
