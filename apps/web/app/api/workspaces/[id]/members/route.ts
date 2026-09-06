import { addMember, removeMember, getWorkspace, type Role, type Plan } from "../../../../../lib/workspaces";
import { currentUser, getUserByEmail, getUserById } from "../../../../../lib/auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { recordActivity } from "../../../../../lib/activity";
import { recordAudit } from "../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Plans that cap a workspace at a single profile (owner only). Mirrors
// SINGLE_SEAT_PLANS in lib/workspaces.ts (not exported there) — kept in sync by
// hand. Used here ONLY to label, in the audit trail, why an admin add crossed
// the paywall; addMember remains the sole authority that actually gates the add.
const SINGLE_SEAT_PLANS: ReadonlySet<Plan> = new Set<Plan>(["free", "pro"]);

export const POST = withRouteLogging("api/workspaces/[id]/members:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  let body: { email?: unknown; role?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.email !== "string") return json({ error: "email is required" }, 400);
  const role: Role = body.role === "viewer" ? "viewer" : body.role === "manager" ? "manager" : "editor";
  // Pre-add snapshot: used for the manager-appointment guard below AND to decide,
  // after the add, whether an admin actually exercised a bypass worth auditing.
  const wsBefore = await getWorkspace(id);
  // Only the owner may appoint a manager — a manager can't mint another manager
  // (that role is a near-peer, so escalating one is effectively an ownership act).
  if (role === "manager" && (!wsBefore || wsBefore.ownerId !== user.id)) {
    return json({ error: "only the workspace owner can appoint a manager" }, 403);
  }
  const target = await getUserByEmail(body.email);
  if (!target) return json({ error: "no user with that email has registered yet" }, 404);
  try {
    const ws = await addMember(id, user.id, target.id, role, isAdminEmail(user.email));
    await recordActivity(id, { actorEmail: user.email, action: "member.add", detail: `${target.email} as ${role}` });
    // Instance admins (ADMIN_EMAILS) pass bypassSeatLimit into addMember, which
    // lets them do two distinct privileged things through this ordinary endpoint:
    //   (1) reach into a workspace they neither own nor manage (cross-tenant), and
    //   (2) add a member past a single-seat plan's paywall (seat bypass).
    // Both otherwise leave NO trace in the admin audit log — recordActivity above
    // is only the per-workspace feed a tenant sees, not the global admin trail.
    // Record an audit entry whenever the bypass actually changed the outcome, and
    // name which gate(s) it crossed so the two concerns stay separate, not conflated.
    if (wsBefore && isAdminEmail(user.email)) {
      const isOwnerOrManager = wsBefore.ownerId === user.id
        || wsBefore.members.some((m) => m.userId === user.id && m.role === "manager");
      const alreadyMember = wsBefore.members.some((m) => m.userId === target.id);
      const crossedTenant = !isOwnerOrManager;
      const seatPaywallBypass = !alreadyMember && SINGLE_SEAT_PLANS.has(wsBefore.plan ?? "free");
      if (crossedTenant || seatPaywallBypass) {
        const bypassed = [
          crossedTenant ? "cross-tenant (not owner/manager)" : null,
          seatPaywallBypass ? `seat paywall (${wsBefore.plan ?? "free"} plan)` : null,
        ].filter(Boolean).join("; ");
        await recordAudit({
          actorEmail: user.email,
          action: "workspace.admin_add_member",
          targetType: "workspace",
          targetLabel: wsBefore.name,
          detail: `added ${target.email} as ${role} — bypassed: ${bypassed}`,
        });
      }
    }
    return json(ws);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not add member" }, 400); }
});

export const DELETE = withRouteLogging("api/workspaces/[id]/members:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  const targetUserId = new URL(req.url).searchParams.get("userId");
  if (!targetUserId) return json({ error: "userId is required" }, 400);
  try {
    const before = await getWorkspace(id);
    const removed = before?.members.some((m) => m.userId === targetUserId);
    const ws = await removeMember(id, user.id, targetUserId);
    if (removed) {
      const target = await getUserById(targetUserId);
      await recordActivity(id, { actorEmail: user.email, action: "member.remove", detail: target?.email ?? targetUserId });
    }
    return json(ws);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not remove member" }, 400); }
});
