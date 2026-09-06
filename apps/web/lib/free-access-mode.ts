/**
 * Free-Access Mode API
 *
 * Complete implementation for bypassing programme gates and enabling auto-approval
 * flows for trial/freemium workspaces. Provides five core utilities:
 *
 * 1. checkFreeAccessMode(workspaceId)       — Query helper: is this workspace in free-access?
 * 2. bypassGatesIfFreeAccess(enrollment)    — Enrollment modifier: unlock all lessons
 * 3. autoApproveIfFreeAccess(submission)    — Submission auto-approver: instant approval
 * 4. skipCoachNotificationsIfFreeAccess()   — Coach message suppressor: no coach pings
 * 5. Integration points for auth/context    — Middleware + enrollment state injection
 *
 * Database: `workspaces.free_access_until` (timestamp, nullable)
 * - If set and NOW() < free_access_until: workspace is in free-access mode
 * - Stored as ISO 8601 string in the workspace plan_metadata JSONB field
 * - Set via direct UPDATE or via /api/admin/free-access/* routes
 *
 * Integration Flow:
 * - Auth middleware checks and caches in context
 * - Enrollment methods check before returning status/gate decisions
 * - Submissions auto-approve if free-access is active
 * - Coach notifications are suppressed (no dedupe key collision)
 */

import { pgPool, type Queryable } from "./db";
import type { Enrollment, Submission } from "@onevyrt/engine";

/**
 * Cached free-access mode check result with TTL.
 * Key: workspaceId, Value: { until: ISO8601 | null, checkedAt: timestamp }
 * Prevents N DB queries per request if multiple operations touch the same workspace.
 */
const FREE_ACCESS_CACHE = new Map<string, { until: string | null; checkedAt: number }>();
const FREE_ACCESS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * 1. DATABASE QUERY HELPER
 *
 * Checks if a workspace has active free-access enabled.
 * Returns the ISO 8601 expiry timestamp if active, null otherwise.
 * Results are cached for 5 minutes to reduce DB hits.
 *
 * @param workspaceId — The workspace to check
 * @param db — Optional: Queryable connection (uses shared pool if omitted)
 * @returns ISO 8601 expiry timestamp if active, null if not/expired
 *
 * Example:
 *   const expiryTime = await checkFreeAccessMode(ws.id);
 *   if (expiryTime) console.log("Free access active until:", expiryTime);
 */
export async function checkFreeAccessMode(
  workspaceId: string,
  db: Queryable = pgPool(),
): Promise<string | null> {
  // Check cache first (5-minute TTL)
  const cached = FREE_ACCESS_CACHE.get(workspaceId);
  if (cached && Date.now() - cached.checkedAt < FREE_ACCESS_CACHE_TTL_MS) {
    return cached.until;
  }

  try {
    const res = await db.query<{
      free_access_until: string | null;
    }>(
      `SELECT
        CASE
          WHEN (plan_metadata->>'free_access_until')::timestamptz > NOW()
          THEN plan_metadata->>'free_access_until'
          ELSE NULL
        END AS free_access_until
       FROM workspaces
       WHERE id = $1`,
      [workspaceId],
    );

    const until = res.rows[0]?.free_access_until ?? null;
    FREE_ACCESS_CACHE.set(workspaceId, { until, checkedAt: Date.now() });
    return until;
  } catch (error) {
    console.error(
      `[free-access] Error checking free-access mode for workspace ${workspaceId}:`,
      error,
    );
    // Default to NOT free-access on error (fail safe)
    FREE_ACCESS_CACHE.set(workspaceId, { until: null, checkedAt: Date.now() });
    return null;
  }
}

/**
 * Clear free-access cache for a workspace (e.g., after enabling/disabling).
 * Called by admin routes after mutating free_access_until.
 *
 * @param workspaceId — The workspace whose cache should be cleared
 */
export function clearFreeAccessCache(workspaceId: string): void {
  FREE_ACCESS_CACHE.delete(workspaceId);
}

/**
 * 2. ENROLLMENT MODIFIER
 *
 * Modifies an enrollment object to unlock all lessons and bypass sequential gating.
 * Mutates the enrollment in-place; returns the same object for chaining.
 *
 * Used in routes that return enrollment state — ensures free-access learners
 * see every lesson as unlocked and can navigate freely without coach gates.
 *
 * @param enrollment — The enrollment to modify
 * @param isFreeAccess — If true, unlock all lessons; if false, return unchanged
 * @returns The modified enrollment (same reference, mutated)
 *
 * Example:
 *   let enrollment = await getEnrollment(wsId);
 *   if (freeAccess) {
 *     bypassGatesIfFreeAccess(enrollment, true);
 *   }
 *   res.json(enrollment);
 */
export function bypassGatesIfFreeAccess(
  enrollment: Enrollment,
  isFreeAccess: boolean,
): Enrollment {
  if (!isFreeAccess) return enrollment;

  // Unlock all lessons: set status to "available" (the permission to start)
  // for any lesson that is currently gated — either explicitly "locked" or
  // (the common case) carrying no stored status at all, which is what
  // effectiveStatus() falls back to computing as "locked" for a lesson that
  // hasn't reached its turn yet. Lessons with real recorded progress
  // (in_progress / submitted / approved / etc) are left untouched — we only
  // bypass the sequential gate, not the learner's actual progress.
  for (const lesson of enrollment.lessons) {
    if (!lesson.status || lesson.status === "locked") {
      lesson.status = "available";
    }
  }

  // Mark enrollment as not access-paused (in case it was)
  enrollment.accessGranted = true;

  return enrollment;
}

/**
 * 3. SUBMISSION AUTO-APPROVER
 *
 * Marks a submission as auto-approved if free-access is active.
 * Used in submitAssignment and review workflows to instantly approve
 * submissions without coach intervention.
 *
 * Mutates the submission in-place; returns it for chaining.
 *
 * @param submission — The submission to auto-approve
 * @param isFreeAccess — If true, set approval status; if false, return unchanged
 * @param timestamp — Optional: override the reviewedAt timestamp (default: now)
 * @returns The modified submission (same reference, mutated)
 *
 * Example:
 *   let submission = { ... reviewStatus: "pending" ... };
 *   if (freeAccess) {
 *     autoApproveIfFreeAccess(submission, true);
 *   }
 *   // submission.reviewStatus === "approved" now
 */
export function autoApproveIfFreeAccess(
  submission: Submission,
  isFreeAccess: boolean,
  timestamp?: string,
): Submission {
  if (!isFreeAccess) return submission;

  submission.reviewStatus = "approved";
  submission.reviewedAt = timestamp ?? new Date().toISOString();
  submission.reviewedBy = "auto (free-access)";
  // Explicitly clear any feedback — no coach review needed
  delete submission.coachFeedback;

  return submission;
}

/**
 * 4. COACH NOTIFICATION SUPPRESSOR
 *
 * Determines if coach notifications should be suppressed for a given workspace.
 * Called before createNotification() in programme-notifications.ts to prevent
 * unnecessary coach pings (since lessons auto-approve anyway).
 *
 * @param workspaceId — The workspace to check
 * @param notificationType — The notification type (e.g., "submission_pending_review")
 * @returns true if notifications should be skipped, false if they should proceed
 *
 * Example:
 *   if (await skipCoachNotificationsIfFreeAccess(wsId, "submission_pending_review")) {
 *     return; // Don't notify coaches
 *   }
 *   // Proceed with normal notification flow
 */
export async function skipCoachNotificationsIfFreeAccess(
  workspaceId: string,
  notificationType: string,
): Promise<boolean> {
  // Only suppress coach-specific notifications
  const coachNotificationTypes = [
    "submission_pending_review",
    "learner_stuck",
    "learner_quiet",
    "cohort_session_reminder",
  ];

  if (!coachNotificationTypes.includes(notificationType)) {
    return false; // Don't suppress non-coach notifications
  }

  const freeAccessUntil = await checkFreeAccessMode(workspaceId);
  return freeAccessUntil !== null; // Suppress if free-access is active
}

/**
 * 5. CONTEXT & INTEGRATION POINTS
 *
 * These utilities integrate free-access checking into existing request flows.
 * They are called by middleware and route handlers to thread the mode through.
 */

/**
 * Request context object that carries free-access mode state.
 * Attached to Request in middleware; used by route handlers.
 */
export interface FreeAccessContext {
  workspaceId: string;
  isFreeAccess: boolean;
  expiresAt?: string; // ISO 8601 expiry timestamp
}

/**
 * Middleware: Check and attach free-access mode to request context.
 * Called early in request processing (e.g., in auth middleware after currentUser).
 *
 * Usage (in an API route or middleware):
 *   const context = await injectFreeAccessContext(req, workspaceId);
 *   // Pass context through to enrollment/submission operations
 *
 * @param workspaceId — The workspace to check
 * @returns FreeAccessContext object with mode and expiry timestamp
 */
export async function injectFreeAccessContext(
  workspaceId: string,
): Promise<FreeAccessContext> {
  const expiresAt = await checkFreeAccessMode(workspaceId);
  return {
    workspaceId,
    isFreeAccess: expiresAt !== null,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

/**
 * ENROLLMENT STATE INTEGRATION
 *
 * These functions thread free-access mode through the enrollment workflow.
 * Called by lib/enrollments.ts or routes that fetch/update enrollments.
 */

/**
 * Get enrollment with free-access gates pre-bypassed if applicable.
 * Wraps the normal getEnrollment() flow to auto-apply bypassGatesIfFreeAccess.
 *
 * Usage:
 *   const enrollment = await getEnrollmentWithFreeAccess(wsId);
 *   // If free-access is active, all lessons are unlocked
 *
 * @param workspaceId — The workspace
 * @param getEnrollmentFn — The normal getEnrollment function from lib/enrollments.ts
 * @returns The enrollment with gates bypassed if free-access is active
 */
export async function getEnrollmentWithFreeAccess(
  workspaceId: string,
  getEnrollmentFn: (wsId: string) => Promise<Enrollment | null>,
): Promise<Enrollment | null> {
  const enrollment = await getEnrollmentFn(workspaceId);
  if (!enrollment) return null;

  const isFreeAccess = (await checkFreeAccessMode(workspaceId)) !== null;
  return bypassGatesIfFreeAccess(enrollment, isFreeAccess);
}

/**
 * SUBMISSION WORKFLOW INTEGRATION
 *
 * These helpers integrate auto-approval into the submission review flow.
 */

/**
 * Auto-approve a submission if free-access is active.
 * Intended for use in submitAssignment() after creating the submission.
 *
 * Usage (in lib/enrollments.ts submitAssignment):
 *   const submission = { ... reviewStatus: "pending" ... };
 *   const isFreeAccess = (await checkFreeAccessMode(workspaceId)) !== null;
 *   await autoApproveSubmissionIfFreeAccess(submission, isFreeAccess);
 *   // Now submission has auto-approved status
 *
 * @param submission — The submission to possibly auto-approve
 * @param isFreeAccess — Whether free-access is active
 * @returns The modified submission
 */
export function autoApproveSubmissionIfFreeAccess(
  submission: Submission,
  isFreeAccess: boolean,
): Submission {
  return autoApproveIfFreeAccess(submission, isFreeAccess);
}

/**
 * ADMIN OPERATIONS
 *
 * These functions are called by admin routes (/api/admin/free-access/*) to
 * enable, disable, or check free-access mode for workspaces.
 */

/**
 * Enable free-access mode for a workspace until a given timestamp.
 * Called by POST /api/admin/free-access/enable.
 *
 * @param workspaceId — The workspace to enable free-access for
 * @param expiresAt — ISO 8601 timestamp when free-access expires
 * @returns true if successful, false if workspace not found
 */
export async function enableFreeAccessMode(
  workspaceId: string,
  expiresAt: string,
): Promise<boolean> {
  try {
    const res = await pgPool().query(
      `UPDATE workspaces
       SET plan_metadata = jsonb_set(
             COALESCE(plan_metadata, '{}'::jsonb),
             '{free_access_until}',
             to_jsonb($2::text)
           )
       WHERE id = $1
       RETURNING id`,
      [workspaceId, expiresAt],
    );

    const success = res.rows.length > 0;
    if (success) clearFreeAccessCache(workspaceId);
    return success;
  } catch (error) {
    console.error(
      `[free-access] Error enabling free-access for workspace ${workspaceId}:`,
      error,
    );
    return false;
  }
}

/**
 * Disable free-access mode for a workspace.
 * Called by POST /api/admin/free-access/disable.
 *
 * @param workspaceId — The workspace to disable free-access for
 * @returns true if successful, false if workspace not found
 */
export async function disableFreeAccessMode(workspaceId: string): Promise<boolean> {
  try {
    const res = await pgPool().query(
      `UPDATE workspaces
       SET plan_metadata = jsonb_set(
             COALESCE(plan_metadata, '{}'::jsonb),
             '{free_access_until}',
             'null'::jsonb
           )
       WHERE id = $1
       RETURNING id`,
      [workspaceId],
    );

    const success = res.rows.length > 0;
    if (success) clearFreeAccessCache(workspaceId);
    return success;
  } catch (error) {
    console.error(
      `[free-access] Error disabling free-access for workspace ${workspaceId}:`,
      error,
    );
    return false;
  }
}

/**
 * Batch enable/disable free-access for multiple workspaces.
 * Used for bulk admin operations (e.g., bulk trial activation).
 *
 * @param workspaceIds — Array of workspace IDs to update
 * @param expiresAt — ISO 8601 timestamp (null to disable all)
 * @returns Count of successfully updated workspaces
 */
export async function batchUpdateFreeAccessMode(
  workspaceIds: string[],
  expiresAt: string | null,
): Promise<number> {
  if (workspaceIds.length === 0) return 0;

  try {
    const res = await pgPool().query(
      `UPDATE workspaces
       SET plan_metadata = jsonb_set(
             COALESCE(plan_metadata, '{}'::jsonb),
             '{free_access_until}',
             to_jsonb($2::text)
           )
       WHERE id = ANY($1::text[])
       RETURNING id`,
      [workspaceIds, expiresAt],
    );

    const count = res.rows.length;
    // Clear cache for all updated workspaces
    workspaceIds.forEach(clearFreeAccessCache);
    return count;
  } catch (error) {
    console.error("[free-access] Error in batch update:", error);
    return 0;
  }
}

/**
 * Find all workspaces with active free-access mode.
 * Used for reporting/auditing.
 *
 * @param limit — Max results to return (default 100)
 * @returns Array of workspace IDs with active free-access
 */
export async function listActiveFreeeAccessWorkspaces(limit = 100): Promise<string[]> {
  try {
    const res = await pgPool().query<{ id: string }>(
      `SELECT id FROM workspaces
       WHERE (plan_metadata->>'free_access_until')::timestamptz > NOW()
       LIMIT $1`,
      [limit],
    );
    return res.rows.map((r) => r.id);
  } catch (error) {
    console.error("[free-access] Error listing active workspaces:", error);
    return [];
  }
}

/**
 * DATABASE SCHEMA ADDITION
 *
 * Free-access mode is stored in the existing `workspaces.plan_metadata` JSONB field.
 * No new column needed. Sample structure:
 *
 * {
 *   "free_access_until": "2026-10-03T12:00:00Z",
 *   ...other plan metadata...
 * }
 *
 * Migration (if needed — this is backwards compatible):
 * ```sql
 * ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_metadata jsonb DEFAULT '{}'::jsonb;
 *
 * -- Index for performance on free-access queries
 * CREATE INDEX IF NOT EXISTS workspaces_free_access_until_idx
 *   ON workspaces USING btree ((plan_metadata->>'free_access_until'));
 * ```
 *
 * No downtime; old workspaces without plan_metadata get the empty object default.
 */
