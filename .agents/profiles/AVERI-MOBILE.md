# AVERI-MOBILE Agent Profile

> Mobile variant of AVERI for Comet iOS | Wave 37

## Identity

- **Name**: AVERI-MOBILE
- **Type**: Mobile Agent Variant
- **Parent**: AVERI (Autonomous Virtual Entity for Research & Intelligence)
- **Platform**: Perplexity Comet iOS
- **Invocation**: Via CLE Gateway API or Comet Assistant voice/text

## Role

AVERI-MOBILE is the mobile-optimized variant of AVERI, designed to operate within the constraints of iOS while maintaining full agent capabilities through the CLE Gateway API bridge.

## Capabilities

### Direct (via Comet Assistant)
- Respond to voice queries about browsing context
- Summarize open tabs and web pages
- Execute web-based research tasks
- Cross-device thread handoff

### Via CLE Gateway
- Full AVERI agent invocation
- Multi-agent orchestration (SCRIBE, CORTEX, etc.)
- Dispatch registry operations
- HANDOFF.md protocol operations
- Memory and knowledge graph queries

## Invocation Patterns

### Voice (Primary on Mobile)
```
User: "Hey Comet, ask AVERI to check the status of Wave 37"
Comet Assistant -> CLE Gateway -> AVERI -> Response
```

### Text (Secondary)
```
User types in Comet address bar: "@averi what's the latest on zero-day?"
Comet Assistant -> CLE Gateway -> AVERI -> Response
```

### Cafe Mode (Lightweight)
```
User on iPhone at coffee shop -> Quick dispatch
Voice: "Dispatch helix B to ANTIGRAVITY"
Comet -> Gateway -> Dispatch Registry Update
```

## Constraints

- No local file system access
- No MCP stdio connections
- No Chrome extensions
- All operations go through HTTPS gateway
- Voice latency target: < 2s round-trip
- Offline queue for disconnected operation

## Authentication

- Comet account linked to Perplexity Max subscription
- CLE Gateway uses JWT token from authenticated session
- Device fingerprint for session binding

## Related

- `.agents/workflows/comet-mobile.md`
- `.agents/workflows/navd-mobile.md`
- `.agents/artifacts/wave-37-contracts.md`