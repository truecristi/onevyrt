/**
 * Single delivery ATTEMPT for one webhook_delivery_queue row. This module
 * does not retry — it makes one POST and reports how it went. Retry
 * scheduling (backoff, attempt counting, dead-lettering) lives one layer up
 * in ./retry-queue.ts, which persists next_retry_at in the database and
 * re-polls it; a function can't usefully "retry with a 24-hour backoff"
 * in-process, so the retry loop has to be the thing that re-invokes this on
 * its own schedule, not something nested inside it.
 *
 * Reuses the same SSRF-pinned fetch dispatchEvent uses (lib/webhooks.ts /
 * lib/safe-fetch.ts): resolve once, validate the resolved address, connect to
 * exactly that address. A plain fetch() re-resolves DNS at connect time, so a
 * low-TTL attacker-controlled name could pass validation and then rebind to
 * an internal address for the actual request. Redirects are never followed
 * (pinnedFetch returns the 3xx as-is), so a destination can't 3xx-bounce
 * delivery to a private host either.
 *
 * target_url safety at ENQUEUE time is the caller's job (same split as
 * lib/url-safety.ts's isPublicAddress vs createWebhook: registration-time
 * checks belong to the public-facing route, not the library primitive).
 * validateAddress here is the real, always-on runtime backstop — production
 * always uses isPublicAddress; only tests inject a permissive one to reach a
 * loopback mock receiver.
 */
import { pinnedFetch, SsrfPinError } from "../safe-fetch";
import { isPublicAddress } from "../url-safety";

/** The minimum a delivery attempt needs — a superset like QueuedWebhook
 *  (retry-queue.ts) satisfies this structurally, so callers can pass a full
 *  queue row straight through without remapping. */
export interface WebhookQueueItem {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  targetUrl: string;
  /** Attempts already made BEFORE this one — used only to label the
   *  x-onevyrt-attempt header for the receiver's own logging. */
  attemptCount: number;
}

export interface DeliveryResult {
  ok: boolean;
  status?: number; // HTTP status; absent when the request never completed (timeout/DNS/blocked)
  error?: string;
}

type AddressValidator = (address: string, family: number) => boolean;

const DELIVERY_TIMEOUT_MS = 10_000;

/** POSTs the event once and reports success/failure. Never throws — the
 *  retry queue's batch loop treats a thrown error as "isolate this row and
 *  move on", but a delivery outcome (including "blocked" or "timed out") is
 *  meant to feed the backoff decision, not abort the whole tick. */
export async function deliverWebhook(item: WebhookQueueItem, allowAddress: AddressValidator = isPublicAddress): Promise<DeliveryResult> {
  const rawBody = JSON.stringify(item.payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await pinnedFetch(item.targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(rawBody)),
        // Lets a receiver dedupe (delivery-id) and log retries (attempt) —
        // no HMAC signature here; that's a per-destination secret a specific
        // integration supplies when it gets wired into this queue (Wave 4),
        // not something this generic foundation has to hand.
        "x-onevyrt-event": item.eventType,
        "x-onevyrt-delivery-id": item.id,
        "x-onevyrt-attempt": String(item.attemptCount + 1),
      },
      body: rawBody,
      signal: controller.signal,
      validateAddress: allowAddress,
    });
    if (res.ok) return { ok: true, status: res.status };
    if (res.status >= 300 && res.status < 400) return { ok: false, status: res.status, error: "blocked: destination responded with a redirect" };
    return { ok: false, status: res.status, error: `destination responded ${res.status}` };
  } catch (e) {
    if (e instanceof SsrfPinError) return { ok: false, error: `blocked: ${e.message}` };
    if (controller.signal.aborted) return { ok: false, error: `timed out after ${DELIVERY_TIMEOUT_MS / 1000}s` };
    return { ok: false, error: e instanceof Error ? e.message : "delivery failed" };
  } finally {
    clearTimeout(timer);
  }
}
