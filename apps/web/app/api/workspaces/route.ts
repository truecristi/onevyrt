import { listForUser, createWorkspace, ensurePersonalWorkspace, DuplicateWorkspaceNameError, WorkspaceLimitError } from "../../../lib/workspaces";
import { currentUser } from "../../../lib/auth";
import { withRouteLogging } from "../../../lib/logger";
import { track } from "../../../lib/analytics";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/workspaces:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  await ensurePersonalWorkspace(user.id);
  return json(await listForUser(user.id));
});
export const POST = withRouteLogging("api/workspaces:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  let body: { name?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const name = typeof body.name === "string" ? body.name : "Untitled workspace";
  let ws;
  try {
    ws = await createWorkspace(user.id, name);
  } catch (e) {
    if (e instanceof DuplicateWorkspaceNameError || e instanceof WorkspaceLimitError) return json({ error: e.message }, 409);
    throw e;
  }
  void track("workspace_created", { userId: user.id, workspaceId: ws.id });
  return json(ws);
});
