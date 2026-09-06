import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getWorkflow, createWorkflowExecution, updateWorkflowExecution, evaluateConditions, executeActions, type WorkflowExecution } from "../../../../../lib/workflows";
import { withRouteLogging } from "../../../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const POST = withRouteLogging("api/workflows/[id]/execute:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer") return json({ error: "insufficient permissions" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { id } = await ctx.params;
  try {
    const workflow = await getWorkflow(id, wsId);
    if (!workflow) return json({ error: "workflow not found" }, 404);

    if (!workflow.enabled) return json({ error: "workflow is disabled" }, 400);

    // Create execution record
    const triggerData = (body.triggerData ?? {}) as Record<string, unknown>;
    let execution: WorkflowExecution | null = await createWorkflowExecution({
      workflowId: id,
      workspaceId: wsId,
      triggerData,
    });

    // Mark as processing
    await updateWorkflowExecution(execution.id, { status: "processing" });

    // Evaluate conditions
    if (!evaluateConditions(workflow.conditions, triggerData)) {
      await updateWorkflowExecution(execution.id, {
        status: "success",
        executedAt: new Date().toISOString(),
      });
      execution = (await getWorkflow(id, wsId))
        ? await updateWorkflowExecution(execution.id, {
            status: "success",
            executedAt: new Date().toISOString(),
          })
        : null;
      return json({ execution, skipped: true });
    }

    // Execute actions
    const actionResults = await executeActions(workflow.actions, triggerData, wsId);

    // Update execution with results
    await updateWorkflowExecution(execution.id, {
      status: actionResults.some((r) => r.status === "failed") ? "failed" : "success",
      actionResults,
      executedAt: new Date().toISOString(),
    });

    execution = await updateWorkflowExecution(execution.id, {
      status: actionResults.some((r) => r.status === "failed") ? "failed" : "success",
    });

    return json({ execution });
  } catch (error) {
    console.error("Error executing workflow:", error);
    return json({ error: "Failed to execute workflow" }, 500);
  }
});
