#!/usr/bin/env ts-node
/**
 * Populate Skills Library System-Wide
 * 
 * Takes harvested skills and integrates them into creative-liberation-engine
 * Creates agent capability matrices
 * Updates documentation
 * Enables system-wide access
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Skill } from '../src/types';
import { CompleteConstitutionalValidator } from '../src/validators/complete-constitutional';

interface AgentCapabilities {
  agent: string;
  role: string;
  skills: string[];
  categories: string[];
  totalSkills: number;
}

export class LibraryPopulator {
  private validator = new CompleteConstitutionalValidator();
  private skills: Skill[] = [];
  private agentMatrix: Map<string, AgentCapabilities> = new Map();

  async populate() {
    console.log('🔄 POPULATING SKILLS LIBRARY SYSTEM-WIDE...\n');

    // Step 1: Load harvested skills
    await this.loadHarvestedSkills();

    // Step 2: Validate with complete constitutional check
    await this.validateSkills();

    // Step 3: Assign skills to agents
    await this.assignToAgents();

    // Step 4: Create capability matrices
    await this.createCapabilityMatrices();

    // Step 5: Generate documentation
    await this.generateDocumentation();

    // Step 6: Create system-wide index
    await this.createSystemIndex();

    console.log('\n✅ LIBRARY POPULATED SYSTEM-WIDE');
  }

  private async loadHarvestedSkills() {
    console.log('📂 Loading harvested skills...');
    
    const harvestedDir = path.join(process.cwd(), 'agents/skills-library/harvested');
    const files = await fs.readdir(harvestedDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(harvestedDir, file), 'utf-8');
        const data = JSON.parse(content);
        this.skills.push(...data.skills);
      }
    }
    
    console.log(`  ✓ Loaded ${this.skills.length} skills\n`);
  }

  private async validateSkills() {
    console.log('⚖️  Validating constitutional compliance (ALL Articles)...');
    
    const validated: Skill[] = [];
    let passed = 0;
    let failed = 0;
    
    for (const skill of this.skills) {
      const compliance = await this.validator.validateComplete(skill);
      
      if (compliance.overallScore >= 70) {  // 70% threshold
        validated.push(skill);
        passed++;
      } else {
        failed++;
        if (failed <= 5) {  // Show first 5 failures
          console.log(`  ✗ ${skill.name}: Score ${compliance.overallScore}% - ${compliance.violations.join(', ')}`);
        }
      }
    }
    
    this.skills = validated;
    console.log(`  ✓ Passed: ${passed}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`  📊 Pass rate: ${Math.round(passed / (passed + failed) * 100)}%\n`);
  }

  private async assignToAgents() {
    console.log('🤖 Assigning skills to agents...');
    
    // Initialize agent capabilities
    const agents = [
      'IRIS', 'ATHENA', 'COMET', 'AURORA', 'LEX',
      'VERA', 'KEEPER', 'ARCH', 'ECHO', 'SCRIBE',
      'RAM_CREW', 'SWITCHBOARD', 'COMPASS'
    ];
    
    for (const agent of agents) {
      this.agentMatrix.set(agent, {
        agent,
        role: this.getAgentRole(agent),
        skills: [],
        categories: [],
        totalSkills: 0
      });
    }
    
    // Assign skills based on category
    for (const skill of this.skills) {
      const assignedAgents = this.determineAgents(skill);
      for (const agent of assignedAgents) {
        const capabilities = this.agentMatrix.get(agent)!;
        capabilities.skills.push(skill.id);
        if (!capabilities.categories.includes(skill.category)) {
          capabilities.categories.push(skill.category);
        }
        capabilities.totalSkills++;
      }
    }
    
    console.log(`  ✓ Skills assigned to ${agents.length} agents\n`);
  }

  private async createCapabilityMatrices() {
    console.log('📊 Creating capability matrices...');
    
    const matrixDir = path.join(process.cwd(), 'agents/capabilities');
    await fs.mkdir(matrixDir, { recursive: true });
    
    // Create matrix for each agent
    for (const [agent, capabilities] of this.agentMatrix) {
      const matrix = {
        agent: capabilities.agent,
        role: capabilities.role,
        totalSkills: capabilities.totalSkills,
        categories: capabilities.categories,
        skills: capabilities.skills.map(id => {
          const skill = this.skills.find(s => s.id === id);
          return {
            id: skill?.id,
            name: skill?.name,
            category: skill?.category,
            complexity: skill?.complexity
          };
        }),
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(matrixDir, `${agent.toLowerCase()}-capabilities.json`),
        JSON.stringify(matrix, null, 2)
      );
    }
    
    console.log(`  ✓ Created matrices for all agents\n`);
  }

  private async generateDocumentation() {
    console.log('📝 Generating documentation...');
    
    // Create master skills index
    const docsDir = path.join(process.cwd(), 'docs/skills');
    await fs.mkdir(docsDir, { recursive: true });
    
    let markdown = `# Complete Skills Library\n\n`;
    markdown += `**Total Skills**: ${this.skills.length}\n`;
    markdown += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n\n`;
    markdown += `---\n\n`;
    
    // Group by category
    const byCategory = new Map<string, Skill[]>();
    for (const skill of this.skills) {
      if (!byCategory.has(skill.category)) {
        byCategory.set(skill.category, []);
      }
      byCategory.get(skill.category)!.push(skill);
    }
    
    for (const [category, skills] of byCategory) {
      markdown += `## ${category} (${skills.length})\n\n`;
      for (const skill of skills.slice(0, 10)) {  // First 10 per category
        markdown += `- **${skill.name}**: ${skill.description}\n`;
      }
      if (skills.length > 10) {
        markdown += `- ... and ${skills.length - 10} more\n`;
      }
      markdown += `\n`;
    }
    
    await fs.writeFile(
      path.join(docsDir, 'COMPLETE_LIBRARY.md'),
      markdown
    );
    
    console.log(`  ✓ Documentation generated\n`);
  }

  private async createSystemIndex() {
    console.log('🗂️  Creating system-wide index...');
    
    const index = {
      version: '2.0.0',
      totalSkills: this.skills.length,
      lastUpdated: new Date().toISOString(),
      agents: Array.from(this.agentMatrix.values()),
      categories: Array.from(new Set(this.skills.map(s => s.category))),
      sources: Array.from(new Set(this.skills.map(s => s.source.type))),
      index: this.skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        agents: this.getSkillAgents(s.id),
        complexity: s.complexity
      }))
    };
    
    await fs.writeFile(
      path.join(process.cwd(), 'agents/skills-library/INDEX.json'),
      JSON.stringify(index, null, 2)
    );
    
    console.log(`  ✓ System index created\n`);
  }

  // Helpers

  private getAgentRole(agent: string): string {
    const roles: { [key: string]: string } = {
      'IRIS': 'Swift Action',
      'ATHENA': 'Strategic Design',
      'COMET': 'Backend Development',
      'AURORA': 'Design Leadership',
      'LEX': 'Constitutional Compliance',
      'VERA': 'Truth & Memory',
      'KEEPER': 'Knowledge Organization',
      'ARCH': 'Code Architecture',
      'ECHO': 'Artist Understanding',
      'SCRIBE': 'Documentation',
      'RAM_CREW': 'Quality Assurance',
      'SWITCHBOARD': 'Operations',
      'COMPASS': 'Decision Framework'
    };
    return roles[agent] || 'Agent';
  }

  private determineAgents(skill: Skill): string[] {
    // Map categories to agents
    const categoryAgents: { [key: string]: string[] } = {
      'code-generation': ['IRIS', 'COMET', 'AURORA'],
      'code-analysis': ['ARCH', 'RAM_CREW', 'LEX'],
      'orchestration': ['SWITCHBOARD', 'IRIS'],
      'documentation': ['SCRIBE'],
      'design': ['AURORA'],
      'constitutional-enforcement': ['LEX'],
      'memory-management': ['VERA'],
      'pattern-recognition': ['ARCH', 'KEEPER'],
      'decision-making': ['ATHENA', 'COMPASS']
    };
    
    return categoryAgents[skill.category] || ['IRIS'];
  }

  private getSkillAgents(skillId: string): string[] {
    const agents: string[] = [];
    for (const [agent, capabilities] of this.agentMatrix) {
      if (capabilities.skills.includes(skillId)) {
        agents.push(agent);
      }
    }
    return agents;
  }
}

if (require.main === module) {
  (async () => {
    const populator = new LibraryPopulator();
    await populator.populate();
  })();
}
