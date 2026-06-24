---
description: Generate real UI screens from an IDEATE design direction using Stitch MCP
---

# /design — Design Generation Pipeline

Turns a selected IDEATE design direction into actual generated UI screens using Stitch MCP. Real screens, not descriptions.

## Steps

1. Confirm the selected design direction from IDEATE. If not provided, read `docs/ideate/[feature]-ideate.md`.

2. **Create a Stitch project** for this feature:

Use `StitchMCP` `create_project` tool with `title`: "[feature-name] — Creative Liberation Engine"

Save the returned `projectId`.

1. **Generate the primary screen**:

Use `StitchMCP` `generate_screen_from_text` with:

- `projectId`: [from step 2]
- `deviceType`: `DESKTOP` (or `MOBILE` if mobile-first)
- `modelId`: `GEMINI_3_PRO`
- `prompt`: Build a rich, detailed prompt from the IDEATE direction:

  ```
  Design a [screen type] for [product name].
  
  Vision: [vision statement from IDEATE]
  Design direction: [selected direction text]
  
  Visual character: [extracted from browser tabs if /browser-ideate was used]
  
  Requirements:
  - [key functional requirements from the direction]
  - [any specific components needed]
  - Dark mode, premium aesthetic
  - No placeholder content — real data and real labels
  ```

1. **Generate additional screens** — After the primary screen is approved, generate:
   - Secondary state (empty, loading, error)
   - Mobile variant if desktop was primary
   - Key modal or overlay if applicable

Use `StitchMCP` `generate_screen_from_text` for each.

1. **Get screen details** — For each generated screen, retrieve the artifact:

Use `StitchMCP` `get_screen` with the returned `screenId` and `projectId`.

1. Present the generated screens to the user. Offer:
   - "Generate variants?" → Use `StitchMCP` `generate_variants`
   - "Edit this screen?" → Use `StitchMCP` `edit_screens`
   - "Looks good, go to `/plan`?" → Proceed with the screen as spec reference

2. Note the Stitch project URL and screen IDs in `docs/ideate/[feature]-screens.md` for reference during SHIP.
