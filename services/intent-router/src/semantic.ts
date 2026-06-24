import { ChromaClient } from 'chromadb';
import { InvertedIndex } from './index-builder.js';

const chromaUrl = process.env.CHROMA_DB_URL || 'http://chromadb:8000'; // container name inside network

export class SemanticMatcher {
  client: ChromaClient | null = null;
  collection: any = null;
  initialized = false;

  constructor() {
    try {
      console.log(`[SemanticMatcher] Initializing client targeting: ${chromaUrl}`);
      this.client = new ChromaClient({ path: chromaUrl });
    } catch (err) {
      console.error('[SemanticMatcher] Failed to instantiate ChromaClient:', err);
    }
  }

  async init(index: InvertedIndex) {
    if (!this.client) return;

    try {
      console.log('[SemanticMatcher] Connecting to ChromaDB...');
      // Check connection
      await this.client.heartbeat();
      
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: 'skill_triggers',
        metadata: { 'hnsw:space': 'cosine' }
      });
      
      console.log('[SemanticMatcher] Connection established. Seeding embeddings...');
      await this.seed(index);
      this.initialized = true;
      console.log('[SemanticMatcher] Collection ready and seeded.');
    } catch (err) {
      console.error('[SemanticMatcher] Failed to connect/initialize ChromaDB:', (err as Error).message);
      console.warn('[SemanticMatcher] Semantic fallback will be disabled.');
    }
  }

  async seed(index: InvertedIndex) {
    if (!this.collection) return;

    try {
      // Clear existing records to ensure freshness
      // chromadb deletes by filter or list of ids. Let's recreate or just delete all.
      // A quick delete of all can be done by getting count and deleting if count > 0.
      const count = await this.collection.count();
      if (count > 0) {
        // Fetch all and delete
        const all = await this.collection.get();
        if (all.ids && all.ids.length > 0) {
          await this.collection.delete({ ids: all.ids });
        }
      }

      const ids: string[] = [];
      const documents: string[] = [];
      const metadatas: any[] = [];

      // 1. Embed active skills triggers & summaries
      index.skillsRaw.forEach((skill: any) => {
        if (skill.status !== 'active') return;

        // Add summary
        ids.push(`skill_summary_${skill.skillId}`);
        documents.push(skill.summary);
        metadatas.push({ type: 'skill', id: skill.skillId, domain: skill.domain, kind: 'summary' });

        // Add triggers
        if (skill.triggers) {
          skill.triggers.forEach((trigger: string, idx: number) => {
            ids.push(`skill_trigger_${skill.skillId}_${idx}`);
            documents.push(trigger);
            metadatas.push({ type: 'skill', id: skill.skillId, domain: skill.domain, kind: 'trigger' });
          });
        }
      });

      // 2. Embed active workflows triggers
      index.workflowsRaw.forEach((wf: any) => {
        if (wf.status !== 'active') return;

        // Add summary
        ids.push(`wf_summary_${wf.workflowId}`);
        documents.push(wf.summary || `Execute the ${wf.name} workflow.`);
        metadatas.push({ type: 'workflow', id: wf.workflowId, domain: wf.domain || 'general', kind: 'summary' });

        if (wf.triggers) {
          wf.triggers.forEach((trigger: string, idx: number) => {
            ids.push(`wf_trigger_${wf.workflowId}_${idx}`);
            documents.push(trigger);
            metadatas.push({ type: 'workflow', id: wf.workflowId, domain: wf.domain || 'general', kind: 'trigger' });
          });
        }
      });

      // 3. Embed report templates triggers
      index.templatesRaw.forEach((tmpl: any) => {
        // Add templates triggers
        if (tmpl.triggers) {
          tmpl.triggers.forEach((trigger: string, idx: number) => {
            ids.push(`tmpl_trigger_${tmpl.id}_${idx}`);
            documents.push(trigger);
            metadatas.push({ type: 'template', id: tmpl.id, domain: 'delivery-governance', kind: 'trigger' });
          });
        }
      });

      // Add to collection
      if (ids.length > 0) {
        await this.collection.add({
          ids,
          documents,
          metadatas
        });
        console.log(`[SemanticMatcher] Seeded ${ids.length} documents into ChromaDB.`);
      }
    } catch (err) {
      console.error('[SemanticMatcher] Seeding failed:', err);
    }
  }

  async search(queryText: string, threshold = 0.65): Promise<any[]> {
    if (!this.initialized || !this.collection) {
      return [];
    }

    try {
      // Query ChromaDB for top 5 matches
      const results = await this.collection.query({
        queryTexts: [queryText],
        nResults: 5
      });

      const matches: any[] = [];
      if (results && results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const distance = results.distances[0][i];
          const similarity = 1 - distance; // Cosine similarity is typically 1 - distance
          
          if (similarity >= threshold) {
            matches.push({
              id: results.metadatas[0][i].id,
              type: results.metadatas[0][i].type,
              domain: results.metadatas[0][i].domain,
              kind: results.metadatas[0][i].kind,
              document: results.documents[0][i],
              score: similarity
            });
          }
        }
      }
      return matches;
    } catch (err) {
      console.error('[SemanticMatcher] Query failed:', err);
      return [];
    }
  }
}
