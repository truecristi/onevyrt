/**
 * Type definitions for Free-Access Mode API
 *
 * Provides comprehensive type safety for all free-access operations.
 * Import these types in route handlers and lib functions.
 */

/**
 * Free-access mode context attached to requests
 */
export interface FreeAccessContext {
  /** The workspace being accessed */
  workspaceId: string;

  /** Whether free-access mode is currently active */
  isFreeAccess: boolean;

  /** ISO 8601 timestamp when free-access expires (if active) */
  expiresAt?: string;
}

/**
 * Request body for enabling free-access mode
 */
export interface EnableFreeAccessRequest {
  /** The workspace to enable free-access for */
  workspaceId: string;

  /** ISO 8601 timestamp when free-access expires (must be future) */
  expiresAt: string;
}

/**
 * Response from enable/disable free-access operations
 */
export interface FreeAccessOperationResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Human-readable message explaining the result */
  message: string;

  /** The workspace ID that was operated on (if successful) */
  workspaceId?: string;

  /** The new expiry timestamp (if enabling) */
  expiresAt?: string;

  /** Human-readable time remaining (e.g., "30 days 12h") */
  expiresIn?: string;

  /** Additional error details (if operation failed) */
  error?: string;
}

/**
 * Response from status check operation
 */
export interface FreeAccessStatusResponse extends FreeAccessOperationResponse {
  /** Whether free-access is currently active for this workspace */
  isFreeAccess?: boolean;
}

/**
 * Request body for disabling free-access mode
 */
export interface DisableFreeAccessRequest {
  /** The workspace to disable free-access for */
  workspaceId: string;
}

/**
 * Admin operation response types
 */
export type AdminFreeAccessResponse = FreeAccessOperationResponse | FreeAccessStatusResponse;

/**
 * Database row type for workspaces (with plan_metadata field)
 */
export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  members: Array<{ userId: string; role: string }>;
  created_at: Date;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  plan_metadata?: {
    free_access_until?: string;
    [key: string]: unknown;
  };
}

/**
 * Internal cache entry for free-access checks
 */
export interface FreeAccessCacheEntry {
  /** The expiry timestamp, or null if not active */
  until: string | null;

  /** Timestamp when this cache entry was created */
  checkedAt: number;
}

/**
 * Notification suppression rules
 */
export type NotificationType =
  | "submission_pending_review"
  | "learner_stuck"
  | "learner_quiet"
  | "cohort_session_reminder";

export const FREE_ACCESS_SUPPRESSED_NOTIFICATIONS: NotificationType[] = [
  "submission_pending_review",
  "learner_stuck",
  "learner_quiet",
  "cohort_session_reminder",
];

/**
 * Error types that can be thrown by free-access operations
 */
export class FreeAccessError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "FreeAccessError";
  }
}

export class InvalidTimestampError extends FreeAccessError {
  constructor(timestamp: string) {
    super(`Invalid ISO 8601 timestamp: ${timestamp}`, "INVALID_TIMESTAMP");
  }
}

export class PastExpiryError extends FreeAccessError {
  constructor(timestamp: string) {
    super(`Expiry timestamp must be in the future: ${timestamp}`, "PAST_EXPIRY");
  }
}

export class WorkspaceNotFoundError extends FreeAccessError {
  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`, "WORKSPACE_NOT_FOUND");
  }
}

export class UnauthorizedError extends FreeAccessError {
  constructor(message = "Admin access required") {
    super(message, "UNAUTHORIZED");
  }
}

/**
 * Validation utilities
 */
// A plain object, not `namespace` — ESLint's no-namespace flags the
// `namespace` keyword, and an object literal gives identical dotted-access
// call sites (FreeAccessValidation.isValidIso8601(...)) without it. Members
// reference each other via the object's own name (safe: only called once
// FreeAccessValidation is fully initialized, never during initialization).
export const FreeAccessValidation = {
  /**
   * Validate an ISO 8601 timestamp string
   * @returns true if valid ISO 8601, false otherwise
   */
  isValidIso8601(timestamp: string): boolean {
    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) && date.toISOString().startsWith(timestamp.split("T")[0]!);
    } catch {
      return false;
    }
  },

  /**
   * Validate that a timestamp is in the future
   * @returns true if timestamp is after current time, false otherwise
   */
  isFutureTimestamp(timestamp: string): boolean {
    try {
      const date = new Date(timestamp);
      return date.getTime() > Date.now();
    } catch {
      return false;
    }
  },

  /**
   * Validate workspace ID format (should be hex string)
   * @returns true if valid hex, false otherwise
   */
  isValidWorkspaceId(id: string): boolean {
    return /^[a-f0-9]{16}$/.test(id);
  },

  /**
   * Validate enable free-access request
   * @returns { valid: false, error: string } or { valid: true }
   */
  validateEnableRequest(
    req: unknown,
  ): { valid: false; error: string } | { valid: true } {
    const body = req as Record<string, unknown>;

    if (typeof body?.workspaceId !== "string") {
      return { valid: false, error: "Missing or invalid workspaceId" };
    }

    if (typeof body?.expiresAt !== "string") {
      return { valid: false, error: "Missing or invalid expiresAt" };
    }

    if (!FreeAccessValidation.isValidIso8601(body.expiresAt)) {
      return { valid: false, error: "expiresAt must be valid ISO 8601" };
    }

    if (!FreeAccessValidation.isFutureTimestamp(body.expiresAt)) {
      return { valid: false, error: "expiresAt must be in the future" };
    }

    return { valid: true };
  },

  /**
   * Validate disable free-access request
   * @returns { valid: false, error: string } or { valid: true }
   */
  validateDisableRequest(
    req: unknown,
  ): { valid: false; error: string } | { valid: true } {
    const body = req as Record<string, unknown>;

    if (typeof body?.workspaceId !== "string") {
      return { valid: false, error: "Missing or invalid workspaceId" };
    }

    return { valid: true };
  },
};

/**
 * Response builders for consistent API responses
 */
export const FreeAccessResponses = {
  success(
    message: string,
    workspaceId: string,
    expiresAt?: string,
    expiresIn?: string,
  ): FreeAccessOperationResponse {
    return {
      success: true,
      message,
      workspaceId,
      ...(expiresAt && { expiresAt }),
      ...(expiresIn && { expiresIn }),
    };
  },

  error(message: string, error?: string): FreeAccessOperationResponse {
    return {
      success: false,
      message,
      ...(error && { error }),
    };
  },

  status(
    isFreeAccess: boolean,
    workspaceId: string,
    expiresAt?: string,
    expiresIn?: string,
  ): FreeAccessStatusResponse {
    return {
      success: true,
      workspaceId,
      isFreeAccess,
      message: isFreeAccess
        ? `Free-access active (expires in ${expiresIn})`
        : "Free-access is not active",
      ...(expiresAt && { expiresAt }),
      ...(expiresIn && { expiresIn }),
    };
  },
};

/**
 * Type guard functions
 */
export const FreeAccessTypeGuards = {
  isEnableRequest(value: unknown): value is EnableFreeAccessRequest {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).workspaceId === "string" &&
      typeof (value as Record<string, unknown>).expiresAt === "string"
    );
  },

  isDisableRequest(value: unknown): value is DisableFreeAccessRequest {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).workspaceId === "string"
    );
  },

  isFreeAccessContext(value: unknown): value is FreeAccessContext {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).workspaceId === "string" &&
      typeof (value as Record<string, unknown>).isFreeAccess === "boolean"
    );
  },
};

/**
 * Constants
 */
export const FREE_ACCESS_CONSTANTS = {
  /** Cache TTL in milliseconds */
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

  /** Auto-approval signature */
  AUTO_APPROVAL_SIGNATURE: "auto (free-access)",

  /** Maximum time to allow free-access (prevents unlimited trials) */
  MAX_DURATION_MS: 365 * 24 * 60 * 60 * 1000, // 1 year

  /** Minimum time to allow free-access (prevents instant expiry) */
  MIN_DURATION_MS: 1 * 60 * 1000, // 1 minute

  /** List of routes that don't require free-access checks */
  EXEMPT_ROUTES: ["/api/auth/", "/api/health/", "/api/public/"],
} as const;
