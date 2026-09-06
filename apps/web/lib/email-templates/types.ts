/**
 * Email template types and interfaces.
 * All email templates follow a consistent structure and render both HTML and plain text.
 */

export interface EmailTemplate {
  /** Unique template identifier for lookup and logging */
  templateId: string;

  /** Email subject line */
  subject: string;

  /** Plain text body (required for fallback) */
  text: string;

  /** HTML body (optional, for rich formatting) */
  html?: string;

  /** Unsubscribe URL (only for marketing emails, not transactional) */
  unsubscribeUrl?: string;
}

export interface EmailTemplateData {
  /** Recipient email address */
  to: string;

  /** Recipient display name */
  name?: string;

  /** Template-specific context data */
  [key: string]: unknown;
}

export interface EmailQueueItem {
  id: string;
  templateId: string;
  to: string;
  name?: string;
  data: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  error?: string;
  sentAt?: string;
  createdAt: string;
  retries: number;
}

/**
 * Email category determines behavior:
 * - transactional: password resets, verifications, account changes — no unsubscribe
 * - notifications: programme updates, coaching messages — may have unsubscribe
 * - marketing: newsletters, broadcasts — must have unsubscribe
 */
export type EmailCategory = "transactional" | "notifications" | "marketing";

export interface TemplateContext {
  appName: string;
  appUrl: string;
  supportEmail: string;
  brandColor: string;
  year: number;
}
