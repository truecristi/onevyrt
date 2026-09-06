import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as cohorts from "../lib/cohorts";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("cohorts-test");
const coach = (n: string) => `${PREFIX}-coach-${n}`;
const ws = (n: string) => `${PREFIX}-ws-${n}`;

const createdCohortIds: string[] = [];
async function create(coachUserId: string, coachEmail: string, name: string, start = "2026-09-01", end = "2026-12-01") {
  const result = await cohorts.createCohort(coachUserId, coachEmail, "prog1", name, start, end);
  if ("id" in result) createdCohortIds.push(result.id);
  return result;
}

after(async () => {
  if (createdCohortIds.length === 0) return;
  await pgPool().query("DELETE FROM cohorts WHERE id = ANY($1::text[])", [createdCohortIds]);
});

test("createCohort: rejects a blank name", async () => {
  const result = await create(coach("1"), `${coach("1")}@example.com`, "   ");
  assert.ok("error" in result);
});

test("createCohort then listCohortsForCoach: only returns cohorts created by that coach", async () => {
  await create(coach("2a"), `${coach("2a")}@example.com`, "Autumn Cohort");
  await create(coach("2b"), `${coach("2b")}@example.com`, "Other Coach's Cohort");
  const list = await cohorts.listCohortsForCoach(coach("2a"));
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name, "Autumn Cohort");
});

test("addCohortMember: rejects a coach acting on a cohort they didn't create", async () => {
  const created = await create(coach("3a"), `${coach("3a")}@example.com`, "Autumn Cohort");
  const result = await cohorts.addCohortMember((created as { id: string }).id, coach("3b"), ws("3"));
  assert.ok("error" in result);
});

test("addCohortMember: adds a workspace, and listCohortsForWorkspace finds it from the member's side", async () => {
  const created = await create(coach("4"), `${coach("4")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const workspaceId = ws("4");
  await cohorts.addCohortMember(id, coach("4"), workspaceId);
  const forWorkspace = await cohorts.listCohortsForWorkspace(workspaceId);
  assert.equal(forWorkspace.length, 1);
  assert.equal(forWorkspace[0]!.id, id);
});

test("addCohortMember: adding the same workspace twice does not duplicate the roster", async () => {
  const created = await create(coach("5"), `${coach("5")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const workspaceId = ws("5");
  await cohorts.addCohortMember(id, coach("5"), workspaceId);
  await cohorts.addCohortMember(id, coach("5"), workspaceId);
  const cohort = await cohorts.getCohort(id);
  assert.equal(cohort?.memberWorkspaceIds.length, 1);
});

test("removeCohortMember: drops a workspace from the roster", async () => {
  const created = await create(coach("6"), `${coach("6")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const workspaceId = ws("6");
  await cohorts.addCohortMember(id, coach("6"), workspaceId);
  await cohorts.removeCohortMember(id, coach("6"), workspaceId);
  const cohort = await cohorts.getCohort(id);
  assert.equal(cohort?.memberWorkspaceIds.length, 0);
});

test("addCohortSession: appends a session, kept sorted by date", async () => {
  const created = await create(coach("7"), `${coach("7")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  await cohorts.addCohortSession(id, coach("7"), "Week 2 call", "2026-09-15T10:00:00.000Z", "https://meet.example.com/w2");
  await cohorts.addCohortSession(id, coach("7"), "Week 1 call", "2026-09-08T10:00:00.000Z");
  const cohort = await cohorts.getCohort(id);
  assert.equal(cohort?.sessions.length, 2);
  assert.equal(cohort?.sessions[0]!.title, "Week 1 call", "sessions should be sorted earliest-first");
});

test("postCohortAnnouncement: rejects empty messages, records real ones with the poster's email", async () => {
  const created = await create(coach("8"), `${coach("8")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const bad = await cohorts.postCohortAnnouncement(id, coach("8"), `${coach("8")}@example.com`, "   ");
  assert.ok("error" in bad);
  await cohorts.postCohortAnnouncement(id, coach("8"), `${coach("8")}@example.com`, "Welcome to the cohort!");
  const cohort = await cohorts.getCohort(id);
  assert.equal(cohort?.announcements.length, 1);
  assert.equal(cohort?.announcements[0]!.postedBy, `${coach("8")}@example.com`);
});

test("setCohortStageAccessLimit: sets and clears a cap, rejecting a coach who doesn't own the cohort", async () => {
  const created = await create(coach("9a"), `${coach("9a")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const denied = await cohorts.setCohortStageAccessLimit(id, coach("9b"), 3);
  assert.ok("error" in denied);
  const updated = await cohorts.setCohortStageAccessLimit(id, coach("9a"), 3);
  assert.equal((updated as { stageAccessLimit?: number }).stageAccessLimit, 3);
  const cleared = await cohorts.setCohortStageAccessLimit(id, coach("9a"), null);
  assert.equal((cleared as { stageAccessLimit?: number }).stageAccessLimit, undefined);
});

test("effectiveStageAccessLimit: no cohorts means no cap", async () => {
  assert.equal(await cohorts.effectiveStageAccessLimit(ws("none")), null);
});

test("effectiveStageAccessLimit: takes the strictest cap across every cohort a workspace belongs to", async () => {
  const a = await create(coach("10"), `${coach("10")}@example.com`, "A");
  const b = await create(coach("10"), `${coach("10")}@example.com`, "B");
  const aId = (a as { id: string }).id, bId = (b as { id: string }).id;
  const workspaceId = ws("10");
  await cohorts.addCohortMember(aId, coach("10"), workspaceId);
  await cohorts.addCohortMember(bId, coach("10"), workspaceId);
  await cohorts.setCohortStageAccessLimit(aId, coach("10"), 5);
  await cohorts.setCohortStageAccessLimit(bId, coach("10"), 2);
  assert.equal(await cohorts.effectiveStageAccessLimit(workspaceId), 2);
});

test("effectiveStageAccessLimit: an unrestricted cohort alongside a capped one still yields the cap (strictest wins)", async () => {
  const a = await create(coach("11"), `${coach("11")}@example.com`, "A");
  const b = await create(coach("11"), `${coach("11")}@example.com`, "B");
  const aId = (a as { id: string }).id, bId = (b as { id: string }).id;
  const workspaceId = ws("11");
  await cohorts.addCohortMember(aId, coach("11"), workspaceId);
  await cohorts.addCohortMember(bId, coach("11"), workspaceId);
  await cohorts.setCohortStageAccessLimit(bId, coach("11"), 4);
  assert.equal(await cohorts.effectiveStageAccessLimit(workspaceId), 4);
});

// Same read-modify-write shape as every other store in this app.
test("addCohortMember: concurrent adds of different workspaces don't lose any of them", async () => {
  const created = await create(coach("12"), `${coach("12")}@example.com`, "Autumn Cohort");
  const id = (created as { id: string }).id;
  const MEMBER_COUNT = 30;
  await Promise.all(Array.from({ length: MEMBER_COUNT }, (_, i) => cohorts.addCohortMember(id, coach("12"), ws(`12-${i}`))));
  const cohort = await cohorts.getCohort(id);
  assert.equal(cohort?.memberWorkspaceIds.length, MEMBER_COUNT, "some concurrent member adds were lost to a write race");
});
