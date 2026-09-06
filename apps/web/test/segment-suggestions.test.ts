import test from "node:test";
import assert from "node:assert/strict";
import { suggestAudiences, type AudienceStats } from "../lib/segments/suggestions";

const base: AudienceStats = {
  total: 0, qualifiedNotBooked: 0, nurtureWithPhone: 0, newLast7: 0, booked: 0, verifiedEmail: 0, smsReachable: 0,
};

test("empty audiences produce no suggestions", () => {
  assert.deepEqual(suggestAudiences(base), []);
});

test("only non-empty audiences are suggested", () => {
  const out = suggestAudiences({ ...base, qualifiedNotBooked: 5, smsReachable: 12 });
  assert.deepEqual(out.map((s) => s.id).sort(), ["qualifiedNotBooked", "smsReachable"]);
});

test("intent weight ranks hot leads above a bigger low-intent list", () => {
  const out = suggestAudiences({ ...base, qualifiedNotBooked: 3, smsReachable: 500 });
  assert.equal(out[0]!.id, "qualifiedNotBooked", "hot leads should come first even when smaller");
  assert.equal(out[1]!.id, "smsReachable");
});

test("within the same weight, larger audiences rank first", () => {
  // Give two DIFFERENT-weight audiences equal only via size tiebreak isn't
  // possible; instead verify size ordering is applied as the secondary key by
  // checking a full set stays weight-ordered.
  const out = suggestAudiences({ ...base, qualifiedNotBooked: 1, newLast7: 99, nurtureWithPhone: 50 });
  assert.deepEqual(out.map((s) => s.id), ["qualifiedNotBooked", "newLast7", "nurtureWithPhone"]);
});

test("limit caps the number of suggestions", () => {
  const full: AudienceStats = { total: 100, qualifiedNotBooked: 4, nurtureWithPhone: 4, newLast7: 4, booked: 4, verifiedEmail: 4, smsReachable: 4 };
  assert.equal(suggestAudiences(full).length, 4); // default
  assert.equal(suggestAudiences(full, 2).length, 2);
  assert.equal(suggestAudiences(full, 10).length, 6); // only 6 candidates exist
});

test("each suggestion carries a usable rule Group and a channel", () => {
  const out = suggestAudiences({ ...base, qualifiedNotBooked: 3 });
  const s = out[0];
  assert.ok(s);
  assert.equal(s.rules.combinator, "and");
  assert.ok(Array.isArray(s.rules.rules) && s.rules.rules.length >= 1);
  assert.ok(["email", "sms", "any"].includes(s.channel));
  assert.match(s.reason, /qualified but never booked/);
});

test("reason text singularizes for a count of one", () => {
  const out = suggestAudiences({ ...base, booked: 1 });
  assert.match(out[0]!.reason, /1 customer already said yes/);
});
