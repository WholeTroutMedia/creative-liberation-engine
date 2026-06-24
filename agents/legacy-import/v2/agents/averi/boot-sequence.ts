/**
 * AVERI Boot Sequence
 * Loads skills library, MCP ecosystem, and initializes system
 * 
 * HELIX 3: Agent Boot Protocol Integration
 */

import { getSkillsLibrary } from '../skills-library/integration/skill-loader.js';
import { getMCPOrchestrator } from '../../backend/src/mcp/mcp-orchestrator.js';
import { logger } from '../../backend/src/core/logger.js';

export class AVERIBootSequence {
  private skillsLibrary: any;
  private mcpOrchestrator: any;
  
  async boot(): Promise<void> {
    logger.info('🔵 AVERI Trinity initializing...');
    
    // PHASE 1: Load Constitutional DNA (Skills Library)
    await this.loadSkillsLibrary();
    
    // PHASE 2: Start MCP Ecosystem (All 12 Servers)
    await this.startMCPEcosystem();
    
    // PHASE 3: Load Agent Registry
    await this.loadAgentRegistry();
    
    // PHASE 4: Verify System Integrity
    await this.verifyIntegrity();
    
    logger.info('✅ AVERI Trinity online with full MCP ecosystem');
  }
  
  private async loadSkillsLibrary(): Promise<void> {
    logger.info('📚 Phase 1: Loading Skills Library...');
    
    this.skillsLibrary = getSkillsLibrary();
    await this.skillsLibrary.loadAll();
    
    const stats = this.skillsLibrary.getStats();
    logger.info(`✅ Loaded ${stats.totalSkills} native skills from ${stats.totalCategories} categories`);
    
    const critical = this.skillsLibrary.getCriticalSkills();
    logger.info(`🔥 ${critical.length} critical skills available`);
  }
  
  private async startMCPEcosystem(): Promise<void> {
    logger.info('🌐 Phase 2: Starting MCP Ecosystem...');
    
    this.mcpOrchestrator = getMCPOrchestrator();
    await this.mcpOrchestrator.startAll();
    
    const stats = this.mcpOrchestrator.getStats();
    logger.info(`✅ ${stats.activeServers}/${stats.totalServers} MCP servers online`);
    logger.info(`✅ ${stats.totalTools} total tools available`);
    
    // Log tools by server
    logger.info('MCP Ecosystem:');
    for (const [server, count] of Object.entries(stats.byServer)) {
      logger.info(`  - ${server}: ${count} tools`);
    }
  }
  
  private async loadAgentRegistry(): Promise<void> {
    logger.info('📊 Phase 3: Loading Agent Registry...');
    
    const { readFileSync } = await import('fs');
    const registry = JSON.parse(
      readFileSync('agents/.agent-status.json', 'utf-8')
    );
    
    logger.info(`✅ System v${registry.system_version} - ${registry.metadata.active_agents} agents active`);
  }
  
  private async verifyIntegrity(): Promise<void> {
    logger.info('🔍 Phase 4: Verifying system integrity...');
    
    // Verify skills
    const testSkill = this.skillsLibrary.getSkill('core/web-search');
    if (!testSkill) {
      throw new Error('Critical skill missing: core/web-search');
    }
    
    // Verify MCP
    const stats = this.mcpOrchestrator.getStats();
    if (stats.activeServers === 0) {
      logger.warn('⚠️  No MCP servers active (check environment variables)');
    }
    
    logger.info('✅ System integrity verified');
  }
  
  getCapabilities(): any {
    const skillStats = this.skillsLibrary.getStats();
    const mcpStats = this.mcpOrchestrator.getStats();
    
    return {
      nativeSkills: skillStats.totalSkills,
      mcpServers: mcpStats.activeServers,
      mcpTools: mcpStats.totalTools,
      totalCapabilities: skillStats.totalSkills + mcpStats.totalTools,
      agents: this.skillsLibrary.agentSkills.size,
      ecosystem: 'full'
    };
  }
}

// Singleton
let bootSequence: AVERIBootSequence | null = null;

export async function bootAVERI(): Promise<AVERIBootSequence> {
  if (!bootSequence) {
    bootSequence = new AVERIBootSequence();
    await bootSequence.boot();
  }
  return bootSequence;
}
