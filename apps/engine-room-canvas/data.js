// Engine Room — Department Data
// V6 Isometric City Layout
// Each department: id, name, icon, color, x/y/z grid position, height, description, agents, skills, tags

const DEPARTMENTS = [
  {
    id: 'dispatch',
    name: 'Dispatch Tower',
    icon: '⬡',
    color: '#00c8ff',
    colorDark: '#0077aa',
    gx: 0, gy: 0, gz: 0,
    w: 2, d: 2, h: 6,
    description: 'Central nervous system. Routes all tasks, events, and inter-agent communications across the Creative Liberation Engine.',
    agents: ['ALFRED', 'HERALD'],
    skills: ['task_routing', 'event_bus', 'load_balancing', 'priority_queue'],
    stats: { throughput: '4.2K/s', uptime: '99.97%', queue: 12 },
    tags: ['core', 'routing', 'realtime']
  },
  {
    id: 'averi',
    name: 'AVERI Command',
    icon: '◇',
    color: '#a855f7',
    colorDark: '#6b21a8',
    gx: 3, gy: 0, gz: 0,
    w: 2, d: 2, h: 5,
    description: 'ATHENA, VERA, and IRIS — the sovereign leadership collective. Strategic planning, constitutional enforcement, creative direction.',
    agents: ['ATHENA', 'VERA', 'IRIS'],
    skills: ['strategic_planning', 'governance', 'creative_direction', 'constitutional_enforcement'],
    stats: { decisions: '847', proposals: 23, vetoes: 2 },
    tags: ['leadership', 'governance', 'sovereign']
  },
  {
    id: 'memory',
    name: 'Memory Spine',
    icon: '🧠',
    color: '#22d3ee',
    colorDark: '#0e7490',
    gx: 1, gy: -1, gz: 0,
    w: 2, d: 2, h: 4,
    description: 'STRATA memory architecture. Manages Knowledge Items, conversation logs, vector embeddings, and the KEEPER postcard system.',
    agents: ['STRATA', 'KEEPER'],
    skills: ['vector_search', 'ki_management', 'context_compression', 'memory_distillation'],
    stats: { vectors: '128K', ki_count: 47, recall: '94.2%' },
    tags: ['memory', 'rag', 'knowledge']
  },
  {
    id: 'sovereign',
    name: 'Sovereign Vault',
    icon: '🔒',
    color: '#10b981',
    colorDark: '#065f46',
    gx: -1, gy: -1, gz: 0,
    w: 1, d: 1, h: 3,
    description: 'Credentials, API keys, secrets management, and Forgejo sovereignty layer. All sensitive data lives here, encrypted at rest.',
    agents: ['CIPHER'],
    skills: ['secret_management', 'key_rotation', 'access_control', 'audit_logging'],
    stats: { secrets: 142, rotations: 8, breaches: 0 },
    tags: ['security', 'sovereignty', 'infra']
  },
  {
    id: 'observatory',
    name: 'Research Observatory',
    icon: '🔭',
    color: '#3b82f6',
    colorDark: '#1d4ed8',
    gx: -1, gy: 0, gz: 0,
    w: 2, d: 1, h: 3,
    description: 'Autonomous research harvesters, web scrapers, and the CORTEX learning platform pipeline. Feeds the knowledge graph.',
    agents: ['CORTEX', 'SCOUT'],
    skills: ['web_scraping', 'research_synthesis', 'data_harvesting', 'course_parsing'],
    stats: { sources: 89, articles: '12.4K', feeds: 34 },
    tags: ['research', 'harvesting', 'learning']
  },
  {
    id: 'court',
    name: 'Constitution Court',
    icon: '⚖️',
    color: '#8b5cf6',
    colorDark: '#4c1d95',
    gx: -3, gy: 0, gz: 0,
    w: 2, d: 2, h: 4,
    description: 'Constitutional enforcement, governance review, and the V6 principle validator. Every action is measured against the 107 articles.',
    agents: ['JURIS', 'ATHENA'],
    skills: ['constitutional_review', 'policy_enforcement', 'audit', 'governance'],
    stats: { reviews: 234, enforced: 229, overridden: 5 },
    tags: ['governance', 'compliance', 'sovereign']
  },
  {
    id: 'studio',
    name: 'Design Studio',
    icon: '🎨',
    color: '#f43f5e',
    colorDark: '#9f1239',
    gx: -2, gy: 2, gz: 0,
    w: 2, d: 2, h: 3,
    description: 'STITCH-powered UI generation, brand identity, and the visual layer of every Creative Liberation Engine output. Pixel-perfect execution.',
    agents: ['PIXEL', 'MUSE'],
    skills: ['ui_generation', 'brand_design', 'stitch_integration', 'figma_export'],
    stats: { screens: 847, components: 234, exports: 129 },
    tags: ['design', 'ui', 'creative']
  },
  {
    id: 'broadcast',
    name: 'Broadcast Station',
    icon: '📡',
    color: '#ec4899',
    colorDark: '#9d174d',
    gx: 0, gy: 2, gz: 0,
    w: 2, d: 1, h: 3,
    description: 'Email dispatch, webhook orchestration, Stripe integration, and all outbound communications from the Engine to the world.',
    agents: ['HERALD', 'POSTMAN'],
    skills: ['email_dispatch', 'webhook_routing', 'stripe_webhooks', 'notification_management'],
    stats: { sent: '48.2K', delivered: '98.1%', hooks: 67 },
    tags: ['comms', 'email', 'webhooks']
  },
  {
    id: 'skills',
    name: 'Skills Workshop',
    icon: '🔧',
    color: '#f97316',
    colorDark: '#9a3412',
    gx: 2, gy: 2, gz: 0,
    w: 2, d: 1, h: 3,
    description: 'Agent skill registry, capability expansion, and the autonomous learning pipeline that keeps the Engine evolving.',
    agents: ['TRAINER', 'FORGE'],
    skills: ['skill_registration', 'capability_testing', 'lora_training', 'benchmark_eval'],
    stats: { skills: 91, active: 78, training: 4 },
    tags: ['skills', 'training', 'evolution']
  },
  {
    id: 'forge',
    name: 'The Forge',
    icon: '⚡',
    color: '#f59e0b',
    colorDark: '#92400e',
    gx: 4, gy: 2, gz: 0,
    w: 2, d: 2, h: 4,
    description: 'GPU inference cluster, model serving, LoRA training jobs, and the raw computational backbone of the Creative Liberation Engine.',
    agents: ['VULCAN', 'CUDA'],
    skills: ['model_inference', 'lora_training', 'gpu_scheduling', 'quantization'],
    stats: { models: 16, gpu_util: '73%', jobs: 3 },
    tags: ['compute', 'gpu', 'inference', 'models']
  },
  {
    id: 'scholar',
    name: 'Scholar Hive',
    icon: '📚',
    color: '#6366f1',
    colorDark: '#3730a3',
    gx: 0, gy: 4, gz: 0,
    w: 2, d: 2, h: 2,
    description: 'The Sovereign Academy — curated educational pathways, Udemy RAG data lake, and ALFRED-guided learning modules.',
    agents: ['ALFRED', 'TUTOR'],
    skills: ['curriculum_design', 'rag_search', 'progress_tracking', 'knowledge_synthesis'],
    stats: { courses: 24, modules: 187, learners: 1 },
    tags: ['education', 'rag', 'academy']
  }
];

// Data stream connection pairs [deptId_from, deptId_to]
const DATA_STREAMS = [
  ['dispatch', 'averi'],
  ['dispatch', 'memory'],
  ['dispatch', 'broadcast'],
  ['averi', 'court'],
  ['averi', 'forge'],
  ['memory', 'observatory'],
  ['memory', 'scholar'],
  ['skills', 'forge'],
  ['skills', 'dispatch'],
  ['observatory', 'memory'],
  ['studio', 'broadcast'],
  ['broadcast', 'dispatch'],
];

// System-wide telemetry
const SYSTEM_STATS = {
  agents: 40,
  skills: 91,
  modelTiers: 16,
  articles: 24,
  version: 'V6.2.0',
  uptime: '18d 4h 22m'
};
