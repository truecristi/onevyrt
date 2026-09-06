import { requireAdmin } from "../../../../lib/admin";
import { listAllUsers } from "../../../../lib/auth";
import { listAllWorkspaces } from "../../../../lib/workspaces";
import { listProjects } from "../../../../lib/store";
import { readSettings } from "../../../../lib/settings";
import { loginLockouts, storageCounts } from "../../../../lib/admin-stats";
import { recentAudit } from "../../../../lib/audit-log";
import { recentClientErrors } from "../../../../lib/client-errors";
import { listAllStripeEvents } from "../../../../lib/stripe-events";
import { analyticsSummary } from "../../../../lib/analytics";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

const RECENT_STRIPE_EVENTS = 20;

// Same privacy line the public webhook GET already draws: customerEmail is
// stored (the webhook payload has it) but never leaves this surface, admin
// included — only type/date/amount, enough to see what happened without
// turning the admin panel into a customer-lookup tool.
async function stripeSummary(): Promise<{
  configured: boolean; count: number; lastReceivedAt: string | null; completedCount: number; completedAmountTotal: number;
  recentEvents: { id: string; type: string; receivedAt: string; amountTotal?: number; currency?: string }[];
}> {
  const configured = !!process.env.STRIPE_WEBHOOK_SECRET;
  // Instance-wide by design — this whole route is behind requireAdmin.
  const events = await listAllStripeEvents();
  const count = events.length;
  const lastReceivedAt = events.length ? (events[events.length - 1]?.receivedAt ?? null) : null;
  let completedCount = 0, completedAmountTotal = 0;
  for (const e of events) if (e.type === "checkout.session.completed") { completedCount += 1; completedAmountTotal += e.amountTotal ?? 0; }
  const recentEvents = events.slice(-RECENT_STRIPE_EVENTS).reverse();
  return {
    configured, count, lastReceivedAt, completedCount, completedAmountTotal,
    recentEvents: recentEvents.map((e) => ({ id: e.id, type: e.type, receivedAt: e.receivedAt, amountTotal: e.amountTotal, currency: e.currency })),
  };
}

export const GET = withRouteLogging("api/admin/overview:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);

  const [users, workspaces, settings, stripe, lockouts, storage, audit, analytics, clientErrors] = await Promise.all([
    listAllUsers(), listAllWorkspaces(), readSettings(), stripeSummary(), loginLockouts(), storageCounts(), recentAudit(100), analyticsSummary(30), recentClientErrors(50),
  ]);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  // Projects live under .gearbox/projects/<workspaceId>/, so we enumerate them
  // per workspace. Read-only meta only — never the serialized doc contents
  // (that's a separate, explicit fetch via /api/admin/projects/[wsId]/[id]).
  const workspaceRows = await Promise.all(workspaces.map(async (w) => {
    const projects = await listProjects(w.id);
    return {
      id: w.id, name: w.name,
      ownerId: w.ownerId, ownerEmail: emailById.get(w.ownerId) ?? "(unknown)",
      plan: w.plan ?? "free",
      members: w.members.map((m) => ({ userId: m.userId, email: emailById.get(m.userId) ?? "(unknown)", role: m.role })),
      memberCount: w.members.length, createdAt: w.createdAt,
      projectCount: projects.length,
      projects: projects.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })),
    };
  }));

  const totals = {
    users: users.length,
    workspaces: workspaces.length,
    projects: workspaceRows.reduce((n, w) => n + w.projectCount, 0),
  };

  return json({ admin: { email: admin.email }, totals, users, workspaces: workspaceRows, settings, stripe, lockouts, storage, audit, analytics, clientErrors });
});
