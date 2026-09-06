import { createHmac, randomBytes, createHash } from 'crypto';

/**
 * Security module for free-access admin API
 * Provides:
 * - Input validation (SQL injection prevention)
 * - HMAC request signing
 * - Rate limiting per admin
 * - Audit log tampering detection
 * - Security headers
 */

// Constants
const HMAC_ALGORITHM = 'sha256';
const HMAC_SECRET_ENV_VAR = 'ADMIN_API_HMAC_SECRET';
const MAX_WORKSPACE_IDS_BULK = 100;
const ADMIN_RATE_LIMIT_WINDOW = 60; // 60 seconds
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 30;

/**
 * Input validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Authorization errors
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * HMAC signature errors
 */
export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureError';
  }
}

/**
 * Audit log integrity errors
 */
export class AuditIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditIntegrityError';
  }
}

/**
 * Input validation for free-access toggle request
 */
export function validateToggleRequest(data: any): {
  workspaceId: string;
  enabled: boolean;
} {
  if (!data) {
    throw new ValidationError('Request body is required');
  }

  const { workspaceId, enabled } = data;

  // Validate workspaceId: must be a non-empty string, UUID format
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new ValidationError('workspaceId is required and must be a string');
  }

  if (workspaceId.length > 255) {
    throw new ValidationError('workspaceId exceeds maximum length (255)');
  }

  // UUID v4 validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(workspaceId)) {
    throw new ValidationError('workspaceId must be a valid UUID v4');
  }

  // Validate enabled: must be a boolean
  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled is required and must be a boolean');
  }

  return { workspaceId, enabled };
}

/**
 * Input validation for bulk free-access request
 */
export function validateBulkRequest(data: any): {
  workspaceIds: string[];
  enabled: boolean;
} {
  if (!data) {
    throw new ValidationError('Request body is required');
  }

  const { workspaceIds, enabled } = data;

  // Validate workspaceIds: must be an array
  if (!Array.isArray(workspaceIds)) {
    throw new ValidationError('workspaceIds must be an array');
  }

  if (workspaceIds.length === 0) {
    throw new ValidationError('workspaceIds must not be empty');
  }

  if (workspaceIds.length > MAX_WORKSPACE_IDS_BULK) {
    throw new ValidationError(
      `workspaceIds must not exceed ${MAX_WORKSPACE_IDS_BULK} items`
    );
  }

  // Validate each workspaceId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const id of workspaceIds) {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('All workspaceIds must be non-empty strings');
    }

    if (id.length > 255) {
      throw new ValidationError('workspaceId exceeds maximum length (255)');
    }

    if (!uuidRegex.test(id)) {
      throw new ValidationError(`Invalid UUID in workspaceIds: ${id}`);
    }
  }

  // Validate enabled: must be a boolean
  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled is required and must be a boolean');
  }

  return { workspaceIds, enabled };
}

/**
 * Input validation for audit log query parameters
 */
export function validateAuditLogQuery(params: URLSearchParams): {
  action?: string;
  workspaceId?: string;
  userId?: string;
  limit: number;
  offset: number;
} {
  const action = params.get('action')?.trim() || undefined;
  const workspaceId = params.get('workspaceId')?.trim() || undefined;
  const userId = params.get('userId')?.trim() || undefined;
  const limitStr = params.get('limit') || '100';
  const offsetStr = params.get('offset') || '0';

  // Validate action
  if (action) {
    if (action.length > 100) {
      throw new ValidationError('action exceeds maximum length (100)');
    }
    // Ensure it's alphanumeric + underscores
    if (!/^[a-zA-Z0-9_]+$/.test(action)) {
      throw new ValidationError('action contains invalid characters');
    }
  }

  // Validate workspaceId
  if (workspaceId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      throw new ValidationError('workspaceId must be a valid UUID v4');
    }
  }

  // Validate userId
  if (userId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new ValidationError('userId must be a valid UUID v4');
    }
  }

  // Validate limit and offset
  let limit = 100;
  let offset = 0;

  try {
    limit = parseInt(limitStr, 10);
    offset = parseInt(offsetStr, 10);
  } catch {
    throw new ValidationError('limit and offset must be valid integers');
  }

  if (limit < 1 || limit > 500) {
    throw new ValidationError('limit must be between 1 and 500');
  }

  if (offset < 0) {
    throw new ValidationError('offset must be non-negative');
  }

  return { action, workspaceId, userId, limit, offset };
}

/**
 * Generate HMAC signature for request validation
 */
export function generateHmacSignature(
  method: string,
  path: string,
  timestamp: number,
  bodyHash: string
): string {
  const secret = process.env[HMAC_SECRET_ENV_VAR];
  if (!secret) {
    throw new SignatureError(`${HMAC_SECRET_ENV_VAR} environment variable not set`);
  }

  const message = `${method}|${path}|${timestamp}|${bodyHash}`;
  return createHmac(HMAC_ALGORITHM, secret).update(message).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(
  method: string,
  path: string,
  timestamp: number,
  bodyHash: string,
  providedSignature: string
): boolean {
  try {
    const expectedSignature = generateHmacSignature(method, path, timestamp, bodyHash);
    // Use constant-time comparison to prevent timing attacks
    return constantTimeCompare(providedSignature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Calculate SHA256 hash of body
 */
export function calculateBodyHash(body: string | Buffer): string {
  if (typeof body === 'string') {
    body = Buffer.from(body);
  }
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Rate limiter state (in-memory, should be moved to Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for admin user
 */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const key = `admin:${userId}`;
  const state = rateLimitStore.get(key);

  if (!state || now >= state.resetAt) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + ADMIN_RATE_LIMIT_WINDOW * 1000,
    });
    return true;
  }

  // Within window
  if (state.count < ADMIN_RATE_LIMIT_MAX_REQUESTS) {
    state.count++;
    return true;
  }

  return false;
}

/**
 * Get remaining rate limit requests
 */
export function getRateLimitRemaining(userId: string): number {
  const key = `admin:${userId}`;
  const state = rateLimitStore.get(key);

  if (!state || Date.now() >= state.resetAt) {
    return ADMIN_RATE_LIMIT_MAX_REQUESTS;
  }

  return Math.max(0, ADMIN_RATE_LIMIT_MAX_REQUESTS - state.count);
}

/**
 * Create audit log entry with integrity hash
 */
export function createSecureAuditLogEntry(
  workspaceId: string,
  userId: string,
  action: string,
  metadata: Record<string, any>
): Record<string, any> {
  // Generate integrity hash of the audit entry
  const timestamp = Date.now();
  const integrityData = `${workspaceId}|${userId}|${action}|${timestamp}`;
  const integrityHash = createHash('sha256').update(integrityData).digest('hex');

  return {
    workspaceId,
    userId,
    action,
    metadata: {
      ...metadata,
      integrityHash,
      timestamp,
    },
  };
}

/**
 * Verify audit log entry integrity
 */
export function verifyAuditLogIntegrity(
  workspaceId: string,
  userId: string,
  action: string,
  metadata: Record<string, any>
): boolean {
  const storedHash = metadata?.integrityHash;
  const timestamp = metadata?.timestamp;

  if (!storedHash || !timestamp) {
    throw new AuditIntegrityError('Missing integrity metadata');
  }

  // Recalculate integrity hash
  const integrityData = `${workspaceId}|${userId}|${action}|${timestamp}`;
  const recalculatedHash = createHash('sha256').update(integrityData).digest('hex');

  // Verify hash matches (constant-time comparison)
  return constantTimeCompare(storedHash, recalculatedHash);
}

/**
 * Generate security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  userId: string,
  eventType: string,
  details: Record<string, any>
): Promise<void> {
  try {
    console.log(`[SECURITY] ${eventType} - User: ${userId}`, JSON.stringify(details));
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Generate secure token for admin operations
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

export const RATE_LIMIT_DEFAULTS = {
  WINDOW_SECONDS: ADMIN_RATE_LIMIT_WINDOW,
  MAX_REQUESTS: ADMIN_RATE_LIMIT_MAX_REQUESTS,
};
