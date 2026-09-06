/**
 * Broadcasts — send a composed message to the contacts a segment resolves to.
 * Resolves the audience (via the segment store), drops anyone missing the
 * channel address or on the opt-out list, renders per-contact merge fields, and
 * sends via the mailer / SMS sender (both of which honestly report "no provider"
 * in dev instead of faking delivery). Every recipient's result is logged so the
 * owner sees exactly what went out. Capped per send as an abuse/timeout guard.
 */
import { randomUUID, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { pgPool, withAdvisoryLock } from "../db";
import { listContacts } from "../segments/store";
import { sendMail } from "../mailer";
import { sendSms } from "./sms";
import { renderTemplate } from "./render";
import { recordLeadEventForMany } from "../acquisition/leads";
import { readSettings } from "../settings";
import { SITE_ORIGIN } from "../site";
import type { Group } from "../segments/rules";

export type Channel = "email" | "sms";
const MAX_RECIPIENTS = 500;

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";
export interface Broadcast {
  id: string; name: string; channel: Channel; subject: string | null; body: string;
  rules: Group; segmentId: string | null; status: BroadcastStatus;
  recipientCount: number; sentCount: number; failedCount: number;
  createdAt: string; sentAt: string | null; scheduledAt: string | null;
}
export interface BroadcastSend { address: string; status: "sent" | "failed" | "skipped"; reason: string | null }

function rowToBroadcast(r: Record<string, unknown>): Broadcast {
  return {
    id: r.id as string, name: r.name as string, channel: r.channel as Channel,
    subject: (r.subject as string) ?? null, body: r.body as string, rules: r.rules as Group,
    segmentId: (r.segment_id as string) ?? null, status: r.status as BroadcastStatus,
    recipientCount: Number(r.recipient_count) || 0, sentCount: Number(r.sent_count) || 0, failedCount: Number(r.failed_count) || 0,
    createdAt: new Date(r.created_at as string).toISOString(),
    sentAt: r.sent_at ? new Date(r.sent_at as string).toISOString() : null,
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at as string).toISOString() : null,
  };
}

export interface SendBroadcastInput { name: string; channel: Channel; subject?: string; body: string; rules: Group; segmentId?: string }

/** Send a single test message to one address (the sender themselves) so they
 *  can eyeball the real thing before blasting a segment — part of the mandatory
 *  pre-send review (§ campaigns). Renders merge fields against the test
 *  address, sends nothing to the segment, and records no broadcast row.
 *  Reports the provider's honest result ("no provider" in dev). */
export async function sendTestBroadcast(input: { channel: Channel; subject?: string; body: string }, to: string): Promise<{ sent: boolean; reason: string | null }> {
  const addr = (to || "").trim();
  if (!addr) return { sent: false, reason: "no test address" };
  if (!input.body || !input.body.trim()) return { sent: false, reason: "the message body can't be empty" };
  const sample = { name: null, email: input.channel === "email" ? addr : null, phone: input.channel === "sms" ? addr : null };
  const body = renderTemplate(input.body, sample);
  if (input.channel === "email") {
    if (!(input.subject || "").trim()) return { sent: false, reason: "an email needs a subject" };
    const r = await sendMail({ to: addr, subject: `[Test] ${renderTemplate(input.subject || "", sample)}`, text: body });
    return { sent: r.sent, reason: r.reason ?? null };
  }
  const r = await sendSms(addr, body);
  return { sent: r.sent, reason: r.reason ?? null };
}

/** Validate a composed message the same way for both immediate and scheduled
 *  sends, and normalise the name. Throws with a user-facing reason. */
function validated(input: SendBroadcastInput): { name: string } {
  const name = (input.name || "").trim() || "Untitled broadcast";
  if (input.channel !== "email" && input.channel !== "sms") throw new Error("channel must be 'email' or 'sms'");
  if (!input.body || !input.body.trim()) throw new Error("the message body can't be empty");
  if (input.channel === "email" && !(input.subject || "").trim()) throw new Error("an email needs a subject");
  return { name };
}

/** Resolve a rules tree to the contacts actually reachable on this channel,
 *  minus opt-outs, capped. Shared by immediate send, scheduled dispatch and
 *  the reachable-count preview so all three see the same audience. */
async function resolveRecipients(workspaceId: string, rules: Group, channel: Channel): Promise<{ c: Awaited<ReturnType<typeof listContacts>>[number]; addr: string }[]> {
  const contacts = await listContacts(workspaceId, rules, MAX_RECIPIENTS * 3);
  const optedOut = await optOutSet(workspaceId, channel);
  return contacts
    .map((c) => ({ c, addr: channel === "email" ? (c.email || "") : (c.phone || "") }))
    .filter((r) => r.addr && !optedOut.has(r.addr.toLowerCase()))
    .slice(0, MAX_RECIPIENTS);
}

/** Deliver to an already-resolved recipient list, logging one broadcast_sends
 *  row each, then mark the broadcast sent with its tallies. The broadcast row
 *  must already exist in 'sending'. Returns the completed broadcast. */
type Recipient = Awaited<ReturnType<typeof resolveRecipients>>[number];
// While delivering, refresh the heartbeat every this-many recipients so a
// genuinely slow-but-live send is never mistaken for stranded (see
// reclaimStrandedBroadcasts). Small enough that even a slow provider keeps the
// heartbeat well inside STRANDED_MS.
const HEARTBEAT_EVERY = 25;

async function deliver(id: string, workspaceId: string, input: SendBroadcastInput, recipients: Recipient[]): Promise<Broadcast> {
  // Fail-safe suppression at the moment of delivery. resolveRecipients already
  // dropped opt-outs when the audience was built, but a send loops over up to
  // MAX_RECIPIENTS network calls and can outlast someone opting out mid-flight
  // (e.g. clicking unsubscribe on an earlier recipient's copy). Re-checking here
  // means a just-unsubscribed contact is never messaged: they're logged
  // 'skipped' (counted as neither sent nor failed — see tallyFromSends).
  const suppressed = await optOutSet(workspaceId, input.channel);
  // Marketing email carries a one-click unsubscribe link; resolve the origin
  // once (the admin-set public origin, else the canonical site origin).
  const origin = input.channel === "email" ? await unsubscribeOrigin() : "";
  let sent = 0, failed = 0;
  let done = 0;
  for (const { c, addr } of recipients) {
    if (suppressed.has(addr.toLowerCase())) {
      await pgPool().query(
        "INSERT INTO broadcast_sends (id, broadcast_id, workspace_id, address, status, reason) VALUES ($1,$2,$3,$4,'skipped',$5)",
        [randomUUID(), id, workspaceId, addr, "opted out"],
      );
      continue;
    }
    const body = renderTemplate(input.body, c);
    let ok: boolean, reason: string | undefined;
    if (input.channel === "email") {
      const subject = renderTemplate(input.subject || "", c);
      const unsubscribeUrl = `${origin}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken(workspaceId, "email", addr))}`;
      const r = await sendMail({ to: addr, subject, text: body, unsubscribeUrl });
      ok = r.sent; reason = r.reason;
    } else {
      const r = await sendSms(addr, body);
      ok = r.sent; reason = r.reason;
    }
    if (ok) sent++; else failed++;
    await pgPool().query(
      "INSERT INTO broadcast_sends (id, broadcast_id, workspace_id, address, status, reason) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), id, workspaceId, addr, ok ? "sent" : "failed", reason ?? null],
    );
    if (++done % HEARTBEAT_EVERY === 0) {
      await pgPool().query("UPDATE broadcasts SET updated_at = now() WHERE id = $1", [id]).catch(() => {});
    }
  }
  // Log the contact on each recipient's activity timeline, so a lead's drawer
  // shows the campaigns it was part of (links the campaign side to the lead).
  await recordLeadEventForMany(workspaceId, recipients.map((rec) => rec.c.id), "contacted", { to: input.name });
  const r = await pgPool().query(
    `UPDATE broadcasts SET status = 'sent', sent_count = $2, failed_count = $3, recipient_count = $4, sent_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, sent, failed, recipients.length],
  );
  return rowToBroadcast(r.rows[0]);
}

/** Pure: tally delivered vs failed from the per-recipient send rows. 'skipped'
 *  counts as neither, matching how deliver() splits ok vs fail. Exported for
 *  testing and used to finalise a stranded broadcast from what actually went
 *  out, without re-sending. */
export function tallyFromSends(sends: { status: string }[]): { sent: number; failed: number } {
  let sent = 0, failed = 0;
  for (const s of sends) { if (s.status === "sent") sent += 1; else if (s.status === "failed") failed += 1; }
  return { sent, failed };
}

// A send loops over up to MAX_RECIPIENTS with network calls; 30 minutes is far
// past any real send's runtime, so anything still 'sending' after that is
// stranded (the process died mid-send), not merely slow.
const STRANDED_MS = 30 * 60 * 1000;

/**
 * Finalise broadcasts stuck in 'sending' — the process died between claiming a
 * broadcast and marking it 'sent', so the due-scan (which only sees
 * 'scheduled') would never touch it again. Each is finalised from the
 * broadcast_sends rows already written, NOT re-delivered, so recipients who
 * already got it are never messaged twice. The gated UPDATE (still 'sending',
 * still past the cutoff) makes two overlapping ticks safe — only one wins.
 * Never throws. Returns how many were reclaimed.
 */
export async function reclaimStrandedBroadcasts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STRANDED_MS).toISOString();
  const stuck = await pgPool().query<{ id: string }>(
    "SELECT id FROM broadcasts WHERE status = 'sending' AND updated_at < $1 LIMIT 100",
    [cutoff],
  );
  let reclaimed = 0;
  for (const { id } of stuck.rows) {
    try {
      const sends = await pgPool().query<{ status: string }>("SELECT status FROM broadcast_sends WHERE broadcast_id = $1", [id]);
      const { sent, failed } = tallyFromSends(sends.rows);
      const r = await pgPool().query(
        `UPDATE broadcasts SET status = 'sent', sent_count = $2, failed_count = $3, sent_at = COALESCE(sent_at, now()), updated_at = now()
         WHERE id = $1 AND status = 'sending' AND updated_at < $4 RETURNING id`,
        [id, sent, failed, cutoff],
      );
      if ((r.rowCount ?? 0) > 0) reclaimed += 1;
    } catch { /* isolate: one bad row must not stop the rest */ }
  }
  return reclaimed;
}

/** Stable content fingerprint for the double-send guard: identical immediate
 *  sends hash to the same advisory-lock key so they serialize; unrelated sends
 *  get a different key and never contend. */
function sendFingerprint(workspaceId: string, input: SendBroadcastInput): string {
  return createHash("sha256")
    .update(JSON.stringify([workspaceId, input.channel, (input.subject ?? "").slice(0, 200), input.body.slice(0, 5000), input.rules]))
    .digest("hex");
}

/** Compose + send in one call. Returns the completed broadcast with tallies. */
export async function sendBroadcast(workspaceId: string, input: SendBroadcastInput): Promise<Broadcast> {
  const { name } = validated(input);
  const recipients = await resolveRecipients(workspaceId, input.rules, input.channel);
  // Guard an immediate send against a double-submit (a double-click, or a client
  // retrying a slow inline send) firing the SAME broadcast twice to up to
  // MAX_RECIPIENTS people. The scheduled path is safe because its one durable
  // row is claimed atomically (scheduled → sending); an immediate send has no
  // pre-existing row, so we serialize identical concurrent sends on a content-
  // keyed advisory lock — the same cross-instance primitive the rest of the app
  // uses for read-modify-write — and, inside it, reuse any twin still in flight
  // ('sending') or just completed (recently 'sent') instead of inserting a
  // second one. Fail safe: on a duplicate we deliver nothing more and return the
  // existing broadcast. The INSERT runs on the locked client, so it is part of
  // the lock's transaction and visible to the next caller the instant the lock
  // is released.
  const claim = await withAdvisoryLock(`broadcast-send:${sendFingerprint(workspaceId, input)}`, async (client): Promise<{ broadcast: Broadcast } | { id: string }> => {
    const dup = await client.query(
      `SELECT * FROM broadcasts
        WHERE workspace_id = $1 AND channel = $2
          AND coalesce(subject, '') = coalesce($3, '')
          AND body = $4 AND rules = $5::jsonb
          AND (status = 'sending' OR (status = 'sent' AND created_at > now() - interval '2 minutes'))
        ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, input.channel, (input.subject ?? "").slice(0, 200) || null, input.body.slice(0, 5000), JSON.stringify(input.rules)],
    );
    if (dup.rows[0]) return { broadcast: rowToBroadcast(dup.rows[0]) };
    const id = randomUUID();
    await client.query(
      `INSERT INTO broadcasts (id, workspace_id, name, channel, subject, body, rules, segment_id, status, recipient_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sending',$9)`,
      [id, workspaceId, name.slice(0, 120), input.channel, (input.subject ?? "").slice(0, 200) || null,
        input.body.slice(0, 5000), JSON.stringify(input.rules), input.segmentId ?? null, recipients.length],
    );
    return { id };
  });
  // A twin already handled this send — deliver nothing more.
  if ("broadcast" in claim) return claim.broadcast;
  return deliver(claim.id, workspaceId, input, recipients);
}

/** Queue a broadcast to send at a future time. Nothing goes out now — the row
 *  is stored 'scheduled' and dispatchDueBroadcasts (via the cron tick) sends it
 *  once scheduledAt passes. recipient_count is the estimate at scheduling time;
 *  the real audience is re-resolved at send time in case contacts changed. */
export async function scheduleBroadcast(workspaceId: string, input: SendBroadcastInput, scheduledAt: Date): Promise<Broadcast> {
  const { name } = validated(input);
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) throw new Error("a valid send time is required");
  if (scheduledAt.getTime() <= Date.now()) throw new Error("the scheduled time must be in the future");
  const estimate = await reachableCount(workspaceId, input.rules, input.channel);
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO broadcasts (id, workspace_id, name, channel, subject, body, rules, segment_id, status, recipient_count, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10) RETURNING *`,
    [id, workspaceId, name.slice(0, 120), input.channel, (input.subject ?? "").slice(0, 200) || null,
      input.body.slice(0, 5000), JSON.stringify(input.rules), input.segmentId ?? null, estimate, scheduledAt.toISOString()],
  );
  return rowToBroadcast(r.rows[0]);
}

/** Call off a scheduled broadcast before it fires. Only a 'scheduled' one can
 *  be cancelled (a sending/sent one has already gone out). Returns whether a
 *  row was cancelled. */
export async function cancelBroadcast(workspaceId: string, id: string): Promise<boolean> {
  const r = await pgPool().query(
    "UPDATE broadcasts SET status = 'cancelled' WHERE id = $1 AND workspace_id = $2 AND status = 'scheduled' RETURNING id",
    [id, workspaceId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Dispatch every scheduled broadcast whose time has passed. Called from the
 * jobs engine on each cron tick. Each broadcast is CLAIMED atomically
 * (scheduled → sending in one UPDATE) so two overlapping ticks can never send
 * the same one twice — only the tick that wins the flip delivers it. The
 * audience is re-resolved fresh at this moment, not snapshotted at scheduling
 * time. Never throws: one broadcast's failure is isolated so the rest still go.
 * Returns how many were dispatched.
 */
export async function dispatchDueBroadcasts(now: Date = new Date()): Promise<number> {
  // First, rescue anything a previous tick left stranded mid-send (crash /
  // container reclaim) — finalised from its send log, never re-delivered.
  await reclaimStrandedBroadcasts(now).catch(() => 0);

  const due = await pgPool().query<{ id: string }>(
    "SELECT id FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= $1 ORDER BY scheduled_at ASC LIMIT 100",
    [now.toISOString()],
  );
  let dispatched = 0;
  for (const { id } of due.rows) {
    try {
      const claim = await pgPool().query(
        "UPDATE broadcasts SET status = 'sending', updated_at = now() WHERE id = $1 AND status = 'scheduled' RETURNING *",
        [id],
      );
      if (claim.rowCount === 0) continue; // another tick already claimed it
      const b = claim.rows[0] as Record<string, unknown>;
      const input: SendBroadcastInput = {
        name: b.name as string, channel: b.channel as Channel,
        subject: (b.subject as string) ?? undefined, body: b.body as string,
        rules: b.rules as Group, segmentId: (b.segment_id as string) ?? undefined,
      };
      const recipients = await resolveRecipients(b.workspace_id as string, input.rules, input.channel);
      await deliver(id, b.workspace_id as string, input, recipients);
      dispatched++;
    } catch { /* isolate: a bad broadcast must not stop the others */ }
  }
  return dispatched;
}

async function optOutSet(workspaceId: string, channel: Channel): Promise<Set<string>> {
  const r = await pgPool().query("SELECT address FROM contact_optouts WHERE workspace_id = $1 AND channel = $2", [workspaceId, channel]);
  return new Set(r.rows.map((row) => String(row.address).toLowerCase()));
}

/** Estimate reachable recipients for a channel before sending. */
export async function reachableCount(workspaceId: string, rules: Group, channel: Channel): Promise<number> {
  return (await reachBreakdown(workspaceId, rules, channel)).reachable;
}

/** Break an audience down into who will actually be messaged and why the rest
 *  won't be — so the composer/review can show reachable vs excluded honestly
 *  before anything sends (§ campaigns):
 *   - reachable: has a channel address and isn't suppressed
 *   - optedOut: has an address but is on the channel's opt-out list
 *   - missingChannel: matches the audience but has no email/phone for this channel
 */
export async function reachBreakdown(workspaceId: string, rules: Group, channel: Channel): Promise<{ total: number; reachable: number; optedOut: number; missingChannel: number }> {
  const contacts = await listContacts(workspaceId, rules, MAX_RECIPIENTS * 3);
  const optedOut = await optOutSet(workspaceId, channel);
  let reachable = 0, opted = 0, missing = 0;
  for (const c of contacts) {
    const addr = channel === "email" ? (c.email || "") : (c.phone || "");
    if (!addr) { missing++; continue; }
    if (optedOut.has(addr.toLowerCase())) { opted++; continue; }
    reachable++;
  }
  return { total: contacts.length, reachable, optedOut: opted, missingChannel: missing };
}

export async function listBroadcasts(workspaceId: string): Promise<Broadcast[]> {
  const r = await pgPool().query("SELECT * FROM broadcasts WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  return r.rows.map(rowToBroadcast);
}

export async function getBroadcast(workspaceId: string, id: string): Promise<{ broadcast: Broadcast; sends: BroadcastSend[] } | null> {
  const b = await pgPool().query("SELECT * FROM broadcasts WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  if (!b.rows[0]) return null;
  const s = await pgPool().query("SELECT address, status, reason FROM broadcast_sends WHERE broadcast_id = $1 ORDER BY created_at ASC LIMIT 1000", [id]);
  return {
    broadcast: rowToBroadcast(b.rows[0]),
    sends: s.rows.map((row) => ({ address: row.address as string, status: row.status as BroadcastSend["status"], reason: (row.reason as string) ?? null })),
  };
}

/** Add an opt-out so a contact is skipped in future sends on that channel. */
export async function addOptOut(workspaceId: string, channel: Channel, address: string): Promise<void> {
  await pgPool().query(
    "INSERT INTO contact_optouts (workspace_id, channel, address) VALUES ($1,$2,lower($3)) ON CONFLICT DO NOTHING",
    [workspaceId, channel, address],
  );
}

// ---- Unsubscribe links -----------------------------------------------------
// A marketing email carries a working one-click unsubscribe link (required by
// CAN-SPAM, and by Gmail/Yahoo bulk-sender rules via the RFC 8058 one-click
// List-Unsubscribe header). The link's token encodes (workspace, channel,
// address) and is HMAC-signed so it can't be forged or re-pointed at another
// recipient. It is stateless — no per-send row to store, and an old email's
// link keeps working indefinitely, which the law requires.

/** The origin unsubscribe links point at: the admin-configured public origin
 *  if set, else the canonical site origin. Never throws (a send must not fail
 *  because settings couldn't be read). */
async function unsubscribeOrigin(): Promise<string> {
  try {
    const s = await readSettings();
    if (s.publicOrigin) return s.publicOrigin;
  } catch { /* fall back to the canonical origin below */ }
  return SITE_ORIGIN;
}

/** Signing key for unsubscribe tokens. Prefers a dedicated secret, then the AI
 *  encryption key, then DATABASE_URL — all stable per-install and secret — so a
 *  working link needs no new env var. Derivation mirrors lib/crypto-box.ts
 *  (SHA-256 of the secret → a fixed 32-byte key). */
function unsubscribeKey(): Buffer {
  const raw = process.env.UNSUBSCRIBE_SECRET || process.env.AI_ENCRYPTION_KEY || process.env.DATABASE_URL || "onevyrt-dev-unsubscribe-secret";
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Mint a signed, self-contained unsubscribe token for one recipient. */
export function unsubscribeToken(workspaceId: string, channel: Channel, address: string): string {
  const payload = Buffer.from(JSON.stringify({ w: workspaceId, c: channel, a: address }), "utf8").toString("base64url");
  const sig = createHmac("sha256", unsubscribeKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify an unsubscribe token and recover (workspace, channel, address).
 *  Returns null for anything malformed, tampered, or wrongly signed — the
 *  public route treats null as "not a valid link" and does nothing. */
export function verifyUnsubscribeToken(token: unknown): { workspaceId: string; channel: Channel; address: string } | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", unsubscribeKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  // Unequal lengths can't be compared in constant time — and mean a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { w?: unknown; c?: unknown; a?: unknown };
    const channel: Channel | null = obj.c === "sms" ? "sms" : obj.c === "email" ? "email" : null;
    const workspaceId = typeof obj.w === "string" && obj.w ? obj.w : null;
    const address = typeof obj.a === "string" && obj.a ? obj.a : null;
    if (!channel || !workspaceId || !address) return null;
    return { workspaceId, channel, address };
  } catch {
    return null;
  }
}
