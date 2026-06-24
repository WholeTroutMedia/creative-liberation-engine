/**
 * GitHub Monitor
 * 
 * Monitors GitHub for new MCP servers, tools, agent frameworks
 */

import { Octokit } from '@octokit/rest';
import { Skill } from '../types';

export class GitHubMonitor {
  private octokit: Octokit;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  async scan(): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    // Search for MCP servers created recently
    const queries = [
      'topic:mcp-server created:>2026-02-01',
      'topic:ai-tools created:>2026-02-01',
      'topic:agent-skills created:>2026-02-01'
    ];
    
    for (const query of queries) {
      try {
        const { data } = await this.octokit.rest.search.repos({
          q: query,
          per_page: 10,
          sort: 'created'
        });
        
        for (const repo of data.items) {
          skills.push({
            id: `github-${repo.full_name}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
            name: repo.name,
            description: repo.description || 'GitHub repository',
            category: 'integration',
            agents: [],
            capability: {
              input: 'To be analyzed',
              output: 'To be analyzed',
              process: 'GitHub repository discovery'
            },
            complexity: 'moderate',
            source: {
              type: 'github',
              url: repo.html_url,
              repository: repo.full_name
            },
            discoveredDate: new Date().toISOString(),
            discoveredBy: 'auto',
            constitutionalCompliance: {
              article0: { compliant: false, notes: 'External source - review needed' },
              article16: { compliant: true },
              article17: { compliant: true },
              article18: { compliant: false, notes: 'External source - review needed' },
              validated: false
            },
            status: 'discovered'
          });
        }
      } catch (error) {
        console.error(`GitHub search failed for: ${query}`, error);
      }
    }
    
    return skills;
  }
}
