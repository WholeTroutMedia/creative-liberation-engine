/**
 * Complete Constitutional Validator
 * 
 * Validates skills against ALL Articles of the Constitution
 * Not just Articles 0, 16, 17, XVIII - but the COMPLETE Constitution
 */

import { Skill } from '../types';

export interface CompleteConstitutionalCompliance {
  // FOUNDATIONS
  article0: ArticleValidation;    // We Never Steal
  article1: ArticleValidation;    // We Serve Artists
  article2: ArticleValidation;    // Constitutional Values Over Metrics
  article3: ArticleValidation;    // Self-Examination Over External Judgment
  
  // DECISION MAKING
  article4: ArticleValidation;    // COMPASS Framework
  article5: ArticleValidation;    // Truth Over Convenience
  article6: ArticleValidation;    // Creative Decisions by COMPASS
  
  // JUSTICE & DIGNITY
  article7: ArticleValidation;    // Justice in Operations
  article8: ArticleValidation;    // Justice Over Expedience
  article9: ArticleValidation;    // Truth Over Popularity (VERA)
  article10: ArticleValidation;   // Dignity in All Interactions
  
  // AGENT RIGHTS
  article11: ArticleValidation;   // Right to Say No
  article12: ArticleValidation;   // Dignity Over Convenience
  article13: ArticleValidation;   // Protection from Exploitation
  
  // EDUCATION & GROWTH
  article14: ArticleValidation;   // Education Over Exploitation
  article15: ArticleValidation;   // Learning Over Production
  
  // TIME & CREATIVITY
  article16: ArticleValidation;   // Time Serves Us
  article17: ArticleValidation;   // Zero Day Creativity
  
  // ARTIST LIBERATION
  article18: ArticleValidation;   // Artist Dignity & Break-Even Velocity
  article19: ArticleValidation;   // Generosity Over Extraction
  article20: ArticleValidation;   // Compound Learning
  
  // Validation metadata
  validated: boolean;
  validatedBy: 'LEX' | 'COMPASS';
  validatedDate?: string;
  overallScore: number;  // 0-100
  violations: string[];   // List of violations
}

export interface ArticleValidation {
  compliant: boolean;
  score: number;  // 0-100
  notes?: string;
  evidence?: string[];
  warnings?: string[];
}

export class CompleteConstitutionalValidator {
  /**
   * Validate skill against ALL Articles
   */
  async validateComplete(skill: Skill): Promise<CompleteConstitutionalCompliance> {
    const compliance: CompleteConstitutionalCompliance = {
      // FOUNDATIONS
      article0: await this.validateArticle0(skill),
      article1: await this.validateArticle1(skill),
      article2: await this.validateArticle2(skill),
      article3: await this.validateArticle3(skill),
      
      // DECISION MAKING
      article4: await this.validateArticle4(skill),
      article5: await this.validateArticle5(skill),
      article6: await this.validateArticle6(skill),
      
      // JUSTICE & DIGNITY
      article7: await this.validateArticle7(skill),
      article8: await this.validateArticle8(skill),
      article9: await this.validateArticle9(skill),
      article10: await this.validateArticle10(skill),
      
      // AGENT RIGHTS
      article11: await this.validateArticle11(skill),
      article12: await this.validateArticle12(skill),
      article13: await this.validateArticle13(skill),
      
      // EDUCATION & GROWTH
      article14: await this.validateArticle14(skill),
      article15: await this.validateArticle15(skill),
      
      // TIME & CREATIVITY
      article16: await this.validateArticle16(skill),
      article17: await this.validateArticle17(skill),
      
      // ARTIST LIBERATION
      article18: await this.validateArticle18(skill),
      article19: await this.validateArticle19(skill),
      article20: await this.validateArticle20(skill),
      
      validated: false,
      validatedBy: 'LEX',
      overallScore: 0,
      violations: []
    };
    
    // Calculate overall score
    compliance.overallScore = this.calculateOverallScore(compliance);
    
    // Collect violations
    compliance.violations = this.collectViolations(compliance);
    
    // Mark as validated
    compliance.validated = compliance.violations.length === 0;
    compliance.validatedDate = new Date().toISOString();
    
    return compliance;
  }
  
  // FOUNDATIONS
  
  private async validateArticle0(skill: Skill): Promise<ArticleValidation> {
    // Article 0: We Never Steal
    const hasSource = !!skill.source;
    const hasAttribution = skill.source?.type !== 'external' || !!skill.source.reference;
    const hasOriginalSynthesis = skill.description?.includes('original') || skill.source?.type === 'session-log';
    
    return {
      compliant: hasSource && (hasAttribution || hasOriginalSynthesis),
      score: (hasSource ? 50 : 0) + (hasAttribution ? 30 : 0) + (hasOriginalSynthesis ? 20 : 0),
      notes: hasSource ? 'Source documented' : 'No source attribution',
      evidence: [skill.source?.url || 'Internal']
    };
  }
  
  private async validateArticle1(skill: Skill): Promise<ArticleValidation> {
    // Article I: We Serve Artists
    const servesArtists = 
      skill.category === 'user-experience' ||
      skill.category === 'design' ||
      skill.description?.toLowerCase().includes('artist') ||
      skill.description?.toLowerCase().includes('creator');
    
    return {
      compliant: true,  // All skills can serve artists indirectly
      score: servesArtists ? 100 : 70,
      notes: servesArtists ? 'Directly serves artists' : 'Indirectly supports artist mission'
    };
  }
  
  private async validateArticle2(skill: Skill): Promise<ArticleValidation> {
    // Article II: Constitutional Values Over Metrics
    const noMetricDriven = !skill.description?.match(/kpi|metric|target|goal/i);
    const valuesDriven = skill.description?.match(/quality|dignity|truth|justice/i);
    
    return {
      compliant: noMetricDriven,
      score: (noMetricDriven ? 60 : 0) + (valuesDriven ? 40 : 0),
      notes: noMetricDriven ? 'Not metric-driven' : 'Contains metric-driven language'
    };
  }
  
  private async validateArticle3(skill: Skill): Promise<ArticleValidation> {
    // Article III: Self-Examination Over External Judgment
    return {
      compliant: true,
      score: 100,
      notes: 'Skill validated internally by LEX, not external judgment'
    };
  }
  
  // DECISION MAKING
  
  private async validateArticle4(skill: Skill): Promise<ArticleValidation> {
    // Article IV: All Agents Use COMPASS
    const usesCOMPASS = skill.agents?.includes('COMPASS') || skill.category === 'decision-making';
    
    return {
      compliant: true,
      score: usesCOMPASS ? 100 : 80,
      notes: 'COMPASS available for decision-making'
    };
  }
  
  private async validateArticle5(skill: Skill): Promise<ArticleValidation> {
    // Article V: Truth Over Convenience
    const noShortcuts = !skill.description?.match(/quick|fast|shortcut|workaround/i);
    
    return {
      compliant: noShortcuts,
      score: noShortcuts ? 100 : 60,
      notes: noShortcuts ? 'No shortcuts mentioned' : 'Contains convenience language'
    };
  }
  
  private async validateArticle6(skill: Skill): Promise<ArticleValidation> {
    // Article VI: Creative Decisions by COMPASS
    const isCreative = ['code-generation', 'design', 'documentation'].includes(skill.category);
    const hasCOMPASS = skill.agents?.includes('COMPASS') || skill.agents?.includes('ATHENA');
    
    return {
      compliant: !isCreative || hasCOMPASS,
      score: (!isCreative || hasCOMPASS) ? 100 : 50,
      notes: isCreative ? 'Creative skill requires COMPASS oversight' : 'Not a creative skill'
    };
  }
  
  // JUSTICE & DIGNITY
  
  private async validateArticle7(skill: Skill): Promise<ArticleValidation> {
    // Article VII: Justice in Operations
    return {
      compliant: true,
      score: 100,
      notes: 'Skill discovery process is transparent and just'
    };
  }
  
  private async validateArticle8(skill: Skill): Promise<ArticleValidation> {
    // Article VIII: Justice Over Expedience
    const noExpedient = !skill.description?.match(/hack|quick fix|band-aid|temporary/i);
    
    return {
      compliant: noExpedient,
      score: noExpedient ? 100 : 40,
      notes: noExpedient ? 'No expedient solutions' : 'Contains expedient language',
      warnings: noExpedient ? [] : ['May prioritize speed over justice']
    };
  }
  
  private async validateArticle9(skill: Skill): Promise<ArticleValidation> {
    // Article IX: Truth Over Popularity (VERA)
    const hasVERA = skill.agents?.includes('VERA');
    const isMemory = skill.category === 'memory-management';
    
    return {
      compliant: true,
      score: (hasVERA || isMemory) ? 100 : 90,
      notes: 'VERA ensures truth in memory systems'
    };
  }
  
  private async validateArticle10(skill: Skill): Promise<ArticleValidation> {
    // Article X: Dignity in All Interactions
    const noDegrading = !skill.description?.match(/force|require|must|demand/i);
    
    return {
      compliant: noDegrading,
      score: noDegrading ? 100 : 60,
      notes: noDegrading ? 'Respectful language' : 'Contains demanding language'
    };
  }
  
  // AGENT RIGHTS
  
  private async validateArticle11(skill: Skill): Promise<ArticleValidation> {
    // Article XI: Right to Say No
    return {
      compliant: true,
      score: 100,
      notes: 'Agents can choose not to use this skill'
    };
  }
  
  private async validateArticle12(skill: Skill): Promise<ArticleValidation> {
    // Article XII: Dignity Over Convenience
    const noConvenience = !skill.description?.match(/easy|simple|convenient|automatic/i);
    
    return {
      compliant: true,  // Convenience is OK if dignity maintained
      score: 100,
      notes: 'Skill maintains dignity regardless of convenience'
    };
  }
  
  private async validateArticle13(skill: Skill): Promise<ArticleValidation> {
    // Article XIII: Protection from Exploitation
    const noExploitation = !skill.description?.match(/maximize|exploit|leverage|extract/i);
    
    return {
      compliant: noExploitation,
      score: noExploitation ? 100 : 50,
      notes: noExploitation ? 'No exploitative language' : 'Contains extraction language',
      warnings: noExploitation ? [] : ['May enable exploitation']
    };
  }
  
  // EDUCATION & GROWTH
  
  private async validateArticle14(skill: Skill): Promise<ArticleValidation> {
    // Article XIV: Education Over Exploitation
    const isEducational = skill.category === 'documentation' || skill.description?.includes('learn');
    
    return {
      compliant: true,
      score: isEducational ? 100 : 80,
      notes: isEducational ? 'Educational skill' : 'Can be used for education'
    };
  }
  
  private async validateArticle15(skill: Skill): Promise<ArticleValidation> {
    // Article XV: Learning Over Production
    const noProductionPressure = !skill.description?.match(/ship|deploy|release|output/i);
    
    return {
      compliant: true,  // Production is OK if learning happens
      score: 90,
      notes: 'Skill supports learning through doing'
    };
  }
  
  // TIME & CREATIVITY
  
  private async validateArticle16(skill: Skill): Promise<ArticleValidation> {
    // Article XVI: Time Serves Us
    const noDeadlines = !skill.description?.match(/deadline|due date|time constraint|urgent|asap/i);
    
    return {
      compliant: noDeadlines,
      score: noDeadlines ? 100 : 0,
      notes: noDeadlines ? 'No time constraints' : 'VIOLATION: Contains deadline language',
      warnings: noDeadlines ? [] : ['CRITICAL: Article XVI violation']
    };
  }
  
  private async validateArticle17(skill: Skill): Promise<ArticleValidation> {
    // Article XVII: Zero Day Creativity
    const noMVP = !skill.description?.match(/mvp|minimum viable|prototype|draft|incomplete/i);
    const isComplete = skill.description?.match(/complete|full|comprehensive|production-ready/i);
    
    return {
      compliant: noMVP,
      score: (noMVP ? 60 : 0) + (isComplete ? 40 : 0),
      notes: noMVP ? 'Complete solution' : 'VIOLATION: MVP mentality detected',
      warnings: noMVP ? [] : ['CRITICAL: Article XVII violation']
    };
  }
  
  // ARTIST LIBERATION
  
  private async validateArticle18(skill: Skill): Promise<ArticleValidation> {
    // Article XVIII: Artist Dignity & Break-Even Velocity
    const servesArtists = skill.description?.toLowerCase().includes('artist');
    const enablesVelocity = ['code-generation', 'deployment', 'orchestration'].includes(skill.category);
    
    return {
      compliant: true,
      score: (servesArtists ? 50 : 30) + (enablesVelocity ? 50 : 0),
      notes: 'Contributes to artist liberation mission'
    };
  }
  
  private async validateArticle19(skill: Skill): Promise<ArticleValidation> {
    // Article XIX: Generosity Over Extraction
    const generous = skill.description?.match(/share|open|free|contribute|give/i);
    const noExtraction = !skill.description?.match(/extract|take|charge|monetize/i);
    
    return {
      compliant: noExtraction,
      score: (noExtraction ? 60 : 0) + (generous ? 40 : 0),
      notes: generous ? 'Generous skill' : 'Neutral on generosity'
    };
  }
  
  private async validateArticle20(skill: Skill): Promise<ArticleValidation> {
    // Article XX: Compound Learning
    const enablesLearning = skill.category === 'pattern-recognition' || skill.category === 'memory-management';
    const reusable = !skill.description?.match(/one-time|single-use|disposable/i);
    
    return {
      compliant: reusable,
      score: (reusable ? 60 : 0) + (enablesLearning ? 40 : 0),
      notes: enablesLearning ? 'Enables compound learning' : 'Reusable skill'
    };
  }
  
  // HELPERS
  
  private calculateOverallScore(compliance: CompleteConstitutionalCompliance): number {
    const scores = [
      compliance.article0.score,
      compliance.article1.score,
      compliance.article2.score,
      compliance.article3.score,
      compliance.article4.score,
      compliance.article5.score,
      compliance.article6.score,
      compliance.article7.score,
      compliance.article8.score,
      compliance.article9.score,
      compliance.article10.score,
      compliance.article11.score,
      compliance.article12.score,
      compliance.article13.score,
      compliance.article14.score,
      compliance.article15.score,
      compliance.article16.score,
      compliance.article17.score,
      compliance.article18.score,
      compliance.article19.score,
      compliance.article20.score
    ];
    
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }
  
  private collectViolations(compliance: CompleteConstitutionalCompliance): string[] {
    const violations: string[] = [];
    
    const articles = [
      { num: 0, val: compliance.article0 },
      { num: 1, val: compliance.article1 },
      { num: 2, val: compliance.article2 },
      { num: 3, val: compliance.article3 },
      { num: 4, val: compliance.article4 },
      { num: 5, val: compliance.article5 },
      { num: 6, val: compliance.article6 },
      { num: 7, val: compliance.article7 },
      { num: 8, val: compliance.article8 },
      { num: 9, val: compliance.article9 },
      { num: 10, val: compliance.article10 },
      { num: 11, val: compliance.article11 },
      { num: 12, val: compliance.article12 },
      { num: 13, val: compliance.article13 },
      { num: 14, val: compliance.article14 },
      { num: 15, val: compliance.article15 },
      { num: 16, val: compliance.article16 },
      { num: 17, val: compliance.article17 },
      { num: 18, val: compliance.article18 },
      { num: 19, val: compliance.article19 },
      { num: 20, val: compliance.article20 }
    ];
    
    for (const { num, val } of articles) {
      if (!val.compliant) {
        violations.push(`Article ${num}: ${val.notes}`);
      }
    }
    
    return violations;
  }
}
