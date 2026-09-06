/**
 * Generic bulk notification sender — Wave 4 foundation for "render and send
 * this to many recipients" with concurrency-capped rate limiting and
 * per-recipient delivery tracking. Built for lib/coach/digest-scheduler.ts,
 * but generic over the payload type so any future bulk job (a cohort-wide
 * announcement, a re-enrollment push) can reuse it instead of writing its
 * own send loop.
 *
 * Deliberately NOT the same thing as lib/outreach/broadcasts.ts: a broadcast
 * is a persisted, user-composed campaign sent to a segment-resolved audience,
 * with its own DB rows (broadcasts/broadcast_sends), opt-out suppression, and
 * scheduling. This is a lighter, stateless primitive with no table of its
 * own — call it, get a summary back, and decide what to do with failures
 * yourself (log them, hand the retry queue to another job run, drop them).
 * Reach for broadcasts.ts when the recipients come from a segment and the
 * send needs to be resumable/auditable on its own; reach for this when a
 * caller already knows exactly who to notify and just needs the fan-out.
 *
 * Sends through lib/mailer.ts's sendMail by default, so every message goes
 * through the app's one real SMTP/Resend/dev-log fallback — never a second,
 * parallel way to reach a mailbox. `options.send` exists only to substitute a
 * fake in tests (see test/bulk-sender.test.ts) or, someday, a non-email
 * channel with the same shape.
 */
import { sendMail, type MailMessage, type SendResult } from "../mailer";

export interface BulkRecipient {
  /** Identifies this recipient in `data` and in the returned results — a
   *  user id, or the email address itself when there's no separate id. */
  id: string;
  /** Delivery address. */
  to: string;
}

export interface RenderedMessage {
  subject: string;
  text: string;
  html?: string;
}

/**
 * Renders one recipient's message from their data, or returns null to skip
 * them entirely — no send attempted, not counted as a failure (e.g. a coach
 * whose whole roster is on track gets no email at all; see
 * renderCoachDigest). Throwing is treated as a per-recipient failure, not a
 * fatal error for the batch.
 */
export type BulkTemplate<T> = (data: T) => RenderedMessage | null;

export type BulkSendStatus = "sent" | "failed" | "skipped";

export interface BulkSendResult<T> {
  recipient: BulkRecipient;
  /** Absent only for the "no data supplied" skip — every other outcome had
   *  data to work with. */
  data?: T;
  status: BulkSendStatus;
  /** Present when status is "failed": the provider's reason, the thrown
   *  render error's message, or why the recipient was rejected outright
   *  (e.g. no valid address). Also set for a "skipped: no data" result. */
  reason?: string;
}

export interface BulkSendOptions {
  /** Max sends in flight at once (default 5). sendMail ultimately opens a
   *  real SMTP connection or hits a real HTTPS API — too much concurrency
   *  there risks provider throttling/connection limits, not just local
   *  resource use. */
  maxConcurrent?: number;
  /**
   * Minimum delay after each send completes, in ms (default 0 = off) — a
   * second, independent throttle from maxConcurrent: concurrency caps how
   * many are in flight at once, this caps how fast each freed slot re-fires,
   * which matters when sends themselves are near-instant (e.g. the mailer's
   * dev-mode "no provider configured" console-log fallback would otherwise
   * blast through hundreds of "sends" with no real pacing at all).
   */
  minDelayMs?: number;
  /** Override the transport — for tests, or a future non-email channel.
   *  Defaults to lib/mailer.ts's sendMail. */
  send?: (msg: MailMessage) => Promise<SendResult>;
}

export interface BulkSendSummary<T> {
  sent: number;
  failed: number;
  skipped: number;
  /** Every recipient considered, with their outcome — for logging/auditing
   *  the whole run, not just the tallies. */
  results: BulkSendResult<T>[];
  /**
   * Failed recipients, WITH their original data, ready to hand back into
   * another sendBulkNotifications call later. This run makes exactly one
   * attempt per recipient — deciding whether/when to retry (the next
   * scheduled run, an admin "retry failures" action, or nothing) is the
   * caller's call, not this module's.
   */
  retryQueue: { recipient: BulkRecipient; data: T }[];
}

const DEFAULT_MAX_CONCURRENT = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` over `items` with at most `limit` in flight at once — a small
 * dependency-free worker pool. Each worker pulls the next index as soon as
 * it's free, so a few slow items can't starve the fast ones behind them the
 * way naive fixed-size chunking (await a whole batch, then start the next)
 * would.
 */
async function mapWithConcurrency<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function dataFor<T>(store: Map<string, T> | Record<string, T>, id: string): T | undefined {
  return store instanceof Map ? store.get(id) : store[id];
}

/**
 * Sends one rendered message per recipient: looks up each recipient's data
 * from `data` (keyed by BulkRecipient.id), renders it with `template`, and
 * delivers with bounded concurrency (see BulkSendOptions). Never throws — a
 * missing data entry, a template that throws, or a provider failure is
 * captured in that one recipient's result and never stops the rest of the
 * batch.
 */
export async function sendBulkNotifications<T>(
  recipients: BulkRecipient[],
  template: BulkTemplate<T>,
  data: Map<string, T> | Record<string, T>,
  options: BulkSendOptions = {},
): Promise<BulkSendSummary<T>> {
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT);
  const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
  const send = options.send ?? sendMail;

  const results = await mapWithConcurrency(recipients, maxConcurrent, async (recipient): Promise<BulkSendResult<T>> => {
    const recipientData = dataFor(data, recipient.id);
    if (recipientData === undefined) {
      return { recipient, status: "skipped", reason: "no data supplied for this recipient" };
    }

    let rendered: RenderedMessage | null;
    try {
      rendered = template(recipientData);
    } catch (e) {
      return { recipient, data: recipientData, status: "failed", reason: e instanceof Error ? e.message : "template render failed" };
    }
    if (rendered === null) {
      return { recipient, data: recipientData, status: "skipped" };
    }
    if (!recipient.to || !recipient.to.includes("@")) {
      return { recipient, data: recipientData, status: "failed", reason: "no valid address for this recipient" };
    }

    let outcome: SendResult;
    try {
      const msg: MailMessage = { to: recipient.to, subject: rendered.subject, text: rendered.text };
      outcome = await send(rendered.html ? { ...msg, html: rendered.html } : msg);
    } catch (e) {
      outcome = { sent: false, reason: e instanceof Error ? e.message : "send threw" };
    }
    if (minDelayMs > 0) await sleep(minDelayMs);

    return outcome.sent
      ? { recipient, data: recipientData, status: "sent" }
      : { recipient, data: recipientData, status: "failed", reason: outcome.reason ?? "send failed" };
  });

  let sent = 0, failed = 0, skipped = 0;
  const retryQueue: { recipient: BulkRecipient; data: T }[] = [];
  for (const r of results) {
    if (r.status === "sent") sent++;
    else if (r.status === "skipped") skipped++;
    else { failed++; if (r.data !== undefined) retryQueue.push({ recipient: r.recipient, data: r.data }); }
  }
  return { sent, failed, skipped, results, retryQueue };
}
