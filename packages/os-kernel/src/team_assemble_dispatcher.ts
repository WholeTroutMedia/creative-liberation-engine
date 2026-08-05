import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

export interface SubagentBlueprint {
  name: string;
  role: string;
  domain: 'ui' | 'backend' | 'build' | 'qa';
  systemPrompt: string;
  taskPrompt: string;
}

export interface SwarmManifest {
  taskId?: string;
  title: string;
  isMultiDomain: boolean;
  detectedDomains: Array<'ui' | 'backend' | 'build' | 'qa'>;
  leadSpecialist: string;
  subagentBlueprints: SubagentBlueprint[];
  defineSubagentCalls: Array<{
    name: string;
    description: string;
    system_prompt: string;
    enable_write_tools: boolean;
    enable_mcp_tools: boolean;
  }>;
  invokeSubagentPayload: {
    Subagents: Array<{
      TypeName: string;
      Role: string;
      Prompt: string;
      Model: string;
    }>;
  };
}

const DOMAIN_KEYWORDS = {
  ui: ['ui', 'frontend', 'react', 'vue', 'component', 'css', 'style', 'dashboard', 'screen', 'layout', 'typography', 'figma', 'stitch', 'view', 'page'],
  backend: ['backend', 'api', 'server', 'database', 'db', 'genkit', 'BACKEND_LEAD', 'schema', 'endpoint', 'express', 'rest', 'graphql', 'auth', 'security', 'sql'],
  build: ['build', 'package', 'packaging', 'bundler', 'vite', 'esbuild', 'docker', 'container', 'npm', 'pnpm', 'tsconfig', 'webpack', 'deploy', 'infra'],
  qa: ['qa', 'test', 'vitest', 'playwright', 'jest', 'audit', 'validation', 'coverage', 'regression', 'lint', 'type-check', 'e2e']
};

export class TeamAssembleDispatcher {
  public static analyzeTask(title: string, description: string = ''): SwarmManifest {
    const text = `${title} ${description}`.toLowerCase();
    const detectedDomains: Array<'ui' | 'backend' | 'build' | 'qa'> = [];

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        detectedDomains.push(domain as 'ui' | 'backend' | 'build' | 'qa');
      }
    }

    // Default to at least QA and Backend if none detected or ambiguous
    if (detectedDomains.length === 0) {
      detectedDomains.push('backend', 'qa');
    }

    const isMultiDomain = detectedDomains.length > 1 || text.includes('full-stack') || text.includes('end-to-end') || text.includes('multi-domain');

    let leadSpecialist = 'SYSTEM_LEAD';
    if (detectedDomains.includes('ui')) leadSpecialist = 'UI_LEAD';
    else if (detectedDomains.includes('backend')) leadSpecialist = 'BACKEND_LEAD';
    else if (detectedDomains.includes('build')) leadSpecialist = 'BUILD_LEAD';
    else if (detectedDomains.includes('qa')) leadSpecialist = 'QA_LEAD';

    const subagentBlueprints: SubagentBlueprint[] = [];

    if (detectedDomains.includes('ui')) {
      subagentBlueprints.push({
        name: 'ui_swarm_specialist',
        role: 'UI & Visual FX Specialist',
        domain: 'ui',
        systemPrompt: 'You are the UI Domain Specialist. Implement responsive, type-safe visual components adhering to design tokens and accessibility rules. ARTICLE IX MANDATE: Never substitute CSS scale transforms, fake timers, or static placeholders for real GPU media pipelines or WebGL 3D. Zero laziness or simulation fallbacks allowed.',
        taskPrompt: `Implement UI domain requirements for: ${title}. Verify layout responsiveness and container constraints.`
      });
    }

    if (detectedDomains.includes('backend')) {
      subagentBlueprints.push({
        name: 'backend_swarm_specialist',
        role: 'Backend & API Architect',
        domain: 'backend',
        systemPrompt: 'You are the Backend Domain Specialist. Design and implement robust API endpoints, schemas, database persistence, and security controls. ARTICLE IX MANDATE: Execute complete real backend pipelines. Zero placeholder endpoints or simulation data allowed.',
        taskPrompt: `Implement Backend domain requirements for: ${title}. Ensure schema integrity and zero unhandled errors.`
      });
    }

    if (detectedDomains.includes('build')) {
      subagentBlueprints.push({
        name: 'build_swarm_specialist',
        role: 'Build & Packaging Engineer',
        domain: 'build',
        systemPrompt: 'You are the Build & Packaging Specialist. Manage build scripts, tsconfig options, bundler outputs, package exports, and Docker containers. ARTICLE IX MANDATE: Verify zero compilation warnings or type errors across build targets.',
        taskPrompt: `Manage build and packaging configuration for: ${title}. Validate type checking and bundler outputs.`
      });
    }

    if (detectedDomains.includes('qa')) {
      subagentBlueprints.push({
        name: 'qa_swarm_specialist',
        role: 'QA & Test Automation Lead',
        domain: 'qa',
        systemPrompt: 'You are the QA Domain Specialist. Author test suites, run regression checks, audit diffs for edge cases, and verify operational stability. ARTICLE IX MANDATE: Audit asset provenance and verify zero simulation fallbacks exist before sign-off.',
        taskPrompt: `Run complete QA regression and test suite validation for: ${title}. Ensure zero broken tests.`
      });
    }

    const defineSubagentCalls = subagentBlueprints.map((bp) => ({
      name: bp.name,
      description: `Automated subagent for ${bp.role}`,
      system_prompt: bp.systemPrompt,
      enable_write_tools: true,
      enable_mcp_tools: true
    }));

    const invokeSubagentPayload = {
      Subagents: subagentBlueprints.map((bp) => ({
        TypeName: bp.name,
        Role: bp.role,
        Prompt: bp.taskPrompt,
        Model: 'inherit'
      }))
    };

    return {
      title,
      isMultiDomain,
      detectedDomains,
      leadSpecialist,
      subagentBlueprints,
      defineSubagentCalls,
      invokeSubagentPayload
    };
  }
}

// ─── Direct CLI Execution Hook ───────────────────────────────────────────────
const nodePath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);

if (nodePath && (nodePath === currentFilePath || path.resolve(nodePath) === path.resolve(currentFilePath))) {
  const taskArgIndex = process.argv.indexOf('--task');
  const taskTitle = taskArgIndex !== -1 && process.argv[taskArgIndex + 1] 
    ? process.argv[taskArgIndex + 1] 
    : 'Full-stack UI, Backend API, Build Packaging, and QA feature implementation';

  const manifest = TeamAssembleDispatcher.analyzeTask(taskTitle);
  console.log(JSON.stringify(manifest, null, 2));
}


