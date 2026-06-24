# Creative Liberation Engine — Visual DESIGN.md

> **ATELIER & SENTINEL SOURCE OF TRUTH**
> This file is the sovereign, machine-readable UI blueprint for the Creative Liberation Engine.
> It aggregates all thematic CSS tokens, Tailwind v4 configurations, and structural guidelines.
> Any agent (e.g., ATELIER) generating UI code MUST refer to this document for styling constants.

---

## 1. Core Principles

1. **No Hallucinated Colors:** Use only the tokens defined in this document.
2. **Glassmorphism & Depth:** Prioritize layered depth using `rgba` backdrops, `backdrop-filter`, and inset box-shadows.
3. **Typography:** Use the defined `--font-interface` and `--font-text` for structural vs. long-form readability.
4. **Interactive Accents:** Interactive elements should prominently feature the `--interactive-accent` color with a clear `--interactive-accent-hover` state.

---

## 2. Global Token Architecture

The Creative Liberation Engine uses a consistent set of CSS variables to define themes. All themes MUST implement the following keys:

- `--background-primary`: The deepest background layer (e.g., app canvas).
- `--background-secondary`: The secondary background layer (e.g., panels, cards, workspace leaves).
- `--background-modifier-border`: Border and divider lines.
- `--interactive-accent`: Primary color for buttons, active tabs, and highlights.
- `--interactive-accent-hover`: Hover state for interactive elements.
- `--text-accent`: Color for prominent text, headers, or active icons.
- `--text-normal`: Standard body text.
- `--text-muted`: De-emphasized or secondary text.
- `--font-interface`: Font stack for UI components.
- `--border-width`: Standard border thickness for panels.

---

## 3. Theme Catalog

Below is the exhaustive catalog of approved design themes. Agents should extract the CSS block for the chosen theme and inject it into the application's global styles.

### 3.1 Aetheris Executive (Refined Baseline)
```css
.theme-dark {
  --background-primary: #0a0e17 !important;
  --background-secondary: #0f1522 !important;
  --background-modifier-border: rgba(163, 144, 228, 0.15) !important;
  --interactive-accent: #a390e4;
  --interactive-accent-hover: #bdaef0;
  --text-accent: #a390e4;
  --text-normal: #dce0e8;
  --text-muted: #7f8a9e;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 1px !important;
}
/* Leaf Styles */
.workspace-leaf {
  border: 1px solid transparent !important;
  background-color: var(--background-secondary) !important;
  border-radius: 14px !important;
  margin: 6px !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 2px 10px rgba(0,0,0,0.3) !important;
}
```

### 3.2 Alabaster Sanctum (Premium Light Mode)
```css
.theme-light, .theme-dark {
  --background-primary: #ffffff !important;
  --background-secondary: #f8f9fa !important;
  --background-modifier-border: #e9ecef !important;
  --interactive-accent: #d90429;
  --interactive-accent-hover: #ef233c;
  --text-accent: #d90429;
  --text-normal: #111111 !important;
  --text-muted: #6c757d !important;
  --font-interface: 'Helvetica Neue', 'Helvetica', sans-serif !important;
  --border-width: 1px !important;
}
```

### 3.3 Aurora Glassmorphism
```css
.theme-dark {
  --background-primary: rgba(15, 15, 25, 0.4) !important;
  --background-secondary: rgba(20, 20, 35, 0.6) !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: #00ffcc;
  --interactive-accent-hover: #66ffdb;
  --text-accent: #ffb3ff;
  --text-normal: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.6);
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.4 Bioluminescent Deep Sea
```css
.theme-dark {
  --background-primary: #04141c !important;
  --background-secondary: #061d29 !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: #4df0ff;
  --interactive-accent-hover: #80f5ff;
  --text-accent: #b399ff;
  --text-normal: #cce6ff;
  --text-muted: #6699cc;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.5 Cyber-Tactical (Avionics Edge)
```css
.theme-dark {
  --background-primary: #18191c !important;
  --background-secondary: #212328 !important;
  --background-modifier-border: #343a40 !important;
  --interactive-accent: #ff6b00;
  --interactive-accent-hover: #ff8c33;
  --text-accent: #ffcc00;
  --text-normal: #ced4da;
  --text-muted: #6c757d;
  --font-interface: 'Roboto', 'Inter', sans-serif !important;
  --border-width: 1px !important;
  --divider-color: #343a40 !important;
}
```

### 3.6 Ethereal Synthwave
```css
.theme-dark {
  --background-primary: #12091f !important;
  --background-secondary: #1a0f2e !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: #ff70a6;
  --interactive-accent-hover: #ff99c2;
  --text-accent: #70d6ff;
  --text-normal: #e6ccff;
  --text-muted: #a680cc;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.7 Glass-Canvas (Spatial Minimalist)
```css
.theme-dark {
  --background-primary: rgba(255, 255, 255, 0.03) !important;
  --background-secondary: rgba(255, 255, 255, 0.01) !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: rgba(255, 255, 255, 0.8);
  --interactive-accent-hover: rgba(255, 255, 255, 1);
  --text-accent: #ffffff;
  --text-normal: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.5);
  --font-interface: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.8 Graphite & Sage (Architectural Organic)
```css
.theme-dark {
  --background-primary: #121212 !important;
  --background-secondary: #1a1a1a !important;
  --background-modifier-border: rgba(255,255,255,0.05) !important;
  --interactive-accent: #8ea392;
  --interactive-accent-hover: #a3b8a7;
  --text-accent: #8ea392;
  --text-normal: #e0e0e0;
  --text-muted: #808080;
  --font-interface: 'Inter', -apple-system, sans-serif !important;
  --border-width: 1px !important;
}
```

### 3.9 Hyper-Modern Ethereal (Linear-esque)
```css
.theme-dark {
  --background-primary: #141414 !important;
  --background-secondary: #1c1c1c !important;
  --background-modifier-border: rgba(255,255,255,0.08) !important;
  --interactive-accent: #7c7cff;
  --interactive-accent-hover: #9b9bff;
  --text-accent: #7c7cff;
  --text-normal: #ededed;
  --text-muted: #888888;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 1px !important;
}
```

### 3.10 Ivory Canvas (Professional Light Mode)
```css
.theme-light, .theme-dark {
  --background-primary: #f9f9f6 !important;
  --background-secondary: #ffffff !important;
  --background-modifier-border: rgba(0,0,0,0.06) !important;
  --interactive-accent: #1a365d;
  --interactive-accent-hover: #2a4365;
  --text-accent: #721c24;
  --text-normal: #1a202c !important;
  --text-muted: #718096 !important;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 1px !important;
}
```

### 3.11 Neon-Pastel Midnight
```css
.theme-dark {
  --background-primary: #050508 !important;
  --background-secondary: #0a0a10 !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: #c882ff;
  --interactive-accent-hover: #e0b3ff;
  --text-accent: #00ffff;
  --text-normal: #d1d1e0;
  --text-muted: #73738c;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.12 Nordic Dawn
```css
.theme-dark {
  --background-primary: #2e3440 !important;
  --background-secondary: #3b4252 !important;
  --background-modifier-border: transparent !important;
  --interactive-accent: #ff9e9e;
  --interactive-accent-hover: #ffbaba;
  --text-accent: #8fbcbb;
  --text-normal: #eceff4;
  --text-muted: #d8dee9;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 0px !important;
}
```

### 3.13 Obsidian Onyx (Premium Monolithic)
```css
.theme-dark {
  --background-primary: #000000 !important;
  --background-secondary: #050505 !important;
  --background-modifier-border: #111111 !important;
  --interactive-accent: #bda3d9;
  --interactive-accent-hover: #d1b8ed;
  --text-accent: #bda3d9;
  --text-normal: #f0f0f0;
  --text-muted: #666666;
  --font-interface: 'Inter', sans-serif !important;
  --border-width: 1px !important;
}
```

### 3.14 Pitch Black Brutalist
```css
.theme-dark {
  --background-primary: #000000;
  --background-secondary: #080808;
  --background-modifier-border: #1a1a1a;
  --text-normal: #e0e0e0;
  --text-muted: #6b6b6b;
  --text-accent: #c1a65d; 
  --interactive-accent: #c1a65d;
  --interactive-accent-hover: #e0c885;
  --background-modifier-active-hover: rgba(126, 162, 214, 0.1);
  --radius-s: 0px;
  --radius-m: 2px;
  --radius-l: 2px;
  --divider-color: #1a1a1a;
  --divider-width: 1px;
}
```

### 3.15 Quantum Matrix (Wireframe Hologram)
```css
.theme-dark {
  --background-primary: #000000 !important;
  --background-secondary: #000000 !important;
  --background-modifier-border: #ff00ff !important;
  --interactive-accent: #00ffff;
  --interactive-accent-hover: #80ffff;
  --text-accent: #00ffff;
  --text-normal: #e0e0e0;
  --text-muted: #808080;
  --font-interface: 'Space Mono', 'Consolas', monospace !important;
  --border-width: 1px !important;
}
```

### 3.16 Solaris Station (Retro-Futurism)
```css
.theme-dark {
  --background-primary: #0a0500 !important;
  --background-secondary: #140a00 !important;
  --background-modifier-border: #ffb000 !important;
  --interactive-accent: #ffb000;
  --interactive-accent-hover: #ffd000;
  --text-accent: #33ff00;
  --text-normal: #ffb000;
  --text-muted: #8a6000;
  --font-interface: 'Courier New', 'Consolas', monospace !important;
  --border-width: 2px !important;
}
```

---

## 4. ATELIER Workflow & Translation

When ATELIER operates on a UI feature, it must:
1. **Identify The Active Theme:** Parse the current app's configuration to determine which theme block applies.
2. **Translate to Tailwind v4 Variables:** 
   - Ensure the CSS variable keys map cleanly into the Tailwind config or are applied directly via `var(--...)` or arbitrary values like `bg-[var(--background-secondary)]`.
   - Prefer standardizing a `theme.extend.colors` mapping in `tailwind.config.ts` where `primary: 'var(--background-primary)'` etc.
3. **Consistent Class Application:** 
   - Panels and layout wrappers MUST use the background, border, and shadow properties specified by the theme's `.workspace-leaf` or equivalent structural block.

> **END OF DOCUMENT**
