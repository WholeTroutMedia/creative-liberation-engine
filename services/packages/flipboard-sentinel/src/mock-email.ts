import { sendIdeationEmail } from './email-dispatcher.js';
import { JobManifest } from './job-registry.js';
import { CONFIG } from './config.js';

// Setup basic CONFIG if needed, although it should load from .env
console.log('Sending mock email to:', CONFIG.notifyEmail);

const mockManifest: JobManifest = {
    jobId: 'IE-MOCK-0001',
    jobNumber: 1,
    slug: 'mock-email',
    filename: 'IE-MOCK-0001_mock-email',
    sourceArticle: {
        guid: 'mock-guid',
        title: 'Project NEXUS: Sovereign AI Architecture & Quantum Data Modeling',
        url: 'https://example.com/nexus',
        author: 'CLE Lab',
        pubDate: new Date().toISOString(),
        imageUrl: null,
        categories: []
    },
    categories: ['sovereign-ai', 'architecture', 'v6-core'],
    status: 'IDEATED',
    cleRelevance: 85,
    createdAt: new Date().toISOString(),
    ideatedAt: new Date().toISOString(),
    activatedAt: null,
    completedAt: null,
    digestBatchId: null,
    relatedJobs: [],
    obsidianPath: '',
    comments: [],
    athenaOutput: {
        rationale: 'Project NEXUS introduces a radical shift in Sovereign Architecture. The pipeline enables unprecedented telemetry visibility, utilizing the new V6 CORTEX engine to drive automated deployments. Integration with the NAS cluster is highly recommended to offload processing.',
        directive: 'Establish the core NEXUS service mesh on the NAS. Implement the telemetry ingest pipeline and link it to the V6 CORTEX dispatch hub.',
        options: [
            {
                title: 'NAS Telemetry Mesh Deployment',
                description: 'Deploy the telemetry microservice directly to the NAS Docker cluster. This ensures zero latency and Sovereign data control.',
                tradeoffs: 'Requires port mapping re-configurations. High impact, moderate effort due to network routing changes.',
                recommendation: 'preferred'
            },
            {
                title: 'Hybrid CORTEX Integration',
                description: 'Link the local workstation to the NAS CORTEX engine via WebSocket, bridging local inference with centralized dispatch.',
                tradeoffs: 'Introduces local dependency, but reduces NAS compute load. Viable if NAS resources are constrained.',
                recommendation: 'viable'
            },
            {
                title: 'Legacy Agent Wrapper',
                description: 'Wrap the existing V5 agents to simulate NEXUS behavior.',
                tradeoffs: 'High technical debt risk. Not recommended for V6.',
                recommendation: 'avoid'
            }
        ],
        suggestedAgents: ['PULSE', 'ATHENA', 'ARCHITECT'],
        nextMode: 'PLAN',
        constitutionalFlags: [
            'Ensure telemetry does not leak beyond the NAS (Sovereignty Protocol Alpha)',
            'Verify Docker configurations align with V6 Security Helices'
        ]
    }
};

const mockCrossRefs = [
    { relatedJobId: 'IE-IDX-0042', relatedSlug: 'v5-to-v6-migration-plan', similarityScore: 0.92, sharedCategories: [], sharedKeywords: [] },
    { relatedJobId: 'IE-IDX-0089', relatedSlug: 'cortex-engine-v2-specs', similarityScore: 0.78, sharedCategories: [], sharedKeywords: [] }
];

async function run() {
    console.log('Generating and sending IDEATION HUD email...');
    await sendIdeationEmail(mockManifest, mockCrossRefs);
    console.log('Done!');
}

run().catch(console.error);
