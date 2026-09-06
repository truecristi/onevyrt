"use client";
/**
 * Result / metric summary-card rows for the Studio context bar, extracted from
 * funnel-studio.tsx (task #8, split slice 2). Pure render helpers — kept as
 * plain functions (called, not rendered as elements) so behaviour is identical
 * to the inline versions. Structural prop types match exactly the fields read,
 * so no engine-type archaeology and tsc still verifies every call site.
 */
import type { CSSProperties, ReactNode } from "react";
import { money, num, signedMoney } from "../../lib/studio-ui";
import { DATE_PERIOD_MULT, type DatePeriod } from "../../lib/studio/funnel-constants";
import type { Mode } from "../../lib/studio/types";

export interface KpiPlan { visitors: number; buyers: number; revenue: number; cost: number; grossProfit: number; mrr?: number; ltv?: number }
export interface KpiActuals { visitors: number; buyers: number; revenue: number; cost: number; grossProfit: number }

export function kpiCards(plan: KpiPlan | null, actualTotals: KpiActuals, datePeriod: DatePeriod, mode: Mode): ReactNode {
  const rows = [
    { k: "Visitors", term: "visitors", better: "up", plan: plan?.visitors ?? 0, actual: actualTotals.visitors, money: false, tint: "#60a5fa" },
    { k: "Buyers", term: "buyers", better: "up", plan: plan?.buyers ?? 0, actual: actualTotals.buyers, money: false, tint: "#a78bfa" },
    { k: "Revenue", term: "revenue", better: "up", plan: plan?.revenue ?? 0, actual: actualTotals.revenue, money: true, tint: "#34d399" },
    { k: "Total Cost", term: "totalCost", better: "down", plan: plan?.cost ?? 0, actual: actualTotals.cost, money: true, tint: "#fb923c" },
    { k: "Gross Profit", term: "grossProfit", better: "up", plan: plan?.grossProfit ?? 0, actual: actualTotals.grossProfit, money: true, tint: "#4ade80" },
  ] as const;
  const periodMult = DATE_PERIOD_MULT[datePeriod];
  const cardStyle = (accent: boolean): CSSProperties => ({
    background: accent ? "var(--good-bg)" : "var(--surface)",
    border: `1px solid ${accent ? "var(--good-border)" : "var(--border2)"}`,
    borderRadius: 8, padding: "4px 10px", minWidth: 86,
  });
  const cards = rows.map((r, i) => {
    const showActual = mode === "actual";
    const planVal = mode === "plan" ? Math.round(r.plan * periodMult) : r.plan;
    const val = showActual ? r.actual : planVal;
    const delta = r.actual - r.plan;
    const good = r.better === "up" ? delta >= 0 : delta <= 0;
    const accent = i === 4;
    return (
      <div key={r.k} style={cardStyle(accent)}>
        <div data-term={r.term} style={{ fontSize: 10, color: "var(--muted)" }}>{r.k}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: r.tint }}>{r.money ? money(val) : num(val)}</div>
        <div style={{ fontSize: 10, marginTop: 1, lineHeight: 1.3, color: good ? "#4ade80" : "#f87171", visibility: showActual ? "visible" : "hidden" }}>
          {showActual ? <>plan {r.money ? money(r.plan) : num(r.plan)} · {r.money ? signedMoney(delta) : (delta >= 0 ? "+" : "") + num(delta)}</> : " "}
        </div>
      </div>
    );
  });
  // ROAS / CPA / AOV — derived, never stored
  {
    const showActual = mode === "actual";
    const src = showActual ? actualTotals : (plan ?? { revenue: 0, cost: 0, buyers: 0, visitors: 0, grossProfit: 0 });
    const roas = src.cost > 0 ? src.revenue / src.cost : null;
    const cpa = src.buyers > 0 ? Math.round(src.cost / src.buyers) : null;
    const aov = src.buyers > 0 ? Math.round(src.revenue / src.buyers) : null;
    const derived: { k: string; term: string; v: string; c: string }[] = [
      { k: "ROAS", term: "roas", v: roas != null ? roas.toFixed(2) + "x" : "—", c: roas != null && roas >= 1 ? "#16a34a" : "#e11d48" },
      { k: "CPA", term: "cpa", v: cpa != null ? money(cpa) : "—", c: "#fb923c" },
      { k: "AOV", term: "aov", v: aov != null ? money(aov) : "—", c: "#38bdf8" },
    ];
    for (const dcard of derived) {
      cards.push(
        <div key={dcard.k} style={cardStyle(false)}>
          <div data-term={dcard.term} style={{ fontSize: 10, color: "var(--muted)" }}>{dcard.k}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: dcard.c }}>{dcard.v}</div>
          <div style={{ fontSize: 10, marginTop: 1, visibility: "hidden" }}>{" "}</div>
        </div>,
      );
    }
  }
  if (plan?.mrr) {
    cards.push(
      <div key="MRR" style={cardStyle(false)}>
        <div data-term="mrr" style={{ fontSize: 10, color: "var(--muted)" }}>MRR</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{money(plan.mrr)}/mo</div>
        <div style={{ fontSize: 10, marginTop: 1, visibility: "hidden" }}>{" "}</div>
      </div>,
    );
  }
  if (plan?.ltv) {
    cards.push(
      <div key="LTV" style={cardStyle(false)}>
        <div data-term="ltv" style={{ fontSize: 10, color: "var(--muted)" }}>LTV (new subs)</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#2dd4bf" }}>{money(plan.ltv)}</div>
        <div style={{ fontSize: 10, marginTop: 1, visibility: "hidden" }}>{" "}</div>
      </div>,
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, minWidth: 0, paddingBottom: 1 }}>
      {cards}
    </div>
  );
}

export interface VarianceSummary { planProfit: number; actualProfit: number; profitGap: number; biggestLeak: { nodeId: string; profitImpact: number } | null }

export function varianceCards(variance: VarianceSummary | null, labelOf: Record<string, string>): ReactNode {
  if (!variance) return <div style={{ color: "var(--dim)", fontSize: 13 }}>Switch to ACTUAL and enter observed numbers to see the leak.</div>;
  const cards: { k: string; v: string; c: string }[] = [
    { k: "Plan Profit", v: money(variance.planProfit), c: "var(--text)" },
    { k: "Actual Profit", v: money(variance.actualProfit), c: "var(--text)" },
    { k: "Profit Gap", v: signedMoney(variance.profitGap), c: variance.profitGap >= 0 ? "#4ade80" : "#f87171" },
    { k: "Biggest Leak", v: variance.biggestLeak ? `${labelOf[variance.biggestLeak.nodeId]} ${signedMoney(variance.biggestLeak.profitImpact)}` : "none", c: variance.biggestLeak ? "#f87171" : "#4ade80" },
  ];
  return cards.map((c) => (
    <div key={c.k} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: "8px 14px", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.k}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: c.c }}>{c.v}</div>
    </div>
  ));
}

/** Reworked to take derived primitives (plan/corrected profit + proposal count)
 *  so the module needs no calibration/sim engine types; the call site computes
 *  them exactly as before. proposalsCount === 0 renders the empty prompt. */
export function calibrateCards(proposalsCount: number, planProfit: number, corrProfit: number): ReactNode {
  if (proposalsCount === 0)
    return <div style={{ color: "var(--dim)", fontSize: 13 }}>Enter actuals (ACTUAL mode) to calibrate the plan to reality.</div>;
  const up = corrProfit >= planProfit;
  const cards = [
    { k: "Plan Profit", v: money(planProfit), c: "var(--text)" },
    { k: "Corrected Profit", v: money(corrProfit), c: up ? "#4ade80" : "#f87171" },
    { k: "Correction", v: signedMoney(corrProfit - planProfit), c: up ? "#4ade80" : "#f87171" },
    { k: "Proposals", v: String(proposalsCount), c: "var(--text)" },
  ];
  return cards.map((c) => (
    <div key={c.k} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: "8px 14px", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.k}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: c.c }}>{c.v}</div>
    </div>
  ));
}

export interface DecideSummary { total: number; open: number; hit: number; missed: number }

export function decideCards(sum: DecideSummary): ReactNode {
  const cards = [
    { k: "Decisions", v: String(sum.total), c: "var(--text)" },
    { k: "Open", v: String(sum.open), c: sum.open ? "#f59e0b" : "var(--muted)" },
    { k: "Hit", v: String(sum.hit), c: sum.hit ? "#4ade80" : "var(--muted)" },
    { k: "Missed", v: String(sum.missed), c: sum.missed ? "#f87171" : "var(--muted)" },
  ];
  return cards.map((c) => (
    <div key={c.k} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: "8px 14px", minWidth: 96 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.k}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: c.c }}>{c.v}</div>
    </div>
  ));
}
