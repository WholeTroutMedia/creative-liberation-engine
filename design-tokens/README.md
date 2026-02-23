# Design Tokens

**Inception Engine Design Token System**

Single source of truth for colors, typography, spacing, shadows, animation, and more. Built with [Style Dictionary](https://amzn.github.io/style-dictionary/) and compiled to CSS, SCSS, JS, JSON, and Tailwind.

## Quick Start

```bash
cd design-tokens
npm install
npm run build
```

This generates compiled tokens in `dist/`:

```
dist/
  css/tokens.css          # CSS custom properties (:root)
  scss/_tokens.scss       # SCSS variables
  js/tokens.js            # CommonJS module
  js/tokens.esm.js        # ES module
  json/tokens.json        # Flat resolved JSON
  tailwind/tokens.js      # Tailwind theme extension
```

## Usage

### CSS

```css
@import '@inception-engine/design-tokens/css';
/* OR: @import '../design-tokens/dist/css/tokens.css'; */

.card {
  background: var(--ie-color-semantic-bg-raised);
  border-radius: var(--ie-border-radius-xl);
  box-shadow: var(--ie-shadow-sm);
  padding: var(--ie-spacing-4);
}
```

### SCSS

```scss
@import '@inception-engine/design-tokens/scss';

.heading {
  font-size: $ie-typography-font-size-3xl;
  font-weight: $ie-typography-font-weight-bold;
  color: $ie-color-semantic-text-primary;
}
```

### JavaScript / TypeScript

```ts
import tokens from '@inception-engine/design-tokens';

const primaryColor = tokens['color.semantic.brand.primary'];
const baseDuration = tokens['animation.duration.base'];
```

### Tailwind

```js
// tailwind.config.js
const tokenTheme = require('@inception-engine/design-tokens/tailwind');

module.exports = {
  theme: { extend: { ...tokenTheme } },
};
```

Then use in markup: `bg-brand-primary`, `text-text-secondary`, `shadow-brand`, `rounded-xl`, `duration-fast`.

## Token Categories

| Category | Prefix | Examples |
|---|---|---|
| Colors (primitive) | `--ie-color-primitive-*` | `neutral-900`, `violet-600`, `blue-500` |
| Colors (semantic) | `--ie-color-semantic-*` | `brand-primary`, `bg-base`, `text-link`, `status-error-bg` |
| Typography | `--ie-typography-*` | `font-size-base`, `font-weight-bold`, `line-height-normal` |
| Spacing | `--ie-spacing-*` | `0`, `1`, `2`, `4`, `8`, `12`, `16`, `24`, `64` |
| Border Radius | `--ie-border-radius-*` | `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `full` |
| Shadows | `--ie-shadow-*` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `inner`, `brand` |
| Animation | `--ie-animation-*` | `duration-fast`, `duration-base`, `easing-spring` |
| Z-Index | `--ie-z-index-*` | `dropdown`, `sticky`, `modal`, `toast` |

## npm Scripts

| Command | Description |
|---|---|
| `npm run build` | Build all platform outputs |
| `npm run build:css` | Build CSS only |
| `npm run build:scss` | Build SCSS only |
| `npm run build:js` | Build JS modules only |
| `npm run build:tailwind` | Build Tailwind theme only |
| `npm run build:json` | Build flat JSON only |
| `npm run clean` | Remove dist/ |
| `npm run rebuild` | Clean + build |
| `npm run watch` | Rebuild on tokens.json changes |
| `npm run validate` | Validate tokens.json syntax |

## Customizing Tokens

Edit `tokens.json` directly. The file uses Style Dictionary format:

```json
{
  "color": {
    "primitive": {
      "violet": {
        "600": { "value": "#7c3aed", "type": "color" }
      }
    },
    "semantic": {
      "brand": {
        "primary": { "value": "{color.primitive.violet.600}", "type": "color" }
      }
    }
  }
}
```

Semantic tokens reference primitives using `{path.to.token}` syntax. Change the primitive, and all referencing semantic tokens update automatically.

## Dark Mode

Dark mode works by overriding CSS custom properties. See `examples/usage.css` for the full pattern:

```css
:root[data-theme="dark"] {
  --ie-color-semantic-bg-base: var(--ie-color-primitive-neutral-900);
  --ie-color-semantic-text-primary: var(--ie-color-primitive-neutral-50);
}
```

## Architecture

```
tokens.json          # Source of truth (Style Dictionary format)
build.js             # Compilation script with custom transforms/formats
package.json         # npm scripts and dependencies
examples/
  usage.css          # CSS integration patterns
  Button.tsx         # React component example
  tailwind.config.js # Tailwind integration example
dist/                # Generated outputs (gitignored)
```

## CI/CD

Tokens are automatically built on push via `.github/workflows/build-tokens.yml`. The workflow validates JSON syntax and compiles all platforms.

---

**Built by AVERI** (ATHENA + VERA + IRIS) under Constitutional governance. Article IX quality standards apply.
