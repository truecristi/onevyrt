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
