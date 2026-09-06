"use client";

import { useState, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import {
  type NodeResult, type NodeActuals, type Variant,
  type AssumptionEntry, type AssumptionConfidence, type ExperimentEntry,
  type GoalNode, type GoalLevel, type RiskRegisterEntry,
  findBlockOps, isBlockOpsStarted, type BlockOpsEntry, type BlockOpsKpi, type ApprovalStatus, type IntegrationStatus,
} from "@onevyrt/engine";
import type { RFNodeData } from "../../lib/funnel-map";
import { ACCENT, barGhost, money, num as fmtNum } from "../../lib/studio-ui";
import type { InspTab } from "../../lib/studio/types";
import { NotesAiDraft } from "./NotesAiDraft";
// Extracted inspector sub-components
import {
  Field,
  InspField,
  NumBox,
  StatBox,
  uiOf,
  activeVariants,
  weightedPrice,
  netPerSale,
  APPROVAL_COPY,
  INTEGRATION_COPY,
  THEME_COLOURS,
} from "./inspector";

// Re-export for backward compatibility
export { Field, InspField, NumBox, StatBox, uiOf, activeVariants, weightedPrice, netPerSale };

const INSP_TABS: { id: InspTab; label: string }[] = [
  { id: "basics", label: "Basics" }, { id: "numbers", label: "Numbers" }, { id: "advanced", label: "Advanced" },
];
export function InspectorTabs({ node, tab, setTab, patch, patchActual, actual, res, canEdit, blockOps, updateBlockOps, assumptions, experiments, riskRegister, goals, updateAssumption, addAssumption, updateExperiment, addExperiment, updateGoal, addGoal }: {
  node: Node; tab: InspTab; setTab: (t: InspTab) => void;
  patch: (id: string, c: Partial<RFNodeData>) => void;
  patchActual: (id: string, c: Partial<NodeActuals>) => void;
  actual: NodeActuals; res: NodeResult | undefined; canEdit: boolean;
  blockOps: BlockOpsEntry[]; updateBlockOps: (nodeId: string, patch: Partial<Omit<BlockOpsEntry, "id" | "linkedNodeId" | "createdAt">>) => void;
  assumptions: AssumptionEntry[]; experiments: ExperimentEntry[]; riskRegister: RiskRegisterEntry[]; goals: GoalNode[];
  updateAssumption: (id: string, patch: Partial<Omit<AssumptionEntry, "id" | "createdAt">>) => void;
  addAssumption: (text: string, confidence: AssumptionConfidence, category?: string, linkedNodeId?: string) => void;
  updateExperiment: (id: string, patch: Partial<Omit<ExperimentEntry, "id" | "createdAt">>) => void;
  addExperiment: (hypothesis: string, linkedAssumptionId?: string, linkedNodeId?: string) => void;
  updateGoal: (id: string, patch: Partial<Omit<GoalNode, "id" | "createdAt">>) => void;
  addGoal: (level: GoalLevel, title: string, parentId?: string, linkedNodeId?: string) => void;
}) {
  const d = node.data as RFNodeData; const id = node.id;
  const ui = uiOf(node);
  const setUi = (k: string, v: string | number | boolean) => patch(id, { ui: { ...ui, [k]: v } } as Partial<RFNodeData>);
  const inflow = res?.inflow ?? 0;
  const yes = res ? (d.kind === "split" ? (res.emissions.yes ?? 0) : res.buyers || (res.emissions.out ?? 0)) : 0;
  const no = Math.max(0, inflow - yes);
  const projSold = res?.buyers ?? 0;
  const actSold = actual.buyers;
  const diff = actSold != null ? actSold - projSold : null;
  const acc = actSold != null && projSold > 0 ? (1 - Math.abs(actSold - projSold) / projSold) * 100 : null;
  const avg = projSold > 0 && res ? Math.round(res.revenue / projSold) : 0;
  return (
    <div>
      <div role="tablist" aria-label="Block inspector sections" style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 12, overflowX: "auto" }}>
        {INSP_TABS.map((t, i) => {
          const opsEntry = t.id === "advanced" ? findBlockOps(blockOps, id) : null;
          const opsStarted = opsEntry != null && isBlockOpsStarted(opsEntry);
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const n = (i + dir + INSP_TABS.length) % INSP_TABS.length;
                setTab(INSP_TABS[n]!.id);
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
              }}
              onClick={() => setTab(t.id)}
              style={{ background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? ACCENT : "transparent"}`,
                color: tab === t.id ? ACCENT : "var(--muted)", padding: "6px 8px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
              {t.label}{opsStarted && <span style={{ color: ACCENT }}> •</span>}
            </button>
          );
        })}
      </div>
      {tab === "basics" && <PlanEditor node={node} patch={patch} />}
      {tab === "basics" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>PRODUCT CATALOGUE</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Offers, prices and costs</div>
          <InspField label="Product name" value={String(ui.productName ?? "")} onChange={(v) => setUi("productName", v)} placeholder={d.label} />
          <InspField label="Campaign" value={String(ui.campaign ?? "")} onChange={(v) => setUi("campaign", v)} placeholder="Launch campaign" />
          <InspField label="Sale page URL" value={String(ui.saleUrl ?? "")} onChange={(v) => setUi("saleUrl", v)} placeholder="https://..." />
          <InspField label="Checkout URL" value={String(ui.checkoutUrl ?? "")} onChange={(v) => setUi("checkoutUrl", v)} placeholder="https://..." />
          {d.kind === "traffic" && (
            <>
              <div style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 6px" }}>Volume and acquisition cost entering the funnel</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NumBox label="VISITORS" term="visitors" value={d.visitors ?? 0} step={100} onChange={(v) => patch(id, { visitors: Math.max(0, Math.round(v)) })} />
                <label style={{ flex: "1 1 44%", minWidth: 104 }}>
                  <span data-term="costModel" style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>COST MODEL</span>
                  <select value={(d.costModel as string) ?? "perVisitor"} onChange={(e) => patch(id, { costModel: e.target.value as "flat" | "perVisitor" } as Partial<RFNodeData>)}
                    style={{ width: "100%", marginTop: 3, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 7px", fontSize: 13 }}>
                    <option value="perVisitor">PER VISITOR</option>
                    <option value="flat">FLAT</option>
                  </select>
                </label>
                {d.costModel === "flat"
                  ? <NumBox label="TOTAL COST" term="flatCost" prefix="$" value={(d.flatCost ?? 0) / 100} step={10} onChange={(v) => patch(id, { flatCost: Math.round(v * 100) })} />
                  : <NumBox label="COST PER VISITOR" term="costPerVisitor" prefix="$" value={(d.costPerVisitor ?? 0) / 100} step={0.1} onChange={(v) => patch(id, { costPerVisitor: Math.round(v * 100) })} />}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <StatBox label="TOTAL COST" term="totalCostStat" value={money(res?.cost ?? 0)} />
                <StatBox label="INCOMING" term="incomingStat" value={fmtNum(res?.inflow ?? 0)} />
              </div>
            </>
          )}
          {d.kind === "offer" ? (
            <>
              <div style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 6px" }}>Price and cost assumptions behind every order</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NumBox label="PRICE" term="price" prefix="$" value={(d.price ?? 0) / 100} step={1} onChange={(v) => patch(id, { price: Math.round(v * 100) })} />
                <NumBox label="CONVERSION" term="conversionRate" suffix="%" value={(d.conversionRate ?? 0) * 100} step={0.1} onChange={(v) => patch(id, { conversionRate: v / 100 })} />
                <NumBox label="UNIT COST" term="unitCost" prefix="$" value={(d.unitCost ?? 0) / 100} step={1} onChange={(v) => patch(id, { unitCost: Math.round(v * 100) })} />
                <NumBox label="REFUND RATE" term="refundRate" suffix="%" value={(d.refundRate ?? 0) * 100} step={0.1} onChange={(v) => patch(id, { refundRate: v / 100 })} />
                <NumBox label="MERCHANT FEE" term="merchantFeeRate" suffix="%" value={(d.merchantFeeRate ?? 0) * 100} step={0.1} onChange={(v) => patch(id, { merchantFeeRate: v / 100 })} />
              </div>
              <VariantsEditor id={id} d={d} patch={patch} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <StatBox label="WEIGHTED PRICE" term="weightedPrice" value={money(weightedPrice(d))} />
                <StatBox label="REFUND LOSS" term="refundLoss" value={money(Math.round((d.price ?? 0) * (d.refundRate ?? 0)))} />
                <StatBox label="MERCHANT FEES" term="merchantFees" value={money(Math.round((d.price ?? 0) * (1 - (d.refundRate ?? 0)) * (d.merchantFeeRate ?? 0)))} />
                <StatBox label="UNIT COST" term="unitCost" value={money(d.unitCost ?? 0)} />
                <StatBox label="NET PER SALE" term="netPerSale" value={money(netPerSale(d))} tone={netPerSale(d) >= 0 ? "#16a34a" : "#e11d48"} />
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <StatBox label="PROJECTED REVENUE" term="revenue" value={money(res?.revenue ?? 0)} />
            </div>
          )}
          <div style={{ marginTop: 10, background: "var(--accent-soft)", border: "1px solid var(--border3)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>ACTUAL PERFORMANCE</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Observed facts are stored separately from PLAN assumptions — use ACTUAL in the loop.</div>
          </div>
        </div>
      )}
      {tab === "numbers" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>RESULTS</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Deterministic live output</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <StatBox label="INCOMING" value={fmtNum(inflow)} />
            <StatBox label="YES" value={fmtNum(yes)} />
            <StatBox label="NO" value={fmtNum(no)} />
            <StatBox label="REVENUE" value={money(res?.revenue ?? 0)} />
            <StatBox label="PROJECTED SOLD" value={fmtNum(projSold)} />
            <StatBox label="ACTUAL SOLD" value={actSold != null ? fmtNum(actSold) : "—"} />
            <StatBox label="DIFFERENCE" value={diff != null ? (diff >= 0 ? "+" : "") + fmtNum(diff) : "—"} tone={diff == null ? undefined : diff >= 0 ? "#16a34a" : "#e11d48"} />
            <StatBox label="ACCURACY %" value={acc != null ? acc.toFixed(0) + "%" : "—"} />
            <StatBox label="PROJECTED REVENUE" value={money(res?.revenue ?? 0)} />
            <StatBox label="ACTUAL REVENUE" value={actual.revenue != null ? money(actual.revenue) : "—"} />
            <StatBox label="AVERAGE SALE VALUE" value={money(avg)} />
          </div>
          <div style={{ marginTop: 10, background: "var(--good-bg)", border: "1px solid var(--good-border)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Official result source</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Deterministic OneVYRT engine — same numbers as the KPI bar.</div>
          </div>
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Observed (ACTUAL)</div>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Actual sold</span>
                <input type="number" value={actual.buyers ?? ""} onChange={(e) => patchActual(id, { buyers: e.target.value === "" ? undefined : Number(e.target.value) })}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
              </label>
            </div>
          )}
        </div>
      )}
      {tab === "numbers" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>OPTIONS</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Links and behaviour</div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", marginBottom: 8 }}>
            <input type="checkbox" checked={ui.showNo !== false} onChange={(e) => setUi("showNo", e.target.checked)} />
            <span><span style={{ fontSize: 13, fontWeight: 500 }}>Show No output</span><br /><span style={{ fontSize: 11, color: "var(--dim)" }}>Keep a visible non-converting route.</span></span>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", marginBottom: 10 }}>
            <input type="checkbox" checked={ui.singlePage === true} onChange={(e) => setUi("singlePage", e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Single-page checkout</span>
          </label>
          <InspField label="Website URL" value={String(ui.websiteUrl ?? "")} onChange={(v) => setUi("websiteUrl", v)} placeholder="https://..." />
          <InspField label="External link" value={String(ui.externalUrl ?? "")} onChange={(v) => setUi("externalUrl", v)} placeholder="https://..." />
        </div>
      )}
      {tab === "advanced" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>CUSTOMIZE</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Appearance and identity</div>
          <InspField label="Object name" value={d.label} onChange={(v) => patch(id, { label: v })} />
          <label style={{ display: "block", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Theme colour</span>
            <select value={String(ui.theme ?? "none")} onChange={(e) => setUi("theme", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}>
              {THEME_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <InspField label="Thumbnail ID" value={String(ui.thumbId ?? "")} onChange={(v) => setUi("thumbId", v)} />
          <InspField label="Custom image asset ID" value={String(ui.assetId ?? "")} onChange={(v) => setUi("assetId", v)} />
        </div>
      )}
      {tab === "advanced" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>NOTES</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Context for this block</div>
          {canEdit && <NotesAiDraft label={d.label} kind={d.kind} current={String(ui.notes ?? "")} onDraft={(t) => setUi("notes", t)} />}
          <textarea value={String(ui.notes ?? "")} onChange={(e) => setUi("notes", e.target.value)} placeholder="Why this block exists, what you are testing, what you decided…"
            style={{ width: "100%", boxSizing: "border-box", height: 180, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: 9, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      )}
      {tab === "advanced" && (
        <BlockOpsPanel id={id} entry={findBlockOps(blockOps, id)} update={(patch) => updateBlockOps(id, patch)} canEdit={canEdit}
          assumptions={assumptions} updateAssumption={updateAssumption} addAssumption={addAssumption}
          experiments={experiments} updateExperiment={updateExperiment} addExperiment={addExperiment}
          goals={goals} updateGoal={updateGoal} addGoal={addGoal}
          linkedRisks={riskRegister.filter((r) => r.linkedNodeId === id)} />
      )}
    </div>
  );
}

/** Editable price-variant ladder for an offer node (e.g. a $47/$97/$197 price
 *  test) — activeVariants()/weightedPrice() (./inspector/utils) read
 *  d.variants for the live calculation; this is where each variant's name,
 *  price and buyer share is authored. Retiring one flips `active` rather
 *  than deleting it, matching Variant.active's "kept for history" contract. */
function VariantsEditor({ id, d, patch }: { id: string; d: RFNodeData; patch: (id: string, c: Partial<RFNodeData>) => void }) {
  const variants = d.variants ?? [];
  const setVariants = (next: Variant[]) => patch(id, { variants: next });
  const updateAt = (i: number, c: Partial<Variant>) => {
    const next = variants.slice();
    next[i] = { ...next[i]!, ...c };
    setVariants(next);
  };
  const addVariant = () => setVariants([...variants, { id: `variant-${Date.now().toString(36)}`, name: `Variant ${variants.length + 1}`, price: d.price ?? 0, share: 1 }]);
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500, marginBottom: 4 }}>PRICE VARIANTS (optional)</div>
      {variants.map((v, i) => (
        <div key={v.id} style={{ display: "flex", alignItems: "flex-end", gap: 6, flexWrap: "wrap", marginBottom: 6, opacity: v.active === false ? 0.55 : 1 }}>
          <label style={{ flex: "1 1 30%", minWidth: 96 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>NAME</span>
            <input value={v.name ?? ""} onChange={(e) => updateAt(i, { name: e.target.value })} placeholder={`Variant ${i + 1}`}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 3, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 7px", fontSize: 13 }} />
          </label>
          <NumBox label="PRICE" term="variantPrice" prefix="$" value={v.price / 100} step={1} onChange={(val) => updateAt(i, { price: Math.round(val * 100) })} />
          <NumBox label="SHARE" term="variantShare" suffix="%" value={Math.round(v.share * 1000) / 10} step={1} onChange={(val) => updateAt(i, { share: val / 100 })} />
          <button onClick={() => updateAt(i, { active: v.active === false })} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>
            {v.active === false ? "Enable" : "Disable"}
          </button>
          <button onClick={() => removeVariant(i)} style={{ ...barGhost, padding: "1px 6px", fontSize: 11 }} aria-label="Remove variant">✕</button>
        </div>
      ))}
      <button onClick={addVariant} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>+ Add price variant</button>
    </div>
  );
}

/** A plain string[] field with add/remove — shared by BlockOpsPanel's
 *  "Required inputs" and "Evidence or links" lists, the two BlockOps
 *  fields that are genuinely just a list of strings (checklist items and
 *  KPIs carry extra per-item state — a checkbox, target/actual numbers —
 *  so they stay hand-written rather than being forced into this shape). */
export function StringListField({ label, placeholder, items, onAdd, onRemove, canEdit, renderItem }: {
  label: string; placeholder: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; canEdit: boolean;
  renderItem?: (v: string) => ReactNode;
}) {
  const [draft, setDraft] = useState("");
  return (
    <>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      {items.map((v, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          {renderItem ? renderItem(v) : <span style={{ flex: 1, fontSize: 12 }}>{v}</span>}
          {canEdit && <button onClick={() => onRemove(i)} style={{ ...barGhost, padding: "1px 6px", fontSize: 11 }} aria-label="Remove">{"✕"}</button>}
        </div>
      ))}
      {canEdit && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 12 }}>
          <input value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder={placeholder}
            style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12 }} />
          <button onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } }} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>Add</button>
        </div>
      )}
    </>
  );
}
/** "Link an existing item" + "or create a new one, already linked" —
 *  shared by the assumptions/experiments/goals sections of BlockOpsPanel.
 *  Risks are read-only-count only (see BlockOpsPanel): this codebase has
 *  no updateRiskEntry to re-link an existing risk after creation, only
 *  addRiskEntry with an optional linkedNodeId at creation time, so risks
 *  don't get the same "link an existing one" affordance without adding
 *  that capability elsewhere first. */
export function LinkableList({ label, items, id, itemLabel, onLink, newPlaceholder, onCreate, canEdit }: {
  label: string; items: { id: string; linkedNodeId?: string }[]; id: string; itemLabel: (item: { id: string; linkedNodeId?: string }) => string;
  onLink: (itemId: string) => void; newPlaceholder: string; onCreate: (text: string) => void; canEdit: boolean;
}) {
  const linked = items.filter((i) => i.linkedNodeId === id);
  const unlinked = items.filter((i) => i.linkedNodeId !== id);
  const [pickId, setPickId] = useState("");
  const [newText, setNewText] = useState("");
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{label} ({linked.length})</div>
      {linked.map((item) => <div key={item.id} style={{ fontSize: 12, color: "var(--dim)", marginBottom: 2 }}>{itemLabel(item)}</div>)}
      {canEdit && (
        <>
          {unlinked.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <select value={pickId} onChange={(ev) => setPickId(ev.target.value)}
                style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "4px 6px", fontSize: 12 }}>
                <option value="">Link an existing one…</option>
                {unlinked.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
              </select>
              <button onClick={() => { if (pickId) { onLink(pickId); setPickId(""); } }} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>Link</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={newText} onChange={(ev) => setNewText(ev.target.value)} placeholder={newPlaceholder}
              style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "4px 6px", fontSize: 12 }} />
            <button onClick={() => { if (newText.trim()) { onCreate(newText.trim()); setNewText(""); } }} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>+ New</button>
          </div>
        </>
      )}
    </div>
  );
}
export function BlockOpsPanel({ id, entry, update, canEdit, assumptions, updateAssumption, addAssumption, experiments, updateExperiment, addExperiment, goals, updateGoal, addGoal, linkedRisks }: {
  id: string; entry: BlockOpsEntry | null; update: (patch: Partial<Omit<BlockOpsEntry, "id" | "linkedNodeId" | "createdAt">>) => void; canEdit: boolean;
  assumptions: AssumptionEntry[]; updateAssumption: (id: string, patch: Partial<Omit<AssumptionEntry, "id" | "createdAt">>) => void;
  addAssumption: (text: string, confidence: AssumptionConfidence, category?: string, linkedNodeId?: string) => void;
  experiments: ExperimentEntry[]; updateExperiment: (id: string, patch: Partial<Omit<ExperimentEntry, "id" | "createdAt">>) => void;
  addExperiment: (hypothesis: string, linkedAssumptionId?: string, linkedNodeId?: string) => void;
  goals: GoalNode[]; updateGoal: (id: string, patch: Partial<Omit<GoalNode, "id" | "createdAt">>) => void;
  addGoal: (level: GoalLevel, title: string, parentId?: string, linkedNodeId?: string) => void;
  linkedRisks: RiskRegisterEntry[];
}) {
  const e = entry;
  const field = (label: string, value: string, onChange: (v: string) => void, multiline = false) => (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      {multiline ? (
        <textarea disabled={!canEdit} value={value} onChange={(ev) => onChange(ev.target.value)}
          style={{ width: "100%", boxSizing: "border-box", height: 70, marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
      ) : (
        <input disabled={!canEdit} value={value} onChange={(ev) => onChange(ev.target.value)}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
      )}
    </label>
  );
  const checklist = e?.checklist ?? [];
  const setChecklistItem = (checklistId: string, done: boolean) => update({ checklist: checklist.map((c) => (c.id === checklistId ? { ...c, done } : c)) });
  const addChecklistItem = (label: string) => { if (label.trim()) update({ checklist: [...checklist, { id: `bopsc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, label: label.trim(), done: false }] }); };
  const removeChecklistItem = (checklistId: string) => update({ checklist: checklist.filter((c) => c.id !== checklistId) });
  const [newChecklistLabel, setNewChecklistLabel] = useState("");

  const kpis = e?.kpis ?? [];
  const updKpi = (kpiId: string, patch: Partial<BlockOpsKpi>) => update({ kpis: kpis.map((k) => (k.id === kpiId ? { ...k, ...patch } : k)) });
  const addKpi = () => update({ kpis: [...kpis, { id: `bopsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, name: "New KPI" }] });
  const removeKpi = (kpiId: string) => update({ kpis: kpis.filter((k) => k.id !== kpiId) });

  const evidenceLinks = e?.evidenceLinks ?? [];
  const addEvidenceLink = (v: string) => update({ evidenceLinks: [...evidenceLinks, v] });
  const removeEvidenceLink = (i: number) => update({ evidenceLinks: evidenceLinks.filter((_, j) => j !== i) });

  const requiredInputs = e?.requiredInputs ?? [];
  const addRequiredInput = (v: string) => update({ requiredInputs: [...requiredInputs, v] });
  const removeRequiredInput = (i: number) => update({ requiredInputs: requiredInputs.filter((_, j) => j !== i) });

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>BLOCK OPERATING SYSTEM</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Turn this block into a runbook</div>

      {field("Purpose", e?.purpose ?? "", (v) => update({ purpose: v }))}

      <StringListField label="Required inputs" placeholder="e.g. Payment processor connected" items={requiredInputs} onAdd={addRequiredInput} onRemove={removeRequiredInput} canEdit={canEdit} />

      {field("Setup instructions", e?.setupInstructions ?? "", (v) => update({ setupInstructions: v }), true)}
      {field("Standard operating procedure", e?.sop ?? "", (v) => update({ sop: v }), true)}

      <span style={{ fontSize: 11, color: "var(--muted)" }}>Platform-specific checklist</span>
      {checklist.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <input type="checkbox" disabled={!canEdit} checked={c.done} onChange={(ev) => setChecklistItem(c.id, ev.target.checked)} />
          <span style={{ flex: 1, fontSize: 12, textDecoration: c.done ? "line-through" : undefined, color: c.done ? "var(--dim)" : "var(--text)" }}>{c.label}</span>
          {canEdit && <button onClick={() => removeChecklistItem(c.id)} style={{ ...barGhost, padding: "1px 6px", fontSize: 11 }} aria-label="Remove checklist item">{"✕"}</button>}
        </div>
      ))}
      {canEdit && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 12 }}>
          <input value={newChecklistLabel} onChange={(ev) => setNewChecklistLabel(ev.target.value)} placeholder="e.g. Tracking pixel firing"
            style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12 }} />
          <button onClick={() => { addChecklistItem(newChecklistLabel); setNewChecklistLabel(""); }} style={{ ...barGhost, padding: "3px 8px", fontSize: 11 }}>Add</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {field("Responsible owner", e?.owner ?? "", (v) => update({ owner: v }))}
      </div>
      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Due date</span>
        <input disabled={!canEdit} type="date" value={e?.dueDate ?? ""} onChange={(ev) => update({ dueDate: ev.target.value })}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
      </label>

      <span style={{ fontSize: 11, color: "var(--muted)" }}>KPIs — target vs actual</span>
      {kpis.map((k) => (
        <div key={k.id} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
          <input disabled={!canEdit} value={k.name} onChange={(ev) => updKpi(k.id, { name: ev.target.value })}
            style={{ flex: 2, minWidth: 0, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12 }} />
          <input disabled={!canEdit} type="number" placeholder="Target" value={k.target ?? ""} onChange={(ev) => updKpi(k.id, { target: ev.target.value === "" ? undefined : Number(ev.target.value) })}
            style={{ flex: 1, minWidth: 0, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12 }} />
          <input disabled={!canEdit} type="number" placeholder="Actual" value={k.actual ?? ""} onChange={(ev) => updKpi(k.id, { actual: ev.target.value === "" ? undefined : Number(ev.target.value) })}
            style={{ flex: 1, minWidth: 0, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12 }} />
          {canEdit && <button onClick={() => removeKpi(k.id)} style={{ ...barGhost, padding: "1px 6px", fontSize: 11 }} aria-label="Remove KPI">{"✕"}</button>}
        </div>
      ))}
      {canEdit && <button onClick={addKpi} style={{ ...barGhost, padding: "3px 8px", fontSize: 11, marginTop: 6, marginBottom: 12 }}>+ Add KPI</button>}

      <StringListField label="Evidence or links" placeholder="https://..." items={evidenceLinks} onAdd={addEvidenceLink} onRemove={removeEvidenceLink} canEdit={canEdit}
        renderItem={(link) => <a href={link} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: ACCENT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</a>} />

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label style={{ flex: 1 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Approval status</span>
          <select disabled={!canEdit} value={e?.approvalStatus ?? "not_required"} onChange={(ev) => update({ approvalStatus: ev.target.value as ApprovalStatus })}
            style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}>
            {(["not_required", "pending", "approved", "changes_requested"] as ApprovalStatus[]).map((s) => <option key={s} value={s}>{APPROVAL_COPY[s].label}</option>)}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Integration status</span>
          <select disabled={!canEdit} value={e?.integrationStatus ?? "planned"} onChange={(ev) => update({ integrationStatus: ev.target.value as IntegrationStatus })}
            style={{ width: "100%", marginTop: 4, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}>
            {(["planned", "manual", "connected"] as IntegrationStatus[]).map((s) => <option key={s} value={s}>{INTEGRATION_COPY[s].label}</option>)}
          </select>
        </label>
      </div>

      {field("Automation opportunities", e?.automationOpportunities ?? "", (v) => update({ automationOpportunities: v }), true)}

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 8 }}>LINKED FROM THIS BLOCK</div>
        <LinkableList label="Goals" items={goals} id={id} itemLabel={(g) => (g as GoalNode).title}
          onLink={(gid) => updateGoal(gid, { linkedNodeId: id })} newPlaceholder="New goal title…"
          onCreate={(title) => addGoal("project", title, undefined, id)} canEdit={canEdit} />
        <LinkableList label="Assumptions" items={assumptions} id={id} itemLabel={(a) => (a as AssumptionEntry).text}
          onLink={(aid) => updateAssumption(aid, { linkedNodeId: id })} newPlaceholder="New assumption…"
          onCreate={(text) => addAssumption(text, "medium", undefined, id)} canEdit={canEdit} />
        <LinkableList label="Experiments" items={experiments} id={id} itemLabel={(e2) => (e2 as ExperimentEntry).hypothesis}
          onLink={(eid) => updateExperiment(eid, { linkedNodeId: id })} newPlaceholder="New experiment hypothesis…"
          onCreate={(hyp) => addExperiment(hyp, undefined, id)} canEdit={canEdit} />
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Risks ({linkedRisks.length})</div>
        {linkedRisks.map((r) => <div key={r.id} style={{ fontSize: 12, color: "var(--dim)", marginBottom: 2 }}>{r.label}</div>)}
        <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>Link a risk to this block from the Risk tab — new risks can be linked at creation.</div>
      </div>
    </div>
  );
}

// PLAN-mode assumption entry for a traffic node — lets the user say how they
// actually think about this channel (I know my volume / my spend and cost
// per visitor / my clicks and CPC / my impressions and CTR / my leads and
// CPL) instead of forcing "visitors" and "cost per visitor" as the only
// vocabulary. Every method converges on the same two engine fields
// (visitors, costPerVisitor) — nothing new for the simulator to understand.
// Period is a monthly-equivalent normalizer only; the engine has no concept
// of period, so "the model's number" has always meant "per month" here.
type PlanMethod = "manual" | "people" | "spend_cpv" | "clicks_cpc" | "impressions_cpm_ctr" | "leads_cpl";
type PlanPeriod = "daily" | "weekly" | "monthly" | "campaign";
const PLAN_METHOD_LABEL: Record<PlanMethod, string> = {
  manual: "Manual (visitors + cost per visitor)",
  people: "I know my traffic volume",
  spend_cpv: "I know my spend and cost per visitor",
  clicks_cpc: "I know my clicks and cost per click",
  impressions_cpm_ctr: "I know my impressions, CPM and CTR",
  leads_cpl: "I know my leads and cost per lead",
};
const PLAN_PERIOD_MULT: Record<PlanPeriod, number> = { daily: 30, weekly: 4.34, monthly: 1, campaign: 1 };
export function TrafficForecastPanel({ node, patch }: { node: Node; patch: (id: string, c: Partial<RFNodeData>) => void }) {
  const d = node.data as RFNodeData; const id = node.id;
  const ui = (d.ui as Record<string, string | number | boolean> | undefined) ?? {};
  const method = (typeof ui.planMethod === "string" ? ui.planMethod : "manual") as PlanMethod;
  const period = (typeof ui.planPeriod === "string" ? ui.planPeriod : "monthly") as PlanPeriod;
  const mult = PLAN_PERIOD_MULT[period];
  const num = (key: string, fallback = 0) => (typeof ui[key] === "number" ? (ui[key] as number) : fallback);
  const setUi = (patchUi: Record<string, string | number>, engine?: { visitors?: number; costPerVisitor?: number }) => {
    patch(id, { ui: { ...ui, ...patchUi }, ...engine });
  };
  const setMethod = (m: PlanMethod) => setUi({ planMethod: m });
  const input = (label: string, key: string, step: number, suffix?: string) => (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}{suffix ? ` (${suffix})` : ""}</span>
      <input type="number" value={num(key)} step={step}
        onChange={(e) => recompute({ ...ui, [key]: parseFloat(e.target.value) || 0 })}
        style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
    </label>
  );
  // Recomputes visitors/costPerVisitor from whichever method is active,
  // called on every keystroke so the model stays live as the user types.
  const recompute = (raw: Record<string, string | number | boolean>) => {
    const g = (k: string) => (typeof raw[k] === "number" ? (raw[k] as number) : 0);
    let visitors = d.visitors ?? 0;
    let costPerVisitor = d.costPerVisitor ?? 0;
    if (method === "people") {
      visitors = Math.round(g("pmPeople") * mult);
    } else if (method === "spend_cpv") {
      const spend = g("pmSpend") * mult;
      costPerVisitor = Math.round(g("pmCostPerVisitor") * 100);
      visitors = costPerVisitor > 0 ? Math.round((spend * 100) / costPerVisitor) : 0;
    } else if (method === "clicks_cpc") {
      const clicks = g("pmClicks") * mult;
      costPerVisitor = Math.round(g("pmCpc") * 100);
      visitors = Math.round(clicks);
    } else if (method === "impressions_cpm_ctr") {
      const impressions = g("pmImpressions") * mult;
      const ctr = g("pmCtr") / 100;
      const clicks = impressions * ctr;
      const spend = (impressions / 1000) * g("pmCpm");
      visitors = Math.round(clicks);
      costPerVisitor = clicks > 0 ? Math.round((spend * 100) / clicks) : 0;
    } else if (method === "leads_cpl") {
      const leads = g("pmLeads") * mult;
      costPerVisitor = Math.round(g("pmCpl") * 100);
      visitors = Math.round(leads);
    }
    setUi(raw as Record<string, string | number>, method === "manual" ? undefined : { visitors, costPerVisitor });
  };
  return (
    <div>
      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>How do you want to estimate this traffic?</span>
        <select value={method} onChange={(e) => setMethod(e.target.value as PlanMethod)}
          style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}>
          {(Object.keys(PLAN_METHOD_LABEL) as PlanMethod[]).map((m) => <option key={m} value={m}>{PLAN_METHOD_LABEL[m]}</option>)}
        </select>
      </label>
      {method !== "manual" && (
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Period</span>
          <select value={period} onChange={(e) => setUi({ planPeriod: e.target.value })}
            style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}>
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="campaign">Campaign total</option>
          </select>
        </label>
      )}
      {method === "manual" && (<>
        <Field label="Visitors" value={d.visitors ?? 0} step={50} onChange={(v) => patch(id, { visitors: v })} />
        <Field label="Cost per visitor ($)" value={(d.costPerVisitor ?? 0) / 100} step={0.05} onChange={(v) => patch(id, { costPerVisitor: Math.round(v * 100) })} />
      </>)}
      {method === "people" && input("People / visitors", "pmPeople", 50)}
      {method === "spend_cpv" && (<>
        {input("Spend", "pmSpend", 50, "$")}
        {input("Cost per visitor", "pmCostPerVisitor", 0.05, "$")}
      </>)}
      {method === "clicks_cpc" && (<>
        {input("Clicks", "pmClicks", 50)}
        {input("Cost per click", "pmCpc", 0.05, "$")}
      </>)}
      {method === "impressions_cpm_ctr" && (<>
        {input("Impressions", "pmImpressions", 500)}
        {input("CPM", "pmCpm", 0.5, "$ per 1,000")}
        {input("CTR", "pmCtr", 0.1, "%")}
      </>)}
      {method === "leads_cpl" && (<>
        {input("Leads", "pmLeads", 10)}
        {input("Cost per lead", "pmCpl", 0.5, "$")}
      </>)}
      {method !== "manual" && (
        <div style={{ marginTop: 4, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>
          Estimated monthly: <strong style={{ color: "var(--text)" }}>{(d.visitors ?? 0).toLocaleString()}</strong> visitors ·{" "}
          <strong style={{ color: "var(--text)" }}>{money(d.costPerVisitor ?? 0)}</strong>/visitor
        </div>
      )}
    </div>
  );
}
export function PlanEditor({ node, patch }: { node: Node; patch: (id: string, c: Partial<RFNodeData>) => void }) {
  const d = node.data as RFNodeData; const id = node.id;
  return (
    <div>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Label</span>
        <input value={d.label} onChange={(e) => patch(id, { label: e.target.value })}
          style={{ width: "100%", marginTop: 4, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
      </label>
      {d.kind === "traffic" && <TrafficForecastPanel node={node} patch={patch} />}
      {d.kind === "step" && <Field label="Pass rate (%)" term="passRate" value={Math.round((d.passRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { passRate: v / 100 })} />}
      {d.kind === "offer" && (<>
        <Field label="Conversion rate (%)" term="conversionRate" value={Math.round((d.conversionRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { conversionRate: v / 100 })} />
        <Field label="Price ($)" term="price" value={(d.price ?? 0) / 100} step={1} onChange={(v) => patch(id, { price: Math.round(v * 100) })} />
        <div style={{ fontSize: 11, color: "var(--dim)", margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 0.6 }}>Economics (optional)</div>
        <Field label="Order-bump take rate (%)" term="orderBumpRate" value={Math.round((d.orderBumpRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { orderBumpRate: v / 100 })} />
        <Field label="Order-bump price ($)" term="orderBumpPrice" value={(d.orderBumpPrice ?? 0) / 100} step={1} onChange={(v) => patch(id, { orderBumpPrice: Math.round(v * 100) })} />
        <Field label="Upsell take rate (%)" term="upsellRate" value={Math.round((d.upsellRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { upsellRate: v / 100 })} />
        <Field label="Upsell price ($)" term="upsellPrice" value={(d.upsellPrice ?? 0) / 100} step={1} onChange={(v) => patch(id, { upsellPrice: Math.round(v * 100) })} />
        <Field label="Recurring take rate (%)" term="recurringRate" value={Math.round((d.recurringRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { recurringRate: v / 100 })} />
        <Field label="Monthly price ($/mo)" term="monthlyPrice" value={(d.monthlyPrice ?? 0) / 100} step={1} onChange={(v) => patch(id, { monthlyPrice: Math.round(v * 100) })} />
        <Field label="Monthly churn (%)" term="churnRate" value={Math.round((d.churnRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { churnRate: v / 100 })} />
      </>)}
      {d.kind === "split" && <Field label="Yes rate (%)" term="yesRate" value={Math.round((d.yesRate ?? 0) * 1000) / 10} step={1} onChange={(v) => patch(id, { yesRate: v / 100 })} />}
      <div style={{ fontSize: 11, color: "var(--dim)", margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 0.6 }}>Timing (optional)</div>
      <Field label="Delay before next step (days)" term="delayDays" value={d.delayDays ?? 0} step={1} onChange={(v) => patch(id, { delayDays: Math.max(0, v) })} />
    </div>
  );
}

export function ActualEditor({ node, actual, patchActual }: { node: Node; actual: NodeActuals; patchActual: (id: string, c: Partial<NodeActuals>) => void }) {
  const d = node.data as RFNodeData; const id = node.id;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{d.label}</div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>{d.kind}</div>
      {d.kind === "traffic" && (<>
        <Field label="Actual visitors" term="actualVisitors" value={actual.visitors ?? 0} step={50} onChange={(v) => patchActual(id, { visitors: v })} />
        <Field label="Actual spend ($)" term="actualSpend" value={(actual.cost ?? 0) / 100} step={1} onChange={(v) => patchActual(id, { cost: Math.round(v * 100) })} />
      </>)}
      {d.kind === "offer" && (<>
        <Field label="Actual buyers" term="actualBuyers" value={actual.buyers ?? 0} step={1} onChange={(v) => patchActual(id, { buyers: v })} />
        <Field label="Actual revenue ($)" term="actualRevenue" value={(actual.revenue ?? 0) / 100} step={1} onChange={(v) => patchActual(id, { revenue: Math.round(v * 100) })} />
      </>)}
      {(d.kind === "step" || d.kind === "split") && (
        <div style={{ color: "var(--dim)", fontSize: 13 }}>No headline actuals for a {d.kind} node yet. Enter observed numbers on traffic and offer nodes.</div>
      )}
    </div>
  );
}
