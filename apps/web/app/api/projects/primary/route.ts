/**
 * GET /api/projects/primary — which project represents this workspace's
 * "business" for definition-editing purposes (see lib/studio/primary-project.ts).
 * Exists because business-intelligence/page.tsx (a client component) can't
 * call the server helper directly — it used to just take the newest project
 * unconditionally (`list[0]`), which is the exact bug this route fixes:
 * touching an unrelated blank project could hide a fully-completed
 * Business Intelligence workbook on an older one.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { pickPrimaryProject, hasAnyDefinitionField } from "../../../../lib/studio/primary-project";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/projects/primary:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const primary = await pickPrimaryProject(wsId, (doc) => hasAnyDefinitionField(doc.program?.definition));
  if (!primary) return json({ id: null, name: null });
  return json({ id: primary.id, name: primary.name });
});
