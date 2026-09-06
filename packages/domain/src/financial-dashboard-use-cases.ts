import type { Database } from "@onevyrt/database";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { listOffers, type OfferRecord } from "./offer-use-cases";
import { listBusinessMetrics, type BusinessMetricRecord } from "./business-metric-use-cases";
import { listAssumptions, type AssumptionRecord } from "./assumption-use-cases";
import { listFunnelStages, type FunnelStageRecord } from "./funnel-stage-use-cases";
import { listScenarios, type ScenarioRecord } from "./scenario-use-cases";

/**
 * PRD-NUMBERS-005 vertical slice: financial dashboards (README "Numbers
 * and modeling" -> "Financial dashboards", fifth slice of Phase 4). Not
 * a new source of truth - a single read-only aggregation over a
 * workspace's existing offers, business metrics, assumptions, funnel
 * stages and scenarios, each already scoped and authorized by its own
 * list use case. summary counts are derived directly from those same
 * lists, never invented or estimated.
 *
 * Returns the same *Record interfaces (Date fields) every other domain
 * function returns, not the @onevyrt/contracts schema type (string
 * fields) - the API route layer's NextResponse.json() serializes Dates
 * to ISO strings on the way out, satisfying financialDashboardSchema at
 * the wire boundary without this module needing to know about it.
 */

export interface FinancialDashboardSummaryRecord {
  offerCount: number;
  activeOfferCount: number;
  totalActiveOfferValueCents: number;
  assumptionCount: number;
  validatedAssumptionCount: number;
  businessMetricCount: number;
  funnelStageCount: number;
  scenarioCount: number;
}

export interface FinancialDashboardRecord {
  workspaceId: string;
  summary: FinancialDashboardSummaryRecord;
  offers: OfferRecord[];
  businessMetrics: BusinessMetricRecord[];
  assumptions: AssumptionRecord[];
  funnelStages: FunnelStageRecord[];
  scenarios: ScenarioRecord[];
}

export interface GetFinancialDashboardInput {
  actorUserId: string;
  workspaceId: string;
}

export async function getFinancialDashboard(
  db: Database,
  input: GetFinancialDashboardInput,
): Promise<FinancialDashboardRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [offers, businessMetrics, assumptions, funnelStages, scenarios] = await Promise.all([
    listOffers(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listBusinessMetrics(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listAssumptions(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listFunnelStages(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listScenarios(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
  ]);

  const activeOffers = offers.filter((o) => o.status === "active");

  return {
    workspaceId: input.workspaceId,
    summary: {
      offerCount: offers.length,
      activeOfferCount: activeOffers.length,
      totalActiveOfferValueCents: activeOffers.reduce((sum, o) => sum + (o.priceCents ?? 0), 0),
      assumptionCount: assumptions.length,
      validatedAssumptionCount: assumptions.filter((a) => a.status === "validated").length,
      businessMetricCount: businessMetrics.length,
      funnelStageCount: funnelStages.length,
      scenarioCount: scenarios.length,
    },
    offers,
    businessMetrics,
    assumptions,
    funnelStages,
    scenarios,
  };
}
