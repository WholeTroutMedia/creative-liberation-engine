/**
 * Skills Library Integration - Main Entry Point
 * 
 * Complete integration of 250 agent skills into creative-liberation-engine system
 */

export { SkillsLibrary, getSkillsLibrary, Skill, SkillCategory } from './skill-loader';
export { SkillExecutor, SkillExecutionContext, SkillExecutionResult } from './skill-executor';

import { getSkillsLibrary } from './skill-loader';
import { SkillExecutor } from './skill-executor';

/**
 * Initialize the complete skills system
 */
export async function initializeSkillsSystem() {
  console.log('🚀 Initializing creative-liberation-engine Skills Library...');
  
  const library = getSkillsLibrary();
  await library.loadAll();
  
  const stats = library.getStats();
  console.log('📊 Skills Library Statistics:');
  console.log(`   Total Skills: ${stats.totalSkills}`);
  console.log(`   Categories: ${stats.totalCategories}`);
  console.log(`   Agents Enhanced: ${stats.totalAgents}`);
  console.log(`   By Complexity:`);
  console.log(`     - Simple: ${stats.byComplexity.simple}`);
  console.log(`     - Moderate: ${stats.byComplexity.moderate}`);
  console.log(`     - Expert: ${stats.byComplexity.expert}`);
  console.log(`   Top Agents:`);
  stats.topAgents.forEach(({ agent, count }) => {
    console.log(`     - ${agent}: ${count} skills`);
  });
  
  console.log('✅ Skills Library initialized successfully!');
  
  return {
    library,
    executor: new SkillExecutor(),
    stats
  };
}

/**
 * Quick skill lookup helper
 */
export function findSkill(query: string) {
  const library = getSkillsLibrary();
  const results = library.searchSkills(query);
  
  if (results.length === 0) {
    console.log(`No skills found for: ${query}`);
    return null;
  }
  
  if (results.length === 1) {
    return results[0];
  }
  
  console.log(`Found ${results.length} skills matching "${query}":`);
  results.forEach(skill => {
    console.log(`  - ${skill.name} (${skill.id})`);
  });
  
  return results;
}

/**
 * Get agent capabilities
 */
export function getAgentCapabilities(agent: string) {
  const library = getSkillsLibrary();
  const skills = library.getAgentSkills(agent);
  
  console.log(`${agent} capabilities:`);
  console.log(`  Total Skills: ${skills.length}`);
  
  const byComplexity = {
    simple: skills.filter(s => s.complexity === 'simple').length,
    moderate: skills.filter(s => s.complexity === 'moderate').length,
    expert: skills.filter(s => s.complexity === 'expert').length
  };
  
  console.log(`  By Complexity:`);
  console.log(`    - Simple: ${byComplexity.simple}`);
  console.log(`    - Moderate: ${byComplexity.moderate}`);
  console.log(`    - Expert: ${byComplexity.expert}`);
  
  return skills;
}
