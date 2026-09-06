import { currentUser } from "../../../lib/auth";
import { listNotifications, unreadCount, markRead, markAllRead } from "../../../lib/notifications";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/notifications:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const [notifications, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return json({ notifications, unread });
});

/** Body: { id: string } marks one notification read; { all: true } marks
 *  every unread notification for this user read. */
export const PATCH = withRouteLogging("api/notifications:PATCH", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => ({})) as { id?: string; all?: boolean };
  if (body.all) { await markAllRead(user.id); return json({ ok: true }); }
  if (typeof body.id === "string") { await markRead(user.id, body.id); return json({ ok: true }); }
  return json({ error: "id or all is required" }, 400);
});
