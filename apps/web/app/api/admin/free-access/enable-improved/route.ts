/**
 * POST /api/admin/free-access/enable-improved
 *
 * Improved admin endpoint to enable free-access mode with:
 * - Comprehensive error handling
 * - Input validation with detailed error messages
 * - Retry logic with backoff
 * - Structured error responses
 * - Request tracking
 *
 * Request body:
 * {
 *   "workspaceId": "workspace-hex-id",
 *   "expiresAt": "2026-10-03T12:00:00Z",
 *   "reason": "trial" | "beta" | "promotional",
 *   "requestedBy": "admin@example.com"
 * }
 *
 * Response on success:
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "workspace-hex-id",
 *     "expiresAt": "2026-10-03T12:00:00Z",
 *     "enabledAt": "2026-09-03T12:00:00Z"
 *   },
 *   "timestamp": "2026-09-03T12:00:00Z",
 *   "requestId": "1234567890-abc123def"
 * }
 *
 * Response on error:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "Workspace not found",
 *     "category": "not_found",
 *     "retryable": false,
 *     "userMessage": "The requested workspace was not found."
 *   },
 *   "timestamp": "2026-09-03T12:00:00Z",
 *   "requestId": "1234567890-abc123def"
 * }
 */

import { currentUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import {
  enableFreeAccessMode,
  clearFreeAccessCache,
} from '@/lib/free-access-mode';
import { getWorkspace } from '@/lib/workspaces';
import {
  createErrorResponse,
  createSuccessResponse,
  FormValidator,
  parseRequestBody,
  requireAdmin,
} from '@/lib/free-access-api';
import {
  ValidationError,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  logError,
  type FreeAccessError,
} from '@/lib/free-access-errors';

/**
 * Request/response types
 */
interface EnableFreeAccessRequest {
  workspaceId: string;
  expiresAt: string; // ISO 8601
  reason?: 'trial' | 'beta' | 'promotional';
  requestedBy?: string;
}

interface EnableFreeAccessResponse {
  workspaceId: string;
  expiresAt: string;
  enabledAt: string;
  reason?: string;
}

/**
 * Input validation
 */
function validateRequest(body: unknown): EnableFreeAccessRequest {
  const validator = new FormValidator();
  const data = body as Record<string, unknown>;

  // Validate workspaceId
  validator.required('workspaceId', data.workspaceId);
  if (typeof data.workspaceId === 'string') {
    validator.minLength('workspaceId', data.workspaceId, 1);
    validator.maxLength('workspaceId', data.workspaceId, 255);
  }

  // Validate expiresAt
  validator.required('expiresAt', data.expiresAt);
  if (typeof data.expiresAt === 'string') {
    validator.isoDate('expiresAt', data.expiresAt);
    validator.futureDate(
      'expiresAt',
      data.expiresAt,
      'expiresAt must be in the future (cannot enable free-access in the past)',
    );
  }

  // Validate reason if provided
  if (data.reason) {
    validator.pattern(
      'reason',
      data.reason,
      /^(trial|beta|promotional)$/,
      'reason must be one of: trial, beta, promotional',
    );
  }

  validator.throwIfInvalid();

  return {
    workspaceId: data.workspaceId as string,
    expiresAt: data.expiresAt as string,
    ...(typeof data.reason === 'string' ? { reason: data.reason as EnableFreeAccessRequest['reason'] } : {}),
    ...(typeof data.requestedBy === 'string' ? { requestedBy: data.requestedBy } : {}),
  };
}

/**
 * Handler function
 */
async function enableFreeAccessHandler(
  request: Request,
  body: EnableFreeAccessRequest,
): Promise<EnableFreeAccessResponse> {
  // 1. Verify admin access
  await requireAdmin(request, async (cookie) => {
    const user = await currentUser(cookie);
    if (!user) return null;
    return { role: isAdminEmail(user.email) ? "admin" : "user" };
  });

  // 2. Verify workspace exists
  await withRetry(
    async () => {
      const workspace = await getWorkspace(body.workspaceId);
      if (!workspace) {
        throw new ValidationError('Workspace not found', {
          workspaceId: body.workspaceId,
        });
      }
      return workspace;
    },
    'getWorkspace',
    DEFAULT_RETRY_CONFIG,
    { workspaceId: body.workspaceId },
  );

  // 3. Enable free-access in database
  const success = await withRetry(
    async () => {
      return await enableFreeAccessMode(body.workspaceId, body.expiresAt);
    },
    'enableFreeAccessMode',
    {
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: 5, // More retry attempts for database operations
    },
    { workspaceId: body.workspaceId, operation: 'enableFreeAccess' },
  );

  if (!success) {
    throw new ValidationError('Failed to update workspace in database', {
      workspaceId: body.workspaceId,
      operation: 'enableFreeAccessMode',
    });
  }

  // 4. Clear cache
  clearFreeAccessCache(body.workspaceId);

  return {
    workspaceId: body.workspaceId,
    expiresAt: body.expiresAt,
    enabledAt: new Date().toISOString(),
    ...(body.reason ? { reason: body.reason } : {}),
  };
}

/**
 * Route handler
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Parse and validate request
    const body = await parseRequestBody<EnableFreeAccessRequest>(
      request,
      validateRequest,
    );

    // Execute handler with retry logic
    const result = await enableFreeAccessHandler(request, body);

    // Return success response
    return createSuccessResponse(result, 200, requestId);
  } catch (error) {
    // Convert error and create error response
    const freeAccessError = error as FreeAccessError;

    // Log the error for monitoring
    await logError(freeAccessError, {
      endpoint: request.url,
      method: request.method,
    });

    return createErrorResponse(freeAccessError, undefined, requestId);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    },
  });
}
