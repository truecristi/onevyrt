/**
 * Weekly coach digest email — HTML + text renderer for the "who's gone
 * quiet" summary. Wave 4 foundation (see lib/coach/digest-scheduler.ts,
 * which gathers the data and calls this to decide what the email says and
 * how it looks) — kept pure and dependency-free like its plain-text sibling
 * lib/coach/digest.ts (used by the existing lib/coach/digest-run.ts job): no
 * DB, no mail provider, just data in and a rendered email out, so it can be
 * unit-tested without a database and reused by anything that has the same
 * shape of data (a job, an admin "preview digest" button, a manual resend).
 *
 * The HTML is a single table-based layout with everything styled inline —
 * the standard approach for cross-client HTML email (Outlook's desktop
 * renderer in particular ignores most CSS that isn't inline, and many
 * clients strip <head><style> or block externally-loaded assets outright).
 * No external fonts/images/scripts; the text part is a complete, independent
 * fallback, not an afterthought, for clients/readers that prefer or require
 * plain text.
 */
import type { EngagementStatus } from "../coach/engagement";

/** One quiet learner, ready to render — every field is already resolved by
 *  the caller (this module does no lookups of its own). */
export interface CoachDigestLearnerRow {
  /**
   * Best available human identifier for the learner. This app has no
   * separate "display name" field on a user (see the User interface in
   * lib/auth.ts — id/email/createdAt only), so callers pass the workspace
   * owner's email here; `workspaceName` is the separate, always-present
   * label for the account itself.
   */
  learnerName: string;
  workspaceName: string;
  /** Whole days since any recorded activity, or null when none was ever
   *  recorded (see daysSince in lib/coach/engagement.ts). */
  daysSinceActivity: number | null;
  /** Drives grouping and the default recommended action — see
   *  recommendedActionFor. Only the "quiet" statuses (never_started, idle,
   *  dormant) are meaningful in a digest; a caller should never hand this
   *  module a learner who isn't atRisk (see classifyEngagement). */
  status: EngagementStatus;
  /** What the coach should do about it. Usually recommendedActionFor(status)
   *  verbatim, but callers may override with something more specific. */
  recommendedAction: string;
}

export interface CoachDigestContent {
  learners: CoachDigestLearnerRow[];
  /** Personalization for the default greeting. Optional — with no display
   *  name on file for most users, callers commonly omit this and get a
   *  generic-but-warm greeting rather than an awkward one built from half an
   *  email address. */
  coachName?: string;
  /** Full greeting line override (e.g. "Morning, Alex —"), replacing both the
   *  default and the coachName-based one. */
  greeting?: string;
  /** Footer override — a support link, a workspace-specific sign-off, an
   *  unsubscribe note. Defaults to DEFAULT_FOOTER. */
  footer?: string;
  /** Optional deep link back into the product (e.g. the coach's roster),
   *  rendered as a button in the HTML and a plain URL in the text. */
  consoleUrl?: string;
}

export interface RenderedCoachDigest {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_FOOTER =
  "You're receiving this weekly summary because you coach one or more active cohorts. Reach out to a learner directly, or reply to this email with questions.";

/** Recommended actions, keyed by engagement status — total over every status
 *  so this stays a safe default even though, in practice, a digest only ever
 *  lists the three "quiet" statuses (never_started, idle, dormant); the rest
 *  are here so the map can't silently go missing a case as EngagementStatus
 *  grows. */
const RECOMMENDED_ACTIONS: Record<EngagementStatus, string> = {
  never_started: "Send a welcome check-in — confirm they're set up and know their first step.",
  idle: "A quick nudge often works — ask how it's going and whether anything's blocking them.",
  dormant: "Reach out personally (a call or 1:1 message) — an email alone hasn't been enough.",
  awaiting_review: "Review their latest submission so they're not stalled waiting on you.",
  changes_pending: "Follow up on the changes you requested — they may need clarification.",
  on_track: "No action needed — on track.",
  completed: "No action needed — completed.",
};

export function recommendedActionFor(status: EngagementStatus): string {
  return RECOMMENDED_ACTIONS[status];
}

/** Group headings, in urgency order — mirrors lib/coach/digest.ts's GROUPS so
 *  the two coach-facing "who's quiet" emails read the same way. */
const GROUPS: ReadonlyArray<{ heading: string; status: EngagementStatus }> = [
  { heading: "Gone quiet", status: "dormant" },
  { heading: "Idle", status: "idle" },
  { heading: "Not started", status: "never_started" },
];

const GROUP_ACCENT: Record<string, string> = {
  dormant: "#dc2626",
  idle: "#d97706",
  never_started: "#6b7280",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lastSeenLabel(days: number | null): string {
  if (days === null) return "No activity recorded";
  if (days === 0) return "Active today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function subjectFor(count: number): string {
  return count === 1 ? "1 learner has gone quiet" : `${count} learners have gone quiet`;
}

function greetingText(content: CoachDigestContent): string {
  if (content.greeting) return content.greeting;
  return content.coachName ? `Hi ${content.coachName},` : "Hi there,";
}

// ---- text -------------------------------------------------------------

function renderText(content: CoachDigestContent, atRiskCount: number): string {
  const one = atRiskCount === 1;
  const lines: string[] = [
    greetingText(content),
    "",
    `${atRiskCount} learner${one ? "" : "s"} need${one ? "s" : ""} a nudge this week.`,
  ];

  for (const group of GROUPS) {
    const inGroup = content.learners.filter((l) => l.status === group.status);
    if (inGroup.length === 0) continue;
    lines.push("", `${group.heading}:`);
    for (const l of inGroup) {
      lines.push(`• ${l.learnerName} (${l.workspaceName}) — ${lastSeenLabel(l.daysSinceActivity)}. ${l.recommendedAction}`);
    }
  }

  if (content.consoleUrl) lines.push("", `Open your console: ${content.consoleUrl}`);
  lines.push("", "—", content.footer ?? DEFAULT_FOOTER);

  return lines.join("\n");
}

// ---- html ---------------------------------------------------------------

function renderHtml(content: CoachDigestContent, atRiskCount: number): string {
  const one = atRiskCount === 1;
  const groupBlocks = GROUPS.map((group) => {
    const inGroup = content.learners.filter((l) => l.status === group.status);
    if (inGroup.length === 0) return "";
    const accent = GROUP_ACCENT[group.status] ?? "#6b7280";
    const rows = inGroup
      .map(
        (l) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(l.learnerName)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${escapeHtml(l.workspaceName)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;white-space:nowrap;">${escapeHtml(lastSeenLabel(l.daysSinceActivity))}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${escapeHtml(l.recommendedAction)}</td>
          </tr>`,
      )
      .join("");
    return `
      <tr>
        <td colspan="4" style="padding:20px 12px 6px;">
          <span style="display:inline-block;border-left:3px solid ${accent};padding-left:8px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(group.heading)} (${inGroup.length})</span>
        </td>
      </tr>
      <tr>
        <td colspan="4" style="padding:0 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <th align="left" style="padding:0 12px 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.03em;">Learner</th>
              <th align="left" style="padding:0 12px 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.03em;">Workspace</th>
              <th align="left" style="padding:0 12px 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.03em;">Last seen</th>
              <th align="left" style="padding:0 12px 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.03em;">Recommended action</th>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>`;
  }).join("");

  const consoleButton = content.consoleUrl
    ? `
      <tr>
        <td style="padding:24px 12px 4px;">
          <a href="${escapeHtml(content.consoleUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;">Open your console</a>
        </td>
      </tr>`
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="padding:24px 24px 8px;">
            <p style="margin:0 0 4px;font-size:15px;color:#111827;">${escapeHtml(greetingText(content))}</p>
            <p style="margin:0;font-size:14px;color:#4b5563;">${atRiskCount} learner${one ? "" : "s"} need${one ? "s" : ""} a nudge this week.</p>
          </td>
        </tr>
        ${groupBlocks}
        ${consoleButton}
        <tr>
          <td style="padding:24px 24px 24px;border-top:1px solid #e5e7eb;margin-top:16px;">
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">${escapeHtml(content.footer ?? DEFAULT_FOOTER)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/**
 * Builds one coach's digest email. Returns null when there is nothing to
 * report — mirrors buildDigest in lib/coach/digest.ts: "nothing to say" must
 * read as "no email," never as an empty or falsely-cheerful one.
 */
export function renderCoachDigest(content: CoachDigestContent): RenderedCoachDigest | null {
  const atRiskCount = content.learners.length;
  if (atRiskCount === 0) return null;
  return {
    subject: subjectFor(atRiskCount),
    html: renderHtml(content, atRiskCount),
    text: renderText(content, atRiskCount),
  };
}
