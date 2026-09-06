import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { listBatchOperations, createBatchOperation } from "../../../lib/workflows";
import { withRouteLogging } from "../../../lib/logger";

const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

export const GET = withRouteLogging("api/batch-operations:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  try {
    const operations = await listBatchOperations(wsId);
    return json({ operations });
  } catch (error) {
    console.error("Error listing batch operations:", error);
    return json({ error: "Failed to list batch operations" }, 500);
  }
});

export const POST = withRouteLogging("api/batch-operations:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer" || role === "editor") return json({ error: "insufficient permissions" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { operationType, operationData } = body;
  if (!operationType) return json({ error: "operationType is required" }, 400);

  try {
    const operation = await createBatchOperation({
      workspaceId: wsId,
      operationType: String(operationType) as any,
      operationData: (operationData ?? {}) as Record<string, unknown>,
      createdByUserId: user.id,
    });
    return json({ operation }, 201);
  } catch (error) {
    console.error("Error creating batch operation:", error);
    return json({ error: "Failed to create batch operation" }, 500);
  }
});
