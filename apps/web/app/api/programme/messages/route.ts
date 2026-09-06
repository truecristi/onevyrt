/**
 * Learner-facing in-app messages (the receiving end of /api/coach/reach-out).
 *  GET  ?ws=<id>[&unread=1] → messages for that workspace (any member may read)
 *  POST { ws }             → mark that workspace's messages read
 * Scoped to workspace membership — a learner reads their own workspace's coach
 * nudges; a coach who is a member can read the thread too.
 */
import { currentUser } from "../../../../lib/auth";
import { roleOf, ensurePersonalWorkspace } from "../../../../lib/workspaces";
import { listLearnerMessages, markLearnerMessagesRead } from "../../../../lib/coach/messages";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/programme/messages:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const url = new URL(req.url);
  const wsId = url.searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const messages = await listLearnerMessages(wsId, { unreadOnly });
  return json({ messages });
});

export const POST = withRouteLogging("api/programme/messages:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  let body: { ws?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  await markLearnerMessagesRead(wsId);
  return json({ ok: true });
});
