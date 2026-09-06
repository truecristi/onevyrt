import test from "node:test";
import assert from "node:assert/strict";
import { sendBulkNotifications, type BulkRecipient, type RenderedMessage } from "../lib/notifications/bulk-sender";

interface Payload { name: string; fail?: boolean }

function template(data: Payload): RenderedMessage | null {
  if (data.name === "skip-me") return null;
  return { subject: `Hi ${data.name}`, text: `Body for ${data.name}` };
}

test("sendBulkNotifications: sends to every recipient with data, tallies sent", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "a@example.com" }, { id: "b", to: "b@example.com" }];
  const data = new Map<string, Payload>([["a", { name: "Alice" }], ["b", { name: "Bob" }]]);
  const sent: string[] = [];
  const summary = await sendBulkNotifications(recipients, template, data, {
    send: async (msg) => { sent.push(msg.to); return { sent: true }; },
  });
  assert.equal(summary.sent, 2);
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 0);
  assert.deepEqual(sent.sort(), ["a@example.com", "b@example.com"]);
});

test("sendBulkNotifications: a recipient with no data is skipped, not failed", async () => {
  const recipients: BulkRecipient[] = [{ id: "missing", to: "x@example.com" }];
  const summary = await sendBulkNotifications(recipients, template, new Map(), {
    send: async () => ({ sent: true }),
  });
  assert.equal(summary.skipped, 1);
  assert.equal(summary.sent, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.results[0]!.status, "skipped");
});

test("sendBulkNotifications: a template returning null skips that recipient (no empty sends)", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "a@example.com" }];
  const data = new Map<string, Payload>([["a", { name: "skip-me" }]]);
  let sendCalled = false;
  const summary = await sendBulkNotifications(recipients, template, data, {
    send: async () => { sendCalled = true; return { sent: true }; },
  });
  assert.equal(summary.skipped, 1);
  assert.equal(sendCalled, false);
});

test("sendBulkNotifications: a failed send lands in the retry queue with its original data", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "a@example.com" }, { id: "b", to: "b@example.com" }];
  const data = new Map<string, Payload>([["a", { name: "Alice" }], ["b", { name: "Bob", fail: true }]]);
  const summary = await sendBulkNotifications(recipients, template, data, {
    send: async (msg) => (msg.to === "b@example.com" ? { sent: false, reason: "bounced" } : { sent: true }),
  });
  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.retryQueue.length, 1);
  assert.equal(summary.retryQueue[0]!.recipient.id, "b");
  assert.deepEqual(summary.retryQueue[0]!.data, { name: "Bob", fail: true });
  const failedResult = summary.results.find((r) => r.recipient.id === "b");
  assert.equal(failedResult?.reason, "bounced");
});

test("sendBulkNotifications: a template that throws is captured as a failure, not thrown", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "a@example.com" }];
  const data = new Map<string, Payload>([["a", { name: "Alice" }]]);
  const throwing = () => { throw new Error("boom"); };
  const summary = await sendBulkNotifications(recipients, throwing, data, { send: async () => ({ sent: true }) });
  assert.equal(summary.failed, 1);
  assert.equal(summary.results[0]!.reason, "boom");
});

test("sendBulkNotifications: a recipient with no @ in the address fails without attempting a send", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "not-an-email" }];
  const data = new Map<string, Payload>([["a", { name: "Alice" }]]);
  let sendCalled = false;
  const summary = await sendBulkNotifications(recipients, template, data, {
    send: async () => { sendCalled = true; return { sent: true }; },
  });
  assert.equal(summary.failed, 1);
  assert.equal(sendCalled, false);
});

test("sendBulkNotifications: never runs more than maxConcurrent sends at once", async () => {
  const recipients: BulkRecipient[] = Array.from({ length: 12 }, (_, i) => ({ id: String(i), to: `${i}@example.com` }));
  const data = new Map<string, Payload>(recipients.map((r) => [r.id, { name: r.id }]));
  let inFlight = 0;
  let maxInFlight = 0;
  const summary = await sendBulkNotifications(recipients, template, data, {
    maxConcurrent: 3,
    send: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return { sent: true };
    },
  });
  assert.equal(summary.sent, 12);
  assert.ok(maxInFlight <= 3, `expected at most 3 concurrent sends, saw ${maxInFlight}`);
});

test("sendBulkNotifications: works with a plain object for data, not just a Map", async () => {
  const recipients: BulkRecipient[] = [{ id: "a", to: "a@example.com" }];
  const summary = await sendBulkNotifications(recipients, template, { a: { name: "Alice" } }, {
    send: async () => ({ sent: true }),
  });
  assert.equal(summary.sent, 1);
});
