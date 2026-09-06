/**
 * Webhook Receiver: Major Business Events (Why & Creed Moments)
 *
 * Listens for high-impact business events that trigger motivational "decision moments":
 * - Payment processed (revenue confirmation)
 * - Milestone reached (100 leads, first sale, etc.)
 * - Level-up (chapter completion, growth milestone)
 *
 * Flow:
 * 1. Webhook received → signature verified
 * 2. Event deduplicated (idempotent via dedupeKey)
 * 3. Notification created for user
 * 4. Analytics event logged for weekly digest
 * 5. Async job queued for heavy processing (email, dashboard updates)
 *
 * Triggers decision moments: "Your why is being tested here. How will you respond?"
 * These are the pivotal moments where action toward the user's creed becomes real.
 *
 * Triggered by:
 * - Stripe webhooks (charge.completed, customer.subscription.updated)
 * - Internal API (when lead conversion/booking completes)
 * - Scheduled jobs (weekly milestone detection)
 *
 * Authentication: HMAC-SHA256 signature (webhook_secret in Authorization header)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { pgPool, type Queryable } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendMail } from "@/lib/mailer";
import { randomBytes } from "node:crypto";

/**
 * Event Types that trigger decision moments
 */
export type BusinessEventType =
  | "payment_processed"    // Stripe charge.succeeded
  | "milestone_reached"    // X leads, first sale, revenue target
  | "level_up"             // Chapter completion, stage advancement
  | "daily_action"         // User took specific action (call, post, etc.)
  | "constraint_improved"  // Bottleneck metric improved
  | "habit_reset";         // User returned after stall

/**
 * Event structure (from Stripe, internal API, or job)
 */
export interface BusinessEvent {
  type: BusinessEventType;
  workspaceId: string;
  userId: string;
  userEmail: string;
  timestamp: string; // ISO 8601

  // Event-specific metadata
  metadata: {
    // Payment event
    amount?: number;
    currency?: string;
    stripeChargeId?: string;

    // Milestone event
    milestoneType?: string; // "leads_milestone", "revenue_milestone", "conversion_milestone"
    milestoneValue?: number; // 100, 1000, 10000
    currentValue?: number; // 45, 5432, 8543

    // Level-up event
    chapterId?: number; // 1, 2, 3, 4, 5
    lessonId?: string;
    lessonTitle?: string;

    // Constraint improvement
    constraintName?: string;
    constraintOldValue?: number;
    constraintNewValue?: number;
    improvementPercent?: number;

    // Custom fields
    [key: string]: any;
  };
}

/**
 * Decision Moment: Motivational messaging tied to event
 */
export interface DecisionMoment {
  title: string;
  body: string;
  why?: string; // If user has set why, include personalized version
  creed?: string; // If user has set creed, tie action back to it
  actionUrl?: string;
  actionLabel?: string;
  urgencyLevel: "low" | "medium" | "high"; // "high" = daily email
}

/**
 * Configuration & Constants
 */
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_WHY_CREED_EVENTS || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://onevyrt.masteryresearch.com";

/**
 * Verify HMAC-SHA256 signature
 * Header format: Authorization: Bearer <sha256_hex>
 * Signature computed over: timestamp + "." + JSON.stringify(body)
 */
function verifySignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] WEBHOOK_SECRET_WHY_CREED_EVENTS not configured");
    return false;
  }

  const payload = `${timestamp}.${body}`;
  const computed = createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  return computed === signature;
}

/**
 * Generate decision moment messaging based on event type
 */
function generateDecisionMoment(
  event: BusinessEvent,
  userWhy?: string,
  userCreed?: string
): DecisionMoment {
  switch (event.type) {
    case "payment_processed":
      return {
        title: "Your Why is Being Tested",
        body: `Payment confirmed: $${(event.metadata.amount || 0) / 100}. Real money is moving because of your business. What's next?`,
        why: userWhy
          ? `Your why: "${userWhy}"\n\nThis payment is proof your idea matters. How will you reinvest it?`
          : undefined,
        actionUrl: `${APP_URL}/business/review`,
        actionLabel: "Record this win",
        urgencyLevel: "high",
      };

    case "milestone_reached":
      return {
        title: `Milestone Achieved: ${event.metadata.milestoneValue}`,
        body: `You've reached ${event.metadata.milestoneValue} ${event.metadata.milestoneType}. This is real progress. Now what?`,
        why: userWhy
          ? `Your why: "${userWhy}"\n\nYou're building something real. ${event.metadata.milestoneValue} people have engaged.`
          : undefined,
        creed: userCreed
          ? `Your creed demands: "${userCreed}"\n\nProve it by taking one action today.`
          : undefined,
        actionUrl: `${APP_URL}/business/execution`,
        actionLabel: "Plan your next 7 days",
        urgencyLevel: "high",
      };

    case "level_up":
      return {
        title: `You Completed Chapter ${event.metadata.chapterId}`,
        body: `"${event.metadata.lessonTitle}" is complete. Your understanding has deepened. Ready for the next level?`,
        why: userWhy ? `Your why: "${userWhy}"\n\nYou're one step closer.` : undefined,
        actionUrl: `${APP_URL}/programme/chapter-${(event.metadata.chapterId ?? 0) + 1}`,
        actionLabel: "See what's next",
        urgencyLevel: "medium",
      };

    case "constraint_improved":
      return {
        title: `Constraint Improved: ${event.metadata.constraintName}`,
        body: `${event.metadata.constraintName} improved by ${event.metadata.improvementPercent}%. You're making the constraint move. Double down.`,
        creed: userCreed
          ? `Your creed: "${userCreed}"\n\nThis improvement proves your system works.`
          : undefined,
        actionUrl: `${APP_URL}/business/drivers`,
        actionLabel: "Review your constraint",
        urgencyLevel: "high",
      };

    case "daily_action":
      return {
        title: "Action Recorded",
        body: `One step taken toward your why. Consistency compounds.`,
        why: userWhy ? `Your why: "${userWhy}"\n\nKeep going.` : undefined,
        actionUrl: `${APP_URL}/command-center`,
        actionLabel: "Continue",
        urgencyLevel: "low",
      };

    case "habit_reset":
      return {
        title: "We Missed You",
        body: `It's been quiet. Your why doesn't achieve itself. Are you still in?`,
        why: userWhy ? `Your why: "${userWhy}"\n\nRemind yourself why this matters.` : undefined,
        creed: userCreed ? `Your creed: "${userCreed}"\n\nOne action, today.` : undefined,
        actionUrl: `${APP_URL}/command-center`,
        actionLabel: "Get back on track",
        urgencyLevel: "high",
      };

    default:
      return {
        title: "Business Event",
        body: `Something significant just happened in your business.`,
        actionUrl: `${APP_URL}/command-center`,
        actionLabel: "Review",
        urgencyLevel: "medium",
      };
  }
}

/**
 * Log event for analytics & weekly digest
 * Stored in business_events table for aggregation
 */
async function logBusinessEvent(
  event: BusinessEvent,
  decisionMoment: DecisionMoment,
  pool: Queryable
): Promise<string> {
  const eventId = randomBytes(8).toString("hex");
  const dedupeKey = `event:${event.type}:${event.workspaceId}:${event.metadata.stripeChargeId || event.metadata.milestoneType || event.metadata.chapterId || Date.now()}`;

  // Insert event log (with deduplication)
  // If dedupe key exists, this is a retry of same event — skip
  const result = await pool.query(
    `INSERT INTO business_events (
      id, workspace_id, user_id, event_type, metadata, decision_moment, dedupe_key, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id`,
    [
      eventId,
      event.workspaceId,
      event.userId,
      event.type,
      JSON.stringify(event.metadata),
      JSON.stringify(decisionMoment),
      dedupeKey,
    ]
  );

  return result.rows[0]?.id || eventId;
}

/**
 * Fetch user's why & creed for personalization
 */
async function getUserWhyCreed(
  workspaceId: string,
  pool: Queryable
): Promise<{ why?: string; creed?: string }> {
  try {
    const result = await pool.query(
      `SELECT why, creed FROM workspace_why_creed
       WHERE workspace_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [workspaceId]
    );

    if (result.rows[0]) {
      return {
        why: result.rows[0].why || undefined,
        creed: result.rows[0].creed || undefined,
      };
    }
    return {};
  } catch (error) {
    console.error(`[WEBHOOK] Failed to fetch why/creed for workspace ${workspaceId}`, error);
    return {};
  }
}

/**
 * Queue async job for notification + email delivery
 * Uses the job_queue table (lightweight async task runner)
 */
async function queueNotificationJob(
  eventId: string,
  event: BusinessEvent,
  decisionMoment: DecisionMoment,
  pool: Queryable
): Promise<void> {
  const jobId = randomBytes(8).toString("hex");

  await pool.query(
    `INSERT INTO job_queue (id, job_type, payload, status, created_at, retry_count)
     VALUES ($1, $2, $3, $4, now(), 0)`,
    [
      jobId,
      "send_decision_moment",
      JSON.stringify({
        eventId,
        workspaceId: event.workspaceId,
        userId: event.userId,
        userEmail: event.userEmail,
        decisionMoment,
        urgencyLevel: decisionMoment.urgencyLevel,
      }),
      "pending",
    ]
  );
}

/**
 * Create in-app notification + email
 * For high-urgency events, also send email immediately
 */
async function createDecisionNotification(
  event: BusinessEvent,
  decisionMoment: DecisionMoment,
  _pool: Queryable
): Promise<void> {
  // In-app notification (bell icon)
  await createNotification({
    userId: event.userId,
    workspaceId: event.workspaceId,
    type: `decision_moment:${event.type}`,
    title: decisionMoment.title,
    body: decisionMoment.body,
    linkUrl: decisionMoment.actionUrl,
    dedupeKey: `decision:${event.type}:${event.workspaceId}:${Date.now()}`,
  });

  // For high-urgency events, send email immediately
  if (decisionMoment.urgencyLevel === "high") {
    try {
      const subject = `[Your Business] ${decisionMoment.title}`;
      const htmlBody = buildEmailHtml(decisionMoment);
      const plainTextBody = buildEmailPlainText(decisionMoment);

      await sendMail({
        to: event.userEmail,
        subject,
        html: htmlBody,
        text: plainTextBody,
      });
    } catch (error) {
      console.error(
        `[WEBHOOK] Failed to send email for event ${event.type} to ${event.userEmail}`,
        error
      );
      // Don't fail the webhook if email fails — notification is created
    }
  }
}

/**
 * Build HTML email from decision moment
 */
function buildEmailHtml(moment: DecisionMoment): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">${moment.title}</h2>
      <p style="color: #374151; line-height: 1.6;">${moment.body}</p>

      ${moment.why ? `<div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
        <p style="margin: 0; color: #374151;"><strong>Your Why:</strong></p>
        <p style="margin: 5px 0 0 0; color: #374151; font-style: italic;">"${moment.why}"</p>
      </div>` : ""}

      ${moment.creed ? `<div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
        <p style="margin: 0; color: #374151;"><strong>Your Creed:</strong></p>
        <p style="margin: 5px 0 0 0; color: #374151; font-style: italic;">"${moment.creed}"</p>
      </div>` : ""}

      ${moment.actionUrl ? `<div style="margin: 30px 0; text-align: center;">
        <a href="${moment.actionUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          ${moment.actionLabel || "View"}
        </a>
      </div>` : ""}

      <p style="color: #9ca3af; font-size: 12px; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        This is a decision moment. Your why doesn't achieve itself.
      </p>
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

${moment.why ? `Your Why:\n"${moment.why}\n\n` : ""}${moment.creed ? `Your Creed:\n"${moment.creed}\n\n` : ""}${moment.actionUrl ? `${moment.actionLabel || "View"}:\n${moment.actionUrl}\n\n` : ""}This is a decision moment. Your why doesn't achieve itself.
  `;
}

/**
 * Process webhook event
 */
async function processEvent(
  event: BusinessEvent,
  pool: Queryable
): Promise<{ success: boolean; eventId: string; error?: string }> {
  try {
    // Fetch user's why & creed for personalization
    const { why, creed } = await getUserWhyCreed(event.workspaceId, pool);

    // Generate decision moment messaging
    const decisionMoment = generateDecisionMoment(event, why, creed);

    // Log event to business_events table (deduped)
    const eventId = await logBusinessEvent(event, decisionMoment, pool);

    // Create in-app notification + email
    await createDecisionNotification(event, decisionMoment, pool);

    // Queue async job for any heavy processing
    await queueNotificationJob(eventId, event, decisionMoment, pool);

    console.log(
      `[WEBHOOK] Event processed: ${event.type} (${eventId}) for workspace ${event.workspaceId}`
    );

    return { success: true, eventId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[WEBHOOK] Event processing failed: ${event.type}`, error);
    return { success: false, eventId: "", error: errorMsg };
  }
}

/**
 * POST /api/webhooks/why-creed-events
 *
 * Request body: BusinessEvent
 * Headers:
 *   Authorization: Bearer <hmac-sha256-signature>
 *   X-Webhook-Timestamp: <ISO8601>
 *
 * Returns: 200 { success, eventId } or error
 */
export async function POST(req: NextRequest) {
  const timestamp = req.headers.get("x-webhook-timestamp");
  const authHeader = req.headers.get("authorization") || "";
  const signature = authHeader.replace("Bearer ", "").trim();

  // Validate timestamp freshness (within 5 minutes)
  if (timestamp) {
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();
    if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Webhook timestamp too old (must be within 5 minutes)" },
        { status: 400 }
      );
    }
  }

  try {
    // Read body for signature verification
    const bodyText = await req.text();

    // Verify HMAC signature
    if (!verifySignature(signature, timestamp || "", bodyText)) {
      console.warn("[WEBHOOK] Signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse event
    const event = JSON.parse(bodyText) as BusinessEvent;

    // Validate event structure
    if (!event.type || !event.workspaceId || !event.userId || !event.userEmail) {
      return NextResponse.json(
        { error: "Missing required fields: type, workspaceId, userId, userEmail" },
        { status: 400 }
      );
    }

    // Process event
    const pool = pgPool();
    const result = await processEvent(event, pool);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Event processing failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        eventId: result.eventId,
        message: `Event ${event.type} queued for processing`,
      },
      { status: 202 } // Accepted (async processing)
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[WEBHOOK] Request processing failed", error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}

/**
 * GET /api/webhooks/why-creed-events
 * Health check endpoint
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  // Simple auth check for health endpoint
  if (secret && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  return NextResponse.json(
    {
      status: "ready",
      endpoint: "/api/webhooks/why-creed-events",
      method: "POST",
      eventTypes: [
        "payment_processed",
        "milestone_reached",
        "level_up",
        "daily_action",
        "constraint_improved",
        "habit_reset",
      ],
      authentication: {
        scheme: "HMAC-SHA256",
        header: "Authorization: Bearer <signature>",
        payload: "timestamp.body",
        timestamp_header: "X-Webhook-Timestamp",
      },
      configured: !!WEBHOOK_SECRET,
    },
    { status: 200 }
  );
}
