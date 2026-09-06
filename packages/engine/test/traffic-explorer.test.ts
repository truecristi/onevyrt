import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverNextSteps, discoverPreviousSteps, discoverSources, stepConversion,
  type TrackedSession,
} from "../src/traffic-explorer.ts";

function ev(sessionId: string, url: string, extra: Partial<import("../src/traffic-explorer.ts").TrackedEvent> = {}) {
  return { id: `${sessionId}-${url}-${Math.random()}`, sessionId, timestamp: 0, type: "pageview" as const, url, ...extra };
}

const sessions: TrackedSession[] = [
  { id: "s1", events: [
    ev("s1", "/", { sourceLabel: "Facebook" }),
    ev("s1", "/opt-in"),
    ev("s1", "/booking"),
  ] },
  { id: "s2", events: [
    ev("s2", "/", { sourceLabel: "Facebook" }),
    ev("s2", "/opt-in"),
  ] },
  { id: "s3", events: [
    ev("s3", "/", { sourceLabel: "Google" }),
    ev("s3", "/pricing"),
  ] },
  { id: "s4", events: [
    ev("s4", "/opt-in", { sourceLabel: "Referral" }), // entered directly on opt-in
    ev("s4", "/booking"),
  ] },
];

test("discoverNextSteps: counts what people did right after a page, ranked descending", () => {
  const result = discoverNextSteps(sessions, "/opt-in");
  // s1 -> /booking, s2 -> nothing (last event), s4 -> /booking. 3 sessions hit /opt-in.
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "/booking");
  assert.equal(result[0].people, 2);
  assert.equal(result[0].rate, 2 / 3);
});

test("discoverPreviousSteps: counts what preceded a page", () => {
  const result = discoverPreviousSteps(sessions, "/opt-in");
  // /opt-in reached by s1, s2 (both from "/"); s4 has no previous event (it's first).
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "/");
  assert.equal(result[0].people, 2);
});

test("discoverSources: entry source for sessions that reached a page", () => {
  const result = discoverSources(sessions, "/opt-in");
  // s1, s2 reached /opt-in via Facebook; s4 reached it directly (its own first event, source Referral)
  const bySource = Object.fromEntries(result.map((r) => [r.key, r.people]));
  assert.equal(bySource["Facebook"], 2);
  assert.equal(bySource["Referral"], 1);
});

test("stepConversion: people + rate for a single hop", () => {
  const result = stepConversion(sessions, "/opt-in", "/booking");
  // 3 sessions hit /opt-in (s1, s2, s4); 2 of them later hit /booking (s1, s4)
  assert.equal(result.fromPeople, 3);
  assert.equal(result.people, 2);
  assert.equal(result.rate, 2 / 3);
});

test("empty session log returns empty results, never throws", () => {
  assert.deepEqual(discoverNextSteps([], "/opt-in"), []);
  assert.deepEqual(discoverPreviousSteps([], "/opt-in"), []);
  assert.deepEqual(discoverSources([], "/opt-in"), []);
  const conv = stepConversion([], "/opt-in", "/booking");
  assert.equal(conv.fromPeople, 0);
  assert.equal(conv.rate, 0);
});

test("nodeId grouping mode works the same as url grouping", () => {
  const mapped: TrackedSession[] = [
    { id: "m1", events: [
      ev("m1", "/", { nodeId: "traffic-1" }),
      ev("m1", "/opt-in", { nodeId: "landing-1" }),
    ] },
  ];
  const result = discoverNextSteps(mapped, "traffic-1", "nodeId");
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "landing-1");
});
