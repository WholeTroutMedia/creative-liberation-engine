import { Redis } from 'ioredis';

// Singleton connection to maintain Redis adjacency matrix
let redisClient: Redis | null = null;

function getRedis(): Redis {
    if (!redisClient) {
        redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        redisClient.on('error', (err) => console.error('[AgenticGraph] Redis Error', err));
    }
    return redisClient;
}

export interface EdgeData {
    score: number;
}

export class AgenticSocialGraph {
    
    /**
     * Record an interaction between an agent and the core system or another agent.
     * Stored as a Redis Hash: AGENTIC_GRAPH:{fromAgent} -> {toAgent} = score
     */
    async recordInteraction(fromAgent: string, toAgent: string, increment: number = 1): Promise<void> {
        try {
            const redis = getRedis();
            const key = `AGENTIC_GRAPH:${fromAgent}`;
            await redis.hincrbyfloat(key, toAgent, increment);
        } catch (err) {
            console.warn('[AgenticGraph] Failed to record interaction:', err);
        }
    }

    /**
     * Fetch the topological map of all agent interactions
     */
    async getTopology(): Promise<Record<string, Record<string, number>>> {
        try {
            const redis = getRedis();
            const keys = await redis.keys('AGENTIC_GRAPH:*');
            const topology: Record<string, Record<string, number>> = {};
            
            for (const key of keys) {
                const agent = key.split(':')[1];
                const hash = await redis.hgetall(key);
                
                // Convert string values to floats
                const edges: Record<string, number> = {};
                for (const [node, scoreStr] of Object.entries(hash)) {
                    edges[node] = parseFloat(scoreStr);
                }
                
                topology[agent] = edges;
            }
            return topology;
        } catch (err) {
            console.error('[AgenticGraph] Failed to fetch topology:', err);
            return {};
        }
    }
    
    /**
     * Called during REM sleep to decay all edges slightly (forgetting curve)
     */
    async remDecayEdges(decayFactor: number = 0.95): Promise<void> {
        try {
            const redis = getRedis();
            const keys = await redis.keys('AGENTIC_GRAPH:*');
            for (const key of keys) {
                const edges = await redis.hgetall(key);
                for (const [node, scoreStr] of Object.entries(edges)) {
                    const decayed = parseFloat(scoreStr) * decayFactor;
                    if (decayed < 0.05) {
                        await redis.hdel(key, node); // Delete irrelevant edges
                    } else {
                        await redis.hset(key, node, decayed.toString());
                    }
                }
            }
        } catch (err) {
            console.warn('[AgenticGraph] Failed to decay edges:', err);
        }
    }
}

export const agenticSocialGraph = new AgenticSocialGraph();
