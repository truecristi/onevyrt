import { createShare, getActiveShare, revokeShare } from "../../../../../lib/report-shares";
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { readSettings } from "../../../../../lib/settings";
import { recordActivity } from "../../../../../lib/activity";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Owner-only, not the editor bar comments use — a share link exposes the
// project's numbers outside the app entirely, to anyone who gets the URL,
// which is a materially bigger decision than editing the project itself.
async function requireOwner(req: Request): Promise<{ wsId: string; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can share this project." }, 403);
  return { wsId, email: user.email };
}

function shareUrl(origin: string, token: string): string {
  return `${origin}/share/${token}`;
}

/** Whether this project currently has an active share link. */
export const GET = withRouteLogging("api/projects/[id]/share:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const active = await getActiveShare(scope.wsId, id);
  if (!active) return json({ active: null });
  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  return json({ active: { url: shareUrl(origin, active.token), expiresAt: active.expiresAt } });
});

/** Creates (or replaces) the project's share link from an already-rendered
 *  HTML snapshot the client sends — same content as the PDF/email export,
 *  just handed to the server to store instead of downloaded. */
export const POST = withRouteLogging("api/projects/[id]/share:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  let body: { html?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.html !== "string" || !body.html.trim()) return json({ error: "html is required" }, 400);

  const result = await createShare(scope.wsId, id, body.html);
  if ("error" in result) return json({ error: result.error }, 400);
  await recordActivity(scope.wsId, { actorEmail: scope.email, action: "report.share", projectName: id });
  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  return json({ url: shareUrl(origin, result.token), expiresAt: result.expiresAt });
});

/** Revokes whatever share link currently exists for this project. */
export const DELETE = withRouteLogging("api/projects/[id]/share:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const revoked = await revokeShare(scope.wsId, id);
  if (revoked) await recordActivity(scope.wsId, { actorEmail: scope.email, action: "report.unshare", projectName: id });
  return json({ ok: true, revoked });
});
