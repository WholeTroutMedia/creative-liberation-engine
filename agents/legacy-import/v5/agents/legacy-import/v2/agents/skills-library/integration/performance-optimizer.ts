/**
 * Performance Optimization
 * Optimize skill execution and system performance
 */

import { Skill } from './skill-loader';
import { SkillExecutionResult } from './skill-executor';
import { SkillAnalyticsTracker } from './skill-analytics';

export interface OptimizationRecommendation {
  type: 'caching' | 'parallelization' | 'skill-selection' | 'resource-allocation';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: string;
  implementation: string;
}

export interface PerformanceMetrics {
  avgExecutionTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number; // executions per second
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class PerformanceOptimizer {
  private analytics: SkillAnalyticsTracker;
  private cache: Map<string, { result: any; timestamp: Date }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private executionTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  
  constructor(analytics: SkillAnalyticsTracker) {
    this.analytics = analytics;
  }
  
  /**
   * Check cache for previous result
   */
  checkCache(skillId: string, input: any): any | null {
    const cacheKey = this.getCacheKey(skillId, input);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.cacheTTL) {
        this.cacheHits++;
        return cached.result;
      } else {
        this.cache.delete(cacheKey);
      }
    }
    
    this.cacheMisses++;
    return null;
  }
  
  /**
   * Store result in cache
   */
  cacheResult(skillId: string, input: any, result: any): void {
    const cacheKey = this.getCacheKey(skillId, input);
    this.cache.set(cacheKey, {
      result,
      timestamp: new Date()
    });
  }
  
  /**
   * Generate cache key
   */
  private getCacheKey(skillId: string, input: any): string {
    return `${skillId}:${JSON.stringify(input)}`;
  }
  
  /**
   * Record execution time
   */
  recordExecutionTime(duration: number): void {
    this.executionTimes.push(duration);
    if (this.executionTimes.length > 1000) {
      this.executionTimes.shift();
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const sorted = [...this.executionTimes].sort((a, b) => a - b);
    const len = sorted.length;
    
    const avg = sorted.reduce((sum, t) => sum + t, 0) / len;
    const p50 = sorted[Math.floor(len * 0.5)] || 0;
    const p95 = sorted[Math.floor(len * 0.95)] || 0;
    const p99 = sorted[Math.floor(len * 0.99)] || 0;
    
    const totalHits = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalHits > 0 ? (this.cacheHits / totalHits) * 100 : 0;
    
    // Approximate throughput
    const recentWindow = sorted.slice(-100);
    const throughput = recentWindow.length > 0 
      ? 1000 / (recentWindow.reduce((sum, t) => sum + t, 0) / recentWindow.length)
      : 0;
    
    return {
      avgExecutionTime: Math.round(avg),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      throughput: Math.round(throughput * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      memoryUsage: this.cache.size,
      cpuUsage: 0 // Placeholder
    };
  }
  
  /**
   * Analyze and generate optimization recommendations
   */
  generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = this.getMetrics();
    const systemAnalytics = this.analytics.getSystemAnalytics();
    
    // Cache optimization
    if (metrics.cacheHitRate < 30) {
      recommendations.push({
        type: 'caching',
        priority: 'high',
        description: 'Low cache hit rate detected',
        expectedImpact: 'Reduce execution time by 40-60%',
        implementation: 'Increase cache TTL or implement smarter caching strategy'
      });
    }
    
    // Parallelization
    if (systemAnalytics.topSkills.length > 10) {
      const topSkills = systemAnalytics.topSkills.slice(0, 5);
      recommendations.push({
        type: 'parallelization',
        priority: 'medium',
        description: `Top 5 skills account for ${((topSkills.reduce((sum, s) => sum + s.invocations, 0) / systemAnalytics.totalInvocations) * 100).toFixed(1)}% of usage`,
        expectedImpact: 'Reduce overall latency by 30-40%',
        implementation: 'Implement parallel execution for independent skill chains'
      });
    }
    
    // Skill selection optimization
    if (metrics.avgExecutionTime > 1000) {
      recommendations.push({
        type: 'skill-selection',
        priority: 'high',
        description: 'High average execution time',
        expectedImpact: 'Reduce execution time by 20-30%',
        implementation: 'Use faster alternative skills or optimize slow skills'
      });
    }
    
    // Resource allocation
    if (metrics.throughput < 1) {
      recommendations.push({
        type: 'resource-allocation',
        priority: 'medium',
        description: 'Low throughput detected',
        expectedImpact: 'Increase throughput by 50-100%',
        implementation: 'Allocate more resources or optimize resource usage'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Identify slow skills
   */
  identifySlowSkills(): { skillId: string; avgDuration: number }[] {
    const systemAnalytics = this.analytics.getSystemAnalytics();
    const slowSkills: { skillId: string; avgDuration: number }[] = [];
    
    for (const skill of systemAnalytics.topSkills) {
      const analytics = this.analytics.getSkillAnalytics(skill.skillId, skill.skillId);
      if (analytics && analytics.avgDuration > 500) {
        slowSkills.push({
          skillId: skill.skillId,
          avgDuration: analytics.avgDuration
        });
      }
    }
    
    return slowSkills.sort((a, b) => b.avgDuration - a.avgDuration);
  }
  
  /**
   * Suggest faster alternatives
   */
  suggestAlternatives(skillId: string): string[] {
    // Placeholder: Would use semantic similarity and performance data
    // to suggest faster skills with similar capabilities
    return [];
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const recommendations = this.generateRecommendations();
    const slowSkills = this.identifySlowSkills();
    
    let report = '\n=== Performance Optimization Report ===\n\n';
    
    report += 'Current Metrics:\n';
    report += `  Avg Execution Time: ${metrics.avgExecutionTime}ms\n`;
    report += `  p50: ${metrics.p50}ms, p95: ${metrics.p95}ms, p99: ${metrics.p99}ms\n`;
    report += `  Throughput: ${metrics.throughput} exec/s\n`;
    report += `  Cache Hit Rate: ${metrics.cacheHitRate}%\n`;
    report += `  Cache Size: ${metrics.memoryUsage} entries\n\n`;
    
    if (slowSkills.length > 0) {
      report += 'Slow Skills (>500ms):\n';
      slowSkills.slice(0, 5).forEach((skill, i) => {
        report += `  ${i + 1}. ${skill.skillId}: ${skill.avgDuration}ms\n`;
      });
      report += '\n';
    }
    
    if (recommendations.length > 0) {
      report += 'Optimization Recommendations:\n';
      recommendations.forEach((rec, i) => {
        report += `  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.type}\n`;
        report += `     ${rec.description}\n`;
        report += `     Expected Impact: ${rec.expectedImpact}\n`;
        report += `     Implementation: ${rec.implementation}\n\n`;
      });
    }
    
    return report;
  }
}
