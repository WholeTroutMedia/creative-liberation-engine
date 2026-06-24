/**
 * Skill Collections
 * Grouped skills for common use cases
 */

import { Skill } from './skill-loader';

export interface SkillCollection {
  id: string;
  name: string;
  description: string;
  useCase: string;
  skillIds: string[];
  sequence?: 'sequential' | 'parallel' | 'any';
  agents?: string[];
  triggerPhrases?: string[];
}

export const SKILL_COLLECTIONS: SkillCollection[] = [
  {
    id: 'collection-security-complete',
    name: 'Complete Security Audit',
    description: 'Full security analysis and hardening',
    useCase: 'Comprehensive security review of codebase',
    skillIds: [
      'tob-static-analysis',
      'tob-differential-review',
      'tob-sharp-edges',
      'tob-insecure-defaults',
      'tob-fix-review',
      'varlock-env-security',
      'ffuf-web-fuzzing'
    ],
    sequence: 'sequential',
    agents: ['ARCH', 'LEX'],
    triggerPhrases: ['security audit', 'security review', 'full security scan']
  },
  {
    id: 'collection-frontend-complete',
    name: 'Frontend Development Suite',
    description: 'Complete frontend development capabilities',
    useCase: 'Build and deploy frontend applications',
    skillIds: [
      'react-native-best-practices',
      'swiftui-expert',
      'threejs-skills',
      'nextjs-cache-optimizer',
      'design-comprehensive',
      'vercel-deploy'
    ],
    sequence: 'any',
    agents: ['AURORA', 'IRIS'],
    triggerPhrases: ['frontend', 'ui development', 'build interface']
  },
  {
    id: 'collection-ai-ml-pipeline',
    name: 'AI/ML Pipeline',
    description: 'Train, evaluate, and deploy ML models',
    useCase: 'Complete ML workflow from training to deployment',
    skillIds: [
      'hf-train-model',
      'hf-evaluate-model',
      'hf-push-model',
      'hf-create-dataset',
      'fal-flux-pro',
      'research-synthesis'
    ],
    sequence: 'sequential',
    agents: ['ARCH', 'IRIS'],
    triggerPhrases: ['ml pipeline', 'train model', 'ai workflow']
  },
  {
    id: 'collection-content-creation',
    name: 'Content Creation Pipeline',
    description: 'Research, write, and publish content',
    useCase: 'Complete content creation from research to publication',
    skillIds: [
      'research-synthesis',
      'documentation-technical',
      'prose-beautiful',
      'readme-comprehensive',
      'marketing-skills-suite',
      'x-article-publisher'
    ],
    sequence: 'sequential',
    agents: ['SCRIBE', 'AURORA'],
    triggerPhrases: ['create content', 'write article', 'publish content']
  },
  {
    id: 'collection-deployment',
    name: 'Production Deployment',
    description: 'Deploy to multiple platforms',
    useCase: 'Deploy applications to production',
    skillIds: [
      'vercel-deploy',
      'cloudflare-deploy',
      'aws-deploy',
      'deployment-continuous',
      'testing-comprehensive'
    ],
    sequence: 'parallel',
    agents: ['COMET', 'LEX'],
    triggerPhrases: ['deploy', 'ship to production', 'release']
  },
  {
    id: 'collection-debugging',
    name: 'Debugging & Root Cause',
    description: 'Systematic bug investigation',
    useCase: 'Find and fix bugs systematically',
    skillIds: [
      'systematic-debugging',
      'root-cause-tracing',
      'sentry-bug-finding',
      'code-analysis-static',
      'testing-comprehensive'
    ],
    sequence: 'sequential',
    agents: ['ARCH', 'IRIS', 'RAM_CREW'],
    triggerPhrases: ['debug', 'find bug', 'investigate issue', 'root cause']
  },
  {
    id: 'collection-integration',
    name: 'API Integration Suite',
    description: 'Integrate external services',
    useCase: 'Connect to third-party APIs safely',
    skillIds: [
      'stripe-best-practices',
      'notion-skills',
      'linear-claude-skill',
      'whatsapp-integrate',
      'varlock-env-security',
      'testing-comprehensive'
    ],
    sequence: 'any',
    agents: ['COMET', 'IRIS', 'LEX'],
    triggerPhrases: ['integrate', 'connect api', 'add integration']
  },
  {
    id: 'collection-documentation',
    name: 'Complete Documentation',
    description: 'Comprehensive project documentation',
    useCase: 'Document projects thoroughly',
    skillIds: [
      'documentation-technical',
      'readme-comprehensive',
      'google-labs-design-md',
      'sentry-agents-md',
      'code-analysis-static'
    ],
    sequence: 'any',
    agents: ['SCRIBE'],
    triggerPhrases: ['document', 'write docs', 'documentation']
  }
];

export class SkillCollectionsManager {
  getCollection(id: string): SkillCollection | undefined {
    return SKILL_COLLECTIONS.find(c => c.id === id);
  }
  
  searchCollections(query: string): SkillCollection[] {
    const lowerQuery = query.toLowerCase();
    return SKILL_COLLECTIONS.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery) ||
      c.useCase.toLowerCase().includes(lowerQuery)
    );
  }
  
  getAllCollections(): SkillCollection[] {
    return SKILL_COLLECTIONS;
  }
}
