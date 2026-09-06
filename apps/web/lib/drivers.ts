/**
 * Business OS — Key Driver Tree. Breaks the outcome number (e.g. monthly
 * revenue) into the chain of drivers that multiply to produce it — leads ×
 * conversion × average value × frequency, etc. Each driver carries a current
 * and a target value, so the tree shows which single lever moves the outcome
 * most (its leverage). Stored under the `driverTree` section of the shared
 * workspace_business blob (lib/business.ts) — no new migration.
 *
 * Original, general growth-maths mechanics (a multiplicative driver model); no
 * external course material or fixed thresholds are embedded.
 */
import { randomUUID } from "node:crypto";
import { getBusiness, saveBusinessSection } from "./business";

/** Live acquisition metrics a driver's *current* value can be linked to, so the
 *  plan tracks what the funnels actually produce instead of a hand-typed number.
 *  (Validation only here — the values are computed in lib/acquisition.) */
export const DRIVER_SOURCES = ["leads_7d", "leads_total", "qualified", "booked", "upcoming", "visits", "qualify_rate", "cac"] as const;
export type DriverSource = typeof DRIVER_SOURCES[number];

export interface Driver {
  id: string;
  label: string;
  current: string; // free text; parseNum interprets $, commas and %
  target: string;
  note: string;
  /** when set, `current` is filled live from this acquisition metric on read */
  source?: DriverSource;
}
export interface DriverTree {
  outcomeLabel: string;
  outcomeTarget: string; // the number the tree should produce (from the Reality Map)
  drivers: Driver[];
  updatedAt?: string;
}

const EMPTY: DriverTree = { outcomeLabel: "Monthly revenue", outcomeTarget: "", drivers: [] };

export async function getDriverTree(workspaceId: string): Promise<DriverTree> {
  const biz = await getBusiness(workspaceId);
  const d = (biz.driverTree as DriverTree | undefined) ?? EMPTY;
  return { outcomeLabel: d.outcomeLabel ?? EMPTY.outcomeLabel, outcomeTarget: d.outcomeTarget ?? "", drivers: d.drivers ?? [], updatedAt: d.updatedAt };
}

export async function saveDriverTree(workspaceId: string, data: DriverTree): Promise<DriverTree> {
  const clean = sanitizeDriverTree(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "driverTree", clean);
  return clean;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

export function sanitizeDriverTree(v: unknown): DriverTree {
  const d = (v ?? {}) as Record<string, unknown>;
  const drivers = Array.isArray(d.drivers)
    ? d.drivers.slice(0, 24).map((raw): Driver => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const source = typeof r.source === "string" && (DRIVER_SOURCES as readonly string[]).includes(r.source) ? (r.source as DriverSource) : undefined;
        return {
          id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : randomUUID(),
          label: clip(r.label, 120), current: clip(r.current, 40), target: clip(r.target, 40), note: clip(r.note, 400),
          ...(source ? { source } : {}),
        };
      })
    : [];
  return { outcomeLabel: clip(d.outcomeLabel, 120) || "Outcome", outcomeTarget: clip(d.outcomeTarget, 40), drivers };
}

/** Parses a driver value, honouring $ and thousands separators, and treating a
 *  trailing % as a fraction (3% → 0.03). Returns NaN when not numeric. */
export function parseNum(s: string): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim();
  if (!t) return NaN;
  const pct = t.endsWith("%");
  const cleaned = t.replace(/[%$,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}
