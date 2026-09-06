/**
 * Resolve an ad-hoc rule tree to its contacts — so the builder can export /
 * copy an email / SMS / call list before the segment is even saved. POST a
 * rules tree, get the matching contacts (newest first, max 5000). Read-only.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { listContacts } from "../../../../lib/segments/store";
import type { Group } from "../../../../lib/segments/rules";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/segments/contacts:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  let body: { rules?: unknown; limit?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!body.rules || typeof body.rules !== "object") return json({ error: "a rules tree is required" }, 400);
  try {
    const limit = Math.min(5000, Math.max(1, Number(body.limit) || 5000));
    return json({ contacts: await listContacts(wsId, body.rules as Group, limit, 0) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "invalid rules" }, 400);
  }
});
