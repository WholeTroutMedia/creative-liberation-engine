/**
 * Skill Testing Framework
 * Test and validate skills before production use
 */

import { Skill } from './skill-loader';
import { SkillExecutor, SkillExecutionContext, SkillExecutionResult } from './skill-executor';

export interface TestCase {
  name: string;
  input: any;
  expectedOutput?: any;
  shouldSucceed: boolean;
  timeout?: number;
}

export interface TestResult {
  testCase: string;
  passed: boolean;
  duration: number;
  output?: any;
  error?: string;
  constitutional: boolean;
}

export interface SkillTestReport {
  skillId: string;
  skillName: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  avgDuration: number;
  successRate: number;
  testResults: TestResult[];
  recommendation: 'production-ready' | 'needs-work' | 'failing';
}

export interface SkillComparison {
  testInput: any;
  skills: {
    skillId: string;
    duration: number;
    success: boolean;
    output: any;
    quality?: number;
  }[];
  winner?: string;
  recommendation: string;
}

export class SkillTester {
  private executor: SkillExecutor;
  private testHistory: Map<string, SkillTestReport[]> = new Map();
  
  constructor() {
    this.executor = new SkillExecutor();
  }
  
  /**
   * Test a single skill with multiple test cases
   */
  async testSkill(
    skill: Skill,
    testCases: TestCase[],
    agent: string = 'IRIS'
  ): Promise<SkillTestReport> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const testStart = Date.now();
      
      try {
        const context: SkillExecutionContext = {
          skill,
          agent,
          input: testCase.input,
          timestamp: new Date(),
          constitutionalCheck: true
        };
        
        const result = await this.executor.execute(context);
        
        const passed = testCase.shouldSucceed 
          ? result.success 
          : !result.success;
        
        results.push({
          testCase: testCase.name,
          passed,
          duration: Date.now() - testStart,
          output: result.output,
          error: result.error,
          constitutional: result.constitutional
        });
      } catch (error) {
        results.push({
          testCase: testCase.name,
          passed: false,
          duration: Date.now() - testStart,
          error: error instanceof Error ? error.message : String(error),
          constitutional: false
        });
      }
    }
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = (passed / results.length) * 100;
    
    let recommendation: 'production-ready' | 'needs-work' | 'failing';
    if (successRate >= 90) {
      recommendation = 'production-ready';
    } else if (successRate >= 70) {
      recommendation = 'needs-work';
    } else {
      recommendation = 'failing';
    }
    
    const report: SkillTestReport = {
      skillId: skill.id,
      skillName: skill.name,
      timestamp: new Date(),
      totalTests: results.length,
      passed,
      failed,
      avgDuration,
      successRate,
      testResults: results,
      recommendation
    };
    
    // Store in history
    if (!this.testHistory.has(skill.id)) {
      this.testHistory.set(skill.id, []);
    }
    this.testHistory.get(skill.id)!.push(report);
    
    return report;
  }
  
  /**
   * Compare multiple skills on the same input
   */
  async compareSkills(
    skills: Skill[],
    testInput: any,
    agent: string = 'IRIS'
  ): Promise<SkillComparison> {
    const results = [];
    
    for (const skill of skills) {
      const startTime = Date.now();
      
      try {
        const context: SkillExecutionContext = {
          skill,
          agent,
          input: testInput,
          timestamp: new Date(),
          constitutionalCheck: true
        };
        
        const result = await this.executor.execute(context);
        
        results.push({
          skillId: skill.id,
          duration: Date.now() - startTime,
          success: result.success,
          output: result.output,
          quality: this.assessQuality(result.output)
        });
      } catch (error) {
        results.push({
          skillId: skill.id,
          duration: 0,
          success: false,
          output: null,
          quality: 0
        });
      }
    }
    
    // Find winner (best quality/speed ratio)
    const successful = results.filter(r => r.success);
    let winner: string | undefined;
    
    if (successful.length > 0) {
      const sorted = successful.sort((a, b) => {
        const aScore = (a.quality || 0) / a.duration;
        const bScore = (b.quality || 0) / b.duration;
        return bScore - aScore;
      });
      winner = sorted[0].skillId;
    }
    
    return {
      testInput,
      skills: results,
      winner,
      recommendation: winner 
        ? `Use ${winner} for best results`
        : 'No skill succeeded on this input'
    };
  }
  
  /**
   * Assess output quality (placeholder - override for specific metrics)
   */
  private assessQuality(output: any): number {
    // Simple heuristic: more detailed output = higher quality
    if (!output) return 0;
    
    const outputStr = JSON.stringify(output);
    return Math.min(100, outputStr.length / 10);
  }
  
  /**
   * Get test history for a skill
   */
  getTestHistory(skillId: string): SkillTestReport[] {
    return this.testHistory.get(skillId) || [];
  }
  
  /**
   * Generate test summary
   */
  generateSummary(): string {
    let summary = '\n=== Skill Testing Summary ===\n\n';
    
    for (const [skillId, reports] of this.testHistory) {
      const latest = reports[reports.length - 1];
      summary += `${latest.skillName} (${skillId}):\n`;
      summary += `  Success Rate: ${latest.successRate.toFixed(1)}%\n`;
      summary += `  Avg Duration: ${latest.avgDuration.toFixed(0)}ms\n`;
      summary += `  Status: ${latest.recommendation}\n\n`;
    }
    
    return summary;
  }
}
