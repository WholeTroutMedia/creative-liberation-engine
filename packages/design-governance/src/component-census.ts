// packages/design-governance/src/component-census.ts
// DS-702: Component census reporter — deviation-from-schema detection

import type { ComponentCensusEntry, ComponentCensusReport } from './types.js';

// ─── Types for input ──────────────────────────────────────────────────────────

export interface ComponentFileInfo {
    /** Component name (e.g. `Button`) */
    name: string;
    /** Absolute file path */
    filePath: string;
    /** File content (TypeScript/TSX source) */
    content: string;
    /** JSON schema content if it exists, null otherwise */
    schemaContent: string | null;
}

// ─── Prop Extraction (regex-based, fast) ──────────────────────────────────────

/** Matches `interface SomethingProps { ... }` blocks */
const INTERFACE_PATTERN = /interface\s+\w*Props\s*(?:extends\s+[\w<>,\s]+)?\s*\{([^}]*)\}/gs;
/** Matches individual prop definitions like `label: string;` or `variant?: 'primary' | 'secondary';` */
const PROP_LINE_PATTERN = /^\s*([\w]+)\s*\??:/gm;

/**
 * Extract prop names from a TypeScript component file by scanning for `*Props` interfaces.
 */
function extractPropsFromSource(content: string): string[] {
    const props = new Set<string>();
    const interfaceMatches = content.matchAll(INTERFACE_PATTERN);

    for (const match of interfaceMatches) {
        const body = match[1] ?? '';
        const propMatches = body.matchAll(PROP_LINE_PATTERN);
        for (const propMatch of propMatches) {
            if (propMatch[1]) props.add(propMatch[1]);
        }
    }

    return Array.from(props);
}

/**
 * Extract property names from a JSON Schema object.
 * Looks for `properties` at the top level.
 */
function extractPropsFromSchema(schemaContent: string): string[] {
    try {
        const schema = JSON.parse(schemaContent) as Record<string, unknown>;
        const properties = schema['properties'] as Record<string, unknown> | undefined;
        if (properties && typeof properties === 'object') {
            return Object.keys(properties);
        }
        return [];
    } catch {
        return [];
    }
}

// ─── Census Builder ───────────────────────────────────────────────────────────

/**
 * Build a census entry for a single component.
 */
export function buildCensusEntry(file: ComponentFileInfo): ComponentCensusEntry {
    const sourceProps = extractPropsFromSource(file.content);
    const hasSchema = file.schemaContent !== null;

    let schemaPropCount = 0;
    let deviationScore = 100; // worst case: no schema

    if (hasSchema && file.schemaContent) {
        const schemaProps = extractPropsFromSchema(file.schemaContent);
        schemaPropCount = schemaProps.length;

        if (sourceProps.length > 0) {
            // Deviation = percentage of source props NOT covered by schema
            const covered = sourceProps.filter((p) => schemaProps.includes(p)).length;
            deviationScore = Math.round(100 - (covered / sourceProps.length) * 100);
        } else {
            deviationScore = 0; // no props = perfect coverage
        }
    }

    return {
        name: file.name,
        filePath: file.filePath,
        hasSchema,
        propCount: sourceProps.length,
        schemaPropCount,
        deviationScore,
    };
}

/**
 * Build a full component census report from a list of component files.
 */
export function buildComponentCensus(files: ComponentFileInfo[]): ComponentCensusReport {
    const entries = files.map(buildCensusEntry);
    const missingSchemas = entries.filter((e) => !e.hasSchema).map((e) => e.name);
    const partialSchemas = entries
        .filter((e) => e.hasSchema && e.deviationScore > 0)
        .map((e) => e.name);

    const totalDeviation = entries.reduce((sum, e) => sum + e.deviationScore, 0);
    const averageDeviation = entries.length > 0 ? Math.round(totalDeviation / entries.length) : 0;

    return {
        totalComponents: entries.length,
        missingSchemas,
        partialSchemas,
        averageDeviation,
        entries,
    };
}
