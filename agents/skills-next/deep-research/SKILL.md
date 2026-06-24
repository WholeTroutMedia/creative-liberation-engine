# deep-research — Creative Liberation Engine V6

> **Version:** 1.0.0  
> **Kind:** next_skill  
> **Status:** active  
> **Source:** v6-next  
> **Agent-Callable:** true

## Summary

Dispatch autonomous research tasks against Google's Gemini Deep Research API.
Supports both fast interactive mode (Standard) and extended async mode (Max)
for exhaustive, high-stakes intelligence gathering.

## Capabilities

### Research Modes
- **Standard** (`cloud:research`) — Fast, interactive, low-latency research for
  real-time agent queries. Uses Gemini 3.1 Pro Deep Research.
- **Max** (`cloud:research:max`) — Extended test-time compute for exhaustive
  background research. Runs asynchronously, returns structured intelligence reports.

### Input Formats
- Plain text queries
- PDF documents
- CSV / spreadsheet data
- Images (screenshots, diagrams, photos)
- Audio files
- Video clips

### Output
- Structured intelligence reports with sourced citations
- Native charts and infographics where applicable
- Confidence scoring per claim
- Suggested follow-up research vectors

### MCP Bridge
Supports Model Context Protocol for searching private data sources:
- NAS data lake (`rag_data/`) without data leaving the source
- ChromaDB vector store
- Wiki knowledge base
- Credential-gated platform data (Scholar Hive)

Web access is toggleable — can search ONLY private data when configured.

## Dispatch Templates

### `research:market-intel`
Competitive landscape and market positioning analysis.
```json
{
  "template": "research:market-intel",
  "mode": "max",
  "inputs": {
    "domain": "experiential entertainment",
    "focus": "biometric personalization technology",
    "timeframe": "2025-2026"
  }
}
```

### `research:capability-audit`
Internal capability assessment against external benchmarks.
```json
{
  "template": "research:capability-audit",
  "mode": "standard",
  "inputs": {
    "capability": "multi-view video world models",
    "benchmark_source": "arxiv:2604.18564"
  }
}
```

### `research:competitive-scan`
Real-time competitive intelligence monitoring.
```json
{
  "template": "research:competitive-scan",
  "mode": "standard",
  "inputs": {
    "competitors": ["Runway", "Pika", "Kling"],
    "focus": "agentic production pipelines"
  }
}
```

## Model Tier Mapping

| Mode | Model Tier | Fallback |
|------|-----------|----------|
| Standard | `cloud:research` | `gemini-deep-research` |
| Max | `cloud:research:max` | `gemini-deep-research-max` |

## Dependencies

- Gemini API key with Deep Research preview access
- MCP server configuration for private data sources
- Dispatch queue for async Max mode tasks

## Governance

- All research outputs are logged to `memory/research/` with timestamp and query hash
- Max mode tasks require explicit dispatch (no auto-trigger)
- Private data searches are audit-logged per `ROUTING_CONTRACT.md`
- Web access toggleable per-query for data sovereignty control
