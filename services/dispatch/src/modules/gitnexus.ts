import * as fs from 'fs';
import * as path from 'path';

// WS-03: Sovereign Codebase Intelligence Knowledge Graph (GitNexus)
// Builds a structural map of codebase files, routes, schemas, and imports.

export interface CodeNode {
    filePath: string;
    fileName: string;
    extension: string;
    imports: string[];
    importedBy: string[];
    dependencies: string[];
    schemaDependencies: string[];
    sizeBytes: number;
    linesCount: number;
    structuralRole: string;
}

export interface GitNexusGraph {
    lastScanned: string;
    totalFiles: number;
    totalLines: number;
    nodes: Record<string, CodeNode>;
}

function findProjectRoot(): string {
    let current = __dirname;
    while (current) {
        if (fs.existsSync(path.join(current, 'AGENTS.md'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return '/app/creative-liberation-engine';
}

/**
 * Parses imports and dependencies from a file.
 */
function parseFileDetails(absolutePath: string, relativePath: string): {
    imports: string[];
    schemaDependencies: string[];
    linesCount: number;
    structuralRole: string;
} {
    const imports: string[] = [];
    const schemaDependencies: string[] = [];
    let linesCount = 0;
    let structuralRole = 'general';

    try {
        const content = fs.readFileSync(absolutePath, 'utf8');
        const lines = content.split('\n');
        linesCount = lines.length;

        // Determine structural role
        if (relativePath.includes('services/')) {
            structuralRole = 'service-logic';
        } else if (relativePath.includes('schemas/')) {
            structuralRole = 'contract-schema';
        } else if (relativePath.includes('tests/')) {
            structuralRole = 'test-suite';
        } else if (relativePath.includes('scripts/')) {
            structuralRole = 'automation-script';
        }

        // Regular expressions for parsing imports
        const jsImportRegex = /import\s+?(?:(?:(?:[a-zA-Z0-9{}*,\s]+?)\s+from\s+?['"](.*?)['"])|(?:['"](.*?)['"]))/g;
        const jsRequireRegex = /require\(['"](.*?)['"]\)/g;
        const pyImportRegex = /^\s*(?:import\s+([a-zA-Z0-9_, ]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/;

        for (const line of lines) {
            // Check for Schema references
            if (line.includes('.schema.json')) {
                const schemaMatch = line.match(/[a-zA-Z0-9_.-]+\.schema\.json/);
                if (schemaMatch) {
                    schemaDependencies.push(schemaMatch[0]);
                }
            }

            // Parse TS/JS Imports
            let match;
            while ((match = jsImportRegex.exec(line)) !== null) {
                const importPath = match[1] || match[2];
                if (importPath && !importPath.startsWith('node:')) {
                    imports.push(importPath);
                }
            }
            while ((match = jsRequireRegex.exec(line)) !== null) {
                const importPath = match[1];
                if (importPath) {
                    imports.push(importPath);
                }
            }

            // Parse Python Imports
            const pyMatch = line.match(pyImportRegex);
            if (pyMatch) {
                const imported = pyMatch[1] || pyMatch[2];
                if (imported) {
                    imports.push(imported.trim());
                }
            }
        }
    } catch (err) {
        // Non-fatal
    }

    return {
        imports: Array.from(new Set(imports)),
        schemaDependencies: Array.from(new Set(schemaDependencies)),
        linesCount,
        structuralRole
    };
}

/**
 * Scan the entire codebase to build the GitNexus Knowledge Graph.
 */
export function buildGitNexusGraph(): GitNexusGraph {
    const projectRoot = findProjectRoot();
    const runtimeDir = path.join(projectRoot, 'runtime/memory');
    if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true });
    }

    const graphFile = path.join(runtimeDir, 'gitnexus-graph.json');
    const nodes: Record<string, CodeNode> = {};
    let totalLines = 0;
    let totalFiles = 0;

    const skipDirs = new Set(['node_modules', '.git', 'build', 'dist', '.pnpm-store', '.kilocode', 'playwright-profile', 'data']);
    const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.md']);

    function scanDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const absolutePath = path.join(dir, file);
            const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

            // Skip ignored directories
            if (skipDirs.has(file) || file.startsWith('.')) continue;

            const stat = fs.statSync(absolutePath);
            if (stat.isDirectory()) {
                scanDir(absolutePath);
            } else if (stat.isFile()) {
                const ext = path.extname(file);
                if (!allowedExts.has(ext)) continue;

                totalFiles++;
                const { imports, schemaDependencies, linesCount, structuralRole } = parseFileDetails(absolutePath, relativePath);
                totalLines += linesCount;

                nodes[relativePath] = {
                    filePath: relativePath,
                    fileName: file,
                    extension: ext,
                    imports,
                    importedBy: [],
                    dependencies: [],
                    schemaDependencies,
                    sizeBytes: stat.size,
                    linesCount,
                    structuralRole
                };
            }
        }
    }

    // Run recursive scan
    scanDir(projectRoot);

    // Map backward references (importedBy) and resolve dependency paths
    for (const [relPath, node] of Object.entries(nodes)) {
        const fileDir = path.dirname(relPath);
        for (const imp of node.imports) {
            let resolvedPath = '';

            if (imp.startsWith('.')) {
                // Relative import resolution
                const potentialPath = path.posix.normalize(path.posix.join(fileDir, imp));
                // Try extension variations
                for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
                    const check = potentialPath + ext;
                    if (nodes[check]) {
                        resolvedPath = check;
                        break;
                    }
                    const checkIndex = path.posix.join(potentialPath, 'index' + ext);
                    if (nodes[checkIndex]) {
                        resolvedPath = checkIndex;
                        break;
                    }
                }
            } else {
                // Workspace or absolute resolution check
                if (imp.startsWith('@cle/') || imp.startsWith('@creative-liberation-engine/')) {
                    const workspaceMatch = Object.keys(nodes).find(k => k.includes(`services/${imp.split('/')[1]}/src/`));
                    if (workspaceMatch) resolvedPath = workspaceMatch;
                }
            }

            if (resolvedPath && nodes[resolvedPath]) {
                node.dependencies.push(resolvedPath);
                if (!nodes[resolvedPath].importedBy.includes(relPath)) {
                    nodes[resolvedPath].importedBy.push(relPath);
                }
            }
        }
    }

    const graph: GitNexusGraph = {
        lastScanned: new Date().toISOString(),
        totalFiles,
        totalLines,
        nodes
    };

    fs.writeFileSync(graphFile, JSON.stringify(graph, null, 2));
    console.log(`[GITNEXUS] Structural Knowledge Graph written successfully: ${totalFiles} files indexed.`);
    return graph;
}

/**
 * Returns structural awareness for a target file.
 */
export function queryStructuralAwareness(targetFilePath: string): {
    found: boolean;
    node?: CodeNode;
    impactDensity?: number;
    graphSummary?: { totalFiles: number; totalLines: number };
} {
    const projectRoot = findProjectRoot();
    const graphFile = path.join(projectRoot, 'runtime/memory/gitnexus-graph.json');
    
    let graph: GitNexusGraph;
    if (fs.existsSync(graphFile)) {
        graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    } else {
        graph = buildGitNexusGraph();
    }

    const normalizedTarget = targetFilePath.replace(/\\/g, '/');
    const node = graph.nodes[normalizedTarget];

    if (!node) {
        return { found: false };
    }

    // Impact density = files that import this file directly + files it imports
    const impactDensity = node.imports.length + node.importedBy.length;

    return {
        found: true,
        node,
        impactDensity,
        graphSummary: {
            totalFiles: graph.totalFiles,
            totalLines: graph.totalLines
        }
    };
}
