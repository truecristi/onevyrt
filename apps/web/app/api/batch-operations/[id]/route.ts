import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getBatchOperation, updateBatchOperation } from "../../../../lib/workflows";
import { withRouteLogging } from "../../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const GET = withRouteLogging("api/batch-operations/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { id } = await ctx.params;
  try {
    const operation = await getBatchOperation(id, wsId);
    if (!operation) return json({ error: "batch operation not found" }, 404);
    return json({ operation });
  } catch (error) {
    console.error("Error fetching batch operation:", error);
    return json({ error: "Failed to fetch batch operation" }, 500);
  }
});

export const PATCH = withRouteLogging("api/batch-operations/[id]:PATCH", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
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
    const updates: Parameters<typeof updateBatchOperation>[1] = {};
    if (body.status) updates.status = String(body.status) as "pending" | "processing" | "success" | "failed";
    if (body.processedItems !== undefined) updates.processedItems = Number(body.processedItems);
    if (body.failedItems !== undefined) updates.failedItems = Number(body.failedItems);
    if (body.errorMessage !== undefined) updates.errorMessage = body.errorMessage ? String(body.errorMessage) : null;
    if (body.results) updates.results = body.results as Array<{ item: string; status: string; result?: unknown }>;
    if (body.startedAt) updates.startedAt = String(body.startedAt);
    if (body.completedAt) updates.completedAt = String(body.completedAt);

    const updated = await updateBatchOperation(id, updates);

    if (!updated) return json({ error: "batch operation not found" }, 404);
    return json({ operation: updated });
  } catch (error) {
    console.error("Error updating batch operation:", error);
    return json({ error: "Failed to update batch operation" }, 500);
  }
});
