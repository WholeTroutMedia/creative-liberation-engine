/**
 * Skills Discovery System - Type Definitions
 * 
 * Constitutional Compliance:
 * - Article XVIII: Compound learning through skill discovery
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  agents: string[];  // Which agents can use this
  
  // Capability details
  capability: {
    input: string;   // What it takes
    output: string;  // What it produces
    process: string; // How it works
  };
  
  // Usage metadata
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  usageCount?: number;
  successRate?: number;
  
  // Discovery metadata
  source: SkillSource;
  discoveredDate: string;
  discoveredBy: 'auto' | 'manual' | 'session-analysis';
  
  // Examples
  examples?: SkillExample[];
  
  // Constitutional compliance
  constitutionalCompliance: ConstitutionalCompliance;
  
  // Relationships
  prerequisites?: string[];  // Skill IDs required first
  relatedSkills?: string[];  // Similar/complementary skills
  
  // Status
  status: 'discovered' | 'validated' | 'approved' | 'active' | 'deprecated';
  approvedBy?: string;
  approvedDate?: string;
}

export type SkillCategory = 
  | 'code-generation'
  | 'code-analysis'
  | 'project-management'
  | 'documentation'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'communication'
  | 'design'
  | 'data-processing'
  | 'integration'
  | 'orchestration'
  | 'constitutional-enforcement'
  | 'memory-management'
  | 'pattern-recognition'
  | 'decision-making'
  | 'quality-assurance'
  | 'security'
  | 'performance'
  | 'user-experience';

export interface SkillSource {
  type: 'github' | 'npm' | 'documentation' | 'session-log' | 'commit' | 'external' | 'manual';
  url?: string;
  repository?: string;
  package?: string;
  reference?: string;
}

export interface SkillExample {
  scenario: string;
  input: string;
  output: string;
  agent: string;
}

export interface ConstitutionalCompliance {
  article0: { compliant: boolean; notes?: string };
  article16: { compliant: boolean; notes?: string };
  article17: { compliant: boolean; notes?: string };
  article18: { compliant: boolean; notes?: string };
  validated: boolean;
  validatedBy?: 'LEX' | 'COMPASS';
  validatedDate?: string;
}

export interface DiscoveryReport {
  id: string;
  date: string;
  period: { start: string; end: string };
  
  // Discovery results
  skillsDiscovered: Skill[];
  skillsUpdated: string[];  // Skill IDs
  skillsDeprecated: string[];  // Skill IDs
  
  // Statistics
  statistics: {
    totalScanned: number;
    newSkills: number;
    existingSkills: number;
    duplicatesRemoved: number;
    constitutionalViolations: number;
  };
  
  // Recommendations
  recommendations: {
    highPriority: string[];  // Skill IDs
    mediumPriority: string[];  // Skill IDs
    lowPriority: string[];  // Skill IDs
    deferredReview: string[];  // Skill IDs
  };
  
  // Agent coordination
  agentsInvolved: string[];
  
  // Next steps
  nextDiscovery: string;
}

export interface MonitoringSource {
  name: string;
  type: 'github' | 'npm' | 'web' | 'internal';
  enabled: boolean;
  lastScanned?: string;
  query?: string;
  url?: string;
}

export interface SkillsLibrary {
  version: string;
  lastUpdated: string;
  totalSkills: number;
  
  skills: {
    [category: string]: Skill[];
  };
  
  agents: {
    [agentName: string]: {
      skills: string[];  // Skill IDs
      capabilities: string[];
    };
  };
  
  metadata: {
    sources: MonitoringSource[];
    discoveryHistory: string[];  // Report IDs
  };
}
