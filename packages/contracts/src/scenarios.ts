import { z } from "zod";

/**
 * Phase 4 request/response contracts: scenario modeling (PRD-NUMBERS-002).
 * Workspace-scoped, unlike formulas.ts - a scenario is a lens over one
 * workspace's own assumptions (@onevyrt/database's assumptions table),
 * so every write here goes through requireWorkspaceMembership, the same
 * as assumptions.ts's own contracts.
 */

export const scenarioTypeSchema = z.enum(["base", "best", "worst", "custom"]);
export type ScenarioType = z.infer<typeof scenarioTypeSchema>;

export const createScenarioRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  scenarioType: scenarioTypeSchema.default("custom"),
});
export type CreateScenarioRequest = z.infer<typeof createScenarioRequestSchema>;

export const scenarioSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  scenarioType: scenarioTypeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const setScenarioOverrideRequestSchema = z.object({
  assumptionId: z.string().uuid(),
  value: z.number(),
});
export type SetScenarioOverrideRequest = z.infer<typeof setScenarioOverrideRequestSchema>;

/**
 * One row of a scenario's resolved assumption set: the assumption's own
 * baseline value alongside this scenario's value (its override if one
 * exists, otherwise the same as the baseline) - what the UI needs to
 * show "this scenario changed N assumptions" without a second request.
 */
export const resolvedScenarioAssumptionSchema = z.object({
  assumptionId: z.string().uuid(),
  statement: z.string(),
  unit: z.string(),
  baselineValue: z.number().nullable(),
  scenarioValue: z.number().nullable(),
  isOverridden: z.boolean(),
});
export type ResolvedScenarioAssumption = z.infer<typeof resolvedScenarioAssumptionSchema>;

/**
 * PRD-NUMBERS-007 (Phase 4 seventh slice: comparison tools, spec's
 * "Compare: compare scenarios, options, drafts or actual-versus-plan").
 * Same resolution as resolvedScenarioAssumptionSchema but across
 * several scenarios at once, one row per assumption with one value per
 * requested scenario - what a side-by-side comparison table needs in a
 * single response.
 */
export const compareScenariosRequestSchema = z.object({
  scenarioIds: z.array(z.string().uuid()).min(2).max(10),
});
export type CompareScenariosRequest = z.infer<typeof compareScenariosRequestSchema>;

export const scenarioComparisonRowSchema = z.object({
  assumptionId: z.string().uuid(),
  statement: z.string(),
  unit: z.string(),
  baselineValue: z.number().nullable(),
  /** Keyed by scenarioId - the override value if that scenario has one, otherwise the same as baselineValue. */
  valuesByScenarioId: z.record(z.string(), z.number().nullable()),
});
export type ScenarioComparisonRow = z.infer<typeof scenarioComparisonRowSchema>;

export const scenarioComparisonSchema = z.object({
  scenarios: z.array(scenarioSchema.pick({ id: true, name: true, scenarioType: true })),
  rows: z.array(scenarioComparisonRowSchema),
});
export type ScenarioComparison = z.infer<typeof scenarioComparisonSchema>;
