/**
 * Community comments API. GET ?type=&id= returns a thread (any member); with
 * ?type=&ids=a,b,c it returns comment counts for a batch of artifacts. POST
 * adds a comment (any member; the author's community name is snapshotted).
 * DELETE ?id= removes a comment you authored.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { addComment, listComments, commentCounts, deleteComment, isArtifactType } from "../../../../lib/community/comments";
import { resolveDisplayName } from "../../../../lib/community/profile";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

// Posting is authenticated + workspace-membership-gated (unlike /api/track's
// open ingest), so the workspace id — not IP — is the meaningful actor
// identity to key on: it can't be forged by a stranger, only by joining or
// owning many workspaces, which has real friction. Generous, since real
// members chatting on a thread post fairly often.
const POST_LIMIT = { windowMs: 60_000, max: 30 };

async function resolveWs(req: Request): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/community/comments:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req);
  if (scope instanceof Response) return scope;
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  if (!isArtifactType(type)) return json({ error: "type must be 'template' or 'creative'" }, 400);

  const idsParam = sp.get("ids");
  if (idsParam !== null) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
    return json({ counts: await commentCounts(type, ids) });
  }
  const id = sp.get("id") || "";
  if (!id) return json({ error: "id (or ids) is required" }, 400);
  const comments = await listComments(type, id);
  return json({ comments: comments.map((c) => ({ ...c, mine: c.authorWorkspaceId === scope.wsId })) });
});

export const POST = withRouteLogging("api/community/comments:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req);
  if (scope instanceof Response) return scope;
  const rl = await checkRateLimit(`community:comment:post:${scope.wsId}`, POST_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));
  let body: { type?: unknown; id?: unknown; body?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!isArtifactType(body.type)) return json({ error: "type must be 'template' or 'creative'" }, 400);
  const id = typeof body.id === "string" ? body.id : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!id || !text.trim()) return json({ error: "an artifact id and a non-empty comment are required" }, 400);
  try {
    const c = await addComment(scope.wsId, await resolveDisplayName(scope.wsId), body.type, id, text);
    return json({ ok: true, comment: { ...c, mine: true } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not post" }, 400);
  }
});

export const DELETE = withRouteLogging("api/community/comments:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req);
  if (scope instanceof Response) return scope;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);
  return json({ ok: await deleteComment(scope.wsId, id) });
});
