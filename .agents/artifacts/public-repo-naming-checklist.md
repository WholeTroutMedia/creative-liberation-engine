# Creative Liberation Engine Public Repo — Naming & Details Checklist

**Repo:** `ecosystem/creative-liberation-engine` (readied for release).  
**Purpose:** Revisit naming and all public-facing copy in a dedicated pass *after* the Flow Studioâ€“inspired ship.

---

## What was checked (quick pass)

- **Location:** `ecosystem/creative-liberation-engine/` â€” full copy of engine with v5 GENESIS branding, 25+ agents, 7 hives, FSL-1.1-ALv2.
- **README:** Positioned as "compound-learning, multi-agent AI operating system"; Quick Start uses both Gitea (127.0.0.1) and GitHub clone URLs; Local Deploy section uses `github.com/WholeTroutMedia/creative-liberation-engine`.
- **Copy inconsistencies (to revisit in naming pass):**
  - Agent/hive count: "25 agents, 7 hives" in header vs "36 agents, 6 hives" in Repository Navigation table (links point at creative-liberation-engine-v5 paths).
  - Constitution: "20-article" early in README vs "21-article" in "The Constitution" section.
  - Immutable articles: README lists Article 0, XVIII, XX with slightly different wording than main constitution (e.g. "Sacred Firewall").
- **Tiers:** Studio / Client / Merch in README; "Access Tiers" vs "Local Deploy" â€” ensure tier names and descriptions align with Flow Studioâ€“inspired TIERS.md once written.
- **Clone URL / remote:** Sovereign policy says public launch = Forgejo via git.wholetrout.media or mirror to GitHub when directed. README currently shows both; decide canonical public URL and update everywhere.

---

## Items for naming/details pass (after Flow Studio ship)

1. **Product name** — "Creative Liberation Engine" (public) vs internal Creative Liberation Engine naming; GENESIS, Zero Day in titles and meta.
2. **Agent/hive numbers and names** â€” Align 25 vs 36, 7 vs 6 hives; ensure all agent names match creative-liberation-engine-v5 and are intentional for public.
3. **Constitution** â€” Single source of truth: 20 vs 21 articles; immutable list; link to CONSTITUTION.md.
4. **Tier names** â€” Studio / Client / Merch vs Free / Pro / Enterprise (or other); align with TIERS.md and capacity model.
5. **Clone URL** â€” One canonical public clone URL (e.g. `https://git.wholetrout.media/WholeTroutMedia/creative-liberation-engine` or GitHub mirror); remove or qualify internal IP from public README.
6. **Internal links** â€” Repository Navigation table points at creative-liberation-engine-v5 paths; either make relative to creative-liberation-engine or document that this repo is a slice/sync of creative-liberation-engine-v5.
7. **License** â€” FSL-1.1-ALv2 in badge; ensure LICENSE file and all headers match.
8. **Contact / press** — Ensure public press/contact copy does not reference retired repos; point to WholeTrout / creative-liberation-engine as appropriate.

---

*Use this checklist when you do the dedicated "reconsider naming and details" pass. Do not block the Flow Studioâ€“inspired implementation on this.*
