/**
 * Execution OS — the EXECUTE layer between PLAN (Reality Map, drivers,
 * constraint) and ACTUAL. A workspace's 90-day goals, sprints, and tasks live
 * as one document under the `execution` section of the shared workspace_business
 * blob (lib/business.ts), so the whole operating system — plan and execution —
 * is one store. Progress is weighted: a task carries an effort/impact weight so
 * a sprint's percentage reflects the real load, not a raw task count.
 *
 * Mechanisms are original and general (goals → sprints → weighted tasks with a
 * Definition of Done); no external course material, scripts, or thresholds are
 * embedded.
 */
import { randomUUID } from "node:crypto";
import { getBusiness, saveBusinessSection } from "./business";

export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "blocked", "done"];
export type SprintStatus = "planned" | "active" | "done";
export const SPRINT_STATUSES: SprintStatus[] = ["planned", "active", "done"];

export interface ExecGoal {
  id: string;
  title: string;
  metric: string;   // the number this goal moves
  target: string;   // where that number should get to
  horizon: string;  // target date (free text / ISO)
  constraint: string; // the constraint this goal attacks (links Business OS)
}
export interface Sprint {
  id: string;
  name: string;
  focus: string;    // the one theme/constraint this sprint attacks
  startsAt: string;
  endsAt: string;
  status: SprintStatus;
}
export interface ExecTask {
  id: string;
  title: string;
  sprintId: string;  // "" = backlog
  goalId: string;    // "" = unlinked
  owner: string;
  due: string;
  status: TaskStatus;
  weight: number;    // 1..5 effort/impact weight for weighted progress
  definitionOfDone: string;
  notes: string;
}

export interface ExecutionData {
  goals: ExecGoal[];
  sprints: Sprint[];
  tasks: ExecTask[];
  updatedAt?: string;
}

const EMPTY: ExecutionData = { goals: [], sprints: [], tasks: [] };

export async function getExecution(workspaceId: string): Promise<ExecutionData> {
  const biz = await getBusiness(workspaceId);
  const e = (biz.execution as ExecutionData | undefined) ?? EMPTY;
  return { goals: e.goals ?? [], sprints: e.sprints ?? [], tasks: e.tasks ?? [], updatedAt: e.updatedAt };
}

export async function saveExecution(workspaceId: string, data: ExecutionData): Promise<ExecutionData> {
  const clean = sanitizeExecution(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "execution", clean);
  return clean;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const id = (v: unknown): string => (typeof v === "string" && v ? v.slice(0, 64) : randomUUID());

function sanitizeGoal(v: unknown): ExecGoal {
  const g = (v ?? {}) as Record<string, unknown>;
  return { id: id(g.id), title: clip(g.title, 200), metric: clip(g.metric, 200), target: clip(g.target, 200), horizon: clip(g.horizon, 60), constraint: clip(g.constraint, 400) };
}
function sanitizeSprint(v: unknown): Sprint {
  const s = (v ?? {}) as Record<string, unknown>;
  return { id: id(s.id), name: clip(s.name, 200), focus: clip(s.focus, 400), startsAt: clip(s.startsAt, 40), endsAt: clip(s.endsAt, 40), status: oneOf(s.status, SPRINT_STATUSES, "planned") };
}
function sanitizeTask(v: unknown): ExecTask {
  const t = (v ?? {}) as Record<string, unknown>;
  const w = Number(t.weight);
  return {
    id: id(t.id), title: clip(t.title, 300), sprintId: clip(t.sprintId, 64), goalId: clip(t.goalId, 64),
    owner: clip(t.owner, 120), due: clip(t.due, 40), status: oneOf(t.status, TASK_STATUSES, "todo"),
    weight: Number.isFinite(w) ? Math.max(1, Math.min(5, Math.round(w))) : 1,
    definitionOfDone: clip(t.definitionOfDone, 800), notes: clip(t.notes, 1200),
  };
}

/** Normalises an untrusted execution document from a request body. Caps list
 *  sizes so the shared blob can't be blown past the store's limit. */
export function sanitizeExecution(v: unknown): ExecutionData {
  const d = (v ?? {}) as Record<string, unknown>;
  const goals = Array.isArray(d.goals) ? d.goals.slice(0, 40).map(sanitizeGoal) : [];
  const sprints = Array.isArray(d.sprints) ? d.sprints.slice(0, 60).map(sanitizeSprint) : [];
  const tasks = Array.isArray(d.tasks) ? d.tasks.slice(0, 250).map(sanitizeTask) : [];
  return { goals, sprints, tasks };
}

export interface Progress { pct: number; doneWeight: number; totalWeight: number; done: number; total: number; }

/** Weighted completion across a set of tasks: share of total weight that is
 *  done. Blocked and in-progress tasks count toward the denominator only. */
export function progressOf(tasks: ExecTask[]): Progress {
  let doneWeight = 0, totalWeight = 0, done = 0;
  for (const t of tasks) {
    const w = t.weight || 1;
    totalWeight += w;
    if (t.status === "done") { doneWeight += w; done += 1; }
  }
  const pct = totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100);
  return { pct, doneWeight, totalWeight, done, total: tasks.length };
}
