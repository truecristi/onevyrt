/**
 * Transactional email: pluggable. With no provider configured, mail is logged
 * to the server console instead of sent — loud and honest ("would send"),
 * never silently dropped, never faked as delivered.
 *
 * Two providers, tried in this order:
 *   1. SMTP (MAIL_ENABLED=true + SMTP_HOST) — for a real mailbox/host you
 *      control. Uses nodemailer; this is the one real dependency this file
 *      has, since raw SMTP isn't a fetch call the way Resend's API is.
 *   2. Resend (RESEND_API_KEY) — plain HTTPS API, no SDK needed.
 * SMTP wins when both are configured, since it means someone deliberately
 * pointed this instance at a specific mailbox.
 */
import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /**
   * Optional HTML alternative (e.g. lib/email/coach-digest-template.ts).
   * Sent as a proper multipart text+html message — `text` always goes too, so
   * every message still has a complete plaintext fallback for clients/readers
   * that want it, not just an afterthought. Omit for plain-text-only mail.
   */
  html?: string;
  /**
   * Set ONLY for marketing/bulk mail (currently broadcasts): the recipient's
   * one-click unsubscribe URL. When present, the message gains a
   * List-Unsubscribe header (+ RFC 8058 one-click) and an unsubscribe footer in
   * the body, satisfying CAN-SPAM and Gmail/Yahoo bulk-sender requirements.
   * Transactional mail (password resets, verification codes, receipts) omits it
   * and is unaffected — those must not carry an unsubscribe control.
   */
  unsubscribeUrl?: string;
}

export interface SendResult {
  sent: boolean;
  /** Present when sent === false: why, or the dev-mode notice. */
  reason?: string;
}

/** RFC 2369 + RFC 8058 headers for a one-click unsubscribe, or undefined for
 *  transactional mail (no unsubscribe URL). Gmail/Yahoo require the one-click
 *  POST form on bulk mail. */
function unsubscribeHeaders(url?: string): Record<string, string> | undefined {
  if (!url) return undefined;
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** Append a plain-text unsubscribe footer for marketing mail; leave
 *  transactional mail untouched. */
function bodyWithUnsubscribe(text: string, url?: string): string {
  if (!url) return text;
  return `${text}\n\n—\nYou're receiving this because you're a contact of this sender.\nUnsubscribe: ${url}`;
}

/** HTML counterpart to bodyWithUnsubscribe, for the rare case a caller sends
 *  marketing mail with an html body. No sender currently sets both `html` and
 *  `unsubscribeUrl` (broadcasts is text-only today), but this keeps that
 *  combination correct — CAN-SPAM-compliant — rather than silently dropping
 *  the footer the plain-text side already adds. */
function htmlWithUnsubscribe(html: string, url?: string): string {
  if (!url) return html;
  return `${html}<p style="margin-top:24px;font-size:12px;color:#9ca3af;">You're receiving this because you're a contact of this sender. <a href="${url}">Unsubscribe</a></p>`;
}

function smtpConfigured(): boolean {
  return process.env.MAIL_ENABLED === "true" && !!process.env.SMTP_HOST;
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;
function smtpTransport() {
  if (cachedTransport) return cachedTransport;
  const port = Number(process.env.SMTP_PORT) || 587;
  // "ssl" (or "true") means implicit TLS from the first byte (typically port
  // 465). Anything else — including unset — means STARTTLS-or-plain, which
  // nodemailer negotiates itself; secure:false is correct for port 587/25 too.
  const secure = /^(ssl|true|1)$/i.test(process.env.SMTP_SECURE ?? "");
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USERNAME ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return cachedTransport;
}

async function sendViaSmtp(msg: MailMessage): Promise<SendResult> {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME;
  const fromName = process.env.SMTP_FROM_NAME;
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
  try {
    await smtpTransport().sendMail({
      from, to: msg.to, subject: msg.subject,
      text: bodyWithUnsubscribe(msg.text, msg.unsubscribeUrl),
      ...(msg.html ? { html: htmlWithUnsubscribe(msg.html, msg.unsubscribeUrl) } : {}),
      headers: unsubscribeHeaders(msg.unsubscribeUrl),
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "SMTP send failed." };
  }
}

async function sendViaResend(msg: MailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "onboarding@resend.dev";
  if (!apiKey) return { sent: false, reason: "No email provider configured." };
  try {
    const payload: Record<string, unknown> = {
      from, to: [msg.to], subject: msg.subject,
      text: bodyWithUnsubscribe(msg.text, msg.unsubscribeUrl),
    };
    if (msg.html) payload.html = htmlWithUnsubscribe(msg.html, msg.unsubscribeUrl);
    const headers = unsubscribeHeaders(msg.unsubscribeUrl);
    if (headers) payload.headers = headers;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { sent: false, reason: `Email provider returned ${r.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Network error sending email." };
  }
}

export async function sendMail(msg: MailMessage): Promise<SendResult> {
  const result = smtpConfigured() ? await sendViaSmtp(msg)
    : process.env.RESEND_API_KEY ? await sendViaResend(msg)
    : null;
  if (result) {
    if (result.sent) console.log(`[mailer] sent to ${msg.to} via ${smtpConfigured() ? "SMTP" : "Resend"}`);
    else console.warn(`[mailer] send to ${msg.to} failed: ${result.reason}`);
    return result;
  }
  // Dev-mode fallback: no provider configured. Log instead of pretending to
  // send — but NEVER the body: password-reset and email-change links carry a
  // live, single-use token, and this is the real production fallback (not a
  // test-only path) whenever a deploy goes live before SMTP/Resend is wired
  // up. Server logs are captured durably (see lib/logger.ts) — a token that
  // lands there is as good as leaked. Log only enough to confirm "would have
  // sent this," never anything a recipient could use.
  console.log(`[mailer] No provider configured — would send email:\n  to: ${msg.to}\n  subject: ${msg.subject}\n  (body withheld — configure SMTP_HOST+MAIL_ENABLED or RESEND_API_KEY to actually deliver)`);
  return { sent: false, reason: "No email provider configured (set SMTP_HOST+MAIL_ENABLED, or RESEND_API_KEY, to send for real)." };
}
