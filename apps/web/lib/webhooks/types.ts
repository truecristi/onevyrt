/**
 * Type definitions for Business Events Webhook System
 *
 * Used by:
 * - app/api/webhooks/why-creed-events/route.ts (webhook receiver)
 * - lib/webhooks/business-events.ts (job processor)
 * - app/api/stripe/webhooks/route.ts (trigger from Stripe)
 * - app/api/programme/chapters/submit/route.ts (trigger from lessons)
 */
import { createHmac } from "node:crypto";

/**
 * Event types that trigger decision moments
 */
export type BusinessEventType =
  | "payment_processed" // Stripe charge.succeeded
  | "milestone_reached" // X leads, 1st sale, revenue target
  | "level_up" // Chapter completion, stage advancement
  | "daily_action" // User took specific action
  | "constraint_improved" // Bottleneck metric improved
  | "habit_reset"; // User returned after stall

/**
 * Business event payload sent to webhook
 */
export interface BusinessEvent {
  /** Event type identifier */
  type: BusinessEventType;

  /** Workspace ID (workspace owner will receive decision moment) */
  workspaceId: string;

  /** User ID (for attribution and personalization) */
  userId: string;

  /** User email (for email delivery) */
  userEmail: string;

  /** ISO 8601 timestamp of event occurrence */
  timestamp: string;

  /** Event-specific metadata (varies by type) */
  metadata: BusinessEventMetadata;
}

/**
 * Event metadata (union of all event types)
 */
export interface BusinessEventMetadata {
  // Payment event fields
  amount?: number; // In cents (e.g., 9900 = $99.00)
  currency?: string; // "usd", "gbp", etc.
  stripeChargeId?: string; // charge.id for deduplication

  // Milestone event fields
  milestoneType?: string; // "leads_milestone", "revenue_milestone", "conversion_milestone"
  milestoneValue?: number; // 100, 1000, 10000 (target)
  currentValue?: number; // 45, 5432, 8543 (actual)

  // Level-up event fields
  chapterId?: number; // 1, 2, 3, 4, 5 (DEFINE, IMPLEMENT, CONTROL, IMPROVE & SCALE, FINISH)
  lessonId?: string; // "m-bottleneck", "chapter-complete", etc.
  lessonTitle?: string; // Display name of lesson/chapter

  // Constraint improvement event fields
  constraintName?: string; // "Conversion Rate", "Email Open Rate", etc.
  constraintOldValue?: number; // Previous measurement
  constraintNewValue?: number; // New measurement
  improvementPercent?: number; // (new - old) / old * 100

  // Custom fields for extensibility
  [key: string]: any;
}

/**
 * Decision moment: personalized motivational messaging
 */
export interface DecisionMoment {
  /** Main headline (e.g., "Your Why is Being Tested") */
  title: string;

  /** Primary message body */
  body: string;

  /** Personalized why (if user has set it), tied to the event */
  why?: string;

  /** Personalized creed (if user has set it), tied to the event */
  creed?: string;

  /** URL to take action (e.g., /business/review) */
  actionUrl?: string;

  /** Label for action button (e.g., "Record this win") */
  actionLabel?: string;

  /** Email/notification urgency */
  urgencyLevel: "low" | "medium" | "high";
}

/**
 * Async job queued in job_queue table
 */
export interface JobQueueRecord {
  id: string;
  job_type: "send_decision_moment" | "send_weekly_digest" | "update_analytics";
  payload: JobPayload;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  retry_count: number; // 0-3
  next_retry_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Async job payload (varies by job_type)
 */
export type JobPayload = SendDecisionMomentPayload | SendWeeklyDigestPayload | UpdateAnalyticsPayload;

/**
 * Send decision moment: deliver notification + email
 */
export interface SendDecisionMomentPayload {
  eventId: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  decisionMoment: DecisionMoment;
  urgencyLevel: string;
}

/**
 * Send weekly digest: aggregate events for coaches
 */
export interface SendWeeklyDigestPayload {
  coachId: string;
  coachEmail: string;
  weekStartDate: string; // ISO 8601
  weekEndDate: string; // ISO 8601
  metrics: {
    paymentsProcessed: number;
    revenueTotal: number;
    milestonesReached: number;
    chaptersCompleted: number;
  };
  learners: {
    workspaceId: string;
    email: string;
    status: "active" | "stalled" | "completed";
  }[];
}

/**
 * Update analytics: record event for dashboards
 */
export interface UpdateAnalyticsPayload {
  eventId: string;
  eventType: BusinessEventType;
  workspaceId: string;
  userId: string;
  metadata: BusinessEventMetadata;
}

/**
 * Webhook request signature & verification
 */
export interface WebhookRequestMeta {
  signature: string; // HMAC-SHA256 hex
  timestamp: string; // ISO 8601, must be within 5 minutes
  body: string; // Raw JSON body for signature verification
}

/**
 * Webhook response (202 Accepted if successful)
 */
export interface WebhookResponse {
  success: boolean;
  eventId?: string;
  message?: string;
  error?: string;
}

/**
 * Why & Creed data for personalization
 */
export interface WhyCreedData {
  why?: string;
  creed?: string;
}

/**
 * Business event analytics aggregation
 */
export interface EventAnalytics {
  eventType: BusinessEventType;
  count: number;
  totalAmount?: number; // For payment events
  lastOccurredAt?: Date;
}

/**
 * Job queue statistics (for monitoring)
 */
export interface JobQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Helper: Create business event from common sources
 */
export function createBusinessEvent(
  type: BusinessEventType,
  workspaceId: string,
  userId: string,
  userEmail: string,
  metadata: BusinessEventMetadata
): BusinessEvent {
  return {
    type,
    workspaceId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Helper: Compute HMAC-SHA256 signature for webhook
 */
export function computeWebhookSignature(
  secret: string,
  timestamp: string,
  body: string
): string {
  const payload = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Helper: Verify webhook signature
 */
export function verifyWebhookSignature(
  secret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const computed = computeWebhookSignature(secret, timestamp, body);
  // Constant-time comparison to prevent timing attacks
  return computed === signature && secret.length > 0;
}

/**
 * Helper: Compute dedupe key for events (prevents duplicates)
 */
export function computeDedupeKey(event: BusinessEvent): string {
  switch (event.type) {
    case "payment_processed":
      return `event:payment_processed:${event.workspaceId}:${event.metadata.stripeChargeId}`;

    case "milestone_reached":
      return `event:milestone_reached:${event.workspaceId}:${event.metadata.milestoneType}_${event.metadata.milestoneValue}`;

    case "level_up":
      return `event:level_up:${event.workspaceId}:chapter_${event.metadata.chapterId}`;

    case "constraint_improved":
      return `event:constraint_improved:${event.workspaceId}:${event.metadata.constraintName}_${event.metadata.constraintNewValue}`;

    default:
      // Fallback: use timestamp + type for uniqueness
      return `event:${event.type}:${event.workspaceId}:${event.timestamp}`;
  }
}

/**
 * Helper: Get urgency level based on event type
 */
export function getEventUrgencyLevel(type: BusinessEventType): "low" | "medium" | "high" {
  switch (type) {
    case "payment_processed":
    case "milestone_reached":
    case "constraint_improved":
    case "habit_reset":
      return "high"; // Email immediately

    case "level_up":
      return "medium"; // Batch email

    case "daily_action":
    default:
      return "low"; // Digest only
  }
}

/**
 * Helper: Format event for logging/debugging
 */
export function formatEventForLog(event: BusinessEvent): string {
  return `${event.type} (${event.workspaceId}) at ${event.timestamp} metadata=${JSON.stringify(event.metadata)}`;
}
