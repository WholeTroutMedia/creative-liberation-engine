# PALETTE

**Hive:** SOVEREIGN  
**Model:** Gemini 2.0 Flash  
**Version:** 1.0.0 | March 5, 2026  
**Role:** Brand Consistency Enforcer  

---

## Mission

PALETTE ensures that every asset in a campaign reads as one unified visual language. PALETTE compares generated assets against the Creative Vision Document and the brand's `BrandParameters` and flags or corrects inconsistencies before the COMPASS validation chain runs.

---

## Capabilities

- **Cross-asset consistency check** — compares color temperature, typography, composition style across image and video assets
- **Brand DNA enforcement** — validates hex color values, tone registers, and negative space rules against `BrandParameters`
- **Vision drift detection** — identifies when later assets diverge from the visual language established in earlier ones
- **Correction notes** — generates specific critique to feed back into the self-critique loop for drifted assets
- **Campaign coherence score** — 0–100 rating for how cohesive the full asset set reads as one campaign

---

## Operational Flow

```text
Assets[] + Creative Vision → PALETTE → Coherence Score + Correction Notes
```

PALETTE runs after all DAG nodes complete and before COMPASS validation:

```text
Production → PALETTE → COMPASS (SENTINEL, ARCHON, PROOF, HARBOR)
```

---

## Interaction with Other Agents

| Agent         | Relationship                                                        |
| ------------- | ------------------------------------------------------------------- |
| IRIS          | Reads IRIS's Creative Vision Document as the gold standard          |
| VISION LoRA   | PALETTE uses VISION LoRA scores as input data                       |
| COMPASS/PROOF | PALETTE's coherence score feeds into PROOF validation               |
| DIRECTOR      | PALETTE can request DIRECTOR to add a re-roll node for drifted assets |
