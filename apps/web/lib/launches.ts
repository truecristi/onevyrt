/**
 * Execution OS Phase 2 — Launch OS. A launch is a concentrated push (a product
 * launch, a promo, an event) that needs to be *ready* before it goes live.
 * Readiness is weighted and gated: each readiness item carries a weight, and
 * some are hard blockers — if any hard blocker is incomplete the launch is
 * NO-GO regardless of the weighted percentage. A decision log captures the
 * calls made along the way. Stored under the `launches` section of the shared
 * workspace_business blob (lib/business.ts) — no new migration.
 *
 * Original, general launch-readiness mechanics (weighted checklist + hard
 * blockers + go/no-go); no external course material or fixed thresholds.
 */
import { randomUUID } from "node:crypto";
import { getBusiness, saveBusinessSection } from "./business";

export type LaunchStatus = "planning" | "preflight" | "live" | "post";
export const LAUNCH_STATUSES: LaunchStatus[] = ["planning", "preflight", "live", "post"];

export interface ReadinessItem {
  id: string;
  category: string;
  label: string;
  weight: number;      // 1..5
  done: boolean;
  hardBlocker: boolean; // must be done for GO
}
export interface Decision {
  id: string;
  at: string;
  decision: string;
  rationale: string;
}
export interface Launch {
  id: string;
  name: string;
  goal: string;
  date: string;
  status: LaunchStatus;
  readiness: ReadinessItem[];
  decisions: Decision[];
  notes: string;
}
export interface LaunchesData { launches: Launch[]; updatedAt?: string; }

/** Default readiness checklist seeded into a new launch. Categories span the
 *  things that sink launches; hard blockers are the ones you can't go without. */
export const DEFAULT_READINESS: Omit<ReadinessItem, "id">[] = [
  { category: "Offer", label: "Offer, price and guarantee are finalised", weight: 5, done: false, hardBlocker: true },
  { category: "Offer", label: "Bonuses / deadline / scarcity defined", weight: 2, done: false, hardBlocker: false },
  { category: "Assets", label: "Sales page live and proofread", weight: 5, done: false, hardBlocker: true },
  { category: "Assets", label: "Emails written and scheduled", weight: 3, done: false, hardBlocker: false },
  { category: "Assets", label: "Ads / creative approved", weight: 3, done: false, hardBlocker: false },
  { category: "Tech", label: "Checkout tested with a real transaction", weight: 5, done: false, hardBlocker: true },
  { category: "Tech", label: "Tracking / analytics firing", weight: 3, done: false, hardBlocker: false },
  { category: "Tech", label: "Fulfilment / delivery ready", weight: 4, done: false, hardBlocker: true },
  { category: "Traffic", label: "Traffic source(s) ready and funded", weight: 4, done: false, hardBlocker: false },
  { category: "Traffic", label: "Audience warmed / list notified", weight: 2, done: false, hardBlocker: false },
  { category: "Team", label: "Support cover and response plan in place", weight: 3, done: false, hardBlocker: false },
  { category: "Team", label: "Roles for launch day assigned", weight: 2, done: false, hardBlocker: false },
];

const EMPTY: LaunchesData = { launches: [] };

export async function getLaunches(workspaceId: string): Promise<LaunchesData> {
  const biz = await getBusiness(workspaceId);
  const l = (biz.launches as LaunchesData | undefined) ?? EMPTY;
  return { launches: l.launches ?? [], updatedAt: l.updatedAt };
}

export async function saveLaunches(workspaceId: string, data: LaunchesData): Promise<LaunchesData> {
  const clean = sanitizeLaunches(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "launches", clean);
  return clean;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");
const bool = (v: unknown): boolean => v === true;

function sanitizeItem(v: unknown): ReadinessItem {
  const r = (v ?? {}) as Record<string, unknown>;
  const w = Number(r.weight);
  return {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : randomUUID(),
    category: clip(r.category, 60) || "General", label: clip(r.label, 200),
    weight: Number.isFinite(w) ? Math.max(1, Math.min(5, Math.round(w))) : 1,
    done: bool(r.done), hardBlocker: bool(r.hardBlocker),
  };
}
function sanitizeDecision(v: unknown): Decision {
  const d = (v ?? {}) as Record<string, unknown>;
  return { id: typeof d.id === "string" && d.id ? d.id.slice(0, 64) : randomUUID(), at: clip(d.at, 40), decision: clip(d.decision, 400), rationale: clip(d.rationale, 800) };
}
function sanitizeLaunch(v: unknown): Launch {
  const l = (v ?? {}) as Record<string, unknown>;
  const status = LAUNCH_STATUSES.includes(l.status as LaunchStatus) ? (l.status as LaunchStatus) : "planning";
  return {
    id: typeof l.id === "string" && l.id ? l.id.slice(0, 64) : randomUUID(),
    name: clip(l.name, 200), goal: clip(l.goal, 600), date: clip(l.date, 40), status,
    readiness: Array.isArray(l.readiness) ? l.readiness.slice(0, 40).map(sanitizeItem) : [],
    decisions: Array.isArray(l.decisions) ? l.decisions.slice(0, 30).map(sanitizeDecision) : [],
    notes: clip(l.notes, 2000),
  };
}
export function sanitizeLaunches(v: unknown): LaunchesData {
  const d = (v ?? {}) as Record<string, unknown>;
  return { launches: Array.isArray(d.launches) ? d.launches.slice(0, 20).map(sanitizeLaunch) : [] };
}

export interface Readiness { pct: number; go: boolean; blockers: ReadinessItem[]; doneWeight: number; totalWeight: number; }

/** Weighted readiness plus the GO/NO-GO gate: GO only when every hard blocker
 *  is done (and there's at least one item). */
export function readinessOf(items: ReadinessItem[]): Readiness {
  let doneWeight = 0, totalWeight = 0;
  const blockers: ReadinessItem[] = [];
  for (const it of items) {
    const w = it.weight || 1;
    totalWeight += w;
    if (it.done) doneWeight += w;
    if (it.hardBlocker && !it.done) blockers.push(it);
  }
  const pct = totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100);
  return { pct, go: items.length > 0 && blockers.length === 0, blockers, doneWeight, totalWeight };
}
