/**
 * Integration framework, second half: OUTBOUND webhooks. A workspace
 * registers a URL and the event types it wants; OneVYRT POSTs to that URL
 * when they happen, signed the same way Stripe signs its own webhooks
 * (see lib/stripe-webhook.ts) so the receiving end can verify authenticity
 * with the shared secret. Delivery is always best-effort — a slow or dead
 * receiving URL must never block or fail the user's own action (saving a
 * project, deleting one), so dispatch never throws and every fetch carries
 * a hard timeout.
 */
import { randomBytes, createHmac } from "node:crypto";
import { pgPool } from "./db";
import { isPublicAddress } from "./url-safety";
import { pinnedFetch, SsrfPinError } from "./safe-fetch";

export const WEBHOOK_EVENT_TYPES = [
  "project.created",
  "project.deleted",
  "workspace.member_added",
  "workspace.member_removed",
  "subscription.updated",
  "subscription.cancelled",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookSummary {
  id: string;
  url: string;
  events: WebhookEventType[];
  createdAt: string;
  lastDeliveryAt?: string;
  lastStatus?: number;
  lastError?: string;
  disabled?: boolean;
}

/** One recorded delivery attempt, newest-first for the delivery-log UI. */
export interface WebhookDelivery {
  id: string;
  event: WebhookEventType;
  status?: number;   // HTTP status; absent when the request never completed
  ok: boolean;       // 2xx/3xx and no transport error
  error?: string;
  at: string;        // ISO timestamp
}

/** How many delivery rows we keep per webhook. Enough to see a pattern
 *  ("failing all day" vs "one blip") without letting history grow unbounded. */
export const DELIVERY_HISTORY_CAP = 50;

function rowToSummary(r: { id: string; url: string; events: string[]; created_at: Date; last_delivery_at: Date | null; last_status: number | null; last_error: string | null; disabled_at: Date | null }): WebhookSummary {
  return {
    id: r.id, url: r.url, events: r.events as WebhookEventType[], createdAt: r.created_at.toISOString(),
    ...(r.last_delivery_at ? { lastDeliveryAt: r.last_delivery_at.toISOString() } : {}),
    ...(r.last_status != null ? { lastStatus: r.last_status } : {}),
    ...(r.last_error ? { lastError: r.last_error } : {}),
    ...(r.disabled_at ? { disabled: true } : {}),
  };
}

export async function createWebhook(workspaceId: string, url: string, events: WebhookEventType[]): Promise<WebhookSummary & { secret: string }> {
  const id = `wh_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(24).toString("hex");
  const createdAt = new Date().toISOString();
  const validEvents = events.filter((e) => (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
  await pgPool().query(
    "INSERT INTO outbound_webhooks (id, workspace_id, url, secret, events, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, workspaceId, url, secret, validEvents, createdAt],
  );
  return { id, url, events: validEvents, createdAt, secret };
}

export async function listWebhooks(workspaceId: string): Promise<WebhookSummary[]> {
  const res = await pgPool().query(
    "SELECT id, url, events, created_at, last_delivery_at, last_status, last_error, disabled_at FROM outbound_webhooks WHERE workspace_id = $1 ORDER BY created_at DESC",
    [workspaceId],
  );
  return res.rows.map(rowToSummary);
}

export async function deleteWebhook(workspaceId: string, id: string): Promise<void> {
  await pgPool().query("DELETE FROM outbound_webhooks WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  // Best-effort history cleanup; scoped to the workspace so a stray id can't
  // touch another workspace's rows. Never blocks the delete itself.
  await pgPool().query("DELETE FROM webhook_deliveries WHERE webhook_id = $1 AND workspace_id = $2", [id, workspaceId]).catch(() => {});
}

/** Recent delivery attempts for one webhook, newest first. Scoped to the
 *  workspace so callers can't read another workspace's log by guessing an id. */
export async function listDeliveries(workspaceId: string, webhookId: string, limit = DELIVERY_HISTORY_CAP): Promise<WebhookDelivery[]> {
  const cap = Math.max(1, Math.min(limit, DELIVERY_HISTORY_CAP));
  const res = await pgPool().query<{ id: string; event: string; status: number | null; ok: boolean; error: string | null; created_at: Date }>(
    "SELECT id, event, status, ok, error, created_at FROM webhook_deliveries WHERE webhook_id = $1 AND workspace_id = $2 ORDER BY id DESC LIMIT $3",
    [webhookId, workspaceId, cap],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    event: r.event as WebhookEventType,
    ...(r.status != null ? { status: r.status } : {}),
    ok: r.ok,
    ...(r.error ? { error: r.error } : {}),
    at: r.created_at.toISOString(),
  }));
}

/** Signs a payload the same way lib/stripe-webhook.ts verifies one: HMAC-SHA256
 *  over `${timestamp}.${rawBody}`, header `t=<ts>,v1=<hex>` — a receiver can
 *  reuse verifyStripeSignature's exact algorithm to check it. */
function signPayload(secret: string, rawBody: string, timestamp: number): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

const DELIVERY_TIMEOUT_MS = 5000;

/** Fires `eventType` to every enabled, subscribed webhook in the workspace.
 *  Never throws — a dead or slow receiving URL must never fail the caller's
 *  own action. Delivery status is recorded on the row for the UI to show,
 *  not returned to the caller (nobody's waiting on it). */
/** Which resolved IPs a delivery may connect to. Injectable so tests can deliver
 *  to a loopback mock receiver; production always uses isPublicAddress, which
 *  blocks loopback/private/link-local. Passed straight into pinnedFetch's pin so
 *  the address we validate IS the socket we open. */
type AddressValidator = (address: string, family: number) => boolean;

export async function dispatchEvent(
  workspaceId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  allowAddress: AddressValidator = isPublicAddress,
): Promise<void> {
  const pool = pgPool();
  let rows: { id: string; url: string; secret: string }[];
  try {
    const res = await pool.query<{ id: string; url: string; secret: string }>(
      "SELECT id, url, secret FROM outbound_webhooks WHERE workspace_id = $1 AND disabled_at IS NULL AND $2 = ANY(events)",
      [workspaceId, eventType],
    );
    rows = res.rows;
  } catch { return; }
  if (rows.length === 0) return;

  const rawBody = JSON.stringify({ type: eventType, workspaceId, data, sentAt: new Date().toISOString() });
  await Promise.all(rows.map(async (row) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let status: number | null = null;
    let error: string | null = null;
    try {
      // SSRF: the URL was validated at registration, but DNS can be re-pointed
      // at an internal address afterwards (rebinding). A plain fetch re-resolves
      // when it connects, so a low-TTL name can answer "public" to any pre-check
      // and "127.0.0.1 / 169.254.169.254" to the connect. pinnedFetch closes
      // that: it resolves ONCE, validates the address, and hands the socket
      // exactly that IP — the address we checked is the address we connect to.
      // It also never follows redirects, so a receiver can't 3xx-bounce us to a
      // private host; a 3xx is recorded as a non-delivery.
      const r = await pinnedFetch(row.url, {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(rawBody)), "x-onevyrt-signature": signPayload(row.secret, rawBody, timestamp) },
        body: rawBody,
        signal: controller.signal,
        validateAddress: allowAddress,
      });
      status = r.status;
      if (r.status >= 300 && r.status < 400) error = "blocked: destination responded with a redirect";
    } catch (e) {
      // A pin rejection (resolves to a private/internal address) is a security
      // block, not a transport hiccup — label it as such for the delivery log.
      if (e instanceof SsrfPinError) error = `blocked: ${e.message}`;
      else error = e instanceof Error ? e.message : "delivery failed";
    } finally {
      clearTimeout(timer);
    }
    const at = new Date().toISOString();
    const ok = error === null && status != null && status < 400;
    try {
      await pool.query(
        "UPDATE outbound_webhooks SET last_delivery_at = $1, last_status = $2, last_error = $3 WHERE id = $4",
        [at, status, error, row.id],
      );
      // Append to the delivery log, then trim it back to the cap so history
      // stays bounded no matter how chatty the events are. Best-effort: a
      // logging failure must never surface to the user's own action.
      await pool.query(
        "INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, status, ok, error, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [row.id, workspaceId, eventType, status, ok, error, at],
      );
      await pool.query(
        "DELETE FROM webhook_deliveries WHERE webhook_id = $1 AND id NOT IN (SELECT id FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY id DESC LIMIT $2)",
        [row.id, DELIVERY_HISTORY_CAP],
      );
    } catch { /* best-effort bookkeeping only */ }
  }));
}
