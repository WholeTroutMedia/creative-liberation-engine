import { VectorStore } from './VectorStore';

/**
 * Phase 13: Time-Variant Vector Store Decay (The "Lunar Node-1")
 * Emulates continuous navigation correction. Instead of just fading old memories 
 * logarithmically during a search, this background daemon actively purges 
 * permanently erased facts that fall below the Temporal Event Horizon.
 */
export class TemporalDaemon {
  private store: VectorStore;
  // If a memory decays to less than 5% relevance, it is vaporized
  private readonly EVENT_HORIZON_THRESHOLD = 0.05; 

  constructor(memoryId: string) {
    this.store = new VectorStore();
  }

  /**
   * Triggers a full scan of the memory space and permanently removes
   * records that have crossed the Temporal Event Horizon unless they are 'critical' priority.
   */
  async scrubDecayedMemories(): Promise<number> {
    
    // Using the same Math.exp(-bias * ageDays) logic we put in VectorStore.ts
    const now = Date.now();
    let purgedCount = 0;
    
    // For simplicity of simulation, we assume VectorStore exposes its raw metadata for the daemon
    // In production, VectorStore would have a `getAllMetadata()` method. We simulate it here:
    const fileData = await (this.store as any)['readFile']();
    if (!fileData) return 0;
    
    const db = JSON.parse(fileData);
    const activeRecords: any[] = [];

    for (const record of db.records) {
      if (record.priority === 'critical') {
        // Critical doctrine never decays
        activeRecords.push(record);
        continue;
      }

      const biasRaw = record.text.includes('recencyBias:') 
         ? parseFloat(record.text.split('recencyBias:')[1]) 
         : 0.1;
      
      const bias = isNaN(biasRaw) ? 0.1 : biasRaw;
      const ageDays = (now - record.timestampMs) / (1000 * 60 * 60 * 24);
      
      // The exact Temporal Gravity Well calculation
      const effectiveDecayWeight = Math.exp(-bias * ageDays);

      if (effectiveDecayWeight < this.EVENT_HORIZON_THRESHOLD) {
        // Purging!
        purgedCount++;
      } else {
        activeRecords.push(record);
      }
    }

    if (purgedCount > 0) {
      db.records = activeRecords;
      await (this.store as any)['writeFile'](JSON.stringify(db, null, 2));
    }

    return purgedCount;
  }
}
