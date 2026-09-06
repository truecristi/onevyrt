import { currentUser } from "../../../../lib/auth";
import { roleOf } from "../../../../lib/workspaces";
import { setAccessGranted } from "../../../../lib/enrollments";
import { recordActivity } from "../../../../lib/activity";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Manual pause/resume of a workspace's programme access — no billing
 *  integration behind it (see programme-offers.ts's header on why). Owner
 *  or manager, same bar as reviewing submissions: this is a coaching
 *  action, not something that needs the stricter manager-only bar
 *  coach-notes uses (a workspace's own owner is allowed to know, and act
 *  on, their own access state — it just isn't "private" the way notes are). */
export const POST = withRouteLogging("api/programme/access:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => null) as { ws?: string; granted?: boolean } | null;
  if (!body?.ws || typeof body.granted !== "boolean") return json({ error: "ws and granted are required" }, 400);
  const role = await roleOf(body.ws, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "Only the workspace owner or a coach can change access." }, 403);
  await setAccessGranted(body.ws, body.granted);
  await recordActivity(body.ws, { actorEmail: user.email, action: body.granted ? "programme.access_resumed" : "programme.access_paused", detail: "" });
  return json({ ok: true });
});
