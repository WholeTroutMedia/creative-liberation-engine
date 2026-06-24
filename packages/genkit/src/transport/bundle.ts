import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ── NASA BPv7 (RFC 9171) Schema Mappings ───────────────────────────────────

export const PrimaryBlockSchema = z.object({
  version: z.literal(7).default(7),
  deliveryRegistrationId: z.string().uuid().describe('Unique ID for the payload packet'),
  sourceEid: z.string().describe('Endpoint ID of the agent granting custody (e.g. hive://PRISM)'),
  destinationEid: z.string().describe('Endpoint ID of receiver (e.g. mcp://dispatch)'),
  creationTimestampMs: z.number(),
  lifetimeMs: z.number().positive().describe('Temporal TTL before bundle expires'),
  flags: z.record(z.string(), z.boolean()).default({}),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
});
export type PrimaryBlock = z.infer<typeof PrimaryBlockSchema>;

export const PayloadBlockSchema = z.object({
  type: z.enum(['code_diff', 'script_output', 'handoff_state', 'telemetry']),
  content: z.string().describe('The actual application data unit (ADU)'),
  isFragmented: z.boolean().default(false),
});
export type PayloadBlock = z.infer<typeof PayloadBlockSchema>;

export const CustodyExtensionBlockSchema = z.object({
  // The subset of the ATLAS Knowledge Graph necessary for disconnected execution
  knowledgeSubgraph: z.array(z.record(z.string(), z.unknown())).default([]),
  gitCommitHash: z.string().optional().describe('Snapshot hash for local code state'),
  sessionContext: z.record(z.string(), z.unknown()).default({}),
  witnessSignatures: z.array(z.string()).default([]).describe('Agent IDs granting Quorum Vote for Critical bundles'),
});
export type CustodyExtensionBlock = z.infer<typeof CustodyExtensionBlockSchema>;

/** 
 * BPv7 Bundle — High-rate Delay Tolerant Networking (HDTN)
 * Used for encapsulating full agent state during network partitioning.
 */
export const BPv7BundleSchema = z.object({
  primary: PrimaryBlockSchema,
  payload: PayloadBlockSchema,
  extension: CustodyExtensionBlockSchema.optional(),
});
export type BPv7Bundle = z.infer<typeof BPv7BundleSchema>;


// ── Storage Module (Local Custody Transfer) ────────────────────────────────

export class LocalBundleManager {
  private custodyDir: string;
  private p2pPeersDir: string;

  constructor(workspaceRoot: string) {
    this.custodyDir = path.join(workspaceRoot, '.agents', 'custody');
    this.p2pPeersDir = path.join(workspaceRoot, '.agents', 'custody', 'peers.json');
  }

  private async init(): Promise<void> {
    await fs.mkdir(this.custodyDir, { recursive: true });
  }

  /**
   * Target: LunaNet Peer-to-Peer Relays (Phase 9)
   * Discovers online peers via configured network paths and forwards the bundle directly
   * if the primary NAS is unreachable.
   */
  async attemptPeerRelay(bundle: BPv7Bundle): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.p2pPeersDir, 'utf-8');
      const peers: string[] = JSON.parse(raw).peers || []; // Array of Windows UNC paths or mounted network drives
      
      for (const peerPath of peers) {
        try {
          // Check if peer is reachable
          await fs.access(peerPath);
          const filename = `${bundle.primary.deliveryRegistrationId}.bpv7.json`;
          const dest = path.join(peerPath, filename);
          
          await fs.writeFile(dest, JSON.stringify(bundle, null, 2), 'utf-8');
          // Successfully relayed to a peer
          return true;
        } catch {
          // Peer offline, try next
        }
      }
    } catch {
       // local peers configuration does not exist
    }
    return false;
  }

  /**
   * Accepts custody of a bundle from an agent.
   * If the local egress router is offline, it can attempt a P2P relay.
   * Once cleanly written to disk, the agent can terminate safely,
   * knowing the egress router will deliver the packet when the network restores.
   */
  async acceptCustody(bundle: BPv7Bundle): Promise<string> {
    await this.init();
    const validated = BPv7BundleSchema.parse(bundle);
    const filename = `${validated.primary.deliveryRegistrationId}.bpv7.json`;
    const dest = path.join(this.custodyDir, filename);
    
    // Write atomically (or just straight to file for now)
    await fs.writeFile(dest, JSON.stringify(validated, null, 2), 'utf-8');

    // Phase 9: Attempt proactive LunaNet relay to a peer for redundancy
    await this.attemptPeerRelay(validated);

    return dest;
  }

  /**
   * Ingress/Egress Router scanner
   * @returns Array of absolute paths to pending bundles
   */
  async listBundles(): Promise<string[]> {
    await this.init();
    const files = await fs.readdir(this.custodyDir);
    return files
      .filter(f => f.endsWith('.bpv7.json'))
      .map(f => path.join(this.custodyDir, f));
  }

  /** Read a bundle from local custody */
  async readBundle(absolutePath: string): Promise<BPv7Bundle> {
    const raw = await fs.readFile(absolutePath, 'utf-8');
    return BPv7BundleSchema.parse(JSON.parse(raw));
  }

  /** 
   * Release custody of the bundle (Delete).
   * ONLY CALLED AFTER the Egress router receives a 200 OK from the destination EID.
   */
  async releaseCustody(absolutePath: string): Promise<void> {
    try {
      await fs.unlink(absolutePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

/** Helper to generate a compliant BPv7 bundle on the fly */
export function createBundle(input: {
  sourceEid: string;
  destinationEid: string;
  lifetimeMs?: number;
  payloadType: PayloadBlock['type'];
  payloadContent: string;
  gitCommitHash?: string;
  knowledgeSubgraph?: Record<string, unknown>[];
}): BPv7Bundle {
  return {
    primary: {
      version: 7,
      deliveryRegistrationId: randomUUID(),
      sourceEid: input.sourceEid,
      destinationEid: input.destinationEid,
      creationTimestampMs: Date.now(),
      lifetimeMs: input.lifetimeMs ?? 86400000, // 24 hours default
      flags: {},
      priority: 'normal'
    },
    payload: {
      type: input.payloadType,
      content: input.payloadContent,
      isFragmented: false
    },
    extension: {
      knowledgeSubgraph: input.knowledgeSubgraph ?? [],
      gitCommitHash: input.gitCommitHash,
      sessionContext: {},
      witnessSignatures: []
    }
  };
}
