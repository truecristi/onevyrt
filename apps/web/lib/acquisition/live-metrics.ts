/**
 * Live acquisition metrics for the Business OS. Exposes the real numbers the
 * funnels produce (leads, qualified, booked, visits, CAC) in a shape the Driver
 * Tree can link a driver's *current* value to — so the strategic model tracks
 * reality instead of a hand-typed guess. Keyed to lib/drivers DRIVER_SOURCES.
 */
import { acquisitionSummary } from "./leads";
import { funnelAnalytics } from "./funnel-events";

export interface LiveMetric {
  key: string;
  label: string;
  value: number;
  /** ready-to-display string (a percentage, a currency, or a count) */
  display: string;
}

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

/** The current live acquisition metrics for a workspace, in a stable order. */
export async function liveAcquisitionMetrics(workspaceId: string): Promise<LiveMetric[]> {
  const [s, r] = await Promise.all([
    acquisitionSummary(workspaceId, todayISO()),
    funnelAnalytics(workspaceId),
  ]);
  const cacKnown = r.spend > 0 && s.qualified > 0;
  return [
    { key: "leads_7d", label: "Leads (7 days)", value: s.leads7d, display: String(s.leads7d) },
    { key: "leads_total", label: "Leads (all time)", value: s.leadsTotal, display: String(s.leadsTotal) },
    { key: "qualified", label: "Qualified leads", value: s.qualified, display: String(s.qualified) },
    { key: "booked", label: "Booked calls", value: s.bookingsTotal, display: String(s.bookingsTotal) },
    { key: "upcoming", label: "Upcoming calls", value: s.upcoming, display: String(s.upcoming) },
    { key: "visits", label: "Funnel visits", value: r.views, display: String(r.views) },
    { key: "qualify_rate", label: "Qualify rate", value: s.qualifyRate, display: `${Math.round(s.qualifyRate * 100)}%` },
    { key: "cac", label: "Cost / qualified", value: r.costPerQualified, display: cacKnown ? `$${Math.round(r.costPerQualified)}` : "—" },
  ];
}
