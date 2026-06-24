# Creative Liberation Engine: Dynamic Routing & Meta-Orchestration Architecture

**Status:** Active Codification
**Stance:** INFRASTRUCTURE & ORCHESTRATOR
**Objective:** Evolve Creative Liberation Engine from a reactive conversational tool into a proactive, self-modifying, sovereign creative OS.

## 1. The Core Paradigm Shift
Creative Liberation Engine is not a chatbot that writes code. It is an **Agentic OS** designed to liberate creators by abstracting the friction between ideation and production. 

To achieve this, we are discarding the static "request-response" loop and implementing a **Voyager/MetaGPT hybrid architecture**:
- **MetaGPT (Structure):** Role-based agent swarms (Creative Director, Developer, QA) that hand off tasks using strict Standard Operating Procedures (SOPs).
- **Voyager (Evolution):** An open-ended skill discovery engine. When an agent lacks a tool (e.g., connecting to the Kling Video API), it writes the integration script itself, tests it, and commits it to a persistent "Skill Vector Library" for future use.

## 2. The Liberation Toolset (Dynamic Integration)
The OS must seamlessly route to the best available models without human API wrangling. The Meta-Orchestrator will dynamically manage bridges to:
- **Video & VFX:** Runway Gen-3, Kling, Luma Dream Machine, Pika Labs.
- **Local Generation:** ComfyUI (via `autonomous-animator`), TripoSR (for 3D).
- **Audio:** `voice-fabric` (Piper/Whisper), ElevenLabs.

### Autonomous Bridge Generation Protocol
If a user requests a Runway Gen-3 generation and the MCP or internal skill is outdated:
1. The Orchestrator intercepts the `ToolExecutionError`.
2. It spawns a `ToolSmith` agent.
3. The `ToolSmith` researches the latest API docs (via web search/RAG).
4. It rewrites the integration script in `services/packages/`.
5. It registers the new skill in the Vector Library.
6. The Orchestrator resumes the video generation.

## 3. The Execution Loop (How it routes)
When a prompt enters the system (e.g., "Make a cinematic trailer for a cyberpunk city"):

1. **Pre-Flight RAG:** The Orchestrator searches the knowledge base for top UI/UX, cinematic rules, and previously successful workflows.
2. **SOP Generation:** A multi-step plan is generated based on the `VIDEO_AGENCY` and `ANIMATION_PIPELINE` schemas.
3. **Skill Retrieval:** The OS checks the Skill Vector Library. "Do we have a skill to generate a consistent cyberpunk character?"
4. **Dynamic Creation (If missing):** The OS writes a ComfyUI workflow script to handle the character consistency.
5. **Dispatch & Monitor:** Tasks are pushed to the `dispatch` server. The Orchestrator goes to sleep/polls, freeing up the IDE. It only returns when the final MP4 is rendered.

## 4. Immediate Implementation Path
1. **Schema Locked:** `META_ORCHESTRATOR.schema.json` is deployed.
2. **Vector Skill Library:** Deploy a Chroma/Qdrant instance on the NAS specifically for indexing generated `node.js`/`python` execution scripts.
3. **The Autonomy Loop:** Update `orchestration/src/index.ts` to transition from immediate chat returns to asynchronous `dispatch` queueing.
