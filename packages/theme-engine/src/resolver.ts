// packages/theme-engine/src/resolver.ts
// DS-305: Theme Resolver — maps semantic token names → resolved CSS custom properties

import { type Theme, BUILT_IN_THEMES, type ThemeId } from './themes.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedTheme {
    /** Theme identity */
    id: ThemeId;
    /** Flat map of CSS custom property name → resolved value */
    cssProperties: Record<string, string>;
    /** Full override chain: base defaults → theme overrides */
    tokenMap: Record<string, string>;
}

// ─── Base semantic defaults ───────────────────────────────────────────────────
// These are the "default" values that every theme starts from.
// Themes override specific entries; everything else falls through.

const BASE_SEMANTIC_TOKENS: Record<string, string> = {
    // Colors
    'color.primary': '#0066cc',
    'color.primaryHover': '#0052a3',
    'color.primarySubtle': '#e6f0fa',
    'color.secondary': '#6b7280',
    'color.success': '#059669',
    'color.warning': '#d97706',
    'color.danger': '#dc2626',
    'color.info': '#2563eb',
    'color.surface.base': '#ffffff',
    'color.surface.card': '#f9fafb',
    'color.surface.overlay': '#f3f4f6',
    'color.text.primary': '#111827',
    'color.text.secondary': '#4b5563',
    'color.text.disabled': '#9ca3af',
    'color.border.default': '#e5e7eb',
    'color.border.focus': '#0066cc',
    // Spacing
    'spacing.xs': '4px',
    'spacing.sm': '8px',
    'spacing.md': '16px',
    'spacing.lg': '24px',
    'spacing.xl': '32px',
    'spacing.2xl': '48px',
    'spacing.3xl': '64px',
    // Typography
    'font.family.sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font.family.mono': 'Menlo, Monaco, "Courier New", monospace',
    'font.size.h1': '2.25rem',
    'font.size.h2': '1.875rem',
    'font.size.h3': '1.5rem',
    'font.size.h4': '1.25rem',
    'font.size.h5': '1.125rem',
    'font.size.h6': '1rem',
    'font.size.body': '1rem',
    'font.size.small': '0.875rem',
    'font.size.caption': '0.75rem',
    // Radius
    'radius.sm': '4px',
    'radius.md': '8px',
    'radius.lg': '16px',
    // Shadow
    'shadow.sm': '0 1px 2px rgba(0,0,0,0.05)',
    'shadow.md': '0 4px 6px rgba(0,0,0,0.1)',
    'shadow.lg': '0 10px 15px rgba(0,0,0,0.1)',
    'shadow.xl': '0 20px 25px rgba(0,0,0,0.1)',
};

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Convert a dot-notated token path to a CSS custom property name.
 * `color.primary` → `--inc-color-primary`
 */
function tokenPathToCssVar(tokenPath: string): string {
    return `--inc-${tokenPath.replace(/\./g, '-')}`;
}

/**
 * Resolve a theme to a flat token map by merging base defaults with theme overrides.
 * The result is a complete set of all semantic tokens with their resolved values.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
    const tokenMap: Record<string, string> = { ...BASE_SEMANTIC_TOKENS };

    // Apply color overrides
    if (theme.overrides.color) {
        for (const [key, value] of Object.entries(theme.overrides.color)) {
            tokenMap[key] = value;
        }
    }

    // Apply spacing overrides
    if (theme.overrides.spacing) {
        for (const [key, value] of Object.entries(theme.overrides.spacing)) {
            tokenMap[key] = value;
        }
    }

    // Apply font family overrides
    if (theme.overrides.fontFamily) {
        for (const [key, value] of Object.entries(theme.overrides.fontFamily)) {
            tokenMap[key] = value;
        }
    }

    // Generate CSS custom properties
    const cssProperties: Record<string, string> = {};
    for (const [tokenPath, value] of Object.entries(tokenMap)) {
        cssProperties[tokenPathToCssVar(tokenPath)] = value;
    }

    return {
        id: theme.id,
        cssProperties,
        tokenMap,
    };
}

/**
 * Resolve a built-in theme by ID.
 */
export function resolveBuiltInTheme(themeId: ThemeId): ResolvedTheme {
    const theme = BUILT_IN_THEMES[themeId];
    if (!theme) throw new Error(`Unknown built-in theme: ${themeId}`);
    return resolveTheme(theme);
}

/**
 * Generate a CSS stylesheet block from a resolved theme.
 * Produces `:root` or `[data-theme="id"]` scoped custom properties.
 */
export function resolvedThemeToCSS(resolved: ResolvedTheme, selector?: string): string {
    const sel = selector ?? `[data-theme="${resolved.id}"]`;
    const lines = Object.entries(resolved.cssProperties)
        .map(([prop, value]) => `  ${prop}: ${value};`);
    return `${sel} {\n${lines.join('\n')}\n}`;
}

/**
 * Export a theme as W3C DTCG JSON object (for interchange with other tools).
 */
export function resolvedThemeToDTCG(resolved: ResolvedTheme): Record<string, unknown> {
    const groups: Record<string, Record<string, { $type: string; $value: string }>> = {};

    for (const [tokenPath, value] of Object.entries(resolved.tokenMap)) {
        const parts = tokenPath.split('.');
        const groupKey = parts[0] ?? 'misc';
        const tokenName = parts.slice(1).join('.');

        if (!groups[groupKey]) groups[groupKey] = {};

        const $type = groupKey === 'color' ? 'color'
            : groupKey === 'spacing' || groupKey === 'radius' ? 'dimension'
            : groupKey === 'shadow' ? 'shadow'
            : groupKey === 'font' ? 'fontFamily'
            : 'string';

        groups[groupKey][tokenName] = { $type, $value: value };
    }

    return {
        $schema: 'https://tr.designtokens.org/format/',
        $metadata: {
            themeId: resolved.id,
            exportedAt: new Date().toISOString(),
            generator: '@cle/theme-engine',
        },
        ...groups,
    };
}

/** Expose the base semantic tokens for governance/diff purposes */
export { BASE_SEMANTIC_TOKENS };
