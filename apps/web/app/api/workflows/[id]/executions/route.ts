import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getWorkflow, listWorkflowExecutions } from "../../../../../lib/workflows";
import { withRouteLogging } from "../../../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const GET = withRouteLogging("api/workflows/[id]/executions:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { id } = await ctx.params;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50), 100);

  try {
    const workflow = await getWorkflow(id, wsId);
    if (!workflow) return json({ error: "workflow not found" }, 404);

    const executions = await listWorkflowExecutions(id, limit);
    return json({ executions });
  } catch (error) {
    console.error("Error listing executions:", error);
    return json({ error: "Failed to list executions" }, 500);
  }
});
