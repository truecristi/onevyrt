import { pgPool } from "./db";

/**
 * Instance-level settings. Not per-funnel and not per-workspace: these describe
 * how this deployment is reached from the outside world. Postgres-backed
 * (see lib/db.ts) — a true singleton, one fixed row (id = true, enforced by
 * a CHECK constraint), unlike every other domain in this app.
 */
export interface Settings {
  /**
   * The origin real funnel pages should send tracking to, e.g.
   * "https://track.yourdomain.com". Empty means "use whatever origin the studio
   * was loaded from", which is fine on a LAN and useless in public: a snippet
   * pasted on a live page cannot reach http://192.168.0.22:3014.
   */
  publicOrigin: string;
}

const DEFAULTS: Settings = { publicOrigin: "" };

/**
 * Accepts an absolute http(s) origin with no path, query or fragment.
 * Returns the normalised origin, or null if it isn't usable.
 */
export function normalizeOrigin(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.pathname !== "/" || u.search || u.hash) return null;
  return u.origin; // drops the trailing slash, lowercases the host
}

export async function readSettings(): Promise<Settings> {
  const res = await pgPool().query<{ public_origin: string }>("SELECT public_origin FROM instance_settings WHERE id = true");
  return { publicOrigin: res.rows[0]?.public_origin ?? DEFAULTS.publicOrigin };
}

export async function writeSettings(next: Partial<Settings>): Promise<Settings> {
  const cur = await readSettings();
  const merged: Settings = { ...cur, ...next };
  if (next.publicOrigin !== undefined) {
    const norm = normalizeOrigin(next.publicOrigin);
    if (norm === null) throw new Error("Public origin must be a full http(s) URL with no path, e.g. https://track.example.com");
    merged.publicOrigin = norm;
  }
  await pgPool().query(
    `INSERT INTO instance_settings (id, public_origin) VALUES (true, $1)
     ON CONFLICT (id) DO UPDATE SET public_origin = EXCLUDED.public_origin`,
    [merged.publicOrigin],
  );
  return merged;
}
