import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterSubmission, Enrollment, ProgrammeTemplate } from "@onevyrt/engine";
import {
  buildTransformationReport,
  transformationReportToHtml,
  transformationReportToText,
  type TransformationReportInputs,
} from "../lib/reports/transformation-report";
import type { ConstraintData } from "../lib/constraint";
import type { DriverTree } from "../lib/drivers";
import type { ExecutionData } from "../lib/execution";
import type { Chapter4Submission } from "../lib/chapter4-submissions";

// buildTransformationReport/transformationReportToHtml/transformationReportToText
// are all pure (no DB, no I/O) — only getTransformationReport (not exercised
// here) touches storage — so this whole file runs with no Postgres needed,
// unlike most of this test suite.

/** A minimal 5-stage programme (start/chapter-1/2/3/finish, one lesson
 *  each) — enough shape for chapterGates()/summarizeEnrollment() to compute
 *  real gate states without needing the full canonical curriculum content. */
function fakeProgramme(): ProgrammeTemplate {
  const stageIds = ["start", "chapter-1", "chapter-2", "chapter-3", "finish"];
  return {
    id: "prog-1", name: "Test Programme", status: "published", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    stages: stageIds.map((id, i) => ({
      id, order: i, title: id, outcome: `${id} outcome`,
      lessons: [{ id: `${id}-lesson`, order: 1, title: `${id} lesson`, outcome: "do the thing", content: "" }],
    })),
  };
}

/** Approves every lesson up to (but not including) `uptoStageOrder` — used to
 *  put chapter-3's lesson into "in_progress" (not yet approved) while every
 *  earlier stage is lesson-complete. */
function fakeEnrollment(programme: ProgrammeTemplate, approvedThroughOrder: number): Enrollment {
  const lessons = programme.stages
    .filter((s) => s.order <= approvedThroughOrder)
    .flatMap((s) => s.lessons.map((l) => ({ lessonId: l.id, status: "approved" as const, submissions: [] })));
  return { id: "e1", programmeId: programme.id, workspaceId: "ws1", userId: "u1", deliveryMode: "self_paced", startedAt: "2026-01-02T00:00:00.000Z", lessons };
}

function baseInputs(): TransformationReportInputs {
  const programme = fakeProgramme();
  const enrollment = fakeEnrollment(programme, 2); // start, chapter-1, chapter-2 lesson-complete; chapter-3 not
  const chapterSubmissions: ChapterSubmission[] = [
    { stageId: "start", submittedAt: "2026-01-03T00:00:00.000Z", evidence: "Baseline: $10k/mo, 5 customers.", reviewStatus: "approved", reviewedAt: "2026-01-03T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-1", submittedAt: "2026-01-10T00:00:00.000Z", evidence: "Business Psychology Blueprint v1.", reviewStatus: "approved", reviewedAt: "2026-01-10T01:00:00.000Z", reviewedBy: "coach@x.com", coachFeedback: "Sharp." },
    { stageId: "chapter-2", submittedAt: "2026-01-20T00:00:00.000Z", evidence: "Implemented Business System v1.", reviewStatus: "submitted" },
  ];
  const constraint: ConstraintData = {
    areas: [{ id: "a1", area: "Sales & closing", severity: 4, evidence: "8.2% close rate" }, { id: "a2", area: "Traffic", severity: 2, evidence: "" }],
    chosen: "Sales & closing", why: "Strong leads, poor follow-up.", relieve: "Ship a 24-hour follow-up SOP.", stopDoing: "Paid ads spend increases.",
  };
  const driverTree: DriverTree = { outcomeLabel: "Monthly revenue", outcomeTarget: "$50,000", drivers: [{ id: "d1", label: "Lead → sale conversion", current: "8.2%", target: "12%", note: "" }] };
  const execution: ExecutionData = {
    goals: [{ id: "g1", title: "Lift close rate", metric: "close rate", target: "12%", horizon: "90 days", constraint: "Sales & closing" }],
    sprints: [],
    tasks: [
      { id: "t1", title: "Write follow-up SOP", sprintId: "", goalId: "g1", owner: "Jamie", due: "2026-02-01", status: "todo", weight: 5, definitionOfDone: "SOP published", notes: "" },
      { id: "t2", title: "Old completed task", sprintId: "", goalId: "", owner: "", due: "", status: "done", weight: 1, definitionOfDone: "", notes: "" },
    ],
  };

  return {
    workspaceId: "ws1", workspaceName: "Acme Co", ownerEmail: "owner@acme.test",
    programme, enrollment, chapterSubmissions, stageAccessLimit: null,
    readiness: { current: 72, label: "developing", start: 40 },
    constraint, driverTree, execution, coachMessages: [{ id: "m1", at: "2026-01-25T00:00:00.000Z", fromEmail: "coach@x.com", fromName: "Coach Kim", body: "Great progress this week.", read: true }],
    generatedAt: "2026-02-01T12:00:00.000Z",
  };
}

/** A structured Chapter 4 Growth & Improvement Plan (lib/chapter4-submissions.ts) —
 *  the same numbers the roadmap's own worked example uses (100 leads, 8.2% ->
 *  12%, "+46% revenue potential"), so calculateImpactProjection's real
 *  arithmetic is exercised, not a made-up figure. Defaults to "submitted"
 *  (not yet coach-approved); pass status/coachDecision/reviewedAt/reviewedBy
 *  overrides to represent an approved plan. */
function fakeGrowthPlanSubmission(overrides: Partial<Chapter4Submission> = {}): Chapter4Submission {
  return {
    id: "gp1", workspaceId: "ws1", status: "submitted",
    data: {
      currentPosition: { monthlyRevenue: 10000, conversionRatePct: 8.2 },
      bottleneck: { area: "Lead follow-up speed", currentValue: 8.2, targetValue: 12, why: "Leads go cold after 24 hours." },
      actions: [
        { title: "Ship a 24-hour follow-up SOP", expectedImpact: "Recover cold leads" },
        { title: "Add a second follow-up call" },
      ],
      impact: { leadVolume: 100 },
      completedSubchapters: ["4.1", "4.2", "4.3", "4.4", "4.5"],
    },
    submittedAt: "2026-01-26T00:00:00.000Z",
    submittedBy: "learner@acme.test",
    updatedAt: "2026-01-26T00:00:00.000Z",
    ...overrides,
  };
}

test("buildTransformationReport: journey covers start/chapter-1/2/3 with the right headings and gate-derived narrative", () => {
  const report = buildTransformationReport(baseInputs());
  assert.equal(report.journey.length, 4);
  assert.deepEqual(report.journey.map((j) => j.stageId), ["start", "chapter-1", "chapter-2", "chapter-3"]);
  assert.deepEqual(report.journey.map((j) => j.heading), ["Where You Started", "What You Defined", "What You Built", "What You Can Now Measure"]);

  const [start, ch1, ch2, ch3] = report.journey;
  assert.ok(start && ch1 && ch2 && ch3);
  assert.equal(start.state, "approved");
  assert.equal(start.narrative, "Baseline: $10k/mo, 5 customers.");
  assert.equal(start.approvedAt, "2026-01-03T01:00:00.000Z");

  assert.equal(ch1.state, "approved");
  assert.equal(ch1.narrative, "Business Psychology Blueprint v1.");

  assert.equal(ch2.state, "awaiting_review");
  assert.equal(ch2.narrative, "Implemented Business System v1.");

  // chapter-2 is only awaiting review, not yet coach-approved — sequential
  // chapter gating (packages/engine/src/chapter-gates.ts) correctly keeps
  // chapter-3 locked regardless of its own lesson progress, and the
  // narrative says so in plain language rather than being blank.
  assert.equal(ch3.state, "locked");
  assert.match(ch3.narrative, /not reached yet/i);
});

test("buildTransformationReport: readiness delta is current minus start", () => {
  const report = buildTransformationReport(baseInputs());
  assert.equal(report.readiness.start, 40);
  assert.equal(report.readiness.current, 72);
  assert.equal(report.readiness.delta, 32);
});

test("buildTransformationReport: account status is in_progress until the finish chapter is approved", () => {
  const report = buildTransformationReport(baseInputs());
  assert.equal(report.account.status, "in_progress");
  assert.equal(report.account.completedAt, null);

  const withFinish = baseInputs();
  withFinish.chapterSubmissions = [
    ...withFinish.chapterSubmissions,
    // A later, approved chapter-2 resubmission — latestSubmissionFor() picks
    // this one over baseInputs()'s still-"submitted" original, which is what
    // actually unlocks chapter-3 in the real sequential-gating rule.
    { stageId: "chapter-2", submittedAt: "2026-01-22T00:00:00.000Z", evidence: "Implemented Business System v2.", reviewStatus: "approved", reviewedAt: "2026-01-22T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "chapter-3", submittedAt: "2026-01-28T00:00:00.000Z", evidence: "Numbers dashboard v1.", reviewStatus: "approved", reviewedAt: "2026-01-28T01:00:00.000Z", reviewedBy: "coach@x.com" },
    { stageId: "finish", submittedAt: "2026-02-01T00:00:00.000Z", evidence: "Score 40 -> 72. Next: fix follow-up.", reviewStatus: "approved", reviewedAt: "2026-02-01T02:00:00.000Z", reviewedBy: "coach@x.com" },
  ];
  // Every lesson (including chapter-3's and finish's) now approved too, so
  // every gate in the chain can actually reach "approved".
  withFinish.enrollment = fakeEnrollment(withFinish.programme, 4);
  const done = buildTransformationReport(withFinish);
  assert.equal(done.account.status, "complete");
  assert.equal(done.account.completedAt, "2026-02-01T02:00:00.000Z");
  // The Finish chapter's own free-text reflection feeds Next 90 Days.
  assert.equal(done.next90.learnerReflection, "Score 40 -> 72. Next: fix follow-up.");
});

test("buildTransformationReport: What You Will Improve compiles the bottleneck, its context, and driver-tree metrics", () => {
  const report = buildTransformationReport(baseInputs());
  const { improve } = report;
  assert.equal(improve.hasData, true);
  assert.ok(improve.bottleneck);
  assert.equal(improve.bottleneck?.area, "Sales & closing");
  assert.equal(improve.bottleneck?.severity, 4);
  assert.equal(improve.bottleneck?.why, "Strong leads, poor follow-up.");
  assert.equal(improve.bottleneck?.relieve, "Ship a 24-hour follow-up SOP.");
  assert.deepEqual(improve.otherAreas, [{ area: "Traffic", severity: 2 }]);
  assert.equal(improve.metrics.length, 1);
  assert.deepEqual(improve.metrics[0], { label: "Lead → sale conversion", current: "8.2%", target: "12%" });
  assert.equal(improve.submittedPlan, null);
});

test("buildTransformationReport: a real chapter-4 submission is preferred as the Growth Plan narrative, forward-compatible with no dedicated stage yet", () => {
  const input = baseInputs();
  input.chapterSubmissions = [...input.chapterSubmissions, {
    stageId: "chapter-4", submittedAt: "2026-01-26T00:00:00.000Z",
    evidence: "Growth & Improvement Plan: fix follow-up, then raise price 10%.",
    reviewStatus: "approved", reviewedAt: "2026-01-27T00:00:00.000Z", reviewedBy: "coach@x.com", coachFeedback: "Approved — go.",
  }];
  const report = buildTransformationReport(input);
  assert.ok(report.improve.submittedPlan);
  assert.equal(report.improve.submittedPlan?.evidence, "Growth & Improvement Plan: fix follow-up, then raise price 10%.");
  assert.equal(report.improve.submittedPlan?.coachFeedback, "Approved — go.");
  assert.equal(report.improve.narrative, "Growth & Improvement Plan: fix follow-up, then raise price 10%.");
});

test("buildTransformationReport: an approved structured Growth Plan is the primary source for Improve + Next 90, over both the constraint tool and the free-text evidence blob", () => {
  const input = baseInputs();
  // Also present: an approved chapter-4 evidence-blob submission (tier 2) —
  // proves tier 1 (the structured plan) wins over it, not just over tier 3.
  input.chapterSubmissions = [...input.chapterSubmissions, {
    stageId: "chapter-4", submittedAt: "2026-01-26T00:00:00.000Z",
    evidence: "Growth & Improvement Plan: fix follow-up, then raise price 10%.",
    reviewStatus: "approved", reviewedAt: "2026-01-27T00:00:00.000Z", reviewedBy: "coach@x.com",
  }];
  input.growthPlanSubmission = fakeGrowthPlanSubmission({
    status: "approved", coachDecision: "approved", coachFeedback: "Approved — go.",
    reviewedAt: "2026-01-28T00:00:00.000Z", reviewedBy: "coach@x.com",
  });
  const report = buildTransformationReport(input);

  // Improve: the plan's own bottleneck + metrics, not the constraint tool's
  // "Sales & closing" / the Driver Tree's "Lead -> sale conversion".
  assert.equal(report.improve.bottleneck?.area, "Lead follow-up speed");
  assert.equal(report.improve.bottleneck?.severity, null); // no 1-10 score in this model
  assert.match(report.improve.bottleneck!.why, /Leads go cold after 24 hours\./);
  assert.match(report.improve.bottleneck!.why, /Currently 8\.2%, targeting 12%\./);
  assert.equal(report.improve.bottleneck?.relieve, "Ship a 24-hour follow-up SOP");
  assert.deepEqual(report.improve.otherAreas, []);
  assert.ok(report.improve.metrics.some((m) => m.label === "Lead follow-up speed" && m.current === "8.2%" && m.target === "12%"));
  assert.ok(report.improve.metrics.some((m) => m.label === "Monthly revenue" && m.current === "£10,000"));
  assert.match(report.improve.narrative, /Lead follow-up speed/);
  assert.doesNotMatch(report.improve.narrative, /raise price 10%/); // the tier-2 evidence text no longer wins

  // Next 90: the plan's own actions + impact-derived milestone, not
  // execution.tasks/goals.
  assert.deepEqual(report.next90.actions.map((a) => a.title), ["Ship a 24-hour follow-up SOP", "Add a second follow-up call"]);
  assert.equal(report.next90.milestones.length, 1);
  assert.match(report.next90.milestones[0]!.title, /Lead follow-up speed/);
  assert.match(report.next90.milestones[0]!.impact, /\+46% projected uplift/);
});

test("buildTransformationReport: a not-yet-approved structured Growth Plan does not override the Business-OS fallback", () => {
  const input = baseInputs();
  input.growthPlanSubmission = fakeGrowthPlanSubmission(); // status: "submitted" — awaiting coach review
  const report = buildTransformationReport(input);
  assert.equal(report.improve.bottleneck?.area, "Sales & closing");
  assert.equal(report.next90.actions[0]!.title, "Write follow-up SOP");
});

test("buildTransformationReport: Next 90 Days surfaces open (not done) actions, goals as milestones, and derived success criteria", () => {
  const report = buildTransformationReport(baseInputs());
  const { next90 } = report;
  assert.equal(next90.hasData, true);
  assert.equal(next90.actions.length, 1, "the already-done task must not appear as a next action");
  assert.equal(next90.actions[0]!.title, "Write follow-up SOP");
  assert.equal(next90.actions[0]!.status, "todo");
  assert.equal(next90.milestones.length, 1);
  assert.equal(next90.milestones[0]!.impact, "Move close rate to 12% by 90 days.");
  assert.deepEqual(next90.successCriteria, ["close rate reaches 12% by 90 days."]);
  assert.equal(new Date(next90.windowEnd).getTime() - new Date(next90.windowStart).getTime(), 90 * 24 * 3600 * 1000);
});

test("buildTransformationReport: Tier 2 — the primary project's ForceActionItems/GoalNode feed Next 90 Days when there's no approved plan and the Execution tool is empty", () => {
  const input = baseInputs();
  input.execution = { goals: [], sprints: [], tasks: [] }; // nothing in Business OS -> Execution
  input.primaryForceActions = [
    { id: "fa1", force: 1, principle: "Know your numbers", actionItem: "Ship the follow-up SOP", status: "open", priority: "high", dollarValue: 50000, owner: "Jamie", deadline: "2026-02-01", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "fa2", force: 2, principle: "Fix the leak", actionItem: "Lower the price", status: "done", priority: "low", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  input.primaryGoals = [
    { id: "g1", level: "quarterly", title: "Grow MRR", status: "on_track", targetValue: 20000, actualValue: 15000, unit: "$", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const report = buildTransformationReport(input);
  assert.equal(report.next90.actions.length, 1, "the already-done force action must not appear as a next action");
  assert.equal(report.next90.actions[0]!.title, "Ship the follow-up SOP");
  assert.equal(report.next90.actions[0]!.owner, "Jamie");
  assert.equal(report.next90.actions[0]!.due, "2026-02-01");
  assert.equal(report.next90.actions[0]!.status, "todo");
  assert.equal(report.next90.milestones.length, 1);
  assert.equal(report.next90.milestones[0]!.title, "Grow MRR");
  assert.match(report.next90.milestones[0]!.impact, /Currently at 15000/);
});

test("buildTransformationReport: Tier 2 yields to Tier 3 (Execution tool) per-field — a learner using both systems gets the richer one for each", () => {
  const input = baseInputs(); // has real execution.tasks/goals (see baseInputs)
  input.primaryForceActions = []; // nothing in the 7 Systems
  input.primaryGoals = []; // nothing in the Goal Hierarchy
  const report = buildTransformationReport(input);
  // Falls through to the Execution-tool data, unchanged from the
  // non-Tier-2 test above.
  assert.equal(report.next90.actions[0]!.title, "Write follow-up SOP");
  assert.equal(report.next90.milestones[0]!.title, "Lift close rate");
});

test("buildTransformationReport: an approved structured Growth Plan still wins over Tier 2 force actions/goals", () => {
  const input = baseInputs();
  input.growthPlanSubmission = fakeGrowthPlanSubmission({ status: "approved", reviewedAt: "2026-01-27T00:00:00.000Z", reviewedBy: "coach@x.com" });
  input.primaryForceActions = [
    { id: "fa1", force: 1, principle: "P", actionItem: "Should not appear", status: "open", priority: "high", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const report = buildTransformationReport(input);
  assert.deepEqual(report.next90.actions.map((a) => a.title), ["Ship a 24-hour follow-up SOP", "Add a second follow-up call"]);
});

test("buildTransformationReport: achievements summarise progress, approvals, readiness movement and the named constraint", () => {
  const report = buildTransformationReport(baseInputs());
  assert.deepEqual(report.achievements, [
    "Completed 3 of 5 modules (60%).",
    "2 of 4 chapters approved by your coach.",
    "Readiness Score rose from 40 to 72 (+32).",
    "Identified your #1 growth constraint: Sales & closing.",
    "Set 1 goal for your next 90 days.",
  ]);
});

test("buildTransformationReport: an empty workspace degrades to honest, non-broken placeholder copy", () => {
  const programme = fakeProgramme();
  const enrollment = fakeEnrollment(programme, -1); // nothing approved yet
  const report = buildTransformationReport({
    workspaceId: "ws2", workspaceName: "Empty Co", ownerEmail: "",
    programme, enrollment, chapterSubmissions: [], stageAccessLimit: null,
    readiness: { current: null, label: "no_data", start: null },
    constraint: { areas: [], chosen: "", why: "", relieve: "", stopDoing: "" },
    driverTree: { outcomeLabel: "Monthly revenue", outcomeTarget: "", drivers: [] },
    execution: { goals: [], sprints: [], tasks: [] },
    coachMessages: [],
  });
  assert.equal(report.improve.hasData, false);
  assert.match(report.improve.narrative, /haven't identified/i);
  assert.equal(report.next90.hasData, false);
  assert.match(report.next90.narrative, /Business OS/);
  // A real programme always has at least the raw progress line — the
  // "just getting started" fallback only covers a programme with zero
  // lessons, which never happens with the real curriculum.
  assert.deepEqual(report.achievements, ["Completed 0 of 5 modules (0%)."]);
  // Every journey step still renders a plain-language status, never blank.
  for (const step of report.journey) assert.ok(step.narrative.length > 0);
});

test("transformationReportToHtml and transformationReportToText: render without throwing and carry the report's key facts", () => {
  const report = buildTransformationReport(baseInputs());
  const html = transformationReportToHtml(report);
  assert.match(html, /Acme Co/);
  assert.match(html, /Sales &amp; closing/);
  assert.match(html, /Your Next 90 Days/);
  assert.doesNotMatch(html, /<script/i);

  const text = transformationReportToText(report);
  assert.match(text, /YOUR TRANSFORMATION JOURNEY/);
  assert.match(text, /WHAT YOU WILL IMPROVE/);
  assert.match(text, /YOUR NEXT 90 DAYS/);
  assert.match(text, /Write follow-up SOP/);
});
