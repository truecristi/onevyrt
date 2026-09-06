import { z } from "zod";

/**
 * Phase 4 request/response contracts: the versioned formula library
 * (PRD-NUMBERS-001, README "Numbers and modeling" -> "Versioned formula
 * library"). Same platform-admin-authoring shape as curriculum.ts -
 * every workspace member can read published formula definitions and
 * compute against them, but only a platform admin can create or publish
 * a new formula version.
 */

export const formulaStatusSchema = z.enum(["draft", "published", "archived"]);
export type FormulaStatus = z.infer<typeof formulaStatusSchema>;

const formulaKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "must be lowercase, alphanumeric, underscore-separated");

export const formulaInputDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).default(""),
});
export type FormulaInputDefinition = z.infer<typeof formulaInputDefinitionSchema>;

export const createFormulaDefinitionRequestSchema = z.object({
  key: formulaKeySchema,
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  inputSchema: z.array(formulaInputDefinitionSchema).min(1),
  outputUnit: z.string().trim().min(1).max(50),
});
export type CreateFormulaDefinitionRequest = z.infer<typeof createFormulaDefinitionRequestSchema>;

export const formulaDefinitionSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  version: z.number(),
  title: z.string(),
  description: z.string(),
  inputSchema: z.array(formulaInputDefinitionSchema),
  outputUnit: z.string(),
  status: formulaStatusSchema,
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FormulaDefinition = z.infer<typeof formulaDefinitionSchema>;

/** The request body for computing a published formula: a flat map of its declared input names to numbers. */
export const computeFormulaRequestSchema = z.object({
  inputs: z.record(z.string(), z.number()),
});
export type ComputeFormulaRequest = z.infer<typeof computeFormulaRequestSchema>;

/**
 * The full provenance envelope the spec's business-modeling section
 * requires every important number to retain: source, unit, formula
 * version, and (since this is always a pure re-derivation from caller-
 * supplied inputs, never observed/imported data) valueOrigin is always
 * "calculated" here - see formula-use-cases.ts's doc comment for why.
 */
export const formulaResultSchema = z.object({
  formulaKey: z.string(),
  formulaVersion: z.number(),
  value: z.number(),
  unit: z.string(),
  inputs: z.record(z.string(), z.number()),
  valueOrigin: z.literal("calculated"),
  computedAt: z.string(),
});
export type FormulaResult = z.infer<typeof formulaResultSchema>;
