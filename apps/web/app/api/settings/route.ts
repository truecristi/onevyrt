import { readSettings, writeSettings } from "../../../lib/settings";
import { currentUser } from "../../../lib/auth";
import { requireAdmin } from "../../../lib/admin";
import { recordAudit } from "../../../lib/audit-log";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Any signed-in user can read how this instance is reached. */
export const GET = withRouteLogging("api/settings:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  return json(await readSettings());
});

/**
 * publicOrigin is instance-global config that trusted flows depend on — the
 * password-reset and change-email emails build their links from it — so ONLY an
 * instance admin may write it. A non-admin (even signed-in) getting to set it
 * could point reset links at an attacker origin and harvest other users' tokens.
 * Mirrors POST /api/admin/settings (same writeSettings, same admin gate + audit).
 */
export const PUT = withRouteLogging("api/settings:PUT", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  let body: { publicOrigin?: unknown };
  try {
    body = (await req.json()) as { publicOrigin?: unknown };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (typeof body.publicOrigin !== "string") return json({ error: "publicOrigin must be a string" }, 400);
  try {
    const updated = await writeSettings({ publicOrigin: body.publicOrigin });
    await recordAudit({ actorEmail: admin.email, action: "settings.update", targetType: "settings", detail: `publicOrigin=${updated.publicOrigin}` });
    return json(updated);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "invalid settings" }, 400);
  }
});
