import { requireAdmin } from "../../../../../../lib/admin";
import { getWorkspace, adminSetPlan, type Plan } from "../../../../../../lib/workspaces";
import { recordAudit } from "../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const PLANS: Plan[] = ["free", "pro", "business", "performance"];

// Records which subscription tier a workspace is on. This is a state label
// only, set by hand until (if ever) a real payment processor is wired in —
// it never moves money, matching the Subscription modal's own "doesn't
// charge anything yet" preview framing.
export const POST = withRouteLogging("api/admin/workspaces/[id]/plan:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  let body: { plan?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.plan !== "string" || !PLANS.includes(body.plan as Plan)) return json({ error: `plan must be one of ${PLANS.join(", ")}` }, 400);

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);

  try {
    const updated = await adminSetPlan(id, body.plan as Plan);
    await recordAudit({ actorEmail: admin.email, action: "workspace.set_plan", targetType: "workspace", targetLabel: ws.name, detail: `plan -> ${body.plan}` });
    return json(updated);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not set the plan." }, 400);
  }
});
