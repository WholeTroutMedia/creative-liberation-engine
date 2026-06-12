import sqlite3 from "sqlite3";
import { promisify } from "util";

export interface MemoryNode {
  id?: number;
  vectorId: string;
  payload: string;
  metadata: string;
  timestamp: string;
}

export class MemorySpine {
  private db: sqlite3.Database;
  private runAsync: any;
  private allAsync: any;

  constructor(dbPath: string = ":memory:") {
    this.db = new sqlite3.Database(dbPath);
    this.runAsync = promisify(this.db.run.bind(this.db));
    this.allAsync = promisify(this.db.all.bind(this.db));
    this.initializeSchema();
  }

  private async initializeSchema() {
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS memory_spine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vector_id TEXT UNIQUE,
        payload TEXT,
        metadata TEXT,
        timestamp TEXT
      )
    `);
    console.log("[memd] Local Memory SQLite Spine initialized successfully.");
  }

  // Insert a new semantic memory node
  public async storeMemory(vectorId: string, payload: string, metadata: any = {}): Promise<boolean> {
    try {
      await this.runAsync(
        `INSERT OR REPLACE INTO memory_spine (vector_id, payload, metadata, timestamp) VALUES (?, ?, ?, ?)`,
        [vectorId, payload, JSON.stringify(metadata), new Date().toISOString()]
      );
      console.log(`[memd] Stored semantic memory node: [${vectorId}]`);
      return true;
    } catch (error) {
      console.error("[memd] Failed to store memory node:", error);
      return false;
    }
  }

  // Search memories based on metadata keyword queries (offline cosine-similarity surrogate)
  public async queryMemories(keyword: string): Promise<MemoryNode[]> {
    try {
      const rows = await this.allAsync(
        `SELECT * FROM memory_spine WHERE payload LIKE ? OR metadata LIKE ? ORDER BY timestamp DESC`,
        [`%${keyword}%`, `%${keyword}%`]
      );
      return rows.map((r: any) => ({
        id: r.id,
        vectorId: r.vector_id,
        payload: r.payload,
        metadata: r.metadata,
        timestamp: r.timestamp
      }));
    } catch (error) {
      console.error("[memd] Failed to query memories:", error);
      return [];
    }
  }
}

console.log("[memd] UNIX Vector Memory Spine Daemon compiled and active.");
export const memd = new MemorySpine();
