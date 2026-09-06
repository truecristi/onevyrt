/**
 * Chapter 4 (IMPROVE & SCALE) submission storage: the learner's evolving
 * Growth & Improvement Plan — current position → biggest bottleneck → action
 * plan → 90-day impact projection — built up subchapter by subchapter
 * (4.1–4.6: bottleneck, conversion, profit, systemise, growth plan, optional
 * team capacity) and persisted in `chapter_4_submissions`, one row per
 * workspace (see the migration for the column set).
 *
 * Deliberately separate from lib/chapter-submissions.ts's generic
 * evidence-blob model (packages/engine/src/chapter-gates.ts's
 * ChapterSubmission — a single free-text "here's my evidence" string per
 * chapter): Chapter 4's output is structured data the Growth & Improvement
 * Plan artifact renders directly (metrics, a named bottleneck, prioritised
 * actions, an impact projection), not prose a coach reads and judges.
 *
 * The engine doesn't yet carry a "chapter-4" stage id (see
 * packages/engine/src/curriculum-chapters.ts's CANONICAL_STAGES — still
 * start/chapter-1/2/3/finish) — extending it is a separate, parallel
 * workstream (docs/IMPLEMENTATION_ROADMAP.md's Wave 1 Lane 2). This module
 * and its two routes (submit/get) are deliberately self-contained:
 * workspace-membership-gated only, never gated on chapterGates()/engine
 * reachability. Wiring a real chapter-4 gate once the engine grows one is
 * follow-up work, not a blocker for shipping the artifact itself.
 *
 * Same persistence shape as chapter_submissions/enrollments: one jsonb blob
 * per workspace_id, read/mutated/written whole under one cross-container
 * advisory lock (db.ts withAdvisoryLock) so concurrent subchapter saves for
 * the SAME workspace serialize across every app instance; different
 * workspaces never contend with each other.
 */
import { randomBytes } from "node:crypto";
import { pgPool, withAdvisoryLock, type Queryable } from "./db";

export type Chapter4Status = "in_progress" | "submitted" | "changes_requested" | "approved";

/** The 4.1–4.6 subchapter ids from docs/IMPLEMENTATION_ROADMAP.md's Chapter 4
 *  curriculum table. 4.6 (Team & Capacity) is optional and only surfaces for
 *  businesses with staff, but is still a valid save target here — deciding
 *  whether to SHOW it is curriculum-content's call, not storage's. */
export const CHAPTER_4_SUBCHAPTERS = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] as const;
export type Chapter4Subchapter = (typeof CHAPTER_4_SUBCHAPTERS)[number];
export function isChapter4Subchapter(v: unknown): v is Chapter4Subchapter {
  return typeof v === "string" && (CHAPTER_4_SUBCHAPTERS as readonly string[]).includes(v);
}

/** "Current position" — subchapter 4.3's baseline, shown at the top of the
 *  artifact. Every field optional: a learner fills these in gradually, and a
 *  partial save must not force the others to a fake zero. */
export interface GrowthPlanMetrics {
  monthlyRevenue?: number;
  grossMarginPct?: number;
  conversionRatePct?: number;
  avgCustomerValue?: number;
}

/** The single biggest constraint (subchapter 4.1), the target it's judged
 *  against (set alongside the growth plan in 4.5), and why it's the
 *  constraint. currentValue/targetValue are percentages (8.2 means 8.2%) —
 *  matches how conversion-style bottlenecks are entered and read everywhere
 *  else in this module. */
export interface GrowthPlanBottleneck {
  area?: string;
  currentValue?: number;
  targetValue?: number;
  why?: string;
}

/** One row of the action plan (subchapter 4.5) — "24-hour follow-up SOP",
 *  "Standard sales process", etc., per the roadmap's worked example. */
export interface GrowthPlanAction {
  title: string;
  expectedImpact?: string;
}

/** The volume the bottleneck's rate change is projected across — "100 leads"
 *  in the roadmap's worked example — kept separate from the bottleneck itself
 *  since it's a throughput figure, not a rate. */
export interface GrowthPlanImpactInput {
  leadVolume?: number;
}

export interface Chapter4PlanData {
  currentPosition?: GrowthPlanMetrics;
  bottleneck?: GrowthPlanBottleneck;
  actions?: GrowthPlanAction[];
  impact?: GrowthPlanImpactInput;
  /** Which subchapters (4.1–4.6) have been saved at least once. Drives a
   *  learner-facing "3 of 5 sections done" progress readout — NOT a gate;
   *  nothing here blocks re-saving or submitting out of order. */
  completedSubchapters?: Chapter4Subchapter[];
}

export interface Chapter4Submission {
  /** Stable opaque id, independent of workspaceId — see the migration's
   *  header for why this exists alongside the workspace_id primary key. */
  id: string;
  workspaceId: string;
  status: Chapter4Status;
  data: Chapter4PlanData;
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  coachDecision?: "approved" | "changes_requested";
  coachFeedback?: string;
  updatedAt: string;
}

function lockKeyFor(workspaceId: string): string {
  return `chapter-4-submissions:${workspaceId}`;
}

interface Row {
  workspace_id: string;
  id: string;
  status: string;
  data: Chapter4PlanData;
  submitted_at: Date | null;
  submitted_by: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  coach_decision: string | null;
  coach_feedback: string | null;
  updated_at: Date;
}

function rowToSubmission(row: Row): Chapter4Submission {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    status: row.status as Chapter4Status,
    data: row.data ?? {},
    updatedAt: row.updated_at.toISOString(),
    ...(row.submitted_at ? { submittedAt: row.submitted_at.toISOString() } : {}),
    ...(row.submitted_by ? { submittedBy: row.submitted_by } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.coach_decision ? { coachDecision: row.coach_decision as "approved" | "changes_requested" } : {}),
    ...(row.coach_feedback ? { coachFeedback: row.coach_feedback } : {}),
  };
}

async function readRow(workspaceId: string, db: Queryable = pgPool()): Promise<Chapter4Submission | null> {
  const res = await db.query<Row>(
    `SELECT workspace_id, id, status, data, submitted_at, submitted_by, reviewed_at, reviewed_by, coach_decision, coach_feedback, updated_at
     FROM chapter_4_submissions WHERE workspace_id = $1`,
    [workspaceId],
  );
  return res.rows[0] ? rowToSubmission(res.rows[0]) : null;
}

async function writeRow(db: Queryable, s: Chapter4Submission): Promise<void> {
  await db.query(
    `INSERT INTO chapter_4_submissions
       (workspace_id, id, status, data, submitted_at, submitted_by, reviewed_at, reviewed_by, coach_decision, coach_feedback, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       id = EXCLUDED.id, status = EXCLUDED.status, data = EXCLUDED.data,
       submitted_at = EXCLUDED.submitted_at, submitted_by = EXCLUDED.submitted_by,
       reviewed_at = EXCLUDED.reviewed_at, reviewed_by = EXCLUDED.reviewed_by,
       coach_decision = EXCLUDED.coach_decision, coach_feedback = EXCLUDED.coach_feedback,
       updated_at = now()`,
    [
      s.workspaceId, s.id, s.status, JSON.stringify(s.data),
      s.submittedAt ?? null, s.submittedBy ?? null,
      s.reviewedAt ?? null, s.reviewedBy ?? null,
      s.coachDecision ?? null, s.coachFeedback ?? null,
    ],
  );
}

// Defensive normalisation on the way into storage — the same "never trust
// what the route already checked" belt-and-braces lib/chapter-submissions.ts
// applies to evidence text, here applied to Chapter 4's structured fields.
// The route (app/api/programme/chapter/4/submit) does its own user-facing
// validation (growth-plan-utils.ts's validatePlanMetrics + range checks) so a
// bad request gets a clear 400; this layer just makes sure nothing that DOES
// get through can grow the stored document without bound.
const MAX_AREA = 200;
const MAX_WHY = 2000;
const MAX_ACTION_TITLE = 200;
const MAX_ACTION_IMPACT = 300;
const MAX_ACTIONS = 8; // the plan calls for "top 3–5"; a little headroom, not unbounded

function clampRate(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}
function clampNonNegative(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  return Math.max(0, n);
}

function cleanMetrics(m: GrowthPlanMetrics | undefined): GrowthPlanMetrics | undefined {
  if (!m) return undefined;
  return {
    ...(m.monthlyRevenue !== undefined ? { monthlyRevenue: clampNonNegative(m.monthlyRevenue) } : {}),
    ...(m.grossMarginPct !== undefined && Number.isFinite(m.grossMarginPct) ? { grossMarginPct: Math.min(100, Math.max(-100, m.grossMarginPct)) } : {}),
    ...(m.conversionRatePct !== undefined ? { conversionRatePct: clampRate(m.conversionRatePct) } : {}),
    ...(m.avgCustomerValue !== undefined ? { avgCustomerValue: clampNonNegative(m.avgCustomerValue) } : {}),
  };
}

function cleanBottleneck(b: GrowthPlanBottleneck | undefined): GrowthPlanBottleneck | undefined {
  if (!b) return undefined;
  return {
    ...(b.area !== undefined ? { area: b.area.trim().slice(0, MAX_AREA) } : {}),
    ...(b.currentValue !== undefined ? { currentValue: clampRate(b.currentValue) } : {}),
    ...(b.targetValue !== undefined ? { targetValue: clampRate(b.targetValue) } : {}),
    ...(b.why !== undefined ? { why: b.why.trim().slice(0, MAX_WHY) } : {}),
  };
}

function cleanActions(list: GrowthPlanAction[] | undefined): GrowthPlanAction[] | undefined {
  if (!list) return undefined;
  return list
    .map((a) => ({ title: (a.title ?? "").trim().slice(0, MAX_ACTION_TITLE), expectedImpact: a.expectedImpact?.trim().slice(0, MAX_ACTION_IMPACT) }))
    .filter((a) => a.title.length > 0)
    .slice(0, MAX_ACTIONS)
    .map((a) => (a.expectedImpact ? a : { title: a.title }));
}

function cleanImpact(i: GrowthPlanImpactInput | undefined): GrowthPlanImpactInput | undefined {
  if (!i) return undefined;
  return { ...(i.leadVolume !== undefined ? { leadVolume: clampNonNegative(i.leadVolume) } : {}) };
}

function mergeCompleted(existing: Chapter4Subchapter[] | undefined, subchapter: Chapter4Subchapter): Chapter4Subchapter[] {
  const seen = new Set(existing ?? []);
  seen.add(subchapter);
  // Keep canonical 4.1→4.6 order regardless of the order sections were saved in.
  return CHAPTER_4_SUBCHAPTERS.filter((s) => seen.has(s));
}

/** The Chapter 4 submission for a workspace, or null if it's never been
 *  started (no row yet). Lock-free read — matches
 *  lib/chapter-submissions.ts's listChapterSubmissions. */
export async function getChapter4Submission(workspaceId: string): Promise<Chapter4Submission | null> {
  return readRow(workspaceId);
}

export interface SaveChapter4Input {
  subchapter: Chapter4Subchapter;
  currentPosition?: GrowthPlanMetrics;
  bottleneck?: GrowthPlanBottleneck;
  actions?: GrowthPlanAction[];
  impact?: GrowthPlanImpactInput;
  /** True when the learner is submitting the whole plan for coach review
   *  (typically alongside subchapter 4.5) rather than just saving progress on
   *  one section. Moves status to "submitted" regardless of the PREVIOUS
   *  status — including re-submitting after "changes_requested", or editing
   *  an already-"approved" plan and explicitly asking for a fresh look. */
  submitForReview?: boolean;
  actorEmail: string;
}

/** One submission by its stable opaque id (see the migration's unique index
 *  on `id`) rather than by workspace_id. The coach-review surface only ever
 *  has this id — from a URL or a review request body — not the workspace id,
 *  so it needs its own lookup path alongside getChapter4Submission's
 *  workspace-keyed one. Lock-free read, same contract as that function. */
export async function getChapter4SubmissionById(id: string, db: Queryable = pgPool()): Promise<Chapter4Submission | null> {
  const res = await db.query<Row>(
    `SELECT workspace_id, id, status, data, submitted_at, submitted_by, reviewed_at, reviewed_by, coach_decision, coach_feedback, updated_at
     FROM chapter_4_submissions WHERE id = $1`,
    [id],
  );
  return res.rows[0] ? rowToSubmission(res.rows[0]) : null;
}

/** A coach approves or requests changes on a Chapter 4 submission — the write
 *  side of the coach_decision/coach_feedback/reviewed_at/reviewed_by columns
 *  this table declared up front for exactly this (see the migration's
 *  header: "written by this slice's future coach-review endpoint"). Only
 *  succeeds while the submission is actually "submitted" (awaiting review):
 *  deciding one that's still "in_progress" (nothing submitted yet) or already
 *  decided would either invent a review nobody asked for or silently
 *  overwrite an earlier decision the learner may already be acting on.
 *  Pre-lock existence read, then re-read the current row under the SAME
 *  advisory-lock key saveChapter4Plan uses for this workspace — so a coach's
 *  decision and a learner's concurrent resubmit never race — matching this
 *  file's own pre-lock-read-then-lock pattern (see saveChapter4Plan and
 *  lib/chapter-submissions.ts's identical tradeoff for its own pre-lock
 *  reads). Returns {error} rather than throwing for the expected failure
 *  modes (not found / not currently submitted). */
export async function reviewChapter4Submission(id: string, input: { decision: "approved" | "changes_requested"; feedback?: string; reviewedBy: string }): Promise<Chapter4Submission | { error: string }> {
  const pre = await getChapter4SubmissionById(id);
  if (!pre) return { error: "Submission not found." };
  return withAdvisoryLock(lockKeyFor(pre.workspaceId), async (db) => {
    const current = await getChapter4SubmissionById(id, db);
    if (!current) return { error: "Submission not found." };
    if (current.status !== "submitted") return { error: "This plan isn't currently awaiting review." };
    const feedback = input.feedback?.trim().slice(0, MAX_WHY) || undefined;
    const now = new Date().toISOString();
    await db.query(
      `UPDATE chapter_4_submissions
       SET status = $2, coach_decision = $2, coach_feedback = $3, reviewed_at = now(), reviewed_by = $4, updated_at = now()
       WHERE id = $1`,
      [id, input.decision, feedback ?? null, input.reviewedBy],
    );
    return { ...current, status: input.decision, coachDecision: input.decision, coachFeedback: feedback, reviewedAt: now, reviewedBy: input.reviewedBy };
  });
}

/** Saves one subchapter's worth of Growth & Improvement Plan fields for a
 *  workspace, merging into whatever's already stored (sections not present on
 *  this call are left untouched — a partial save never blanks the rest of the
 *  plan). Creates the row on first save. Only `submitForReview: true` changes
 *  `status`; a plain progress save preserves whatever status is already
 *  there (so editing an approved plan's numbers, per
 *  docs/IMPLEMENTATION_ROADMAP.md's "Growth & Improvement Plan is mutable"
 *  architectural decision, doesn't silently knock it back out of "approved").
 *  Returns {error} for an unrecognised subchapter id; never throws for bad
 *  section content — see cleanMetrics/cleanBottleneck/cleanActions/cleanImpact
 *  above, which normalise rather than reject (the route already validated the
 *  request before calling this). */
export async function saveChapter4Plan(workspaceId: string, input: SaveChapter4Input): Promise<Chapter4Submission | { error: string }> {
  if (!isChapter4Subchapter(input.subchapter)) return { error: "Unknown Chapter 4 subchapter." };

  return withAdvisoryLock(lockKeyFor(workspaceId), async (db) => {
    const existing = await readRow(workspaceId, db);
    const id = existing?.id ?? randomBytes(8).toString("hex");

    const data: Chapter4PlanData = {
      currentPosition: cleanMetrics(input.currentPosition) ?? existing?.data.currentPosition,
      bottleneck: cleanBottleneck(input.bottleneck) ?? existing?.data.bottleneck,
      actions: cleanActions(input.actions) ?? existing?.data.actions,
      impact: cleanImpact(input.impact) ?? existing?.data.impact,
      completedSubchapters: mergeCompleted(existing?.data.completedSubchapters, input.subchapter),
    };

    const status: Chapter4Status = input.submitForReview ? "submitted" : (existing?.status ?? "in_progress");
    const now = new Date().toISOString();

    const submission: Chapter4Submission = {
      id,
      workspaceId,
      status,
      data,
      updatedAt: now,
      ...(input.submitForReview
        ? { submittedAt: now, submittedBy: input.actorEmail }
        : { ...(existing?.submittedAt ? { submittedAt: existing.submittedAt } : {}), ...(existing?.submittedBy ? { submittedBy: existing.submittedBy } : {}) }),
      ...(existing?.reviewedAt ? { reviewedAt: existing.reviewedAt } : {}),
      ...(existing?.reviewedBy ? { reviewedBy: existing.reviewedBy } : {}),
      ...(existing?.coachDecision ? { coachDecision: existing.coachDecision } : {}),
      ...(existing?.coachFeedback ? { coachFeedback: existing.coachFeedback } : {}),
    };
    await writeRow(db, submission);
    return submission;
  });
}
