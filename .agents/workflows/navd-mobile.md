# NAVD Mobile Protocol

> Wave 37 | Agent: NAVD | Platform: Comet iOS

## Overview

NAVD-Mobile extends the NAVD browser agent to operate within Perplexity's Comet iOS browser. Since iOS lacks Chrome extension support, NAVD-Mobile operates through the Comet Assistant's native capabilities and a public API gateway.

## Mobile Invocation Pattern

```
User (iPhone) -> Comet Assistant (voice/text)
  -> CLE Gateway API (/api/comet-mobile/invoke)
    -> AVERI / NAVD routing
      -> Response back to Comet Assistant
```

## Capabilities on Mobile

### Available (via Comet Assistant)
- Web research and browsing
- Page summarization across open tabs
- Voice-driven commands
- Cross-device thread continuity
- Shopping and price comparison
- Email summarization

### Available (via CLE Gateway)
- AVERI agent invocation
- SCRIBE memory queries
- Dispatch registry updates
- HANDOFF.md read/write
- Agent status checks

### Not Available on iOS
- Chrome extension injection
- Direct DOM manipulation
- MCP server connections (no stdio on iOS)
- Local file system access
- Background service workers

## Session Protocol

1. **Start**: User opens Comet iOS, begins browsing or voice query
2. **Detect**: Comet Assistant recognizes CLE-related intent
3. **Route**: Assistant calls CLE Gateway with context payload
4. **Execute**: Gateway routes to appropriate agent
5. **Return**: Response displayed in Comet Assistant overlay
6. **Sync**: Thread context synced to desktop via Comet cross-device sync

## Context Payload Schema

```json
{
  "source": "comet-mobile",
  "device": "iphone",
  "session_id": "<comet-thread-id>",
  "intent": "invoke-agent",
  "agent": "averi",
  "context": {
    "active_url": "https://...",
    "tab_summaries": [...],
    "voice_transcript": "..."
  }
}
```

## Handoff Integration

When NAVD-Mobile completes a task, it writes to HANDOFF.md:

```json
{
  "from": "NAVD-MOBILE",
  "platform": "comet-ios",
  "phase": "MOBILE-DISPATCH",
  "timestamp": "<iso-8601>"
}
```

## Related

- `.agents/workflows/comet-mobile.md` - Parent workflow
- `.agents/profiles/AVERI-MOBILE.md` - Mobile agent profile
- `.agents/artifacts/wave-37-contracts.md` - Contracts