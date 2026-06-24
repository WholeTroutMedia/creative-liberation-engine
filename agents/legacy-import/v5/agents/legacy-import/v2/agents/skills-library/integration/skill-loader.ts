/**
 * Skills Library Integration Layer
 * Loads and manages all 250 agent skills
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Skill {
  id: string;
  name: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'expert';
  input: string;
  output: string;
  example: string;
  attribution: string;
  category?: string;
  agents?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export interface SkillCategory {
  category: string;
  description: string;
  source: string;
  agents: string[];
  priority?: string;
  skills: Skill[];
}

export class SkillsLibrary {
  private skills: Map<string, Skill> = new Map();
  private categories: Map<string, SkillCategory> = new Map();
  private agentSkills: Map<string, Set<string>> = new Map();
  
  constructor(private basePath: string = './agents/skills-library') {}
  
  /**
   * Load all skills from the library
   */
  async loadAll(): Promise<void> {
    const directories = [
      'core',
      'integrations',
      'security',
      'ai-ml',
      'workflows',
      'context',
      'productivity',
      'specialized'
    ];
    
    for (const dir of directories) {
      await this.loadDirectory(join(this.basePath, dir));
    }
    
    console.log(`✅ Loaded ${this.skills.size} skills from ${this.categories.size} categories`);
  }
  
  /**
   * Load skills from a directory
   */
  private async loadDirectory(path: string): Promise<void> {
    try {
      const files = readdirSync(path).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const content = readFileSync(join(path, file), 'utf-8');
        const category: SkillCategory = JSON.parse(content);
        
        this.categories.set(category.category, category);
        
        for (const skill of category.skills) {
          skill.category = category.category;
          skill.agents = category.agents;
          this.skills.set(skill.id, skill);
          
          // Index by agent
          for (const agent of category.agents) {
            if (!this.agentSkills.has(agent)) {
              this.agentSkills.set(agent, new Set());
            }
            this.agentSkills.get(agent)!.add(skill.id);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading directory ${path}:`, error);
    }
  }
  
  /**
   * Get a specific skill by ID
   */
  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }
  
  /**
   * Get all skills for an agent
   */
  getAgentSkills(agent: string): Skill[] {
    const skillIds = this.agentSkills.get(agent) || new Set();
    return Array.from(skillIds)
      .map(id => this.skills.get(id)!)
      .filter(Boolean);
  }
  
  /**
   * Search skills by keyword
   */
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.skills.values()).filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.id.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Get skills by category
   */
  getCategory(category: string): SkillCategory | undefined {
    return this.categories.get(category);
  }
  
  /**
   * Get all categories
   */
  getAllCategories(): SkillCategory[] {
    return Array.from(this.categories.values());
  }
  
  /**
   * Get skills by complexity
   */
  getSkillsByComplexity(complexity: 'simple' | 'moderate' | 'expert'): Skill[] {
    return Array.from(this.skills.values()).filter(
      skill => skill.complexity === complexity
    );
  }
  
  /**
   * Get high-priority skills
   */
  getCriticalSkills(): Skill[] {
    return Array.from(this.skills.values()).filter(
      skill => skill.priority === 'critical'
    );
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSkills: this.skills.size,
      totalCategories: this.categories.size,
      totalAgents: this.agentSkills.size,
      byComplexity: {
        simple: this.getSkillsByComplexity('simple').length,
        moderate: this.getSkillsByComplexity('moderate').length,
        expert: this.getSkillsByComplexity('expert').length
      },
      topAgents: Array.from(this.agentSkills.entries())
        .map(([agent, skills]) => ({ agent, count: skills.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }
}

// Singleton instance
let instance: SkillsLibrary | null = null;

export function getSkillsLibrary(basePath?: string): SkillsLibrary {
  if (!instance) {
    instance = new SkillsLibrary(basePath);
  }
  return instance;
}
