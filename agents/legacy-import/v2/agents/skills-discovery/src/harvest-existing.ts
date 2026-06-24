#!/usr/bin/env ts-node
/**
 * Existing Skills Harvester
 * 
 * One-time harvest of all existing agent skills from public sources
 * Target: 2300+ skills from across the internet
 * 
 * Sources:
 * - LangChain skill library
 * - AutoGPT capabilities
 * - CrewAI skills
 * - GitHub topic:agent-skills
 * - Anthropic MCP servers
 * - OpenAI function calling examples
 * - AI agent frameworks
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Skill } from './types';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export class ExistingSkillsHarvester {
  private sources = [
    {
      name: 'LangChain Skills',
      url: 'https://github.com/langchain-ai/langchain/tree/master/libs/langchain/langchain/tools',
      type: 'github',
      estimated: 150
    },
    {
      name: 'AutoGPT Capabilities',
      url: 'https://github.com/Significant-Gravitas/AutoGPT',
      type: 'github',
      estimated: 80
    },
    {
      name: 'CrewAI Skills',
      url: 'https://github.com/joaomdmoura/crewAI',
      type: 'github',
      estimated: 60
    },
    {
      name: 'GitHub Agent Skills',
      query: 'topic:agent-skills OR topic:ai-tools',
      type: 'github-search',
      estimated: 500
    },
    {
      name: 'Anthropic MCP Servers',
      url: 'https://github.com/topics/mcp-server',
      type: 'github',
      estimated: 200
    },
    {
      name: 'OpenAI Function Calling',
      url: 'https://platform.openai.com/docs/guides/function-calling',
      type: 'documentation',
      estimated: 100
    },
    {
      name: 'Hugging Face Agents',
      url: 'https://huggingface.co/docs/transformers/transformers_agents',
      type: 'documentation',
      estimated: 75
    },
    {
      name: 'LlamaIndex Tools',
      url: 'https://github.com/run-llama/llama_index',
      type: 'github',
      estimated: 120
    },
    {
      name: 'Semantic Kernel',
      url: 'https://github.com/microsoft/semantic-kernel',
      type: 'github',
      estimated: 200
    },
    {
      name: 'BabyAGI Skills',
      url: 'https://github.com/yoheinakajima/babyagi',
      type: 'github',
      estimated: 40
    },
    {
      name: 'AgentGPT Capabilities',
      url: 'https://github.com/reworkd/AgentGPT',
      type: 'github',
      estimated: 50
    },
    {
      name: 'SuperAGI Skills',
      url: 'https://github.com/TransformerOptimus/SuperAGI',
      type: 'github',
      estimated: 100
    },
    {
      name: 'AI Agent Framework Collection',
      query: 'ai agent framework skills',
      type: 'github-search',
      estimated: 400
    },
    {
      name: 'npm AI Tools',
      query: 'keywords:ai-agent,agent-tools',
      type: 'npm',
      estimated: 200
    }
  ];

  async harvestAll(): Promise<Skill[]> {
    console.log('🌐 EXISTING SKILLS HARVEST - Starting...');
    console.log(`📊 Target: ${this.sources.reduce((sum, s) => sum + s.estimated, 0)}+ skills\n`);
    
    const allSkills: Skill[] = [];
    
    for (const source of this.sources) {
      console.log(`\n📦 Harvesting: ${source.name}`);
      console.log(`   Expected: ~${source.estimated} skills`);
      
      try {
        let skills: Skill[] = [];
        
        switch (source.type) {
          case 'github':
            skills = await this.harvestGitHubRepo(source.url!);
            break;
          case 'github-search':
            skills = await this.harvestGitHubSearch(source.query!);
            break;
          case 'documentation':
            skills = await this.harvestDocumentation(source.url!);
            break;
          case 'npm':
            skills = await this.harvestNpm(source.query!);
            break;
        }
        
        console.log(`   ✓ Found: ${skills.length} skills`);
        allSkills.push(...skills);
        
      } catch (error) {
        console.error(`   ✗ Failed: ${error}`);
      }
      
      // Rate limiting
      await this.sleep(1000);
    }
    
    console.log(`\n✅ HARVEST COMPLETE`);
    console.log(`📊 Total Skills: ${allSkills.length}`);
    console.log(`📁 Saving to: agents/skills-library/harvested/\n`);
    
    await this.save(allSkills);
    
    return allSkills;
  }

  private async harvestGitHubRepo(url: string): Promise<Skill[]> {
    // Extract owner/repo from URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return [];
    
    const [, owner, repo] = match;
    const skills: Skill[] = [];
    
    try {
      // Get repository tree
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo: repo.replace(/\.git$/, ''),
        tree_sha: 'HEAD',
        recursive: 'true'
      });
      
      // Find skill files (tools, agents, capabilities)
      const skillFiles = data.tree.filter(item => 
        item.path?.match(/(tool|agent|skill|capability)/i) &&
        (item.path?.endsWith('.py') || 
         item.path?.endsWith('.ts') ||
         item.path?.endsWith('.js'))
      );
      
      // Extract skills from each file (simplified)
      for (const file of skillFiles.slice(0, 50)) {  // Limit to first 50
        const skillName = file.path?.split('/').pop()?.replace(/\.(py|ts|js)$/, '') || 'unknown';
        
        skills.push({
          id: `${owner}-${repo}-${skillName}`.toLowerCase(),
          name: skillName,
          description: `Skill from ${owner}/${repo}`,
          category: 'code-generation',
          agents: [],
          capability: {
            input: 'To be analyzed',
            output: 'To be analyzed',
            process: 'Harvested from repository'
          },
          complexity: 'moderate',
          source: {
            type: 'github',
            url: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
            repository: `${owner}/${repo}`
          },
          discoveredDate: new Date().toISOString(),
          discoveredBy: 'manual',
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
      console.error(`  Error harvesting ${owner}/${repo}:`, error);
    }
    
    return skills;
  }

  private async harvestGitHubSearch(query: string): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    try {
      const { data } = await octokit.rest.search.repos({
        q: query,
        per_page: 30,
        sort: 'stars'
      });
      
      for (const repo of data.items) {
        const repoSkills = await this.harvestGitHubRepo(repo.html_url);
        skills.push(...repoSkills);
      }
    } catch (error) {
      console.error('GitHub search failed:', error);
    }
    
    return skills;
  }

  private async harvestDocumentation(url: string): Promise<Skill[]> {
    // Placeholder - would scrape documentation pages
    return [];
  }

  private async harvestNpm(query: string): Promise<Skill[]> {
    // Placeholder - would search npm registry
    return [];
  }

  private async save(skills: Skill[]): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const outputDir = path.join(
      process.cwd(),
      'agents/skills-library/harvested'
    );
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `harvest-${timestamp}.json`;
    
    await fs.writeFile(
      path.join(outputDir, filename),
      JSON.stringify({ 
        harvestDate: timestamp, 
        totalSkills: skills.length,
        skills 
      }, null, 2)
    );
    
    console.log(`💾 Saved: ${filename}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (require.main === module) {
  (async () => {
    const harvester = new ExistingSkillsHarvester();
    await harvester.harvestAll();
  })();
}
