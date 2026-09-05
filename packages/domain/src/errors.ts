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
