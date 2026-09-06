/**
 * Email and notification preferences for workspaces.
 * Users can opt out of: reminder emails, weekly digest, in-app notifications, decision moments.
 * Stored per-workspace in the email_preferences table.
 * All delivery systems (email, SMS, in-app) respect these preferences.
 */

import { pgPool, withAdvisoryLock } from "./db";
import { randomBytes } from "node:crypto";

export interface EmailPreferences {
  id: string;
  workspaceId: string;
  reminderEmails: boolean;
  weeklyDigest: boolean;
  inAppNotifications: boolean;
  decisionMoments: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Default preferences: all notifications enabled.
 * Users can opt out of any specific type.
 */
export function getDefaultPreferences(): Omit<EmailPreferences, "id" | "workspaceId" | "createdAt" | "updatedAt"> {
  return {
    reminderEmails: true,
    weeklyDigest: true,
    inAppNotifications: true,
    decisionMoments: true,
  };
}

/**
 * Validates that a preferences object has the correct shape.
 * Returns true if valid, false otherwise.
 */
export function validatePreferences(prefs: any): boolean {
  if (typeof prefs !== "object" || prefs === null) return false;
  return (
    typeof prefs.reminderEmails === "boolean" &&
    typeof prefs.weeklyDigest === "boolean" &&
    typeof prefs.inAppNotifications === "boolean" &&
    typeof prefs.decisionMoments === "boolean"
  );
}

/**
 * Row mapper: converts database row to EmailPreferences object
 */
function rowToEmailPreferences(row: {
  id: string;
  workspace_id: string;
  reminder_emails: boolean;
  weekly_digest: boolean;
  in_app_notifications: boolean;
  decision_moments: boolean;
  created_at: Date;
  updated_at: Date;
}): EmailPreferences {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reminderEmails: row.reminder_emails,
    weeklyDigest: row.weekly_digest,
    inAppNotifications: row.in_app_notifications,
    decisionMoments: row.decision_moments,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Get email preferences for a workspace.
 * If no preferences exist, returns default preferences (all enabled).
 * Soft-deleted preferences are treated as if they don't exist.
 */
export async function getEmailPreferences(workspaceId: string): Promise<EmailPreferences> {
  const res = await pgPool().query<{
    id: string;
    workspace_id: string;
    reminder_emails: boolean;
    weekly_digest: boolean;
    in_app_notifications: boolean;
    decision_moments: boolean;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, workspace_id, reminder_emails, weekly_digest, in_app_notifications,
            decision_moments, created_at, updated_at
     FROM email_preferences
     WHERE workspace_id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [workspaceId]
  );

  if (res.rows[0]) {
    return rowToEmailPreferences(res.rows[0]);
  }

  // Create and return default preferences if none exist
  return createDefaultPreferences(workspaceId);
}

/**
 * Create default preferences for a workspace if they don't already exist.
 * Uses advisory lock to prevent race conditions.
 * If preferences already exist, returns the existing ones.
 */
async function createDefaultPreferences(workspaceId: string): Promise<EmailPreferences> {
  const lockKey = `email-preferences:${workspaceId}`;

  return withAdvisoryLock(lockKey, async (client) => {
    // Check again under the lock in case another process created them
    const existing = await client.query<{
      id: string;
      workspace_id: string;
      reminder_emails: boolean;
      weekly_digest: boolean;
      in_app_notifications: boolean;
      decision_moments: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, workspace_id, reminder_emails, weekly_digest, in_app_notifications,
              decision_moments, created_at, updated_at
       FROM email_preferences
       WHERE workspace_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [workspaceId]
    );

    if (existing.rows[0]) {
      return rowToEmailPreferences(existing.rows[0]);
    }

    // Create new default preferences. ON CONFLICT matters here, not just for
    // the ordinary concurrent-create race the lock already prevents: a
    // workspace whose preferences were soft-deleted (deleteEmailPreferences)
    // still has a live row occupying this table's UNIQUE(workspace_id)
    // constraint — a plain INSERT would violate it. Reviving that row
    // (clearing deleted_at, resetting every field to defaults) is the same
    // fix already established for the identical unique-per-workspace +
    // soft-delete shape in lib/dashboard/why-creed.ts's saveWhyAndCreed().
    const id = randomBytes(8).toString("hex");
    const defaults = getDefaultPreferences();
    const now = new Date().toISOString();

    const inserted = await client.query<{
      id: string;
      workspace_id: string;
      reminder_emails: boolean;
      weekly_digest: boolean;
      in_app_notifications: boolean;
      decision_moments: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO email_preferences
       (id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id) DO UPDATE SET
         reminder_emails = EXCLUDED.reminder_emails,
         weekly_digest = EXCLUDED.weekly_digest,
         in_app_notifications = EXCLUDED.in_app_notifications,
         decision_moments = EXCLUDED.decision_moments,
         deleted_at = NULL,
         updated_at = EXCLUDED.updated_at
       RETURNING id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at`,
      [id, workspaceId, defaults.reminderEmails, defaults.weeklyDigest, defaults.inAppNotifications, defaults.decisionMoments, now, now]
    );

    return rowToEmailPreferences(inserted.rows[0]!);
  });
}

/**
 * Update email preferences for a workspace.
 * Only the provided fields are updated; missing fields keep their current value.
 * Uses advisory lock for safe concurrent updates.
 */
export async function updateEmailPreferences(
  workspaceId: string,
  updates: Partial<Omit<EmailPreferences, "id" | "workspaceId" | "createdAt" | "updatedAt">>
): Promise<EmailPreferences> {
  // Validate partial updates
  const partialUpdate = updates as Record<string, any>;
  for (const key of Object.keys(partialUpdate)) {
    if (!["reminderEmails", "weeklyDigest", "inAppNotifications", "decisionMoments"].includes(key)) {
      throw new Error(`Invalid preference field: ${key}`);
    }
    if (typeof partialUpdate[key] !== "boolean") {
      throw new Error(`${key} must be a boolean`);
    }
  }

  const lockKey = `email-preferences:${workspaceId}`;

  return withAdvisoryLock(lockKey, async (client) => {
    // Get current preferences
    const current = await client.query<{
      id: string;
      workspace_id: string;
      reminder_emails: boolean;
      weekly_digest: boolean;
      in_app_notifications: boolean;
      decision_moments: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, workspace_id, reminder_emails, weekly_digest, in_app_notifications,
              decision_moments, created_at, updated_at
       FROM email_preferences
       WHERE workspace_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [workspaceId]
    );

    if (!current.rows[0]) {
      // Create default preferences first. Same ON CONFLICT reasoning as
      // createDefaultPreferences() above — a soft-deleted row for this
      // workspace still occupies the UNIQUE(workspace_id) constraint, so a
      // plain INSERT here would crash exactly the same way for a caller
      // that updates before ever calling getEmailPreferences.
      const defaults = getDefaultPreferences();
      const id = randomBytes(8).toString("hex");
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO email_preferences
         (id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (workspace_id) DO UPDATE SET
           reminder_emails = EXCLUDED.reminder_emails,
           weekly_digest = EXCLUDED.weekly_digest,
           in_app_notifications = EXCLUDED.in_app_notifications,
           decision_moments = EXCLUDED.decision_moments,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
        [id, workspaceId, defaults.reminderEmails, defaults.weeklyDigest, defaults.inAppNotifications, defaults.decisionMoments, now, now]
      );
    }

    // Build UPDATE statement dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.reminderEmails !== undefined) {
      updateFields.push(`reminder_emails = $${paramIndex++}`);
      updateValues.push(updates.reminderEmails);
    }
    if (updates.weeklyDigest !== undefined) {
      updateFields.push(`weekly_digest = $${paramIndex++}`);
      updateValues.push(updates.weeklyDigest);
    }
    if (updates.inAppNotifications !== undefined) {
      updateFields.push(`in_app_notifications = $${paramIndex++}`);
      updateValues.push(updates.inAppNotifications);
    }
    if (updates.decisionMoments !== undefined) {
      updateFields.push(`decision_moments = $${paramIndex++}`);
      updateValues.push(updates.decisionMoments);
    }

    // Always update updated_at
    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date().toISOString());

    // Add workspace_id as final parameter
    updateValues.push(workspaceId);

    const updateQuery = `UPDATE email_preferences
                         SET ${updateFields.join(", ")}
                         WHERE workspace_id = $${paramIndex} AND deleted_at IS NULL
                         RETURNING id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at`;

    const result = await client.query<{
      id: string;
      workspace_id: string;
      reminder_emails: boolean;
      weekly_digest: boolean;
      in_app_notifications: boolean;
      decision_moments: boolean;
      created_at: Date;
      updated_at: Date;
    }>(updateQuery, updateValues);

    if (!result.rows[0]) {
      throw new Error(`Failed to update email preferences for workspace ${workspaceId}`);
    }

    return rowToEmailPreferences(result.rows[0]);
  });
}

/**
 * Reset email preferences to defaults for a workspace.
 * This is a convenience method that updates all preferences to their default values.
 */
export async function resetToDefaults(workspaceId: string): Promise<EmailPreferences> {
  return updateEmailPreferences(workspaceId, getDefaultPreferences());
}

/**
 * Soft-delete email preferences for a workspace.
 * Deleted preferences are treated as if they don't exist (getEmailPreferences will create new defaults).
 */
export async function deleteEmailPreferences(workspaceId: string): Promise<void> {
  await pgPool().query(
    `UPDATE email_preferences
     SET deleted_at = now()
     WHERE workspace_id = $1 AND deleted_at IS NULL`,
    [workspaceId]
  );
}

/**
 * Check if a specific notification type is allowed to be sent to a workspace.
 * This is the function delivery systems should call before sending notifications.
 *
 * @param workspaceId - The workspace to check preferences for
 * @param notificationType - The type of notification: 'reminder' | 'digest' | 'inApp' | 'decision'
 * @returns true if the notification type is enabled, false otherwise
 */
export async function isNotificationAllowed(
  workspaceId: string,
  notificationType: "reminder" | "digest" | "inApp" | "decision"
): Promise<boolean> {
  const prefs = await getEmailPreferences(workspaceId);

  switch (notificationType) {
    case "reminder":
      return prefs.reminderEmails;
    case "digest":
      return prefs.weeklyDigest;
    case "inApp":
      return prefs.inAppNotifications;
    case "decision":
      return prefs.decisionMoments;
    default:
      // Unknown type: allow by default (fail-open)
      return true;
  }
}

/**
 * Helper function for delivery systems to check multiple notification types at once.
 * Returns a map of notification type to whether it's allowed.
 */
export async function checkNotificationPermissions(
  workspaceId: string,
  notificationTypes: Array<"reminder" | "digest" | "inApp" | "decision">
): Promise<Record<string, boolean>> {
  const prefs = await getEmailPreferences(workspaceId);

  const result: Record<string, boolean> = {};
  for (const type of notificationTypes) {
    switch (type) {
      case "reminder":
        result[type] = prefs.reminderEmails;
        break;
      case "digest":
        result[type] = prefs.weeklyDigest;
        break;
      case "inApp":
        result[type] = prefs.inAppNotifications;
        break;
      case "decision":
        result[type] = prefs.decisionMoments;
        break;
    }
  }
  return result;
}

/**
 * Get all preferences for a workspace (including soft-deleted ones if requested).
 * Used primarily for admin/audit purposes.
 */
export async function getAllPreferencesHistory(workspaceId: string, includeSoftDeleted: boolean = false): Promise<EmailPreferences[]> {
  const query = includeSoftDeleted
    ? `SELECT id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at
       FROM email_preferences
       WHERE workspace_id = $1
       ORDER BY updated_at DESC`
    : `SELECT id, workspace_id, reminder_emails, weekly_digest, in_app_notifications, decision_moments, created_at, updated_at
       FROM email_preferences
       WHERE workspace_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`;

  const res = await pgPool().query<{
    id: string;
    workspace_id: string;
    reminder_emails: boolean;
    weekly_digest: boolean;
    in_app_notifications: boolean;
    decision_moments: boolean;
    created_at: Date;
    updated_at: Date;
  }>(query, [workspaceId]);

  return res.rows.map(rowToEmailPreferences);
}
