import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGitNexusGraph, queryStructuralAwareness } from '../../services/dispatch/src/modules/gitnexus';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-03 — Sovereign Code Intelligence & Knowledge Graph Engine (GitNexus)', () => {
  it('successfully scans the codebase and generates a structured gitnexus-graph.json', () => {
    const graphFilePath = path.join(projectRoot, 'runtime/memory/gitnexus-graph.json');
    
    // Clean up graph if it exists to ensure freshness
    if (fs.existsSync(graphFilePath)) {
      fs.unlinkSync(graphFilePath);
    }

    const graph = buildGitNexusGraph();

    expect(graph).toBeDefined();
    expect(graph.totalFiles).toBeGreaterThan(0);
    expect(graph.totalLines).toBeGreaterThan(0);
    expect(graph.nodes).toBeDefined();
    expect(fs.existsSync(graphFilePath)).toBe(true);

    const savedGraph = JSON.parse(fs.readFileSync(graphFilePath, 'utf8'));
    expect(savedGraph.totalFiles).toEqual(graph.totalFiles);
    expect(savedGraph.totalLines).toEqual(graph.totalLines);
    expect(savedGraph.nodes).toBeDefined();
  }, 180000);

  it('successfully queries structural awareness of a core codebase file', () => {
    const queryResult = queryStructuralAwareness('services/dispatch/src/server.ts');

    expect(queryResult.found).toBe(true);
    expect(queryResult.node).toBeDefined();
    expect(queryResult.node?.filePath).toBe('services/dispatch/src/server.ts');
    expect(queryResult.node?.fileName).toBe('server.ts');
    expect(queryResult.node?.structuralRole).toBe('service-logic');
    expect(queryResult.node?.extension).toBe('.ts');
    expect(queryResult.impactDensity).toBeGreaterThanOrEqual(1);
    expect(queryResult.graphSummary).toBeDefined();
    expect(queryResult.graphSummary?.totalFiles).toBeGreaterThan(0);
  });

  it('gracefully handles non-existent files during query structural awareness', () => {
    const queryResult = queryStructuralAwareness('non-existent-file.ts');

    expect(queryResult.found).toBe(false);
    expect(queryResult.node).toBeUndefined();
    expect(queryResult.impactDensity).toBeUndefined();
  });
});
