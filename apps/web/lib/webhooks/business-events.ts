/**
 * Business Events Job Processor
 *
 * Integrated with lib/jobs.ts — processes pending decision moment notifications
 * and other async tasks from the job_queue table (populated by webhook receiver).
 *
 * Jobs processed:
 * - send_decision_moment: Deliver personalized notification + email for event
 * - retry_failed: Retry failed jobs with exponential backoff
 * - cleanup_stale: Delete completed jobs older than 7 days
 */

import { pgPool } from "../db";
import { createNotification } from "../notifications";
import { sendMail } from "../mailer";
import type { DecisionMoment } from "@/app/api/webhooks/why-creed-events/route";

export interface JobQueueRow {
  id: string;
  job_type: string;
  payload: any;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  retry_count: number;
  next_retry_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Process pending decision moment notifications
 * Picks up ~50 pending jobs per run (batched)
 */
export async function processDecisionMomentJobs(): Promise<{ created: number }> {
  const pool = pgPool();

  // Get pending jobs (up to 50, ordered by urgency then age)
  const result = await pool.query<JobQueueRow>(
    `SELECT id, job_type, payload, status, error_message, retry_count, next_retry_at, created_at, updated_at
     FROM job_queue
     WHERE job_type = 'send_decision_moment'
       AND status = 'pending'
       AND (next_retry_at IS NULL OR next_retry_at <= now())
     ORDER BY
       -- Urgency: sort by urgency level from payload
       CASE
         WHEN payload->>'urgencyLevel' = 'high' THEN 0
         WHEN payload->>'urgencyLevel' = 'medium' THEN 1
         ELSE 2
       END,
       created_at ASC
     LIMIT 50`,
    []
  );

  let processed = 0;

  for (const job of result.rows) {
    try {
      // Mark as processing
      await pool.query(
        "UPDATE job_queue SET status = $1, updated_at = now() WHERE id = $2",
        ["processing", job.id]
      );

      // Extract payload
      const {
        eventId,
        workspaceId,
        userId,
        userEmail,
        decisionMoment,
      } = job.payload as {
        eventId: string;
        workspaceId: string;
        userId: string;
        userEmail: string;
        decisionMoment: DecisionMoment;
        urgencyLevel: string;
      };

      // Create in-app notification
      await createNotification({
        userId,
        workspaceId,
        type: `decision_moment`,
        title: decisionMoment.title,
        body: decisionMoment.body,
        linkUrl: decisionMoment.actionUrl,
        dedupeKey: `decision:notification:${eventId}`,
      });

      // Send email (already sent immediately by webhook, but queue for retry if needed)
      try {
        const subject = `[Your Business] ${decisionMoment.title}`;
        const htmlBody = buildEmailHtml(decisionMoment);
        const plainTextBody = buildEmailPlainText(decisionMoment);

        await sendMail({
          to: userEmail,
          subject,
          html: htmlBody,
          text: plainTextBody,
        });
      } catch (emailError) {
        // Log but don't fail — notification was created
        console.error(
          `[BUSINESS_EVENTS] Email send failed for event ${eventId}:`,
          emailError
        );
      }

      // Mark as completed
      await pool.query(
        "UPDATE job_queue SET status = $1, completed_at = now(), updated_at = now() WHERE id = $2",
        ["completed", job.id]
      );

      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      // Increment retry count
      const newRetryCount = job.retry_count + 1;
      const maxRetries = 3;

      if (newRetryCount >= maxRetries) {
        // Max retries exceeded — mark as failed
        await pool.query(
          `UPDATE job_queue
           SET status = $1, error_message = $2, retry_count = $3, updated_at = now()
           WHERE id = $4`,
          ["failed", errorMsg, newRetryCount, job.id]
        );

        console.error(
          `[BUSINESS_EVENTS] Job ${job.id} failed after ${newRetryCount} retries:`,
          error
        );
      } else {
        // Schedule retry with exponential backoff: 5 * retry_count minutes
        const backoffMinutes = 5 * newRetryCount;
        const nextRetryAt = new Date(
          Date.now() + backoffMinutes * 60 * 1000
        ).toISOString();

        await pool.query(
          `UPDATE job_queue
           SET status = $1, error_message = $2, retry_count = $3, next_retry_at = $4, updated_at = now()
           WHERE id = $5`,
          ["pending", errorMsg, newRetryCount, nextRetryAt, job.id]
        );

        console.warn(
          `[BUSINESS_EVENTS] Job ${job.id} retry ${newRetryCount}/${maxRetries} scheduled for ${nextRetryAt}`,
          error
        );
      }
    }
  }

  return { created: processed };
}

/**
 * Clean up completed jobs older than 7 days
 * Runs daily as part of the job tick
 */
export async function cleanupCompletedJobs(): Promise<{ deleted: number }> {
  const pool = pgPool();

  // Soft-delete completed jobs older than 7 days
  const result = await pool.query(
    `UPDATE job_queue
     SET deleted_at = now(), updated_at = now()
     WHERE status = 'completed'
       AND completed_at < now() - interval '7 days'
       AND deleted_at IS NULL
     RETURNING id`,
    []
  );

  return { deleted: result.rowCount ?? 0 };
}

/**
 * Build HTML email from decision moment
 */
function buildEmailHtml(moment: DecisionMoment): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
      <h2 style="margin-top: 0; color: #0f172a;">${escapeHtml(moment.title)}</h2>
      <p style="line-height: 1.6; color: #374151; font-size: 16px;">${escapeHtml(moment.body)}</p>

      ${
        moment.why
          ? `<div style="background: #eff6ff; padding: 16px; border-left: 4px solid #2563eb; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-weight: 600;">Your Why</p>
        <p style="margin: 8px 0 0 0; color: #374151; font-style: italic;">&#8220;${escapeHtml(moment.why)}&#8221;</p>
      </div>`
          : ""
      }

      ${
        moment.creed
          ? `<div style="background: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-weight: 600;">Your Creed</p>
        <p style="margin: 8px 0 0 0; color: #374151; font-style: italic;">&#8220;${escapeHtml(moment.creed)}&#8221;</p>
      </div>`
          : ""
      }

      ${
        moment.actionUrl
          ? `<div style="margin: 32px 0; text-align: center;">
        <a href="${escapeHtml(moment.actionUrl)}" style="background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; font-size: 16px;">
          ${escapeHtml(moment.actionLabel || "View")}
        </a>
      </div>`
          : ""
      }

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #6b7280; font-size: 13px; margin: 0;">
          This is a decision moment. <strong>Your why doesn't achieve itself.</strong>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          These moments are where your journey is made real.
        </p>
      </div>
    </div>
  `;
}

/**
 * Build plain text email from decision moment
 */
function buildEmailPlainText(moment: DecisionMoment): string {
  return `
${moment.title}

${moment.body}

${moment.why ? `YOUR WHY\n"${moment.why}"\n\n` : ""}${moment.creed ? `YOUR CREED\n"${moment.creed}"\n\n` : ""}${
    moment.actionUrl
      ? `${moment.actionLabel || "View"}:\n${moment.actionUrl}\n\n`
      : ""
  }---

This is a decision moment. Your why doesn't achieve itself.
These moments are where your journey is made real.
  `.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * Get summary of pending jobs for monitoring
 */
export async function getJobQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const pool = pgPool();

  const result = await pool.query<{
    status: string;
    count: number;
  }>(
    `SELECT status, COUNT(*) as count
     FROM job_queue
     WHERE deleted_at IS NULL
     GROUP BY status`,
    []
  );

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  for (const row of result.rows) {
    stats[row.status as keyof typeof stats] = Number(row.count);
    stats.total += Number(row.count);
  }

  return stats;
}
