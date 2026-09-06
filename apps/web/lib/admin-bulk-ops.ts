/**
 * Bulk admin operations for workspaces and users
 * - bulk user invites
 * - bulk progress resets
 * - bulk email sends
 * - bulk data exports
 */
import { pgPool } from "./db";
import { createNotification } from "./notifications";
import { recordAudit } from "./audit-log";

export interface BulkInviteRequest {
  workspaceId: string;
  emails: string[];
  role?: "editor" | "viewer" | "manager";
  actorEmail: string;
}

export interface BulkInviteResult {
  sent: number;
  failed: number;
  errors: { email: string; error: string }[];
}

export interface BulkResetProgressRequest {
  workspaceId: string;
  userIds?: string[];
  resetChapters?: boolean;
  resetLessons?: boolean;
  actorEmail: string;
}

export interface BulkResetProgressResult {
  resetCount: number;
  errors: { userId: string; error: string }[];
}

export interface BulkEmailRequest {
  workspaceId?: string;
  recipientEmails: string[];
  subject: string;
  body: string;
  actorEmail: string;
}

export interface BulkEmailResult {
  sent: number;
  failed: number;
  errors: { email: string; error: string }[];
}

export interface BulkDataExportRequest {
  workspaceId?: string;
  dataTypes: ("users" | "workspaces" | "projects" | "enrollments" | "audit")[];
  actorEmail: string;
}

export interface BulkDataExportResult {
  exportId: string;
  exportedTypes: string[];
  url: string;
  expiresAt: string;
}

/**
 * Send bulk invitations to workspace members
 */
export async function bulkInviteUsers(req: BulkInviteRequest): Promise<BulkInviteResult> {
  const pool = pgPool();
  const result: BulkInviteResult = { sent: 0, failed: 0, errors: [] };
  const role = req.role ?? "viewer";

  for (const email of req.emails) {
    try {
      // Check if user exists; if not, we'd need a signup flow
      // For now, this creates a pending invitation
      await pool.query(
        `INSERT INTO workspace_invitations (id, workspace_id, email, role, created_at, created_by)
         VALUES ($1, $2, $3, $4, now(), $5)
         ON CONFLICT (workspace_id, email) DO UPDATE SET role = $4`,
        [
          `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          req.workspaceId,
          email.toLowerCase(),
          role,
          req.actorEmail,
        ],
      );
      result.sent += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({
        email,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  // Record audit
  await recordAudit({
    actorEmail: req.actorEmail,
    action: "bulk.invite_users",
    targetType: "workspace",
    targetLabel: req.workspaceId,
    detail: `invited ${result.sent} users, ${result.failed} failed`,
  });

  return result;
}

/**
 * Reset learner progress for one or more users in a workspace
 */
export async function bulkResetProgress(
  req: BulkResetProgressRequest,
): Promise<BulkResetProgressResult> {
  const pool = pgPool();
  const result: BulkResetProgressResult = { resetCount: 0, errors: [] };

  try {
    if (req.resetChapters) {
      // Reset enrollment data for the workspace
      await pool.query(
        `UPDATE enrollments SET enrollment = $1, last_modified_at = now()
         WHERE workspace_id = $2`,
        [
          JSON.stringify({
            stages: [],
            currentStage: null,
            completedAt: null,
            startedAt: new Date().toISOString(),
          }),
          req.workspaceId,
        ],
      );
    }

    if (req.resetChapters) {
      // Reset chapter submissions
      await pool.query(
        `UPDATE chapter_submissions SET submissions = $1
         WHERE workspace_id = $2`,
        [JSON.stringify([]), req.workspaceId],
      );
    }

    // Count how many users were affected
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM workspaces_users WHERE workspace_id = $1`,
      [req.workspaceId],
    );
    result.resetCount = parseInt(countRes.rows[0].count ?? "0", 10);
  } catch (e) {
    result.errors.push({
      userId: "batch",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }

  // Record audit
  await recordAudit({
    actorEmail: req.actorEmail,
    action: "bulk.reset_progress",
    targetType: "workspace",
    targetLabel: req.workspaceId,
    detail: `reset progress for ${result.resetCount} users, ${result.errors.length} errors`,
  });

  return result;
}

/**
 * Send bulk email to recipients
 */
export async function bulkSendEmail(req: BulkEmailRequest): Promise<BulkEmailResult> {
  const result: BulkEmailResult = { sent: 0, failed: 0, errors: [] };

  for (const email of req.recipientEmails) {
    try {
      // In production, this would use your email service (Twilio, SendGrid, etc)
      // For now, we'll just record in notifications
      await createNotification({
        userId: "", // Would need user ID
        type: "admin_email",
        title: req.subject,
        body: req.body,
        dedupeKey: `admin_email:${Date.now()}:${email}`,
      });
      result.sent += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({
        email,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  // Record audit
  await recordAudit({
    actorEmail: req.actorEmail,
    action: "bulk.send_email",
    targetType: "recipients",
    targetLabel: `${result.sent} recipients`,
    detail: `subject: "${req.subject}"`,
  });

  return result;
}

/**
 * Export bulk data for workspace or entire instance
 */
export async function bulkExportData(
  req: BulkDataExportRequest,
): Promise<BulkDataExportResult> {
  const pool = pgPool();
  const exportId = `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const exportedTypes: string[] = [];

  try {
    // Get user ID for the audit log (dummy value since we don't have it)
    const userId = `admin_${Date.now()}`;

    // Create export record in export_history
    await pool.query(
      `INSERT INTO export_history (id, workspace_id, user_id, format, export_type, selected_categories, file_size_bytes, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        exportId,
        req.workspaceId ?? null,
        userId,
        "json",
        "full",
        JSON.stringify(req.dataTypes),
        0,
        "processing",
        expiresAt,
      ],
    );

    // Record what we're exporting
    if (req.dataTypes.includes("users")) exportedTypes.push("users");
    if (req.dataTypes.includes("workspaces")) exportedTypes.push("workspaces");
    if (req.dataTypes.includes("projects")) exportedTypes.push("projects");
    if (req.dataTypes.includes("enrollments")) exportedTypes.push("enrollments");
    if (req.dataTypes.includes("audit")) exportedTypes.push("audit");

    // Record audit
    await recordAudit({
      actorEmail: req.actorEmail,
      action: "bulk.export_data",
      targetType: "export",
      targetLabel: exportId,
      detail: `exported: ${exportedTypes.join(", ")}`,
    });

    return {
      exportId,
      exportedTypes,
      url: `/api/admin/bulk/exports/${exportId}`,
      expiresAt,
    };
  } catch (e) {
    throw new Error(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}
