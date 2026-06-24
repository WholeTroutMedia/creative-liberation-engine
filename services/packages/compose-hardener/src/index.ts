import { GoogleGenAI } from '@google/genai';
import { parseDocument, Document } from 'yaml';
import { ServicePatchSchema, ServicePatchData } from './schema-types.js';

const ai = new GoogleGenAI({});

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

    for (const pair of servicesNode.items) {
        const serviceName = pair.key.value;
        const serviceDefinition = pair.value.toJSON();
        
        console.log(`[Compose Hardener] Evaluating service: ${serviceName}`);

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
          "secretsReplaced": { "DB_PASS": "${DB_PASS}" }
        }
        If a field is not applicable, omit it.

        try {
            console.log(`[Compose Hardener] Triggering Gemini invocation for ${serviceName}...`);
            const result = await ai.models.generateContent({
                model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
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
                    } else if (envNode && Array.isArray(envNode.items)) {
                         // Array of strings 'KEY=VALUE' format not fully handled in this basic AST replacer,
                         // assuming map format for now since we use map format in NAS.
                    }
                }
            }
        } catch (e: any) {
            console.error(`[Compose Hardener] Failed to optimize service ${serviceName}:`, e.message);
            throw e;
        }
    }

    return String(doc);
}
