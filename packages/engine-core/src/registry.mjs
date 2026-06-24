/**
 * Registry loader — loads canonical registries from runtime/registry/*.
 *
 * Provides typed lookup functions for agents, skills, and workflows.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_DIR = join(import.meta.dirname, '..', '..', '..', 'runtime', 'registry');

let _agents = null;
let _skills = null;
let _workflows = null;
let _loras = null;
let _models = null;

/**
 * Load all canonical registries from disk.
 * @param {string} [registryDir] - Override registry directory path
 * @returns {{ agents: object, skills: object, workflows: object, loras: object, models: object }}
 */
export function loadRegistries(registryDir = REGISTRY_DIR) {
  _agents = JSON.parse(readFileSync(join(registryDir, 'agents.canonical.json'), 'utf-8'));
  _skills = JSON.parse(readFileSync(join(registryDir, 'skills.canonical.json'), 'utf-8'));
  _workflows = JSON.parse(readFileSync(join(registryDir, 'workflows.canonical.json'), 'utf-8'));
  _loras = JSON.parse(readFileSync(join(registryDir, 'loras.canonical.json'), 'utf-8'));
  _models = JSON.parse(readFileSync(join(registryDir, 'models.canonical.json'), 'utf-8'));

  console.log(`[registry] Loaded: ${_agents.agents?.length || 0} agents, ${_skills.skills?.length || 0} skills, ${_workflows.workflows?.length || 0} workflows, ${_loras.loras?.length || 0} LoRAs, ${_models.models?.length || 0} models`);

  return { agents: _agents, skills: _skills, workflows: _workflows, loras: _loras, models: _models };
}

/**
 * Look up an agent by ID.
 * @param {string} agentId
 * @returns {object|undefined}
 */
export function getAgent(agentId) {
  if (!_agents) throw new Error('Registries not loaded. Call loadRegistries() first.');
  return _agents.agents?.find(a => a.agentId === agentId);
}

/**
 * Look up a skill by ID.
 * @param {string} skillId
 * @returns {object|undefined}
 */
export function getSkill(skillId) {
  if (!_skills) throw new Error('Registries not loaded. Call loadRegistries() first.');
  return _skills.skills?.find(s => s.skillId === skillId);
}

/**
 * Look up a workflow by ID.
 * @param {string} workflowId
 * @returns {object|undefined}
 */
export function getWorkflow(workflowId) {
  if (!_workflows) throw new Error('Registries not loaded. Call loadRegistries() first.');
  return _workflows.workflows?.find(w => w.workflowId === workflowId);
}
