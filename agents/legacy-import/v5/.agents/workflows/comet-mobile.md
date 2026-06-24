# Comet Mobile iOS Integration Workflow

> Wave 37 | Workstream: `comet-mobile` | Owner: NAVD

## Purpose

Integrate Perplexity's Comet browser for iOS into the Creative Liberation Engine ecosystem, enabling full agent invocation (especially AVERI) from mobile, cross-device session continuity, and remote operation parity with the desktop Comet experience.

## Key Capabilities (Comet iOS)

- **Comet Assistant**: Built-in AI agent that can view tabs, browse web, summarize pages, complete actions
- **Voice Mode**: Hands-free voice commands for browsing and task execution
- **Hybrid Search**: Traditional results + AI-powered deep answers
- **Cross-Device Sync**: Start on desktop, continue on iPhone - thread context carries over
- **Agentic Browsing**: High-level commands ("book a flight", "compare prices") executed autonomously
- **Smart Summarization**: Synthesize information across all open tabs
- **Ad Blocker**: Built-in native ad blocking
- **No Extensions**: iOS version lacks Chrome extension support (key constraint)

## Integration Architecture

### Bridge Strategy (No Extension = Alternative Path)

Since iOS Comet lacks extension support, integration requires:

1. **Public Gateway Endpoint** (`/api/comet-mobile/invoke`)
   - Authenticated REST API on Cloud Run (CLE endpoint)
   - Mobile Comet Assistant calls this via web action
   - Returns agent responses as structured JSON

2. **AVERI Mobile Genkit Flow** (`averi-mobile-invoke`)
   - Genkit flow that accepts mobile context payload
   - Handles: voice transcripts, page summaries, tab context
   - Routes to appropriate sub-agent (AVERI, SCRIBE, etc.)

3. **Cross-Device Thread Persistence**
   - Comet's built-in sync carries thread context
   - HANDOFF.md protocol extended for mobile sessions
   - Session ID bridging between desktop NAVD and mobile

### Mobile-Specific Workflows

- **Cafe Mode**: Lightweight mobile dispatch from anywhere
- **Voice-First**: AVERI invocation via Comet voice commands
- **Trinity Mode**: iPhone + iPad + Desktop simultaneous operation
- **Offline Queue**: Queue commands when disconnected, sync on reconnect

## Helices (Wave 37)

| Helix | Name | Owner | Status |
|-------|------|-------|--------|
| A | Dispatch Gateway Auth Middleware | ANTIGRAVITY | contracted |
| B | AVERI Mobile Genkit Flow | ANTIGRAVITY | contracted |
| C | NAVD-Mobile Workflow | NAVD (shipped) | done |
| D | Cross-Device Session Bridge | ANTIGRAVITY | contracted |
| E | AVERI-MOBILE Agent Profile | NAVD (shipped) | done |
| F | Offline Command Queue | ANTIGRAVITY | contracted |

## Constraints

- iOS Comet has NO extension support (Safari WebKit limitation)
- All integration must go through web APIs or Comet Assistant's built-in capabilities
- Comet collects browsing data for ad targeting - consider privacy implications
- Voice mode is the primary mobile interaction pattern

## Related Files

- `.agents/workflows/navd-mobile.md` - NAVD mobile protocol
- `.agents/profiles/AVERI-MOBILE.md` - AVERI mobile agent profile
- `.agents/artifacts/wave-37-contracts.md` - Implementation contracts
- `HANDOFF.md` - Cross-device handoff protocol