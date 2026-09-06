import crypto from "node:crypto";
import { pgPool } from "./db";

/** A single comment on a project. Stored per (scope, project). Postgres-backed (see lib/db.ts). */
export interface Comment {
  id: string;
  userId: string;
  email: string;
  text: string;
  createdAt: string;
}

const MAX_TEXT = 4000;
const MAX_PER_PROJECT = 500;

/** Oldest first, so the panel reads like a conversation. */
export async function listComments(scopeKey: string, projectId: string): Promise<Comment[]> {
  const res = await pgPool().query<{ id: string; user_id: string; email: string; text: string; created_at: Date }>(
    // Take the 500 most recent, then present oldest-first. Caps the payload
    // for a runaway thread while still showing the latest conversation.
    `SELECT id, user_id, email, text, created_at FROM (
       SELECT id, user_id, email, text, created_at FROM comments
       WHERE scope_key = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT 500
     ) recent ORDER BY created_at ASC`,
    [scopeKey, projectId],
  );
  return res.rows.map((r) => ({ id: r.id, userId: r.user_id, email: r.email, text: r.text, createdAt: r.created_at.toISOString() }));
}

export async function addComment(
  scopeKey: string,
  projectId: string,
  userId: string,
  email: string,
  text: string,
): Promise<Comment | null> {
  const clean = text.trim();
  if (!clean) return null;
  const c: Comment = {
    id: crypto.randomBytes(8).toString("hex"),
    userId,
    email,
    text: clean.slice(0, MAX_TEXT),
    createdAt: new Date().toISOString(),
  };
  const pool = pgPool();
  await pool.query(
    "INSERT INTO comments (id, scope_key, project_id, user_id, email, text, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [c.id, scopeKey, projectId, c.userId, c.email, c.text, c.createdAt],
  );
  // keep the newest MAX_PER_PROJECT so a busy project cannot grow without bound
  await pool.query(
    `DELETE FROM comments WHERE scope_key = $1 AND project_id = $2
     AND id NOT IN (SELECT id FROM comments WHERE scope_key = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT $3)`,
    [scopeKey, projectId, MAX_PER_PROJECT],
  );
  return c;
}

/** Only the author may delete their own comment. Returns true if something was removed. */
export async function deleteComment(
  scopeKey: string,
  projectId: string,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const res = await pgPool().query(
    "DELETE FROM comments WHERE id = $1 AND user_id = $2 AND scope_key = $3 AND project_id = $4",
    [commentId, userId, scopeKey, projectId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Extract @mentions so the UI can highlight them. */
export function mentionsIn(text: string): string[] {
  const out = new Set<string>();
  const re = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]!.toLowerCase());
  return [...out];
}
