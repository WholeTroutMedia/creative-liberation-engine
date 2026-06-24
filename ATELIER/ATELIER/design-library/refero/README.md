# Refero — Design Reference Intelligence

**Source:** [refero.design](https://refero.design)
**Type:** MCP-integrated design reference library
**IE-IDX:** IE-IDX-0107
**Status:** ACTIVATED

## Overview

Refero is the largest curated collection of real-world UI/UX design references, providing AI agents with access to 130,000+ product screens and 10,000+ user flows across web and iOS platforms.

## Integration Points

- **MCP Server:** Refero MCP provides structured design metadata (layouts, UX patterns, color systems, typography) directly to AI agents
- **Refero Skill:** Installable methodology for design-aware code generation
- **ATELIER Binding:** Integrated as a sovereign reference source in the Creative Liberation Engine design library

## Capabilities

| Feature | Scale |
|---|---|
| Web screens | 67,000+ |
| iOS screens | 63,000+ |
| User flows | 10,000+ |
| UX pattern categories | Onboarding, paywalls, empty states, settings, profiles |
| Metadata per screen | Description, UX patterns, UI patterns, craft rules |

## Agent Usage

Agents can query Refero for:
- Real-world implementation references before building UI
- Pattern validation against shipped products
- Typography/color/spacing best practices from production apps
- Competitive analysis across verticals (fintech, SaaS, e-commerce, etc.)

## Skill Installation

```bash
npx skills add https://github.com/referodesign/refero_skill
```

## Contact

Enterprise/custom integrations: support@refero.design
