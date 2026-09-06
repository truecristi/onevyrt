import { listComments, addComment, deleteComment } from "../../../../../lib/comments";
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../../lib/workspaces";
import { recordActivity } from "../../../../../lib/activity";
import { checkRateLimit, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Project discussion comments. Same generous limit as community/comments,
// since teammates collaborating on a project comment fairly often.
const COMMENT_LIMIT = { windowMs: 60_000, max: 30 };

async function resolveScope(
  req: Request,
): Promise<{ wsId: string; role: Role; userId: string; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId, role, userId: user.id, email: user.email };
}

/** Anyone in the workspace can read the discussion. */
export const GET = withRouteLogging("api/projects/[id]/comments:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  return json({ comments: await listComments(scope.wsId, id), me: scope.userId });
});

/** Editors and owners can comment; viewers are read-only. */
export const POST = withRouteLogging("api/projects/[id]/comments:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  if (scope.role === "viewer") return json({ error: "viewers cannot comment" }, 403);

  const rl = await checkRateLimit(`project:comment:${scope.wsId}`, COMMENT_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  const { id } = await ctx.params;
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (typeof body.text !== "string") return json({ error: "text is required" }, 400);
  const c = await addComment(scope.wsId, id, scope.userId, scope.email, body.text);
  if (!c) return json({ error: "comment cannot be empty" }, 400);
  await recordActivity(scope.wsId, { actorEmail: scope.email, action: "comment.add", projectName: id });
  return json({ comment: c }, 201);
});

/** Authors delete their own comments. */
export const DELETE = withRouteLogging("api/projects/[id]/comments:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const commentId = new URL(req.url).searchParams.get("comment");
  if (!commentId) return json({ error: "comment id is required" }, 400);
  const ok = await deleteComment(scope.wsId, id, commentId, scope.userId);
  return ok ? json({ ok: true }) : json({ error: "not found, or not your comment" }, 404);
});
