/**
 * Plain SMS send over Twilio, reusing the same config the OTP flow uses. Mirrors
 * the mailer's contract: never throws, returns {sent, reason}, and when Twilio
 * isn't configured it logs a "would send" line instead of pretending to deliver.
 */
export interface SmsResult { sent: boolean; reason?: string }

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsConfigured()) {
    // Never log the body: this same path carries live OTP codes (see the OTP
    // flow this file's header references), and this fallback is the real
    // production behavior whenever Twilio isn't configured yet, not a
    // test-only stub — a code that lands in durable server logs is as good
    // as leaked.
    console.log(`[sms] No provider configured — would send SMS:\n  to: ${to}\n  (body withheld — configure TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER to actually deliver)`);
    return { sent: false, reason: "No SMS provider configured (set TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER to send for real)." };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { sent: false, reason: `Twilio returned ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Network error sending SMS." };
  }
}
