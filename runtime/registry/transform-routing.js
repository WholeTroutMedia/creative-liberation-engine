const fs = require('fs');
const path = require('path');

const REGISTRY_DIR = __dirname;
const SKILLS_PATH = path.join(REGISTRY_DIR, 'skills.canonical.json');
const AGENTS_PATH = path.join(REGISTRY_DIR, 'agents.canonical.json');

// Domain-to-agent mapping (deterministic)
const DOMAIN_AGENTS = {
  'runtime-ops': ['SYSTEMS', 'ARCHON'],
  'security': ['SENTINEL', 'VAULT'],
  'design-product-os': ['GRAPHICS', 'STUDIO'],
  'data-integration': ['RELAY', 'HARBOR'],
  'delivery-governance': ['PROOF', 'SCRIBE'],
  'memory-knowledge': ['KEEPER', 'STRATA'],
  'model-agent-quality': ['SAGE', 'VERA'],
  'creative-ops': ['SHOWRUNNER', 'AURORA'],
  'observability': ['HARBOR', 'VERA'],
  'infrastructure': ['SYSTEMS', 'ATLAS'],
};

// ── Task 1: Populate leadAgents on skills ──
const skillsData = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
let filledCount = 0;
let alreadyFilledCount = 0;
let unmappedDomains = new Set();

for (const skill of skillsData.skills) {
  if (skill.leadAgents && skill.leadAgents.length > 0) {
    alreadyFilledCount++;
    continue;
  }
  const agents = DOMAIN_AGENTS[skill.domain];
  if (!agents) {
    unmappedDomains.add(skill.domain);
    continue;
  }
  skill.leadAgents = [...agents];
  filledCount++;
}

// Update metadata
skillsData.generatedAt = new Date().toISOString();
fs.writeFileSync(SKILLS_PATH, JSON.stringify(skillsData, null, 2) + '\n', 'utf8');

console.log('=== TASK 1: leadAgents Assignment ===');
console.log(`Total skills: ${skillsData.skills.length}`);
console.log(`Already had leadAgents (preserved): ${alreadyFilledCount}`);
console.log(`Newly assigned leadAgents: ${filledCount}`);
console.log(`Unmapped domains: ${unmappedDomains.size > 0 ? [...unmappedDomains].join(', ') : 'NONE'}`);
console.log(`Coverage: ${alreadyFilledCount + filledCount}/${skillsData.skills.length} (${Math.round((alreadyFilledCount + filledCount) / skillsData.skills.length * 100)}%)`);
console.log('');

// ── Task 2: Reverse-map skills[] onto agents, add descriptions ──
const agentsData = JSON.parse(fs.readFileSync(AGENTS_PATH, 'utf8'));

// Build reverse map: agentName -> [skillIds]
const agentSkillMap = {};
for (const skill of skillsData.skills) {
  for (const agentName of (skill.leadAgents || [])) {
    if (!agentSkillMap[agentName]) agentSkillMap[agentName] = [];
    agentSkillMap[agentName].push(skill.skillId);
  }
}

// Hive-based description templates
const HIVE_DESCRIPTIONS = {
  'core': 'Core engine agent',
  'platform': 'Platform integration agent',
  'MUXD': 'Multiplexing and routing agent',
  'CORTEX': 'Intelligence and analytics agent',
  'BROADCAST': 'Broadcast and distribution agent',
  'LUMIND': 'Navigation and discovery agent',
  'LEX': 'Legal and compliance agent',
  'VAULT': 'Security vault and secrets management agent',
  'NORTHSTAR': 'Watchdog and monitoring agent',
  'unknown': 'Specialized layer agent',
  'security': 'Security operations agent',
  'governance': 'Governance and compliance agent',
  'observability': 'Observability and tracing agent',
  'data': 'Data integrity and synchronization agent',
  'creative': 'Creative production agent',
  'dev_tools': 'Developer tooling agent',
  'interface': 'User interface and interaction agent',
};

// Agent-specific descriptions (overrides for key agents)
const AGENT_DESCRIPTIONS = {
  'SYSTEMS': 'Infrastructure operations and runtime systems management — capacity, deployment, incident response, chaos engineering, and cost observability.',
  'ARCHON': 'Runtime orchestration authority — incident command, rollback operations, and route governance enforcement.',
  'SENTINEL': 'Security perimeter enforcement — attack surface mapping, auth policy verification, secret scanning, vulnerability gating, and threat modeling.',
  'VAULT': 'Secrets management and security vault operations — credential storage, permission boundary enforcement, and supply chain hardening.',
  'GRAPHICS': 'Visual design system governance — component contracts, design token management, design drift detection, and accessibility conformance.',
  'STUDIO': 'Design production environment — design system sync, interaction patterns, UX regression detection, and visual QA.',
  'RELAY': 'Data integration relay — connector health, event schema enforcement, SLA monitoring, and cross-system reconciliation.',
  'HARBOR': 'Data harbor and observability nexus — integration monitoring, benchmark orchestration, telemetry correlation, and agent observability.',
  'PROOF': 'Delivery validation and quality gates — merge readiness, release health, compliance evidence, skills linting, and change approval.',
  'SCRIBE': 'Governance scribe — audit trail compilation, policy change propagation, constitutional linting, and governance exception tracking.',
  'KEEPER': 'Memory and knowledge custodian — knowledge consistency, gap mapping, retention enforcement, provenance reconciliation, and semantic deduplication.',
  'STRATA': 'Memory schema and lineage authority — schema migration, lineage auditing, memory curation support, and knowledge store stratification.',
  'SAGE': 'Model quality sage — hallucination risk scoring, prompt regression guarding, multi-model consensus, and context window optimization.',
  'VERA': 'Evaluation and quality verification — eval harness execution, agent performance profiling, response grounding, tool call reliability, and dataset curation.',
  'SHOWRUNNER': 'Creative operations showrunner — DaVinci Resolve automation, media production orchestration, and creative workflow management.',
  'AURORA': 'Creative asset governance — design asset provenance tracking, creative pipeline automation, and artistic quality assurance.',
  'ATLAS': 'Infrastructure mapping and dependency auditing — orphan resource cleanup, route quality optimization, and archive compaction.',
  'ATHENA': 'Strategic leadership and cost arbitrage — model cost optimization, migration orchestration, and workflow synthesis.',
  'SWITCHBOARD': 'Route and workflow switching — route governance support, workflow synthesis, and integration routing.',
};

let agentsWithSkills = 0;
let agentsWithoutSkills = 0;

for (const agent of agentsData.agents) {
  const skills = agentSkillMap[agent.name] || [];
  agent.skills = skills;
  if (skills.length > 0) agentsWithSkills++;
  else agentsWithoutSkills++;

  // Set description: use specific if available, else hive-based
  if (AGENT_DESCRIPTIONS[agent.name]) {
    agent.description = AGENT_DESCRIPTIONS[agent.name];
  } else {
    const hiveDesc = HIVE_DESCRIPTIONS[agent.hive] || 'Specialized operations agent';
    agent.description = `${hiveDesc} for the ${agent.name} subsystem.`;
  }
}

// Update metadata
agentsData.generatedAt = new Date().toISOString();
agentsData.version = 'v6.2';
fs.writeFileSync(AGENTS_PATH, JSON.stringify(agentsData, null, 2) + '\n', 'utf8');

console.log('=== TASK 2: Agent skills[] + descriptions ===');
console.log(`Total agents: ${agentsData.agents.length}`);
console.log(`Agents with skills assigned: ${agentsWithSkills}`);
console.log(`Agents with no skills (no skill references them): ${agentsWithoutSkills}`);
console.log('');

// Print the skill distribution
console.log('=== Skill Distribution by Agent ===');
const sortedAgents = Object.entries(agentSkillMap).sort((a, b) => b[1].length - a[1].length);
for (const [agentName, skills] of sortedAgents) {
  console.log(`  ${agentName}: ${skills.length} skills`);
}
console.log('');
console.log('DONE — Both registries updated.');
