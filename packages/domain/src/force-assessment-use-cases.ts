import { desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { AssumptionConfidence, Force } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";

/**
 * PRD-REVIEW-004 vertical slice: force assessments and constraint
 * diagnosis (README "Review and intelligence" -> "Constraint
 * diagnosis", fourth slice of Phase 7; spec section 6.4's "Diagnostic
 * and Seven Forces"). One assessment per workspace per force -
 * upsertForceAssessment creates or revises the row for one force at a
 * time, the same atomic INSERT ... ON CONFLICT DO UPDATE pattern as
 * upsertBusinessProfile and upsertWeeklyReview.
 *
 * getConstraintDiagnosis then applies Theory-of-Constraints reasoning to
 * whatever has actually been assessed: the weakest assessed force -
 * lowest score, not lowest gap-to-target, since a force nobody has
 * scored can't be crowned "the constraint" no matter what its target
 * says - is the workspace's likely current constraint. A force with no
 * assessment yet is reported as unassessed, never silently treated as a
 * score of 0 or excluded without a trace.
 */

export const FORCES: Force[] = [
  "owner_psychology",
  "vision_planning",
  "sales_marketing",
  "people_culture",
  "operations_systems",
  "finance_measurement",
  "customer_experience",
];

export interface ForceAssessmentRecord {
  id: string;
  workspaceId: string;
  force: Force;
  score: number;
  target: number | null;
  confidence: AssumptionConfidence;
  evidence: string;
  constraintNote: string;
  recommendations: string;
  reassessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertForceAssessmentInput {
  workspaceId: string;
  actorUserId: string;
  force: Force;
  score: number;
  target?: number;
  confidence: AssumptionConfidence;
  evidence: string;
  constraintNote: string;
  recommendations: string;
  reassessedAt?: Date;
}

export async function upsertForceAssessment(
  db: Database,
  input: UpsertForceAssessmentInput,
): Promise<ForceAssessmentRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const values = {
      score: input.score,
      target: input.target ?? null,
      confidence: input.confidence,
      evidence: input.evidence,
      constraintNote: input.constraintNote,
      recommendations: input.recommendations,
      reassessedAt: input.reassessedAt ?? null,
      updatedAt: new Date(),
    };

    const [assessment] = await tx
      .insert(schema.forceAssessments)
      .values({ workspaceId: input.workspaceId, force: input.force, ...values })
      .onConflictDoUpdate({
        target: [schema.forceAssessments.workspaceId, schema.forceAssessments.force],
        set: values,
      })
      .returning();
    if (!assessment) throw new Error("Failed to save force assessment");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "force_assessment.saved",
      metadata: { force: assessment.force, score: assessment.score },
    });

    return assessment as ForceAssessmentRecord;
  });
}

export interface ListForceAssessmentsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listForceAssessments(
  db: Database,
  input: ListForceAssessmentsInput,
): Promise<ForceAssessmentRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.forceAssessments)
    .where(eq(schema.forceAssessments.workspaceId, input.workspaceId))
    .orderBy(desc(schema.forceAssessments.updatedAt));

  return rows as ForceAssessmentRecord[];
}

export interface ConstraintDiagnosisEntry {
  force: Force;
  assessed: boolean;
  score: number | null;
  target: number | null;
  /** target - score; null when either is missing. Informational only - never used to pick the primary constraint, since a wide gap on an untested target isn't the same thing as a genuinely low score. */
  gapToTarget: number | null;
  confidence: AssumptionConfidence | null;
  constraintNote: string | null;
}

export interface ConstraintDiagnosisRecord {
  workspaceId: string;
  /** All seven forces, in the spec's own canonical order, assessed or not. */
  forces: ConstraintDiagnosisEntry[];
  /** Assessed forces only, ascending by score - the weakest first. */
  rankedAssessedForces: ConstraintDiagnosisEntry[];
  /** rankedAssessedForces[0], or null when nothing has been assessed yet - never guessed. */
  primaryConstraint: ConstraintDiagnosisEntry | null;
  unassessedForceCount: number;
}

export interface GetConstraintDiagnosisInput {
  actorUserId: string;
  workspaceId: string;
}

export async function getConstraintDiagnosis(
  db: Database,
  input: GetConstraintDiagnosisInput,
): Promise<ConstraintDiagnosisRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const assessments = await listForceAssessments(db, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
  });
  const byForce = new Map(assessments.map((a) => [a.force, a]));

  const forces: ConstraintDiagnosisEntry[] = FORCES.map((force) => {
    const assessment = byForce.get(force);
    if (!assessment) {
      return {
        force,
        assessed: false,
        score: null,
        target: null,
        gapToTarget: null,
        confidence: null,
        constraintNote: null,
      };
    }
    return {
      force,
      assessed: true,
      score: assessment.score,
      target: assessment.target,
      gapToTarget: assessment.target === null ? null : assessment.target - assessment.score,
      confidence: assessment.confidence,
      constraintNote: assessment.constraintNote,
    };
  });

  const rankedAssessedForces = forces
    .filter((f) => f.assessed)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  return {
    workspaceId: input.workspaceId,
    forces,
    rankedAssessedForces,
    primaryConstraint: rankedAssessedForces[0] ?? null,
    unassessedForceCount: forces.length - rankedAssessedForces.length,
  };
}
