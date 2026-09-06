/**
 * Automated follow-up email for the Acquisition OS. When a lead finishes a
 * funnel as nurture or unqualified, the outcome screen promises them something
 * (a playbook, a free training) behind a CTA link. This delivers that same
 * promise by email too — so a lead who closes the tab still gets the resource,
 * unattended. Composition is pure and testable; sending goes through the
 * mailer, which no-ops safely without SMTP.
 */
import { sendMail } from "../mailer";
import type { QualOutcome } from "../studio/qualification-config";

export interface FollowUpEmail { subject: string; text: string }

/** Build the follow-up email from an outcome's copy. Returns null when there's
 *  nothing worth sending (no resource link to hand them). */
export function composeFollowUp(funnelTitle: string, outcome: QualOutcome, recipientName?: string): FollowUpEmail | null {
  const link = (outcome.ctaHref || "").trim();
  const isRealLink = /^(https?:|mailto:|tel:|\/)/i.test(link);
  if (!isRealLink) return null; // only auto-send when there's a real resource to point to

  const hi = recipientName && recipientName.trim() ? `Hi ${recipientName.trim()},` : "Hi,";
  const body = outcome.body ? `${outcome.body}\n\n` : "";
  const text =
    `${hi}\n\n` +
    `Thanks for taking the time on ${funnelTitle}.\n\n` +
    `${body}` +
    `${outcome.ctaLabel.replace(/\s*[→>]+\s*$/, "")}: ${link}\n\n` +
    `— The ${funnelTitle} team`;
  return { subject: outcome.heading || "Following up", text };
}

export interface FollowUpResult { sent: boolean; skipped?: string }

/** Compose + send the follow-up. Best-effort: no-ops (never throws) when there's
 *  no email, no resource link, or no mailer configured. */
export async function sendFollowUp(input: { to?: string; funnelTitle: string; outcome: QualOutcome; recipientName?: string }): Promise<FollowUpResult> {
  const to = (input.to || "").trim();
  if (!to) return { sent: false, skipped: "no email" };
  const email = composeFollowUp(input.funnelTitle, input.outcome, input.recipientName);
  if (!email) return { sent: false, skipped: "no resource link" };
  try {
    const r = await sendMail({ to, subject: email.subject, text: email.text });
    return { sent: r.sent, skipped: r.sent ? undefined : r.reason };
  } catch {
    return { sent: false, skipped: "send failed" };
  }
}
