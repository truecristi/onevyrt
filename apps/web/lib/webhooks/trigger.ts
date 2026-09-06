/**
 * Helper library to trigger business events from anywhere in the app
 *
 * Usage:
 *   import { triggerPaymentEvent, triggerLevelUpEvent } from '@/lib/webhooks/trigger';
 *
 *   await triggerPaymentEvent(workspaceId, userId, email, amount, stripeChargeId);
 *   await triggerLevelUpEvent(workspaceId, userId, email, chapterId, lessonTitle);
 *
 * All functions are idempotent (same event can be sent multiple times safely).
 */

import { createHmac } from "node:crypto";
import type {
  BusinessEvent,
  BusinessEventType,
  BusinessEventMetadata,
} from "./types";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_WHY_CREED_EVENTS || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://onevyrt.masteryresearch.com";

/**
 * Compute HMAC-SHA256 signature for webhook request
 */
function computeSignature(timestamp: string, body: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Post event to webhook receiver
 * Handles all HTTP/network concerns; safe to call from API routes or jobs
 */
async function sendWebhookEvent(event: BusinessEvent): Promise<{
  success: boolean;
  eventId?: string;
  error?: string;
}> {
  if (!WEBHOOK_SECRET) {
    console.warn(
      "[TRIGGER] WEBHOOK_SECRET_WHY_CREED_EVENTS not configured; event not sent"
    );
    return {
      success: false,
      error: "WEBHOOK_SECRET_WHY_CREED_EVENTS not configured",
    };
  }

  try {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify(event);
    const signature = computeSignature(timestamp, body);

    const response = await fetch(
      `${APP_URL}/api/webhooks/why-creed-events`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${signature}`,
          "X-Webhook-Timestamp": timestamp,
          "Content-Type": "application/json",
        },
        body,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as {
      success: boolean;
      eventId?: string;
      error?: string;
    };

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[TRIGGER] Webhook POST failed:", error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Trigger: Payment Processed
 *
 * When a Stripe charge succeeds or payment is received.
 * Generates decision moment: "Your why is being tested. Real money is moving."
 */
export async function triggerPaymentEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  amount: number, // in cents: 9900 = $99.00
  stripeChargeId: string, // for deduplication
  currency: string = "usd"
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type: "payment_processed",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      amount,
      currency,
      stripeChargeId,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Milestone Reached
 *
 * When a business metric reaches a target (100 leads, first sale, $10k revenue).
 * Generates decision moment: "You've reached [milestone]. This is real progress."
 */
export async function triggerMilestoneEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  milestoneType: "leads_milestone" | "revenue_milestone" | "conversion_milestone",
  milestoneValue: number, // target: 100, 1000, 10000
  currentValue: number // actual: 45, 5432, 8543
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type: "milestone_reached",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      milestoneType,
      milestoneValue,
      currentValue,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Level Up
 *
 * When user completes a chapter or lesson.
 * Generates decision moment: "Your understanding has deepened. Ready for the next level?"
 */
export async function triggerLevelUpEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  chapterId: number, // 1-5
  lessonId: string, // "m-bottleneck", "chapter-complete", etc.
  lessonTitle: string // "Find Your Bottleneck"
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type: "level_up",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      chapterId,
      lessonId,
      lessonTitle,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Daily Action
 *
 * When user records an action (call, email, post, etc.).
 * Generates decision moment: "One step taken toward your why. Consistency compounds."
 */
export async function triggerDailyActionEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  actionType: string, // "call_booked", "email_sent", "post_published", etc.
  actionDescription?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type: "daily_action",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      actionType,
      actionDescription,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Constraint Improved
 *
 * When a business constraint (bottleneck) metric improves.
 * Generates decision moment: "You're making the constraint move. Double down."
 */
export async function triggerConstraintImprovedEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  constraintName: string, // "Conversion Rate", "Email Open Rate", "Call Booking Rate"
  oldValue: number,
  newValue: number,
  unit: string = "%" // "%", "calls", "emails", etc.
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const improvement = newValue - oldValue;
  const improvementPercent =
    oldValue > 0 ? (improvement / oldValue) * 100 : 0;

  const event: BusinessEvent = {
    type: "constraint_improved",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      constraintName,
      constraintOldValue: oldValue,
      constraintNewValue: newValue,
      improvementPercent,
      unit,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Habit Reset
 *
 * When a stalled user returns (after 7+ days without activity).
 * Generates decision moment: "We missed you. Your why doesn't achieve itself. Are you still in?"
 */
export async function triggerHabitResetEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  daysSinceLastActivity: number
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type: "habit_reset",
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata: {
      daysSinceLastActivity,
    },
  };

  return sendWebhookEvent(event);
}

/**
 * Trigger: Custom Event
 *
 * For events not covered by the standard types above.
 * Still creates a decision moment, but with generic messaging.
 */
export async function triggerCustomEvent(
  workspaceId: string,
  userId: string,
  userEmail: string,
  type: BusinessEventType,
  metadata: BusinessEventMetadata
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event: BusinessEvent = {
    type,
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata,
  };

  return sendWebhookEvent(event);
}

/**
 * Health check: verify webhook is configured and reachable
 */
export async function checkWebhookHealth(): Promise<{
  ready: boolean;
  status?: string;
  configured: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${APP_URL}/api/webhooks/why-creed-events?secret=health-check`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      return {
        ready: false,
        configured: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as any;

    return {
      ready: data.status === "ready",
      status: data.status,
      configured: data.configured,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      ready: false,
      configured: false,
      error: errorMsg,
    };
  }
}

/**
 * Example: How to use these functions
 *
 * In an API route (e.g., /api/stripe/webhooks):
 *
 *   import { triggerPaymentEvent } from '@/lib/webhooks/trigger';
 *
 *   if (event.type === 'charge.succeeded') {
 *     const charge = event.data.object;
 *     const result = await triggerPaymentEvent(
 *       charge.metadata.workspace_id,
 *       charge.metadata.user_id,
 *       charge.receipt_email,
 *       charge.amount,
 *       charge.id
 *     );
 *
 *     if (!result.success) {
 *       console.error('Failed to trigger payment event:', result.error);
 *       // Log but don't fail — charge was processed
 *     }
 *   }
 *
 * In a lesson submit handler:
 *
 *   import { triggerLevelUpEvent } from '@/lib/webhooks/trigger';
 *
 *   await updateEnrollment(workspaceId, enrollment);
 *   await triggerLevelUpEvent(
 *     workspaceId,
 *     userId,
 *     email,
 *     chapterId,
 *     'chapter-complete',
 *     `Chapter ${chapterId} Completed`
 *   );
 *
 * In a scheduled job:
 *
 *   import { triggerMilestoneEvent, triggerHabitResetEvent } from '@/lib/webhooks/trigger';
 *
 *   const leadCount = await getLeadCount(workspaceId);
 *   if (leadCount === 100) {
 *     await triggerMilestoneEvent(
 *       workspaceId, userId, email,
 *       'leads_milestone', 100, leadCount
 *     );
 *   }
 *
 *   const daysSinceActivity = await getDaysSinceLastActivity(workspaceId);
 *   if (daysSinceActivity >= 7) {
 *     await triggerHabitResetEvent(workspaceId, userId, email, daysSinceActivity);
 *   }
 */
