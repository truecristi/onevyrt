/**
 * Workspace-scoped bearer keys for the read-only public API (see
 * app/api/v1/*) — the "integration framework" gap: previously a user's own
 * data was reachable only via the browser session cookie, with no way for
 * an external tool to pull it programmatically. Modeled on lib/auth.ts's
 * password hashing: only a salted hash of the key is ever stored, the raw
 * value is returned once at creation and is not recoverable afterward.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { pgPool } from "./db";

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  revoked?: boolean;
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Mints a new key for a workspace. Returns the summary plus the raw key —
 *  the only time the raw value is ever available. */
export async function createApiKey(workspaceId: string, userId: string, name: string): Promise<ApiKeySummary & { key: string }> {
  const raw = `ovk_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12);
  const id = `key_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const createdAt = new Date().toISOString();
  await pgPool().query(
    "INSERT INTO api_keys (id, workspace_id, user_id, name, prefix, key_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [id, workspaceId, userId, name.trim() || "Untitled key", prefix, hashKey(raw), createdAt],
  );
  return { id, name: name.trim() || "Untitled key", prefix, createdAt, key: raw };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeySummary[]> {
  const res = await pgPool().query<{ id: string; name: string; prefix: string; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }>(
    "SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC",
    [workspaceId],
  );
  return res.rows.map((r) => ({
    id: r.id, name: r.name, prefix: r.prefix, createdAt: r.created_at.toISOString(),
    ...(r.last_used_at ? { lastUsedAt: r.last_used_at.toISOString() } : {}),
    ...(r.revoked_at ? { revoked: true } : {}),
  }));
}

/** Revokes a key — scoped to workspaceId so one workspace can't revoke another's key by guessing an id. */
export async function revokeApiKey(workspaceId: string, id: string): Promise<void> {
  await pgPool().query("UPDATE api_keys SET revoked_at = $1 WHERE id = $2 AND workspace_id = $3 AND revoked_at IS NULL", [new Date().toISOString(), id, workspaceId]);
}

/** Verifies a raw bearer key and returns its scope, or null if unknown/revoked.
 *  Looks up candidates by prefix (indexed, narrows to effectively one row) then
 *  does a timing-safe hash comparison rather than an indexed exact-hash lookup,
 *  so a successful match never depends on how much of the hash matched. */
export async function resolveApiKeyScope(req: Request): Promise<{ wsId: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;
  const scope = await verifyApiKey(raw);
  return scope ? { wsId: scope.workspaceId } : null;
}

export async function verifyApiKey(raw: string): Promise<{ workspaceId: string; userId: string; keyId: string } | null> {
  if (!raw.startsWith("ovk_")) return null;
  const prefix = raw.slice(0, 12);
  const pool = pgPool();
  const res = await pool.query<{ id: string; workspace_id: string; user_id: string; key_hash: string; revoked_at: Date | null }>(
    "SELECT id, workspace_id, user_id, key_hash, revoked_at FROM api_keys WHERE prefix = $1", [prefix],
  );
  const wantHash = Buffer.from(hashKey(raw));
  for (const row of res.rows) {
    if (row.revoked_at) continue;
    const gotHash = Buffer.from(row.key_hash);
    if (gotHash.length === wantHash.length && timingSafeEqual(gotHash, wantHash)) {
      void pool.query("UPDATE api_keys SET last_used_at = $1 WHERE id = $2", [new Date().toISOString(), row.id]);
      return { workspaceId: row.workspace_id, userId: row.user_id, keyId: row.id };
    }
  }
  return null;
}
