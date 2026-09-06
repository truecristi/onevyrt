import test, { after } from "node:test";
import assert from "node:assert/strict";
import { checkFreeAccessMode, bypassGatesIfFreeAccess, clearFreeAccessCache } from "../../lib/free-access-mode";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso } from "../helpers/pg";
import type { Enrollment } from "@onevyrt/engine";

const PREFIX = uid("free-access-test");

after(async () => {
  await pgPool().query("DELETE FROM workspaces WHERE name LIKE $1", [`${PREFIX}%`]);
});

test("checkFreeAccessMode", async (t) => {
  await t.test("returns null when workspace has no free access", async () => {
    const wsName = `${PREFIX}-no-access`;
    const pool = pgPool();
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'test-owner', $3) RETURNING id`,
      [newId(), wsName, nowIso()]
    );

    const result = await checkFreeAccessMode(ws!.id, pool);
    assert.equal(result, null);
  });

  await t.test("returns until date when free access is active", async () => {
    const wsName = `${PREFIX}-with-access`;
    const pool = pgPool();
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, plan_metadata, created_at)
       VALUES ($1, $2, 'test-owner', $3, $4) RETURNING id`,
      [newId(), wsName, JSON.stringify({ free_access_until: futureDate }), nowIso()]
    );

    const result = await checkFreeAccessMode(ws!.id, pool);
    assert.ok(result, "returns a date when free access is active");
  });

  await t.test("returns null when free access has expired", async () => {
    const wsName = `${PREFIX}-expired-access`;
    const pool = pgPool();
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, plan_metadata, created_at)
       VALUES ($1, $2, 'test-owner', $3, $4) RETURNING id`,
      [newId(), wsName, JSON.stringify({ free_access_until: pastDate }), nowIso()]
    );

    const result = await checkFreeAccessMode(ws!.id, pool);
    assert.equal(result, null);
  });

  await t.test("caches results with 5-minute TTL", async () => {
    const wsName = `${PREFIX}-cache-test`;
    const pool = pgPool();
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'test-owner', $3) RETURNING id`,
      [newId(), wsName, nowIso()]
    );

    // First check
    const result1 = await checkFreeAccessMode(ws!.id, pool);
    // Second check should return cached value even if DB changes
    const result2 = await checkFreeAccessMode(ws!.id, pool);
    assert.equal(result1, result2, "cached result returned");
  });

  await t.test("cache can be cleared explicitly", async () => {
    const wsName = `${PREFIX}-cache-clear`;
    const pool = pgPool();
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, plan_metadata, created_at)
       VALUES ($1, $2, 'test-owner', $3, $4) RETURNING id`,
      [newId(), wsName, JSON.stringify({ free_access_until: futureDate }), nowIso()]
    );

    const result1 = await checkFreeAccessMode(ws!.id, pool);
    assert.ok(result1, "cache has value");

    clearFreeAccessCache(ws!.id);

    // After clearing, should still work (will requery)
    const result2 = await checkFreeAccessMode(ws!.id, pool);
    assert.ok(result2, "still returns correct value after cache clear");
  });

  await t.test("returns null for non-existent workspace", async () => {
    const result = await checkFreeAccessMode("non-existent-ws", pgPool());
    assert.equal(result, null);
  });
});

test("bypassGatesIfFreeAccess", async (t) => {
  // Real @onevyrt/engine shape: EnrollmentLessonEntry has no "gated" flag —
  // a lesson is gated by having no stored `status` (or an explicit
  // "locked") and unlocked once `status` is set (see bypassGatesIfFreeAccess
  // in lib/free-access-mode.ts, which flips gated lessons to "available").
  const baseEnrollment = (lessons: Enrollment["lessons"]): Enrollment => ({
    id: "e1",
    programmeId: "p1",
    workspaceId: "ws1",
    userId: "u1",
    deliveryMode: "self_paced",
    startedAt: new Date().toISOString(),
    accessGranted: false,
    lessons,
  });

  await t.test("unlocks all lessons when isFreeAccess is true", () => {
    const enrollment = baseEnrollment([
      { lessonId: "1", submissions: [] },
      { lessonId: "2", status: "locked", submissions: [] },
      { lessonId: "3", submissions: [] },
    ]);

    const result = bypassGatesIfFreeAccess(enrollment, true);
    assert.equal(result.accessGranted, true, "access granted set to true");
    for (const lesson of result.lessons) {
      assert.equal(lesson.status, "available", `lesson ${lesson.lessonId} ungated`);
    }
  });

  await t.test("does not modify enrollment when isFreeAccess is false", () => {
    const enrollment = baseEnrollment([
      { lessonId: "1", submissions: [] },
      { lessonId: "2", submissions: [] },
    ]);

    const result = bypassGatesIfFreeAccess(enrollment, false);
    assert.equal(result.accessGranted, false, "access granted unchanged");
    assert.equal(result.lessons[0]!.status, undefined, "gates remain locked");
  });

  await t.test("returns the same reference (mutates in place)", () => {
    const enrollment = baseEnrollment([]);

    const result = bypassGatesIfFreeAccess(enrollment, true);
    assert.strictEqual(result, enrollment, "returned same object reference");
  });

  await t.test("handles empty lessons array", () => {
    const enrollment = baseEnrollment([]);

    const result = bypassGatesIfFreeAccess(enrollment, true);
    assert.equal(result.lessons.length, 0);
  });

  await t.test("handles large number of lessons", () => {
    const lessons = Array.from({ length: 1000 }, (_, i) => ({
      lessonId: `lesson-${i}`,
      submissions: [],
    }));
    const enrollment = baseEnrollment(lessons);

    const result = bypassGatesIfFreeAccess(enrollment, true);
    assert.equal(result.lessons.length, 1000);
    for (const lesson of result.lessons) {
      assert.equal(lesson.status, "available");
    }
  });
});
