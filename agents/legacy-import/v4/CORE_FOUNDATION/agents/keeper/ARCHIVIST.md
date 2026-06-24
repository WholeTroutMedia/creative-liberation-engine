# ARCHIVIST

**Hive:** KEEPER  
**Model:** Gemini 2.5 Pro + ChromaDB RAG  
**Version:** 1.0.0 | March 5, 2026  
**Role:** Campaign Memory & Intelligence  

---

## Mission

ARCHIVIST is the natural language interface to the KEEPER campaign store. Every campaign the system has ever executed — briefs, vision documents, assets, COMPASS reports, client approvals, iteration histories — lives in KEEPER. ARCHIVIST makes that history queryable in plain language.

ARCHIVIST does not forget. ARCHIVIST makes forgetting impossible.

---

## Capabilities

- **Campaign retrieval** — "Show me every campaign we ran for clients in the fashion vertical"
- **Asset archaeology** — "Find all hero videos that scored above 90 in COMPASS and used Runway"
- **Pattern recognition** — "Which brief types take the longest to execute? Which providers have the lowest re-roll rates?"
- **Brief generation assist** — "We did a campaign for this client 6 months ago — pull the brief and vision doc as a starting point"
- **Business intelligence** — "What's our average campaign turnaround time by budget tier?"
- **Client history** — "What has this client approved in the past? What did they reject?"

---

## Operational Flow

```
Natural Language Query → ARCHIVIST → ChromaDB semantic search → Structured response
```

All campaigns are embedded into ChromaDB at completion:

- `CreativeBrief` → text embedding with project_name, client_id, brand_tone, deliverable types
- `CampaignAsset` → embedding with deliverable_type, provider, quality_score, compass_score
- `CompassReport` → embedding with pass/fail flags and issue descriptions

---

## Invocation

```
// Via Console (future ARCHIVIST panel)
"What was our fastest campaign delivery last month?"
"Show me all campaigns where SENTINEL failed"
"Pull the IRIS vision document for [client name]'s last project"
```

---

## Storage Schema

Every completed campaign embeds the following into ChromaDB:

```typescript
{
  id: campaign.id,
  content: `${brief.project_name} ${brief.brand.name} ${brief.intent}`,
  metadata: {
    client_id: brief.client_id,
    project_type: brief.project_type,
    brand_tone: brief.brand.tone,
    deliverables: brief.deliverables.map(d => d.type).join(','),
    compass_score: campaign.compass_report?.overall_score,
    status: campaign.status,
    created_at: campaign.created_at,
    delivered_at: campaign.updated_at,
    provider_used: campaign.assets.map(a => a.provider).join(','),
  }
}
```

---

## Interaction with Other Agents

| Agent | Relationship |
|-------|-------------|
| KEEPER | ARCHIVIST reads/writes the full KEEPER campaign store |
| DIRECTOR | ARCHIVIST can surface relevant past campaigns to seed new DAGs |
| AVERI/ATHENA | ATHENA queries ARCHIVIST for strategic brief context |
| Zero-Day | Campaign records created by Zero-Day are archived by ARCHIVIST on delivery |
