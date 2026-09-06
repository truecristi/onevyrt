import { z } from "zod";
import { offerSchema } from "./offers";
import { businessMetricSchema } from "./business-metrics";
import { assumptionSchema } from "./assumptions";
import { funnelStageSchema } from "./funnel-stages";
import { scenarioSchema } from "./scenarios";

/**
 * Phase 4 request/response contract: financial dashboards (PRD-NUMBERS-005,
 * README "Numbers and modeling" -> "Financial dashboards", fifth slice).
 * A single read-only aggregation over a workspace's existing numbers
 * (offers, business metrics, assumptions, funnel stages, scenarios) plus
 * a small set of honestly-derivable summary counts - not a new source of
 * truth, just one round trip instead of five.
 */

export const financialDashboardSummarySchema = z.object({
  offerCount: z.number().int(),
  activeOfferCount: z.number().int(),
  totalActiveOfferValueCents: z.number().int(),
  assumptionCount: z.number().int(),
  validatedAssumptionCount: z.number().int(),
  businessMetricCount: z.number().int(),
  funnelStageCount: z.number().int(),
  scenarioCount: z.number().int(),
});
export type FinancialDashboardSummary = z.infer<typeof financialDashboardSummarySchema>;

export const financialDashboardSchema = z.object({
  workspaceId: z.string().uuid(),
  summary: financialDashboardSummarySchema,
  offers: z.array(offerSchema),
  businessMetrics: z.array(businessMetricSchema),
  assumptions: z.array(assumptionSchema),
  funnelStages: z.array(funnelStageSchema),
  scenarios: z.array(scenarioSchema),
});
export type FinancialDashboard = z.infer<typeof financialDashboardSchema>;
