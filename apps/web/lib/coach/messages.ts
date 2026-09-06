/**
 * In-app learner messages — the on-platform half of the engagement console's
 * "Reach out". A coach/mentor/admin nudge is sent two ways: an email (reaches a
 * learner who isn't logging in) and a row here (what they see when they return).
 * Scoped to the learner's workspace; any member of that workspace can read them.
 * Postgres-backed (see migrations/1787000000000_create-learner-messages.js).
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "../db";

export interface LearnerMessage {
  id: string;
  at: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
  read: boolean;
}

export interface NewLearnerMessage {
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
}

/** Record an in-app message for a learner's workspace. */
export async function sendLearnerMessage(wsId: string, m: NewLearnerMessage): Promise<void> {
  await pgPool().query(
    `INSERT INTO learner_messages (id, ws_id, from_email, from_name, subject, body) VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomBytes(8).toString("hex"), wsId, m.fromEmail, m.fromName ?? null, m.subject ?? null, m.body],
  );
}

/** Most recent first, capped. `unreadOnly` drives the learner's unread banner. */
export async function listLearnerMessages(wsId: string, opts: { unreadOnly?: boolean } = {}): Promise<LearnerMessage[]> {
  const res = await pgPool().query(
    `SELECT id, created_at, from_email, from_name, subject, body, read_at FROM learner_messages
     WHERE ws_id = $1 ${opts.unreadOnly ? "AND read_at IS NULL" : ""} ORDER BY created_at DESC LIMIT 50`,
    [wsId],
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    at: (r.created_at as Date).toISOString(),
    fromEmail: r.from_email as string,
    ...(r.from_name ? { fromName: r.from_name as string } : {}),
    ...(r.subject ? { subject: r.subject as string } : {}),
    body: r.body as string,
    read: r.read_at !== null,
  }));
}

/** Mark all of a workspace's unread messages as read (called when the learner
 *  opens/dismisses the banner). */
export async function markLearnerMessagesRead(wsId: string): Promise<void> {
  await pgPool().query(`UPDATE learner_messages SET read_at = now() WHERE ws_id = $1 AND read_at IS NULL`, [wsId]);
}
