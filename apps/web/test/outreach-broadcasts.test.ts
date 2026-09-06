import test, { after } from "node:test";
import assert from "node:assert/strict";
import { sendBroadcast, reachableCount, listBroadcasts, getBroadcast, addOptOut, scheduleBroadcast, cancelBroadcast, dispatchDueBroadcasts } from "../lib/outreach/broadcasts";
import { recordLead } from "../lib/acquisition/leads";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import type { Group } from "../lib/segments/rules";

const WS = uid("bc-ws");
const SLUG = "bc-fn-" + Math.random().toString(36).slice(2, 7);
const ALL: Group = { combinator: "and", rules: [] };

after(async () => {
  await pgPool().query("DELETE FROM broadcast_sends WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM broadcasts WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM contact_optouts WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM leads WHERE funnel_slug = $1", [SLUG]);
});

test("reachableCount counts only contacts with the channel address", async () => {
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "a@x.com", phone: "+15550001" });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 80, email: "b@x.com" }); // no phone
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 40, email: "c@x.com", phone: "+15550003" });
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);

  assert.equal(await reachableCount(WS, ALL, "email"), 3, "all three have email");
  assert.equal(await reachableCount(WS, ALL, "sms"), 2, "two have a phone");
});

test("sending logs a result per recipient; with no provider all fail honestly", async () => {
  // No mail/SMS provider is configured in tests, so sends fail with a reason
  // (never faked as delivered) — which is exactly what we assert.
  const b = await sendBroadcast(WS, { name: "Check-in", channel: "email", subject: "Hi {{firstName}}", body: "Hello {{firstName}}!", rules: ALL });
  assert.equal(b.recipientCount, 3);
  assert.equal(b.sentCount, 0, "no provider → nothing delivered");
  assert.equal(b.failedCount, 3);
  assert.equal(b.status, "sent");

  const full = await getBroadcast(WS, b.id);
  assert.equal(full!.sends.length, 3);
  assert.ok(full!.sends.every((s) => s.status === "failed" && /provider/i.test(s.reason || "")), "each failure explains no provider");
});

test("opt-outs are excluded from the audience", async () => {
  await addOptOut(WS, "email", "B@X.COM"); // case-insensitive
  assert.equal(await reachableCount(WS, ALL, "email"), 2, "b@x.com is opted out");
  const b = await sendBroadcast(WS, { name: "Second", channel: "email", subject: "s", body: "hi", rules: ALL });
  assert.equal(b.recipientCount, 2);
});

test("an SMS broadcast only targets phone-reachable contacts", async () => {
  const b = await sendBroadcast(WS, { name: "SMS blast", channel: "sms", body: "hi {{firstName}}", rules: ALL });
  assert.equal(b.recipientCount, 2, "only the two with a phone");
});

test("validation: email needs a subject; body can't be empty", async () => {
  await assert.rejects(() => sendBroadcast(WS, { name: "x", channel: "email", body: "hi", rules: ALL }), /subject/i);
  await assert.rejects(() => sendBroadcast(WS, { name: "x", channel: "sms", body: "  ", rules: ALL }), /empty/i);
});

test("broadcasts are listed newest first", async () => {
  const list = await listBroadcasts(WS);
  assert.ok(list.length >= 3);
  assert.ok(new Date(list[0]!.createdAt) >= new Date(list[list.length - 1]!.createdAt));
});

test("scheduleBroadcast queues without sending; validates time and message", async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const b = await scheduleBroadcast(WS, { name: "Later", channel: "email", subject: "s", body: "hi {{firstName}}", rules: ALL }, future);
  assert.equal(b.status, "scheduled");
  assert.equal(b.sentCount, 0);
  assert.equal(b.scheduledAt && new Date(b.scheduledAt).getTime(), future.getTime());
  assert.ok(b.recipientCount >= 1, "recipient estimate is recorded at schedule time");
  // nothing went out yet
  const full = await getBroadcast(WS, b.id);
  assert.equal(full!.sends.length, 0, "a scheduled broadcast sends nothing until it fires");
  // a past time and an empty body are both rejected
  await assert.rejects(() => scheduleBroadcast(WS, { name: "x", channel: "email", subject: "s", body: "hi", rules: ALL }, new Date(Date.now() - 1000)), /future/i);
  await assert.rejects(() => scheduleBroadcast(WS, { name: "x", channel: "email", subject: "s", body: " ", rules: ALL }, future), /empty/i);
});

test("dispatchDueBroadcasts fires only past-due ones, exactly once, and leaves future ones queued", async () => {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const past = new Date(Date.now() - 60 * 1000);
  const later = await scheduleBroadcast(WS, { name: "Future", channel: "email", subject: "s", body: "hi", rules: ALL }, soon);
  // Queue one, then backdate its scheduled_at so it reads as due.
  const due = await scheduleBroadcast(WS, { name: "DueNow", channel: "email", subject: "s", body: "hi", rules: ALL }, soon);
  await pgPool().query("UPDATE broadcasts SET scheduled_at = $2 WHERE id = $1", [due.id, past.toISOString()]);

  const n = await dispatchDueBroadcasts(new Date());
  assert.ok(n >= 1, "at least the due one fired");

  const dueAfter = await getBroadcast(WS, due.id);
  assert.equal(dueAfter!.broadcast.status, "sent", "the due broadcast is now sent");
  assert.ok(dueAfter!.sends.length >= 1, "the due broadcast delivered to its recipients");

  const laterAfter = await getBroadcast(WS, later.id);
  assert.equal(laterAfter!.broadcast.status, "scheduled", "the future one is untouched");

  // Running again must NOT re-send the already-sent one (atomic claim).
  const sendsBefore = dueAfter!.sends.length;
  await dispatchDueBroadcasts(new Date());
  const dueAgain = await getBroadcast(WS, due.id);
  assert.equal(dueAgain!.sends.length, sendsBefore, "a second tick never re-sends a sent broadcast");
});

test("cancelBroadcast stops a scheduled one; a sent one can't be cancelled", async () => {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const b = await scheduleBroadcast(WS, { name: "Callit off", channel: "email", subject: "s", body: "hi", rules: ALL }, soon);
  assert.equal(await cancelBroadcast(WS, b.id), true);
  const after = await getBroadcast(WS, b.id);
  assert.equal(after!.broadcast.status, "cancelled");
  // it won't fire even once its time passes
  await pgPool().query("UPDATE broadcasts SET scheduled_at = $2 WHERE id = $1", [b.id, new Date(Date.now() - 1000).toISOString()]);
  await dispatchDueBroadcasts(new Date());
  assert.equal((await getBroadcast(WS, b.id))!.broadcast.status, "cancelled", "a cancelled broadcast is never dispatched");
  // a real send can't be cancelled
  const sent = await sendBroadcast(WS, { name: "Gone out", channel: "email", subject: "s", body: "hi", rules: ALL });
  assert.equal(await cancelBroadcast(WS, sent.id), false);
});
