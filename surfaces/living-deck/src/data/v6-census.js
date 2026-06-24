export const CENSUS = {
  agents: {
    total: 78,
    actual: 88,
    core: 58,
    platform: 5,
    lora: 5,
    hives: {
      core: 43,
      creative: 6,
      platform: 5,
      MUXD: 5,
      CORTEX: 4,
      unknown: 5,
      dev_tools: 2,
      interface: 2,
      security: 1,
      governance: 1,
      observability: 1,
      data: 1,
      VAULT: 1,
      LEX: 1,
      LUMIND: 1,
      NORTHSTAR: 1,
      BROADCAST: 1
    }
  },
  skills: {
    total: 83,
    callable: 81,
    uncallable: 2
  },
  workflows: {
    total: 7,
    items: [
      { id: 'media-production', name: 'Media Production Flow', steps: 5, desc: 'Concept → Asset Gen → Compositing → Color/Audio → Render' },
      { id: 'content-delivery', name: 'Content Delivery Flow', steps: 4, desc: 'Ideation → Production → Review → Multi-Channel Delivery' },
      { id: 'incident-response', name: 'Incident Response Triage', steps: 5, desc: 'Detection → Triage → Stabilization → Postmortem with Rollback' },
      { id: 'vendor-approval', name: 'Vendor Approval Audit', steps: 5, desc: 'Sovereignty, Security, Cost, and Lock-In Evaluation' },
      { id: 'client-feedback', name: 'Client Feedback Intake', steps: 4, desc: 'Intake → Sentiment → Prioritization → Action Assignment' },
      { id: 'eval-capability', name: 'Capability Benchmark Evaluation', steps: 4, desc: 'Agent/Skill Benchmarking with Regression Detection' },
      { id: 'eval-regression', name: 'Quality Regression Guard', steps: 4, desc: 'Quality Regression Detection across responses and tool calls' }
    ]
  },
  models: {
    tiers: 21,
    installed: 17,
    fleetServices: 13,
    sizeGB: 200
  },
  schemas: {
    total: 136
  },
  apps: {
    total: 12
  },
  services: {
    total: 69
  },
  capabilities: {
    total: 93,
    original: 84,
    helix: 9
  },
  timeline: [
    { version: 'V1', period: 'Jan 2026', title: 'The Spark', desc: 'Python-based CLE core, studio GUI. First constitutional principles.' },
    { version: 'V2', period: 'Feb 2026', title: 'The Library', desc: '333-skill library, 23+ agents, DNA propagation, automated compliance.' },
    { version: 'V3', period: 'Mar 2026', title: 'The Hive', desc: 'Hive architecture, agent mesh, dynamic operational routing.' },
    { version: 'V4', period: 'Mar 2026', title: 'The Charter', desc: 'Sovereign hive charter, director/palette execution, design governance.' },
    { version: 'V5', period: 'Apr 2026', title: 'The Genesis', desc: 'Genesis monorepo, 83 packages, synology Docker deployment.' },
    { version: 'V6', period: 'May 2026', title: 'The Contract', desc: 'Clean-root contract-first architecture. 78 agents, 136 schemas, sovereign server mesh.' }
  ]
};
