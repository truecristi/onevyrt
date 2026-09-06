import { currentUser } from "../../../../lib/auth";
import { roleOf } from "../../../../lib/workspaces";
import { setCoachNotes } from "../../../../lib/enrollments";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Coach-only private notes. Keyed by coach (user.id) not workspace, since
// this is the coach's personal working memory across clients.
const NOTES_LIMIT = { windowMs: 60_000, max: 30 };

/** A coach's private note about a client — gated to role === "manager"
 *  specifically (not owner/manager, the usual "coach" shorthand elsewhere
 *  in this app): the workspace owner IS the client, and must never be able
 *  to write or read a note that's supposed to be private from them. */
export const POST = withRouteLogging("api/programme/coach-notes:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const rl = await checkRateLimit(`coach:notes:${user.id}`, NOTES_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  const body = await req.json().catch(() => null) as { ws?: string; notes?: string } | null;
  if (!body?.ws || typeof body.notes !== "string") return json({ error: "ws and notes are required" }, 400);
  const role = await roleOf(body.ws, user.id);
  if (role !== "manager") return json({ error: "Only an invited coach (manager) can set private notes." }, 403);
  await setCoachNotes(body.ws, body.notes);
  return json({ ok: true });
});
