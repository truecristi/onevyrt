import { Pool } from "pg";
import type { PoolClient } from "pg";
import { withAdvisoryLock } from "@/lib/db";
import { getEnrollment } from "@/lib/enrollments";
import type { Enrollment } from "@onevyrt/engine";

/**
 * Reflection tracking state stored in enrollment.reflectionTracking
 */
export interface ReflectionTracking {
  lastReflectionDate?: string; // ISO 8601 date (e.g., "2026-06-05")
  lastReflectionCompletedAt?: string; // ISO 8601 timestamp
  reflectionDueDate?: string; // ISO 8601 date when next reflection is due
  totalReflectionsCompleted: number; // Cumulative count
  consecutiveMissedReflections: number; // Streak counter
}

/**
 * Reflection status for UI display
 */
export interface ReflectionStatus {
  isDue: boolean;
  daysUntilDue: number;
  daysSinceLastReflection: number;
  lastReflectionDate: string | null;
  nextReflectionDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  totalCompleted: number;
  streakMissed: number;
}

/** `reflectionTracking` rides the enrollment JSONB blob but isn't part of the
 *  engine's own `Enrollment` shape — same "extra field on the blob" pattern
 *  as `readinessBaseline` in lib/enrollments.ts. */
type EnrollmentWithReflection = Enrollment & { reflectionTracking?: ReflectionTracking };

const REFLECTION_INTERVAL_DAYS = 90;

/**
 * Initialize reflection tracking in enrollment if not present
 */
export function initializeReflectionTracking(): ReflectionTracking {
  return {
    lastReflectionDate: undefined,
    lastReflectionCompletedAt: undefined,
    reflectionDueDate: undefined,
    totalReflectionsCompleted: 0,
    consecutiveMissedReflections: 0,
  };
}

/**
 * Ensure reflection tracking exists in enrollment
 */
export function ensureReflectionTracking(
  enrollment: Enrollment
): ReflectionTracking {
  const stored = enrollment as EnrollmentWithReflection;
  if (!stored.reflectionTracking) {
    stored.reflectionTracking = initializeReflectionTracking();
  }
  return stored.reflectionTracking;
}

/**
 * Calculate days between two dates (positive if date1 is after date2)
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date1.getTime() - date2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date and return ISO date string
 */
function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split("T")[0]!;
}

/**
 * Format date as ISO 8601 date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Parse ISO date string to Date object
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Persist the enrollment blob back to the database. There is no public,
 * generic "update enrollment" export on lib/enrollments.ts (its own
 * read-modify-write helpers are private) — this mirrors its writeOne()
 * upsert exactly, run on the advisory lock's own client so the mutators
 * below stay atomic with the lock that serializes them.
 */
async function persistEnrollment(
  client: PoolClient,
  workspaceId: string,
  enrollment: Enrollment
): Promise<void> {
  await client.query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [workspaceId, JSON.stringify(enrollment)]
  );
}

/**
 * Get current reflection status for a workspace
 */
export async function getReflectionStatus(
  workspaceId: string
): Promise<ReflectionStatus> {
  const enrollment = await getEnrollment(workspaceId);
  if (!enrollment) throw new Error(`No enrollment found for workspace ${workspaceId}`);
  const tracking = ensureReflectionTracking(enrollment);

  const now = new Date();

  // Determine next due date
  let nextReflectionDate: string;
  if (!tracking.reflectionDueDate) {
    // First reflection: 90 days from today
    if (!tracking.lastReflectionDate) {
      nextReflectionDate = addDays(now, REFLECTION_INTERVAL_DAYS);
    } else {
      // Shouldn't happen, but fallback to based on last reflection
      nextReflectionDate = addDays(
        parseDate(tracking.lastReflectionDate),
        REFLECTION_INTERVAL_DAYS
      );
    }
  } else {
    nextReflectionDate = tracking.reflectionDueDate;
  }

  const nextDueDate = parseDate(nextReflectionDate);
  const daysUntilDue = daysBetween(nextDueDate, now);
  const isDue = daysUntilDue <= 0;
  const isOverdue = isDue && daysUntilDue < 0;

  const daysSinceLastReflection = tracking.lastReflectionDate
    ? daysBetween(now, parseDate(tracking.lastReflectionDate))
    : 0;

  return {
    isDue,
    daysUntilDue: Math.max(0, daysUntilDue),
    daysSinceLastReflection,
    lastReflectionDate: tracking.lastReflectionDate || null,
    nextReflectionDate,
    isOverdue,
    daysOverdue: isOverdue ? Math.abs(daysUntilDue) : 0,
    totalCompleted: tracking.totalReflectionsCompleted,
    streakMissed: tracking.consecutiveMissedReflections,
  };
}

/**
 * Record a reflection completion
 * Updates enrollment with new reflection date and schedules next reminder
 */
export async function recordReflectionCompletion(
  workspaceId: string
): Promise<void> {
  await withAdvisoryLock(`reflection:${workspaceId}`, async (client) => {
    const enrollment = await getEnrollment(workspaceId);
    if (!enrollment) throw new Error(`No enrollment found for workspace ${workspaceId}`);
    const tracking = ensureReflectionTracking(enrollment);

    const now = new Date();
    const today = formatDate(now);

    // Update tracking
    tracking.lastReflectionDate = today;
    tracking.lastReflectionCompletedAt = now.toISOString();
    tracking.reflectionDueDate = addDays(now, REFLECTION_INTERVAL_DAYS);
    tracking.totalReflectionsCompleted += 1;
    tracking.consecutiveMissedReflections = 0; // Reset missed streak

    // Save back to enrollment
    await persistEnrollment(client, workspaceId, enrollment);

    // Create activity log entry
    await client.query(
      `INSERT INTO activity_log (workspace_id, user_id, action, metadata, created_at)
       SELECT $1, u.id, 'reflection_completed', $2, NOW()
       FROM workspaces_users wu
       JOIN users u ON u.id = wu.user_id
       WHERE wu.workspace_id = $1 AND wu.role = 'owner'
       LIMIT 1`,
      [workspaceId, JSON.stringify({ reflectionDate: today })]
    );
  });
}

/**
 * Check if reflection is overdue and increment missed count
 * Called by job system when a missed reflection is detected
 */
export async function markReflectionMissed(
  workspaceId: string
): Promise<void> {
  await withAdvisoryLock(`reflection:${workspaceId}`, async (client) => {
    const enrollment = await getEnrollment(workspaceId);
    if (!enrollment) throw new Error(`No enrollment found for workspace ${workspaceId}`);
    const tracking = ensureReflectionTracking(enrollment);

    const now = new Date();
    const status = await getReflectionStatus(workspaceId);

    if (status.isOverdue) {
      tracking.consecutiveMissedReflections += 1;
      await persistEnrollment(client, workspaceId, enrollment);

      // Log the missed reflection
      await client.query(
        `INSERT INTO activity_log (workspace_id, user_id, action, metadata, created_at)
         SELECT $1, u.id, 'reflection_missed', $2, NOW()
         FROM workspaces_users wu
         JOIN users u ON u.id = wu.user_id
         WHERE wu.workspace_id = $1 AND wu.role = 'owner'
         LIMIT 1`,
        [workspaceId, JSON.stringify({ missedOnDate: formatDate(now) })]
      );
    }
  });
}

/**
 * Update a specific reflection due date (e.g., for custom scheduling)
 */
export async function updateReflectionDueDate(
  workspaceId: string,
  newDueDate: string // ISO 8601 date string
): Promise<void> {
  await withAdvisoryLock(`reflection:${workspaceId}`, async (client) => {
    const enrollment = await getEnrollment(workspaceId);
    if (!enrollment) throw new Error(`No enrollment found for workspace ${workspaceId}`);
    const tracking = ensureReflectionTracking(enrollment);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDueDate)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD");
    }

    tracking.reflectionDueDate = newDueDate;
    await persistEnrollment(client, workspaceId, enrollment);

    // Log the update
    await client.query(
      `INSERT INTO activity_log (workspace_id, user_id, action, metadata, created_at)
       SELECT $1, u.id, 'reflection_due_date_updated', $2, NOW()
       FROM workspaces_users wu
       JOIN users u ON u.id = wu.user_id
       WHERE wu.workspace_id = $1 AND wu.role = 'owner'
       LIMIT 1`,
      [workspaceId, JSON.stringify({ newDueDate })]
    );
  });
}

/**
 * Get all workspaces with reflections due or overdue for job processing
 * Used by the daily cron job to identify who needs reminders
 */
export async function getWorkspacesWithDueReflections(
  pool: Pool,
  options?: { overdueOnly?: boolean; limit?: number }
): Promise<string[]> {
  const overdueOnly = options?.overdueOnly || false;
  const limit = options?.limit || 1000;

  const query = `
    SELECT DISTINCT e.workspace_id
    FROM enrollments e
    WHERE e.enrollment ->> 'reflectionTracking' IS NOT NULL
      AND e.enrollment -> 'reflectionTracking' ->> 'reflectionDueDate' IS NOT NULL
      AND (
        ${overdueOnly ? "e.enrollment -> 'reflectionTracking' ->> 'reflectionDueDate' < CURRENT_DATE" : "e.enrollment -> 'reflectionTracking' ->> 'reflectionDueDate' <= CURRENT_DATE + INTERVAL '7 days'"}
      )
      AND e.enrollment IS NOT NULL
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  return result.rows.map((row) => row.workspace_id);
}

/**
 * Create a reminder notification for a workspace with a due reflection
 * Integrates with lib/notifications.ts
 */
export async function createReflectionReminder(
  pool: Pool,
  workspaceId: string
): Promise<{ created: boolean; reason?: string }> {
  const { createNotification } = await import("@/lib/notifications");
  const status = await getReflectionStatus(workspaceId);

  if (!status.isDue) {
    return { created: false, reason: "Reflection not yet due" };
  }

  // Get workspace owner (createNotification is an in-app, per-user
  // notification — it needs the owner's user id, not their email).
  const ownerResult = await pool.query(
    `SELECT u.id FROM workspaces_users wu
     JOIN users u ON u.id = wu.user_id
     WHERE wu.workspace_id = $1 AND wu.role = 'owner'
     LIMIT 1`,
    [workspaceId]
  );

  if (ownerResult.rows.length === 0) {
    return { created: false, reason: "No owner found for workspace" };
  }

  const ownerId = ownerResult.rows[0].id;
  const dedupeKey = `reflection:${workspaceId}:${status.nextReflectionDate}`;

  const notification = await createNotification({
    userId: ownerId,
    workspaceId,
    type: "reflection_due",
    title: `90-Day Reflection Due - ${status.daysOverdue > 0 ? "Overdue!" : "Time to Reflect"}`,
    body: `Your 90-day reflection cycle is ${status.isOverdue ? `overdue by ${status.daysOverdue} days` : "due now"}. Take time to review your growth and plan the next 90 days.`,
    dedupeKey,
  });

  return { created: notification !== null };
}

/**
 * Reflection scheduler job definition for lib/jobs.ts
 * Call this in your job registry to add reflection scheduling
 */
export const REFLECTION_SCHEDULER_JOB = {
  key: "reflection-scheduler-daily",
  description: "Daily reflection reminder scheduling",
  handler: async (pool: Pool) => {
    console.log("[reflection-scheduler] Starting daily reflection check");

    const workspacesWithDueReflections = await getWorkspacesWithDueReflections(
      pool,
      { limit: 5000 }
    );

    console.log(
      `[reflection-scheduler] Found ${workspacesWithDueReflections.length} workspaces with due reflections`
    );

    let remindersSent = 0;
    let errors = 0;

    for (const workspaceId of workspacesWithDueReflections) {
      try {
        const result = await createReflectionReminder(pool, workspaceId);
        if (result.created) remindersSent++;
      } catch (error) {
        console.error(
          `[reflection-scheduler] Error creating reminder for ${workspaceId}:`,
          error
        );
        errors++;
      }
    }

    console.log(
      `[reflection-scheduler] Complete. Reminders sent: ${remindersSent}, Errors: ${errors}`
    );

    return { remindersSent, errors };
  },
};
