import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "../../../../lib/workflows";
import { withRouteLogging } from "../../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const GET = withRouteLogging("api/workflows/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { id } = await ctx.params;
  try {
    const workflow = await getWorkflow(id, wsId);
    if (!workflow) return json({ error: "workflow not found" }, 404);
    return json({ workflow });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return json({ error: "Failed to fetch workflow" }, 500);
  }
});

export const PATCH = withRouteLogging("api/workflows/[id]:PATCH", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer" || role === "editor") return json({ error: "insufficient permissions" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { id } = await ctx.params;
  try {
    const updated = await updateWorkflow(id, wsId, {
      ...(body.name ? { name: String(body.name) } : {}),
      ...(body.description !== undefined && { description: body.description ? String(body.description) : undefined }),
      ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }),
      ...(body.triggerType ? { triggerType: String(body.triggerType) as any } : {}),
      ...(body.triggerConfig ? { triggerConfig: body.triggerConfig as Record<string, unknown> } : {}),
      ...(body.conditions ? { conditions: body.conditions as any[] } : {}),
      ...(body.actions ? { actions: body.actions as any[] } : {}),
    });

    if (!updated) return json({ error: "workflow not found" }, 404);
    return json({ workflow: updated });
  } catch (error) {
    console.error("Error updating workflow:", error);
    return json({ error: "Failed to update workflow" }, 500);
  }
});

export const DELETE = withRouteLogging("api/workflows/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer" || role === "editor") return json({ error: "insufficient permissions" }, 403);

  const { id } = await ctx.params;
  try {
    const deleted = await deleteWorkflow(id, wsId);
    if (!deleted) return json({ error: "workflow not found" }, 404);
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return json({ error: "Failed to delete workflow" }, 500);
  }
});
