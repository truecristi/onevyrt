import { requireAdmin } from "../../../../lib/admin";
import { clearLoginFailures } from "../../../../lib/auth";
import { loginLockouts } from "../../../../lib/admin-stats";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/admin/lockouts:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  return json({ lockouts: await loginLockouts() });
});

// Clears the failed-attempt counter / lockout for one email — the admin
// counterpart to a user waiting out the lockout window. Reversible by nature:
// it only removes a throttle, never grants access.
export const POST = withRouteLogging("api/admin/lockouts:POST", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  let body: { email?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.email !== "string" || !body.email.trim()) return json({ error: "email is required" }, 400);
  await clearLoginFailures(body.email);
  await recordAudit({ actorEmail: admin.email, action: "login.unlock", targetType: "user", targetLabel: body.email });
  return json({ ok: true, lockouts: await loginLockouts() });
});
