import test, { after } from "node:test";
import assert from "node:assert/strict";
import { track, analyticsSummary } from "../lib/analytics";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("analytics-test");
const userId = (n: string) => `${PREFIX}-user-${n}`;

after(async () => {
  // Two separate cleanup keys: most rows are tied to a PREFIX-scoped
  // user_id, but the "no options at all" test below deliberately creates a
  // row with a null user_id, which that filter alone would never catch.
  await pgPool().query("DELETE FROM app_events WHERE user_id LIKE $1 OR name = $2", [`${PREFIX}%`, `${PREFIX}-bare-event`]);
});

test("track: records an event, queryable by name and user via a raw select", async () => {
  const uId = userId("1");
  await track("test_event", { userId: uId, metadata: { foo: "bar" } });
  const res = await pgPool().query<{ name: string; user_id: string; metadata: { foo: string } }>(
    "SELECT name, user_id, metadata FROM app_events WHERE user_id = $1", [uId],
  );
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0]!.name, "test_event");
  assert.equal(res.rows[0]!.metadata.foo, "bar");
});

test("track: never throws, even if called with no options", async () => {
  await assert.doesNotReject(() => track(`${PREFIX}-bare-event`));
});

test("analyticsSummary: counts a tracked event within the window", async () => {
  const uId = userId("2");
  const eventName = `${PREFIX}-unique-event`;
  await track(eventName, { userId: uId });
  const summary = await analyticsSummary(1);
  const found = summary.eventCounts.find((e) => e.name === eventName);
  assert.ok(found, "the just-tracked event should appear in the summary's eventCounts");
  assert.equal(found?.count, 1);
});

test("analyticsSummary: activeUsersByDay counts a user who triggered any event today", async () => {
  const uId = userId("3");
  await track("some_event", { userId: uId });
  const summary = await analyticsSummary(1);
  const todayCount = summary.activeUsersByDay.reduce((n, d) => n + d.count, 0);
  assert.ok(todayCount >= 1, "at least this test's user should count as active");
});
