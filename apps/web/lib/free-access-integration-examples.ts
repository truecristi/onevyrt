/**
 * FREE-ACCESS MODE: Integration Examples
 *
 * Concrete patterns showing how to integrate FreeAccessModeAPI.ts
 * into existing routes, middleware, and library functions.
 *
 * Copy these patterns into actual route handlers and lib functions.
 */

import {
  checkFreeAccessMode,
  bypassGatesIfFreeAccess,
  autoApproveIfFreeAccess,
  skipCoachNotificationsIfFreeAccess,
  injectFreeAccessContext,
  enableFreeAccessMode,
  disableFreeAccessMode,
} from "./free-access-mode";
import type { FreeAccessContext } from "./free-access-mode";
import type { Enrollment, Submission } from "@onevyrt/engine";

/**
 * ============================================================================
 * PATTERN 1: INTEGRATION WITH ENROLLMENT SUBMISSION FLOW
 * ============================================================================
 *
 * Location: lib/enrollments.ts submitAssignment()
 *
 * Shows how to auto-approve submissions if free-access is active.
 */

export async function submitAssignmentWithFreeAccess(
  workspaceId: string,
  _lessonId: string,
  _userId: string,
  evidence: string,
  checklistChecked: string[],
  // ... other params from actual submitAssignment
): Promise<Submission | { error: string }> {
  // 1. Check if this workspace is in free-access mode
  const isFreeAccess = (await checkFreeAccessMode(workspaceId)) !== null;

  // 2. Create submission normally (this is your existing logic)
  const submission: Submission = {
    id: "hex-id", // normal generation
    submittedAt: new Date().toISOString(),
    evidence,
    checklistChecked,
    reviewStatus: isFreeAccess ? "approved" : "pending",
  };

  // 3. If free-access, auto-approve
  if (isFreeAccess) {
    autoApproveIfFreeAccess(submission, true);
    // Now submission.reviewStatus === "approved"
    // submission.reviewedBy === "auto (free-access)"
  }

  // 4. Save and return normally
  // await writeOne(workspaceId, updatedEnrollment, db);
  return submission;
}

/**
 * ============================================================================
 * PATTERN 2: INTEGRATION WITH COACH NOTIFICATION FLOW
 * ============================================================================
 *
 * Location: lib/programme-notifications.ts or api/coaching/notify-pending-review
 *
 * Shows how to suppress coach notifications when free-access is active.
 */

export async function notifyCoachOfPendingReviewWithFreeAccess(
  workspaceId: string,
  _lessonId: string,
  _submissionId: string,
): Promise<void> {
  // 1. Check if we should suppress notifications
  const shouldSkip = await skipCoachNotificationsIfFreeAccess(
    workspaceId,
    "submission_pending_review",
  );

  if (shouldSkip) {
    console.log(
      `[free-access] Suppressing coach notification for workspace ${workspaceId}`,
    );
    return;
  }

  // 2. Proceed with normal notification flow
  // const coaches = await getCoachesForWorkspace(workspaceId);
  // for (const coach of coaches) {
  //   await createNotification({
  //     userId: coach.id,
  //     type: "submission_pending_review",
  //     title: "New assignment submission",
  //     body: `Lesson "${lessonId}" has a pending review`,
  //     dedupeKey: `submission:${submissionId}:pending`,
  //   });
  // }
}

/**
 * ============================================================================
 * PATTERN 3: AUTH MIDDLEWARE INTEGRATION
 * ============================================================================
 *
 * Location: middleware or before route handler execution
 *
 * Shows how to attach free-access context to request for use throughout handler.
 */

export async function attachFreeAccessToRequest(workspaceId: string): Promise<FreeAccessContext> {
  // Call this in your middleware after auth/workspace verification
  const context = await injectFreeAccessContext(workspaceId);

  // Attach to request object (pseudo-code; adjust for your framework)
  // req.freeAccess = context;

  // Or return it to pass through handler
  return context;

  // Usage in route handler:
  //   const freeAccessCtx = await attachFreeAccessToRequest(workspace.id);
  //   if (freeAccessCtx.isFreeAccess) {
  //     console.log(`Workspace expires at: ${freeAccessCtx.expiresAt}`);
  //   }
}

/**
 * ============================================================================
 * PATTERN 4: ENROLLMENT STATE RETRIEVAL WITH FREE-ACCESS GATES BYPASSED
 * ============================================================================
 *
 * Location: api/programme/enrollment route handler
 *
 * Shows how to return enrollment state with gates pre-unlocked.
 */

export async function getEnrollmentStateWithFreeAccess(
  workspaceId: string,
  getEnrollmentFn: (wsId: string) => Promise<Enrollment | null>,
): Promise<Enrollment | null> {
  // 1. Check free-access status
  const isFreeAccess = (await checkFreeAccessMode(workspaceId)) !== null;

  // 2. Fetch enrollment normally
  const enrollment = await getEnrollmentFn(workspaceId);
  if (!enrollment) return null;

  // 3. If free-access, bypass gates in-place
  if (isFreeAccess) {
    bypassGatesIfFreeAccess(enrollment, true);
  }

  // 4. Return modified enrollment
  return enrollment;

  // Full route example:
  //   export async function GET(req: Request) {
  //     const user = await currentUser(req);
  //     const ws = await currentWorkspace(user.id, wsId);
  //
  //     const enrollment = await getEnrollmentStateWithFreeAccess(
  //       ws.id,
  //       getEnrollment
  //     );
  //
  //     return Response.json({
  //       enrollment,
  //       isFreeAccess: enrollment ? !!await checkFreeAccessMode(ws.id) : false,
  //     });
  //   }
}

/**
 * ============================================================================
 * PATTERN 5: ADMIN ROUTE FOR ENABLING FREE-ACCESS
 * ============================================================================
 *
 * Location: api/admin/free-access/enable route handler
 *
 * Shows the route to enable free-access for a workspace (admin only).
 */

export interface EnableFreeAccessRequest {
  workspaceId: string;
  expiresAt: string; // ISO 8601 datetime
}

export async function adminEnableFreeAccess(
  req: EnableFreeAccessRequest,
): Promise<{ success: boolean; message: string }> {
  // 1. Validate input
  if (!req.workspaceId || !req.expiresAt) {
    return { success: false, message: "Missing workspaceId or expiresAt" };
  }

  // 2. Verify it's a valid ISO 8601 timestamp
  const expiry = new Date(req.expiresAt);
  if (isNaN(expiry.getTime())) {
    return { success: false, message: "Invalid ISO 8601 timestamp" };
  }

  // 3. Prevent backdating
  if (expiry <= new Date()) {
    return { success: false, message: "Expiry must be in the future" };
  }

  // 4. Enable free-access in the database
  const success = await enableFreeAccessMode(req.workspaceId, req.expiresAt);

  return {
    success,
    message: success
      ? `Free-access enabled until ${req.expiresAt}`
      : "Workspace not found",
  };

  // Full route example (Next.js):
  //   export async function POST(req: Request) {
  //     const user = await currentUser(req);
  //     if (user?.role !== "admin") {
  //       return Response.json({ error: "Forbidden" }, { status: 403 });
  //     }
  //
  //     const body = await req.json();
  //     const result = await adminEnableFreeAccess(body);
  //
  //     return Response.json(result, {
  //       status: result.success ? 200 : 400,
  //     });
  //   }
}

/**
 * ============================================================================
 * PATTERN 6: ADMIN ROUTE FOR DISABLING FREE-ACCESS
 * ============================================================================
 *
 * Location: api/admin/free-access/disable route handler
 */

export async function adminDisableFreeAccess(
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  if (!workspaceId) {
    return { success: false, message: "Missing workspaceId" };
  }

  const success = await disableFreeAccessMode(workspaceId);

  return {
    success,
    message: success
      ? "Free-access disabled"
      : "Workspace not found",
  };

  // Full route example (Next.js):
  //   export async function POST(req: Request) {
  //     const user = await currentUser(req);
  //     if (user?.role !== "admin") {
  //       return Response.json({ error: "Forbidden" }, { status: 403 });
  //     }
  //
  //     const { workspaceId } = await req.json();
  //     const result = await adminDisableFreeAccess(workspaceId);
  //
  //     return Response.json(result, {
  //       status: result.success ? 200 : 400,
  //     });
  //   }
}

/**
 * ============================================================================
 * PATTERN 7: GATING LOGIC INTEGRATION
 * ============================================================================
 *
 * Location: lib/enrollments.ts submitAssignment() or status checking
 *
 * Shows how to modify the lesson-locking logic to respect free-access.
 */

export async function checkLessonAccessWithFreeAccess(
  workspaceId: string,
  _enrollment: Enrollment,
  _lessonId: string,
): Promise<"locked" | "unlocked"> {
  // 1. Check free-access status
  const isFreeAccess = (await checkFreeAccessMode(workspaceId)) !== null;

  // 2. If free-access, all lessons are unlocked
  if (isFreeAccess) {
    return "unlocked";
  }

  // 3. Otherwise, apply normal gating logic
  // (this would normally call into @onevyrt/engine's effectiveStatus)
  // const status = effectiveStatus(programme, enrollment, lessonId);
  // return status === "locked" ? "locked" : "unlocked";

  return "locked"; // placeholder
}

/**
 * ============================================================================
 * PATTERN 8: CLIENT-SIDE STATE TRACKING
 * ============================================================================
 *
 * Location: pages or components that need to know if workspace is in free-access
 *
 * Shows how to expose free-access status to frontend.
 */

export interface EnrollmentResponse {
  enrollment: Enrollment;
  isFreeAccess: boolean;
  freeAccessExpiresAt?: string;
}

export async function formatEnrollmentResponseWithFreeAccess(
  enrollment: Enrollment | null,
  workspaceId: string,
): Promise<EnrollmentResponse | null> {
  if (!enrollment) return null;

  const freeAccessUntil = await checkFreeAccessMode(workspaceId);

  return {
    enrollment,
    isFreeAccess: freeAccessUntil !== null,
    ...(freeAccessUntil ? { freeAccessExpiresAt: freeAccessUntil } : {}),
  };

  // Usage in route:
  //   const response = await formatEnrollmentResponseWithFreeAccess(enrollment, ws.id);
  //   return Response.json(response);
  //
  // Frontend can then conditionally render:
  //   if (data.isFreeAccess) {
  //     showBanner("Trial access: all lessons unlocked until " + data.freeAccessExpiresAt);
  //   }
}

/**
 * ============================================================================
 * PATTERN 9: COACH MESSAGE SUPPRESSION IN JOBS
 * ============================================================================
 *
 * Location: lib/jobs.ts or cron job handlers
 *
 * Shows how to skip coach notifications in batch jobs.
 */

export async function sendCoachWeeklyDigestWithFreeAccessCheck(
  workspaceId: string,
  _coachId: string,
  _quietLearners: string[],
): Promise<void> {
  // 1. Check if we should skip coach notifications
  const shouldSkip = await skipCoachNotificationsIfFreeAccess(
    workspaceId,
    "learner_quiet",
  );

  if (shouldSkip) {
    console.log(
      `[free-access] Skipping weekly coach digest for workspace ${workspaceId}`,
    );
    return;
  }

  // 2. Proceed with normal digest logic
  // await createNotification({
  //   userId: coachId,
  //   type: "learner_quiet",
  //   title: "Weekly coaching digest",
  //   body: `${quietLearners.length} learners haven't submitted this week`,
  //   dedupeKey: `digest:${workspaceId}:${coachId}:${weekNumber}`,
  // });
}

/**
 * ============================================================================
 * MIGRATION NOTES
 * ============================================================================
 *
 * To integrate free-access mode into your codebase:
 *
 * 1. DATABASE SCHEMA:
 *    - No schema change needed if using plan_metadata JSONB column
 *    - If adding new column, run migration in lib/db.ts or migrations/
 *
 * 2. lib/enrollments.ts:
 *    - In submitAssignment(), check free-access before setting reviewStatus
 *    - Update autoApproval logic to call autoApproveIfFreeAccess()
 *
 * 3. lib/programme-notifications.ts:
 *    - Before createNotification() for coach types, call skipCoachNotificationsIfFreeAccess()
 *
 * 4. api routes:
 *    - /api/programme/enrollment: Call bypassGatesIfFreeAccess() before returning
 *    - /api/coaching/review: Check free-access before requiring coach review
 *    - Add /api/admin/free-access/enable and disable routes
 *
 * 5. Middleware:
 *    - Call injectFreeAccessContext() early in request processing
 *    - Attach result to request context for later use
 *
 * 6. Client-side:
 *    - Fetch `freeAccessExpiresAt` in enrollment response
 *    - Show banner if free-access is active
 *    - Disable coach messaging UI if free-access
 */
