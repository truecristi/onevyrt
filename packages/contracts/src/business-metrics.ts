import { z } from "zod";

/**
 * Phase 2 request/response contracts: business metrics (PRD-BIZCORE-006).
 * Same pattern as offers.ts and customer-profiles.ts.
 *
 * `direction` records whether a rising value is good ("increase", e.g.
 * revenue) or bad ("decrease", e.g. churn) - needed later to compute
 * progress-toward-target without guessing from the numbers alone.
 */

export const metricDirectionSchema = z.enum(["increase", "decrease"]);
export type MetricDirection = z.infer<typeof metricDirectionSchema>;

export const metricCadenceSchema = z.enum(["weekly", "monthly", "quarterly"]);
export type MetricCadence = z.infer<typeof metricCadenceSchema>;

export const createBusinessMetricRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).default(""),
  direction: metricDirectionSchema.default("increase"),
  cadence: metricCadenceSchema.default("monthly"),
  baselineValue: z.number().finite().optional(),
  targetValue: z.number().finite().optional(),
  currentValue: z.number().finite().optional(),
});
export type CreateBusinessMetricRequest = z.infer<typeof createBusinessMetricRequestSchema>;

export const updateBusinessMetricRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  unit: z.string().trim().max(20).optional(),
  direction: metricDirectionSchema.optional(),
  cadence: metricCadenceSchema.optional(),
  baselineValue: z.number().finite().nullable().optional(),
  targetValue: z.number().finite().nullable().optional(),
  currentValue: z.number().finite().nullable().optional(),
});
export type UpdateBusinessMetricRequest = z.infer<typeof updateBusinessMetricRequestSchema>;

export const businessMetricSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  direction: metricDirectionSchema,
  cadence: metricCadenceSchema,
  baselineValue: z.number().nullable(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BusinessMetric = z.infer<typeof businessMetricSchema>;
