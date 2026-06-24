import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvertedIndex } from '../src/index-builder.js';
import { SemanticMatcher } from '../src/semantic.js';
import { IntentResolver } from '../src/resolver.js';

describe('Intent Resolver Unit Tests (INTENT_ROUTING_CONTRACT.md Parity)', () => {
  let index: InvertedIndex;
  let semantic: SemanticMatcher;
  let resolver: IntentResolver;

  beforeEach(() => {
    // 1. Create a mocked InvertedIndex
    index = new InvertedIndex();
    
    // Set up mock raw registries
    index.skillsRaw = [
      {
        skillId: 'incident-commander',
        name: 'incident-commander',
        status: 'active',
        agentCallable: true,
        aliases: ['incident-commander', 'incident-manager'],
        triggers: ['manage incident response', 'handle outage', 'restore systems'],
        domain: 'runtime-ops',
        leadAgents: ['SYSTEMS', 'ARCHON']
      },
      {
        skillId: 'security-hardener',
        name: 'security-hardener',
        status: 'active',
        agentCallable: true,
        aliases: ['security-hardener', 'firewall-manager'],
        triggers: ['harden server security', 'apply security patches', 'audit firewall settings'],
        domain: 'security',
        leadAgents: ['SENTINEL', 'VAULT']
      },
      {
        skillId: 'cost-arbitrage',
        name: 'cost-arbitrage',
        status: 'active',
        agentCallable: true,
        aliases: ['cost-arbitrage', 'cloud-spend-optimizer'],
        triggers: ['optimize cloud spend', 'reduce AWS bills', 'cost analysis'],
        domain: 'infrastructure',
        leadAgents: ['SYSTEMS', 'ATLAS']
      },
      {
        skillId: 'inactive-skill',
        name: 'inactive-skill',
        status: 'inactive',
        agentCallable: true,
        aliases: ['inactive-skill'],
        triggers: ['do inactive things'],
        domain: 'runtime-ops',
        leadAgents: ['SYSTEMS']
      },
      {
        skillId: 'non-callable-skill',
        name: 'non-callable-skill',
        status: 'active',
        agentCallable: false,
        aliases: ['non-callable-skill'],
        triggers: ['run internal agent task'],
        domain: 'runtime-ops',
        leadAgents: ['SYSTEMS']
      }
    ];

    index.templatesRaw = [
      {
        id: 'ciso-board-brief',
        name: 'CISO Board Brief',
        minTier: 'pro',
        sections: ['Threat Profile', 'Risk Heatmap', 'Security Scorecard'],
        triggers: ['ciso board brief', 'ciso brief', 'security summary'],
        dataSkills: ['security-hardener'],
        assemblyAgent: 'SENTINEL'
      },
      {
        id: 'sovereign-strategy',
        name: 'Sovereign Strategy Plan',
        minTier: 'sovereign',
        sections: ['Sovereignty Index', 'Data Escape Strategy'],
        triggers: ['sovereign plan', 'escape plan'],
        dataSkills: ['cost-arbitrage', 'security-hardener'],
        assemblyAgent: 'ATHENA'
      }
    ];

    index.workflowsRaw = [
      {
        workflowId: 'incident-response',
        name: 'Incident Response',
        status: 'active',
        triggers: ['incident response workflow', 'trigger outage response'],
        skills: ['incident-commander', 'cost-arbitrage'],
        agents: ['SYSTEMS', 'CONTROL_ROOM', 'ARCHON']
      }
    ];

    // Rebuild index triggers mapping manually using mock data
    index.skillTriggers.clear();
    index.templateTriggers.clear();
    index.workflowTriggers.clear();

    // Index mock skills
    index.skillsRaw.forEach(skill => {
      if (skill.status !== 'active') return;
      index.skillTriggers.set(skill.skillId, [{ skillId: skill.skillId, weight: 100 }]);
      index.skillTriggers.set(skill.name, [{ skillId: skill.skillId, weight: 100 }]);
      skill.aliases.forEach(a => index.skillTriggers.set(a, [{ skillId: skill.skillId, weight: 100 }]));
      skill.triggers.forEach(t => index.skillTriggers.set(t, [{ skillId: skill.skillId, weight: 80 }]));
    });

    // Index mock templates
    index.templatesRaw.forEach(t => {
      index.templateTriggers.set(t.id, { templateId: t.id });
      t.triggers.forEach(tr => index.templateTriggers.set(tr, { templateId: t.id }));
    });

    // Index mock workflows
    index.workflowsRaw.forEach(w => {
      index.workflowTriggers.set(w.workflowId, { workflowId: w.workflowId });
      w.triggers.forEach(tr => index.workflowTriggers.set(tr, { workflowId: w.workflowId }));
    });

    // 2. Create a mocked SemanticMatcher
    semantic = new SemanticMatcher();
    semantic.initialized = true;
    semantic.collection = {};
    
    // Mock the search method to simulate ChromaDB response for fallback test cases
    semantic.search = vi.fn().mockImplementation(async (queryText: string) => {
      if (queryText.includes('firewall')) {
        return [{ id: 'security-hardener', type: 'skill', domain: 'security', score: 0.85 }];
      }
      return [];
    });

    // 3. Create IntentResolver
    resolver = new IntentResolver(index, semantic);
  });

  // IR-001: Exact skill name routes correctly
  it('IR-001: should route exact skill name to correct skillId', async () => {
    const res = await resolver.resolve('incident-commander');
    expect(res.skills).toContain('incident-commander');
    expect(res.leadAgents).toContain('SYSTEMS');
    expect(res.confidence).toBe(1.0);
    expect(res.fallbackLevel).toBe(0);
  });

  // IR-002: Alias routing works
  it('IR-002: should route aliases to correct skillId', async () => {
    const res = await resolver.resolve('firewall-manager');
    expect(res.skills).toContain('security-hardener');
    expect(res.leadAgents).toContain('SENTINEL');
    expect(res.confidence).toBe(1.0);
  });

  // IR-003: Report intent selects template
  it('IR-003: should resolve report trigger to appropriate report template and data skills', async () => {
    const res = await resolver.resolve('ciso board brief', { userTier: 'pro' });
    expect(res.template).toBe('ciso-board-brief');
    expect(res.skills).toContain('security-hardener');
    expect(res.leadAgents).toContain('SENTINEL');
    expect(res.category).toBe('report');
  });

  // IR-004: Compound intent decomposes
  it('IR-005: should detect workflow when multiple skills match and they are chained by workflow', async () => {
    // If the input triggers multiple skills that fit a workflow, it promotes to workflow
    index.skillTriggers.set('full incident cost review', [
      { skillId: 'incident-commander', weight: 80 },
      { skillId: 'cost-arbitrage', weight: 80 }
    ]);
    const res = await resolver.resolve('full incident cost review');
    expect(res.skills).toContain('incident-commander');
    expect(res.skills).toContain('cost-arbitrage');
    expect(res.workflow).toBe('incident-response');
    expect(res.leadAgents).toContain('SYSTEMS');
    expect(res.leadAgents).toContain('CONTROL_ROOM');
  });

  // IR-006: Fallback fires on unknown intent
  it('IR-006: should fallback to semantic search on trigger misses', async () => {
    const res = await resolver.resolve('optimize our security and firewall rules');
    expect(res.skills).toContain('security-hardener');
    expect(res.fallbackLevel).toBe(1);
    expect(res.confidence).toBe(0.85);
  });

  it('IR-006: should fallback to level 2 general routing when everything misses', async () => {
    const res = await resolver.resolve('please bake me a chocolate cake');
    expect(res.skills).toHaveLength(0);
    expect(res.fallbackLevel).toBe(2);
    expect(res.confidence).toBe(0.1);
    expect(res.leadAgents).toContain('ATHENA');
  });

  // IR-007: Inactive skills are excluded
  it('IR-007: should exclude inactive skills from matches', async () => {
    const res = await resolver.resolve('do inactive things');
    expect(res.skills).not.toContain('inactive-skill');
  });

  // IR-008: Non-callable skills are excluded
  it('IR-008: should exclude non-callable skills from matches', async () => {
    const res = await resolver.resolve('run internal agent task');
    expect(res.skills).not.toContain('non-callable-skill');
  });

  // IR-009: Domain filter narrows candidates
  it('IR-009: should filter candidates using context domain if provided', async () => {
    // Force a trigger that matches both
    index.skillTriggers.set('audit settings', [
      { skillId: 'incident-commander', weight: 80 },
      { skillId: 'security-hardener', weight: 80 }
    ]);
    const res = await resolver.resolve('audit settings', { domain: 'security' });
    expect(res.skills).toContain('security-hardener');
    expect(res.skills).not.toContain('incident-commander');
  });

  // IR-010: Template tier is respected
  it('IR-010: should deny access to templates above user tier limit', async () => {
    const res = await resolver.resolve('sovereign plan', { userTier: 'free' });
    expect(res.template).toBeUndefined(); // Lacks privilege
  });

  it('IR-010: should allow access to templates at or below user tier limit', async () => {
    const res = await resolver.resolve('sovereign plan', { userTier: 'sovereign' });
    expect(res.template).toBe('sovereign-strategy');
    expect(res.skills).toContain('cost-arbitrage');
  });
});
