/**
 * Meta Conversions API (Acquisition OS, brick 4). Builds the server-side
 * `QualifiedLead` (and friends) event payload — hashed PII, fbp/fbc, a dedup
 * event_id — and sends it to Meta's Graph API when a pixel id + access token
 * are configured. When they're not, it no-ops gracefully (like the mailer), so
 * the funnel works in dev and the wiring is provably correct without live
 * credentials. The payload builder is pure and unit-tested; only `sendCapiEvent`
 * touches the network.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Attribution } from "./attribution.ts";

/** Meta requires user identifiers lowercased, trimmed, then SHA-256 hex. */
export function hashPII(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
/** Phone numbers hash as digits only (Meta strips punctuation/spaces). */
export function hashPhone(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  return createHash("sha256").update(digits).digest("hex");
}

export type CapiEventName = "QualifiedLead" | "Lead" | "Schedule" | "Purchase";

export interface CapiUser { email?: string; phone?: string; fbp?: string; fbc?: string; clientIp?: string; userAgent?: string }

export interface CapiEvent {
  event_name: CapiEventName;
  event_time: number; // unix seconds
  event_id: string; // dedup with the browser pixel
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string>;
  custom_data?: Record<string, unknown>;
}

export function newEventId(): string { return randomUUID(); }

/** Compose the exact CAPI event object. `nowSec`/`eventId` are injectable for
 *  deterministic tests. */
export function buildCapiEvent(opts: {
  eventName: CapiEventName;
  user: CapiUser;
  attribution?: Attribution;
  eventSourceUrl?: string;
  customData?: Record<string, unknown>;
  eventId?: string;
  nowSec?: number;
}): CapiEvent {
  const user_data: Record<string, string> = {};
  if (opts.user.email) user_data.em = hashPII(opts.user.email);
  if (opts.user.phone) user_data.ph = hashPhone(opts.user.phone);
  const fbp = opts.user.fbp ?? opts.attribution?.fbp;
  const fbc = opts.user.fbc ?? opts.attribution?.fbc;
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  if (opts.user.clientIp) user_data.client_ip_address = opts.user.clientIp;
  if (opts.user.userAgent) user_data.client_user_agent = opts.user.userAgent;

  const custom: Record<string, unknown> = { ...(opts.customData ?? {}) };
  const a = opts.attribution;
  if (a?.utmCampaign) custom.utm_campaign = a.utmCampaign;
  if (a?.creativeId) custom.creative_id = a.creativeId;
  if (a?.adId) custom.ad_id = a.adId;
  if (a?.campaignId) custom.campaign_id = a.campaignId;

  return {
    event_name: opts.eventName,
    event_time: opts.nowSec ?? Math.floor(Date.now() / 1000),
    event_id: opts.eventId ?? newEventId(),
    action_source: "website",
    ...(opts.eventSourceUrl ? { event_source_url: opts.eventSourceUrl } : {}),
    user_data,
    ...(Object.keys(custom).length ? { custom_data: custom } : {}),
  };
}

export interface CapiSendResult { sent: boolean; skipped?: string; error?: string }

/** True when a pixel id + access token are present in the environment. */
export function metaCapiConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);
}

/** POST an event to Meta's Conversions API. No-ops (sent:false, skipped) when
 *  not configured, and never throws — a failed conversion send must not break
 *  the lead's confirmation. */
export async function sendCapiEvent(event: CapiEvent): Promise<CapiSendResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { sent: false, skipped: "META_PIXEL_ID / META_CAPI_TOKEN not set" };
  const version = process.env.META_API_VERSION || "v19.0";
  try {
    const body: Record<string, unknown> = { data: [event] };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const res = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { sent: false, error: `Meta CAPI ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
