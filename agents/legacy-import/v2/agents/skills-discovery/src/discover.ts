#!/usr/bin/env ts-node
/**
 * Skills Discovery - Main Discovery Engine
 * 
 * Scans multiple sources for new agent capabilities
 * Coordinates: KEEPER (taxonomy), ARCH (patterns), LEX (validation)
 */

import { Octokit } from '@octokit/rest';
import { Skill, MonitoringSource } from './types';
import { SessionLogMonitor } from './monitors/session-logs';
import { GitHubMonitor } from './monitors/github';
import { NpmMonitor } from './monitors/npm';
import { SkillValidator } from './validators/constitutional';
import { SkillSynthesizer } from './synthesizers/keeper';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

export class SkillsDiscoveryEngine {
  private monitors: Map<string, any> = new Map();
  private validator: SkillValidator;
  private synthesizer: SkillSynthesizer;

  constructor() {
    this.validator = new SkillValidator();
    this.synthesizer = new SkillSynthesizer();
    
    // Initialize monitors
    this.monitors.set('session-logs', new SessionLogMonitor());
    this.monitors.set('github', new GitHubMonitor(octokit));
    this.monitors.set('npm', new NpmMonitor());
  }

  /**
   * Run discovery across all sources
   */
  async discover(): Promise<Skill[]> {
    console.log('🔍 Starting skills discovery...');
    
    const discoveredSkills: Skill[] = [];
    
    // Run all monitors in parallel
    const monitorPromises = Array.from(this.monitors.entries()).map(
      async ([name, monitor]) => {
        console.log(`  Scanning: ${name}...`);
        try {
          const skills = await monitor.scan();
          console.log(`  ✓ ${name}: ${skills.length} skills found`);
          return skills;
        } catch (error) {
          console.error(`  ✗ ${name} failed:`, error);
          return [];
        }
      }
    );

    const results = await Promise.all(monitorPromises);
    const allSkills = results.flat();

    console.log(`\n📊 Total candidates: ${allSkills.length}`);

    // Synthesize and deduplicate (KEEPER coordination)
    console.log('\n🧠 KEEPER: Synthesizing skills...');
    const synthesized = await this.synthesizer.synthesize(allSkills);
    console.log(`  Deduplicated: ${allSkills.length} → ${synthesized.length}`);

    // Validate constitutionally (LEX coordination)
    console.log('\n⚖️  LEX: Validating constitutional compliance...');
    for (const skill of synthesized) {
      const isValid = await this.validator.validate(skill);
      if (isValid) {
        discoveredSkills.push(skill);
      } else {
        console.log(`  ✗ Rejected: ${skill.name} (constitutional violation)`);
      }
    }

    console.log(`\n✅ Discovery complete: ${discoveredSkills.length} valid skills\n`);
    
    // Output for GitHub Actions
    console.log(`::set-output name=count::${discoveredSkills.length}`);
    
    return discoveredSkills;
  }

  /**
   * Save discovered skills
   */
  async save(skills: Skill[]): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const outputDir = path.join(
      process.cwd(),
      'agents/skills-library/auto-discovered'
    );
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `discovered-${timestamp}.json`;
    
    await fs.writeFile(
      path.join(outputDir, filename),
      JSON.stringify({ date: timestamp, skills }, null, 2)
    );
    
    console.log(`💾 Saved: ${filename}`);
  }
}

// Run if called directly
if (require.main === module) {
  (async () => {
    const engine = new SkillsDiscoveryEngine();
    const skills = await engine.discover();
    await engine.save(skills);
  })();
}
