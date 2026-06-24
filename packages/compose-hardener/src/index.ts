import { GoogleGenAI } from '@google/genai';
import { parseDocument, Document } from 'yaml';
import { ServicePatchSchema, ServicePatchData } from './schema-types.js';

let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
    if (!aiInstance) {
        // Force using API Key by stripping any environment credentials that trigger OAuth
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        aiInstance = new GoogleGenAI({ 
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
            httpOptions: process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : undefined
        });
    }
    return aiInstance;
}

// Whitelisted ports allowed to be exposed to public interfaces (0.0.0.0 / all interfaces)
const WHITELISTED_PORTS = new Set([
  3030, // memory service
  3080, // gateway
  3100, 3101, // genkit UI / pencil
  3500, // comet mobile
  4000, 4001, 4100, // genkit / ollama proxy
  4200, // wire ingestion MCP
  4300, // forge API
  5050, 5051, 5052, 5056, // dispatch / gateway / mcp hub
  5070, // automesh
  5090, // reasoning core
  5150, 5160, // dispatch
  5432, 5433, 5434, // postgres
  6379, 6380, // redis
  7100, // comet
  8000, 8010, // chromadb
  9001, // penpot
  9100, // scribe
  11434 // ollama
]);

export async function hardenComposeFile(yamlString: string): Promise<string> {
    const doc = parseDocument(yamlString);
    const composeObject = doc.toJSON();

    if (!composeObject || !composeObject.services) {
        throw new Error("Invalid docker-compose file: No 'services' block found.");
    }

    // We modify the AST directly via the Document methods to preserve comments/formatting
    const servicesNode = doc.get('services') as any;

    if (!servicesNode || !servicesNode.items) {
       throw new Error("Services node is not a proper YAML map.");
    }

    console.log("[Compose Hardener] Analyzing services for DevOps vulnerabilities...");

    let hasSandbox = false;

    for (const pair of servicesNode.items) {
        const serviceName = pair.key.value;
        const serviceDefinition = pair.value.toJSON();
        
        console.log(`[Compose Hardener] Evaluating service: ${serviceName}`);

        // Check if this service is classified as a sandbox
        const labels = serviceDefinition.labels || {};
        const isSandbox = serviceName.toLowerCase().includes('sandbox') ||
                          labels['cle.sandbox'] === 'true' ||
                          labels['com.cle.sandbox'] === 'true';

        if (isSandbox) {
            hasSandbox = true;
            console.log(`  -> Detected Sandbox Service: ${serviceName}`);
        }

        const prompt = `
        You are an elite DevOps Auto-Healer Agent for a Home Lab environment.
        Your task is to review the following docker-compose service definition and provide the optimal 
        'healthcheck' and 'deploy.resources.limits' blocks for it to prevent system crashes and ensure reliability.
        Additionally, you must audit the environment variables. If you see ANY hardcoded secrets (passwords, auth keys, tokens),
        return them in 'secretsReplaced' mapping the key to a .env interpolated string (e.g. "\${POSTGRES_PASSWORD}").

        Consider the image type (e.g., redis needs a ping check and low RAM, postgres needs pg_isready and more RAM, node needs a curl check).

        Service Definition Context:
        ${JSON.stringify(serviceDefinition, null, 2)}

        Return ONLY a raw JSON object string matching this exact structure (no markdown fences, strictly parseable JSON):
        {
          "healthcheck": { "test": ["CMD", "curl..."], "interval": "30s", "timeout": "10s", "retries": 3 },
          "deploy": { "resources": { "limits": { "cpus": "0.5", "memory": "512M" } } },
          "secretsReplaced": { "DB_PASS": "\${DB_PASS}" }
        }
        If a field is not applicable, omit it.
        `;

        try {
            console.log(`[Compose Hardener] Triggering Gemini invocation for ${serviceName}...`);
            let rawModel = process.env.GENKIT_DEFAULT_MODEL || 'gemini-2.5-flash';
            const modelName = rawModel.includes('/') ? rawModel.split('/').pop()! : rawModel;

            const result = await getAI().models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });

            console.log(`[Compose Hardener] Gemini responded for ${serviceName}. Text:`, result.text?.substring(0, 100));

            if (result.text) {
                const patch: ServicePatchData = JSON.parse(result.text);

                // Inject the autonomous modifications back into the YAML AST
                if (patch.healthcheck && !pair.value.has('healthcheck')) {
                    pair.value.set('healthcheck', doc.createNode(patch.healthcheck));
                    console.log(`  -> Injected Healthcheck logic.`);
                }
                
                if (patch.deploy && !pair.value.has('deploy')) {
                    pair.value.set('deploy', doc.createNode(patch.deploy));
                    console.log(`  -> Injected Resource limits (CPU/Memory).`);
                } else if (patch.deploy && pair.value.has('deploy') && !pair.value.get('deploy').has('resources')) {
                    pair.value.get('deploy').set('resources', doc.createNode(patch.deploy.resources));
                    console.log(`  -> Appended Resource limits to existing deploy block.`);
                }

                if (patch.secretsReplaced && Object.keys(patch.secretsReplaced).length > 0) {
                    const envNode = pair.value.get('environment');
                    if (envNode && envNode.items) {
                        for (const envPair of envNode.items) {
                            if (envPair.key && patch.secretsReplaced[envPair.key.value]) {
                                envPair.value.value = patch.secretsReplaced[envPair.key.value];
                                console.log(`  -> Isolated hardcoded secret for: ${envPair.key.value}`);
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error(`[Compose Hardener] Failed to optimize service ${serviceName}:`, e.message);
            throw e;
        }

        // ─── DETERMINISTIC SECURITY POLICIES ───────────────────────────────────

        // 1. Sandbox Isolation Policy
        if (isSandbox) {
            // Force strict sandbox network isolation
            pair.value.set('networks', doc.createNode(['agent-sandbox-net']));
            pair.value.set('security_opt', doc.createNode(['no-new-privileges:true']));
            pair.value.set('cap_drop', doc.createNode(['ALL']));
            pair.value.set('read_only', true);
            console.log(`  -> Applied deterministic sandbox isolation wrappers (networks, security_opt, cap_drop, read_only).`);
        }

        // 2. Network Port Tracing Audit
        const portsNode = pair.value.get('ports') as any;
        if (portsNode && Array.isArray(portsNode.items)) {
            const newPorts: string[] = [];
            for (const portItem of portsNode.items) {
                const val = portItem.value || portItem.toString();
                if (typeof val === 'string') {
                    const parts = val.split(':');
                    if (parts.length === 2) {
                        // format: "hostPort:containerPort"
                        const hostPort = parseInt(parts[0], 10);
                        if (!WHITELISTED_PORTS.has(hostPort) || isSandbox) {
                            newPorts.push(`127.0.0.1:${parts[0]}:${parts[1]}`);
                            console.log(`  -> Deterministic Port Trace: Restricted port ${hostPort} to localhost (127.0.0.1)`);
                        } else {
                            newPorts.push(val);
                        }
                    } else if (parts.length === 3) {
                        // format: "ip:hostPort:containerPort"
                        const ip = parts[0];
                        const hostPort = parseInt(parts[1], 10);
                        if ((ip === '0.0.0.0' || ip === '*' || ip === '::') && (!WHITELISTED_PORTS.has(hostPort) || isSandbox)) {
                            newPorts.push(`127.0.0.1:${parts[1]}:${parts[2]}`);
                            console.log(`  -> Deterministic Port Trace: Restructured port ${hostPort} from ${ip} to localhost (127.0.0.1)`);
                        } else {
                            newPorts.push(val);
                        }
                    } else {
                        newPorts.push(val);
                    }
                } else {
                    newPorts.push(val);
                }
            }
            pair.value.set('ports', doc.createNode(newPorts));
        }
    }

    // Ensure the agent-sandbox-net is defined in the root networks block if needed
    if (hasSandbox) {
        let networksRoot = doc.get('networks') as any;
        if (!networksRoot) {
            doc.set('networks', doc.createNode({}));
            networksRoot = doc.get('networks');
        }
        if (networksRoot && typeof networksRoot.set === 'function') {
            networksRoot.set('agent-sandbox-net', doc.createNode({
                driver: 'bridge',
                internal: true // Disables default gateway / external internet access
            }));
            console.log(`[Compose Hardener] Declared internal isolated network: agent-sandbox-net`);
        }
    }

    return String(doc);
}

