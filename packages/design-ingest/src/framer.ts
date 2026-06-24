/**
 * @module design-ingest/framer
 * @description Canvas React Component Extractor using unframer and visual post-processing
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface ComponentProp {
    name: string;
    type: string;
    description?: string;
    required: boolean;
}

export interface IngestedComponentMeta {
    name: string;
    url: string;
    ingestedAt: string;
    props: ComponentProp[];
    styleAudit: {
        hasFixedLayout: boolean;
        warnings: string[];
        sanitized: boolean;
    };
}

export class CanvasExtractor {
    /**
     * Extracts a component from a canvas project URL.
     * Uses `npx unframer` to download and parse the React code, then applies post-processing.
     * 
     * @param url The canvas URL
     * @param outDir The absolute path where the component should be saved
     * @param targetComponent The specific component name to extract
     * @returns The path to the extracted component directory
     */
    async extract(url: string, outDir: string, targetComponent: string = 'Component'): Promise<{ success: boolean; outPath: string; error?: string }> {
        try {
            // Ensure the output directory exists
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }

            console.error(`[CANVAS-EXTRACTOR] Ingesting via unframer: ${url} -> ${outDir}`);

            // Run unframer command
            const { stdout, stderr } = await execAsync(`npx unframer "${url}" --outDir "${outDir}"`);

            console.error(`[CANVAS-EXTRACTOR] Output: ${stdout}`);
            if (stderr) {
                console.error(`[CANVAS-EXTRACTOR] Warning/stderr: ${stderr}`);
            }

            // Post-processing
            await this.postProcess(outDir, url, targetComponent);

            return {
                success: true,
                outPath: outDir
            };
        } catch (error: any) {
            console.error(`[CANVAS-EXTRACTOR] Failed to extract component: ${error.message}`);
            return {
                success: false,
                outPath: outDir,
                error: error.message
            };
        }
    }

    private async postProcess(outDir: string, url: string, targetComponent: string): Promise<void> {
        console.error(`[CANVAS-EXTRACTOR] Starting post-processing for component: ${targetComponent}`);
        
        // Find all TSX/JSX/JS/CSS files in the output directory
        const files = this.walkDir(outDir);
        
        let allProps: ComponentProp[] = [];
        const styleWarnings: string[] = [];
        let styleSanitized = false;

        for (const file of files) {
            const ext = path.extname(file);
            if (['.tsx', '.jsx', '.ts', '.js', '.css'].includes(ext)) {
                let content = fs.readFileSync(file, 'utf8');
                let modified = false;

                // 1. Style Harmonization
                const harmonized = this.harmonizeStyles(content);
                if (harmonized !== content) {
                    content = harmonized;
                    modified = true;
                    console.error(`[CANVAS-EXTRACTOR] Harmonized design tokens in file: ${path.basename(file)}`);
                }

                // 2. Layout Constraints Audit & Sanitization
                if (ext === '.tsx' || ext === '.jsx' || ext === '.css') {
                    const auditResult = this.auditAndSanitizeLayout(content, path.basename(file));
                    if (auditResult.modified) {
                        content = auditResult.content;
                        modified = true;
                        styleSanitized = true;
                    }
                    styleWarnings.push(...auditResult.warnings);
                }

                // 3. Props Extraction (only for the main React component TSX)
                if (ext === '.tsx' && path.basename(file).toLowerCase().includes(targetComponent.toLowerCase())) {
                    allProps = this.extractProps(content);
                }

                if (modified) {
                    fs.writeFileSync(file, content, 'utf8');
                }
            }
        }

        // 4. Write Component Meta JSON
        const metaPath = path.join(outDir, 'component-meta.json');
        const meta: IngestedComponentMeta = {
            name: targetComponent,
            url,
            ingestedAt: new Date().toISOString(),
            props: allProps,
            styleAudit: {
                hasFixedLayout: styleWarnings.length > 0,
                warnings: styleWarnings,
                sanitized: styleSanitized
            }
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
        console.error(`[CANVAS-EXTRACTOR] Component metadata written to ${metaPath}`);

        // 5. Registry Autopilot
        await this.registerInCatalog(meta);
    }

    private walkDir(dir: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.walkDir(file));
            } else {
                results.push(file);
            }
        });
        return results;
    }

    private harmonizeStyles(content: string): string {
        // Hex color map to CLE semantic/base tokens
        const COLOR_MAP: Record<string, string> = {
            '#ffffff': 'var(--color-base-neutral-0)',
            '#ffffff00': 'transparent',
            '#000000': 'var(--color-base-neutral-950)',
            '#0a0a0f': 'var(--color-base-neutral-950)',
            '#0a0a0a': 'var(--color-base-neutral-950)',
            '#1f2937': 'var(--color-base-neutral-800)',
            '#111827': 'var(--color-base-neutral-900)',
            '#374151': 'var(--color-base-neutral-700)',
            '#4b5563': 'var(--color-base-neutral-600)',
            '#9ca3af': 'var(--color-base-neutral-400)',
            '#e5e7eb': 'var(--color-base-neutral-200)',
            '#f3f4f6': 'var(--color-base-neutral-100)',
            '#f9fafb': 'var(--color-base-neutral-50)',
            '#06b6d4': 'var(--color-base-brand-tertiary)',
            '#3b82f6': 'var(--color-base-brand-primary)',
            '#6d28d9': 'var(--color-base-brand-secondary)',
            '#8b5cf6': 'var(--color-base-brand-secondary)',
        };

        const SPACING_MAP: Record<string, string> = {
            '4px': 'var(--spacing-xxs)',
            '8px': 'var(--spacing-xs)',
            '12px': 'var(--spacing-s)',
            '16px': 'var(--spacing-m)',
            '24px': 'var(--spacing-l)',
            '32px': 'var(--spacing-xl)',
            '48px': 'var(--spacing-xxl)',
            '64px': 'var(--spacing-xxxl)',
        };

        let result = content;

        // Replace Hex Colors
        for (const [hex, token] of Object.entries(COLOR_MAP)) {
            const escapedHex = hex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`['"]${escapedHex}['"]`, 'gi');
            result = result.replace(regex, `'${token}'`);
            
            const rawRegex = new RegExp(`:\\s*${escapedHex}\\s*([;\\s])`, 'gi');
            result = result.replace(rawRegex, `: ${token}$1`);
        }

        // Replace Spacing
        for (const [spacing, token] of Object.entries(SPACING_MAP)) {
            const escapedSpacing = spacing.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`['"]${escapedSpacing}['"]`, 'g');
            result = result.replace(regex, `'${token}'`);

            const rawRegex = new RegExp(`:\\s*${escapedSpacing}\\s*([;\\s])`, 'g');
            result = result.replace(rawRegex, `: ${token}$1`);
        }

        // Replace Font Families
        result = result.replace(/fontFamily:\s*['"](Inter|Outfit|Roboto|Open Sans|Helvetica)['"]/g, "fontFamily: 'var(--font-family-sans)'");
        result = result.replace(/font-family:\s*['"]?(Inter|Outfit|Roboto|Open Sans|Helvetica)['"]?/g, "font-family: var(--font-family-sans)");

        return result;
    }

    private auditAndSanitizeLayout(content: string, filename: string): { content: string; warnings: string[]; modified: boolean } {
        const warnings: string[] = [];
        let result = content;
        let modified = false;

        const fixedWidthRegex = /(width|minWidth|maxWidth):\s*['"]?(\d{3,4})px['"]?/g;
        let match;
        
        while ((match = fixedWidthRegex.exec(content)) !== null) {
            const val = parseInt(match[2], 10);
            if (val >= 500) {
                const warnMsg = `[Layout Audit][${filename}] Large fixed width constraint of ${val}px found on property '${match[1]}'.`;
                warnings.push(warnMsg);
                console.error(`[CANVAS-EXTRACTOR][WARNING] ${warnMsg}`);
                
                if (match[1] === 'width') {
                    const target = match[0];
                    const replacement = `width: "100%", maxWidth: "${val}px"`;
                    result = result.replace(target, replacement);
                    modified = true;
                }
            }
        }

        return { content: result, warnings, modified };
    }

    private extractProps(content: string): ComponentProp[] {
        const props: ComponentProp[] = [];
        
        const interfaceRegex = /(?:interface|type)\s+(\w*Props\w*)\s*=?\s*\{([^}]*)\}/g;
        let match = interfaceRegex.exec(content);
        
        if (match && match[2]) {
            const propBody = match[2];
            const propLines = propBody.split(/[\n;]/);
            for (const line of propLines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                const propMatch = /^(\w+)(\?)?\s*:\s*([^;,\n]+)/.exec(trimmed);
                if (propMatch) {
                    const name = propMatch[1];
                    const isOptional = !!propMatch[2];
                    const typeRaw = propMatch[3].trim();
                    
                    props.push({
                        name,
                        type: this.normalizePropType(name, typeRaw),
                        required: !isOptional
                    });
                }
            }
        }
        
        if (props.length === 0) {
            const destructureRegex = /export\s+default\s+function\s+\w+\s*\(\s*\{\s*([^}]+)\s*\}\s*\)/;
            const destructureMatch = destructureRegex.exec(content);
            if (destructureMatch && destructureMatch[1]) {
                const paramNames = destructureMatch[1].split(',').map(p => p.trim().split('=')[0].trim());
                for (const name of paramNames) {
                    if (name && name !== 'children') {
                        props.push({
                            name,
                            type: this.normalizePropType(name, 'any'),
                            required: false
                        });
                    }
                }
            }
        }

        return props;
    }

    private normalizePropType(name: string, rawType: string): string {
        const nameLower = name.toLowerCase();
        if (rawType.includes('=>') || rawType.includes('function') || nameLower.startsWith('on') || nameLower.endsWith('click')) {
            return 'function';
        }
        if (rawType.includes('boolean') || nameLower.startsWith('is') || nameLower.startsWith('has') || nameLower.startsWith('show')) {
            return 'boolean';
        }
        if (rawType.includes('number')) {
            return 'number';
        }
        if (nameLower.includes('image') || nameLower.includes('img') || nameLower.includes('avatar') || nameLower.includes('icon') || nameLower.endsWith('url') || nameLower.endsWith('src')) {
            return 'image';
        }
        return 'string';
    }

    private async registerInCatalog(meta: IngestedComponentMeta): Promise<void> {
        const catalogDir = path.resolve(process.cwd(), '..', '..', 'design-system', 'library-import', 'canvas');
        const catalogPath = path.join(catalogDir, 'catalog.json');
        
        try {
            if (!fs.existsSync(catalogDir)) {
                fs.mkdirSync(catalogDir, { recursive: true });
            }

            let catalog: any = {
                name: "Canvas Ingestion Library",
                url: "https://framer.com",
                account: {
                    status: "Logged In",
                },
                capabilities: [
                    "Visual Site Building",
                    "React Component Export",
                    "Design System Harmonization",
                    "Layout Constraint Auditing"
                ],
                ingestedComponents: []
            };

            if (fs.existsSync(catalogPath)) {
                catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
            } else {
                const fallbackPath = path.resolve(process.cwd(), '..', '..', 'design-system', 'library-import', 'framer', 'catalog.json');
                if (fs.existsSync(fallbackPath)) {
                    const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
                    catalog = { ...catalog, ...fallbackData, name: "Canvas Ingestion Library" };
                }
            }

            if (!catalog.ingestedComponents) {
                catalog.ingestedComponents = [];
            }

            catalog.ingestedComponents = catalog.ingestedComponents.filter((c: any) => c.name !== meta.name);
            
            catalog.ingestedComponents.push({
                name: meta.name,
                url: meta.url,
                ingestedAt: meta.ingestedAt,
                props: meta.props,
                styleAudit: meta.styleAudit
            });

            fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
            console.error(`[CANVAS-REGISTRY] Component registered in ${catalogPath}`);

            // Keep legacy synced
            const oldCatalogPath = path.resolve(process.cwd(), '..', '..', 'design-system', 'library-import', 'framer', 'catalog.json');
            if (fs.existsSync(oldCatalogPath)) {
                const oldCatalog = JSON.parse(fs.readFileSync(oldCatalogPath, 'utf8'));
                if (!oldCatalog.ingestedComponents) {
                    oldCatalog.ingestedComponents = [];
                }
                oldCatalog.ingestedComponents = oldCatalog.ingestedComponents.filter((c: any) => c.name !== meta.name);
                oldCatalog.ingestedComponents.push({
                    name: meta.name,
                    url: meta.url,
                    ingestedAt: meta.ingestedAt,
                    props: meta.props,
                    styleAudit: meta.styleAudit
                });
                fs.writeFileSync(oldCatalogPath, JSON.stringify(oldCatalog, null, 2), 'utf8');
                console.error(`[CANVAS-REGISTRY] Backwards compatibility catalog sync complete`);
            }
        } catch (e: any) {
            console.error(`[CANVAS-REGISTRY] Failed to register component in catalog: ${e.message}`);
        }
    }
}

// Backwards compatibility alias
export class FramerExtractor extends CanvasExtractor {}
