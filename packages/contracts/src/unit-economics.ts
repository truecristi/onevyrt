import { z } from "zod";
import { formulaResultSchema } from "./formulas";

/**
 * Phase 4 request/response contracts: unit economics (PRD-NUMBERS-004,
 * README "Numbers and modeling" -> "Unit economics", fourth slice).
 * A composite report over a single Phase 2 offer, tying the formula
 * library (formulas.ts) to a real business record the same way lesson
 * applications tied curriculum to Phase 2 records.
 */

export const calculateUnitEconomicsRequestSchema = z.object({
  costPerUnit: z.number().nonnegative(),
  acquisitionSpend: z.number().nonnegative(),
  customersAcquired: z.number().positive(),
  averageOrderValue: z.number().nonnegative(),
  purchaseFrequencyPerYear: z.number().nonnegative(),
  customerLifespanYears: z.number().positive(),
});
export type CalculateUnitEconomicsRequest = z.infer<typeof calculateUnitEconomicsRequestSchema>;

export const unitEconomicsReportSchema = z.object({
  offerId: z.string().uuid(),
  price: z.number(),
  costPerUnit: z.number(),
  grossProfit: formulaResultSchema,
  contributionMargin: formulaResultSchema,
  customerAcquisitionCost: formulaResultSchema,
  customerLifetimeValue: formulaResultSchema,
  ltvToCacRatio: formulaResultSchema,
});
export type UnitEconomicsReport = z.infer<typeof unitEconomicsReportSchema>;
