# AURORA Design Tokens

## Overview
Design tokens are the visual design atoms of the Creative Liberation Engine design system. These tokens ensure consistency across all AURORA-generated interfaces.

## Token Categories

### Color Tokens
```
--color-primary-main: #6366F1
--color-primary-light: #818CF8
--color-primary-dark: #4F46E5
--color-primary-contrast: #FFFFFF

--color-secondary-main: #8B5CF6
--color-secondary-light: #A78BFA
--color-secondary-dark: #7C3AED

--color-success: #10B981
--color-warning: #F59E0B
--color-error: #EF4444
--color-info: #3B82F6

--color-neutral-50: #F9FAFB
--color-neutral-100: #F3F4F6
--color-neutral-900: #111827
```

### Typography Tokens
```
--font-family-primary: 'Inter', sans-serif
--font-family-mono: 'Fira Code', monospace

--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-base: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem

--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700

--line-height-tight: 1.25
--line-height-normal: 1.5
--line-height-relaxed: 1.75
```

### Spacing Tokens
```
--spacing-1: 0.25rem  /* 4px */
--spacing-2: 0.5rem   /* 8px */
--spacing-3: 0.75rem  /* 12px */
--spacing-4: 1rem     /* 16px */
--spacing-5: 1.25rem  /* 20px */
--spacing-6: 1.5rem   /* 24px */
--spacing-8: 2rem     /* 32px */
--spacing-10: 2.5rem  /* 40px */
--spacing-12: 3rem    /* 48px */
```

### Border Tokens
```
--border-radius-sm: 0.125rem
--border-radius-base: 0.25rem
--border-radius-md: 0.375rem
--border-radius-lg: 0.5rem
--border-radius-xl: 0.75rem
--border-radius-full: 9999px

--border-width-1: 1px
--border-width-2: 2px
--border-width-4: 4px
```

### Shadow Tokens
```
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
```

## Component Patterns

### Buttons
```css
.button-primary {
  background: var(--color-primary-main);
  color: var(--color-primary-contrast);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--border-radius-md);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-sm);
}

.button-primary:hover {
  background: var(--color-primary-dark);
}
```

### Cards
```css
.card {
  background: var(--color-neutral-50);
  border: var(--border-width-1) solid var(--color-neutral-200);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

### Input Fields
```css
.input {
  background: #FFFFFF;
  border: var(--border-width-1) solid var(--color-neutral-300);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-3) var(--spacing-4);
}

.input:focus {
  border-color: var(--color-primary-main);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  outline: none;
}
```

## Semantic Colors

### Agent Status Colors
```
--agent-online: #10B981 (green)
--agent-pending: #F59E0B (amber)
--agent-offline: #6B7280 (gray)
```

### Constitutional Review Colors
```
--constitutional-approved: #10B981 (green)
--constitutional-rejected: #EF4444 (red)
--constitutional-pending: #F59E0B (amber)
```

### Memory Type Colors
```
--memory-episodic: #3B82F6 (blue)
--memory-semantic: #8B5CF6 (purple)
--memory-procedural: #06B6D4 (cyan)
```

## Platform-Specific Guidelines

### Web
- Minimum touch target size: 44px
- Focus visible outline: 2px solid primary
- Respect prefers-reduced-motion

### macOS
- Window background: neutral-50
- Toolbar height: 52px
- Never stack more than 4 .sheet() modifiers
- Use .fileImporter instead of NSOpenPanel in SwiftUI

### iOS
- Safe area padding required
- Navigation bar height: 44px
- Tab bar height: 49px
- Minimum touch target: 44px

## Usage Rules

### Do's ✅
- Always use token variables, never hardcoded values
- Maintain 4.5:1 contrast ratio minimum
- Use 8px spacing increments (0.5rem)
- Test on all target platforms
- Document new patterns immediately

### Don'ts ❌
- Never use arbitrary color values
- Avoid random spacing (use scale)
- Don't stack more than 4 modals (macOS)
- Never modify core tokens without design review
- Don't create one-off components without documentation

## Auto-Injection

These tokens are automatically injected into:
- All AURORA hive agents
- BOLT production builder
- Any agent generating frontend code

Injection happens at system prompt level for consistency.

## Token Updates

When updating tokens:
1. Update `design-system.json` first
2. Update this documentation
3. Run visual regression tests
4. Log change in migration tracker
5. Notify affected agents

## Related Files
- `design-system.json` (source of truth)
- `auto-inject-config.py` (injection logic)
- `CORE_FOUNDATION/AGENT_CONSTITUTION.md` (governance)
