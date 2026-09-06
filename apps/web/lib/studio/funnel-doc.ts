/**
 * Serialization boundary for the funnel studio: turning the live React-Flow
 * nodes/edges (plus all the program/strategy state) into a persisted FunnelDoc
 * and back. Pure and JSX-free — extracted from funnel-studio.tsx so the canvas
 * component isn't carrying the persistence format inline. The engine's
 * serializeDoc/deserializeDoc handle the on-disk string; this handles the
 * in-memory <-> FunnelDoc shape.
 */
import type { Node, Edge } from "@xyflow/react";
import {
  DEFAULT_MONEY_MACHINE_CONFIG, DEFAULT_PROFIT_DRIVER_INPUTS, isValidPeriod,
  type FunnelDoc, type NodeActuals, type Decision, type RiskRegisterEntry, type ChecklistItem,
  type BusinessDefinition, type ForceActionItem, type MoneyMachineConfig, type MoneyMachineTargets,
  type LedgerEntry, type ObjectionEntry, type HookEntry, type ProfitDriverInputs, type ClientPromise,
  type RavingFansInputs, type RetargetingLoop, type MindfulnessEntry, type GoalNode,
  type AssumptionEntry, type ExperimentEntry, type BlockOpsEntry, type Variant,
} from "@onevyrt/engine";
import type { RFNodeData } from "../funnel-map";

/** A non-simulation canvas object (sticky note / text label). Kept out of the
 *  engine entirely — filtered by `type === "annot"`. */
export interface AnnotationData { kind: "text" | "sticky"; text?: string; color?: string; [key: string]: unknown; }

export const NUM_KEYS = ["visitors", "costPerVisitor", "passRate", "conversionRate", "price", "yesRate", "orderBumpRate", "orderBumpPrice", "upsellRate", "upsellPrice", "recurringRate", "monthlyPrice", "churnRate", "unitCost", "refundRate", "merchantFeeRate", "expenseAmount", "expenseRate", "flatCost", "w", "delayDays"] as const;
export const STORE_IDX = "gearbox:funnels";
export const keyOf = (name: string) => `gearbox:funnel:${name}`;
export const DRAFT_KEY = "gearbox:draft";
/** Sidecar for DRAFT_KEY: the server project id the crash-recovery draft
 *  belongs to (or "" if it was never saved). Kept separate from the FunnelDoc
 *  itself — the persisted doc format has no id field — so restoring a draft
 *  can rebind to the SAME row instead of minting a new one. */
export const DRAFT_ID_KEY = "gearbox:draft:id";

export function readIndex(): string[] {
  try { const r = localStorage.getItem(STORE_IDX); return r ? (JSON.parse(r) as string[]) : []; }
  catch { return []; }
}
export function writeIndex(list: string[]): void { localStorage.setItem(STORE_IDX, JSON.stringify(list)); }

export function toDoc(name: string, nodes: Node[], edges: Edge[], actuals: Record<string, NodeActuals>, decisions: Decision[], currency = "USD", expenses?: { amount?: number; rate?: number }, period?: { start: string; end: string }, riskRegister?: RiskRegisterEntry[], checklist?: ChecklistItem[], notes?: string, program?: { definition: BusinessDefinition; forceActions: ForceActionItem[]; visitedLessons?: string[]; introSeen?: boolean; graduationSeen?: boolean }, moneyMachine?: MoneyMachineConfig, objections?: ObjectionEntry[], hooks?: HookEntry[], profitDrivers?: ProfitDriverInputs, clientPromises?: ClientPromise[], ravingFans?: RavingFansInputs, retargetingLoops?: RetargetingLoop[], mindfulness?: MindfulnessEntry[], goals?: GoalNode[], assumptions?: AssumptionEntry[], experiments?: ExperimentEntry[], moneyMachineTargets?: MoneyMachineTargets, moneyMachineLedger?: LedgerEntry[], blockOps?: BlockOpsEntry[]): FunnelDoc {
  return {
    version: 1, name, currency,
    ...(period && isValidPeriod(period) ? { period } : {}),
    ...(expenses && ((expenses.amount ?? 0) > 0 || (expenses.rate ?? 0) > 0) ? { expenses } : {}),
    ...(riskRegister && riskRegister.length ? { riskRegister } : {}),
    ...(retargetingLoops && retargetingLoops.length ? { retargetingLoops } : {}),
    ...(checklist && checklist.length ? { checklist } : {}),
    ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
    ...(program && (Object.keys(program.definition).length || program.forceActions.length || program.visitedLessons?.length || program.introSeen || program.graduationSeen)
      ? { program: {
          ...(Object.keys(program.definition).length ? { definition: program.definition } : {}),
          ...(program.forceActions.length ? { forceActions: program.forceActions } : {}),
          ...(program.visitedLessons?.length ? { visitedLessons: program.visitedLessons } : {}),
          ...(program.introSeen ? { introSeen: true } : {}),
          ...(program.graduationSeen ? { graduationSeen: true } : {}),
        } }
      : {}),
    ...(moneyMachine && JSON.stringify(moneyMachine) !== JSON.stringify(DEFAULT_MONEY_MACHINE_CONFIG) ? { moneyMachine } : {}),
    ...(moneyMachineTargets && Object.keys(moneyMachineTargets).length ? { moneyMachineTargets } : {}),
    ...(moneyMachineLedger && moneyMachineLedger.length ? { moneyMachineLedger } : {}),
    ...(objections && objections.length ? { objections } : {}),
    ...(hooks && hooks.length ? { hooks } : {}),
    ...(profitDrivers && JSON.stringify(profitDrivers) !== JSON.stringify(DEFAULT_PROFIT_DRIVER_INPUTS) ? { profitDrivers } : {}),
    ...(clientPromises && clientPromises.length ? { clientPromises } : {}),
    ...(ravingFans && (ravingFans.retentionRate > 0 || ravingFans.referralRate > 0) ? { ravingFans } : {}),
    ...(mindfulness && mindfulness.length ? { mindfulness } : {}),
    ...(goals && goals.length ? { goals } : {}),
    ...(assumptions && assumptions.length ? { assumptions } : {}),
    ...(experiments && experiments.length ? { experiments } : {}),
    ...(blockOps && blockOps.length ? { blockOps } : {}),
    nodes: nodes.filter((n) => n.type !== "annot").map((n) => {
      const d = n.data as RFNodeData;
      const dn: Record<string, unknown> = { id: n.id, kind: d.kind, label: d.label, x: n.position.x, y: n.position.y };
      for (const k of NUM_KEYS) if (d[k] != null) dn[k] = d[k];
      if (typeof d.brand === "string" && d.brand) dn.brand = d.brand;
      if (d.costModel === "flat" || d.costModel === "perVisitor") dn.costModel = d.costModel;
      if (Array.isArray(d.variants) && d.variants.length) (dn as unknown as Record<string, unknown>).variants = d.variants;
      if (d.ui && typeof d.ui === "object") dn.ui = d.ui;
      return dn as unknown as FunnelDoc["nodes"][number];
    }),
    ...(nodes.some((n) => n.type === "annot") ? {
      annotations: nodes.filter((n) => n.type === "annot").map((n) => {
        const d = n.data as AnnotationData;
        return {
          id: n.id, kind: d.kind, x: n.position.x, y: n.position.y,
          w: d.kind === "sticky" ? 200 : 220, h: d.kind === "sticky" ? 120 : 40,
          ...(typeof d.text === "string" && d.text ? { text: d.text } : {}),
          ...(typeof d.color === "string" && d.color ? { color: d.color } : {}),
        };
      }),
    } : {}),
    edges: edges.map((e) => {
      const lineType = (e.data as Record<string, unknown> | undefined)?.lineType;
      return {
        id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null,
        ...(typeof e.label === "string" && e.label ? { label: e.label } : {}),
        ...(lineType === "secondary" || lineType === "conditional" ? { lineType } : {}),
      };
    }),
    actuals: actuals as FunnelDoc["actuals"],
    decisions,
  };
}

export function docToNodes(doc: FunnelDoc): Node[] {
  const funnelNodes = doc.nodes.map((dn) => {
    const data: Record<string, unknown> = { kind: dn.kind, label: dn.label };
    for (const k of NUM_KEYS) { const v = (dn as unknown as Record<string, unknown>)[k]; if (v != null) data[k] = v; }
    { const b = (dn as unknown as Record<string, unknown>).brand; if (typeof b === "string" && b) data.brand = b; }
    { const cm = (dn as unknown as Record<string, unknown>).costModel; if (cm === "flat" || cm === "perVisitor") data.costModel = cm; }
    { const vs = (dn as unknown as Record<string, unknown>).variants; if (Array.isArray(vs) && vs.length) data.variants = vs as Variant[]; }
    { const u = (dn as unknown as Record<string, unknown>).ui; if (u && typeof u === "object") data.ui = u; }
    const locked = (data.ui as Record<string, unknown> | undefined)?.locked === true;
    return { id: dn.id, type: "gb", position: { x: dn.x, y: dn.y }, data: data as unknown as RFNodeData, ...(locked ? { draggable: false } : {}) };
  });
  const annotationNodes: Node[] = (doc.annotations ?? []).map((a) => ({
    id: a.id, type: "annot", position: { x: a.x, y: a.y },
    data: { kind: a.kind, ...(a.text ? { text: a.text } : {}), ...(a.color ? { color: a.color } : {}) } as AnnotationData,
  }));
  return [...funnelNodes, ...annotationNodes];
}

export function docToEdges(doc: FunnelDoc): Edge[] {
  return doc.edges.map((de) => ({
    id: de.id, source: de.source, target: de.target, sourceHandle: de.sourceHandle ?? null,
    ...(de.label ? { label: de.label } : {}),
    ...(de.lineType ? { data: { lineType: de.lineType } } : {}),
  }));
}
