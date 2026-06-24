/**
 * Skill Synthesizer
 * 
 * KEEPER coordination - organizes, classifies, deduplicates skills
 */

import { Skill } from '../types';

export class SkillSynthesizer {
  /**
   * Synthesize skills - deduplicate and organize
   */
  async synthesize(skills: Skill[]): Promise<Skill[]> {
    // Remove duplicates
    const unique = this.deduplicate(skills);
    
    // Classify by category
    const classified = this.classify(unique);
    
    // Merge similar skills
    const merged = this.mergeSimilar(classified);
    
    return merged;
  }
  
  /**
   * Remove duplicate skills
   */
  private deduplicate(skills: Skill[]): Skill[] {
    const seen = new Map<string, Skill>();
    
    for (const skill of skills) {
      // Generate hash from name + description
      const hash = this.generateHash(skill);
      
      if (!seen.has(hash)) {
        seen.set(hash, skill);
      } else {
        // Merge metadata from duplicate
        const existing = seen.get(hash)!;
        if (skill.usageCount) {
          existing.usageCount = (existing.usageCount || 0) + skill.usageCount;
        }
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Classify skills by category
   */
  private classify(skills: Skill[]): Skill[] {
    // Already classified in extraction, but validate
    return skills.map(skill => {
      if (!skill.category) {
        skill.category = this.inferCategory(skill);
      }
      return skill;
    });
  }
  
  /**
   * Merge similar skills
   */
  private mergeSimilar(skills: Skill[]): Skill[] {
    // Group by similarity (simple approach: same category + name prefix)
    const groups = new Map<string, Skill[]>();
    
    for (const skill of skills) {
      const key = `${skill.category}-${skill.name.split(' ')[0]}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(skill);
    }
    
    // Merge groups with >1 skill
    const merged: Skill[] = [];
    
    for (const [, group] of groups) {
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        // Merge into single skill
        const primary = group[0];
        primary.description = `${primary.description} (merged from ${group.length} sources)`;
        primary.agents = [...new Set(group.flatMap(s => s.agents))];
        merged.push(primary);
      }
    }
    
    return merged;
  }
  
  /**
   * Generate hash for skill
   */
  private generateHash(skill: Skill): string {
    const normalized = `${skill.name.toLowerCase()}-${skill.description.toLowerCase()}`
      .replace(/[^a-z0-9-]/g, '');
    return normalized;
  }
  
  /**
   * Infer category from skill content
   */
  private inferCategory(skill: Skill): any {
    const text = `${skill.name} ${skill.description}`.toLowerCase();
    
    const categoryKeywords: { [key: string]: string[] } = {
      'code-generation': ['generate', 'create', 'scaffold', 'template'],
      'code-analysis': ['analyze', 'scan', 'inspect', 'review'],
      'testing': ['test', 'verify', 'validate', 'check'],
      'deployment': ['deploy', 'release', 'publish', 'ship'],
      'documentation': ['document', 'readme', 'docs', 'guide'],
      'orchestration': ['coordinate', 'orchestrate', 'cascade', 'workflow']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return category;
      }
    }
    
    return 'project-management';
  }
}
