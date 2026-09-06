/**
 * Community author profile API — everything one workspace has publicly shared,
 * plus their display name and headline totals. Any authenticated member may
 * read it; a caller viewing their own profile is flagged so the UI can offer
 * unpublish. Read-only, no PII beyond the chosen display name.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getAuthorProfile } from "../../../../../lib/community/authors";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/community/authors/[wsId]:GET", async (req: Request, ctx: { params: Promise<{ wsId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const viewerWs = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(viewerWs, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { wsId } = await ctx.params;
  const profile = await getAuthorProfile(wsId);
  return json({ profile: { ...profile, isMe: wsId === viewerWs } });
});
