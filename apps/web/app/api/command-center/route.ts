/**
 * Command Center aggregation — the one call the home dashboard makes. Pulls the
 * real acquisition numbers (leads, qualified, booked, CAC) and the strategic
 * state (revenue target, growth constraint, biggest driver, execution
 * progress) for the viewer's workspace, and computes a single guided "next
 * move" from the combined picture. This is the piece that makes the five
 * surfaces read as one product.
 */
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { acquisitionSummary } from "../../../lib/acquisition/leads";
import { funnelAnalytics } from "../../../lib/acquisition/funnel-events";
import { listWorkspaceFunnels } from "../../../lib/studio/funnel-store";
import { getDriverTree } from "../../../lib/drivers";
import { getConstraint } from "../../../lib/constraint";
import { getExecution, progressOf } from "../../../lib/execution";
import { creativeWinner } from "../../../lib/campaign/creatives-store";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

/** Interpret a free-text driver value ("$25,000", "3.2%", "1200") as a number. */
function parseNum(s: unknown): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim(); if (!t) return NaN;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[%$,\s]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}

export const GET = withRouteLogging("api/command-center:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const [summary, report, funnels, driverTree, constraint, execution, winnerVerdict] = await Promise.all([
    acquisitionSummary(wsId, todayISO()),
    funnelAnalytics(wsId),
    listWorkspaceFunnels(wsId),
    getDriverTree(wsId),
    getConstraint(wsId),
    getExecution(wsId),
    creativeWinner(wsId),
  ]);

  // Biggest lever: the driver whose target most exceeds its current value.
  let topDriver: string | null = null, topFactor = 1;
  for (const d of driverTree.drivers) {
    const c = parseNum(d.current), t = parseNum(d.target);
    if (Number.isFinite(c) && Number.isFinite(t) && c !== 0 && t / c > topFactor) { topFactor = t / c; topDriver = d.label; }
  }
  // Current constraint: the declared one, else the highest-severity area.
  let constraintName: string | null = constraint.chosen || null;
  if (!constraintName) {
    let sev = 0;
    for (const a of constraint.areas) if ((a.severity ?? 0) > sev) { sev = a.severity ?? 0; constraintName = a.area; }
  }
  const exec = progressOf(execution.tasks);
  const target = driverTree.outcomeTarget || "";

  const acquisition = {
    hasFunnel: funnels.length > 0,
    funnelCount: funnels.length,
    leadsTotal: summary.leadsTotal,
    leads7d: summary.leads7d,
    qualified: summary.qualified,
    qualifyRate: summary.qualifyRate,
    booked: summary.bookingsTotal,
    upcoming: summary.upcoming,
    views: report.views,
    cac: report.costPerQualified,
    spend: report.spend,
    currency: report.currency,
  };
  const plan = {
    target,
    constraint: constraintName,
    topDriver,
    executionPct: exec.pct,
    execDone: exec.done,
    execTotal: exec.total,
    hasPlan: Boolean(target || constraintName || driverTree.drivers.length || execution.tasks.length),
  };

  // One guided next move from the combined state — the "here's what to do now".
  const nextMove = (() => {
    if (!acquisition.hasFunnel) return { label: "Build your first qualification funnel", href: "/business/funnels", why: "It's the front door to your acquisition machine." };
    if (acquisition.upcoming > 0) return { label: `Prep for ${acquisition.upcoming} booked call${acquisition.upcoming === 1 ? "" : "s"}`, href: "/business/leads", why: "Qualified leads are waiting on your calendar." };
    if (acquisition.leadsTotal === 0) return { label: "Drive traffic to your funnel", href: "/business/funnels", why: "Your funnel is live — it needs visitors." };
    if (!plan.constraint) return { label: "Name your growth constraint", href: "/business/constraint", why: "Leads are coming in — focus the whole business on the one bottleneck." };
    if (plan.executionPct === 0) return { label: "Turn your constraint into a 90-day plan", href: "/business/execution", why: "You know the bottleneck — now execute against it." };
    return { label: "Review this week and close the loop", href: "/business/review", why: "Compare actual vs plan and feed it back." };
  })();

  // A creative worth scaling, when the ad data actually shows one (the detector
  // holds back until there's real signal). Only the display bits go to the client.
  const winner = winnerVerdict.hasWinner
    ? { headline: winnerVerdict.winner.headline, reason: winnerVerdict.reason, rate: winnerVerdict.winner.rate }
    : null;

  return json({ acquisition, plan, nextMove, winner });
});
