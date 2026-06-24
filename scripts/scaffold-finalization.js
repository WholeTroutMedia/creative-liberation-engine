const fs = require('fs');
const path = require('path');

const packages = [
  { id: 'ghost-agent', name: 'GHOST Stealth Agent', schema: 'GHOST_AGENT' },
  { id: 'blockchain-layer', name: 'Blockchain and Web3', schema: 'BLOCKCHAIN_LAYER' },
  { id: 'living-canvas', name: 'Living Canvas Generative UI', schema: 'LIVING_CANVAS' },
  { id: 'gen-ui', name: 'Generative UI System', schema: 'GEN_UI' },
  { id: 'idv-engine', name: 'Identity Verification', schema: 'IDV_ENGINE' },
  { id: 'wire-ingestion-mcp', name: 'Wire Ingestion MCP', schema: 'WIRE_INGESTION_MCP' },
  { id: 'voc-mcp', name: 'Voice of Customer MCP', schema: 'VOC_MCP' }
];

const repoRoot = path.resolve(__dirname, '..');

for (const pkg of packages) {
  const pkgDir = path.join(repoRoot, 'services', 'packages', pkg.id);
  const srcDir = path.join(pkgDir, 'src');
  
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // package.json
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
    name: `@cle/${pkg.id}`,
    version: "0.1.0",
    description: pkg.name,
    type: "module",
    main: "dist/index.js",
    types: "dist/index.d.ts",
    scripts: {
      "build": "tsc -b",
      "dev": "tsc -b --watch"
    },
    devDependencies: {
      "typescript": "~5.7.2",
      "@types/node": "^22.0.0"
    }
  }, null, 2));

  // tsconfig.json
  fs.writeFileSync(path.join(pkgDir, 'tsconfig.json'), JSON.stringify({
    extends: "../../../tsconfig.base.json",
    compilerOptions: {
      outDir: "dist",
      rootDir: "src",
      module: "NodeNext",
      moduleResolution: "NodeNext"
    },
    include: ["src/**/*"]
  }, null, 2));

  // index.ts
  fs.writeFileSync(path.join(srcDir, 'index.ts'), `/**
 * ${pkg.name}
 * End-to-end wired stub for V6.
 */
export function initialize() {
  console.log('[${pkg.id}] Initialized');
}
`);

  // schema
  const schemaPath = path.join(repoRoot, 'schemas', `${pkg.schema}.schema.json`);
  if (!fs.existsSync(schemaPath)) {
    fs.writeFileSync(schemaPath, JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": pkg.schema,
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true }
      }
    }, null, 2));
  }
}

console.log('All packages scaffolded successfully.');
