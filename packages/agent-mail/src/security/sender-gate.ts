/**
 * CLE Agent Mail — Sender Approval Gate
 *
 * Anti-prompt-injection defense. All inbound email is unapproved by default.
 * Agents only see metadata for pending messages. Body is invisible until
 * the operator explicitly approves the sender.
 */

import type { Env, ApprovedSenderRow, MessageRow } from '../types';

/**
 * Check if a sender is approved.
 */
export async function isSenderApproved(db: D1Database, email: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT email FROM approved_senders WHERE email = ?'
  ).bind(email.toLowerCase()).first<ApprovedSenderRow>();
  return row !== null;
}

/**
 * Approve a sender. Retroactively approves all their existing messages.
 */
export async function approveSender(
  db: D1Database,
  email: string,
  name?: string,
  approvedBy = 'operator',
): Promise<{ approvedCount: number }> {
  const normalizedEmail = email.toLowerCase();

  // Upsert approved sender
  await db.prepare(
    `INSERT INTO approved_senders (email, name, approved_by)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, approved_by = excluded.approved_by`
  ).bind(normalizedEmail, name ?? '', approvedBy).run();

  // Retroactively approve all messages from this sender
  const result = await db.prepare(
    'UPDATE messages SET approved = 1 WHERE LOWER(from_addr) = ? AND approved = 0'
  ).bind(normalizedEmail).run();

  return { approvedCount: result.meta.changes ?? 0 };
}

/**
 * Remove a sender from the approved list. Does NOT unapprove existing messages.
 */
export async function removeSender(db: D1Database, email: string): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM approved_senders WHERE email = ?'
  ).bind(email.toLowerCase()).run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * List all approved senders.
 */
export async function listApprovedSenders(db: D1Database): Promise<ApprovedSenderRow[]> {
  const { results } = await db.prepare(
    'SELECT * FROM approved_senders ORDER BY approved_at DESC'
  ).all<ApprovedSenderRow>();
  return results;
}

/**
 * List pending (unapproved) messages — metadata only, NO body content.
 * This prevents prompt injection even during the review process.
 */
export async function listPending(
  db: D1Database,
  limit = 50,
): Promise<Array<Pick<MessageRow, 'id' | 'from_addr' | 'subject' | 'created_at'>>> {
  const { results } = await db.prepare(
    `SELECT id, from_addr, subject, created_at
     FROM messages
     WHERE direction = 'inbound' AND approved = 0
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all<Pick<MessageRow, 'id' | 'from_addr' | 'subject' | 'created_at'>>();
  return results;
}
