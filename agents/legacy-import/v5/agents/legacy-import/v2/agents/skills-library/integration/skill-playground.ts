/**
 * Skill Playground UI
 * Interactive testing and experimentation environment
 */

import { Skill, SkillsLibrary } from './skill-loader';
import { SkillExecutor, SkillExecutionContext } from './skill-executor';
import { SkillTester, TestCase } from './skill-tester';
import { SkillCollectionsManager } from './skill-collections';
import { SkillAnalyticsTracker } from './skill-analytics';

export interface PlaygroundSession {
  id: string;
  startTime: Date;
  skills: string[];
  executions: any[];
  notes: string;
}

export interface PlaygroundExperiment {
  name: string;
  description: string;
  skills: string[];
  testCases: TestCase[];
  results?: any[];
}

export class SkillPlayground {
  private library: SkillsLibrary;
  private executor: SkillExecutor;
  private tester: SkillTester;
  private collections: SkillCollectionsManager;
  private analytics: SkillAnalyticsTracker;
  private sessions: Map<string, PlaygroundSession> = new Map();
  
  constructor(
    library: SkillsLibrary,
    executor: SkillExecutor,
    analytics: SkillAnalyticsTracker
  ) {
    this.library = library;
    this.executor = executor;
    this.tester = new SkillTester();
    this.collections = new SkillCollectionsManager();
    this.analytics = analytics;
  }
  
  /**
   * Start a new playground session
   */
  startSession(name: string): PlaygroundSession {
    const session: PlaygroundSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      skills: [],
      executions: [],
      notes: name
    };
    
    this.sessions.set(session.id, session);
    return session;
  }
  
  /**
   * Execute a skill interactively
   */
  async executeInteractive(
    sessionId: string,
    skillId: string,
    input: any,
    agent: string = 'IRIS'
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    const skill = this.library.getSkill(skillId);
    if (!skill) throw new Error('Skill not found');
    
    const context: SkillExecutionContext = {
      skill,
      agent,
      input,
      timestamp: new Date(),
      constitutionalCheck: true
    };
    
    const result = await this.executor.execute(context);
    
    // Track in session
    session.skills.push(skillId);
    session.executions.push({
      skill: skillId,
      input,
      result,
      timestamp: new Date()
    });
    
    // Track in analytics
    this.analytics.recordExecution(result);
    
    return result;
  }
  
  /**
   * Compare multiple skills side-by-side
   */
  async compareSkills(
    sessionId: string,
    skillIds: string[],
    testInput: any
  ): Promise<any> {
    const skills = skillIds.map(id => this.library.getSkill(id)).filter(Boolean) as Skill[];
    
    const comparison = await this.tester.compareSkills(skills, testInput);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.executions.push({
        type: 'comparison',
        skills: skillIds,
        comparison,
        timestamp: new Date()
      });
    }
    
    return comparison;
  }
  
  /**
   * Run an experiment with multiple test cases
   */
  async runExperiment(
    sessionId: string,
    experiment: PlaygroundExperiment
  ): Promise<any> {
    const results = [];
    
    for (const skillId of experiment.skills) {
      const skill = this.library.getSkill(skillId);
      if (!skill) continue;
      
      const testReport = await this.tester.testSkill(
        skill,
        experiment.testCases
      );
      
      results.push({
        skillId,
        skillName: skill.name,
        report: testReport
      });
    }
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.executions.push({
        type: 'experiment',
        experiment: experiment.name,
        results,
        timestamp: new Date()
      });
    }
    
    return results;
  }
  
  /**
   * Search skills interactively
   */
  searchSkills(query: string): Skill[] {
    return this.library.searchSkills(query);
  }
  
  /**
   * Get skills by category
   */
  getSkillsByCategory(category: string): Skill[] {
    return this.library.getByCategory(category);
  }
  
  /**
   * Get skills by complexity
   */
  getSkillsByComplexity(complexity: string): Skill[] {
    return this.library.getByComplexity(complexity as any);
  }
  
  /**
   * Get all collections
   */
  getCollections() {
    return this.collections.getAllCollections();
  }
  
  /**
   * Get all workflows
   */
  getWorkflows() {
    return this.library.getAllWorkflows();
  }
  
  /**
   * Get analytics for playground
   */
  getPlaygroundAnalytics() {
    return {
      system: this.analytics.getSystemAnalytics(),
      sessions: Array.from(this.sessions.values()),
      totalSessions: this.sessions.size
    };
  }
  
  /**
   * Export session for sharing
   */
  exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    return JSON.stringify(session, null, 2);
  }
  
  /**
   * Generate playground report
   */
  generateReport(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    let report = '\n=== Skill Playground Session Report ===\n\n';
    report += `Session: ${session.notes}\n`;
    report += `Started: ${session.startTime.toISOString()}\n`;
    report += `Skills Used: ${new Set(session.skills).size}\n`;
    report += `Total Executions: ${session.executions.length}\n\n`;
    
    report += 'Execution History:\n';
    session.executions.forEach((exec, i) => {
      if (exec.type === 'comparison') {
        report += `  ${i + 1}. Comparison: ${exec.skills.join(', ')}\n`;
        report += `     Winner: ${exec.comparison.winner || 'None'}\n`;
      } else if (exec.type === 'experiment') {
        report += `  ${i + 1}. Experiment: ${exec.experiment}\n`;
        report += `     Skills: ${exec.results.length}\n`;
      } else {
        report += `  ${i + 1}. ${exec.skill} - ${exec.result.success ? 'Success' : 'Failed'}\n`;
      }
    });
    
    return report;
  }
}
