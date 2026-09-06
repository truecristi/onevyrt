/**
 * Business OS — Review / Close the Loop. The final step that makes the operating
 * loop actually loop: record what ACTUALLY happened against the plan's targets,
 * capture the learning, then feed it back — push the current-state snapshot into
 * the Reality Map's "now" and point at the next constraint. Each pass is a
 * review cycle; the history shows the loop turning over time. Stored under the
 * `review` section of the shared workspace_business blob (lib/business.ts) — no
 * new migration.
 *
 * Original, general review/retro mechanics (actual vs target, worked/didn't/
 * learned/decided, feed back); no external course material embedded.
 */
import { randomUUID } from "node:crypto";
import { getBusiness, saveBusinessSection } from "./business";

export interface MetricActual {
  id: string;
  label: string;
  target: string;
  actual: string;
  note: string;
}
export interface StateSnapshot {
  revenue: string; profit: string; customers: string; team: string;
}
export interface ReviewCycle {
  id: string;
  period: string;   // e.g. "Aug 2026" or "Sprint 3"
  date: string;
  metrics: MetricActual[];
  snapshot: StateSnapshot;
  worked: string;
  didnt: string;
  learned: string;
  decision: string;
  nextConstraint: string;
}
export interface ReviewData { cycles: ReviewCycle[]; updatedAt?: string; }

const EMPTY: ReviewData = { cycles: [] };
const EMPTY_SNAP: StateSnapshot = { revenue: "", profit: "", customers: "", team: "" };

export async function getReview(workspaceId: string): Promise<ReviewData> {
  const biz = await getBusiness(workspaceId);
  const r = (biz.review as ReviewData | undefined) ?? EMPTY;
  return { cycles: r.cycles ?? [], updatedAt: r.updatedAt };
}

export async function saveReview(workspaceId: string, data: ReviewData): Promise<ReviewData> {
  const clean = sanitizeReview(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "review", clean);
  return clean;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

function sanitizeMetric(v: unknown): MetricActual {
  const m = (v ?? {}) as Record<string, unknown>;
  return { id: typeof m.id === "string" && m.id ? m.id.slice(0, 64) : randomUUID(), label: clip(m.label, 160), target: clip(m.target, 40), actual: clip(m.actual, 40), note: clip(m.note, 400) };
}
function sanitizeSnapshot(v: unknown): StateSnapshot {
  const s = (v ?? {}) as Record<string, unknown>;
  return { revenue: clip(s.revenue, 60), profit: clip(s.profit, 60), customers: clip(s.customers, 60), team: clip(s.team, 60) };
}
function sanitizeCycle(v: unknown): ReviewCycle {
  const c = (v ?? {}) as Record<string, unknown>;
  return {
    id: typeof c.id === "string" && c.id ? c.id.slice(0, 64) : randomUUID(),
    period: clip(c.period, 80), date: clip(c.date, 40),
    metrics: Array.isArray(c.metrics) ? c.metrics.slice(0, 40).map(sanitizeMetric) : [],
    snapshot: sanitizeSnapshot(c.snapshot ?? EMPTY_SNAP),
    worked: clip(c.worked, 1200), didnt: clip(c.didnt, 1200), learned: clip(c.learned, 1200),
    decision: clip(c.decision, 1200), nextConstraint: clip(c.nextConstraint, 200),
  };
}
export function sanitizeReview(v: unknown): ReviewData {
  const d = (v ?? {}) as Record<string, unknown>;
  return { cycles: Array.isArray(d.cycles) ? d.cycles.slice(0, 40).map(sanitizeCycle) : [] };
}
