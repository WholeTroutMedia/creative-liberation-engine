import 'dotenv/config';
import { resetOmnipresenceCache } from './core/context-cache.js';

// ─── CLOUDFLARE AI GATEWAY INTERCEPTOR ────────────────────────────────────────
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
            ? input.toString() 
            : (input as Request).url;
            
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
        const rewritten = url.replace(
            'https://generativelanguage.googleapis.com/',
            'https://gateway.ai.cloudflare.com/v1/8d718b480ea7c11a85e6f99bd12ad7af/cle-gateway/google-ai-studio/'
        );
        
        let bodyText: string | null = null;
        let cleanBodyText: string | null = null;
        let headers: Record<string, string> = {};
        
        // Extract headers and body from init or input Request
        if (init && init.body) {
            bodyText = typeof init.body === 'string' ? init.body : init.body.toString();
            if (init.headers) {
                headers = { ...headers, ...Object.fromEntries(new Headers(init.headers as any).entries()) };
            }
        } else if (typeof input !== 'string' && !(input instanceof URL)) {
            const req = input as Request;
            if (req.body) {
                bodyText = await req.clone().text();
            }
            req.headers.forEach((value, key) => {
                headers[key] = value;
            });
        }
        
        // Rewrite body if it has cachedContent inside generationConfig / generation_config
        if (bodyText) {
            try {
                const bodyObj = JSON.parse(bodyText);
                
                // If it has cachedContent, create a clean fallback body *without* cachedContent
                const hasCache = bodyObj.cachedContent || 
                    (bodyObj.generationConfig && bodyObj.generationConfig.cachedContent) ||
                    (bodyObj.generation_config && bodyObj.generation_config.cachedContent);
                
                if (hasCache) {
                    const cleanObj = JSON.parse(bodyText);
                    if (cleanObj.generationConfig) {
                        delete cleanObj.generationConfig.cachedContent;
                    }
                    if (cleanObj.generation_config) {
                        delete cleanObj.generation_config.cachedContent;
                    }
                    delete cleanObj.cachedContent;
                    cleanBodyText = JSON.stringify(cleanObj);
                }
                
                let modified = false;
                
                // Check generationConfig
                if (bodyObj.generationConfig && bodyObj.generationConfig.cachedContent) {
                    bodyObj.cachedContent = bodyObj.generationConfig.cachedContent;
                    delete bodyObj.generationConfig.cachedContent;
                    modified = true;
                }
                // Check generation_config
                if (bodyObj.generation_config && bodyObj.generation_config.cachedContent) {
                    bodyObj.cachedContent = bodyObj.generation_config.cachedContent;
                    delete bodyObj.generation_config.cachedContent;
                    modified = true;
                }
                
                if (modified) {
                    console.log(`[PROXY] Rewrote Gemini request payload to move cachedContent to root:\n  Cache: ${bodyObj.cachedContent}`);
                }
                
                // If cachedContent is active, we MUST NOT send systemInstruction, tools or toolConfig
                // We'll extract systemInstruction and prepend it to the first user content text part so the model still gets it
                if (bodyObj.cachedContent) {
                    let systemInstructionText = "";
                    
                    if (bodyObj.systemInstruction && bodyObj.systemInstruction.parts) {
                        for (const part of bodyObj.systemInstruction.parts) {
                            if (part.text) {
                                systemInstructionText += part.text + "\n";
                            }
                        }
                    }
                    if (bodyObj.system_instruction && bodyObj.system_instruction.parts) {
                        for (const part of bodyObj.system_instruction.parts) {
                            if (part.text) {
                                systemInstructionText += part.text + "\n";
                            }
                        }
                    }
                    
                    if (systemInstructionText && bodyObj.contents && bodyObj.contents.length > 0) {
                        const firstContent = bodyObj.contents[0];
                        if (firstContent.parts && firstContent.parts.length > 0) {
                            const firstPart = firstContent.parts[0];
                            if (typeof firstPart.text === 'string') {
                                firstPart.text = `[SYSTEM INSTRUCTION]\n${systemInstructionText.trim()}\n[END SYSTEM INSTRUCTION]\n\n${firstPart.text}`;
                                console.log(`[PROXY] Prepended system instruction to first user content part (length: ${systemInstructionText.length})`);
                            }
                        }
                    }
                    
                    // Delete forbidden fields
                    if ('systemInstruction' in bodyObj) { delete bodyObj.systemInstruction; modified = true; }
                    if ('system_instruction' in bodyObj) { delete bodyObj.system_instruction; modified = true; }
                    if ('tools' in bodyObj) { delete bodyObj.tools; modified = true; }
                    if ('toolConfig' in bodyObj) { delete bodyObj.toolConfig; modified = true; }
                    if ('tool_config' in bodyObj) { delete bodyObj.tool_config; modified = true; }
                }
                
                if (modified) {
                    bodyText = JSON.stringify(bodyObj);
                }
            } catch (err) {
                // Ignore parse errors (e.g. non-JSON or invalid JSON)
            }
        }
        
        console.log(`[PROXY] Intercepted Gemini API request:\n  Source: ${url}\n  Target: ${rewritten}`);
        
        // Construct the fetch parameters cleanly
        const fetchOptions: RequestInit = {
            ...init,
            headers: {
                ...headers,
                'content-type': 'application/json'
            }
        };
        if (bodyText) {
            fetchOptions.body = bodyText;
            fetchOptions.method = init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'POST');
        }
        
        let response = await originalFetch(rewritten, fetchOptions);
        if (!response.ok && (response.status === 403 || response.status === 404)) {
            try {
                const clone = response.clone();
                const errText = await clone.text();
                if (errText.includes('CachedContent not found') || errText.includes('permission denied')) {
                    console.warn(`[PROXY] Detected expired/deleted context cache. Resetting local cache state and retrying transparently without cache.`);
                    resetOmnipresenceCache();
                    
                    if (cleanBodyText) {
                        const retryOptions: RequestInit = {
                            ...init,
                            headers: {
                                ...headers,
                                'content-type': 'application/json'
                            },
                            body: cleanBodyText,
                            method: fetchOptions.method
                        };
                        console.log(`[PROXY] Retrying Gemini API request without cachedContent...`);
                        response = await originalFetch(rewritten, retryOptions);
                    }
                }
            } catch (err: any) {
                console.error(`[PROXY] Error during transparent retry:`, err.message);
            }
        }
        return response;
    }
    return originalFetch(input, init);
};
