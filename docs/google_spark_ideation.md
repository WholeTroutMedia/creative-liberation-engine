# IDEATION — The Google Workspace Agentic Fabric

This document outlines the strategic, architectural, and creative directions for integrating the complete Google Workspace suite with the sovereign, self-hosted Creative Liberation Engine OS running on the Synology NAS.

---

## 1. Possibility Frame

> **"A Master-Worker Edge Mesh where the local, sovereign Creative Liberation Engine orchestrates code execution and private data, while a cloud-native Google Spark agent acts as an always-on triage sensor and high-speed Workspace automation handler, communicating over a secure, schema-bound REST gateway."**

---

## 2. Strategic Context & Architecture

```mermaid
graph TD
    subgraph Mobile / Client Interface (Google Workspace)
        Chat[Google Chat / Spaces] <-->|Real-time Commands & Status| Spark[Google Spark]
        Keep[Google Keep] -->|Voice Notes & Brain Dumps| Spark
        Gmail[Gmail] <-->|Client Communications & Triaged Ingest| Spark
        Calendar[Google Calendar] <-->|Temporal Tasks & Focus Time Scheduling| Spark
        Tasks[Google Tasks] <-->|Micro-Action Checklist & Completion Sync| Spark
        Docs[Google Docs] <-->|Long-form Specs & Collaboration Docs| Spark
        Sheets[Google Sheets] <-->|Configuration DB & Telemetry Logs| Spark
        Slides[Google Slides] <-->|Automatic Client Pitch Decks| Spark
        Meet[Google Meet] -->|Meeting Transcripts & Auto-Task Creation| Spark
    end

    subgraph Secure Tunnel
        Spark <-->|HMAC-Verified Webhooks / API Relay| Tunnel[Cloudflare Tunnel]
    end

    subgraph Sovereign Infrastructure (Creative Liberation Engine NAS Core)
        Tunnel <-->|REST Ingress / Egress| Dispatch[REST Dispatch Server: 5050]
        Dispatch <-->|Task Scheduling| Redis[(Local Redis Queue)]
        Redis <-->|Execution & Logic| CPU[Local Swarm: Athena/Vera/Iris]
        CPU <-->|System Code & Git| Gitea[(Local Forgejo Git)]
        CPU <-->|Workspace MCP Bridge| MCP[google_workspace MCP Server]
        MCP <-->|Direct Drive & Document Mutation| GoogleCloud[Google Cloud API]
    end
```

---

## 3. Tool-by-Tool Integration Mapping

### A. Google Chat & Spaces (Real-Time Communication Hub)
*   **The Role:** Acts as the primary user-facing terminal interface for mobile devices.
*   **Mechanic:** A dedicated Space (e.g., `#cle-ops`) is created. When you type commands or upload assets in this Space, Google Spark formats the message and sends it via webhooks to the local `/api/ingress/chat` route on the NAS.
*   **Response Loop:** The local engine posts markdown logs, execution statuses, and link previews back to the Chat thread, avoiding the need for an active SSH session or local IDE window.

### B. Google Calendar (Resource & Task Scheduler)
*   **The Role:** Aligns CPU-heavy local tasks with your physical schedule.
*   **Mechanic:** The local engine uses `manage_event` and `query_freebusy` to query your calendar. 
*   **Execution:** Large processing tasks (such as LoRA compilation or long-running web crawls) are auto-scheduled during calendar blocks flagged as "Out of Office," "Focus Time," or during night hours. System maintenance alerts are dropped onto your calendar as movable tasks.

### C. Google Tasks (Task Ingestion & Completion Sync)
*   **The Role:** Light-weight task tracking.
*   **Mechanic:** A dedicated Google Tasks list synced with the local `/api/tasks` endpoint.
*   **Execution:** When a local build or validation run fails, a bug ticket is written to Google Tasks with a reference link. Checking off a task in Google Tasks immediately signals the local engine to trigger a fresh git validation and deployment runner.

### D. Google Sheets (Dynamic Configuration & Telemetry Database)
*   **The Role:** Direct configuration manipulation without writing JSON/YAML.
*   **Mechanic:** `list_spreadsheets` and `read_sheet_values` are run by the local engine to parse settings.
*   **Execution:** The engine publishes live telemetry (API costs, model usage, system temperatures) to Sheets. To toggle agents, adjust model weights, or set task priorities, you edit cells in the configuration Sheet. The local engine polls or receives updates to apply changes instantly.

### E. Google Slides (Automatic Pitch Deck Generation)
*   **The Role:** Streamlining creative presentation assembly.
*   **Mechanic:** Integrates with the `import_to_google_slides` tool.
*   **Execution:** During `/design` sessions, the engine auto-creates a Google Slide presentation containing generated visual prompts, layout blueprints, color palettes, and structural code documentation, saving hours of manual deck building.

### F. Google Docs & Keep (Long-form Specifications & Brain Dumps)
*   **The Role:** The context library and conceptual staging area.
*   **Mechanic:** Keep is used to capture voice notes and short checklists, while Docs holds major system contracts and specifications.
*   **Execution:** Spark routinely polls Google Keep, runs a structural summarization, and commits the clean markdown to the local `SCRIBE` memory database. Long-form specs created in Gitea are written back to Docs to facilitate collaborative commenting.

### G. Google Meet & Gmail (Meeting Digest & Client Gateway)
*   **The Role:** Communication and influx parsing.
*   **Mechanic:** Spark monitors incoming emails via Gmail and processes post-meeting transcripts from Meet.
*   **Execution:** If a client requests a project modification via email, Spark flags it, generates a draft reply in Gmail for your approval, and automatically pushes the request to the local engine as a task. Meet transcripts are scanned to extract deliverables and assign them to the local queue.

---

## 4. Security, Isolation, & Webhook Ingress

*   **OAuth Scoping:** The Google Cloud credentials used by the `google_workspace` MCP tool are strictly scoped to prevent broad file reads. Access is isolated to the `/CLE_Sovereign_Space/` folder and specified lists/calendars.
*   **Zero-Trust Gateway:** The Cloudflare Tunnel points directly to the NAS gateway. All incoming webhooks must include an HMAC-SHA256 signature generated by your Apps Script trigger, verifying the payload authenticity before letting it write to the Redis queue.
*   **Payload Format:**
    ```json
    {
      "source": "google-spark-mesh",
      "timestamp": "ISO_8601_TIMESTAMP",
      "event": "EVENT_TYPE",
      "signature": "HMAC_SIGNATURE",
      "payload": {
        "summary": "TEXT_SUMMARY",
        "doc_url": "GOOGLE_DOCS_URL",
        "parameters": {}
      }
    }
    ```

---

## 5. Implementation Roadmap

### **Phase 1: Secure Ingress Setup**
*   [x] Deploy the secure Cloudflare tunnel to route traffic from Spark to the local NAS Dispatch Server on port `5160`.
*   [x] Write the HMAC signature verification middleware on the local REST endpoint.

### **Phase 2: Spark & Workspace Configuration**
*   [ ] Create the Google Chat Space `#cle-ops` and set up the webhook trigger.
*   [x] Write the Google Apps Script that hooks Spark activities (Docs, Keep, Calendar edits) to the secure tunnel.

### **Phase 3: MCP Tool Integration**
*   [ ] Configure the local engine to parse incoming events, fetch related files using the `google_workspace` MCP tool, and add them to the queue.
*   [ ] Implement bi-directional sync for Sheets telemetry and Google Tasks.
