import test, { after } from "node:test";
import assert from "node:assert/strict";
import { previewSegment, listContacts, createSegment, listSegments, updateSegment, deleteSegment } from "../lib/segments/store";
import { recordLead } from "../lib/acquisition/leads";
import { createBooking } from "../lib/acquisition/bookings";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import type { Group } from "../lib/segments/rules";

const WS = uid("seg-ws");
const SLUG = "seg-fn-" + Math.random().toString(36).slice(2, 7);

after(async () => {
  await pgPool().query("DELETE FROM segments WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM leads WHERE funnel_slug = $1", [SLUG]);
  await pgPool().query("DELETE FROM bookings WHERE funnel_slug = $1", [SLUG]);
});

test("seed + preview counts matches and channel reachability", async () => {
  // q1: qualified, email+phone, verified, booked. q2: qualified, email only, verified, not booked.
  // n1: nurture, email+phone, not verified. u1: unqualified, email only.
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "q1@x.com", phone: "+15550001", attribution: { creativeId: "coi", utmSource: "meta" } });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 75, email: "q2@x.com", attribution: { utmSource: "google" } });
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 40, email: "n1@x.com", phone: "+15550002", attribution: { utmSource: "meta" } });
  await recordLead({ funnelSlug: SLUG, status: "unqualified", score: 10, email: "u1@x.com", attribution: { utmSource: "meta" } });
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);
  await pgPool().query("UPDATE leads SET verified = true WHERE funnel_slug = $1 AND email IN ('q1@x.com','q2@x.com')", [SLUG]);
  await createBooking({ funnelSlug: SLUG, slotStart: "2026-09-01T10:00", email: "q1@x.com", workspaceId: WS });

  // Everyone (empty rules).
  const all = await previewSegment(WS, { combinator: "and", rules: [] });
  assert.equal(all.total, 4);
  assert.equal(all.withEmail, 4);
  assert.equal(all.withPhone, 2, "two have a phone / SMS-reachable");
  assert.equal(all.verified, 2);
  assert.equal(all.booked, 1, "one has a matching booking");
  assert.ok(all.sample.length === 4);
});

test("qualified-but-not-booked (the hot follow-up segment)", async () => {
  const rules: Group = { combinator: "and", rules: [
    { field: "status", op: "eq", value: "qualified" },
    { field: "booked", op: "isFalse" },
  ] };
  const p = await previewSegment(WS, rules);
  assert.equal(p.total, 1, "only q2 — qualified and hasn't booked");
  assert.equal(p.sample[0]!.email, "q2@x.com");
});

test("SMS-reachable from a specific source (composed AND)", async () => {
  const rules: Group = { combinator: "and", rules: [
    { field: "hasPhone", op: "isTrue" },
    { field: "source", op: "eq", value: "meta" },
  ] };
  const contacts = await listContacts(WS, rules);
  const emails = contacts.map((c) => c.email).sort();
  assert.deepEqual(emails, ["n1@x.com", "q1@x.com"], "both meta leads with a phone");
});

test("OR groups broaden the match", async () => {
  const rules: Group = { combinator: "or", rules: [
    { field: "status", op: "eq", value: "unqualified" },
    { field: "score", op: "gte", value: 80 },
  ] };
  const p = await previewSegment(WS, rules);
  assert.equal(p.total, 2, "u1 (unqualified) OR q1 (score 90)");
});

test("save, list, update, and delete a segment", async () => {
  const rules: Group = { combinator: "and", rules: [{ field: "booked", op: "isTrue" }] };
  const seg = await createSegment(WS, { name: "Converted", description: "Booked a call", rules });
  assert.equal(seg.name, "Converted");
  assert.ok((await listSegments(WS)).some((s) => s.id === seg.id));

  const updated = await updateSegment(WS, seg.id, { name: "Buyers", rules: { combinator: "and", rules: [{ field: "verified", op: "isTrue" }] } });
  assert.equal(updated!.name, "Buyers");
  assert.equal(updated!.rules.rules.length, 1);

  assert.equal(await deleteSegment(WS, seg.id), true);
  assert.equal(await deleteSegment(WS, seg.id), false, "already gone");
});

test("a bad rule tree is rejected on save", async () => {
  await assert.rejects(() => createSegment(WS, { name: "Bad", rules: { combinator: "and", rules: [{ field: "evil", op: "eq", value: "x" }] } as Group }), /unknown segment field/);
});
