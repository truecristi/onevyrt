"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import {
  simulate, type Decision, type ScenarioOverride, type ScenarioComparison, type Scenario,
  solveGoal, type GoalMetric, type SolveResult, type Funnel,
  headToHead, HEAD_TO_HEAD_BASE_ID,
} from "@onevyrt/engine";
import type { RFNodeData } from "../../lib/funnel-map";
import { ACCENT, barBtn, barGhost, barPrimary, FIELDS_BY_KIND, toEngineValue, money, num, signedMoney, type FieldSpec } from "../../lib/studio-ui";
import { TextRow } from "./ReportPanels";

export const GOAL_METRICS: { key: GoalMetric; label: string; money: boolean }[] = [
  { key: "grossProfit", label: "Gross profit", money: true },
  { key: "revenue", label: "Revenue", money: true },
  { key: "mrr", label: "MRR", money: true },
  { key: "ltv", label: "LTV (new subs)", money: true },
  { key: "cost", label: "Cost", money: true },
  { key: "buyers", label: "Buyers", money: false },
];

export function SimulatePanel({ nodes, candidate, setCandidate, comparison, patch, onPromote }: {
  nodes: Node[];
  candidate: ScenarioOverride[];
  setCandidate: (updater: (xs: ScenarioOverride[]) => ScenarioOverride[]) => void;
  comparison: ScenarioComparison | null;
  patch: (id: string, changes: Partial<RFNodeData>) => void;
  onPromote: (input: Omit<Decision, "id" | "createdAt" | "status" | "measurement">) => void;
}) {
  const [nodeId, setNodeId] = useState<string>(nodes[0]?.id ?? "");
  const kind = (nodes.find((n) => n.id === nodeId)?.data?.kind as string) ?? "offer";
  const fields = FIELDS_BY_KIND[kind] ?? [];
  const [fieldKey, setFieldKey] = useState<string>(fields[0]?.key ?? "");
  const [valueStr, setValueStr] = useState("");
  const spec = fields.find((f) => f.key === fieldKey) ?? fields[0];
  const labelOf = (id: string) => (nodes.find((n) => n.id === id)?.data?.label as string) ?? id;
  const dispOf = (o: ScenarioOverride) => {
    const k = (nodes.find((n) => n.id === o.nodeId)?.data?.kind as string) ?? "offer";
    const sp = (FIELDS_BY_KIND[k] ?? []).find((f) => f.key === o.field);
    const v = sp?.unit === "rate" ? `${(o.value * 100).toFixed(1)}%` : sp?.unit === "money" ? money(o.value) : num(o.value);
    return `${labelOf(o.nodeId)}: ${sp?.label ?? o.field} = ${v}`;
  };

  const add = () => {
    if (!spec) return;
    const disp = parseFloat(valueStr); if (Number.isNaN(disp)) return;
    const value = toEngineValue(spec.unit, disp);
    setCandidate((xs) => [...xs.filter((o) => !(o.nodeId === nodeId && o.field === spec.key)), { nodeId, field: spec.key, value }]);
    setValueStr("");
  };
  const applyToPlan = () => { candidate.forEach((o) => patch(o.nodeId, { [o.field]: o.value } as Partial<RFNodeData>)); setCandidate(() => []); };
  const cand = comparison?.scenarios[0];
  const promote = () => {
    if (candidate.length === 0) return;
    const summary = candidate.map(dispOf).join("; ");
    onPromote({ problem: "Candidate tested in SIMULATE", hypothesis: `Applying — ${summary}`, move: summary, reason: "Simulated against the current baseline before deciding.", expectedImpact: cand ? `Gross profit ${signedMoney(cand.delta.grossProfit)}` : "n/a", confidence: "medium", owner: "", dueDate: "", linkedNodeId: candidate[0]?.nodeId });
  };

  const inp: CSSProperties = { flex: 1, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13, minWidth: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--dim)" }}>The current plan is the protected baseline. Add changes to test a candidate without touching it.</div>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); const k = (nodes.find((n) => n.id === e.target.value)?.data?.kind as string) ?? "offer"; setFieldKey((FIELDS_BY_KIND[k] ?? [])[0]?.key ?? ""); }} style={inp}>
          {nodes.map((n) => (<option key={n.id} value={n.id}>{(n.data?.label as string) ?? n.id}</option>))}
        </select>
        <select value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} style={inp}>
          {fields.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="new value" style={inp} inputMode="decimal" />
        <button onClick={add} style={barBtn}>Add change</button>
      </div>

      {candidate.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {candidate.map((o, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 8px", fontSize: 13 }}>
              <span>{dispOf(o)}</span>
              <button onClick={() => setCandidate((xs) => xs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 13 }} aria-label="Remove">×</button>
            </div>
          ))}
        </div>
      )}

      {cand && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Candidate vs baseline</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: cand.delta.grossProfit >= 0 ? "#4ade80" : "#f87171" }}>{signedMoney(cand.delta.grossProfit)} profit</div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>Revenue {signedMoney(cand.delta.revenue)} · Buyers {cand.delta.buyers >= 0 ? "+" : ""}{num(cand.delta.buyers)}{cand.delta.mrr ? ` · MRR ${signedMoney(cand.delta.mrr)}/mo` : ""}</div>
        </div>
      )}

      {candidate.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={applyToPlan} style={{ ...barPrimary, width: "100%" }}>Apply to plan</button>
          <button onClick={promote} style={{ ...barBtn, width: "100%" }}>Promote to decision</button>
          <button onClick={() => setCandidate(() => [])} style={{ ...barGhost, width: "100%" }}>Clear candidate</button>
        </div>
      )}
    </div>
  );
}

const LEVERS: { key: string; label: string }[] = [
  { key: "visitors", label: "Traffic volume" },
  { key: "costPerVisitor", label: "Traffic unit cost" },
  { key: "passRate", label: "Pass rate" },
  { key: "conversionRate", label: "Conversion rate" },
  { key: "price", label: "Selling price" },
  { key: "yesRate", label: "Split yes rate" },
  { key: "refundRate", label: "Refund rate" },
  { key: "unitCost", label: "Unit cost" },
  { key: "merchantFeeRate", label: "Merchant fee rate" },
  { key: "orderBumpRate", label: "Order bump rate" },
  { key: "upsellRate", label: "Upsell rate" },
  { key: "expenseAmount", label: "Node expense amount" },
  { key: "expenseRate", label: "Node expense rate" },
];
interface SolveRow { nodeId: string; nodeLabel: string; field: string; leverLabel: string; unit: FieldSpec["unit"]; from: number; to: number; changePct: number; res: SolveResult; }

export function GoalSolver({ funnel, nodes, patch }: { funnel: Funnel | null; nodes: Node[]; patch: (id: string, changes: Partial<RFNodeData>) => void }) {
  const [metric, setMetric] = useState<GoalMetric>("grossProfit");
  const [targetStr, setTargetStr] = useState("");
  const [bound, setBound] = useState(5);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(() => Object.fromEntries(LEVERS.map((l) => [l.key, true])));
  const [rows, setRows] = useState<SolveRow[] | null>(null);
  const [appliedKey, setAppliedKey] = useState("");

  const mSpec = GOAL_METRICS.find((x) => x.key === metric)!;
  const current = useMemo(() => {
    if (!funnel) return null;
    try { const t = simulate(funnel).totals as unknown as Record<string, number>; return t[metric] ?? 0; } catch { return null; }
  }, [funnel, metric]);

  const solveAll = () => {
    if (!funnel) return;
    const disp = parseFloat(targetStr);
    if (Number.isNaN(disp)) { setRows([]); return; }
    const targetVal = mSpec.money ? Math.round(disp * 100) : disp;
    const found: SolveRow[] = [];
    for (const n of nodes) {
      const d = n.data as RFNodeData;
      const specs = FIELDS_BY_KIND[d.kind as string] ?? [];
      for (const lv of LEVERS) {
        if (!allowed[lv.key]) continue;
        const spec = specs.find((f) => f.key === lv.key);
        if (!spec) continue;
        const cur = typeof d[lv.key] === "number" ? (d[lv.key] as number) : 0;
        const max = spec.unit === "rate" ? 1 : Math.max(1, Math.abs(cur) * bound || bound);
        try {
          const res = solveGoal(funnel, { metric, value: targetVal }, { nodeId: n.id, field: spec.key, min: 0, max });
          if (!res.reachable) continue;
          const changePct = cur !== 0 ? Math.abs(res.leverValue - cur) / Math.abs(cur) : 1;
          found.push({ nodeId: n.id, nodeLabel: d.label ?? n.id, field: spec.key, leverLabel: lv.label, unit: spec.unit, from: cur, to: res.leverValue, changePct, res });
        } catch { /* this lever cannot move this funnel; try the next */ }
      }
    }
    found.sort((a, b) => a.changePct - b.changePct); // smallest change that works wins
    setRows(found); setAppliedKey("");
  };

  const fmt = (unit: FieldSpec["unit"], v: number) =>
    unit === "rate" ? (v * 100).toFixed(1) + "%" : unit === "money" ? money(Math.round(v)) : num(v);

  const allOn = LEVERS.every((l) => allowed[l.key]);
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>ONEVYRT PILLAR</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Goal Solver</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>Reverse-solve the deterministic PLAN. Nothing changes until you apply a solution.</div>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Target KPI</span>
        <select value={metric} onChange={(e) => { setMetric(e.target.value as GoalMetric); setRows(null); }}
          style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}>
          {GOAL_METRICS.map((x) => (<option key={x.key} value={x.key}>{x.label}</option>))}
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 4 }}>
        <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>TARGET VALUE</span>
        <input value={targetStr} onChange={(e) => setTargetStr(e.target.value)} placeholder={current != null ? String(mSpec.money ? Math.round((current * 1.2) / 100) : Math.round(current * 1.2)) : "0"}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
      </label>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        {current != null ? <>Current {mSpec.money ? money(current) : num(current)} · must be at or above target</> : "Build a valid funnel to solve."}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label style={{ flex: 1 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>MAX CHANGES</span>
          <select disabled style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--muted)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}>
            <option>1 lever</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>SEARCH BOUND</span>
          <select value={bound} onChange={(e) => setBound(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}>
            {[2, 5, 10, 25].map((b) => <option key={b} value={b}>{b}x</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>ALLOWED LEVERS</span>
        <button onClick={() => setAllowed(Object.fromEntries(LEVERS.map((l) => [l.key, !allOn])))} style={{ ...barGhost, padding: "2px 7px", fontSize: 11 }}>{allOn ? "None" : "All"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
        {LEVERS.map((l) => (
          <label key={l.key} style={{ flex: "1 1 46%", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", fontSize: 11, cursor: "pointer" }}>
            <input type="checkbox" checked={!!allowed[l.key]} onChange={(e) => setAllowed((a) => ({ ...a, [l.key]: e.target.checked }))} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</span>
          </label>
        ))}
      </div>

      <button onClick={solveAll} disabled={!funnel} style={{ ...barPrimary, width: "100%", padding: "9px 14px", opacity: funnel ? 1 : 0.5 }}>{"▷ Solve against PLAN"}</button>

      {rows && rows.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          No single allowed lever reaches that target within the {bound}x bound. Try a bigger bound, more levers, or a lower target.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{rows.length} way{rows.length > 1 ? "s" : ""} to hit it — smallest change first</div>
          {rows.slice(0, 8).map((r) => {
            const key = r.nodeId + r.field;
            return (
              <div key={key} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "var(--surface2)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.leverLabel} <span style={{ color: "var(--dim)", fontWeight: 400 }}>on {r.nodeLabel}</span></div>
                <div style={{ fontSize: 13, color: "var(--muted)", margin: "3px 0 6px" }}>
                  {fmt(r.unit, r.from)} {"→"} <span style={{ color: ACCENT, fontWeight: 700 }}>{fmt(r.unit, r.to)}</span>
                  <span style={{ color: "var(--dim)" }}> · {(r.changePct * 100).toFixed(0)}% change</span>
                </div>
                <button onClick={() => { patch(r.nodeId, { [r.field]: r.to } as Partial<RFNodeData>); setAppliedKey(key); }}
                  style={{ ...barGhost, fontSize: 11, color: appliedKey === key ? "#16a34a" : "var(--text)" }}>{appliedKey === key ? "✓ Applied" : "Apply"}</button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--dim)" }}>Deterministic bounded search only. No AI, no random search, no silent PLAN mutation.</div>
    </div>
  );
}


export function ScenarioCompare({ comparison, mode }: { comparison: ScenarioComparison | null; mode: "scenarios" | "simulate" }) {
  if (!comparison) {
    const msg = mode === "simulate"
      ? "Nothing to compare yet — pick a node and field on the right, type a new value, and hit “Add change.” This tests it against your plan without touching it."
      : "No saved scenarios yet — build one on the right (pick a node, change a value, save it) to compare it against your plan.";
    return <div style={{ padding: 24, color: "var(--dim)", maxWidth: 420 }}>{msg}</div>;
  }
  const rows: { k: string; get: (t: ScenarioComparison["base"]) => number; money: boolean; suffix?: string }[] = [
    { k: "Revenue", get: (t) => t.revenue, money: true },
    { k: "Gross Profit", get: (t) => t.grossProfit, money: true },
    { k: "MRR", get: (t) => t.mrr ?? 0, money: true, suffix: "/mo" },
    { k: "Buyers", get: (t) => t.buyers, money: false },
    { k: "Ad Cost", get: (t) => t.cost, money: true },
  ];
  const cell = (v: number, isMoney: boolean, suffix = "") => (isMoney ? money(v) : num(v)) + suffix;
  const th: CSSProperties = { textAlign: "right", padding: "8px 14px", fontSize: 13, color: "var(--muted)", fontWeight: 500, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" };
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Scenario comparison</div>
      <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>Each variant is simulated against the base plan; deltas are vs base.</div>
      <table style={{ borderCollapse: "collapse", minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Metric</th>
            <th style={th}>Base</th>
            {comparison.scenarios.map((sc) => (<th key={sc.id} style={{ ...th, color: "var(--text)" }}>{sc.name}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td, textAlign: "left", color: "var(--muted)" }}>{r.k}</td>
              <td style={{ ...td, fontWeight: 500 }}>{cell(r.get(comparison.base), r.money, r.suffix)}</td>
              {comparison.scenarios.map((sc) => {
                const val = r.get(sc.totals);
                const d = val - r.get(comparison.base);
                const col = d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "var(--dim)";
                return (
                  <td key={sc.id} style={td}>
                    <div style={{ fontWeight: 500 }}>{cell(val, r.money, r.suffix)}</div>
                    {d !== 0 && <div style={{ fontSize: 11, color: col }}>{d > 0 ? "+" : ""}{r.money ? money(d) : num(d)}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {comparison.scenarios.length === 0 && (
        <div style={{ color: "var(--dim)", fontSize: 13, marginTop: 16 }}>No scenarios yet. Use the builder on the right to add a what-if variant.</div>
      )}
      {mode === "scenarios" && comparison.scenarios.length > 0 && <HeadToHeadCompare comparison={comparison} rows={rows} cell={cell} />}
    </div>
  );
}

type CompareRow = { k: string; get: (t: ScenarioComparison["base"]) => number; money: boolean; suffix?: string };

/** A/B head-to-head: pick any two sides (the base plan or a saved scenario)
 *  and see them side-by-side with the B−A delta between them. */
function HeadToHeadCompare({ comparison, rows, cell }: {
  comparison: ScenarioComparison;
  rows: CompareRow[];
  cell: (v: number, isMoney: boolean, suffix?: string) => string;
}) {
  const sides = useMemo(
    () => [{ id: HEAD_TO_HEAD_BASE_ID, name: "Base plan" }, ...comparison.scenarios.map((s) => ({ id: s.id, name: s.name }))],
    [comparison],
  );
  const [aId, setAId] = useState(HEAD_TO_HEAD_BASE_ID);
  const [bId, setBId] = useState(comparison.scenarios[0]?.id ?? HEAD_TO_HEAD_BASE_ID);
  // Keep the selections valid if scenarios are added/removed.
  const aValid = sides.some((s) => s.id === aId) ? aId : HEAD_TO_HEAD_BASE_ID;
  const bValid = sides.some((s) => s.id === bId) ? bId : (comparison.scenarios[0]?.id ?? HEAD_TO_HEAD_BASE_ID);
  const h = headToHead(comparison, aValid, bValid);

  const sel: CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 7, padding: "5px 8px", fontSize: 13, maxWidth: 200 };
  const th: CSSProperties = { textAlign: "right", padding: "8px 14px", fontSize: 13, color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" };

  return (
    <div style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>A/B head-to-head</div>
      <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 12 }}>Compare any two directly — the delta is B minus A.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>A</label>
        <select value={aValid} onChange={(e) => setAId(e.target.value)} style={sel}>
          {sides.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ color: "var(--dim)", fontWeight: 700 }}>vs</span>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>B</label>
        <select value={bValid} onChange={(e) => setBId(e.target.value)} style={sel}>
          {sides.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {h && (
        <table style={{ borderCollapse: "collapse", minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", color: "var(--muted)" }}>Metric</th>
              <th style={th}>{h.a.name} (A)</th>
              <th style={th}>{h.b.name} (B)</th>
              <th style={{ ...th, color: "var(--muted)" }}>B − A</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const av = r.get(h.a.totals), bv = r.get(h.b.totals), d = bv - av;
              const col = d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "var(--dim)";
              return (
                <tr key={r.k} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, textAlign: "left", color: "var(--muted)" }}>{r.k}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{cell(av, r.money, r.suffix)}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{cell(bv, r.money, r.suffix)}</td>
                  <td style={{ ...td, color: col, fontWeight: 500 }}>{d !== 0 ? `${d > 0 ? "+" : ""}${r.money ? money(d) : num(d)}${r.suffix ?? ""}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ScenarioBuilder({ nodes, scenarios, onAdd, onDelete }: {
  nodes: Node[];
  scenarios: Scenario[];
  onAdd: (sc: Scenario) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [nodeId, setNodeId] = useState<string>(nodes[0]?.id ?? "");
  const node = nodes.find((n) => n.id === nodeId);
  const kind = (node?.data?.kind as string) ?? "offer";
  const fields = FIELDS_BY_KIND[kind] ?? [];
  const [fieldKey, setFieldKey] = useState<string>(fields[0]?.key ?? "");
  const [valueStr, setValueStr] = useState("");
  const [pending, setPending] = useState<{ nodeId: string; field: string; label: string; value: number }[]>([]);

  const spec = fields.find((f) => f.key === fieldKey) ?? fields[0];
  const addOverride = () => {
    if (!node || !spec) return;
    const disp = parseFloat(valueStr); if (Number.isNaN(disp)) return;
    setPending((xs) => [...xs, { nodeId: node.id, field: spec.key, label: `${(node.data?.label as string) ?? node.id}: ${spec.label} = ${valueStr}`, value: toEngineValue(spec.unit, disp) }]);
    setValueStr("");
  };
  const save = () => {
    if (pending.length === 0) return;
    onAdd({ id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())), name: name.trim() || `Scenario ${scenarios.length + 1}`, overrides: pending.map(({ nodeId, field, value }) => ({ nodeId, field, value })) });
    setName(""); setPending([]);
  };

  return (
    <div>
      <TextRow label="Scenario name" value={name} onChange={setName} placeholder="e.g. Add upsell" />
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); const k = (nodes.find((n) => n.id === e.target.value)?.data?.kind as string) ?? "offer"; setFieldKey((FIELDS_BY_KIND[k] ?? [])[0]?.key ?? ""); }}
          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13 }}>
          {nodes.map((n) => (<option key={n.id} value={n.id}>{(n.data?.label as string) ?? n.id}</option>))}
        </select>
        <select value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}
          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13 }}>
          {fields.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input type="number" placeholder="new value" value={valueStr} onChange={(e) => setValueStr(e.target.value)}
          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }} />
        <button onClick={addOverride} style={barGhost}>+ override</button>
      </div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {pending.map((o, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--muted)", padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
              <span>{o.label}</span>
              <button onClick={() => setPending((xs) => xs.filter((_, j) => j !== i))} style={{ ...barGhost, padding: "0 6px" }}>x</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={save} style={{ ...barBtn, width: "100%", marginBottom: 14 }}>Save scenario</button>

      {scenarios.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>SAVED SCENARIOS</div>}
      {scenarios.map((sc) => (
        <div key={sc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{sc.name}</div>
            <div style={{ fontSize: 11, color: "var(--dim)" }}>{sc.overrides.length} override{sc.overrides.length === 1 ? "" : "s"}</div>
          </div>
          <button onClick={() => onDelete(sc.id)} style={barGhost}>Delete</button>
        </div>
      ))}
    </div>
  );
}
