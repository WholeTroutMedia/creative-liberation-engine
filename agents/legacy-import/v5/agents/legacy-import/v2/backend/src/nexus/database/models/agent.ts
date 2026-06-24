/**
 * Agent Model
 * AI agent state and communication management
 */

import { getDatabase } from '../connection';

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'busy';
  current_task?: string;
  capabilities: string[];
  avatar: string;
  metadata: Record<string, any>;
  last_updated: Date;
}

export interface AgentMessage {
  id?: number;
  agent_id: string;
  keyholder_id: string;
  message: string;
  response?: string;
  timestamp: Date;
  processed: boolean;
}

export class AgentModel {
  static async getAll(): Promise<Agent[]> {
    const db = getDatabase();
    const results = await db.query('SELECT * FROM agents ORDER BY name');
    
    return results.map((row: any) => ({
      ...row,
      capabilities: typeof row.capabilities === 'string' 
        ? JSON.parse(row.capabilities) 
        : row.capabilities,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    }));
  }

  static async findById(id: string): Promise<Agent | null> {
    const db = getDatabase();
    const results = await db.query('SELECT * FROM agents WHERE id = ?', [id]);
    
    if (results.length === 0) return null;
    
    const row = results[0];
    return {
      ...row,
      capabilities: typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : row.capabilities,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    };
  }

  static async updateStatus(
    id: string, 
    status: 'active' | 'idle' | 'busy', 
    currentTask?: string
  ): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    await db.execute(
      `UPDATE agents 
       SET status = ?, current_task = ?, last_updated = ?
       WHERE id = ?`,
      [status, currentTask || null, now, id]
    );
  }

  static async saveMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<number> {
    const db = getDatabase();
    const timestamp = new Date().toISOString();
    
    const result = await db.execute(
      `INSERT INTO agent_messages (agent_id, keyholder_id, message, response, timestamp, processed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.agent_id,
        message.keyholder_id,
        message.message,
        message.response || null,
        timestamp,
        message.processed,
      ]
    );

    return result[0].lastInsertRowid || result[0].id;
  }

  static async getMessages(agentId: string, limit: number = 50): Promise<AgentMessage[]> {
    const db = getDatabase();
    return await db.query(
      `SELECT * FROM agent_messages 
       WHERE agent_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [agentId, limit]
    );
  }
}