import pino from 'pino';

const logger = pino({
  name: 'reasoning-core:memory-client',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

export interface CRDTDocumentResponse {
  doc_id: string;
  collection: string;
  state: Record<string, any>;
  vector_clock: Record<string, number>;
  last_sync: string;
  origin_node: string;
  conflict_count: number;
}

export class MemoryClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Default to internal Docker Compose service name, fallback to host-exposed port 3030
    this.baseUrl = baseUrl || process.env.MEMORY_SERVICE_URL || 'http://averi-memory-service:3030';
    logger.debug({ baseUrl: this.baseUrl }, 'MemoryClient initialized');
  }

  /**
   * Check if memory service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const data = await res.json() as any;
      return data.status === 'online';
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to reach memory service health check');
      return false;
    }
  }

  /**
   * Save a new reasoning trace CRDT document
   */
  async saveTraceDocument(reasoningId: string, payload: any): Promise<CRDTDocumentResponse | null> {
    try {
      const url = `${this.baseUrl}/api/documents`;
      logger.info({ reasoningId, url }, 'Saving reasoning trace to memory service');
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'reasoning_traces',
          id: reasoningId,
          initialState: payload
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error({ status: res.status, error: errorText }, 'Failed to save trace document');
        return null;
      }

      return await res.json() as CRDTDocumentResponse;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred while saving trace document');
      return null;
    }
  }

  /**
   * Get a reasoning trace document from memory service
   */
  async getTraceDocument(reasoningId: string): Promise<CRDTDocumentResponse | null> {
    try {
      const url = `${this.baseUrl}/api/documents/${reasoningId}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          logger.warn({ reasoningId }, 'Trace document not found in memory service');
        } else {
          logger.error({ status: res.status }, 'Failed to fetch trace document');
        }
        return null;
      }
      return await res.json() as CRDTDocumentResponse;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred while fetching trace document');
      return null;
    }
  }

  /**
   * Update a field in a reasoning trace CRDT document (e.g. status, output, steps)
   */
  async updateTraceField(reasoningId: string, key: string, value: any): Promise<CRDTDocumentResponse | null> {
    try {
      const url = `${this.baseUrl}/api/documents/${reasoningId}/fields`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });

      if (!res.ok) {
        logger.error({ status: res.status }, 'Failed to update trace field');
        return null;
      }
      return await res.json() as CRDTDocumentResponse;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred while updating trace field');
      return null;
    }
  }

  /**
   * Initialize a vector index for reasoning traces in Qdrant spine
   */
  async initializeVectorIndex(vectorSize = 1536): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/vectors/indexes`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'reasoning_traces',
          vectorSize
        })
      });
      if (!res.ok) return false;
      const data = await res.json() as any;
      return !!data.success;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred while initializing vector index');
      return false;
    }
  }

  /**
   * Index a reasoning trace vector for semantic search
   */
  async indexTraceVector(vectorId: string, docId: string, vector: number[], payload: any = {}): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/vectors/insert`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectorId,
          docId,
          collection: 'reasoning_traces',
          vector,
          payload
        })
      });
      if (!res.ok) return false;
      const data = await res.json() as any;
      return !!data.success;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred while inserting vector');
      return false;
    }
  }

  /**
   * Search past reasoning traces semantically
   */
  async searchTraceVectors(queryVector: number[], limit = 5): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/api/vectors/search`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'reasoning_traces',
          queryVector,
          limit
        })
      });
      if (!res.ok) return [];
      const data = await res.json() as any;
      return data.results || [];
    } catch (err: any) {
      logger.error({ err: err.message }, 'Exception occurred during vector search');
      return [];
    }
  }
}
