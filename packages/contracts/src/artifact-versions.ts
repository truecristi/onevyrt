import { z } from "zod";

/**
 * Phase 5 request/response contracts: artifact versioning (PRD-BUILD-004,
 * README "Offer and funnel building" -> "Important business artifacts
 * must be versioned. Users must be able to compare changes..."). A
 * generic version history over several artifact types - see schema.ts's
 * artifactVersions doc comment for why one polymorphic table serves all
 * of them.
 */

export const artifactTypeSchema = z.enum(["offer", "customer_profile", "funnel_step"]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const snapshotArtifactVersionRequestSchema = z.object({
  changeNote: z.string().trim().max(500).default(""),
});
export type SnapshotArtifactVersionRequest = z.infer<typeof snapshotArtifactVersionRequestSchema>;

export const compareArtifactVersionsRequestSchema = z.object({
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
});
export type CompareArtifactVersionsRequest = z.infer<typeof compareArtifactVersionsRequestSchema>;

export const artifactVersionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  version: z.number().int(),
  snapshot: z.record(z.string(), z.unknown()),
  changeNote: z.string(),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
});
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>;

/**
 * A shallow field-by-field diff between two versions' snapshots - what
 * "compare changes and understand which version produced which result"
 * needs: which fields changed, and their before/after values. Fields
 * whose values are structurally equal (including nested objects/arrays)
 * are not included.
 */
export const artifactVersionFieldDiffSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});
export type ArtifactVersionFieldDiff = z.infer<typeof artifactVersionFieldDiffSchema>;

export const artifactVersionComparisonSchema = z.object({
  fromVersion: z.number().int(),
  toVersion: z.number().int(),
  changes: z.array(artifactVersionFieldDiffSchema),
});
export type ArtifactVersionComparison = z.infer<typeof artifactVersionComparisonSchema>;
