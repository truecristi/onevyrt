"use client";
/**
 * Business Intelligence — the business-definition + 7 Systems workbook that
 * used to live behind an in-canvas "Program" mode in the funnel Studio. It
 * now lives here, as its own Psychology page, so knowing the business (who
 * you serve, the 7 Systems, the Freedom Plan, goals/assumptions/experiments,
 * the Growth Brief) is reachable without opening a funnel map first.
 *
 * The underlying data is unchanged: it still lives in the workspace's
 * project doc (FunnelDoc.program + the sibling money-machine/persuasion/
 * goals fields) — Business-OS and the guided programme course keep reading
 * derived summaries from the exact same fields. This page loads the
 * workspace's most-recently-updated project (the same "primary project"
 * heuristic used elsewhere in the app), renders the existing ProgramCentre
 * component against it verbatim, and saves edits straight back to that
 * project's doc — never touching its nodes/edges/actuals/etc.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  simulate, FunnelError, assessRisk, computeVariance, aggregateActuals, hasActuals,
  serializeDoc, deserializeDoc,
  DEFAULT_MONEY_MACHINE_CONFIG, DEFAULT_PROFIT_DRIVER_INPUTS,
  type FunnelDoc, type NodeActuals, type RiskReport, type VarianceReport,
  type ScenarioComparison, type BusinessDefinition,
} from "@onevyrt/engine";
import { toFunnel, type RFNodeData } from "../../../lib/funnel-map";
import { docToNodes, docToEdges, toDoc } from "../../../lib/studio/funnel-doc";
import { useProgram, useClientValue, DEFAULT_RAVING_FANS } from "../../../lib/studio/hooks/use-studio-domains";
import { useMoneyMachine } from "../../../lib/studio/hooks/use-money-machine";
import { usePersuasion } from "../../../lib/studio/hooks/use-persuasion";
import { useExperiments } from "../../../lib/studio/hooks/use-experiments";
import { useAiConnection } from "../../../lib/studio/hooks/use-ai-connection";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { fetchRealityMap, realityToDefinition, REALITY_FIELD_SOURCE } from "../../../lib/studio/reality-bridge";
import { fetchBrandProfile, brandToDefinition, BRAND_FIELD_SOURCE } from "../../../lib/studio/brand-bridge";
import { fetchOffer, offerToDefinition, OFFER_FIELD_SOURCE } from "../../../lib/studio/offer-bridge";
import { fetchConstraint, constraintToDefinition, CONSTRAINT_FIELD_SOURCE } from "../../../lib/studio/constraint-bridge";
import { THEME_CSS } from "../../../lib/studio/theme-css";
import { ProgramCentre } from "../../../components/ProgramCentre";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { Notice } from "../../../components/ui/Notice";

type ViewState = "loading" | "empty" | "not-authenticated" | "error" | "ready";

// Per-field human label for the "use this" suggestion chip, merged from
// every bridge that can fill a BusinessDefinition field — static (no
// per-render recompute needed), and disjoint by construction: each bridge
// only maps its own genuine 1:1 overlaps (see each bridge module's own
// doc comment), so there's no field two sources both claim.
const SUGGESTION_SOURCE = { ...REALITY_FIELD_SOURCE, ...BRAND_FIELD_SOURCE, ...OFFER_FIELD_SOURCE, ...CONSTRAINT_FIELD_SOURCE };

export default function BusinessIntelligencePage() {
  // Honour a ?ws=<id> deep-link (e.g. from the Studio's own header menu or
  // onboarding nudges) the same established way every Business-OS/Psychology
  // page does — captured once (lazy) so there's no server/client hydration
  // mismatch.
  const [wsId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("ws") ?? "";
  });
  const wsQuery = wsId ? `?ws=${encodeURIComponent(wsId)}` : "";

  const [state, setState] = useState<ViewState>("loading");
  const [projectId, setProjectId] = useState("");
  const [baseDoc, setBaseDoc] = useState<FunnelDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  // Every field ProgramCentre reads/writes is one of these hooks — the exact
  // same ones funnel-studio.tsx uses, so a project saved from the canvas and
  // one saved from here round-trip through the identical shape.
  const {
    definition, patchDefinition, setDefinition,
    forceActions, addForceAction, patchForceAction, removeForceAction, setForceActions,
    visitedLessons, setVisitedLessons, onVisitLesson,
    introSeen, setIntroSeen, graduationSeen, setGraduationSeen,
    program,
  } = useProgram();
  const {
    moneyMachineCfg, setMoneyMachineCfg, patchMoneyMachine,
    moneyMachineTargets, setMoneyMachineTargets, patchMoneyMachineTargets,
    moneyMachineLedger, setMoneyMachineLedger, addLedgerEntry, removeLedgerEntry,
  } = useMoneyMachine();
  const {
    objections, setObjections, addObjection, removeObjection,
    hooks, setHooks, addHook, removeHook,
    mindfulness, setMindfulness, addMindfulness, removeMindfulness,
  } = usePersuasion();
  const {
    assumptions, setAssumptions, addAssumption, updateAssumption, removeAssumption,
    experiments, setExperiments, addExperiment, updateExperiment, removeExperiment,
    goals, setGoals, addGoal, updateGoal, removeGoal,
  } = useExperiments();
  const {
    profitDrivers, setProfitDrivers, patchProfitDrivers,
    clientPromises, setClientPromises, addClientPromise, toggleClientPromise, removeClientPromise,
    ravingFansInputs, setRavingFansInputs, patchRavingFans,
  } = useClientValue();
  const { aiKey, callOpenRouter } = useAiConnection();
  const [aiHooksBusy, setAiHooksBusy] = useState(false);
  const [aiHooksErr, setAiHooksErr] = useState("");

  const [realitySuggestions, setRealitySuggestions] = useState<Partial<BusinessDefinition>>({});
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      // "Primary project" = the newest project that actually has a
      // populated business definition, not just whichever project was
      // touched most recently (lib/studio/primary-project.ts) — touching
      // an unrelated blank project used to be able to hide a
      // fully-completed workbook living on an older one.
      const rl = await fetch(`/api/projects/primary${wsQuery}`);
      if (rl.status === 401) { setState("not-authenticated"); return; }
      if (!rl.ok) { setState("error"); return; }
      const primary = await rl.json() as { id: string | null; name: string | null };
      if (!primary.id) { setState("empty"); return; }
      const rp = await fetch(`/api/projects/${encodeURIComponent(primary.id)}${wsQuery}`);
      if (!rp.ok) { setState("error"); return; }
      const proj = await rp.json() as { name: string; doc: string; updatedAt: string };
      const doc = deserializeDoc(proj.doc);
      setDefinition(doc.program?.definition ?? {});
      setForceActions(doc.program?.forceActions ?? []);
      setVisitedLessons(doc.program?.visitedLessons ?? []);
      setIntroSeen(doc.program?.introSeen ?? false);
      setGraduationSeen(doc.program?.graduationSeen ?? false);
      setMoneyMachineCfg(doc.moneyMachine ?? DEFAULT_MONEY_MACHINE_CONFIG);
      setMoneyMachineTargets(doc.moneyMachineTargets ?? {});
      setMoneyMachineLedger(doc.moneyMachineLedger ?? []);
      setObjections(doc.objections ?? []);
      setHooks(doc.hooks ?? []);
      setProfitDrivers(doc.profitDrivers ?? DEFAULT_PROFIT_DRIVER_INPUTS);
      setClientPromises(doc.clientPromises ?? []);
      setRavingFansInputs(doc.ravingFans ?? DEFAULT_RAVING_FANS);
      setMindfulness(doc.mindfulness ?? []);
      setGoals(doc.goals ?? []);
      setAssumptions(doc.assumptions ?? []);
      setExperiments(doc.experiments ?? []);
      setBaseDoc(doc);
      setProjectId(primary.id);
      setState("ready");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  // Business-OS bridges — offer "use what you already told Business-OS"
  // suggestions on empty Define fields, scoped to this workspace only.
  // Reality Map, Brand Brain, the Offer tool and the Growth Constraint
  // tool each cover a different, non-overlapping slice of
  // BusinessDefinition (see each bridge module's own doc comment), so
  // their results are just merged — no precedence to arbitrate.
  useEffect(() => {
    if (!wsId) { setRealitySuggestions({}); return; }
    let live = true;
    void Promise.all([
      fetchRealityMap(wsId).then(realityToDefinition),
      fetchBrandProfile(wsId).then(brandToDefinition),
      fetchOffer(wsId).then(offerToDefinition),
      fetchConstraint(wsId).then(constraintToDefinition),
    ]).then(([reality, brand, offer, constraint]) => {
      if (live) setRealitySuggestions({ ...reality, ...brand, ...offer, ...constraint });
    });
    return () => { live = false; };
  }, [wsId]);

  // Brand + strategy grounding for the per-field "✨ AI" drafts.
  useEffect(() => {
    let live = true;
    void loadGrounding().then((g) => { if (live) setGrounding(g); });
    return () => { live = false; };
  }, []);

  // Simulation-derived props (monthlyProfit, driverBaseline, risk, variance):
  // there's no live canvas here, so these are recomputed from the SAME
  // stored doc via toFunnel + simulate, exactly like the project library's
  // own card previews already do (loadOneLibProject in funnel-studio.tsx).
  const rfNodes = useMemo(
    () => (baseDoc ? docToNodes(baseDoc).filter((n) => n.type !== "annot").map((n) => ({ id: n.id, data: n.data as RFNodeData })) : []),
    [baseDoc],
  );
  const rfEdges = useMemo(
    () => (baseDoc ? docToEdges(baseDoc).map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })) : []),
    [baseDoc],
  );
  const sim = useMemo(() => {
    if (!baseDoc) return { ok: false as const, error: "" };
    try { return { ok: true as const, data: simulate(toFunnel(rfNodes, rfEdges)) }; }
    catch (e) { return { ok: false as const, error: e instanceof FunnelError ? e.message : String(e) }; }
  }, [baseDoc, rfNodes, rfEdges]);
  const risk = useMemo<RiskReport | null>(() => {
    if (!baseDoc) return null;
    try { return assessRisk(toFunnel(rfNodes, rfEdges)); } catch { return null; }
  }, [baseDoc, rfNodes, rfEdges]);
  const actuals = useMemo(() => (baseDoc?.actuals ?? {}) as Record<string, NodeActuals>, [baseDoc]);
  const actualTotals = useMemo(() => aggregateActuals(actuals), [actuals]);
  const anyActuals = useMemo(() => hasActuals(actuals), [actuals]);
  const variance = useMemo<VarianceReport | null>(
    () => (sim.ok && anyActuals ? computeVariance(sim.data, actuals) : null),
    [sim, actuals, anyActuals],
  );
  const canvasNodes = useMemo(() => rfNodes.map((n) => ({ id: n.id, label: (n.data as RFNodeData).label })), [rfNodes]);
  const monthlyProfit = anyActuals ? actualTotals.grossProfit : (sim.ok ? sim.data.totals.grossProfit : 0);
  const profitSource: "plan" | "actual" = anyActuals ? "actual" : "plan";
  const driverBaseline = sim.ok ? { revenue: sim.data.totals.revenue, cost: sim.data.totals.cost } : { revenue: 0, cost: 0 };
  const monthlyVisitors = sim.ok ? sim.data.totals.visitors : 0;
  // Scenarios are canvas-session-only (never part of FunnelDoc — see
  // packages/engine/src/persist.ts) — there is nothing saved to compare
  // against on a fresh load. This matches the canvas's own
  // `scenarios.length > 0 ? scenarioComparison : null` fallback, which is
  // already null every time ProgramCentre is on screen there too (its
  // comparison only ever populates while mode === "scenarios").
  const scenarioComparison: ScenarioComparison | null = null;

  // Report sharing — identical fetch plumbing to funnel-studio.tsx's
  // shareReport/unshareReport/getShareStatus, keyed on this same project id.
  const shareReport = useCallback(async (html: string): Promise<{ url: string; expiresAt: number } | { error: string }> => {
    if (!projectId) return { error: "This project hasn't loaded yet." };
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/share${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ html }) });
      const data = await r.json() as { url?: string; expiresAt?: number; error?: string };
      if (!r.ok || !data.url || !data.expiresAt) return { error: data.error ?? "Could not create the share link." };
      return { url: data.url, expiresAt: data.expiresAt };
    } catch { return { error: "Network error — is the app reachable?" }; }
  }, [projectId, wsQuery]);
  const unshareReport = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    try { const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/share${wsQuery}`, { method: "DELETE" }); return r.ok; }
    catch { return false; }
  }, [projectId, wsQuery]);
  const getShareStatus = useCallback(async (): Promise<{ url: string; expiresAt: number } | null> => {
    if (!projectId) return null;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/share${wsQuery}`);
      const data = await r.json() as { active?: { url: string; expiresAt: number } | null };
      return data.active ?? null;
    } catch { return null; }
  }, [projectId, wsQuery]);

  // "Generate with AI" on the Hooks tab — same prompt/parsing as
  // funnel-studio.tsx's generateHooksWithAi, using the one shared AI
  // connection (lib/ai/client — the same key set from any AI button in the
  // app). The error message points to Campaign Studio → Connections, the
  // actual place to connect one from outside the canvas (the canvas's own
  // "Tools → AI Copilot" menu doesn't exist here).
  const generateHooksWithAi = useCallback(async () => {
    if (!aiKey) { setAiHooksErr("Connect an AI provider in Campaign Studio → Connections first."); return; }
    setAiHooksBusy(true); setAiHooksErr("");
    try {
      const g = await loadGrounding();
      const brief = [
        definition.mainOffer ? `Offer: ${definition.mainOffer}` : null,
        definition.whoServe ? `Audience: ${definition.whoServe}` : null,
        definition.breakthrough ? `Breakthrough we're selling: ${definition.breakthrough}` : null,
        objections.length ? `Known objections: ${objections.map((o) => o.objection).join("; ")}` : null,
      ].filter(Boolean).join("\n") || "No business definition entered yet — write generic but strong direct-response hooks.";
      const text = await callOpenRouter(
        "You write direct-response ad hooks/headlines. Given a business brief, output exactly 5 hooks, one per line, no numbering, no quotes, no extra commentary. Each under 15 words.",
        [{ role: "user", content: withGrounding(g, brief) }],
        400,
      );
      const lines = text.split("\n").map((l) => l.replace(/^[-*\d.\s"]+/, "").trim()).filter(Boolean);
      for (const line of lines) addHook(line, "ai-generated");
    } catch (e) {
      setAiHooksErr(e instanceof Error ? e.message : "Network error calling the AI.");
    } finally { setAiHooksBusy(false); }
  }, [aiKey, definition, objections, addHook, callOpenRouter]);

  // Persist: every mutation callback above updates the local hook state, and
  // this debounced effect (same 1500ms debounce as the canvas's own
  // autosave) merges the current program/money-machine/persuasion/goals
  // state into the FULL loaded doc and saves the whole thing back — nodes,
  // edges, actuals, decisions, risk register, checklist, notes and every
  // other field ProgramCentre doesn't own ride along completely unchanged.
  const readyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!baseDoc || !projectId) return;
    if (!readyRef.current) { readyRef.current = true; return; } // skip the hydration render itself
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        const doc = toDoc(
          baseDoc.name, docToNodes(baseDoc), docToEdges(baseDoc), baseDoc.actuals, baseDoc.decisions, baseDoc.currency,
          baseDoc.expenses, baseDoc.period, baseDoc.riskRegister, baseDoc.checklist, baseDoc.notes,
          program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs,
          baseDoc.retargetingLoops, mindfulness, goals, assumptions, experiments,
          moneyMachineTargets, moneyMachineLedger, baseDoc.blockOps,
        );
        try {
          const r = await fetch(`/api/projects${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, name: baseDoc.name, doc: serializeDoc(doc) }) });
          setSaveMsg(r.ok ? `Saved · ${new Date().toLocaleTimeString()}` : "Couldn't save — check your connection and try again.");
        } catch { setSaveMsg("Couldn't save — network error."); }
      })();
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [baseDoc, projectId, wsQuery, program, moneyMachineCfg, moneyMachineTargets, moneyMachineLedger, objections, hooks, mindfulness, assumptions, experiments, goals, profitDrivers, clientPromises, ravingFansInputs]);

  if (state === "loading") return <Shell><div className="loading">Loading your Business Intelligence workbook…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="lock" title="Sign in required" body="Sign in to view and edit this workspace's Business Intelligence workbook." href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="warning" title="Couldn't load Business Intelligence" body="Something went wrong loading your project." onRetry={() => void load()} /></Shell>;
  if (state === "empty") {
    return (
      <Shell>
        <Notice icon="studio" title="Map a funnel first" body="Business Intelligence works from a funnel project — map one in the Studio, then come back here to define the business behind it." href={`/studio${wsQuery}`} cta="Open the Studio" />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">PSYCHOLOGY · BUSINESS INTELLIGENCE</div>
          <h1>Business Intelligence</h1>
          <p className="sub">Define the business, work the 7 Systems, set your Freedom Plan, and generate the Growth Brief — the numbers-backed foundation the rest of your plan builds on.</p>
        </div>
        <div className="proj">
          <div className="proj-label">WORKING FROM</div>
          <div className="proj-name">{baseDoc?.name || "Untitled funnel"}</div>
          <a className="proj-link" href={`/studio${wsQuery}`}><MarketingIcon name="studio" size={12} /> Open the canvas</a>
        </div>
      </div>
      {saveMsg && <div className="savenote">{saveMsg}</div>}

      <div className="bi-frame">
        <style>{THEME_CSS}</style>
        <ProgramCentre
          definition={definition} patchDefinition={patchDefinition} forceActions={forceActions}
          addForceAction={addForceAction} patchForceAction={patchForceAction} removeForceAction={removeForceAction}
          currency={baseDoc?.currency ?? "USD"}
          canvasNodes={canvasNodes}
          risk={risk} variance={variance} scenarioComparison={scenarioComparison}
          onContinueToCanvas={() => { window.location.href = `/studio${wsQuery}`; }}
          visitedLessons={visitedLessons} onVisitLesson={onVisitLesson}
          introSeen={introSeen} onDismissIntro={() => setIntroSeen(true)}
          graduationSeen={graduationSeen} onAckGraduation={() => setGraduationSeen(true)}
          moneyMachineCfg={moneyMachineCfg} patchMoneyMachine={patchMoneyMachine}
          monthlyProfit={monthlyProfit} profitSource={profitSource}
          moneyMachineTargets={moneyMachineTargets} patchMoneyMachineTargets={patchMoneyMachineTargets}
          moneyMachineLedger={moneyMachineLedger} addLedgerEntry={addLedgerEntry} removeLedgerEntry={removeLedgerEntry}
          shareReport={shareReport} unshareReport={unshareReport} getShareStatus={getShareStatus}
          objections={objections} addObjection={addObjection} removeObjection={removeObjection}
          hooks={hooks} addHook={addHook} removeHook={removeHook}
          generateHooksWithAi={() => void generateHooksWithAi()} aiHooksBusy={aiHooksBusy} aiHooksErr={aiHooksErr}
          profitDrivers={profitDrivers} patchProfitDrivers={patchProfitDrivers}
          driverBaseline={driverBaseline}
          monthlyVisitors={monthlyVisitors}
          clientPromises={clientPromises} addClientPromise={addClientPromise} toggleClientPromise={toggleClientPromise} removeClientPromise={removeClientPromise}
          ravingFansInputs={ravingFansInputs} patchRavingFans={patchRavingFans}
          mindfulness={mindfulness} addMindfulness={addMindfulness} removeMindfulness={removeMindfulness}
          goals={goals} addGoal={addGoal} updateGoal={updateGoal} removeGoal={removeGoal}
          assumptions={assumptions} addAssumption={addAssumption} updateAssumption={updateAssumption} removeAssumption={removeAssumption}
          experiments={experiments} addExperiment={addExperiment} updateExperiment={updateExperiment} removeExperiment={removeExperiment}
          realitySuggestions={realitySuggestions} suggestionSource={SUGGESTION_SOURCE} realityHref={`/business/profile${wsQuery}`} grounding={grounding}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="bi-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.bi-root{
  max-width:1040px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--ds-text-primary);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.bi-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px;}
.hub-header h1{font-size:28px;font-weight:700;margin:3px 0 6px;letter-spacing:-.6px;color:var(--ds-text-primary);}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow::before{content:"";width:16px;height:2px;border-radius:2px;background:var(--ds-brand);}
.sub{color:var(--ds-text-secondary);font-size:14px;margin:0;max-width:68ch;line-height:1.55;}
.proj{flex:0 0 auto;text-align:right;background:var(--ds-surface);border:1px solid var(--ds-border-default);border-radius:12px;padding:10px 16px;box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.04));}
.proj-label{font-size:9.5px;font-weight:700;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.proj-name{font-size:13.5px;font-weight:700;color:var(--ds-text-primary);margin-top:2px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.proj-link{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:12px;font-weight:600;color:var(--ds-brand-hover);text-decoration:none;}
.proj-link:hover{color:var(--ds-brand-active);text-decoration:underline;}
.savenote{font-size:11.5px;color:var(--ds-text-tertiary);margin:10px 0 4px;}
.loading{background:var(--ds-surface);border:1px dashed var(--ds-border-default);border-radius:12px;padding:36px 22px;text-align:center;color:var(--ds-text-tertiary);font-size:13.5px;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--ds-surface);border:1px solid var(--ds-border-default);color:var(--ds-text-primary);border-radius:10px;padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;}
.btn:hover{background:var(--ds-surface-subtle);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);}
/* The workbook itself (ProgramCentre) brings its own studio design tokens
   via THEME_CSS above — this frame just gives it a bordered "card" home
   inside the Psychology page's chrome, in the SAME tokens (var(--surface) /
   var(--border) / var(--canvas) are defined by THEME_CSS on [data-theme],
   not by this stylesheet, so they resolve to the studio's own palette). */
.bi-frame{margin-top:18px;background:var(--canvas);border:1px solid var(--border);border-radius:14px;overflow:hidden;min-height:420px;}
@media (prefers-reduced-motion: reduce){.bi-root *{transition:none!important;animation:none!important;}}
`;
