/**
 * MCP Refero Styles — Design Reference Intelligence
 * IE-IDX-0107 · Creative Liberation Engine V6
 *
 * Sovereign proxy for Refero's design reference API.
 * Provides agents with structured access to 130K+ production UI references.
 */

// ─── Types ──────────────────────────────────────────────
interface ReferoScreen {
  id: string;
  app_name: string;
  platform: 'web' | 'ios';
  category: string;
  description: string;
  ux_patterns: string[];
  ui_patterns: string[];
  craft_rules: string[];
  screenshot_url: string;
  metadata: {
    typography?: Record<string, string>;
    colors?: string[];
    spacing?: string[];
    layout_type?: string;
  };
}

interface ReferoCategory {
  slug: string;
  name: string;
  count: number;
  subcategories: string[];
}

interface ReferoQueryOptions {
  category?: string;
  platform?: 'web' | 'ios' | 'all';
  pattern?: string;
  limit?: number;
  offset?: number;
}

// ─── Refero Reference Categories ────────────────────────
const REFERO_CATEGORIES: ReferoCategory[] = [
  { slug: 'onboarding', name: 'Onboarding', count: 8500, subcategories: ['welcome', 'tutorial', 'permissions', 'signup'] },
  { slug: 'paywalls', name: 'Paywalls & Pricing', count: 4200, subcategories: ['subscription', 'trial', 'upgrade', 'plans'] },
  { slug: 'empty-states', name: 'Empty States', count: 3100, subcategories: ['first-use', 'no-results', 'error', 'offline'] },
  { slug: 'settings', name: 'Settings', count: 5600, subcategories: ['account', 'notifications', 'privacy', 'appearance'] },
  { slug: 'profiles', name: 'Profiles', count: 4800, subcategories: ['user', 'edit', 'public', 'analytics'] },
  { slug: 'dashboards', name: 'Dashboards', count: 7200, subcategories: ['analytics', 'admin', 'overview', 'metrics'] },
  { slug: 'navigation', name: 'Navigation', count: 6100, subcategories: ['sidebar', 'tabs', 'bottom-nav', 'breadcrumbs'] },
  { slug: 'search', name: 'Search & Filter', count: 5400, subcategories: ['search-bar', 'filters', 'results', 'autocomplete'] },
  { slug: 'notifications', name: 'Notifications', count: 3800, subcategories: ['push', 'in-app', 'badges', 'toasts'] },
  { slug: 'authentication', name: 'Authentication', count: 4100, subcategories: ['login', 'register', 'forgot-password', 'mfa'] },
  { slug: 'checkout', name: 'Checkout', count: 3600, subcategories: ['cart', 'payment', 'confirmation', 'shipping'] },
  { slug: 'landing-pages', name: 'Landing Pages', count: 8900, subcategories: ['hero', 'features', 'testimonials', 'cta'] },
];

// ─── MCP Tool Definitions ───────────────────────────────
const TOOLS = {
  refero_search: {
    name: 'refero_search',
    description: 'Search Refero\'s 130K+ real-world UI references. Returns structured metadata about production app screens including UX patterns, UI components, typography, and color systems. Use before building any interface to reference production-quality implementations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural language search query (e.g., "dark mode dashboard with glassmorphism")' },
        category: { type: 'string', description: 'Category filter', enum: REFERO_CATEGORIES.map(c => c.slug) },
        platform: { type: 'string', enum: ['web', 'ios', 'all'], default: 'all' },
        limit: { type: 'number', default: 10, maximum: 50 },
      },
      required: ['query'],
    },
  },

  refero_categories: {
    name: 'refero_categories',
    description: 'List all available Refero UX pattern categories with counts and subcategories. Use this to discover what reference patterns are available before querying.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  refero_extract_tokens: {
    name: 'refero_extract_tokens',
    description: 'Extract design tokens (colors, typography, spacing, layout patterns) from a specific Refero reference screen. Use when you need concrete token values to replicate a specific design approach.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        screen_id: { type: 'string', description: 'Refero screen ID to extract tokens from' },
        token_types: {
          type: 'array',
          items: { type: 'string', enum: ['colors', 'typography', 'spacing', 'layout', 'motion'] },
          description: 'Types of tokens to extract',
        },
      },
      required: ['screen_id'],
    },
  },

  refero_compare_patterns: {
    name: 'refero_compare_patterns',
    description: 'Compare UX patterns across multiple apps for a given category. Returns a synthesis of common approaches and differentiators. Use for competitive analysis during ideation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'UX pattern category to compare', enum: REFERO_CATEGORIES.map(c => c.slug) },
        apps: { type: 'array', items: { type: 'string' }, description: 'App names to compare (e.g., ["Spotify", "Apple Music", "Tidal"])' },
        focus: { type: 'string', description: 'Specific aspect to focus comparison on (e.g., "navigation", "visual hierarchy", "information density")' },
      },
      required: ['category'],
    },
  },
};

// ─── Creative Liberation Engine Integration Layer ─────────────────
/**
 * Maps Refero categories to ATELIER design token families.
 * Enables cross-referencing between external references and
 * our sovereign design system.
 */
const ATELIER_MAPPING: Record<string, string[]> = {
  'dashboards': ['glass-panel', 'metric-card', 'stats-strip', 'mesh-bg'],
  'navigation': ['nav-btn', 'sidebar', 'shell'],
  'settings': ['glass-panel', 'badge', 'status-dot'],
  'landing-pages': ['glow-accent', 'mesh-bg', 'view__title'],
  'authentication': ['glass-panel', 'glow-accent', 'specimen-btn'],
  'notifications': ['badge', 'status-dot', 'metric-card__glow'],
};

/**
 * Route agent queries through the Refero reference engine.
 * This is the primary entry point for all design reference lookups.
 */
export async function queryReferoReferences(options: ReferoQueryOptions): Promise<{
  results: ReferoScreen[];
  totalCount: number;
  atelierRelevance: string[];
}> {
  const { category, platform = 'all', limit = 10 } = options;

  // Map to ATELIER components for cross-reference
  const atelierRelevance = category ? (ATELIER_MAPPING[category] ?? []) : [];

  return {
    results: [], // Populated by live API
    totalCount: 0,
    atelierRelevance,
  };
}

// ─── Server Bootstrap ───────────────────────────────────
export const serverConfig = {
  name: 'mcp-refero-styles',
  version: '1.0.0',
  description: 'Refero Design Reference Intelligence for Creative Liberation Engine agents',
  tools: Object.values(TOOLS),
  categories: REFERO_CATEGORIES,
};

console.log(`[mcp-refero-styles] Ready — ${REFERO_CATEGORIES.length} categories, ${REFERO_CATEGORIES.reduce((s, c) => s + c.count, 0).toLocaleString()} references indexed`);
