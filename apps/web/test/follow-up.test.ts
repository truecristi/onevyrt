import test from "node:test";
import assert from "node:assert/strict";
import { composeFollowUp, sendFollowUp } from "../lib/acquisition/follow-up";
import type { QualOutcome } from "../lib/studio/qualification-config";

const outcome: QualOutcome = {
  heading: "There's a strong path here",
  body: "Grab the playbook and we'll follow up.",
  ctaLabel: "Send me the playbook →",
  ctaHref: "https://example.com/playbook",
};

test("composeFollowUp builds a personalised email from the outcome", () => {
  const e = composeFollowUp("Agency Fit", outcome, "Sam");
  assert.ok(e);
  assert.equal(e!.subject, "There's a strong path here");
  assert.match(e!.text, /^Hi Sam,/);
  assert.match(e!.text, /Agency Fit/);
  assert.match(e!.text, /Grab the playbook/);
  // The CTA arrow is stripped and the real link included.
  assert.match(e!.text, /Send me the playbook: https:\/\/example\.com\/playbook/);
});

test("composeFollowUp falls back to a neutral greeting without a name", () => {
  const e = composeFollowUp("Agency Fit", outcome);
  assert.match(e!.text, /^Hi,/);
});

test("composeFollowUp returns null when there's no real resource link", () => {
  assert.equal(composeFollowUp("X", { ...outcome, ctaHref: "#playbook" }), null);
  assert.equal(composeFollowUp("X", { ...outcome, ctaHref: "" }), null);
  assert.equal(composeFollowUp("X", { ...outcome, ctaHref: undefined }), null);
});

test("sendFollowUp no-ops cleanly without an email or link", async () => {
  assert.deepEqual(await sendFollowUp({ funnelTitle: "X", outcome }), { sent: false, skipped: "no email" });
  assert.deepEqual(
    await sendFollowUp({ to: "a@b.com", funnelTitle: "X", outcome: { ...outcome, ctaHref: "#x" } }),
    { sent: false, skipped: "no resource link" },
  );
});

test("sendFollowUp with a real link doesn't throw when no mailer is configured", async () => {
  const r = await sendFollowUp({ to: "a@b.com", funnelTitle: "X", outcome, recipientName: "Sam" });
  // Without SMTP, the mailer reports not-sent (dev notice) rather than throwing.
  assert.equal(r.sent, false);
  assert.ok(typeof r.skipped === "string");
});
