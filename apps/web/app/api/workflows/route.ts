import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { listWorkflows, createWorkflow } from "../../../lib/workflows";
import { withRouteLogging } from "../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const GET = withRouteLogging("api/workflows:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  try {
    const workflows = await listWorkflows(wsId);
    return json({ workflows });
  } catch (error) {
    console.error("Error listing workflows:", error);
    return json({ error: "Failed to list workflows" }, 500);
  }
});

export const POST = withRouteLogging("api/workflows:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer" || role === "editor") return json({ error: "insufficient permissions" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { name, description, triggerType, triggerConfig, conditions, actions } = body;
  if (!name || !triggerType) return json({ error: "name and triggerType are required" }, 400);

  try {
    const workflow = await createWorkflow({
      workspaceId: wsId,
      name: String(name),
      description: description ? String(description) : undefined,
      triggerType: String(triggerType) as any,
      triggerConfig: (triggerConfig ?? {}) as Record<string, unknown>,
      conditions: Array.isArray(conditions) ? conditions : [],
      actions: Array.isArray(actions) ? actions : [],
      createdByUserId: user.id,
    });
    return json({ workflow }, 201);
  } catch (error) {
    console.error("Error creating workflow:", error);
    return json({ error: "Failed to create workflow" }, 500);
  }
});
