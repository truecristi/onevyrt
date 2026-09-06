/**
 * The Transformation Report — the programme's closing artifact. Compiles a
 * learner's whole journey (baseline → defined → built → measured) plus the
 * two Chapter 4 (IMPROVE & SCALE) additions — "What You Will Improve" and
 * "Your Next 90 Days" — into one narrative document, the same way
 * packages/engine/src/report.ts's buildReport() assembles a self-describing
 * FunnelReport from the engine's other pure pieces.
 *
 * Chapter 4 (IMPROVE & SCALE — bottleneck → conversion → profit → systemise
 * → growth plan) is now a canonical curriculum stage
 * (packages/engine/src/curriculum-chapters.ts, CURRICULUM_SCHEMA_VERSION 4).
 * "What You Will Improve" and "Your Next 90 Days" are compiled from a
 * three-tier strategy, each tier strictly preferred over the next:
 *   1. First priority: the structured, coach-APPROVED Growth & Improvement
 *      Plan itself (lib/chapter4-submissions.ts's Chapter4Submission, via
 *      lib/growth-plan-utils.ts's formatPlan()) — the real bottleneck rates,
 *      current-position metrics, prioritised actions and impact projection
 *      the learner entered and a coach signed off through the dedicated
 *      Chapter 4 subchapters (4.1–4.5). See bottleneckFromPlan()/
 *      metricsFromPlan()/actionsFromPlan()/milestonesFromPlan() below.
 *   2. Narrative-only fallback: a submitted "chapter-4" ChapterSubmission's
 *      free-text evidence (the OLDER, decoupled generic evidence-blob model —
 *      see findGrowthChapterSubmission() below) — used only for the
 *      narrative line, when no approved structured plan exists yet.
 *   3. Final fallback: the Business-OS tools that implement Chapter 4's ideas
 *      with workspace-scoped data (constraint engine, key drivers, execution
 *      plan):
 *        - lib/constraint.ts   → the bottleneck and relief move (Chapter 4.1)
 *        - lib/drivers.ts      → current vs. target metrics (Chapter 4.2/4.3)
 *        - lib/execution.ts    → next 90-day actions & impact (Chapter 4.5)
 *      This fallback preserves reporting for learners on older curricula
 *      (pre-chapter-4 migrations) and self-paced tracks with no formal submissions.
 *
 * Two output forms, both derived from the same TransformationReport so the
 * screen, the PDF, the emailed copy and the shared link can never disagree:
 *   - transformationReportToHtml() — a static HTML snapshot (mirrors
 *     components/studio/ReportPanels.tsx's reportToHtml()), used for the
 *     24-hour share link.
 *   - transformationReportToText() — a plain-text rendering for email
 *     (lib/mailer.ts's MailMessage is text-only, like every other
 *     transactional email this app sends).
 *
 * Pure builder (buildTransformationReport) + a thin async orchestrator
 * (getTransformationReport) that wires it to storage — the same split
 * lib/programme-business-snapshot.ts uses ("no new computation, just wiring
 * already-built functions").
 */
import {
  chapterGates,
  summarizeEnrollment,
  rootGoals,
  CANONICAL_STAGES,
  LEGACY_STAGE_ID,
  type ChapterGate,
  type ChapterGateState,
  type ChapterSubmission,
  type Enrollment,
  type ProgrammeTemplate,
  type ReadinessLabel,
  type ForceActionItem,
  type GoalNode,
} from "@onevyrt/engine";
import { getDefaultProgramme } from "../curriculum-store";
import { getOrCreateEnrollment, ensureReadinessBaseline } from "../enrollments";
import { listChapterSubmissions } from "../chapter-submissions";
import { effectiveStageAccessLimit } from "../cohorts";
import { getBusinessSnapshot } from "../programme-business-snapshot";
import { pickPrimaryProject } from "../studio/primary-project";
import { getWorkspace } from "../workspaces";
import { getUserById } from "../auth";
import { getConstraint, type ConstraintData } from "../constraint";
import { getDriverTree, type DriverTree } from "../drivers";
import { getExecution, type ExecutionData, type ExecTask, type ExecGoal } from "../execution";
import { listLearnerMessages, type LearnerMessage } from "../coach/messages";
import { getChapter4Submission, type Chapter4Submission } from "../chapter4-submissions";
import { formatPlan, formatCurrency, formatPercent, type GrowthPlan } from "../growth-plan-utils";

// ── Report shape ──────────────────────────────────────────────────────────

export interface TransformationReportAccount {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  programmeName: string;
  generatedAt: string;
  /** When the whole arc (the "finish" chapter) was coach-approved, or null
   *  while the journey is still in progress. */
  completedAt: string | null;
  status: "in_progress" | "complete";
  overallPercent: number;
  completedLessons: number;
  totalLessons: number;
}

export interface ReadinessComparison {
  start: number | null;
  current: number | null;
  label: ReadinessLabel;
  /** current - start, only when both are known. */
  delta: number | null;
}

/** One card of "Your Transformation Journey": Where You Started → What You
 *  Defined → What You Built → What You Can Now Measure. */
export interface JourneyStep {
  stageId: string;
  heading: string;
  stageTitle: string;
  /** The permanent artifact this chapter compiles toward (e.g. "Business
   *  Psychology Blueprint"), from the engine's canonical stage metadata. */
  outputName: string;
  state: ChapterGateState;
  /** The learner's submitted evidence for this chapter, verbatim — the
   *  actual artifact text — or a plain-language status line while there's
   *  nothing submitted yet. */
  narrative: string;
  approvedAt: string | null;
  coachFeedback: string | null;
  lessonsComplete: number;
  lessonsTotal: number;
}

export interface ImprovementMetric {
  label: string;
  current: string;
  target: string;
  note?: string;
}

export interface Bottleneck {
  area: string;
  severity: number | null;
  why: string;
  relieve: string;
  stopDoing: string;
}

/** "What You Will Improve" — Chapter 4's Growth & Improvement Plan. */
export interface WhatYouWillImprove {
  hasData: boolean;
  bottleneck: Bottleneck | null;
  /** The other scored areas, worst first, for context under the bottleneck. */
  otherAreas: { area: string; severity: number }[];
  metrics: ImprovementMetric[];
  /** Set only when a real Chapter 4 (or admin-added growth-themed) chapter
   *  submission exists — the coach-reviewed Growth & Improvement Plan output,
   *  once that curriculum stage exists. */
  submittedPlan: { evidence: string; state: ChapterGateState; coachFeedback: string | null } | null;
  narrative: string;
}

export interface NextStepAction {
  title: string;
  owner: string;
  due: string;
  status: ExecTask["status"];
  definitionOfDone: string;
}

export interface Milestone {
  title: string;
  metric: string;
  target: string;
  horizon: string;
  impact: string;
}

/** "Your Next 90 Days" — actions + milestones + success criteria. */
export interface Next90Days {
  hasData: boolean;
  windowStart: string;
  windowEnd: string;
  actions: NextStepAction[];
  milestones: Milestone[];
  successCriteria: string[];
  /** The learner's own written next-90-day focus from the Finish chapter's
   *  submission, if they've reached and submitted it. */
  learnerReflection: string | null;
  narrative: string;
}

export interface TransformationReport {
  account: TransformationReportAccount;
  readiness: ReadinessComparison;
  journey: JourneyStep[];
  improve: WhatYouWillImprove;
  next90: Next90Days;
  achievements: string[];
  /** Most recent coach messages, oldest concern first — folded in as light
   *  supporting context, never the report's main content. Capped small. */
  recentCoachNotes: { at: string; fromName: string; body: string }[];
}

// ── Inputs the pure builder needs (already fetched by the caller) ─────────

export interface TransformationReportInputs {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  programme: ProgrammeTemplate;
  enrollment: Enrollment;
  chapterSubmissions: readonly ChapterSubmission[];
  stageAccessLimit: number | null;
  readiness: { current: number | null; label: ReadinessLabel; start: number | null };
  constraint: ConstraintData;
  driverTree: DriverTree;
  execution: ExecutionData;
  coachMessages: readonly LearnerMessage[];
  /** The structured Chapter 4 Growth & Improvement Plan (lib/chapter4-submissions.ts),
   *  independent of the generic evidence-blob chapterSubmissions above. When
   *  its status is "approved", buildImprove()/buildNext90() prefer its real
   *  bottleneck/metrics/actions/impact over the Business-OS fallback tools —
   *  see the module doc comment's two-tier strategy. Optional so existing
   *  callers/tests that predate this field keep compiling with the fallback
   *  behavior unchanged. */
  growthPlanSubmission?: Chapter4Submission | null;
  /** Tier 2 (between the approved Growth Plan and the Execution-tool
   *  fallback): the primary project's 7 Systems action items / Goal
   *  Hierarchy, so a learner who plans there — not in Business OS →
   *  Execution — isn't invisible to their own closing report. From
   *  lib/studio/primary-project.ts's pickPrimaryProject(); optional so
   *  existing callers/tests that predate this field keep compiling with
   *  the fallback behavior unchanged. */
  primaryForceActions?: readonly ForceActionItem[];
  primaryGoals?: readonly GoalNode[];
  generatedAt?: string;
}

const JOURNEY_STAGE_IDS = ["start", "chapter-1", "chapter-2", "chapter-3"] as const;
const JOURNEY_HEADINGS: Readonly<Record<string, string>> = Object.freeze({
  start: "Where You Started",
  "chapter-1": "What You Defined",
  "chapter-2": "What You Built",
  "chapter-3": "What You Can Now Measure",
});
const STAGE_META = new Map(CANONICAL_STAGES.map((s) => [s.id, s] as const));
const KNOWN_STAGE_IDS = new Set<string>([...CANONICAL_STAGES.map((s) => s.id), LEGACY_STAGE_ID]);
const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;
const MAX_ACTIONS = 5;
const MAX_MILESTONES = 5;
const MAX_COACH_NOTES = 3;

function latestSubmissionFor(subs: readonly ChapterSubmission[], stageId: string): ChapterSubmission | undefined {
  let latest: ChapterSubmission | undefined;
  for (const s of subs) {
    if (s.stageId !== stageId) continue;
    if (!latest || s.submittedAt >= latest.submittedAt) latest = s;
  }
  return latest;
}

/** Looks for a real Chapter 4 output: an exact "chapter-4" stage submission
 *  first, else any submission on a stage this report doesn't already know
 *  about whose id reads as growth/improvement-themed (an admin-added stage
 *  ahead of a dedicated Chapter 4 curriculum landing). Returns the latest
 *  submission on whichever stage id is found. */
function findGrowthChapterSubmission(subs: readonly ChapterSubmission[]): ChapterSubmission | null {
  const exact = latestSubmissionFor(subs, "chapter-4");
  if (exact) return exact;
  const candidateIds = new Set(
    subs.map((s) => s.stageId).filter((id) => !KNOWN_STAGE_IDS.has(id) && /chapter.?4|growth|improve|bottleneck/i.test(id)),
  );
  for (const id of candidateIds) {
    const latest = latestSubmissionFor(subs, id);
    if (latest) return latest;
  }
  return null;
}

function stageStatusNarrative(gate: ChapterGate | undefined, coachFeedback: string | undefined): string {
  if (!gate) return "This chapter isn't part of your current curriculum.";
  switch (gate.state) {
    case "locked":
      return "Not reached yet — finish the chapter before this one first.";
    case "in_progress":
      return gate.lessonsTotal > 0
        ? `In progress — ${gate.lessonsComplete} of ${gate.lessonsTotal} modules complete.`
        : "In progress.";
    case "ready_to_submit":
      return "All modules complete — ready to submit for coach review.";
    case "awaiting_review":
      return "Submitted — awaiting your coach's review.";
    case "changes_requested":
      return coachFeedback ? `Your coach asked for changes: ${coachFeedback}` : "Your coach asked for changes before this counts as done.";
    case "approved":
      return "Approved, with no evidence on file.";
    default:
      return "";
  }
}

function buildJourney(programme: ProgrammeTemplate, gates: readonly ChapterGate[]): JourneyStep[] {
  const gateByStage = new Map(gates.map((g) => [g.stageId, g] as const));
  return JOURNEY_STAGE_IDS.map((stageId) => {
    const gate = gateByStage.get(stageId);
    const meta = STAGE_META.get(stageId);
    const stage = programme.stages.find((s) => s.id === stageId);
    const submission = gate?.submission;
    const narrative = submission?.evidence?.trim() || stageStatusNarrative(gate, submission?.coachFeedback);
    return {
      stageId,
      heading: JOURNEY_HEADINGS[stageId] ?? stageId,
      stageTitle: stage?.title ?? meta?.title ?? stageId,
      outputName: meta?.output ?? gate?.output ?? "",
      state: gate?.state ?? "locked",
      narrative,
      approvedAt: submission?.reviewStatus === "approved" ? submission.reviewedAt ?? null : null,
      coachFeedback: submission?.coachFeedback ?? null,
      lessonsComplete: gate?.lessonsComplete ?? 0,
      lessonsTotal: gate?.lessonsTotal ?? 0,
    };
  });
}

/** Tier 3 fallback: the bottleneck as named in the Business-OS constraint
 *  tool (lib/constraint.ts) — used only when no approved structured Growth
 *  Plan exists. */
function bottleneckFromConstraint(constraint: ConstraintData): Bottleneck | null {
  if (!constraint.chosen.trim()) return null;
  const chosenArea = constraint.areas.find((a) => a.area === constraint.chosen);
  return {
    area: constraint.chosen,
    severity: chosenArea?.severity ?? null,
    why: constraint.why.trim() || "Not documented yet.",
    relieve: constraint.relieve.trim() || "Not documented yet.",
    stopDoing: constraint.stopDoing.trim(),
  };
}

/** Tier 1 (primary) source: the bottleneck as named in the coach-approved,
 *  structured Growth & Improvement Plan itself (Chapter 4.1/4.5) — real
 *  current/target rates instead of a 1-10 severity score, and the plan's own
 *  top action as the "relieve" move. Null bottleneck.area means the plan
 *  exists but never named one — treated the same as "no bottleneck", never
 *  silently patched from the unrelated constraint tool. */
function bottleneckFromPlan(plan: GrowthPlan): Bottleneck | null {
  const b = plan.bottleneck;
  if (!b?.area) return null;
  const hasRates = b.currentValue !== undefined && b.targetValue !== undefined;
  return {
    area: b.area,
    severity: null,
    why: (b.why?.trim() || "Not documented yet.") + (hasRates ? ` Currently ${formatPercent(b.currentValue)}, targeting ${formatPercent(b.targetValue)}.` : ""),
    relieve: plan.actions[0]?.title || "Not documented yet.",
    stopDoing: "",
  };
}

/** Tier 1 metrics: the plan's own current-position numbers plus the named
 *  bottleneck's current→target rate (surfaced first, since it's the plan's
 *  headline number) — a genuinely different data source from the Driver
 *  Tree, so never mixed with it. */
function metricsFromPlan(plan: GrowthPlan): ImprovementMetric[] {
  const out: ImprovementMetric[] = [];
  const cp = plan.currentPosition;
  if (cp.monthlyRevenue !== undefined) out.push({ label: "Monthly revenue", current: formatCurrency(cp.monthlyRevenue), target: "—" });
  if (cp.grossMarginPct !== undefined) out.push({ label: "Gross margin", current: formatPercent(cp.grossMarginPct), target: "—" });
  if (cp.conversionRatePct !== undefined) out.push({ label: "Conversion rate", current: formatPercent(cp.conversionRatePct), target: "—" });
  if (cp.avgCustomerValue !== undefined) out.push({ label: "Avg. customer value", current: formatCurrency(cp.avgCustomerValue), target: "—" });
  const b = plan.bottleneck;
  if (b?.area && b.currentValue !== undefined && b.targetValue !== undefined) {
    out.unshift({
      label: b.area,
      current: formatPercent(b.currentValue),
      target: formatPercent(b.targetValue),
      ...(plan.impact ? { note: `${formatPercent(plan.impact.upliftPct, { signed: true })} projected impact` } : {}),
    });
  }
  return out;
}

function buildImprove(constraint: ConstraintData, driverTree: DriverTree, growthSubmission: ChapterSubmission | null, growthGateState: ChapterGateState | null, approvedPlan: GrowthPlan | null): WhatYouWillImprove {
  const planBottleneck = approvedPlan ? bottleneckFromPlan(approvedPlan) : null;
  const bottleneck = planBottleneck ?? bottleneckFromConstraint(constraint);
  // The structured plan tracks one named bottleneck, not a scored list of
  // areas — there's no equivalent to show as "other areas" once it's primary.
  const otherAreas = approvedPlan
    ? []
    : constraint.areas
        .filter((a) => a.area !== constraint.chosen && a.severity > 0)
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 5)
        .map((a) => ({ area: a.area, severity: a.severity }));
  const metrics: ImprovementMetric[] = approvedPlan
    ? metricsFromPlan(approvedPlan)
    : driverTree.drivers
        .filter((d) => d.label.trim() || d.current.trim() || d.target.trim())
        .map((d) => ({ label: d.label.trim() || "Driver", current: d.current.trim() || "—", target: d.target.trim() || "—", ...(d.note.trim() ? { note: d.note.trim() } : {}) }));
  const submittedPlan = growthSubmission
    ? { evidence: growthSubmission.evidence, state: growthGateState ?? (growthSubmission.reviewStatus === "approved" ? "approved" : growthSubmission.reviewStatus === "changes_requested" ? "changes_requested" : "awaiting_review") as ChapterGateState, coachFeedback: growthSubmission.coachFeedback ?? null }
    : null;

  const hasData = bottleneck !== null || metrics.length > 0 || submittedPlan !== null;
  let narrative: string;
  if (planBottleneck) {
    narrative = `Your biggest growth constraint right now is ${planBottleneck.area}. ${planBottleneck.why}`;
  } else if (submittedPlan) {
    narrative = submittedPlan.evidence;
  } else if (bottleneck) {
    narrative = `Your biggest growth constraint right now is ${bottleneck.area}. ${bottleneck.why}`;
  } else {
    narrative = "You haven't identified your biggest growth constraint yet — head to Business OS → Growth Constraint to name the bottleneck holding you back, then set current-vs-target metrics in the Driver Tree.";
  }

  return { hasData, bottleneck, otherAreas, metrics, submittedPlan, narrative };
}

function impactOf(goal: ExecGoal): string {
  if (goal.metric.trim() && goal.target.trim()) return `Move ${goal.metric.trim()} to ${goal.target.trim()}${goal.horizon.trim() ? ` by ${goal.horizon.trim()}` : ""}.`;
  if (goal.constraint.trim()) return `Attacks: ${goal.constraint.trim()}.`;
  return "";
}

/** Tier 1 actions: the plan's own prioritised action list (Chapter 4.5) —
 *  it doesn't track owner/due-date/status like the Execution tool's tasks
 *  do, so those render as "not set" rather than being invented. */
function actionsFromPlan(plan: GrowthPlan): NextStepAction[] {
  return plan.actions.slice(0, MAX_ACTIONS).map((a) => ({ title: a.title, owner: "", due: "", status: "todo", definitionOfDone: a.expectedImpact ?? "" }));
}

/** Tier 1 milestone: the plan's own impact projection (bottleneck rate ×
 *  lead volume, from lib/growth-plan-utils.ts's calculateImpactProjection),
 *  when the plan has enough filled in to compute one. */
function milestoneFromPlan(plan: GrowthPlan): Milestone[] {
  const { impact, bottleneck } = plan;
  if (!impact || !bottleneck?.area) return [];
  return [{
    title: `Improve ${bottleneck.area}`,
    metric: bottleneck.area,
    target: formatPercent(impact.targetRatePct),
    horizon: "90 days",
    impact: `${formatPercent(impact.upliftPct, { signed: true })} projected uplift (${impact.currentUnits} → ${impact.targetUnits} across ${impact.leadVolume} leads).`,
  }];
}

/** Maps ForceActionItem's ActionStatus (open|in_progress|done) onto
 *  ExecTask's TaskStatus (todo|doing|blocked|done) — a force action never
 *  produces "blocked", which only the Execution tool's tasks track. */
function forceActionStatus(status: ForceActionItem["status"]): ExecTask["status"] {
  return status === "in_progress" ? "doing" : status === "done" ? "done" : "todo";
}

/** Tier 2 actions: the primary project's 7 Systems action items, ranked by
 *  dollar value — the same top-by-dollar-value precedence
 *  packages/engine/src/program.ts's buildTransformationBrief() already
 *  established for this exact data. Tried only when there's no approved
 *  plan; still yields to the Execution tool's own tasks below if empty. */
function actionsFromForceActions(items: readonly ForceActionItem[]): NextStepAction[] {
  return [...items]
    .filter((fa) => fa.status !== "done")
    .sort((a, b) => (b.dollarValue ?? 0) - (a.dollarValue ?? 0))
    .slice(0, MAX_ACTIONS)
    .map((fa) => ({ title: fa.actionItem, owner: fa.owner ?? "", due: fa.deadline ?? "", status: forceActionStatus(fa.status), definitionOfDone: fa.principle }));
}

/** Tier 2 milestones: the primary project's root-level Goal Hierarchy
 *  entries (rootGoals() — the same roll-up readiness.ts/programme-business-
 *  snapshot.ts already use for "top goal"), when the Execution tool has no
 *  goals of its own. */
function milestonesFromGoals(goals: readonly GoalNode[]): Milestone[] {
  return rootGoals(goals).slice(0, MAX_MILESTONES).map((g) => ({
    title: g.title.trim() || "Goal",
    metric: g.unit ?? "",
    target: g.targetValue !== undefined ? String(g.targetValue) : "",
    horizon: g.dueDate ?? "",
    impact: g.actualValue !== undefined ? `Currently at ${g.actualValue}${g.unit ? ` ${g.unit}` : ""}.` : "",
  }));
}

function buildNext90(execution: ExecutionData, bottleneck: Bottleneck | null, learnerReflection: string | null, now: number, approvedPlan: GrowthPlan | null, primaryForceActions: readonly ForceActionItem[], primaryGoals: readonly GoalNode[]): Next90Days {
  let actions: NextStepAction[];
  let milestones: Milestone[];
  if (approvedPlan) {
    actions = actionsFromPlan(approvedPlan);
    milestones = milestoneFromPlan(approvedPlan);
  } else {
    // Tier 2: the primary project's own 7 Systems / Goal Hierarchy, for a
    // learner who plans there instead of (or in addition to) Business OS
    // -> Execution. ExperimentEntry is deliberately not wired in here — it
    // doesn't map cleanly to either an action (no owner/due) or a
    // milestone (no target metric); forcing it would be exactly the
    // lossy guess this session's own bridge work elsewhere avoided.
    actions = actionsFromForceActions(primaryForceActions);
    milestones = milestonesFromGoals(primaryGoals);

    // Tier 3: the Execution tool's own tasks/goals — only for whichever of
    // actions/milestones Tier 2 left empty, so a learner using BOTH
    // systems gets the richer one for each, not one system clobbering the
    // other.
    if (actions.length === 0) {
      const openTasks = execution.tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
          if (a.due) return -1;
          if (b.due) return 1;
          return 0;
        })
        .slice(0, MAX_ACTIONS);
      actions = openTasks.map((t) => ({ title: t.title, owner: t.owner, due: t.due, status: t.status, definitionOfDone: t.definitionOfDone }));
      if (actions.length === 0 && bottleneck && bottleneck.relieve !== "Not documented yet.") {
        actions = [{ title: bottleneck.relieve, owner: "", due: "", status: "todo", definitionOfDone: bottleneck.stopDoing }];
      }
    }
    if (milestones.length === 0) {
      milestones = execution.goals.slice(0, MAX_MILESTONES).map((g) => ({
        title: g.title.trim() || g.metric.trim() || "Goal",
        metric: g.metric,
        target: g.target,
        horizon: g.horizon,
        impact: impactOf(g),
      }));
    }
  }

  const successCriteria: string[] = [];
  for (const m of milestones) {
    if (m.metric.trim() && m.target.trim()) successCriteria.push(`${m.metric.trim()} reaches ${m.target.trim()}${m.horizon.trim() ? ` by ${m.horizon.trim()}` : ""}.`);
  }
  if (successCriteria.length === 0 && actions.length > 0) {
    successCriteria.push("Every action above is marked done, meeting its Definition of Done.");
  }
  if (successCriteria.length === 0) {
    successCriteria.push("Set at least one 90-day goal with a target metric in Business OS → Execution so success here is measurable.");
  }

  const hasData = actions.length > 0 || milestones.length > 0 || learnerReflection !== null;
  const narrativeParts: string[] = [];
  if (learnerReflection) narrativeParts.push(learnerReflection);
  if (milestones.length > 0) narrativeParts.push(`Your next 90 days are built around ${milestones.length} goal${milestones.length === 1 ? "" : "s"}: ${milestones.map((m) => m.title).join(", ")}.`);
  else if (actions.length > 0) narrativeParts.push(`Your next move: ${actions[0]!.title}.`);
  if (narrativeParts.length === 0) narrativeParts.push("Set your goals and top actions in Business OS → Execution to fill in your next 90 days.");

  return {
    hasData,
    windowStart: new Date(now).toISOString(),
    windowEnd: new Date(now + NINETY_DAYS_MS).toISOString(),
    actions,
    milestones,
    successCriteria,
    learnerReflection,
    narrative: narrativeParts.join(" "),
  };
}

function buildAchievements(
  summary: ReturnType<typeof summarizeEnrollment>,
  journey: readonly JourneyStep[],
  readiness: ReadinessComparison,
  improve: WhatYouWillImprove,
  next90: Next90Days,
): string[] {
  const out: string[] = [];
  if (summary.totalLessons > 0) out.push(`Completed ${summary.completedLessons} of ${summary.totalLessons} modules (${summary.percentComplete}%).`);
  const approvedChapters = journey.filter((j) => j.state === "approved").length;
  if (approvedChapters > 0) out.push(`${approvedChapters} of ${journey.length} chapters approved by your coach.`);
  if (readiness.start !== null && readiness.current !== null) {
    if (readiness.delta !== null && readiness.delta > 0) out.push(`Readiness Score rose from ${readiness.start} to ${readiness.current} (+${readiness.delta}).`);
    else out.push(`Readiness Score: started at ${readiness.start}, now at ${readiness.current}.`);
  } else if (readiness.current !== null) {
    out.push(`Current Readiness Score: ${readiness.current}.`);
  }
  if (improve.bottleneck) out.push(`Identified your #1 growth constraint: ${improve.bottleneck.area}.`);
  if (next90.milestones.length > 0) out.push(`Set ${next90.milestones.length} goal${next90.milestones.length === 1 ? "" : "s"} for your next 90 days.`);
  if (out.length === 0) out.push("You're just getting started — your achievements will show up here as you complete chapters.");
  return out;
}

/** Assembles the full report from already-fetched data. Pure — no I/O. */
export function buildTransformationReport(input: TransformationReportInputs): TransformationReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = Date.parse(generatedAt) || Date.now();
  const summary = summarizeEnrollment(input.programme, input.enrollment);
  const gates = chapterGates(input.programme, input.enrollment, input.chapterSubmissions, input.stageAccessLimit);
  const gateByStage = new Map(gates.map((g) => [g.stageId, g] as const));

  const journey = buildJourney(input.programme, gates);

  const growthSubmission = findGrowthChapterSubmission(input.chapterSubmissions);
  const growthGate = growthSubmission ? gateByStage.get(growthSubmission.stageId) ?? null : null;
  // Tier 1: only a coach-APPROVED structured plan counts as primary — an
  // in-progress or changes-requested one falls all the way through to the
  // same Business-OS fallback an unstarted plan would use, rather than
  // showing half-entered numbers as though they were the settled artifact.
  const approvedGrowthPlan: GrowthPlan | null =
    input.growthPlanSubmission?.status === "approved" ? formatPlan(input.growthPlanSubmission) : null;
  const improve = buildImprove(input.constraint, input.driverTree, growthSubmission, growthGate?.state ?? null, approvedGrowthPlan);

  const finishSubmission = latestSubmissionFor(input.chapterSubmissions, "finish");
  const finishGate = gateByStage.get("finish");
  const learnerReflection = finishSubmission?.evidence?.trim() || null;
  const next90 = buildNext90(input.execution, improve.bottleneck, learnerReflection, now, approvedGrowthPlan, input.primaryForceActions ?? [], input.primaryGoals ?? []);

  const readiness: ReadinessComparison = {
    start: input.readiness.start,
    current: input.readiness.current,
    label: input.readiness.label,
    delta: input.readiness.start !== null && input.readiness.current !== null ? input.readiness.current - input.readiness.start : null,
  };

  const account: TransformationReportAccount = {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    ownerEmail: input.ownerEmail,
    programmeName: input.programme.name,
    generatedAt,
    completedAt: finishGate?.state === "approved" ? finishSubmission?.reviewedAt ?? null : null,
    status: finishGate?.state === "approved" ? "complete" : "in_progress",
    overallPercent: summary.percentComplete,
    completedLessons: summary.completedLessons,
    totalLessons: summary.totalLessons,
  };

  const achievements = buildAchievements(summary, journey, readiness, improve, next90);

  const recentCoachNotes = [...input.coachMessages]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_COACH_NOTES)
    .map((m) => ({ at: m.at, fromName: m.fromName || m.fromEmail, body: m.body }));

  return { account, readiness, journey, improve, next90, achievements, recentCoachNotes };
}

/** Fetches everything a workspace's Transformation Report needs and builds
 *  it. Every read is scoped to `workspaceId` alone (or, for the owner's
 *  email, the user id already recorded as that workspace's owner) — never a
 *  cross-workspace query. */
export async function getTransformationReport(workspaceId: string, userId: string): Promise<TransformationReport> {
  const programme = await getDefaultProgramme();
  const enrollment = await getOrCreateEnrollment(workspaceId, userId, programme.id);
  const [chapterSubmissions, stageAccessLimit, snapshot, workspace, constraint, driverTree, execution, coachMessages, growthPlanSubmission, primaryProject] = await Promise.all([
    listChapterSubmissions(workspaceId),
    effectiveStageAccessLimit(workspaceId),
    getBusinessSnapshot(workspaceId),
    getWorkspace(workspaceId),
    getConstraint(workspaceId),
    getDriverTree(workspaceId),
    getExecution(workspaceId),
    listLearnerMessages(workspaceId),
    getChapter4Submission(workspaceId),
    // Tier 2 of "Your Next 90 Days" (see buildNext90) — the same
    // definition-populated predicate would be wrong here; this report
    // cares about goal/force-action activity, matching
    // programme-business-snapshot.ts's own predicate for the same reason.
    pickPrimaryProject(workspaceId, (doc) => (doc.goals?.length ?? 0) > 0 || (doc.program?.forceActions?.length ?? 0) > 0),
  ]);
  const readinessBaseline = await ensureReadinessBaseline(workspaceId, snapshot.readinessScore);
  const owner = workspace ? await getUserById(workspace.ownerId) : null;

  return buildTransformationReport({
    workspaceId,
    workspaceName: workspace?.name ?? "Your workspace",
    ownerEmail: owner?.email ?? "",
    programme,
    enrollment,
    chapterSubmissions,
    stageAccessLimit,
    readiness: { current: snapshot.readinessScore, label: snapshot.readinessLabel, start: readinessBaseline?.score ?? null },
    constraint,
    driverTree,
    execution,
    coachMessages,
    growthPlanSubmission,
    primaryForceActions: primaryProject?.doc.program?.forceActions ?? [],
    primaryGoals: primaryProject?.doc.goals ?? [],
  });
}

// ── Renderers ───────────────────────────────────────────────────────────────

function escHtml(t: string): string {
  return t.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** A static HTML snapshot of the report — the same content the on-screen
 *  page and the share link show, matching ReportPanels.tsx's reportToHtml()
 *  in style (self-contained inline CSS, no external assets). Used to seed a
 *  24-hour share link (see lib/reports/transformation-report-shares.ts). */
export function transformationReportToHtml(report: TransformationReport): string {
  const { account, readiness, journey, improve, next90, achievements } = report;
  const kpi = (k: string, v: string, c = "#111827") => `<div class="kpi"><div class="k">${escHtml(k)}</div><div class="v" style="color:${c}">${escHtml(v)}</div></div>`;
  const journeyHtml = journey.map((j) => `
    <div class="step">
      <h3>${escHtml(j.heading)}${j.outputName ? ` <span class="tag">${escHtml(j.outputName)}</span>` : ""}</h3>
      <div class="stage-title">${escHtml(j.stageTitle)}</div>
      <p>${escHtml(j.narrative)}</p>
      ${j.approvedAt ? `<div class="meta">Approved ${escHtml(fmtDate(j.approvedAt))}</div>` : ""}
    </div>`).join("");
  const metricsRows = improve.metrics.map((m) => `<tr><td>${escHtml(m.label)}</td><td class="mid">${escHtml(m.current)}</td><td class="r">${escHtml(m.target)}</td></tr>`).join("");
  const actionsRows = next90.actions.map((a) => `<tr><td>${escHtml(a.title)}</td><td class="mid">${escHtml(a.owner || "—")}${a.due ? ` · due ${escHtml(a.due)}` : ""}</td><td class="r">${escHtml(a.status.replace(/_/g, " "))}</td></tr>`).join("");
  const milestoneItems = next90.milestones.map((m) => `<li><strong>${escHtml(m.title)}</strong>${m.impact ? ` — ${escHtml(m.impact)}` : ""}</li>`).join("");
  const criteriaItems = next90.successCriteria.map((c) => `<li>${escHtml(c)}</li>`).join("");
  const achievementItems = achievements.map((a) => `<li>${escHtml(a)}</li>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(account.workspaceName)} — Transformation Report</title>
<style>
body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111827;max-width:820px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 2px} .sub{color:#6b7280;font-size:13px;margin-bottom:4px}
.brand{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#088057;font-weight:700;margin-bottom:10px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 26px}
.kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px 16px;min-width:130px}
.kpi .k{font-size:11px;color:#6b7280} .kpi .v{font-size:18px;font-weight:700}
h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin:28px 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
.step{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #f1f5f9}
.step h3{font-size:15px;margin:0 0 2px}
.tag{font-size:10px;font-weight:600;color:#088057;background:#08805718;border-radius:999px;padding:2px 8px;margin-left:6px;text-transform:none;letter-spacing:0}
.stage-title{font-size:11px;color:#9ca3af;margin-bottom:6px}
.step p{font-size:13.5px;line-height:1.6;margin:0;white-space:pre-wrap}
.meta{font-size:11px;color:#088057;margin-top:6px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:10px} td{padding:7px 0;border-bottom:1px solid #eee;font-size:13.5px}
td.mid{color:#6b7280;font-size:12px} td.r{text-align:right;font-weight:600}
ul{margin:0 0 12px;padding-left:20px;font-size:13.5px;line-height:1.7}
.narrative{font-size:13.5px;line-height:1.7;color:#374151;margin-bottom:12px;white-space:pre-wrap}
.footer{margin-top:36px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
@media print{body{margin:0}}
</style></head><body>
<div class="brand">ONEVYRT</div>
<h1>Your Transformation Report</h1>
<div class="sub">${escHtml(account.workspaceName)} · ${escHtml(account.programmeName)}</div>
<div class="sub">Generated ${escHtml(fmtDate(account.generatedAt))}${account.completedAt ? ` · Programme completed ${escHtml(fmtDate(account.completedAt))}` : " · Programme in progress"}</div>
<div class="kpis">
${kpi("Programme progress", `${account.overallPercent}%`)}
${readiness.current != null ? kpi("Readiness score", String(readiness.current), "#088057") : ""}
${readiness.delta != null ? kpi("Readiness change", `${readiness.delta >= 0 ? "+" : ""}${readiness.delta}`, readiness.delta >= 0 ? "#088057" : "#b91c1c") : ""}
</div>

<h2>Your Transformation Journey</h2>
${journeyHtml}

<h2>What You Will Improve</h2>
<div class="narrative">${escHtml(improve.narrative)}</div>
${improve.bottleneck ? `<p style="font-size:13px"><strong>Why this matters:</strong> ${escHtml(improve.bottleneck.why)}${improve.bottleneck.relieve !== "Not documented yet." ? `<br/><strong>The move:</strong> ${escHtml(improve.bottleneck.relieve)}` : ""}</p>` : ""}
${metricsRows ? `<table><tr><td style="color:#6b7280;font-size:11px">METRIC</td><td class="mid" style="color:#6b7280;font-size:11px">CURRENT</td><td class="r" style="color:#6b7280;font-size:11px">TARGET</td></tr>${metricsRows}</table>` : ""}

<h2>Your Next 90 Days</h2>
<div class="narrative">${escHtml(next90.narrative)}</div>
${actionsRows ? `<table><tr><td style="color:#6b7280;font-size:11px">ACTION</td><td class="mid" style="color:#6b7280;font-size:11px">OWNER</td><td class="r" style="color:#6b7280;font-size:11px">STATUS</td></tr>${actionsRows}</table>` : ""}
${milestoneItems ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px">MILESTONES &amp; EXPECTED IMPACT</div><ul>${milestoneItems}</ul>` : ""}
${criteriaItems ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px">SUCCESS CRITERIA</div><ul>${criteriaItems}</ul>` : ""}

<h2>Key Achievements</h2>
<ul>${achievementItems}</ul>

<div class="footer">ONEVYRT · Transformation Report for ${escHtml(account.workspaceName)} · Generated ${escHtml(new Date(account.generatedAt).toLocaleString())}</div>
</body></html>`;
}

/** Plain-text rendering for email delivery (lib/mailer.ts's MailMessage is
 *  text-only, matching every other transactional email this app sends). */
export function transformationReportToText(report: TransformationReport): string {
  const { account, readiness, journey, improve, next90, achievements } = report;
  const lines: string[] = [];
  const hr = () => lines.push("─".repeat(56));
  lines.push("ONEVYRT — YOUR TRANSFORMATION REPORT");
  lines.push(`${account.workspaceName} · ${account.programmeName}`);
  lines.push(`Generated ${fmtDate(account.generatedAt)}${account.completedAt ? ` · Programme completed ${fmtDate(account.completedAt)}` : " · Programme in progress"}`);
  lines.push(`Programme progress: ${account.overallPercent}% (${account.completedLessons}/${account.totalLessons} modules)`);
  if (readiness.current != null) {
    lines.push(`Readiness score: ${readiness.current}${readiness.start != null ? ` (started at ${readiness.start}${readiness.delta != null ? `, ${readiness.delta >= 0 ? "+" : ""}${readiness.delta}` : ""})` : ""}`);
  }
  lines.push("");

  hr();
  lines.push("YOUR TRANSFORMATION JOURNEY");
  hr();
  for (const j of journey) {
    lines.push("");
    lines.push(`${j.heading.toUpperCase()}${j.outputName ? ` — ${j.outputName}` : ""}`);
    lines.push(j.narrative);
    if (j.approvedAt) lines.push(`(Approved ${fmtDate(j.approvedAt)})`);
  }
  lines.push("");

  hr();
  lines.push("WHAT YOU WILL IMPROVE");
  hr();
  lines.push(improve.narrative);
  if (improve.bottleneck) {
    lines.push(`Why this matters: ${improve.bottleneck.why}`);
    if (improve.bottleneck.relieve !== "Not documented yet.") lines.push(`The move: ${improve.bottleneck.relieve}`);
  }
  for (const m of improve.metrics) lines.push(`  - ${m.label}: ${m.current} -> ${m.target}`);
  lines.push("");

  hr();
  lines.push("YOUR NEXT 90 DAYS");
  hr();
  lines.push(next90.narrative);
  if (next90.actions.length > 0) {
    lines.push("Top actions:");
    for (const a of next90.actions) lines.push(`  - ${a.title}${a.owner ? ` (${a.owner})` : ""}${a.due ? ` — due ${a.due}` : ""}`);
  }
  if (next90.milestones.length > 0) {
    lines.push("Milestones & expected impact:");
    for (const m of next90.milestones) lines.push(`  - ${m.title}${m.impact ? `: ${m.impact}` : ""}`);
  }
  if (next90.successCriteria.length > 0) {
    lines.push("Success criteria:");
    for (const c of next90.successCriteria) lines.push(`  - ${c}`);
  }
  lines.push("");

  hr();
  lines.push("KEY ACHIEVEMENTS");
  hr();
  for (const a of achievements) lines.push(`  - ${a}`);
  lines.push("");
  lines.push("— ONEVYRT");

  return lines.join("\n");
}
