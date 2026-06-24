# MCP Refero Styles — Design Reference Intelligence

> IE-IDX-0107 · Refero Styles — Design Systems for AI Agents

## Purpose

This service integrates Refero's 130K+ real-world UI reference library into the Creative Liberation Engine's sovereign agent fleet. Agents can query design references before building any interface, ensuring every surface meets production-grade standards.

## Architecture

```
┌──────────────────────────────┐
│       ATELIER (UI Hub)       │
│  ┌─────────────────────────┐ │
│  │ Refero Styles Tab       │◄── Visual browser + gallery
│  └──────────┬──────────────┘ │
└─────────────┼────────────────┘
              │ HTTP/MCP
┌─────────────▼────────────────┐
│   mcp-refero-styles proxy    │
│  ┌───────────────┐           │
│  │ Category Cache │           │
│  │ Token Resolver │           │
│  │ Agent Router   │           │
│  └───────┬───────┘           │
└──────────┼───────────────────┘
           │ HTTPS
┌──────────▼───────────────────┐
│   refero.design API          │
│  (130K+ screens, 10K flows)  │
└──────────────────────────────┘
```

## Integration with ATELIER

The Refero Styles view is embedded directly in ATELIER as a first-class design reference source, sitting alongside Mobbin, Godly, Relume, and other reference libraries.

## Agent Capabilities

| Agent | Usage |
|-------|-------|
| AURORA | Query before generating any UI layout |
| BOLT | Validate component patterns against real products |
| LEONARDO | Extract color/typography tokens from reference screens |
| ATHENA | Analyze competitive patterns during ideation |

## Configuration

```json
{
  "server": "mcp-refero-styles",
  "transport": "stdio",
  "env": {
    "REFERO_API_KEY": "{{vault:refero-api-key}}"
  }
}
```
