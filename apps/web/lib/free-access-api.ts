/**
 * Free-Access Mode: Enhanced API Route Handler
 *
 * Provides a wrapper for API routes with integrated:
 * - Error handling and conversion
 * - Input validation
 * - Retry logic
 * - Request/response logging
 * - Graceful error responses
 */

import {
  FreeAccessError,
  wrapError,
  logError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  withRetry,
  type RetryConfig,
  ErrorCategory,
} from './free-access-errors';

/**
 * API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    category: string;
    retryable: boolean;
    userMessage: string;
  };
  timestamp: string;
  requestId: string;
}

/**
 * Handler options
 */
export interface HandlerOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  validateInput?: (body: unknown) => void | Promise<void>;
  retryConfig?: RetryConfig;
  timeout?: number;
  logging?: boolean;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: FreeAccessError,
  statusCode?: number,
  requestId: string = generateRequestId(),
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      message: error.message,
      category: error.category,
      retryable: error.retryable,
      userMessage: error.userMessage,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  return Response.json(response, {
    status: statusCode ?? error.statusCode,
    headers: {
      'X-Request-Id': requestId,
      'X-Error-Category': error.category,
      ...(error.retryable ? { 'Retry-After': '60' } : {}),
    },
  });
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  requestId: string = generateRequestId(),
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };

  return Response.json(response, {
    status: statusCode,
    headers: {
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Enhanced API route handler
 */
export async function handleApiRequest<T, R>(
  request: Request,
  handler: (req: Request, body: T) => Promise<R>,
  options: HandlerOptions = {},
): Promise<Response> {
  const requestId = generateRequestId();

  try {
    // 1. Parse request body
    let body: T;
    try {
      body = (await request.json()) as T;
    } catch (error) {
      const err = new ValidationError('Invalid JSON in request body', {
        requestId,
        originalError: error instanceof Error ? error.message : String(error),
      });
      if (options.logging) {
        await logError(err, {}, 1);
      }
      return createErrorResponse(err, 400, requestId);
    }

    // 2. Validate input if validator provided
    if (options.validateInput) {
      try {
        await options.validateInput(body);
      } catch (error) {
        const err = wrapError(error, ErrorCategory.VALIDATION, { requestId, body });
        if (options.logging) {
          await logError(err, {}, 1);
        }
        return createErrorResponse(err, 400, requestId);
      }
    }

    // 3. Call handler with retry logic
    let result: R;
    if (options.retryConfig) {
      result = await withRetry(
        (_attempt) => handler(request, body),
        request.url,
        options.retryConfig,
        { requestId, attempt: 1 },
      );
    } else {
      result = await handler(request, body);
    }

    // 4. Return success response
    return createSuccessResponse(result, 200, requestId);
  } catch (error) {
    const err = wrapError(error, ErrorCategory.UNKNOWN, { requestId });

    if (options.logging) {
      await logError(err, {
        endpoint: request.url,
        method: request.method,
      });
    }

    return createErrorResponse(err, undefined, requestId);
  }
}

/**
 * Type-safe form validator builder
 */
export class FormValidator {
  private errors: Record<string, string> = {};

  field(
    name: string,
    value: unknown,
    validators: Array<{
      check: (v: unknown) => boolean;
      message: string;
    }>,
  ): this {
    for (const validator of validators) {
      if (!validator.check(value)) {
        this.errors[name] = validator.message;
        break;
      }
    }
    return this;
  }

  required(name: string, value: unknown, message?: string): this {
    return this.field(name, value, [
      {
        check: (v) => v !== undefined && v !== null && v !== '',
        message: message ?? `${name} is required`,
      },
    ]);
  }

  email(name: string, value: unknown, message?: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.field(name, value, [
      {
        check: (v) => typeof v === 'string' && emailRegex.test(v),
        message: message ?? `${name} must be a valid email`,
      },
    ]);
  }

  isoDate(name: string, value: unknown, message?: string): this {
    return this.field(name, value, [
      {
        check: (v) => {
          if (typeof v !== 'string') return false;
          const date = new Date(v);
          return !isNaN(date.getTime());
        },
        message: message ?? `${name} must be a valid ISO 8601 date`,
      },
    ]);
  }

  futureDate(name: string, value: unknown, message?: string): this {
    return this.field(name, value, [
      {
        check: (v) => {
          if (typeof v !== 'string') return false;
          const date = new Date(v);
          return !isNaN(date.getTime()) && date > new Date();
        },
        message: message ?? `${name} must be in the future`,
      },
    ]);
  }

  minLength(name: string, value: unknown, min: number, message?: string): this {
    return this.field(name, value, [
      {
        check: (v) => typeof v === 'string' && v.length >= min,
        message: message ?? `${name} must be at least ${min} characters`,
      },
    ]);
  }

  maxLength(name: string, value: unknown, max: number, message?: string): this {
    return this.field(name, value, [
      {
        check: (v) => typeof v === 'string' && v.length <= max,
        message: message ?? `${name} must be at most ${max} characters`,
      },
    ]);
  }

  pattern(
    name: string,
    value: unknown,
    pattern: RegExp,
    message?: string,
  ): this {
    return this.field(name, value, [
      {
        check: (v) => typeof v === 'string' && pattern.test(v),
        message: message ?? `${name} has an invalid format`,
      },
    ]);
  }

  throwIfInvalid(): void {
    if (Object.keys(this.errors).length > 0) {
      throw new ValidationError('Input validation failed', this.errors);
    }
  }

  getErrors(): Record<string, string> {
    return this.errors;
  }

  isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

/**
 * Safe request body parser with type safety and error handling
 */
export async function parseRequestBody<T>(
  request: Request,
  schema?: (data: unknown) => T,
): Promise<T> {
  try {
    const text = await request.text();
    if (!text) {
      throw new ValidationError('Request body is empty');
    }

    const data = JSON.parse(text);

    if (schema) {
      return schema(data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof FreeAccessError) {
      throw error;
    }

    throw new ValidationError('Failed to parse request body', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Auth helper for API routes
 */
export async function requireAuth(
  request: Request,
  validateUser: (cookie: string | null) => Promise<{ role: string } | null>,
): Promise<{ role: string }> {
  const user = await validateUser(request.headers.get('cookie'));

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  return user;
}

/**
 * Admin auth helper
 */
export async function requireAdmin(
  request: Request,
  validateUser: (cookie: string | null) => Promise<{ role: string } | null>,
): Promise<void> {
  const user = await requireAuth(request, validateUser);

  if (user.role !== 'admin') {
    throw new AuthenticationError('Admin access required');
  }
}

/**
 * Resource exists checker
 */
export async function requireResourceExists<T>(
  resourceId: string,
  getter: (id: string) => Promise<T | null>,
  resourceType: string = 'Resource',
): Promise<T> {
  const resource = await getter(resourceId);

  if (!resource) {
    throw new NotFoundError(resourceType, resourceId);
  }

  return resource;
}
