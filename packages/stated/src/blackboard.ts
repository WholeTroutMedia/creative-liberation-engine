import * as fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface BlackboardEntry<T = any> {
  key: string;
  value: T;
  activationEnergy: number; // starts at 1.0, decays over time/turns
  decayRate: number;        // rate of decay per tick/turn
  lastAccessed: number;     // timestamp of last access
  metadata?: Record<string, any>;
}

export class Blackboard {
  private entries: Map<string, BlackboardEntry> = new Map();
  private pruneThreshold: number = 0.2;
  private archivePath: string;

  constructor() {
    this.archivePath = join(__dirname, '../../../../runtime/registry/memory_spine.archive.json');
  }

  /**
   * Writes a value to the blackboard, resetting its activation energy.
   */
  public write<T = any>(
    key: string, 
    value: T, 
    options?: { activationEnergy?: number; decayRate?: number; metadata?: Record<string, any> }
  ): void {
    const entry: BlackboardEntry<T> = {
      key,
      value,
      activationEnergy: options?.activationEnergy ?? 1.0,
      decayRate: options?.decayRate ?? 0.1,
      lastAccessed: Date.now(),
      metadata: options?.metadata
    };
    this.entries.set(key, entry);
  }

  /**
   * Reads a value from the blackboard, boosting its activation energy (reinforcement).
   */
  public read<T = any>(key: string): T | undefined {
    const entry = this.entries.get(key) as BlackboardEntry<T> | undefined;
    if (!entry) return undefined;

    // Boost energy on access (reinforce connection), capping at 1.0
    entry.activationEnergy = Math.min(1.0, entry.activationEnergy + 0.3);
    entry.lastAccessed = Date.now();
    
    return entry.value;
  }

  /**
   * Checks if a key exists on the blackboard
   */
  public has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Deletes a key directly from the blackboard
   */
  public delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Ticks the blackboard, decaying the activation energy of all entries.
   * If any entry's energy falls below pruneThreshold, it is pruned and archived.
   */
  public async decay(tickAmount?: number): Promise<{ prunedKeys: string[] }> {
    const prunedKeys: string[] = [];

    for (const [key, entry] of this.entries.entries()) {
      const decay = tickAmount ?? entry.decayRate;
      entry.activationEnergy = Math.max(0.0, entry.activationEnergy - decay);

      if (entry.activationEnergy < this.pruneThreshold) {
        await this.archiveEntry(entry);
        this.entries.delete(key);
        prunedKeys.push(key);
      }
    }

    return { prunedKeys };
  }

  /**
   * Archives an expired/decayed item to long-term memory spine.
   */
  private async archiveEntry(entry: BlackboardEntry): Promise<void> {
    try {
      let archiveData: any[] = [];
      
      // Ensure the directory exists
      const dir = join(this.archivePath, '..');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.archivePath)) {
        const raw = fs.readFileSync(this.archivePath, 'utf-8');
        try {
          archiveData = JSON.parse(raw);
          if (!Array.isArray(archiveData)) {
            archiveData = [];
          }
        } catch {
          archiveData = [];
        }
      }

      // Add to archive with timestamped metadata
      archiveData.push({
        ...entry,
        archivedAt: Date.now(),
        pruneReason: "decay_below_threshold"
      });

      fs.writeFileSync(this.archivePath, JSON.stringify(archiveData, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[BLACKBOARD ARCHIVE ERROR] Failed to archive key [${entry.key}]:`, err);
    }
  }

  /**
   * Retrieves all items currently active in working memory.
   */
  public getWorkingMemory(): Record<string, any> {
    const workingMemory: Record<string, any> = {};
    for (const [key, entry] of this.entries.entries()) {
      if (entry.activationEnergy >= this.pruneThreshold) {
        workingMemory[key] = entry.value;
      }
    }
    return workingMemory;
  }

  /**
   * Returns metadata/energy details of all current items.
   */
  public getMetrics(): Array<{ key: string; energy: number; ageMs: number }> {
    const now = Date.now();
    return Array.from(this.entries.values()).map(entry => ({
      key: entry.key,
      energy: entry.activationEnergy,
      ageMs: now - entry.lastAccessed
    }));
  }
}
