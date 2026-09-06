/**
 * Economics — the Numbers-side counterpart to the offer. A few plain figures a
 * solo owner already knows (fixed costs for the period, the variable cost of
 * delivering one sale, optionally how many they sell now and a profit goal),
 * persisted with the workspace so the break-even card and the Numbers hub read
 * the same source instead of a per-browser scratchpad.
 *
 * Pure and server-free: the shape, sanitisation and a viability read live here
 * so the card, the store (lib/economics.ts) and unit tests share one source of
 * truth without pulling in Postgres or the engine. The price comes from the
 * saved offer — economics + offer together decide whether the business works.
 *
 * All money is in MAJOR units (dollars), matching what the user types.
 */
import { normalizeCurrency } from "./currency";

export interface EconomicsData {
  fixedCosts: number;          // fixed costs for the period (rent, tools, salaries)
  variableCostPerUnit: number; // cost to deliver one sale (COGS, fees)
  currentUnits?: number;       // how many are sold now / planned (optional)
  profitGoal?: number;         // the profit you want for the period (optional)
  closeRatePct?: number;       // % of sales conversations that become sales (0–100)
  qualifyRatePct?: number;     // % of leads that qualify into a conversation (0–100)
  optInRatePct?: number;       // % of visitors that become a lead (0–100)
  costPerVisitor?: number;     // what one ad click / visitor costs (major units)
  currency?: string;           // workspace currency (ISO-4217, e.g. "GBP"); defaults to USD
  updatedAt?: string;
}

export const EMPTY_ECONOMICS: EconomicsData = { fixedCosts: 0, variableCostPerUnit: 0 };

/** Coerce to a finite, non-negative number capped at a sane ceiling (1e12). */
function money(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1e12);
}
/** Optional field: undefined stays undefined; anything present is coerced. */
function optMoney(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return money(v);
}

export function sanitizeEconomics(v: unknown): EconomicsData {
  const o = (v ?? {}) as Record<string, unknown>;
  const out: EconomicsData = {
    fixedCosts: money(o.fixedCosts),
    variableCostPerUnit: money(o.variableCostPerUnit),
  };
  const cu = optMoney(o.currentUnits);
  if (cu !== undefined) out.currentUnits = Math.round(cu);
  const pg = optMoney(o.profitGoal);
  if (pg !== undefined) out.profitGoal = pg;
  const cr = optMoney(o.closeRatePct);
  if (cr !== undefined) out.closeRatePct = Math.min(100, cr); // a percentage, capped at 100
  const qr = optMoney(o.qualifyRatePct);
  if (qr !== undefined) out.qualifyRatePct = Math.min(100, qr);
  const oi = optMoney(o.optInRatePct);
  if (oi !== undefined) out.optInRatePct = Math.min(100, oi);
  const cpv = optMoney(o.costPerVisitor);
  if (cpv !== undefined) out.costPerVisitor = cpv;
  if (o.currency !== undefined && o.currency !== null && o.currency !== "") out.currency = normalizeCurrency(o.currency);
  return out;
}

export type ViabilityStage = "Not viable" | "Thin margins" | "Workable" | "Healthy" | "Strong margins";

export interface Viability {
  /** 0–100. Contribution margin as a percentage, or 0 when each sale loses money. */
  score: number;
  stage: ViabilityStage;
  /** price − variable cost, per sale (major units). */
  contributionPerUnit: number;
  /** contribution / price, 0..1. null when there's no price to divide by. */
  contributionMarginPct: number | null;
  /** units to cover fixed costs, rounded up. null when unreachable (contribution ≤ 0). */
  breakEvenUnits: number | null;
  /** true once there's a price and each sale contributes something. */
  viable: boolean;
}

function stageFor(marginPct: number): ViabilityStage {
  if (marginPct < 0.2) return "Thin margins";
  if (marginPct < 0.4) return "Workable";
  if (marginPct < 0.6) return "Healthy";
  return "Strong margins";
}

/**
 * A viability read from the economics and the offer's price (major units).
 * Honest and simple: the headline is contribution margin — how much of each
 * sale is profit that pays down fixed costs — because without a real volume
 * that's the truest single signal of whether the model can work.
 */
export function economicsViability(econ: EconomicsData, priceMajor: number): Viability {
  const price = money(priceMajor);
  const variable = money(econ.variableCostPerUnit);
  const contributionPerUnit = price - variable;
  const contributionMarginPct = price > 0 ? contributionPerUnit / price : null;
  const viable = price > 0 && contributionPerUnit > 0;
  const breakEvenUnits = contributionPerUnit > 0 ? Math.ceil(money(econ.fixedCosts) / contributionPerUnit) : null;

  if (!viable) {
    return { score: 0, stage: "Not viable", contributionPerUnit, contributionMarginPct, breakEvenUnits, viable: false };
  }
  const score = Math.max(0, Math.min(100, Math.round((contributionMarginPct ?? 0) * 100)));
  return { score, stage: stageFor(contributionMarginPct ?? 0), contributionPerUnit, contributionMarginPct, breakEvenUnits, viable: true };
}
