/**
 * Free-Access Mode: Error Handling & Recovery
 *
 * Comprehensive error system for free-access operations including:
 * - Custom error classes with context
 * - Error classification and severity levels
 * - Retry logic with exponential backoff
 * - Error logging and monitoring hooks
 * - Recovery strategies and fallbacks
 */

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
  LOW = 'low', // User-facing, recoverable (e.g., validation error)
  MEDIUM = 'medium', // Operational, may need retry (e.g., database timeout)
  HIGH = 'high', // System failure, requires attention (e.g., connection lost)
  CRITICAL = 'critical', // Data integrity risk, needs immediate action
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation', // Input validation failed
  AUTHENTICATION = 'authentication', // Auth/permission issue
  NOT_FOUND = 'not_found', // Resource not found
  DATABASE = 'database', // Database operation failed
  TIMEOUT = 'timeout', // Operation timed out
  RATE_LIMIT = 'rate_limit', // Rate limit exceeded
  NETWORK = 'network', // Network/connection error
  UNKNOWN = 'unknown', // Unknown error
}

/**
 * Custom error class for free-access operations
 */
export class FreeAccessError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly context: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      statusCode?: number;
      context?: Record<string, unknown>;
      retryable?: boolean;
      userMessage?: string;
    } = {},
  ) {
    super(message);
    this.name = 'FreeAccessError';
    this.category = options.category ?? ErrorCategory.UNKNOWN;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.statusCode = options.statusCode ?? 500;
    this.context = options.context ?? {};
    this.retryable = options.retryable ?? false;
    this.userMessage =
      options.userMessage ??
      'An error occurred. Please try again or contact support if the problem persists.';
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, FreeAccessError.prototype);
  }

  /**
   * Convert error to JSON for logging/monitoring
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      retryable: this.retryable,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Specific error constructors
 */

export class ValidationError extends FreeAccessError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      statusCode: 400,
      context,
      retryable: false,
      userMessage: `Invalid input: ${message}`,
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends FreeAccessError {
  constructor(
    message: string = 'Authentication failed',
    context?: Record<string, unknown>,
  ) {
    super(message, {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.MEDIUM,
      statusCode: 403,
      context,
      retryable: false,
      userMessage: 'You do not have permission to perform this action. Admin access required.',
    });
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends FreeAccessError {
  constructor(
    resource: string,
    id: string,
    context?: Record<string, unknown>,
  ) {
    super(`${resource} not found: ${id}`, {
      category: ErrorCategory.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      statusCode: 404,
      context: { resource, id, ...context },
      retryable: false,
      userMessage: `The requested ${resource.toLowerCase()} was not found.`,
    });
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends FreeAccessError {
  constructor(
    message: string,
    operation: string,
    context?: Record<string, unknown>,
  ) {
    super(message, {
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      statusCode: 500,
      context: { operation, ...context },
      retryable: true,
      userMessage: 'A database error occurred. Please try again in a moment.',
    });
    this.name = 'DatabaseError';
  }
}

export class TimeoutError extends FreeAccessError {
  constructor(
    operation: string,
    timeoutMs: number,
    context?: Record<string, unknown>,
  ) {
    super(`Operation timeout: ${operation} (${timeoutMs}ms)`, {
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      statusCode: 504,
      context: { operation, timeoutMs, ...context },
      retryable: true,
      userMessage: 'The operation took too long. Please try again.',
    });
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends FreeAccessError {
  constructor(
    retryAfterSeconds: number,
    context?: Record<string, unknown>,
  ) {
    super(`Rate limit exceeded`, {
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      statusCode: 429,
      context: { retryAfterSeconds, ...context },
      retryable: true,
      userMessage: `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.`,
    });
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends FreeAccessError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      statusCode: 503,
      context,
      retryable: true,
      userMessage: 'Network error. Please check your connection and try again.',
    });
    this.name = 'NetworkError';
  }
}

/**
 * Error wrapping utility - converts unknown errors to FreeAccessError
 */
export function wrapError(
  error: unknown,
  defaultCategory: ErrorCategory = ErrorCategory.UNKNOWN,
  context: Record<string, unknown> = {},
): FreeAccessError {
  if (error instanceof FreeAccessError) {
    return error;
  }

  if (error instanceof Error) {
    // Check if this is a known database error pattern
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      return new NetworkError(error.message, context);
    }

    if (error.message.includes('timeout')) {
      return new TimeoutError(
        context.operation as string || 'unknown',
        context.timeoutMs as number || 5000,
        context,
      );
    }

    return new FreeAccessError(error.message, {
      category: defaultCategory,
      severity: ErrorSeverity.MEDIUM,
      context,
      userMessage: 'An unexpected error occurred. Please try again.',
    });
  }

  return new FreeAccessError('Unknown error occurred', {
    category: defaultCategory,
    severity: ErrorSeverity.MEDIUM,
    context: { originalError: String(error), ...context },
  });
}

/**
 * Error logger for monitoring
 */
export interface ErrorLogEntry {
  id: string;
  error: FreeAccessError;
  context: {
    userId?: string;
    workspaceId?: string;
    endpoint?: string;
    method?: string;
    userAgent?: string;
  };
  attempt?: number;
  nextRetryAt?: Date;
}

/**
 * Error monitoring hooks
 */
export interface ErrorMonitoringHooks {
  onError?: (entry: ErrorLogEntry) => Promise<void>;
  onRetry?: (entry: ErrorLogEntry) => Promise<void>;
  onSuccess?: (entry: ErrorLogEntry) => Promise<void>;
}

/**
 * Global error monitoring registry
 */
let errorMonitoringHooks: ErrorMonitoringHooks = {};

export function setErrorMonitoringHooks(hooks: ErrorMonitoringHooks): void {
  errorMonitoringHooks = hooks;
}

export async function logError(
  error: FreeAccessError,
  context: ErrorLogEntry['context'] = {},
  attempt?: number,
): Promise<void> {
  const entry: ErrorLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    error,
    context,
    attempt,
  };

  // Console logging (always enabled)
  console.error(`[free-access-error] ${error.name}:`, error.toJSON());

  // Call monitoring hook if configured
  if (errorMonitoringHooks.onError) {
    try {
      await errorMonitoringHooks.onError(entry);
    } catch (hookError) {
      console.error('[free-access-error] Error in monitoring hook:', hookError);
    }
  }
}

export async function logRetry(
  error: FreeAccessError,
  nextRetryAt: Date,
  context: ErrorLogEntry['context'] = {},
  attempt?: number,
): Promise<void> {
  const entry: ErrorLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    error,
    context,
    attempt,
    nextRetryAt,
  };

  console.warn(
    `[free-access-error] Retrying after ${error.name}. Next attempt at ${nextRetryAt.toISOString()}`,
  );

  if (errorMonitoringHooks.onRetry) {
    try {
      await errorMonitoringHooks.onRetry(entry);
    } catch (hookError) {
      console.error('[free-access-error] Error in retry hook:', hookError);
    }
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  let delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs,
  );

  // Add jitter to prevent thundering herd
  const jitter = delay * config.jitterFactor * (Math.random() - 0.5) * 2;
  delay = Math.max(0, delay + jitter);

  return Math.round(delay);
}

/**
 * Async operation wrapper with retry logic
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  errorContext: Record<string, unknown> = {},
): Promise<T> {
  let lastError: FreeAccessError | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      const err = wrapError(error, ErrorCategory.UNKNOWN, {
        operation: operationName,
        ...errorContext,
      });

      lastError = err;

      // Only retry if error is retryable
      if (!err.retryable || attempt === config.maxAttempts) {
        await logError(err, { endpoint: operationName }, attempt);
        throw err;
      }

      const delayMs = calculateBackoffDelay(attempt, config);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await logRetry(err, nextRetryAt, { endpoint: operationName }, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should not reach here, but for type safety
  throw lastError || new FreeAccessError('Unknown error in retry loop');
}

/**
 * Graceful degradation strategies
 */
export interface DegradationStrategy {
  name: string;
  condition: (error: FreeAccessError) => boolean;
  handler: <T>(fallback: T) => T;
}

const DEFAULT_DEGRADATION_STRATEGIES: DegradationStrategy[] = [
  {
    name: 'cache-fallback',
    condition: (error) =>
      error.category === ErrorCategory.DATABASE ||
      error.category === ErrorCategory.NETWORK,
    handler: (fallback) => fallback,
  },
  {
    name: 'read-only-mode',
    condition: (error) => error.severity === ErrorSeverity.HIGH,
    handler: (fallback) => fallback,
  },
];

/**
 * Apply graceful degradation
 */
export function applyDegradation<T>(
  error: FreeAccessError,
  fallback: T,
  strategies: DegradationStrategy[] = DEFAULT_DEGRADATION_STRATEGIES,
): T {
  for (const strategy of strategies) {
    if (strategy.condition(error)) {
      console.warn(
        `[free-access-degradation] Applying strategy: ${strategy.name}`,
      );
      return strategy.handler(fallback);
    }
  }

  throw error;
}
