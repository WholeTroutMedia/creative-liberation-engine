// Creative Liberation Engine — mTLS Client Factory (WS-01)
// Shared utility for services to make authenticated requests to the dispatch mesh.
// Usage: import { createMeshClient } from './mtls-client.js';
//        const client = createMeshClient('genkit');
//        const res = await client.fetch('http://cle-v6-dispatch-1:5150/api/status');

import fs from 'fs';
import path from 'path';
import https from 'https';

export interface MeshClientOptions {
    /** Agent name (lowercase, matches PKI cert directory name) */
    agentName: string;
    /** Override base path for PKI certs. Default searches standard paths. */
    pkiBasePath?: string;
}

/**
 * Create an HTTPS agent pre-configured with the agent's client cert + key
 * for mTLS communication with other mesh services.
 */
export function createMtlsAgent(agentName: string, pkiBasePath?: string): https.Agent | null {
    const basePaths = pkiBasePath
        ? [pkiBasePath]
        : [
            `/opt/cle/pki`,
            `/pki`,
            path.resolve(process.cwd(), 'tools/pki'),
        ];

    let key: string | undefined;
    let cert: string | undefined;
    let ca: string | undefined;

    for (const base of basePaths) {
        try {
            key = fs.readFileSync(path.join(base, `agents/${agentName}/${agentName}.key`), 'utf-8');
            cert = fs.readFileSync(path.join(base, `agents/${agentName}/${agentName}.crt`), 'utf-8');
            ca = fs.readFileSync(path.join(base, 'ca/cle-ca.crt'), 'utf-8');
            break;
        } catch {
            // Try next path
        }
    }

    if (!key || !cert) {
        console.warn(`[mtls-client] No PKI certs found for agent "${agentName}" — falling back to plain HTTP`);
        return null;
    }

    console.log(`[mtls-client] mTLS agent configured for "${agentName}"`);
    return new https.Agent({
        key,
        cert,
        ca,
        rejectUnauthorized: true,   // Enforce CA chain validation
    });
}

/**
 * Create a mesh-authenticated fetch wrapper.
 * In mTLS mode, uses the agent's client cert.
 * Falls back to header-based fingerprint auth for HTTP-only environments.
 */
export function createMeshClient(agentName: string, pkiBasePath?: string) {
    const agent = createMtlsAgent(agentName, pkiBasePath);

    // Load fingerprint for header-based fallback
    let fingerprint: string | null = null;
    const indexPaths = [
        `/opt/cle/pki/identity-index.json`,
        `/pki/identity-index.json`,
        path.resolve(process.cwd(), 'tools/pki/identity-index.json'),
    ];
    for (const p of indexPaths) {
        try {
            const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
            const entry = idx[agentName.toUpperCase()];
            if (entry) {
                fingerprint = entry.fingerprint;
                break;
            }
        } catch {
            // Try next
        }
    }

    return {
        /**
         * Make an authenticated fetch to a mesh service.
         * Automatically attaches mTLS cert (HTTPS) or fingerprint header (HTTP).
         */
        async fetch(url: string, init?: RequestInit): Promise<Response> {
            const headers = new Headers(init?.headers);

            // If HTTP (no TLS), attach fingerprint header for middleware auth
            if (url.startsWith('http://') && fingerprint) {
                headers.set('X-Client-Cert-Fingerprint', fingerprint);
                headers.set('X-Client-Cert-CN', `${agentName}.agent.cle.local`);
            }

            const fetchOpts: any = {
                ...init,
                headers,
            };

            // For HTTPS requests with mTLS agent
            if (url.startsWith('https://') && agent) {
                fetchOpts.agent = agent;
            }

            return fetch(url, fetchOpts);
        },

        /** The underlying HTTPS agent (null if no certs found) */
        httpsAgent: agent,

        /** The agent's fingerprint from the identity index */
        fingerprint,

        /** The agent name */
        agentName,
    };
}
