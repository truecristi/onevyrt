/**
 * Business strategy brief API (read-only). Returns a compact, AI-ready summary
 * of the workspace's Business-OS strategy (reality map, current constraint,
 * driver tree) so the Campaign Studio / funnel generators can ground copy in
 * the actual strategy, not just the brand voice. Core to the workspace (not
 * behind the Campaign Studio add-on): any member can read.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getBusiness } from "../../../../lib/business";
import { strategyBriefFrom } from "../../../../lib/business-brief";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/business/brief:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  const biz = await getBusiness(wsId);
  const { text, has } = strategyBriefFrom(biz);
  return json({ brief: text, has });
});
