/**
 * Persistence: a stable, versioned document shape for a saved funnel and pure
 * serialize/deserialize with validation. Framework-agnostic plain data — the UI
 * maps its canvas state to/from a FunnelDoc, and the same shape drops straight
 * into a database later. Round-trip is lossless: deserialize(serialize(doc))
 * returns the same document (with the version stamped).
 */
import { isValidPeriod } from "./period.ts";
import type { Decision, Confidence, DecisionStatus, Outcome, Measurement } from "./loop.ts";
import type { RiskRegisterEntry, RiskRegisterStatus } from "./governance.ts";
import type { ChecklistItem } from "./checklist.ts";
import type { BusinessDefinition, ForceActionItem, ForceNumber, ActionStatus, ActionPriority, ActionConfidence, LinkedKpi, ProgramState } from "./program.ts";
import type { MoneyMachineConfig } from "./money-machine.ts";
import type { ObjectionEntry, HookEntry } from "./playbook.ts";
import type { ProfitDriverInputs } from "./profit-drivers.ts";
import type { ClientPromise, RavingFansInputs } from "./raving-fans.ts";
import type { MindfulnessEntry, MindfulnessKind } from "./mindfulness.ts";
import type { GoalNode, GoalLevel, GoalStatus } from "./goals.ts";
import type { AssumptionEntry, AssumptionConfidence, AssumptionStatus } from "./assumptions.ts";
import type { ExperimentEntry, ExperimentStatus, ExperimentDecision, ExperimentConfidence } from "./experiments.ts";
import type { RetargetingLoop } from "./retargeting.ts";
import type { LedgerEntry, LedgerBucket, LedgerKind, MoneyMachineTargets } from "./money-machine-ledger.ts";
import type { BlockOpsEntry, BlockOpsChecklistItem, BlockOpsKpi, ApprovalStatus, IntegrationStatus } from "./block-ops.ts";

export const DOC_VERSION = 1;

export type DocKind = "traffic" | "step" | "offer" | "split";

export interface DocNode {
  id: string;
  kind: DocKind;
  label: string;
  x: number;
  y: number;
  visitors?: number;
  costPerVisitor?: number; // minor units
  flatCost?: number;       // minor units, used when costModel === "flat"
  costModel?: "perVisitor" | "flat";
  passRate?: number;
  conversionRate?: number;
  price?: number;          // minor units
  yesRate?: number;
  orderBumpRate?: number;
  orderBumpPrice?: number;
  upsellRate?: number;
  upsellPrice?: number;
  recurringRate?: number;
  monthlyPrice?: number;
  churnRate?: number;
  unitCost?: number;
  refundRate?: number;
  merchantFeeRate?: number;
  variants?: DocVariant[];
  expenseAmount?: number;
  expenseRate?: number;
  /** Days this node holds population before it reaches the next node (e.g. a
   *  "Wait / Delay" step, or a webinar's replay window). Used by the time engine
   *  to compute time-to-conversion; ignored by the profit/ratio simulation. */
  delayDays?: number;
  /** UI-only: block width in px on the canvas. Ignored by the engine. */
  w?: number;
  /** UI-only: brand/source key (e.g. "facebook"). Ignored by the engine. */
  brand?: string;
  /** UI-only: free-form primitive bag (notes, URLs, toggles). Ignored by the engine. */
  ui?: Record<string, string | number | boolean>;
}

export type EdgeLineType = "primary" | "secondary" | "conditional";

export interface DocEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  /** Optional free-form caption shown on the canvas edge (e.g. "20% off"). */
  label?: string;
  /** Visual/semantic connector type — cosmetic only, the simulation always
   *  follows every edge regardless of type. Defaults to "primary" when absent. */
  lineType?: EdgeLineType;
}

export interface DocActuals {
  visitors?: number;
  buyers?: number;
  revenue?: number; // minor units
  cost?: number;    // minor units
}

export interface DocVariant {
  id: string;
  name?: string;
  sku?: string;
  price: number;
  share: number;
  unitCost?: number;
  refundRate?: number;
  merchantFeeRate?: number;
  active?: boolean;
}

export type AnnotationKind = "text" | "sticky";

/** A canvas object that is NOT a funnel node — a text label or a sticky note.
 *  Kept entirely separate from `nodes`/`edges`, same reasoning as
 *  RetargetingLoop: it must never reach toFunnel/validateFunnel/topoOrder. */
export interface DocAnnotation {
  id: string;
  kind: AnnotationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string; // hex, cosmetic only
}

export interface FunnelDoc {
  version: number;
  name: string;
  currency?: string;
  nodes: DocNode[];
  edges: DocEdge[];
  actuals: Record<string, DocActuals>;
  decisions: Decision[];
  /** Scenario-wide operating expenses. */
  expenses?: { amount?: number; rate?: number };
  /** Library state: archived projects are hidden from the default view. */
  archived?: boolean;
  /** The window the ACTUAL numbers belong to. Plans are timeless; actuals are not. */
  period?: { start: string; end: string };
  /** Tracked risks and their mitigation status. Absent/empty means untracked, not risk-free. */
  riskRegister?: RiskRegisterEntry[];
  /** Launch readiness checklist. Absent/empty means no checklist started yet. */
  checklist?: ChecklistItem[];
  /** Free-form canvas-level context: strategy, objective, assumptions, decision log. */
  notes?: string;
  /** Business-definition + 7 Forces workbook (Phase 1-4, ahead of the canvas/model). */
  program?: ProgramState;
  /** Freedom Fund % + Security/Growth/Dream bucket split, applied to computed profit. */
  moneyMachine?: MoneyMachineConfig;
  /** Optional target amount per bucket — what "done" looks like for Security/Growth/Dream. */
  moneyMachineTargets?: MoneyMachineTargets;
  /** Real money actually moved into/out of each bucket — the tracked fund
   *  itself, as opposed to moneyMachine's live projection of what SHOULD be
   *  set aside. */
  moneyMachineLedger?: LedgerEntry[];
  /** Objection → response swipe file (Force 4 — Sales Systems). */
  objections?: ObjectionEntry[];
  /** Reusable hooks/headlines (Force 3 — Marketing & Product Promises). */
  hooks?: HookEntry[];
  /** 5 Profit Drivers what-if percentages (Phase 4 — small improvements compound). */
  profitDrivers?: ProfitDriverInputs;
  /** Client promises made and whether each was delivered (Force 7 — Raving Fans). */
  clientPromises?: ClientPromise[];
  /** Self-reported retention/referral rates feeding the Raving Fans score. */
  ravingFans?: RavingFansInputs;
  /** Blind spots and hidden opportunities named by the user (Module 5). */
  mindfulness?: MindfulnessEntry[];
  /** Vision -> annual -> quarterly -> monthly KPI -> project -> action, one
   *  connected chain instead of separate unrelated goal-setting fields. */
  goals?: GoalNode[];
  /** Beliefs the plan is resting on, explicit and separate from the risk
   *  register — a risk is a bad thing that could happen; an assumption is
   *  something already being treated as true, tested or not. */
  assumptions?: AssumptionEntry[];
  /** Hypothesis -> experiment -> result -> decision, optionally testing a
   *  specific assumption above. */
  experiments?: ExperimentEntry[];
  /** Controlled feedback loops (retargeting) — kept out of `edges`/topoOrder
   *  entirely; see retargeting.ts for why. */
  retargetingLoops?: RetargetingLoop[];
  /** Text labels / sticky notes on the canvas — never part of the simulation graph. */
  annotations?: DocAnnotation[];
  /** Per-block runbook: purpose, SOP, checklist, owner, KPIs, evidence,
   *  approval and integration status. One entry per node, linked via
   *  linkedNodeId; a node with no entry just hasn't been operationalised
   *  yet. Assumptions/experiments/risks/goals for a block live in their
   *  own registers above, filtered by their own linkedNodeId — not
   *  duplicated here. */
  blockOps?: BlockOpsEntry[];
}

export class PersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistError";
  }
}

export function emptyDoc(name = "Untitled funnel"): FunnelDoc {
  return { version: DOC_VERSION, name, currency: "USD", nodes: [], edges: [], actuals: {}, decisions: [] };
}

/** Serialize to pretty JSON, always stamping the current version. */
export function serializeDoc(doc: FunnelDoc): string {
  return JSON.stringify({ ...doc, version: DOC_VERSION }, null, 2);
}

const KINDS: readonly DocKind[] = ["traffic", "step", "offer", "split"];

/** Parse + validate a saved document. Throws PersistError on malformed input. */
export function deserializeDoc(json: string): FunnelDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new PersistError("Not valid JSON.");
  }
  if (typeof raw !== "object" || raw === null) throw new PersistError("Document must be an object.");
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.nodes)) throw new PersistError("Document is missing a nodes array.");
  if (!Array.isArray(o.edges)) throw new PersistError("Document is missing an edges array.");

  const nodes: DocNode[] = o.nodes.map((n, i) => {
    const nn = n as Record<string, unknown>;
    if (typeof nn.id !== "string") throw new PersistError(`Node ${i} is missing an id.`);
    if (typeof nn.kind !== "string" || !KINDS.includes(nn.kind as DocKind))
      throw new PersistError(`Node ${nn.id} has an unknown kind "${String(nn.kind)}".`);
    const node: DocNode = {
      id: nn.id,
      kind: nn.kind as DocKind,
      label: typeof nn.label === "string" ? nn.label : nn.id,
      x: Number(nn.x) || 0,
      y: Number(nn.y) || 0,
    };
    setNum(node, "visitors", nn.visitors);
    setNum(node, "costPerVisitor", nn.costPerVisitor);
    setNum(node, "flatCost", nn.flatCost);
    if (nn.costModel === "flat" || nn.costModel === "perVisitor") node.costModel = nn.costModel;
    setNum(node, "passRate", nn.passRate);
    setNum(node, "conversionRate", nn.conversionRate);
    setNum(node, "price", nn.price);
    setNum(node, "yesRate", nn.yesRate);
    setNum(node, "orderBumpRate", nn.orderBumpRate);
    setNum(node, "orderBumpPrice", nn.orderBumpPrice);
    setNum(node, "upsellRate", nn.upsellRate);
    setNum(node, "upsellPrice", nn.upsellPrice);
    setNum(node, "recurringRate", nn.recurringRate);
    setNum(node, "monthlyPrice", nn.monthlyPrice);
    setNum(node, "churnRate", nn.churnRate);
    setNum(node, "unitCost", nn.unitCost);
    setNum(node, "refundRate", nn.refundRate);
    setNum(node, "merchantFeeRate", nn.merchantFeeRate);
    if (Array.isArray(nn.variants)) {
      const vs: DocVariant[] = [];
      for (const raw of nn.variants as unknown[]) {
        if (!raw || typeof raw !== "object") continue;
        const v = raw as Record<string, unknown>;
        if (typeof v.id !== "string" || !v.id) continue;
        if (typeof v.price !== "number" || !Number.isFinite(v.price) || v.price < 0) continue;
        if (typeof v.share !== "number" || !Number.isFinite(v.share) || v.share < 0 || v.share > 1) continue;
        const out: DocVariant = { id: v.id, price: v.price, share: v.share };
        if (typeof v.name === "string") out.name = v.name;
        if (typeof v.sku === "string") out.sku = v.sku;
        setNum(out, "unitCost", v.unitCost);
        setNum(out, "refundRate", v.refundRate);
        setNum(out, "merchantFeeRate", v.merchantFeeRate);
        if (v.active === false) out.active = false;
        vs.push(out);
      }
      if (vs.length) node.variants = vs;
    }
    setNum(node, "expenseAmount", nn.expenseAmount);
    setNum(node, "expenseRate", nn.expenseRate);
    setNum(node, "delayDays", nn.delayDays);
    setNum(node, "w", nn.w);
    if (typeof nn.brand === "string" && nn.brand.length > 0 && nn.brand.length <= 40) node.brand = nn.brand;
    if (nn.ui && typeof nn.ui === "object" && !Array.isArray(nn.ui)) {
      const ui: Record<string, string | number | boolean> = {};
      let n = 0;
      for (const [k, v] of Object.entries(nn.ui as Record<string, unknown>)) {
        if (n >= 40 || k.length > 40) break;
        if (typeof v === "string" && v.length <= 4000) { ui[k] = v; n++; }
        else if (typeof v === "number" && Number.isFinite(v)) { ui[k] = v; n++; }
        else if (typeof v === "boolean") { ui[k] = v; n++; }
      }
      if (n > 0) node.ui = ui;
    }
    return node;
  });

  const edges: DocEdge[] = o.edges.map((e, i) => {
    const ee = e as Record<string, unknown>;
    if (typeof ee.source !== "string" || typeof ee.target !== "string")
      throw new PersistError(`Edge ${i} needs source and target.`);
    const edge: DocEdge = {
      id: typeof ee.id === "string" ? ee.id : `e-${ee.source}-${ee.target}`,
      source: ee.source,
      target: ee.target,
      sourceHandle: typeof ee.sourceHandle === "string" ? ee.sourceHandle : null,
    };
    if (typeof ee.label === "string" && ee.label.length > 0 && ee.label.length <= 80) edge.label = ee.label;
    if (ee.lineType === "primary" || ee.lineType === "secondary" || ee.lineType === "conditional") edge.lineType = ee.lineType;
    return edge;
  });

  const actuals: Record<string, DocActuals> = {};
  if (o.actuals && typeof o.actuals === "object") {
    for (const [k, v] of Object.entries(o.actuals as Record<string, unknown>)) {
      const a = (v ?? {}) as Record<string, unknown>;
      const da: DocActuals = {};
      setNum(da, "visitors", a.visitors);
      setNum(da, "buyers", a.buyers);
      setNum(da, "revenue", a.revenue);
      setNum(da, "cost", a.cost);
      actuals[k] = da;
    }
  }

  // Unlike every other array field here, this one used to pass the raw
  // parsed JSON straight through with no per-item checks — a hand-edited or
  // corrupted doc could inject decisions missing required fields, which then
  // flow straight into UI state and CSV export instead of being dropped or
  // defaulted like everything else.
  const CONFIDENCES: readonly Confidence[] = ["low", "medium", "high"];
  const DECISION_STATUSES: readonly DecisionStatus[] = ["open", "measured"];
  const OUTCOMES: readonly Outcome[] = ["hit", "partial", "missed", "inconclusive"];
  const decisions: Decision[] = [];
  if (Array.isArray(o.decisions)) {
    for (const raw of o.decisions as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const d = raw as Record<string, unknown>;
      if (typeof d.id !== "string" || !d.id) continue;
      if (typeof d.problem !== "string" || typeof d.hypothesis !== "string" || typeof d.move !== "string") continue;
      if (typeof d.confidence !== "string" || !CONFIDENCES.includes(d.confidence as Confidence)) continue;
      if (typeof d.status !== "string" || !DECISION_STATUSES.includes(d.status as DecisionStatus)) continue;
      const decision: Decision = {
        id: d.id,
        createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date(0).toISOString(),
        problem: d.problem,
        hypothesis: d.hypothesis,
        move: d.move,
        reason: typeof d.reason === "string" ? d.reason : "",
        expectedImpact: typeof d.expectedImpact === "string" ? d.expectedImpact : "",
        confidence: d.confidence as Confidence,
        owner: typeof d.owner === "string" ? d.owner : "",
        dueDate: typeof d.dueDate === "string" ? d.dueDate : "",
        status: d.status as DecisionStatus,
      };
      if (typeof d.linkedNodeId === "string" && d.linkedNodeId) decision.linkedNodeId = d.linkedNodeId;
      if (typeof d.approvedBy === "string" && d.approvedBy) decision.approvedBy = d.approvedBy;
      if (typeof d.approvedAt === "string" && d.approvedAt) decision.approvedAt = d.approvedAt;
      const m = d.measurement as Record<string, unknown> | undefined;
      if (m && typeof m === "object" && typeof m.baseline === "number" && typeof m.expected === "number" && typeof m.observed === "number"
        && typeof m.outcome === "string" && OUTCOMES.includes(m.outcome as Outcome)) {
        const measurement: Measurement = {
          baseline: m.baseline, expected: m.expected, observed: m.observed,
          outcome: m.outcome as Outcome,
          learning: typeof m.learning === "string" ? m.learning : "",
          measuredAt: typeof m.measuredAt === "string" ? m.measuredAt : new Date(0).toISOString(),
        };
        decision.measurement = measurement;
      }
      decisions.push(decision);
    }
  }

  const RISK_SEVERITIES = ["low", "medium", "high"] as const;
  const RISK_STATUSES: readonly RiskRegisterStatus[] = ["open", "mitigated", "accepted"];
  const riskRegister: RiskRegisterEntry[] = [];
  if (Array.isArray(o.riskRegister)) {
    for (const raw of o.riskRegister as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.label !== "string" || !r.label) continue;
      if (typeof r.severity !== "string" || !RISK_SEVERITIES.includes(r.severity as (typeof RISK_SEVERITIES)[number])) continue;
      if (typeof r.status !== "string" || !RISK_STATUSES.includes(r.status as RiskRegisterStatus)) continue;
      const entry: RiskRegisterEntry = {
        id: r.id,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString(),
        label: r.label,
        description: typeof r.description === "string" ? r.description : "",
        severity: r.severity as RiskRegisterEntry["severity"],
        status: r.status as RiskRegisterStatus,
      };
      if (typeof r.owner === "string" && r.owner) entry.owner = r.owner;
      if (typeof r.resolution === "string" && r.resolution) entry.resolution = r.resolution;
      if (typeof r.linkedNodeId === "string" && r.linkedNodeId) entry.linkedNodeId = r.linkedNodeId;
      if (typeof r.resolvedAt === "string" && r.resolvedAt) entry.resolvedAt = r.resolvedAt;
      riskRegister.push(entry);
    }
  }

  const checklist: ChecklistItem[] = [];
  if (Array.isArray(o.checklist)) {
    for (const raw of o.checklist as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      if (typeof c.id !== "string" || !c.id) continue;
      if (typeof c.text !== "string" || !c.text) continue;
      const item: ChecklistItem = {
        id: c.id,
        text: c.text,
        done: c.done === true,
        createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date(0).toISOString(),
      };
      if (typeof c.doneAt === "string" && c.doneAt) item.doneAt = c.doneAt;
      if (typeof c.linkedNodeId === "string" && c.linkedNodeId) item.linkedNodeId = c.linkedNodeId;
      if (typeof c.parentId === "string" && c.parentId) item.parentId = c.parentId;
      checklist.push(item);
    }
  }

  const notes = typeof o.notes === "string" && o.notes.length > 0 && o.notes.length <= 20000 ? o.notes : undefined;

  const DEFINITION_KEYS: readonly (keyof BusinessDefinition)[] = [
    "businessName", "whoServe", "mainOffer", "currentReality", "breakthrough",
    "vision", "milestones", "mainConstraint", "mainOpportunity",
    "currentState", "currentStory", "newStory", "strategy", "weeklyFocus",
  ];
  let program: ProgramState | undefined;
  if (o.program && typeof o.program === "object" && !Array.isArray(o.program)) {
    const p = o.program as Record<string, unknown>;
    let definition: BusinessDefinition | undefined;
    if (p.definition && typeof p.definition === "object" && !Array.isArray(p.definition)) {
      const raw = p.definition as Record<string, unknown>;
      const d: BusinessDefinition = {};
      for (const k of DEFINITION_KEYS) {
        const v = raw[k];
        if (typeof v === "string" && v.length > 0 && v.length <= 4000) d[k] = v;
      }
      if (Object.keys(d).length) definition = d;
    }
    const FORCE_NUMBERS = [1, 2, 3, 4, 5, 6, 7];
    const STATUSES: readonly ActionStatus[] = ["open", "in_progress", "done"];
    const PRIORITIES: readonly ActionPriority[] = ["low", "medium", "high"];
    const CONFIDENCES: readonly ActionConfidence[] = ["low", "medium", "high"];
    const LINKED_KPIS: readonly LinkedKpi[] = ["grossProfit", "revenue", "buyers", "cost", "mrr", "ltv"];
    const actionNodeIds = new Set(nodes.map((n) => n.id));
    const forceActions: ForceActionItem[] = [];
    if (Array.isArray(p.forceActions)) {
      for (const raw of p.forceActions as unknown[]) {
        if (!raw || typeof raw !== "object") continue;
        const a = raw as Record<string, unknown>;
        if (typeof a.id !== "string" || !a.id) continue;
        if (typeof a.force !== "number" || !FORCE_NUMBERS.includes(a.force)) continue;
        if (typeof a.principle !== "string" || !a.principle) continue;
        if (typeof a.actionItem !== "string" || !a.actionItem) continue;
        if (typeof a.status !== "string" || !STATUSES.includes(a.status as ActionStatus)) continue;
        if (typeof a.priority !== "string" || !PRIORITIES.includes(a.priority as ActionPriority)) continue;
        const item: ForceActionItem = {
          id: a.id, force: a.force as ForceNumber, principle: a.principle, actionItem: a.actionItem,
          status: a.status as ActionStatus, priority: a.priority as ActionPriority,
          createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(0).toISOString(),
        };
        setNum(item, "dollarValue", a.dollarValue);
        if (typeof a.deadline === "string" && a.deadline) item.deadline = a.deadline;
        if (typeof a.owner === "string" && a.owner) item.owner = a.owner;
        if (typeof a.confidence === "string" && CONFIDENCES.includes(a.confidence as ActionConfidence)) item.confidence = a.confidence as ActionConfidence;
        if (typeof a.linkedNodeId === "string" && actionNodeIds.has(a.linkedNodeId)) item.linkedNodeId = a.linkedNodeId;
        if (typeof a.linkedKpi === "string" && LINKED_KPIS.includes(a.linkedKpi as LinkedKpi)) item.linkedKpi = a.linkedKpi as LinkedKpi;
        forceActions.push(item);
      }
    }
    const LESSON_KEYS = ["define", "story", "mindfulness", "money", "forces", "drivers", "raving", "brief"];
    const visitedLessons = Array.isArray(p.visitedLessons)
      ? [...new Set((p.visitedLessons as unknown[]).filter((v): v is string => typeof v === "string" && LESSON_KEYS.includes(v)))]
      : [];
    const introSeen = p.introSeen === true;
    const graduationSeen = p.graduationSeen === true;
    if (definition || forceActions.length || visitedLessons.length || introSeen || graduationSeen) {
      program = {
        ...(definition ? { definition } : {}), ...(forceActions.length ? { forceActions } : {}),
        ...(visitedLessons.length ? { visitedLessons } : {}), ...(introSeen ? { introSeen } : {}), ...(graduationSeen ? { graduationSeen } : {}),
      };
    }
  }

  let moneyMachine: MoneyMachineConfig | undefined;
  if (o.moneyMachine && typeof o.moneyMachine === "object" && !Array.isArray(o.moneyMachine)) {
    const m = o.moneyMachine as Record<string, unknown>;
    const isRate = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
    if (isRate(m.freedomFundRate) && isRate(m.securityRate) && isRate(m.growthRate) && isRate(m.dreamRate)) {
      moneyMachine = { freedomFundRate: m.freedomFundRate, securityRate: m.securityRate, growthRate: m.growthRate, dreamRate: m.dreamRate };
    }
  }

  let moneyMachineTargets: MoneyMachineTargets | undefined;
  if (o.moneyMachineTargets && typeof o.moneyMachineTargets === "object" && !Array.isArray(o.moneyMachineTargets)) {
    const t = o.moneyMachineTargets as Record<string, unknown>;
    const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
    const isDate = (v: unknown): v is string => typeof v === "string" && v.length > 0 && !Number.isNaN(new Date(v).getTime());
    const targets: MoneyMachineTargets = {};
    if (isAmount(t.securityTarget)) targets.securityTarget = t.securityTarget;
    if (isAmount(t.growthTarget)) targets.growthTarget = t.growthTarget;
    if (isAmount(t.dreamTarget)) targets.dreamTarget = t.dreamTarget;
    if (isDate(t.securityGoalDate)) targets.securityGoalDate = t.securityGoalDate;
    if (isDate(t.growthGoalDate)) targets.growthGoalDate = t.growthGoalDate;
    if (isDate(t.dreamGoalDate)) targets.dreamGoalDate = t.dreamGoalDate;
    if (Object.keys(targets).length > 0) moneyMachineTargets = targets;
  }

  const LEDGER_BUCKETS: readonly LedgerBucket[] = ["security", "growth", "dream"];
  const LEDGER_KINDS: readonly LedgerKind[] = ["contribution", "withdrawal"];
  const moneyMachineLedger: LedgerEntry[] = [];
  if (Array.isArray(o.moneyMachineLedger)) {
    for (const raw of o.moneyMachineLedger as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      if (typeof e.id !== "string" || !e.id) continue;
      if (typeof e.bucket !== "string" || !LEDGER_BUCKETS.includes(e.bucket as LedgerBucket)) continue;
      if (typeof e.kind !== "string" || !LEDGER_KINDS.includes(e.kind as LedgerKind)) continue;
      if (typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount < 0) continue;
      const entry: LedgerEntry = {
        id: e.id, bucket: e.bucket as LedgerBucket, kind: e.kind as LedgerKind, amount: e.amount,
        createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date(0).toISOString(),
      };
      if (typeof e.note === "string" && e.note) entry.note = e.note;
      moneyMachineLedger.push(entry);
    }
  }

  const objections: ObjectionEntry[] = [];
  if (Array.isArray(o.objections)) {
    for (const raw of o.objections as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.objection !== "string" || !r.objection) continue;
      if (typeof r.response !== "string" || !r.response) continue;
      objections.push({ id: r.id, objection: r.objection, response: r.response, createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString() });
    }
  }

  const hooks: HookEntry[] = [];
  if (Array.isArray(o.hooks)) {
    for (const raw of o.hooks as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.hook !== "string" || !r.hook) continue;
      const entry: HookEntry = { id: r.id, hook: r.hook, createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString() };
      if (typeof r.angle === "string" && r.angle) entry.angle = r.angle;
      hooks.push(entry);
    }
  }

  let profitDrivers: ProfitDriverInputs | undefined;
  if (o.profitDrivers && typeof o.profitDrivers === "object" && !Array.isArray(o.profitDrivers)) {
    const p = o.profitDrivers as Record<string, unknown>;
    const isPct = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -0.99 && v <= 10;
    if (isPct(p.leadsPct) && isPct(p.salesProcessPct) && isPct(p.conversionPct) && isPct(p.transactionValuePct) && isPct(p.retentionPct)) {
      profitDrivers = {
        leadsPct: p.leadsPct, salesProcessPct: p.salesProcessPct, conversionPct: p.conversionPct,
        transactionValuePct: p.transactionValuePct, retentionPct: p.retentionPct,
      };
    }
  }

  const clientPromises: ClientPromise[] = [];
  if (Array.isArray(o.clientPromises)) {
    for (const raw of o.clientPromises as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.promise !== "string" || !r.promise) continue;
      clientPromises.push({
        id: r.id, promise: r.promise, delivered: r.delivered === true,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString(),
      });
    }
  }

  let ravingFans: RavingFansInputs | undefined;
  if (o.ravingFans && typeof o.ravingFans === "object" && !Array.isArray(o.ravingFans)) {
    const r = o.ravingFans as Record<string, unknown>;
    const isRate = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
    if (isRate(r.retentionRate) && isRate(r.referralRate)) ravingFans = { retentionRate: r.retentionRate, referralRate: r.referralRate };
  }

  const MINDFULNESS_KINDS: readonly MindfulnessKind[] = ["assumption", "opportunity"];
  const mindfulness: MindfulnessEntry[] = [];
  if (Array.isArray(o.mindfulness)) {
    for (const raw of o.mindfulness as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.kind !== "string" || !MINDFULNESS_KINDS.includes(r.kind as MindfulnessKind)) continue;
      if (typeof r.text !== "string" || !r.text) continue;
      mindfulness.push({ id: r.id, kind: r.kind as MindfulnessKind, text: r.text, createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString() });
    }
  }

  const GOAL_LEVEL_VALUES: readonly GoalLevel[] = ["vision", "annual", "quarterly", "monthly_kpi", "project", "action"];
  const GOAL_STATUS_VALUES: readonly GoalStatus[] = ["not_started", "on_track", "at_risk", "done"];
  const goals: GoalNode[] = [];
  if (Array.isArray(o.goals)) {
    const seenIds = new Set<string>();
    for (const raw of o.goals as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const g = raw as Record<string, unknown>;
      if (typeof g.id !== "string" || !g.id || seenIds.has(g.id)) continue;
      if (typeof g.level !== "string" || !GOAL_LEVEL_VALUES.includes(g.level as GoalLevel)) continue;
      if (typeof g.title !== "string" || !g.title) continue;
      if (typeof g.status !== "string" || !GOAL_STATUS_VALUES.includes(g.status as GoalStatus)) continue;
      const node: GoalNode = {
        id: g.id, level: g.level as GoalLevel, title: g.title, status: g.status as GoalStatus,
        createdAt: typeof g.createdAt === "string" ? g.createdAt : new Date(0).toISOString(),
      };
      if (typeof g.parentId === "string" && g.parentId) node.parentId = g.parentId;
      if (typeof g.targetValue === "number" && Number.isFinite(g.targetValue)) node.targetValue = g.targetValue;
      if (typeof g.actualValue === "number" && Number.isFinite(g.actualValue)) node.actualValue = g.actualValue;
      if (typeof g.unit === "string" && g.unit) node.unit = g.unit;
      if (typeof g.dueDate === "string" && g.dueDate) node.dueDate = g.dueDate;
      if (typeof g.linkedNodeId === "string" && g.linkedNodeId) node.linkedNodeId = g.linkedNodeId;
      goals.push(node);
      seenIds.add(g.id);
    }
    // A parentId pointing at a goal that didn't survive validation (or never
    // existed) would silently orphan this node from every roll-up — drop
    // the dangling reference rather than let it point at nothing.
    const validIds = new Set(goals.map((g) => g.id));
    for (const g of goals) if (g.parentId && !validIds.has(g.parentId)) delete g.parentId;
  }

  const ASSUMPTION_CONFIDENCES: readonly AssumptionConfidence[] = ["low", "medium", "high"];
  const ASSUMPTION_STATUSES: readonly AssumptionStatus[] = ["untested", "testing", "confirmed", "invalidated"];
  const assumptions: AssumptionEntry[] = [];
  if (Array.isArray(o.assumptions)) {
    for (const raw of o.assumptions as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      if (typeof a.id !== "string" || !a.id) continue;
      if (typeof a.text !== "string" || !a.text) continue;
      if (typeof a.confidence !== "string" || !ASSUMPTION_CONFIDENCES.includes(a.confidence as AssumptionConfidence)) continue;
      if (typeof a.status !== "string" || !ASSUMPTION_STATUSES.includes(a.status as AssumptionStatus)) continue;
      const entry: AssumptionEntry = {
        id: a.id, text: a.text, confidence: a.confidence as AssumptionConfidence, status: a.status as AssumptionStatus,
        createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(0).toISOString(),
      };
      if (typeof a.category === "string" && a.category) entry.category = a.category;
      if (typeof a.evidenceFor === "string" && a.evidenceFor) entry.evidenceFor = a.evidenceFor;
      if (typeof a.evidenceAgainst === "string" && a.evidenceAgainst) entry.evidenceAgainst = a.evidenceAgainst;
      if (typeof a.owner === "string" && a.owner) entry.owner = a.owner;
      if (typeof a.testByDate === "string" && a.testByDate) entry.testByDate = a.testByDate;
      if (typeof a.linkedNodeId === "string" && a.linkedNodeId) entry.linkedNodeId = a.linkedNodeId;
      if (typeof a.reviewedAt === "string" && a.reviewedAt) entry.reviewedAt = a.reviewedAt;
      assumptions.push(entry);
    }
  }

  const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = ["planned", "running", "completed", "abandoned"];
  const EXPERIMENT_DECISIONS: readonly ExperimentDecision[] = ["adopt", "iterate", "retest", "stop", "insufficient_evidence", "reject"];
  const EXPERIMENT_CONFIDENCES: readonly ExperimentConfidence[] = ["low", "medium", "high"];
  const experiments: ExperimentEntry[] = [];
  if (Array.isArray(o.experiments)) {
    const assumptionIds = new Set(assumptions.map((a) => a.id));
    const experimentIds = new Set((o.experiments as unknown[]).map((raw) => (raw && typeof raw === "object" ? (raw as Record<string, unknown>).id : undefined)).filter((v): v is string => typeof v === "string" && !!v));
    for (const raw of o.experiments as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      if (typeof e.id !== "string" || !e.id) continue;
      if (typeof e.hypothesis !== "string" || !e.hypothesis) continue;
      if (typeof e.status !== "string" || !EXPERIMENT_STATUSES.includes(e.status as ExperimentStatus)) continue;
      const entry: ExperimentEntry = {
        id: e.id, hypothesis: e.hypothesis, status: e.status as ExperimentStatus,
        createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date(0).toISOString(),
      };
      if (typeof e.metric === "string" && e.metric) entry.metric = e.metric;
      if (typeof e.baseline === "string" && e.baseline) entry.baseline = e.baseline;
      if (typeof e.sampleSize === "number" && Number.isFinite(e.sampleSize) && e.sampleSize >= 0) entry.sampleSize = e.sampleSize;
      if (typeof e.successThreshold === "string" && e.successThreshold) entry.successThreshold = e.successThreshold;
      if (typeof e.testDesign === "string" && e.testDesign) entry.testDesign = e.testDesign;
      if (typeof e.audience === "string" && e.audience) entry.audience = e.audience;
      if (typeof e.owner === "string" && e.owner) entry.owner = e.owner;
      if (typeof e.cost === "number" && Number.isFinite(e.cost) && e.cost >= 0) entry.cost = e.cost;
      if (typeof e.startDate === "string" && e.startDate) entry.startDate = e.startDate;
      if (typeof e.endDate === "string" && e.endDate) entry.endDate = e.endDate;
      if (typeof e.result === "string" && e.result) entry.result = e.result;
      if (typeof e.confidence === "string" && EXPERIMENT_CONFIDENCES.includes(e.confidence as ExperimentConfidence)) entry.confidence = e.confidence as ExperimentConfidence;
      if (typeof e.decision === "string" && EXPERIMENT_DECISIONS.includes(e.decision as ExperimentDecision)) entry.decision = e.decision as ExperimentDecision;
      if (typeof e.learning === "string" && e.learning) entry.learning = e.learning;
      if (typeof e.followUpExperimentId === "string" && e.followUpExperimentId !== e.id && experimentIds.has(e.followUpExperimentId)) entry.followUpExperimentId = e.followUpExperimentId;
      if (typeof e.linkedNodeId === "string" && e.linkedNodeId) entry.linkedNodeId = e.linkedNodeId;
      if (typeof e.linkedAssumptionId === "string" && assumptionIds.has(e.linkedAssumptionId)) entry.linkedAssumptionId = e.linkedAssumptionId;
      experiments.push(entry);
    }
  }

  const APPROVAL_STATUSES: readonly ApprovalStatus[] = ["not_required", "pending", "approved", "changes_requested"];
  const INTEGRATION_STATUSES: readonly IntegrationStatus[] = ["planned", "manual", "connected"];
  const blockOps: BlockOpsEntry[] = [];
  if (Array.isArray(o.blockOps)) {
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const raw of o.blockOps as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as Record<string, unknown>;
      if (typeof b.id !== "string" || !b.id) continue;
      if (typeof b.linkedNodeId !== "string" || !nodeIds.has(b.linkedNodeId)) continue;
      const checklist: BlockOpsChecklistItem[] = Array.isArray(b.checklist)
        ? (b.checklist as unknown[]).flatMap((raw2) => {
            if (!raw2 || typeof raw2 !== "object") return [];
            const c = raw2 as Record<string, unknown>;
            if (typeof c.id !== "string" || !c.id || typeof c.label !== "string" || !c.label) return [];
            return [{ id: c.id, label: c.label, done: c.done === true }];
          })
        : [];
      const kpis: BlockOpsKpi[] = Array.isArray(b.kpis)
        ? (b.kpis as unknown[]).flatMap((raw2) => {
            if (!raw2 || typeof raw2 !== "object") return [];
            const k = raw2 as Record<string, unknown>;
            if (typeof k.id !== "string" || !k.id || typeof k.name !== "string" || !k.name) return [];
            const kpi: BlockOpsKpi = { id: k.id, name: k.name };
            if (typeof k.target === "number" && Number.isFinite(k.target)) kpi.target = k.target;
            if (typeof k.actual === "number" && Number.isFinite(k.actual)) kpi.actual = k.actual;
            if (typeof k.unit === "string" && k.unit) kpi.unit = k.unit;
            return [kpi];
          })
        : [];
      const entry: BlockOpsEntry = {
        id: b.id, linkedNodeId: b.linkedNodeId, checklist, kpis,
        approvalStatus: typeof b.approvalStatus === "string" && APPROVAL_STATUSES.includes(b.approvalStatus as ApprovalStatus) ? b.approvalStatus as ApprovalStatus : "not_required",
        integrationStatus: typeof b.integrationStatus === "string" && INTEGRATION_STATUSES.includes(b.integrationStatus as IntegrationStatus) ? b.integrationStatus as IntegrationStatus : "planned",
        createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date(0).toISOString(),
        updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : new Date(0).toISOString(),
      };
      if (typeof b.purpose === "string" && b.purpose) entry.purpose = b.purpose;
      if (typeof b.setupInstructions === "string" && b.setupInstructions) entry.setupInstructions = b.setupInstructions;
      if (typeof b.sop === "string" && b.sop) entry.sop = b.sop;
      if (typeof b.owner === "string" && b.owner) entry.owner = b.owner;
      if (typeof b.dueDate === "string" && b.dueDate) entry.dueDate = b.dueDate;
      if (typeof b.automationOpportunities === "string" && b.automationOpportunities) entry.automationOpportunities = b.automationOpportunities;
      if (Array.isArray(b.requiredInputs)) { const list = (b.requiredInputs as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x)); if (list.length) entry.requiredInputs = list; }
      if (Array.isArray(b.evidenceLinks)) { const list = (b.evidenceLinks as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x)); if (list.length) entry.evidenceLinks = list; }
      blockOps.push(entry);
    }
  }

  const retargetingLoops: RetargetingLoop[] = [];
  if (Array.isArray(o.retargetingLoops)) {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const PORTS = ["out", "yes", "no"];
    for (const raw of o.retargetingLoops as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) continue;
      if (typeof r.fromNodeId !== "string" || !nodeIds.has(r.fromNodeId)) continue;
      if (typeof r.toNodeId !== "string" || !nodeIds.has(r.toNodeId)) continue;
      if (typeof r.fromPort !== "string" || !PORTS.includes(r.fromPort)) continue;
      if (typeof r.decayRate !== "number" || !Number.isFinite(r.decayRate) || r.decayRate < 0 || r.decayRate > 1) continue;
      retargetingLoops.push({ id: r.id, fromNodeId: r.fromNodeId, fromPort: r.fromPort as RetargetingLoop["fromPort"], toNodeId: r.toNodeId, decayRate: r.decayRate });
    }
  }

  const annotations: DocAnnotation[] = [];
  if (Array.isArray(o.annotations)) {
    for (const raw of o.annotations as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      if (typeof a.id !== "string" || !a.id) continue;
      if (a.kind !== "text" && a.kind !== "sticky") continue;
      if (typeof a.x !== "number" || !Number.isFinite(a.x)) continue;
      if (typeof a.y !== "number" || !Number.isFinite(a.y)) continue;
      if (typeof a.w !== "number" || !Number.isFinite(a.w) || a.w <= 0) continue;
      if (typeof a.h !== "number" || !Number.isFinite(a.h) || a.h <= 0) continue;
      const ann: DocAnnotation = { id: a.id, kind: a.kind, x: a.x, y: a.y, w: a.w, h: a.h };
      if (typeof a.text === "string" && a.text.length <= 2000) ann.text = a.text;
      if (typeof a.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(a.color)) ann.color = a.color;
      annotations.push(ann);
    }
  }

  // reporting period, only kept when it is a real, ordered pair of ISO days
  let period: FunnelDoc["period"];
  const rawP = o.period;
  if (rawP && typeof rawP === "object" && !Array.isArray(rawP)) {
    const e = rawP as Record<string, unknown>;
    if (typeof e.start === "string" && typeof e.end === "string" && isValidPeriod({ start: e.start, end: e.end })) {
      period = { start: e.start, end: e.end };
    }
  }

  // scenario-wide expenses (validated the same way as node rates)
  let expenses: FunnelDoc["expenses"];
  const rawExp = o.expenses;
  if (rawExp && typeof rawExp === "object" && !Array.isArray(rawExp)) {
    const e = rawExp as Record<string, unknown>;
    const out: { amount?: number; rate?: number } = {};
    if (typeof e.amount === "number" && Number.isFinite(e.amount) && e.amount >= 0) out.amount = e.amount;
    if (typeof e.rate === "number" && Number.isFinite(e.rate) && e.rate >= 0 && e.rate <= 1) out.rate = e.rate;
    if (out.amount != null || out.rate != null) expenses = out;
  }

  return {
    version: typeof o.version === "number" ? o.version : DOC_VERSION,
    name: typeof o.name === "string" ? o.name : "Untitled funnel",
    currency: typeof o.currency === "string" ? o.currency : "USD",
    nodes,
    edges,
    actuals,
    decisions,
    ...(expenses ? { expenses } : {}),
    ...(o.archived === true ? { archived: true } : {}),
    ...(period ? { period } : {}),
    ...(riskRegister.length ? { riskRegister } : {}),
    ...(checklist.length ? { checklist } : {}),
    ...(notes ? { notes } : {}),
    ...(program ? { program } : {}),
    ...(moneyMachine ? { moneyMachine } : {}),
    ...(moneyMachineTargets ? { moneyMachineTargets } : {}),
    ...(moneyMachineLedger.length ? { moneyMachineLedger } : {}),
    ...(objections.length ? { objections } : {}),
    ...(hooks.length ? { hooks } : {}),
    ...(profitDrivers ? { profitDrivers } : {}),
    ...(clientPromises.length ? { clientPromises } : {}),
    ...(ravingFans ? { ravingFans } : {}),
    ...(mindfulness.length ? { mindfulness } : {}),
    ...(goals.length ? { goals } : {}),
    ...(assumptions.length ? { assumptions } : {}),
    ...(experiments.length ? { experiments } : {}),
    ...(retargetingLoops.length ? { retargetingLoops } : {}),
    ...(annotations.length ? { annotations } : {}),
    ...(blockOps.length ? { blockOps } : {}),
  };
}

function setNum<T extends object>(obj: T, key: keyof T, v: unknown): void {
  if (typeof v === "number" && Number.isFinite(v)) {
    (obj as Record<string, unknown>)[key as string] = v;
  }
}
