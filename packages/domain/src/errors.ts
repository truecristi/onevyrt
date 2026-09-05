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
