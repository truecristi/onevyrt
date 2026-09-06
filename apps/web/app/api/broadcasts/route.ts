/**
 * Broadcasts API. GET lists past broadcasts; POST composes + sends one to a
 * segment's reachable contacts (owner/manager). Sending runs inline and returns
 * the completed broadcast with per-channel tallies.
 */
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { listBroadcasts, sendBroadcast, scheduleBroadcast, sendTestBroadcast, reachBreakdown, type Channel } from "../../../lib/outreach/broadcasts";
import type { Group } from "../../../lib/segments/rules";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/broadcasts:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  // ?reachable=email|sms with a rules body isn't a GET concern; GET just lists.
  return json({ broadcasts: await listBroadcasts(scope.wsId) });
});

export const POST = withRouteLogging("api/broadcasts:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  let body: { name?: unknown; channel?: unknown; subject?: unknown; body?: unknown; rules?: unknown; segmentId?: unknown; previewReach?: unknown; scheduledAt?: unknown; test?: unknown; testTo?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const channel = body.channel === "sms" ? "sms" : "email";

  // Test send — one message to the sender themselves so they can eyeball the
  // real rendering before the review step. No manage gate (it only reaches
  // the tester), no rules needed. Email defaults to the account address.
  if (body.test) {
    const to = typeof body.testTo === "string" && body.testTo.trim() ? body.testTo.trim() : (channel === "email" ? user.email : "");
    if (!to) return json({ error: "Enter a phone number to send an SMS test to." }, 400);
    try {
      const r = await sendTestBroadcast({ channel: channel as Channel, subject: typeof body.subject === "string" ? body.subject : undefined, body: typeof body.body === "string" ? body.body : "" }, to);
      return json({ ok: r.sent, to, reason: r.reason });
    } catch (e) { return json({ error: e instanceof Error ? e.message : "could not send test" }, 400); }
  }

  // Everything past here mutates a segment send — owner/manager only.
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  if (!body.rules || typeof body.rules !== "object") return json({ error: "a rules tree is required" }, 400);
  const scope = { wsId };

  // Lightweight reachable-count mode for the composer (no send). Returns the
  // full breakdown so the composer/review can show excluded + missing-channel.
  if (body.previewReach) {
    try { return json(await reachBreakdown(scope.wsId, body.rules as Group, channel as Channel)); }
    catch (e) { return json({ error: e instanceof Error ? e.message : "invalid rules" }, 400); }
  }

  const input = {
    name: typeof body.name === "string" ? body.name : "",
    channel: channel as Channel,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    body: typeof body.body === "string" ? body.body : "",
    rules: body.rules as Group,
    segmentId: typeof body.segmentId === "string" ? body.segmentId : undefined,
  };

  // With a scheduledAt, queue for later instead of sending now.
  if (typeof body.scheduledAt === "string" && body.scheduledAt.trim()) {
    const when = new Date(body.scheduledAt);
    if (Number.isNaN(when.getTime())) return json({ error: "scheduledAt is not a valid date" }, 400);
    try {
      const b = await scheduleBroadcast(scope.wsId, input, when);
      return json({ ok: true, broadcast: b, scheduled: true });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "could not schedule" }, 400);
    }
  }

  try {
    const b = await sendBroadcast(scope.wsId, input);
    return json({ ok: true, broadcast: b });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not send" }, 400);
  }
});
