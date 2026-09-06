/**
 * Builds the factual metrics snapshot the AI digest reads from — pure data, no
 * AI. Reuses the existing acquisition, funnel, and creative aggregators so the
 * insights are the same numbers shown elsewhere in the app, just gathered into
 * one compact object the owner's connected model can reason over.
 */
import { acquisitionSummary } from "../acquisition/leads";
import { funnelAnalytics } from "../acquisition/funnel-events";
import { listWorkspaceFunnels } from "../studio/funnel-store";
import { anglePerformance, listCreativePerformance } from "../campaign/creatives-store";
import type { InsightsSnapshot } from "./prompt";

export async function buildInsightsSnapshot(workspaceId: string, todayISO: string): Promise<InsightsSnapshot> {
  const [summary, all, funnels, angles, creatives] = await Promise.all([
    acquisitionSummary(workspaceId, todayISO),
    funnelAnalytics(workspaceId),
    listWorkspaceFunnels(workspaceId),
    anglePerformance(workspaceId),
    listCreativePerformance(workspaceId),
  ]);

  // Per-funnel reports (bounded), best first by qualified leads.
  const perFunnel = await Promise.all(
    funnels.slice(0, 8).map(async (f) => {
      const r = await funnelAnalytics(workspaceId, f.slug);
      return {
        slug: f.slug, title: f.doc.title,
        leads: r.leads, qualified: r.qualified, booked: r.booked,
        qualifyRate: r.leads > 0 ? r.qualified / r.leads : 0,
        costPerQualified: r.costPerQualified,
      };
    }),
  );
  perFunnel.sort((a, b) => b.qualified - a.qualified || b.leads - a.leads);

  return {
    currency: all.currency || "USD",
    overview: {
      leadsTotal: summary.leadsTotal, leads7d: summary.leads7d, qualified: summary.qualified,
      qualifyRate: summary.qualifyRate, bookingsTotal: summary.bookingsTotal, bookRate: summary.bookRate,
      upcoming: summary.upcoming,
    },
    economics: { spend: all.spend, costPerQualified: all.costPerQualified, costPerBooking: all.costPerBooking },
    funnels: perFunnel.filter((f) => f.leads > 0),
    angles: angles.filter((a) => a.leads > 0).slice(0, 6).map((a) => ({
      angle: a.angle, qualified: a.qualified, leads: a.leads, qualifyRate: a.qualifyRate, costPerQualified: a.costPerQualified,
    })),
    creatives: creatives.filter((c) => c.leads > 0).slice(0, 6).map((c) => ({
      headline: c.headline, angle: c.angle, qualified: c.qualified, leads: c.leads, costPerQualified: c.costPerQualified,
    })),
  };
}
