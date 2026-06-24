import { z } from 'genkit';
import Redis from 'ioredis';

// Working Memory TTL: Default to 24 hours (86400 seconds)
const TTL_SECONDS = 86400;

class WorkingMemoryClient {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
    }

    /**
     * Set a transient state value bound to a specId envelope
     */
    async set(specId: string, key: string, value: any): Promise<void> {
        const memoryKey = `working_mem:${specId}:${key}`;
        const stringified = JSON.stringify(value);
        await this.redis.set(memoryKey, stringified, 'EX', TTL_SECONDS);
    }

    /**
     * Retrieve a transient state value bound to a specId
     */
    async get<T>(specId: string, key: string): Promise<T | null> {
        const memoryKey = `working_mem:${specId}:${key}`;
        const data = await this.redis.get(memoryKey);
        if (!data) return null;
        try {
            return JSON.parse(data) as T;
        } catch {
            return data as any;
        }
    }

    /**
     * Read all expected memory_writes for a specId (e.g. for inspection before promotion)
     */
    async getBatch(specId: string, keys: string[]): Promise<Record<string, any>> {
        const result: Record<string, any> = {};
        for (const key of keys) {
            result[key] = await this.get(specId, key);
        }
        return result;
    }
}

export const WorkingMemory = new WorkingMemoryClient();
