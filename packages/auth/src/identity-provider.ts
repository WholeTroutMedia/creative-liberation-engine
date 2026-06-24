import { generateKeyPairSync, createSign, createVerify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class AgentIdP {
    private keysDir: string;

    constructor() {
        this.keysDir = process.env.AGENT_KEYS_DIR || '/app/creative-liberation-engine/runtime/security/keys';
        if (!fs.existsSync(this.keysDir)) {
            try {
                fs.mkdirSync(this.keysDir, { recursive: true });
            } catch (err: any) {
                // Fallback to local process dir if NAS keys dir is unavailable
                this.keysDir = path.resolve(process.cwd(), 'runtime/security/keys');
                fs.mkdirSync(this.keysDir, { recursive: true });
            }
        }
    }

    /**
     * Get or generate a persistent cryptographic keypair for an agent.
     */
    private getAgentKeypair(agentId: string) {
        const privateKeyPath = path.join(this.keysDir, `${agentId.toLowerCase()}.private.pem`);
        const publicKeyPath = path.join(this.keysDir, `${agentId.toLowerCase()}.public.pem`);

        if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
            const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
            const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
            return { privateKey, publicKey };
        }

        // Generate RSA-2048 keypair
        const { privateKey, publicKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
        fs.writeFileSync(publicKeyPath, publicKey, 'utf8');
        console.log(`[AgentIdP] Generated new cryptographic keypair for agent: ${agentId}`);

        return { privateKey, publicKey };
    }

    /**
     * Sign data using an agent's private key.
     */
    sign(agentId: string, data: string): string {
        const { privateKey } = this.getAgentKeypair(agentId);
        const sign = createSign('SHA256');
        sign.update(data);
        sign.end();
        return sign.sign(privateKey, 'base64');
    }

    /**
     * Verify a signature using an agent's public key.
     */
    verify(agentId: string, data: string, signature: string): boolean {
        try {
            const { publicKey } = this.getAgentKeypair(agentId);
            const verify = createVerify('SHA256');
            verify.update(data);
            verify.end();
            return verify.verify(publicKey, signature, 'base64');
        } catch {
            return false;
        }
    }

    /**
     * Get the public key for an agent to expose in git signatures or verification portals.
     */
    getPublicKey(agentId: string): string {
        return this.getAgentKeypair(agentId).publicKey;
    }
}

export const agentIdP = new AgentIdP();
