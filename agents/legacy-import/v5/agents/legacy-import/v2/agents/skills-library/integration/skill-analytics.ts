/**
 * Skill Analytics
 * Track skill usage and effectiveness
 */

import { SkillExecutionResult } from './skill-executor';

export interface SkillAnalytics {
  skillId: string;
  skillName: string;
  invocations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  totalDuration: number;
  lastUsed: Date;
  firstUsed: Date;
  topAgents: { agent: string; count: number }[];
  commonChains: { skills: string[]; count: number }[];
  errors: { error: string; count: number }[];
}

export interface SystemAnalytics {
  totalInvocations: number;
  uniqueSkills: number;
  avgSuccessRate: number;
  avgDuration: number;
  topSkills: { skillId: string; invocations: number }[];
  topAgents: { agent: string; invocations: number }[];
  recentActivity: SkillExecutionResult[];
}

export class SkillAnalyticsTracker {
  private skillStats: Map<string, {
    invocations: number;
    successCount: number;
    durations: number[];
    agents: Map<string, number>;
    errors: Map<string, number>;
    lastUsed: Date;
    firstUsed: Date;
  }> = new Map();
  
  private executionHistory: SkillExecutionResult[] = [];
  private maxHistorySize = 1000;
  
  /**
   * Record a skill execution
   */
  recordExecution(result: SkillExecutionResult): void {
    const skillId = result.metadata.skill;
    const agent = result.metadata.agent;
    
    // Initialize stats if needed
    if (!this.skillStats.has(skillId)) {
      this.skillStats.set(skillId, {
        invocations: 0,
        successCount: 0,
        durations: [],
        agents: new Map(),
        errors: new Map(),
        lastUsed: result.metadata.timestamp,
        firstUsed: result.metadata.timestamp
      });
    }
    
    const stats = this.skillStats.get(skillId)!;
    
    // Update stats
    stats.invocations++;
    if (result.success) stats.successCount++;
    stats.durations.push(result.duration);
    stats.lastUsed = result.metadata.timestamp;
    
    // Track agents
    stats.agents.set(agent, (stats.agents.get(agent) || 0) + 1);
    
    // Track errors
    if (result.error) {
      stats.errors.set(result.error, (stats.errors.get(result.error) || 0) + 1);
    }
    
    // Add to history
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }
  
  /**
   * Get analytics for a specific skill
   */
  getSkillAnalytics(skillId: string, skillName: string): SkillAnalytics | null {
    const stats = this.skillStats.get(skillId);
    if (!stats) return null;
    
    const avgDuration = stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length;
    const totalDuration = stats.durations.reduce((sum, d) => sum + d, 0);
    const successRate = (stats.successCount / stats.invocations) * 100;
    
    // Top agents
    const topAgents = Array.from(stats.agents.entries())
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Common errors
    const errors = Array.from(stats.errors.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      skillId,
      skillName,
      invocations: stats.invocations,
      successCount: stats.successCount,
      failureCount: stats.invocations - stats.successCount,
      successRate,
      avgDuration: Math.round(avgDuration),
      totalDuration,
      lastUsed: stats.lastUsed,
      firstUsed: stats.firstUsed,
      topAgents,
      commonChains: [], // TODO: Implement chain detection
      errors
    };
  }
  
  /**
   * Get system-wide analytics
   */
  getSystemAnalytics(): SystemAnalytics {
    const totalInvocations = this.executionHistory.length;
    const uniqueSkills = this.skillStats.size;
    
    // Calculate avg success rate
    let totalSuccessRate = 0;
    let totalDuration = 0;
    
    for (const stats of this.skillStats.values()) {
      totalSuccessRate += (stats.successCount / stats.invocations) * 100;
      totalDuration += stats.durations.reduce((sum, d) => sum + d, 0);
    }
    
    const avgSuccessRate = uniqueSkills > 0 ? totalSuccessRate / uniqueSkills : 0;
    const avgDuration = totalInvocations > 0 ? totalDuration / totalInvocations : 0;
    
    // Top skills
    const topSkills = Array.from(this.skillStats.entries())
      .map(([skillId, stats]) => ({ skillId, invocations: stats.invocations }))
      .sort((a, b) => b.invocations - a.invocations)
      .slice(0, 10);
    
    // Top agents
    const agentCounts = new Map<string, number>();
    for (const result of this.executionHistory) {
      const agent = result.metadata.agent;
      agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
    }
    
    const topAgents = Array.from(agentCounts.entries())
      .map(([agent, invocations]) => ({ agent, invocations }))
      .sort((a, b) => b.invocations - a.invocations)
      .slice(0, 10);
    
    return {
      totalInvocations,
      uniqueSkills,
      avgSuccessRate,
      avgDuration: Math.round(avgDuration),
      topSkills,
      topAgents,
      recentActivity: this.executionHistory.slice(-20)
    };
  }
  
  /**
   * Generate analytics report
   */
  generateReport(): string {
    const system = this.getSystemAnalytics();
    
    let report = '\n=== Skill Analytics Report ===\n\n';
    report += `Total Invocations: ${system.totalInvocations}\n`;
    report += `Unique Skills Used: ${system.uniqueSkills}\n`;
    report += `Average Success Rate: ${system.avgSuccessRate.toFixed(1)}%\n`;
    report += `Average Duration: ${system.avgDuration}ms\n\n`;
    
    report += 'Top Skills:\n';
    system.topSkills.forEach((skill, i) => {
      report += `  ${i + 1}. ${skill.skillId}: ${skill.invocations} invocations\n`;
    });
    
    report += '\nTop Agents:\n';
    system.topAgents.forEach((agent, i) => {
      report += `  ${i + 1}. ${agent.agent}: ${agent.invocations} invocations\n`;
    });
    
    return report;
  }
  
  /**
   * Clear all analytics
   */
  clear(): void {
    this.skillStats.clear();
    this.executionHistory = [];
  }
}
