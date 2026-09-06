/**
 * Email queue and scheduler.
 * Stores pending emails in the database and processes them with retry logic.
 */

import { randomBytes } from "node:crypto";
import { pgPool } from "../db";
import { EmailQueueItem } from "./types";

/**
 * Create the email_queue table if it doesn't exist.
 * Called by migration, not directly by application code.
 */
export async function initializeEmailQueue(): Promise<void> {
  const client = pgPool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      to_email TEXT NOT NULL,
      recipient_name TEXT,
      data JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      scheduled_for TIMESTAMP,
      retries INTEGER NOT NULL DEFAULT 0,
      last_retry_at TIMESTAMP,
      CONSTRAINT email_queue_status_check CHECK (status IN ('pending', 'sent', 'failed'))
    );
    CREATE INDEX IF NOT EXISTS email_queue_status_scheduled_idx ON email_queue(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS email_queue_created_at_idx ON email_queue(created_at DESC);
  `);
}

export interface QueueEmailInput {
  templateId: string;
  to: string;
  name?: string;
  data: Record<string, unknown>;
  scheduledFor?: Date;
}

/**
 * Queue an email for delivery.
 * If scheduledFor is not provided, the email will be processed immediately.
 */
export async function queueEmail(input: QueueEmailInput): Promise<EmailQueueItem> {
  const id = randomBytes(8).toString("hex");
  const client = pgPool();

  const result = await client.query(
    `INSERT INTO email_queue (id, template_id, to_email, recipient_name, data, scheduled_for, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries`,
    [
      id,
      input.templateId,
      input.to,
      input.name ?? null,
      JSON.stringify(input.data),
      input.scheduledFor ?? new Date(),
    ],
  );

  return rowToQueueItem(result.rows[0]);
}

/**
 * Queue multiple emails at once.
 * Useful for bulk operations like weekly digests to coaches.
 */
export async function queueEmailBatch(
  inputs: QueueEmailInput[],
): Promise<EmailQueueItem[]> {
  if (inputs.length === 0) return [];

  const client = pgPool();
  const now = new Date();
  const values = inputs
    .map(
      (input) =>
        `('${randomBytes(8).toString("hex")}', '${input.templateId}', '${input.to}', '${input.name ?? ""}', '${JSON.stringify(input.data).replace(/'/g, "''")}', ${input.scheduledFor ? `'${input.scheduledFor.toISOString()}'` : `'${now.toISOString()}'`}, now())`,
    )
    .join(", ");

  const result = await client.query(
    `INSERT INTO email_queue (id, template_id, to_email, recipient_name, data, scheduled_for, created_at)
     VALUES ${values}
     RETURNING id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries`,
  );

  return result.rows.map(rowToQueueItem);
}

/**
 * Get pending emails that are ready to send.
 * Pulls emails where scheduled_for <= now and status = 'pending'.
 */
export async function getPendingEmails(limit: number = 50): Promise<EmailQueueItem[]> {
  const client = pgPool();

  const result = await client.query(
    `SELECT id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries
     FROM email_queue
     WHERE status = 'pending' AND (scheduled_for IS NULL OR scheduled_for <= now())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map(rowToQueueItem);
}

/**
 * Mark an email as sent.
 */
export async function markEmailSent(id: string): Promise<void> {
  const client = pgPool();

  await client.query(
    `UPDATE email_queue
     SET status = 'sent', sent_at = now()
     WHERE id = $1`,
    [id],
  );
}

/**
 * Mark an email as failed with an error message and increment retry count.
 */
export async function markEmailFailed(
  id: string,
  error: string,
  maxRetries: number = 3,
): Promise<void> {
  const client = pgPool();

  await client.query(
    `UPDATE email_queue
     SET
       status = CASE WHEN retries >= $2 THEN 'failed' ELSE 'pending' END,
       error = $3,
       retries = retries + 1,
       last_retry_at = now()
     WHERE id = $1`,
    [id, maxRetries, error.slice(0, 500)],
  );
}

/**
 * Get email by ID.
 */
export async function getQueuedEmail(id: string): Promise<EmailQueueItem | null> {
  const client = pgPool();

  const result = await client.query(
    `SELECT id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries
     FROM email_queue
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ? rowToQueueItem(result.rows[0]) : null;
}

/**
 * List queued emails with optional filtering.
 */
export async function listQueuedEmails(
  status?: "pending" | "sent" | "failed",
  limit: number = 50,
  offset: number = 0,
): Promise<{ items: EmailQueueItem[]; total: number }> {
  const client = pgPool();

  const whereClause = status ? `WHERE status = '${status}'` : "";

  const [itemsResult, countResult] = await Promise.all([
    client.query(
      `SELECT id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries
       FROM email_queue
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    client.query(`SELECT count(*) as count FROM email_queue ${whereClause}`),
  ]);

  return {
    items: itemsResult.rows.map(rowToQueueItem),
    total: Number(countResult.rows[0].count),
  };
}

/**
 * Clean up old sent and failed emails (retention policy).
 * Typically called by a daily job.
 */
export async function cleanupOldEmails(retentionDays: number = 30): Promise<number> {
  const client = pgPool();

  const result = await client.query(
    `DELETE FROM email_queue
     WHERE
       (status = 'sent' OR status = 'failed')
       AND created_at < now() - interval '1 day' * $1
     RETURNING id`,
    [retentionDays],
  );

  return result.rows.length;
}

/**
 * Convert database row to EmailQueueItem.
 */
function rowToQueueItem(row: {
  id: string;
  template_id: string;
  to_email: string;
  recipient_name: string | null;
  data: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sent_at: Date | null;
  created_at: Date;
  retries: number;
}): EmailQueueItem {
  return {
    id: row.id,
    templateId: row.template_id,
    to: row.to_email,
    name: row.recipient_name ?? undefined,
    data: row.data,
    status: row.status,
    error: row.error ?? undefined,
    sentAt: row.sent_at ? row.sent_at.toISOString() : undefined,
    createdAt: row.created_at.toISOString(),
    retries: row.retries,
  };
}

/**
 * Retry failed emails that haven't exceeded max retry count.
 * Called by scheduled job.
 */
export async function retryFailedEmails(maxRetries: number = 3): Promise<EmailQueueItem[]> {
  const client = pgPool();

  const result = await client.query(
    `UPDATE email_queue
     SET status = 'pending'
     WHERE status = 'failed' AND retries < $1 AND last_retry_at < now() - interval '1 hour'
     RETURNING id, template_id, to_email, recipient_name, data, status, error, sent_at, created_at, retries`,
    [maxRetries],
  );

  return result.rows.map(rowToQueueItem);
}
