/**
 * One-time-code verification for the Acquisition OS. A qualified lead proves
 * they own the email/phone they gave before they can book. Codes are hashed at
 * rest (never stored in plaintext), expire quickly, and cap the number of
 * guesses. Delivery is pluggable (see sendOtp): real email via the mailer, SMS
 * via Twilio when configured, and a dev fallback that surfaces the code so the
 * flow is exercisable without a provider.
 */
import { createHash, randomInt, randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { sendMail } from "../mailer";

export type OtpChannel = "email" | "sms";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
// How long a verification row is kept after it expires — long enough that
// support can still look up "did this OTP verify" for a recent booking
// dispute, short enough that a captured email/phone (the row's `destination`
// — GDPR-relevant PII, unlike the code itself which is hashed) doesn't
// outlive its purpose. Same retention-purge shape as pruneFunnelEvents
// (lib/acquisition/funnel-events.ts): no recovery bin, since a verified or
// expired one-time code has nothing left worth recovering.
export const OTP_RETENTION_DAYS = 7;

/** A 6-digit numeric code, zero-padded, from a CSPRNG. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
function hashCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}
function normalizeDest(channel: OtpChannel, dest: string): string {
  return channel === "email" ? dest.trim().toLowerCase() : dest.replace(/[^\d+]/g, "");
}

export interface StartResult {
  id: string;
  sent: boolean;
  /** delivery channel actually used */
  channel: OtpChannel;
  /** dev-only: the code, surfaced when no real provider delivered it, so the
   *  funnel is testable without SMTP/SMS. Never returned in production. */
  devCode?: string;
}

/** Whether SMS delivery is configured (Twilio). */
export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/** Deliver a code over the chosen channel. No-ops gracefully (sent:false) when
 *  the channel isn't configured, so dev + tests work. Never throws. */
export async function sendOtp(channel: OtpChannel, destination: string, code: string): Promise<boolean> {
  try {
    if (channel === "sms") {
      if (!smsConfigured()) return false;
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: destination, From: process.env.TWILIO_FROM_NUMBER!, Body: `Your verification code is ${code}` }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    }
    const r = await sendMail({ to: destination, subject: "Your verification code", text: `Your verification code is ${code}. It expires in 10 minutes.` });
    return r.sent;
  } catch {
    return false;
  }
}

/** Start a verification: mint a code, store its hash, and send it. Returns the
 *  verification id the client checks against. */
export async function startVerification(input: { funnelSlug: string; channel: OtpChannel; destination: string }): Promise<StartResult> {
  const id = randomUUID();
  const code = generateCode();
  const dest = normalizeDest(input.channel, input.destination);
  const expires = new Date(Date.now() + OTP_TTL_MS);
  await pgPool().query(
    "INSERT INTO otp_verifications (id, funnel_slug, channel, destination, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, input.funnelSlug, input.channel, dest, hashCode(code), expires.toISOString()],
  );
  const sent = await sendOtp(input.channel, dest, code);
  // Only reveal the code when nothing actually delivered it AND we're not in
  // production — so dev/testing can complete the flow.
  const devCode = !sent && process.env.NODE_ENV !== "production" ? code : undefined;
  return { id, sent, channel: input.channel, devCode };
}

export interface CheckResult { ok: boolean; reason?: "not_found" | "expired" | "too_many_attempts" | "incorrect" }

/** Check a submitted code against a verification. Enforces expiry + attempt cap
 *  and marks the row verified on success (idempotent thereafter). */
export async function checkVerification(id: string, code: string): Promise<CheckResult> {
  // Atomically consume one attempt, gated on the cap in the same statement, so
  // parallel guesses can't all slip past a stale `attempts` read and brute the
  // code. The row comes back ONLY if it's still live (unverified, unexpired) and
  // under the cap; that consumed-attempt read then decides correctness.
  const r = await pgPool().query<{ code_hash: string }>(
    `UPDATE otp_verifications
       SET attempts = attempts + 1
       WHERE id = $1 AND verified_at IS NULL AND attempts < $2 AND expires_at > now()
       RETURNING code_hash`,
    [id, OTP_MAX_ATTEMPTS],
  );
  if (!r.rows[0]) {
    // No attempt consumed — figure out why for an honest error (no security weight).
    const s = await pgPool().query<{ expires_at: string; verified_at: string | null }>(
      "SELECT expires_at, verified_at FROM otp_verifications WHERE id = $1", [id],
    );
    const row = s.rows[0];
    if (!row) return { ok: false, reason: "not_found" };
    if (row.verified_at) return { ok: true };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
    return { ok: false, reason: "too_many_attempts" };
  }
  if (r.rows[0].code_hash !== hashCode(code)) return { ok: false, reason: "incorrect" };
  await pgPool().query("UPDATE otp_verifications SET verified_at = now() WHERE id = $1 AND verified_at IS NULL", [id]);
  return { ok: true };
}

/** Is this verification id verified, and (if given) for this destination? Used
 *  server-side before a booking so an unverified/mismatched id is rejected. */
export async function isVerified(id: string, channel?: OtpChannel, destination?: string): Promise<boolean> {
  const r = await pgPool().query<{ channel: string; destination: string; verified_at: string | null }>(
    "SELECT channel, destination, verified_at FROM otp_verifications WHERE id = $1", [id],
  );
  const row = r.rows[0];
  if (!row || !row.verified_at) return false;
  if (destination && channel) return row.destination === normalizeDest(channel, destination);
  return true;
}

/** Hard-delete verification rows past OTP_RETENTION_DAYS since they expired —
 *  the daily job (see lib/jobs.ts) that gives the `destination` PII an actual
 *  retention window instead of keeping every OTP request forever. Guarded on
 *  expires_at, not created_at, so a verified-just-before-expiry row is kept
 *  for the same window as one that was never verified at all. Returns how
 *  many rows were purged. */
export async function purgeExpiredOtpVerifications(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - OTP_RETENTION_DAYS * 86400_000).toISOString();
  const r = await pgPool().query("DELETE FROM otp_verifications WHERE expires_at < $1", [cutoff]);
  return r.rowCount ?? 0;
}
