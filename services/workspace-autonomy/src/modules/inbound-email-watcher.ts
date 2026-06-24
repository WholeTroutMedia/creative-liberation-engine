/**
 * Sovereign Inbound Email Watcher — Helix γ
 * Periodically polls the Cloudflare D1 Database for incoming emails sent to inquiries@creativeliberationengine.org.
 * Auto-parses prompts and pushes them directly into the local V6 Dispatch task queue.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface CloudflareD1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
  authEmail: string;
}

export interface InboundEmail {
  id: string;
  subject: string;
  to_addr: string;
  from_addr: string;
  created_at: number;
  body_text: string;
}

export class InboundEmailWatcher {
  private config: CloudflareD1Config;
  private dispatchUrl: string;
  private lastProcessedFile: string;

  constructor(config: CloudflareD1Config, dispatchUrl = 'http://127.0.0.1:5160') {
    this.config = config;
    this.dispatchUrl = dispatchUrl;
    this.lastProcessedFile = path.join(process.cwd(), 'runtime', 'state', 'last_email_time.json');
  }

  /**
   * Safe helper to load the last processed email timestamp
   */
  private getLastProcessedTimestamp(): number {
    try {
      if (fs.existsSync(this.lastProcessedFile)) {
        const data = JSON.parse(fs.readFileSync(this.lastProcessedFile, 'utf-8'));
        return data.timestamp || 0;
      }
    } catch (e) {
      console.warn('[Email Watcher] Error loading last processed timestamp:', e);
    }
    // Default to the last 24 hours if no state exists
    return Math.floor(Date.now() / 1000) - 86400;
  }

  /**
   * Safe helper to save the last processed email timestamp
   */
  private saveLastProcessedTimestamp(timestamp: number) {
    try {
      const stateDir = path.dirname(this.lastProcessedFile);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(this.lastProcessedFile, JSON.stringify({ timestamp }), 'utf-8');
    } catch (e) {
      console.error('[Email Watcher] Failed to save timestamp:', e);
    }
  }

  /**
   * Fetches new messages from Cloudflare D1 Database
   */
  public async fetchNewEmails(): Promise<InboundEmail[]> {
    const { accountId, databaseId, apiToken, authEmail } = this.config;
    const lastTimestamp = this.getLastProcessedTimestamp();

    console.log(`[Email Watcher] Querying Cloudflare D1 messages received after: ${new Date(lastTimestamp * 1000).toISOString()}`);

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const sql = `SELECT id, subject, to_addr, from_addr, created_at, body_text FROM messages WHERE to_addr LIKE '%inquiries@creativeliberationengine.org%' AND created_at > ${lastTimestamp} AND direction='inbound' ORDER BY created_at ASC`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Auth-Email': authEmail,
          'X-Auth-Key': apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      if (data.success && data.result && data.result[0]) {
        return data.result[0].results || [];
      }
    } catch (e) {
      console.error('[Email Watcher] Cloudflare D1 fetch error:', e);
    }

    return [];
  }

  /**
   * Submits a parsed email as a live task to CLE V6 Dispatch Server
   */
  public async submitToDispatch(email: InboundEmail): Promise<boolean> {
    console.log(`[Email Watcher] Forwarding email to dispatch: "${email.subject}"`);

    const payload = {
      title: email.subject,
      description: email.body_text || 'Empty email body.',
      source: 'inbound-email',
      priority: email.subject.toLowerCase().includes('urgent') ? 'critical' : 'high',
      metadata: {
        emailId: email.id,
        sender: email.from_addr,
        recipient: email.to_addr,
        receivedAt: new Date(email.created_at * 1000).toISOString(),
        agent: 'CORTEX'
      }
    };

    try {
      const response = await fetch(`${this.dispatchUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const resData = await response.json() as any;
        console.log(`[Email Watcher] Task created successfully! ID: ${resData.task?.id || resData.id}`);
        return true;
      } else {
        console.error(`[Email Watcher] Dispatch rejected task: ${response.status} ${response.statusText}`);
      }
    } catch (e) {
      console.error('[Email Watcher] Failed to connect to dispatch server:', e);
    }

    return false;
  }

  /**
   * Main execution loop to check and process emails
   */
  public async executeCycle(): Promise<number> {
    let processedCount = 0;
    try {
      const emails = await this.fetchNewEmails();
      if (emails.length === 0) {
        console.log('[Email Watcher] No new inbound emails detected.');
        return 0;
      }

      console.log(`[Email Watcher] Found ${emails.length} new emails. Initializing dispatch ingestion...`);

      let latestTimestamp = this.getLastProcessedTimestamp();
      for (const email of emails) {
        const success = await this.submitToDispatch(email);
        if (success) {
          processedCount++;
          if (email.created_at > latestTimestamp) {
            latestTimestamp = email.created_at;
          }
        }
      }

      if (processedCount > 0) {
        this.saveLastProcessedTimestamp(latestTimestamp);
      }
    } catch (e) {
      console.error('[Email Watcher] Error executing cycle:', e);
    }

    return processedCount;
  }
}
