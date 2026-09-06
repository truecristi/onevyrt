import { z } from "zod";
import { artifactTypeSchema } from "./artifact-versions";

/**
 * Phase 6 request/response contracts: artifact proposals (PRD-AI-006,
 * README "AI coaching" -> "Artifact proposals", sixth slice; ADR-0012).
 * Reuses artifactTypeSchema from artifact-versions.ts - a proposal always
 * targets one of the same three artifact types that already have
 * versioning.
 */

export const artifactProposalStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type ArtifactProposalStatus = z.infer<typeof artifactProposalStatusSchema>;

/** A natural-language instruction for what to change - the AI turns this into a proposedPatch, validated server-side before it's ever stored. */
export const createArtifactProposalRequestSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(1000),
});
export type CreateArtifactProposalRequest = z.infer<typeof createArtifactProposalRequestSchema>;

export const artifactProposalSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  proposedPatch: z.record(z.string(), z.unknown()),
  rationale: z.string(),
  promptTemplateKey: z.string(),
  promptTemplateVersion: z.number().int(),
  providerId: z.string(),
  model: z.string(),
  status: artifactProposalStatusSchema,
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArtifactProposal = z.infer<typeof artifactProposalSchema>;
