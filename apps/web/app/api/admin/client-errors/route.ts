import { requireAdmin } from "../../../../lib/admin";
import { recentClientErrors } from "../../../../lib/client-errors";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/admin/client-errors:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  return json({ entries: await recentClientErrors(100) });
});
