import test, { after } from "node:test";
import assert from "node:assert/strict";
import type { ChapterSubmission, Enrollment, ProgrammeTemplate } from "@onevyrt/engine";
import { chapterGates } from "@onevyrt/engine";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import { getDefaultProgramme } from "../lib/curriculum-store";
import { addChapterSubmission, reviewChapterSubmission } from "../lib/chapter-submissions";
import { chapter4GateOf, chapter4Completion, CHAPTER_4_STAGE_ID } from "../lib/enrollments";
import {
  selectCoachRecipients,
  buildChapterSubmissionEmail,
  buildChapterReviewEmail,
  chapterTitleOf,
} from "../lib/programme-notifications";
import { CHAPTER_4_SUBCHAPTERS, getChapter4SubchapterByCode, getChapter4SubchapterByModuleId } from "../lib/chapter-4";
import { buildTransformationReport, type TransformationReportInputs } from "../lib/reports/transformation-report";
import type { ConstraintData } from "../lib/constraint";
import type { DriverTree } from "../lib/drivers";
import type { ExecutionData } from "../lib/execution";

/**
 * Chapter 4 (IMPROVE & SCALE) integration tests — this lane's own coverage,
 * on top of what already exists per concern:
 *   - packages/engine/test/{curriculum-chapters,chapter-gates,programme-nav}.test.ts
 *     cover the pure engine-level gate/layout mechanics in full.
 *   - test/chapter-submissions.test.ts covers the generic submit/review store
 *     mechanics (locking, duplicates, concurrency) using the "start" stage.
 *   - test/transformation-report.test.ts covers the report builder's other
 *     sections in full.
 * This file covers the INTEGRATION seams specific to Chapter 4 becoming a
 * real canonical stage: the full unlock chain through it to Finish against
 * the REAL default programme, the notification builders it added, the
 * lib/chapter-4 content module's alignment with the engine layout, and the
 * v4 migration.
 */

// ── Pure: lib/chapter-4 content aligns with the engine's canonical layout ────

test("lib/chapter-4: exactly 5 subchapters, 4.1-4.5, each with a moduleId the engine actually has in its chapter-4 layout", async () => {
  const programme = await getDefaultProgramme();
  const chapter4Stage = programme.stages.find((s) => s.id === "chapter-4");
  assert.ok(chapter4Stage, "the live default programme has a chapter-4 stage");
  const engineModuleIds = new Set(chapter4Stage!.lessons.map((l) => l.id));

  assert.equal(CHAPTER_4_SUBCHAPTERS.length, 5);
  assert.deepEqual(CHAPTER_4_SUBCHAPTERS.map((s) => s.code), ["4.1", "4.2", "4.3", "4.4", "4.5"]);
  assert.deepEqual(CHAPTER_4_SUBCHAPTERS.map((s) => s.subchapterNum), [1, 2, 3, 4, 5]);
  for (const s of CHAPTER_4_SUBCHAPTERS) {
    assert.ok(engineModuleIds.has(s.moduleId), `${s.code}'s moduleId "${s.moduleId}" must be a real chapter-4 engine lesson`);
    assert.ok(s.title.length > 0);
    assert.ok(s.description.length > 100, `${s.code} should have real teaching content, not a stub`);
    assert.ok(s.keyPoints.length >= 3);
    assert.ok(s.learningObjectives.length >= 3);
    assert.ok(s.actionItems.length >= 2);
  }
});

test("lib/chapter-4: lookups by code, number and moduleId all agree", () => {
  const bySlug = getChapter4SubchapterByCode("4.1")!;
  assert.equal(bySlug.subchapterNum, 1);
  assert.equal(getChapter4SubchapterByModuleId(bySlug.moduleId)?.code, "4.1");
  assert.equal(getChapter4SubchapterByCode("4.9"), undefined);
  assert.equal(getChapter4SubchapterByModuleId("m-does-not-exist"), undefined);
});

// ── Pure: Chapter4Gate / Chapter4Completion (lib/enrollments.ts) ────────────

function gate(overrides: Partial<ChapterSubmission> = {}, state: "locked" | "in_progress" | "ready_to_submit" | "awaiting_review" | "changes_requested" | "approved" = "approved") {
  return {
    stageId: CHAPTER_4_STAGE_ID, title: "Chapter 4 — Improve and Scale the Business", order: 4,
    output: "Growth & Improvement Plan", state, lessonsComplete: 5, lessonsTotal: 5, unlocksNext: state === "approved",
    ...(state !== "in_progress"
      ? { submission: { stageId: CHAPTER_4_STAGE_ID, submittedAt: "2026-01-01T00:00:00Z", evidence: "my plan", reviewStatus: state === "approved" ? "approved" as const : "submitted" as const, ...overrides } }
      : {}),
  };
}

test("chapter4GateOf: finds the chapter-4 gate by stageId, or null if the programme has no such stage", () => {
  const gates = [
    { stageId: "start", title: "Start", order: 0, output: null, state: "approved" as const, lessonsComplete: 1, lessonsTotal: 1, unlocksNext: true },
    gate(),
  ];
  assert.equal(chapter4GateOf(gates)?.stageId, CHAPTER_4_STAGE_ID);
  assert.equal(chapter4GateOf([gates[0]!]), null);
});

test("chapter4Completion: approved only once the gate itself is approved, with the submission's reviewedAt", () => {
  const approvedGate = gate({ reviewedAt: "2026-02-01T00:00:00Z", reviewStatus: "approved" }, "approved");
  const c = chapter4Completion([approvedGate]);
  assert.equal(c.approved, true);
  assert.equal(c.approvedAt, "2026-02-01T00:00:00Z");
  assert.ok(c.submission);

  const awaitingGate = gate({}, "awaiting_review");
  const notYet = chapter4Completion([awaitingGate]);
  assert.equal(notYet.approved, false);
  assert.equal(notYet.approvedAt, null);
  assert.ok(notYet.submission, "the submission itself is still surfaced even before approval");

  const noStage = chapter4Completion([]);
  assert.equal(noStage.approved, false);
  assert.equal(noStage.submission, null);
});

// ── Pure: chapter-level notification builders (lib/programme-notifications) ─

test("chapterTitleOf: resolves a stage's title from the programme, falls back to the raw id", () => {
  const programme: ProgrammeTemplate = {
    id: "p", name: "P", status: "published", createdAt: "t", updatedAt: "t",
    stages: [{ id: "chapter-4", order: 4, title: "Chapter 4 — Improve and Scale the Business", outcome: "o", lessons: [] }],
  };
  assert.equal(chapterTitleOf(programme, "chapter-4"), "Chapter 4 — Improve and Scale the Business");
  assert.equal(chapterTitleOf(programme, "not-a-stage"), "not-a-stage");
});

test("buildChapterSubmissionEmail / buildChapterReviewEmail: generic over any chapter, Chapter 4 included", () => {
  const submissionEmail = buildChapterSubmissionEmail({ to: "coach@x.com", learnerEmail: "learner@x.com", chapterTitle: "Chapter 4 — Improve and Scale the Business" });
  assert.equal(submissionEmail.to, "coach@x.com");
  assert.match(submissionEmail.subject, /Chapter 4/);
  assert.match(submissionEmail.text, /learner@x\.com/);

  const approvedEmail = buildChapterReviewEmail({ to: "learner@x.com", decision: "approved", chapterTitle: "Chapter 4 — Improve and Scale the Business" });
  assert.match(approvedEmail.subject, /^Approved/);
  assert.match(approvedEmail.text, /approved/);

  const changesEmail = buildChapterReviewEmail({ to: "learner@x.com", decision: "changes_requested", chapterTitle: "Chapter 4 — Improve and Scale the Business", feedback: "Add your 90-day dates." });
  assert.match(changesEmail.subject, /^Changes requested/);
  assert.match(changesEmail.text, /Add your 90-day dates\./);
});

test("selectCoachRecipients: a manager submitting Chapter 4's own plan doesn't email themselves", () => {
  const members = [
    { userId: "u1", email: "coach@x.com", role: "manager" as const },
    { userId: "u2", email: "owner@x.com", role: "owner" as const },
  ];
  assert.deepEqual(selectCoachRecipients(members, "owner@x.com"), ["coach@x.com"]);
  assert.deepEqual(selectCoachRecipients(members, "coach@x.com"), []);
});

// ── Pure: the Transformation Report picks up a real "chapter-4" submission ──
// (see lib/reports/transformation-report.ts's findGrowthChapterSubmission —
// this is the "no code change needed once chapter-4 exists" it promises.)

function sixStageProgramme(): ProgrammeTemplate {
  const stageIds = ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"];
  return {
    id: "prog-c4", name: "Test Programme", status: "published", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    stages: stageIds.map((id, i) => ({
      id, order: i, title: id, outcome: `${id} outcome`,
      lessons: [{ id: `${id}-lesson`, order: 1, title: `${id} lesson`, outcome: "do the thing", content: "" }],
    })),
  };
}

test("Transformation Report: a real 'chapter-4' ChapterSubmission is surfaced as the approved Growth & Improvement Plan, with no special-casing needed", () => {
  const programme = sixStageProgramme();
  const enrollment: Enrollment = {
    id: "e1", programmeId: programme.id, workspaceId: "ws1", userId: "u1", deliveryMode: "self_paced", startedAt: "2026-01-02T00:00:00.000Z",
    lessons: programme.stages.map((s) => ({ lessonId: `${s.id}-lesson`, status: "approved" as const, submissions: [] })),
  };
  // chapterGates() cascades: chapter-4's gate only reads "approved" once every
  // stage before it is ALSO approved — start/chapter-1/2/3 all need their own
  // approved submission for the fixture to reach a realistic "chapter-4 is
  // approved" state, the same way test/transformation-report.test.ts's own
  // baseInputs() builds up the earlier stages' submissions.
  const chapterSubmissions: ChapterSubmission[] = [
    { stageId: "start", submittedAt: "2026-01-05T00:00:00.000Z", evidence: "Baseline captured.", reviewStatus: "approved", reviewedAt: "2026-01-05T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-1", submittedAt: "2026-01-15T00:00:00.000Z", evidence: "Business Psychology Blueprint v1.", reviewStatus: "approved", reviewedAt: "2026-01-15T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-2", submittedAt: "2026-01-25T00:00:00.000Z", evidence: "Implemented Business System v1.", reviewStatus: "approved", reviewedAt: "2026-01-25T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-3", submittedAt: "2026-02-10T00:00:00.000Z", evidence: "Numbers & Control Dashboard v1.", reviewStatus: "approved", reviewedAt: "2026-02-10T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-4", submittedAt: "2026-03-01T00:00:00.000Z", evidence: "Constraint: close rate. Conversion fixed. Profit lever pulled. Follow-up systemised. 90-day plan attached.", reviewStatus: "approved", reviewedAt: "2026-03-02T00:00:00.000Z", reviewedBy: "coach@x.com", coachFeedback: "Concrete and dated — approved." },
  ];
  const constraint: ConstraintData = { areas: [], chosen: "", why: "", relieve: "", stopDoing: "" };
  const driverTree: DriverTree = { outcomeLabel: "Monthly revenue", outcomeTarget: "", drivers: [] };
  const execution: ExecutionData = { goals: [], sprints: [], tasks: [] };
  const inputs: TransformationReportInputs = {
    workspaceId: "ws1", workspaceName: "Acme Co", ownerEmail: "owner@acme.test",
    programme, enrollment, chapterSubmissions, stageAccessLimit: null,
    readiness: { current: 80, label: "strong", start: 30 },
    constraint, driverTree, execution, coachMessages: [],
    generatedAt: "2026-03-05T00:00:00.000Z",
  };

  const report = buildTransformationReport(inputs);
  assert.equal(report.improve.hasData, true);
  assert.ok(report.improve.submittedPlan, "a real chapter-4 submission must populate submittedPlan");
  assert.equal(report.improve.submittedPlan!.state, "approved");
  assert.equal(report.improve.submittedPlan!.coachFeedback, "Concrete and dated — approved.");
  assert.match(report.improve.submittedPlan!.evidence, /90-day plan attached/);
});

// ── DB-integration: the full unlock chain through Chapter 4 to Finish ───────
// Against the REAL default programme (not a synthetic fixture) — proves the
// engine's chapter-4 stage, its 5 modules, and the generic chapter-submissions
// store actually compose end-to-end: Chapter 4 stays locked until Chapter 3 is
// approved, submitting/approving it unlocks Finish, exactly like chapters 1-3.

const PREFIX = uid("chapter-4-test");
const WS_ID = `${PREFIX}-ws`;

after(async () => {
  await pgPool().query("DELETE FROM chapter_submissions WHERE workspace_id = $1", [WS_ID]);
  await pgPool().query("DELETE FROM enrollments WHERE workspace_id = $1", [WS_ID]);
});

test("Chapter 4 end-to-end: locked until Chapter 3 is approved; approving it unlocks Finish", async () => {
  const programme = await getDefaultProgramme();
  const priorStages = ["start", "chapter-1", "chapter-2", "chapter-3"];
  const chapter4Stage = programme.stages.find((s) => s.id === "chapter-4")!;
  assert.equal(chapter4Stage.lessons.length, 5, "Chapter 4 has its 5 canonical subchapters");

  // Every lesson through Chapter 4 is content-complete (approved) — this
  // test drives the CHAPTER-level gate chain, which is the mechanism
  // test/chapter-submissions.test.ts doesn't exercise (it only ever uses the
  // always-unlocked "start" stage).
  const allLessons = [...priorStages, "chapter-4"].flatMap((id) => programme.stages.find((s) => s.id === id)!.lessons);
  const enrollment: Enrollment = {
    id: "e1", programmeId: programme.id, workspaceId: WS_ID, userId: "u1", deliveryMode: "self_paced", startedAt: new Date().toISOString(),
    lessons: allLessons.map((l) => ({ lessonId: l.id, status: "approved" as const, submissions: [] })),
  };
  await pgPool().query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [WS_ID, JSON.stringify(enrollment)],
  );

  // Before Chapter 3 is approved, Chapter 4 must be locked (even though its
  // own lessons are content-complete) — the coach-approval gate, not lesson
  // completion, is what actually opens it.
  let gates = chapterGates(programme, enrollment, [], null);
  assert.equal(gates.find((g) => g.stageId === "chapter-4")!.state, "locked");

  // Walk start -> chapter-3 through submit + approve, in order — each must be
  // approved before the next chapter becomes reachable (addChapterSubmission
  // rejects an unreachable stage; see chapter-submissions.test.ts).
  for (const stageId of priorStages) {
    const submitted = await addChapterSubmission(WS_ID, { stageId, evidence: `${stageId} output` });
    assert.ok(!("error" in submitted), `${stageId} submit: ${"error" in submitted ? submitted.error : ""}`);
    const reviewed = await reviewChapterSubmission(WS_ID, stageId, { reviewStatus: "approved", reviewedBy: "coach@x.com" });
    assert.equal(reviewed, true, `${stageId} should be approvable once submitted`);
  }

  // Chapter 4 is now unlocked (its lessons were already all "approved" above),
  // so its gate should read ready_to_submit.
  const submissionsAfterCh3 = [
    { stageId: "start", submittedAt: "t", evidence: "e", reviewStatus: "approved" as const },
    { stageId: "chapter-1", submittedAt: "t", evidence: "e", reviewStatus: "approved" as const },
    { stageId: "chapter-2", submittedAt: "t", evidence: "e", reviewStatus: "approved" as const },
    { stageId: "chapter-3", submittedAt: "t", evidence: "e", reviewStatus: "approved" as const },
  ];
  gates = chapterGates(programme, enrollment, submissionsAfterCh3, null);
  assert.equal(gates.find((g) => g.stageId === "chapter-4")!.state, "ready_to_submit");
  assert.equal(gates.find((g) => g.stageId === "finish")!.state, "locked", "Finish stays locked until Chapter 4 itself is approved");

  // Submit and approve Chapter 4's own output (the Growth & Improvement Plan).
  const ch4Submit = await addChapterSubmission(WS_ID, { stageId: "chapter-4", evidence: "My Growth & Improvement Plan: constraint, conversion, profit, systemise, 90-day roadmap." });
  assert.ok(!("error" in ch4Submit), "error" in ch4Submit ? ch4Submit.error : "");
  const ch4Review = await reviewChapterSubmission(WS_ID, "chapter-4", { reviewStatus: "approved", reviewedBy: "coach@x.com", coachFeedback: "Great plan." });
  assert.equal(ch4Review, true);

  // Finish is now unlocked — the whole point of Chapter 4 gating the Finish stage.
  const finalSubmissions = await pgPool()
    .query<{ submissions: unknown }>("SELECT submissions FROM chapter_submissions WHERE workspace_id = $1", [WS_ID])
    .then((r) => (r.rows[0]?.submissions as ChapterSubmission[]) ?? []);
  gates = chapterGates(programme, enrollment, finalSubmissions, null);
  const ch4Gate = gates.find((g) => g.stageId === "chapter-4")!;
  assert.equal(ch4Gate.state, "approved");
  assert.equal(ch4Gate.unlocksNext, true);
  assert.equal(gates.find((g) => g.stageId === "finish")!.state, "in_progress", "Finish unlocks once Chapter 4 is approved");
});

// ── v4 migration: Chapter 4 lands additively, cohort pacing shifts exactly ──

// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration = require("../migrations/1788372500000_curriculum-chapter-4-arc.js");

const pool = pgPool();
const pgm = {
  db: {
    query: (sql: string, params?: unknown[]) => pool.query(sql, params),
    select: async (sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows,
  },
};

const MIG_PROG_ID = uid("c4mig-prog");
const MIG_COHORT_EVERYTHING = uid("c4mig-cohort-4");
const MIG_COHORT_PARTIAL = uid("c4mig-cohort-2");

/** A v3 programme: the 20 canonical modules across five stages (no Chapter 4
 *  yet), schemaVersion 3 — exactly what a real pre-v4 install has. Built from
 *  the live default programme's v3-equivalent shape so the fixture can't drift
 *  from what buildCanonicalProgramme() actually authors. */
async function v3ProgrammeFixture(id: string): Promise<ProgrammeTemplate> {
  const live = await getDefaultProgramme();
  const withoutChapter4 = live.stages.filter((s) => s.id !== "chapter-4");
  return {
    id, name: "Test Programme v3", status: "published", schemaVersion: 3, createdAt: "t", updatedAt: "t",
    stages: withoutChapter4.map((s) => (s.id === "finish" ? { ...s, order: 4 } : s)), // finish back at its v3 order
  };
}

test("v4 migration: a v3 curriculum (no Chapter 4) is rebuilt to include it, stamped v4", async () => {
  const fixture = await v3ProgrammeFixture(MIG_PROG_ID);
  await pool.query("INSERT INTO curriculum (id, programme) VALUES ($1, $2)", [MIG_PROG_ID, JSON.stringify(fixture)]);
  try {
    await migration.up(pgm);
    const r = await pool.query<{ programme: ProgrammeTemplate }>("SELECT programme FROM curriculum WHERE id = $1", [MIG_PROG_ID]);
    const migrated = r.rows[0]!.programme;
    assert.equal(migrated.schemaVersion, 4);
    const chapter4 = migrated.stages.find((s) => s.id === "chapter-4");
    assert.ok(chapter4, "chapter-4 stage now exists");
    assert.equal(chapter4!.lessons.length, 5);
    assert.deepEqual(migrated.stages.map((s) => s.id), ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"]);
    assert.equal(migrated.stages.find((s) => s.id === "finish")!.order, 5, "Finish moved to order 5");

    // Idempotent — a second run changes nothing further.
    await migration.up(pgm);
    const r2 = await pool.query<{ programme: ProgrammeTemplate }>("SELECT programme FROM curriculum WHERE id = $1", [MIG_PROG_ID]);
    assert.deepEqual(r2.rows[0]!.programme, migrated);
  } finally {
    await pool.query("DELETE FROM curriculum WHERE id = $1", [MIG_PROG_ID]);
  }
});

test("v4 migration: cohort stage_access_limit is remapped exactly — 4 (old 'everything') becomes 5, lower caps are untouched", async () => {
  const insertCohort = (id: string, cap: number) =>
    pool.query(
      `INSERT INTO cohorts (id, name, start_date, end_date, coach_user_id, coach_email, programme_id, created_at, stage_access_limit)
       VALUES ($1, 'Test Cohort', '2026-01-01', '2026-06-01', 'u1', 'coach@x.com', 'prog', '2026-01-01T00:00:00Z', $2)`,
      [id, cap],
    );
  await insertCohort(MIG_COHORT_EVERYTHING, 4);
  await insertCohort(MIG_COHORT_PARTIAL, 2);
  try {
    await migration.up(pgm);
    const r = await pool.query<{ id: string; stage_access_limit: number }>(
      "SELECT id, stage_access_limit FROM cohorts WHERE id = ANY($1)", [[MIG_COHORT_EVERYTHING, MIG_COHORT_PARTIAL]],
    );
    const byId = Object.fromEntries(r.rows.map((row) => [row.id, row.stage_access_limit]));
    assert.equal(byId[MIG_COHORT_EVERYTHING], 5, "a cohort that could already reach Finish must still be able to after the migration");
    assert.equal(byId[MIG_COHORT_PARTIAL], 2, "a cap below the insertion point is untouched");
  } finally {
    await pool.query("DELETE FROM cohorts WHERE id = ANY($1)", [[MIG_COHORT_EVERYTHING, MIG_COHORT_PARTIAL]]);
  }
});
