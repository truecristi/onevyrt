import test from "node:test";
import assert from "node:assert/strict";
import { sendMail } from "../lib/mailer";

// SMTP/Resend both make real network calls, so only the no-provider fallback
// is safe to exercise here — the point is confirming it stays loud (logs,
// returns sent:false with a reason) rather than silently swallowing the mail.
test("sendMail: with no provider configured, logs instead of pretending to send", async () => {
  const prevMail = process.env.MAIL_ENABLED;
  const prevHost = process.env.SMTP_HOST;
  const prevResend = process.env.RESEND_API_KEY;
  delete process.env.MAIL_ENABLED;
  delete process.env.SMTP_HOST;
  delete process.env.RESEND_API_KEY;

  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: string) => { logs.push(msg); };
  try {
    const result = await sendMail({ to: "someone@example.com", subject: "hi", text: "body" });
    assert.equal(result.sent, false);
    assert.match(result.reason ?? "", /no email provider configured/i);
    assert.ok(logs.some((l) => l.includes("someone@example.com")), "should log the would-be recipient");
  } finally {
    console.log = origLog;
    if (prevMail !== undefined) process.env.MAIL_ENABLED = prevMail;
    if (prevHost !== undefined) process.env.SMTP_HOST = prevHost;
    if (prevResend !== undefined) process.env.RESEND_API_KEY = prevResend;
  }
});
