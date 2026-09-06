/**
 * Server-side persistence for the weekly momentum streak. It lives in the
 * `streak` section of the workspace_business blob (the same durable store as
 * economics / offer / aiConnection), so a founder's run survives a browser
 * clear, a new device, a container restart, and a backup restore — the old
 * localStorage-only "ov-streak" reset on any of those.
 *
 * The weekly transition math stays in lib/studio/streak.ts (scoreWeek); this
 * module only reads and writes the record, sanitizing whatever's in the blob so
 * a hand-edited or partial value can never produce a NaN or a negative streak.
 *
 * Scoring stays client-side and per-device (it builds on the per-device
 * "what moved since you last looked" baseline in weekly-moved.ts). The server
 * copy is the durable source of truth for display and hydration: a fresh device
 * or a restore adopts it, and every local advance is written back.
 */
import { getBusiness, saveBusinessSection } from "../business";
import { EMPTY_STREAK, type StreakRecord } from "./streak";

/** Coerce an untrusted blob value into a valid StreakRecord (never NaN/negative;
 *  best is always at least weeks). */
export function sanitizeStreak(raw: unknown): StreakRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const toCount = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const weeks = toCount(r.weeks);
  const best = Math.max(toCount(r.best), weeks);
  const rec: StreakRecord = { weeks, best };
  if (typeof r.lastScoredAt === "string") rec.lastScoredAt = r.lastScoredAt;
  return rec;
}

export async function getStreak(workspaceId: string): Promise<StreakRecord> {
  const biz = await getBusiness(workspaceId);
  return biz.streak == null ? { ...EMPTY_STREAK } : sanitizeStreak(biz.streak);
}

/**
 * Persist the streak. Scoring is per-device (see the module header), so two
 * devices can write in the same week; to make that safe for the one value worth
 * protecting, the stored all-time `best` is never lowered — a write can only
 * raise it. The current `weeks` and `lastScoredAt` reflect the writing device.
 */
export async function saveStreak(workspaceId: string, record: unknown): Promise<StreakRecord> {
  const incoming = sanitizeStreak(record);
  const existing = await getStreak(workspaceId);
  const merged: StreakRecord = {
    weeks: incoming.weeks,
    best: Math.max(incoming.best, existing.best),
  };
  if (incoming.lastScoredAt) merged.lastScoredAt = incoming.lastScoredAt;
  else if (existing.lastScoredAt) merged.lastScoredAt = existing.lastScoredAt;
  await saveBusinessSection(workspaceId, "streak", merged);
  return merged;
}
