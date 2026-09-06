import { requireAdmin } from "../../../../lib/admin";
import { readSettings, writeSettings } from "../../../../lib/settings";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/admin/settings:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  return json(await readSettings());
});

export const POST = withRouteLogging("api/admin/settings:POST", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  let body: { publicOrigin?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.publicOrigin !== "string") return json({ error: "publicOrigin is required" }, 400);
  try {
    const updated = await writeSettings({ publicOrigin: body.publicOrigin });
    await recordAudit({ actorEmail: admin.email, action: "settings.update", targetType: "settings", detail: `publicOrigin=${updated.publicOrigin}` });
    return json(updated);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not save settings." }, 400);
  }
});
