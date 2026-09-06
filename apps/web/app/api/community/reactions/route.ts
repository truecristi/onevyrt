/**
 * Community reactions API. GET ?type=&ids=a,b,c returns {id: {count, mine}} for
 * a batch of artifacts (any member). POST {type, id} toggles the caller's
 * "helpful" endorsement and returns the new state.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { toggleReaction, reactionStates } from "../../../../lib/community/reactions";
import { isArtifactType } from "../../../../lib/community/comments";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

// Keyed by workspace id — see comments/route.ts for why. Generous: a member
// clicking "helpful" while browsing the hub can toggle several tiles a minute.
const POST_LIMIT = { windowMs: 60_000, max: 30 };

async function resolveWs(req: Request): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/community/reactions:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req);
  if (scope instanceof Response) return scope;
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  if (!isArtifactType(type)) return json({ error: "type must be 'template' or 'creative'" }, 400);
  const ids = (sp.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  return json({ reactions: await reactionStates(scope.wsId, type, ids) });
});

export const POST = withRouteLogging("api/community/reactions:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req);
  if (scope instanceof Response) return scope;
  const rl = await checkRateLimit(`community:reaction:post:${scope.wsId}`, POST_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));
  let body: { type?: unknown; id?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!isArtifactType(body.type)) return json({ error: "type must be 'template' or 'creative'" }, 400);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return json({ error: "an artifact id is required" }, 400);
  return json({ ok: true, state: await toggleReaction(scope.wsId, body.type, id) });
});
