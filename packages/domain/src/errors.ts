export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`An account with email ${email} already exists`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class GoalNotFoundError extends Error {
  constructor(goalId: string) {
    super(`Goal ${goalId} not found in this workspace`);
    this.name = "GoalNotFoundError";
  }
}

export class CustomerProfileNotFoundError extends Error {
  constructor(customerProfileId: string) {
    super(`Customer profile ${customerProfileId} not found in this workspace`);
    this.name = "CustomerProfileNotFoundError";
  }
}

export class OfferNotFoundError extends Error {
  constructor(offerId: string) {
    super(`Offer ${offerId} not found in this workspace`);
    this.name = "OfferNotFoundError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} not found in this workspace`);
    this.name = "TaskNotFoundError";
  }
}

export class BusinessMetricNotFoundError extends Error {
  constructor(metricId: string) {
    super(`Business metric ${metricId} not found in this workspace`);
    this.name = "BusinessMetricNotFoundError";
  }
}

export class AssumptionNotFoundError extends Error {
  constructor(assumptionId: string) {
    super(`Assumption ${assumptionId} not found in this workspace`);
    this.name = "AssumptionNotFoundError";
  }
}

/** Thrown when an assumption's ownerId is set to a user who isn't a member of the assumption's workspace - see assumption-use-cases.ts's assertOwnerInWorkspace. */
export class AssumptionOwnerNotInWorkspaceError extends Error {
  constructor(ownerId: string, workspaceId: string) {
    super(
      `User ${ownerId} is not a member of workspace ${workspaceId} and cannot own a number in it`,
    );
    this.name = "AssumptionOwnerNotInWorkspaceError";
  }
}

export class DecisionNotFoundError extends Error {
  constructor(decisionId: string) {
    super(`Decision ${decisionId} not found in this workspace`);
    this.name = "DecisionNotFoundError";
  }
}

export class EvidenceNotFoundError extends Error {
  constructor(evidenceId: string) {
    super(`Evidence ${evidenceId} not found in this workspace`);
    this.name = "EvidenceNotFoundError";
  }
}

export class ProgramNotFoundError extends Error {
  constructor(programId: string) {
    super(`Program ${programId} not found`);
    this.name = "ProgramNotFoundError";
  }
}

export class DuplicateProgramSlugError extends Error {
  constructor(slug: string) {
    super(`A program with slug ${slug} already exists`);
    this.name = "DuplicateProgramSlugError";
  }
}

export class ProgramVersionNotFoundError extends Error {
  constructor(programVersionId: string) {
    super(`Program version ${programVersionId} not found`);
    this.name = "ProgramVersionNotFoundError";
  }
}

export class DuplicateProgramVersionError extends Error {
  constructor(programId: string, version: number) {
    super(`Program ${programId} already has a version ${version}`);
    this.name = "DuplicateProgramVersionError";
  }
}

/** Thrown when creating/editing a lesson on a program version that is no longer "draft" - see the schema.ts doc comment on programVersions for why publishing freezes it. */
export class ProgramVersionNotEditableError extends Error {
  constructor(programVersionId: string) {
    super(`Program version ${programVersionId} is published and can no longer be edited`);
    this.name = "ProgramVersionNotEditableError";
  }
}

export class LessonNotFoundError extends Error {
  constructor(lessonId: string) {
    super(`Lesson ${lessonId} not found`);
    this.name = "LessonNotFoundError";
  }
}

export class DuplicateLessonSlugError extends Error {
  constructor(slug: string) {
    super(`This program version already has a lesson with slug ${slug}`);
    this.name = "DuplicateLessonSlugError";
  }
}

export class LessonBlockNotFoundError extends Error {
  constructor(lessonBlockId: string) {
    super(`Lesson block ${lessonBlockId} not found`);
    this.name = "LessonBlockNotFoundError";
  }
}

export class EnrollmentNotFoundError extends Error {
  constructor(enrollmentId: string) {
    super(`Enrollment ${enrollmentId} not found`);
    this.name = "EnrollmentNotFoundError";
  }
}

export class AlreadyEnrolledError extends Error {
  constructor(programVersionId: string) {
    super(`Already enrolled in program version ${programVersionId}`);
    this.name = "AlreadyEnrolledError";
  }
}

export class LessonProgressNotFoundError extends Error {
  constructor(lessonId: string) {
    super(`No progress record for lesson ${lessonId} - call startOrResumeLesson first`);
    this.name = "LessonProgressNotFoundError";
  }
}

export class NoteNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Note ${noteId} not found`);
    this.name = "NoteNotFoundError";
  }
}

export class BlockTypeMismatchError extends Error {
  constructor(lessonBlockId: string, expected: string, actual: string) {
    super(`Block ${lessonBlockId} is a "${actual}" block, not "${expected}"`);
    this.name = "BlockTypeMismatchError";
  }
}

export class SelfPrerequisiteError extends Error {
  constructor(lessonId: string) {
    super(`Lesson ${lessonId} cannot be its own prerequisite`);
    this.name = "SelfPrerequisiteError";
  }
}

export class PrerequisiteNotInSameVersionError extends Error {
  constructor(lessonId: string, prerequisiteLessonId: string) {
    super(
      `Lesson ${prerequisiteLessonId} is not in the same program version as lesson ${lessonId}`,
    );
    this.name = "PrerequisiteNotInSameVersionError";
  }
}

export class DuplicatePrerequisiteError extends Error {
  constructor(lessonId: string, prerequisiteLessonId: string) {
    super(`Lesson ${prerequisiteLessonId} is already a prerequisite of lesson ${lessonId}`);
    this.name = "DuplicatePrerequisiteError";
  }
}

export class PrerequisiteNotFoundError extends Error {
  constructor(lessonId: string, prerequisiteLessonId: string) {
    super(`Lesson ${prerequisiteLessonId} is not a prerequisite of lesson ${lessonId}`);
    this.name = "PrerequisiteNotFoundError";
  }
}

export class PrerequisitesNotMetError extends Error {
  constructor(
    lessonId: string,
    public readonly incompleteLessonIds: string[],
  ) {
    super(`Lesson ${lessonId} has unmet prerequisites: ${incompleteLessonIds.join(", ")}`);
    this.name = "PrerequisitesNotMetError";
  }
}

export class LessonApplicationResourceNotFoundError extends Error {
  constructor(resourceType: string, resourceId: string, workspaceId: string) {
    super(`No ${resourceType} ${resourceId} found in workspace ${workspaceId}`);
    this.name = "LessonApplicationResourceNotFoundError";
  }
}

export class DuplicateFormulaVersionError extends Error {
  constructor(key: string, version: number) {
    super(`Formula ${key} already has a version ${version}`);
    this.name = "DuplicateFormulaVersionError";
  }
}

export class FormulaDefinitionNotFoundError extends Error {
  constructor(formulaDefinitionId: string) {
    super(`Formula definition ${formulaDefinitionId} not found`);
    this.name = "FormulaDefinitionNotFoundError";
  }
}

/** Thrown if metadata is created for a (key, version) that has no matching computation in formula-registry.ts - this table must never describe a formula the system can't actually run. */
export class FormulaImplementationNotFoundError extends Error {
  constructor(key: string, version: number) {
    super(`No formula implementation registered for ${key} version ${version}`);
    this.name = "FormulaImplementationNotFoundError";
  }
}

export class NoPublishedFormulaError extends Error {
  constructor(key: string) {
    super(`No published formula definition for key ${key}`);
    this.name = "NoPublishedFormulaError";
  }
}

/** Thrown by computeFormula when the caller's inputs don't exactly match the published definition's inputSchema names - never partially computes on a mismatched input set. */
export class FormulaInputMismatchError extends Error {
  constructor(
    key: string,
    public readonly missing: string[],
    public readonly unexpected: string[],
  ) {
    super(
      `Inputs for formula ${key} do not match its definition` +
        (missing.length > 0 ? `; missing: ${missing.join(", ")}` : "") +
        (unexpected.length > 0 ? `; unexpected: ${unexpected.join(", ")}` : ""),
    );
    this.name = "FormulaInputMismatchError";
  }
}

export class ScenarioNotFoundError extends Error {
  constructor(scenarioId: string) {
    super(`Scenario ${scenarioId} not found in this workspace`);
    this.name = "ScenarioNotFoundError";
  }
}

/** At most one "base"/"best"/"worst" scenario may exist per workspace (schema.ts's partial unique index backs this up) - "custom" scenarios have no such limit. */
export class DuplicateScenarioTypeError extends Error {
  constructor(workspaceId: string, scenarioType: string) {
    super(`Workspace ${workspaceId} already has a "${scenarioType}" scenario`);
    this.name = "DuplicateScenarioTypeError";
  }
}

export class ScenarioOverrideNotFoundError extends Error {
  constructor(scenarioId: string, assumptionId: string) {
    super(`Scenario ${scenarioId} has no override for assumption ${assumptionId}`);
    this.name = "ScenarioOverrideNotFoundError";
  }
}

export class FunnelStageNotFoundError extends Error {
  constructor(funnelStageId: string) {
    super(`Funnel stage ${funnelStageId} not found in this workspace`);
    this.name = "FunnelStageNotFoundError";
  }
}

export class DuplicateFunnelStageOrderError extends Error {
  constructor(workspaceId: string, orderIndex: number) {
    super(`Workspace ${workspaceId} already has a funnel stage at position ${orderIndex}`);
    this.name = "DuplicateFunnelStageOrderError";
  }
}

export class FunnelHasNoStagesError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} has no funnel stages to calculate against`);
    this.name = "FunnelHasNoStagesError";
  }
}

/** Thrown by calculateFunnelRequirements when a stage after the first is missing the conversion rate needed to walk backward through it - see schema.ts's funnelStages doc comment. */
export class MissingConversionRateError extends Error {
  constructor(funnelStageId: string, name: string) {
    super(`Funnel stage "${name}" (${funnelStageId}) has no conversion rate set`);
    this.name = "MissingConversionRateError";
  }
}

/** Thrown by calculateUnitEconomics when the offer has no price set - there is no meaningful gross profit or contribution margin without one. */
export class OfferPriceRequiredError extends Error {
  constructor(offerId: string) {
    super(`Offer ${offerId} has no price set - unit economics needs one`);
    this.name = "OfferPriceRequiredError";
  }
}

export interface MissingCompletionRequirement {
  lessonBlockId: string;
  blockType: string;
  reason: string;
}

/**
 * "Completion is based on accepted outputs and evidence, not time
 * watched" (spec section 3.4). Thrown by updateLessonProgress
 * (progress-use-cases.ts) when a caller tries to mark a lesson
 * "completed" without having actually answered its knowledge checks,
 * submitted its reflections, or linked its build activities to a real
 * business record - see completion-use-cases.ts's
 * assertLessonCompletionRequirementsMet.
 */
export class LessonCompletionRequirementsNotMetError extends Error {
  constructor(
    lessonId: string,
    public readonly missing: MissingCompletionRequirement[],
  ) {
    super(
      `Lesson ${lessonId} cannot be completed yet: ${missing
        .map((m) => `${m.blockType} block ${m.lessonBlockId} (${m.reason})`)
        .join("; ")}`,
    );
    this.name = "LessonCompletionRequirementsNotMetError";
  }
}

export class FunnelStepNotFoundError extends Error {
  constructor(funnelStepId: string) {
    super(`Funnel step ${funnelStepId} not found in this workspace`);
    this.name = "FunnelStepNotFoundError";
  }
}

export class DuplicateFunnelStepOrderError extends Error {
  constructor(workspaceId: string, orderIndex: number) {
    super(`Workspace ${workspaceId} already has a funnel step at position ${orderIndex}`);
    this.name = "DuplicateFunnelStepOrderError";
  }
}

export class ArtifactNotFoundError extends Error {
  constructor(artifactType: string, artifactId: string) {
    super(`No ${artifactType} ${artifactId} found in this workspace`);
    this.name = "ArtifactNotFoundError";
  }
}

export class ArtifactVersionNotFoundError extends Error {
  constructor(artifactType: string, artifactId: string, version: number) {
    super(`No version ${version} recorded for ${artifactType} ${artifactId}`);
    this.name = "ArtifactVersionNotFoundError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found in this workspace`);
    this.name = "ProjectNotFoundError";
  }
}

/** Thrown when a task's blockedByTaskId is set to a task from a different workspace, or to itself - see task-use-cases.ts's assertBlockerInWorkspace. */
export class TaskBlockerInvalidError extends Error {
  constructor(taskId: string, blockedByTaskId: string) {
    super(`Task ${blockedByTaskId} cannot block task ${taskId} in this workspace`);
    this.name = "TaskBlockerInvalidError";
  }
}

export class ExperimentNotFoundError extends Error {
  constructor(experimentId: string) {
    super(`Experiment ${experimentId} not found in this workspace`);
    this.name = "ExperimentNotFoundError";
  }
}

/** Thrown when an experiment's ownerId is set to a user who isn't a member of the experiment's workspace - see experiment-use-cases.ts's assertOwnerInWorkspace. */
export class ExperimentOwnerNotInWorkspaceError extends Error {
  constructor(ownerId: string, workspaceId: string) {
    super(
      `User ${ownerId} is not a member of workspace ${workspaceId} and cannot own an experiment in it`,
    );
    this.name = "ExperimentOwnerNotInWorkspaceError";
  }
}
