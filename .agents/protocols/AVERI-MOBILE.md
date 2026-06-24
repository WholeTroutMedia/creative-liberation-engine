# AVERI-MOBILE Protocol

> **Version:** 1.0.0 | **Status:** Active | **Owner:** LOGD (CORTEX Collective)

This protocol defines how AVERI is invoked from mobile devices (Comet iOS) and how the Cafe Workflow operates end-to-end.

---

## The Cafe Workflow

The canonical mobile-first workflow for operating the Creative Liberation Engine remotely:

```
1. OPERATOR opens Comet iOS at any location
2. OPERATOR opens reference tabs (Gitea, dashboards, research)
3. OPERATOR says: "AVERI, what's the current state of [workstream]?"
4. COMET invokes averi/invoke (ATHENA mode) with tab context
5. ATHENA queries dispatch API + memory -> returns strategic summary
6. OPERATOR says: "Ideate on what's missing for [feature]"
7. COMET runs browser-ideate: classifies tabs -> generates creative brief
8. Brief fed to AVERI/ATHENA -> produces creative directions
9. OPERATOR says: "Create a task for [directive]"
10. COMET invokes averi/invoke (IRIS mode)
11. IRIS creates task in dispatch queue via POST /api/tasks
12. ntfy push confirms task creation on iPhone
13. Back at workstation, ANTIGRAVITY picks up task -> PLAN -> SHIP
```

---

## Natural Language -> Trinity Mode Mapping

Comet iOS should auto-detect the appropriate trinity mode from natural language:

| Pattern | Mode | Intent |
|---|---|---|
| "what's the status of..." | ATHENA | STATUS |
| "what should I focus on" | ATHENA | STATUS |
| "ideate on..." / "brainstorm..." | ATHENA | IDEATE |
| "what's the creative direction for..." | ATHENA | IDEATE |
| "what do we know about..." | VERA | MEMORY |
| "recall..." / "remember when..." | VERA | MEMORY |
| "what was decided about..." | VERA | MEMORY |
| "create a task for..." | IRIS | DISPATCH |
| "file a blocker..." | IRIS | DISPATCH |
| "dispatch...to ANTIGRAVITY" | IRIS | DISPATCH |
| "assign...to [workstream]" | IRIS | DISPATCH |

---

## Context Passing

When invoking AVERI from mobile, the context object should include:

```json
{
  "tabs": [
    { "url": "http://127.0.0.1:3000/...", "title": "Gitea dashboard" },
    { "url": "https://...", "title": "Reference page" }
  ],
  "signal": "operator's natural language input",
  "location": "mobile",
  "network": "5G" | "wifi" | "lan",
  "workstream": "zero-day-gtm"
}
```

The `tabs` array comes from Comet's active tabs. The `signal` is the operator's spoken or typed input. The `workstream` is optional and helps ATHENA filter to relevant context.

---

## Response Formatting for Mobile

AVERI responses on mobile should be:
- **Concise** — optimized for small screen reading
- **Action-oriented** — each response ends with a recommended next action
- **Structured** — use headers and bullet points, not paragraphs
- **Actionable** — IRIS responses should confirm what was created with task IDs

### ATHENA Response Template
```
## [Workstream] Status
- Active tasks: [count]
- Last handoff: [summary]
- Blockers: [count or "none"]

## Recommendation
[One clear next action]
```

### VERA Response Template
```
## Context: [Topic]
- [Key fact 1]
- [Key fact 2]
- Decision: [What was decided and when]
- Source: [scribe memory ref]
```

### IRIS Response Template
```
## Action Taken
- Task created: T20260319-XXX
- Workstream: [workstream]
- Priority: [P0/P1/P2]
- Assigned to: [agent or "dispatch queue"]
```

---

## Authentication

All AVERI invocations from mobile require:
- Genkit endpoint: No additional auth (Cloud Run public, rate-limited)
- Dispatch API calls within IRIS mode: Bearer token via `DISPATCH_API_KEY`
- SCRIBE memory queries within VERA mode: Internal to Genkit flow (no separate auth)

---

## Offline/Degraded Mode

If the dispatch gateway is unreachable:
- ATHENA can still provide analysis based on cached/known state
- VERA can still query SCRIBE (independent of dispatch)
- IRIS will return an error with the failed action queued for retry
- NAVD-M should file the connectivity issue as a blocker when connection resumes

---

## Push Notification Integration

AVERI actions that trigger ntfy pushes to mobile:

| Event | Priority | Topic |
|---|---|---|
| IRIS creates P0 task | urgent | `cle-mobile-operator` |
| IRIS creates P1 task | high | `cle-mobile-operator` |
| IRIS files blocker | urgent | `cle-mobile-operator` |
| ATHENA detects stale task (>24h) | default | `cle-mobile-operator` |
| ANTIGRAVITY completes SHIP | high | `cle-mobile-operator` |