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
