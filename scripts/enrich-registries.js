import fs from 'fs';
import path from 'path';

const skillsPath = 'y:/creative-liberation-engine/runtime/registry/skills.canonical.json';
const agentsPath = 'y:/creative-liberation-engine/runtime/registry/agents.canonical.json';

const domainToAgents = {
  'runtime-ops': ['SYSTEMS', 'ARCHON'],
  'security': ['SENTINEL', 'VAULT'],
  'design-product-os': ['GRAPHICS', 'STUDIO'],
  'data-integration': ['RELAY', 'HARBOR'],
  'delivery-governance': ['PROOF', 'SCRIBE'],
  'memory-knowledge': ['KEEPER', 'STRATA'],
  'model-agent-quality': ['SAGE', 'VERA'],
  'creative-ops': ['SHOWRUNNER', 'AURORA'],
  'observability': ['HARBOR', 'VERA'],
  'infrastructure': ['SYSTEMS', 'ATLAS']
};

console.log('Reading skills canonical registry...');
const skillsData = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
let skillsEnriched = 0;

skillsData.skills.forEach(skill => {
  if (!skill.leadAgents || skill.leadAgents.length === 0) {
    const agents = domainToAgents[skill.domain];
    if (agents) {
      skill.leadAgents = [...agents];
      skillsEnriched++;
    } else {
      console.warn(`No mapping found for domain: ${skill.domain} (skill: ${skill.skillId})`);
    }
  }
});

console.log(`Enriched ${skillsEnriched} skills with leadAgents.`);
fs.writeFileSync(skillsPath, JSON.stringify(skillsData, null, 2), 'utf8');

console.log('Reading agents canonical registry...');
const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf8'));

let agentsEnriched = 0;
agentsData.agents.forEach(agent => {
  // Collect skills where this agent is a lead agent
  const ownedSkills = skillsData.skills
    .filter(skill => skill.leadAgents && skill.leadAgents.includes(agent.name))
    .map(skill => skill.skillId);

  agent.skills = ownedSkills;

  // Generate description based on hive and skill assignments
  let desc = `${agent.name} is a ${agent.kind.replace('_', ' ')} in the ${agent.hive} hive.`;
  if (ownedSkills.length > 0) {
    desc += ` Specializes in: ${ownedSkills.slice(0, 3).join(', ')}${ownedSkills.length > 3 ? '...' : ''}.`;
  } else {
    desc += ` Provides core operational support to the Creative Liberation Engine.`;
  }
  agent.description = desc;
  agentsEnriched++;
});

console.log(`Enriched ${agentsEnriched} agents with skills[] and description.`);
fs.writeFileSync(agentsPath, JSON.stringify(agentsData, null, 2), 'utf8');

console.log('Registry enrichment complete!');
