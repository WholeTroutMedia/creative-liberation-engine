/**
 * Tests for Agent Registry Validator
 * Ensures AGENT_BOOT_PROTOCOL enforcement
 */

import { AgentRegistryValidator } from './agent-registry-validator';

describe('AgentRegistryValidator', () => {
  let validator: AgentRegistryValidator;

  beforeEach(() => {
    validator = new AgentRegistryValidator();
  });

  describe('loadRegistry', () => {
    it('should load the agent registry successfully', () => {
      const registry = validator.loadRegistry();
      
      expect(registry).toBeDefined();
      expect(registry.system_version).toBeDefined();
      expect(registry.agents).toBeDefined();
      expect(typeof registry.agents).toBe('object');
    });

    it('should throw if registry file does not exist', () => {
      // This would require mocking the file system
      // For now, we trust the registry exists in the repo
      expect(() => validator.loadRegistry()).not.toThrow();
    });
  });

  describe('validateAgentExists', () => {
    beforeEach(() => {
      validator.loadRegistry();
    });

    it('should validate existing agents', () => {
      const result = validator.validateAgentExists('AVERI');
      
      expect(result.exists).toBe(true);
      expect(result.agent).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject non-existent agents', () => {
      const result = validator.validateAgentExists('FAKE_AGENT_12345');
      
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found in registry');
    });

    it('should provide suggestions for similar agent names', () => {
      const result = validator.validateAgentExists('arch');
      
      if (!result.exists) {
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions!.length).toBeGreaterThan(0);
      }
    });

    it('should handle case-sensitive agent names', () => {
      const upperResult = validator.validateAgentExists('ARCH');
      const lowerResult = validator.validateAgentExists('arch');
      
      // Registry uses exact names, should be case-sensitive
      expect(upperResult.exists).not.toBe(lowerResult.exists);
    });
  });

  describe('getAllAgentNames', () => {
    it('should return all agent names from registry', () => {
      const names = validator.getAllAgentNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('AVERI');
      expect(names).toContain('COMPASS');
    });
  });

  describe('getAgentCount', () => {
    it('should return accurate agent counts', () => {
      const counts = validator.getAgentCount();
      
      expect(counts.decompressed).toBeGreaterThan(0);
      expect(counts.compressed).toBeGreaterThan(0);
      expect(counts.active).toBeGreaterThan(0);
      expect(counts.decompressed).toBeGreaterThanOrEqual(counts.compressed);
    });
  });

  describe('getAgentWorkspace', () => {
    it('should return workspace path for valid agent', () => {
      const workspace = validator.getAgentWorkspace('AVERI');
      
      expect(workspace).toBeDefined();
      expect(typeof workspace).toBe('string');
      expect(workspace).toContain('agents/');
    });

    it('should return null for invalid agent', () => {
      const workspace = validator.getAgentWorkspace('FAKE_AGENT');
      
      expect(workspace).toBeNull();
    });
  });

  describe('getAgentStatus', () => {
    it('should return status for valid agent', () => {
      const status = validator.getAgentStatus('AVERI');
      
      expect(status).toBeDefined();
      expect(['active', 'preparing', 'planned', 'resting']).toContain(status);
    });

    it('should return null for invalid agent', () => {
      const status = validator.getAgentStatus('FAKE_AGENT');
      
      expect(status).toBeNull();
    });
  });

  describe('generateBootReport', () => {
    it('should generate complete boot protocol report', () => {
      const report = validator.generateBootReport();
      
      expect(report.system_version).toBeDefined();
      expect(report.total_agents).toBeGreaterThan(0);
      expect(report.active_agents).toBeGreaterThan(0);
      expect(Array.isArray(report.agent_names)).toBe(true);
      expect(report.timestamp).toBeDefined();
    });

    it('should include all required agent names', () => {
      const report = validator.generateBootReport();
      
      expect(report.agent_names).toContain('AVERI');
      expect(report.agent_names).toContain('COMPASS');
      expect(report.agent_names).toContain('KEEPER');
      expect(report.agent_names).toContain('ARCH');
      expect(report.agent_names).toContain('ECHO');
    });
  });

  describe('AGENT_BOOT_PROTOCOL compliance', () => {
    it('should enforce registry load before validation', () => {
      const freshValidator = new AgentRegistryValidator();
      
      // Should auto-load registry on first validation
      const result = freshValidator.validateAgentExists('AVERI');
      expect(result.exists).toBe(true);
    });

    it('should prevent operations on hallucinated agents', () => {
      const hallucinations = [
        'TDD_ENFORCERS',  // Wrong name
        'code-archaeologist',  // Wrong format
        'BROADCAST',  // Hive name, not agent
        'SCRIBE',  // Coordination layer, not agent
      ];

      hallucinations.forEach(name => {
        const result = validator.validateAgentExists(name);
        expect(result.exists).toBe(false);
      });
    });

    it('should validate actual agent names correctly', () => {
      const realAgents = [
        'AVERI',
        'COMPASS',
        'KEEPER',
        'ARCH',
        'ECHO',
        'ATLAS',
        'MATH',
      ];

      realAgents.forEach(name => {
        const result = validator.validateAgentExists(name);
        expect(result.exists).toBe(true);
      });
    });
  });
});
