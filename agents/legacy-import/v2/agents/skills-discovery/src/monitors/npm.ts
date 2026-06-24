/**
 * npm Monitor
 * 
 * Monitors npm registry for new AI tools and agent packages
 */

import axios from 'axios';
import { Skill } from '../types';

export class NpmMonitor {
  async scan(): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    const keywords = ['ai-agent', 'mcp-server', 'agent-tools', 'ai-tools'];
    
    for (const keyword of keywords) {
      try {
        const { data } = await axios.get(
          `https://registry.npmjs.org/-/v1/search?text=keywords:${keyword}&size=10`
        );
        
        for (const pkg of data.objects) {
          skills.push({
            id: `npm-${pkg.package.name}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
            name: pkg.package.name,
            description: pkg.package.description || 'npm package',
            category: 'integration',
            agents: [],
            capability: {
              input: 'npm package',
              output: 'To be analyzed',
              process: 'npm package discovery'
            },
            complexity: 'moderate',
            source: {
              type: 'npm',
              url: pkg.package.links.npm,
              package: pkg.package.name
            },
            discoveredDate: new Date().toISOString(),
            discoveredBy: 'auto',
            constitutionalCompliance: {
              article0: { compliant: false, notes: 'External package - review needed' },
              article16: { compliant: true },
              article17: { compliant: true },
              article18: { compliant: false, notes: 'External package - review needed' },
              validated: false
            },
            status: 'discovered'
          });
        }
      } catch (error) {
        console.error(`npm search failed for: ${keyword}`, error);
      }
    }
    
    return skills;
  }
}
