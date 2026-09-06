import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as tracking from "../lib/tracking";
import { uid, purgeTrackingKey } from "./helpers/pg";

const PREFIX = uid("journeys-test");
const createdKeys: string[] = [];
async function newKey(n: string): Promise<string> {
  const key = await tracking.ensureTrackingKey(`${PREFIX}-scope-${n}`, `${PREFIX}-proj-${n}`);
  createdKeys.push(key);
  return key;
}

after(async () => {
  for (const key of createdKeys) await purgeTrackingKey(key);
});

test("recordJourneyEvent: rejects an unknown tracking key", async () => {
  const ok = await tracking.recordJourneyEvent("no-such-key", { sessionId: "s1", type: "pageview" });
  assert.equal(ok, false);
});

test("recordJourneyEvent: groups events by sessionId, in order", async () => {
  const key = await newKey("1");
  await tracking.recordJourneyEvent(key, { sessionId: "s1", type: "pageview", nodeId: "traffic-1", sourceLabel: "Facebook" });
  await tracking.recordJourneyEvent(key, { sessionId: "s1", type: "pageview", nodeId: "landing-1" });
  await tracking.recordJourneyEvent(key, { sessionId: "s1", type: "conversion", nodeId: "offer-1" });

  const sessions = await tracking.getJourneySessions(key);
  assert.equal(sessions.length, 1);
  const s0 = sessions[0];
  assert.ok(s0);
  assert.equal(s0.id, "s1");
  assert.equal(s0.events.length, 3);
  const e0 = s0.events[0];
  assert.ok(e0);
  assert.equal(e0.nodeId, "traffic-1");
  assert.equal(e0.sourceLabel, "Facebook");
  const e2 = s0.events[2];
  assert.ok(e2);
  assert.equal(e2.type, "conversion");
});

test("recordJourneyEvent: separate sessionIds stay separate sessions", async () => {
  const key = await newKey("2");
  await tracking.recordJourneyEvent(key, { sessionId: "s1", type: "pageview" });
  await tracking.recordJourneyEvent(key, { sessionId: "s2", type: "pageview" });

  const sessions = await tracking.getJourneySessions(key);
  assert.equal(sessions.length, 2);
});

test("getJourneySessions: most recent first, respects the limit", async () => {
  const key = await newKey("3");
  for (let i = 0; i < 5; i++) await tracking.recordJourneyEvent(key, { sessionId: `s${i}`, type: "pageview" });

  const sessions = await tracking.getJourneySessions(key, 2);
  assert.equal(sessions.length, 2);
  const [s0, s1] = sessions;
  assert.ok(s0);
  assert.ok(s1);
  assert.equal(s0.id, "s4");
  assert.equal(s1.id, "s3");
});

test("getJourneySessions: a key with no journey events yet returns an empty array, not an error", async () => {
  const key = await newKey("4");
  const sessions = await tracking.getJourneySessions(key);
  assert.deepEqual(sessions, []);
});
