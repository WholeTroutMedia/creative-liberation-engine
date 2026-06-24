/**
 * Session Log Monitor
 * 
 * Analyzes SESSION_LOGS/ for patterns that indicate new skills
 * Coordinates with ARCH for pattern extraction
 */

import { Skill } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';

export class SessionLogMonitor {
  private logsPath: string;

  constructor() {
    this.logsPath = path.join(process.cwd(), 'SESSION_LOGS');
  }

  async scan(): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    try {
      // Get recent session logs (last 7 days)
      const files = await this.getRecentLogs(7);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const parsed = matter(content);
        
        // Extract skills from session content
        const extractedSkills = this.extractSkillsFromSession(parsed);
        skills.push(...extractedSkills);
      }
    } catch (error) {
      console.error('Session log scanning failed:', error);
    }
    
    return skills;
  }

  private async getRecentLogs(days: number): Promise<string[]> {
    const files: string[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const entries = await fs.readdir(this.logsPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = path.join(this.logsPath, entry.name);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime > cutoffDate) {
          files.push(filePath);
        }
      }
    }
    
    return files;
  }

  private extractSkillsFromSession(parsed: any): Skill[] {
    const skills: Skill[] = [];
    const content = parsed.content;
    
    // Pattern: Agent performed action successfully
    const actionPattern = /\*\*(\w+)\*\*.*?(created|generated|deployed|analyzed|validated|coordinated).*?successfully/gi;
    const matches = content.matchAll(actionPattern);
    
    for (const match of matches) {
      const agent = match[1];
      const action = match[2];
      
      // Create skill from detected pattern
      const skill: Skill = {
        id: `${agent.toLowerCase()}-${action}-${Date.now()}`,
        name: `${agent}: ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        description: `Detected capability: ${agent} can ${action}`,
        category: this.inferCategory(action),
        agents: [agent],
        capability: {
          input: 'Detected from session',
          output: action,
          process: 'Pattern extracted from successful session'
        },
        complexity: 'moderate',
        source: {
          type: 'session-log',
          reference: parsed.data.title || 'Session log'
        },
        discoveredDate: new Date().toISOString(),
        discoveredBy: 'auto',
        constitutionalCompliance: {
          article0: { compliant: true, notes: 'Pattern extraction' },
          article16: { compliant: true },
          article17: { compliant: true },
          article18: { compliant: true },
          validated: false
        },
        status: 'discovered'
      };
      
      skills.push(skill);
    }
    
    return skills;
  }

  private inferCategory(action: string): any {
    const categoryMap: { [key: string]: string } = {
      'created': 'code-generation',
      'generated': 'code-generation',
      'deployed': 'deployment',
      'analyzed': 'code-analysis',
      'validated': 'quality-assurance',
      'coordinated': 'orchestration'
    };
    
    return categoryMap[action.toLowerCase()] || 'project-management';
  }
}
