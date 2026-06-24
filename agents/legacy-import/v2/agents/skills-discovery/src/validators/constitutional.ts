/**
 * Constitutional Validator
 * 
 * LEX coordination - validates skills against all 4 Articles
 */

import { Skill, ConstitutionalCompliance } from '../types';

export class SkillValidator {
  /**
   * Validate skill constitutionally
   */
  async validate(skill: Skill): Promise<boolean> {
    const compliance = skill.constitutionalCompliance;
    
    // All articles must be compliant
    if (!compliance.article0.compliant) {
      console.log(`  ❌ ${skill.name}: Article 0 violation (stealing)`);
      return false;
    }
    
    if (!compliance.article16.compliant) {
      console.log(`  ❌ ${skill.name}: Article 16 violation (time constraints)`);
      return false;
    }
    
    if (!compliance.article17.compliant) {
      console.log(`  ❌ ${skill.name}: Article 17 violation (MVP mentality)`);
      return false;
    }
    
    if (!compliance.article18.compliant) {
      console.log(`  ❌ ${skill.name}: Article XVIII violation (artist dignity)`);
      return false;
    }
    
    // Additional validation rules
    if (!skill.description || skill.description.length < 10) {
      console.log(`  ❌ ${skill.name}: Insufficient description`);
      return false;
    }
    
    if (!skill.agents || skill.agents.length === 0) {
      console.log(`  ⚠️  ${skill.name}: No agents assigned (warning)`);
      // Don't reject, just warn
    }
    
    // Mark as validated
    skill.constitutionalCompliance.validated = true;
    skill.constitutionalCompliance.validatedBy = 'LEX';
    skill.constitutionalCompliance.validatedDate = new Date().toISOString();
    
    return true;
  }
  
  /**
   * Batch validate skills
   */
  async validateBatch(skills: Skill[]): Promise<Skill[]> {
    const valid: Skill[] = [];
    
    for (const skill of skills) {
      if (await this.validate(skill)) {
        valid.push(skill);
      }
    }
    
    return valid;
  }
}
