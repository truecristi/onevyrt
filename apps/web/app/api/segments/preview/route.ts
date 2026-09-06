/**
 * Live segment preview — POST a rule tree, get back how many people match and
 * how many are reachable by each channel (email / SMS / verified / booked) plus
 * a small sample. Read-only evaluation against the workspace's own leads; any
 * member may run it. Powers the builder's live counts as you edit.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { previewSegment } from "../../../../lib/segments/store";
import type { Group } from "../../../../lib/segments/rules";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/segments/preview:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  let body: { rules?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!body.rules || typeof body.rules !== "object") return json({ error: "a rules tree is required" }, 400);
  try {
    return json({ preview: await previewSegment(wsId, body.rules as Group) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "invalid rules" }, 400);
  }
});
