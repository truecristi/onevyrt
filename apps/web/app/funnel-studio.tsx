"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BrandMark as AppLogoMark } from "../components/BrandLogo";
import { MarketingIcon } from "../components/MarketingIcons";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
  type Node, type Edge, type Connection,
} from "@xyflow/react";
import {
  simulate, currencyCodes, CURRENCIES, FunnelError,
  aggregateActuals, hasActuals, computeVariance,
  type NodeActuals, type NodeVariance,
  serializeDoc, deserializeDoc, PersistError, type FunnelDoc,
  computeCalibration, type CalibProposal,
  closeDecision, approveDecision, revokeApproval, type Decision,
  buildReport,
  compareScenarios, type Scenario, type ScenarioComparison, type ScenarioOverride,
  assessRisk, type RiskReport,
  evaluateConstraints, type Constraint, type ConstraintReport, type ConstraintKind, type ThresholdMetric,
  computeTimeline, type TimelineReport,
  type ChecklistItem,
  DEFAULT_MONEY_MACHINE_CONFIG,
  computeReadiness,
  DEFAULT_PROFIT_DRIVER_INPUTS,
  exploreStep,
  topoOrder,
  inferBenchmarkKey, compareToBenchmark,
  simulateWithRetargeting, type RetargetingLoop,
  type EdgeLineType,
  isValidPeriod, periodDays, perDay, describePeriod,
  collectActionItems, isOverdue,
} from "@onevyrt/engine";
import { toFunnel, defaultData, type RFNodeData } from "../lib/funnel-map";
import { keyOf, DRAFT_KEY, DRAFT_ID_KEY, readIndex, writeIndex, toDoc, docToNodes, docToEdges, type AnnotationData } from "../lib/studio/funnel-doc";
import { StudioPlanNudge } from "../components/StudioPlanNudge";
import { useRiskRegister } from "../lib/studio/hooks/use-risk-register";
import { useAiConnection } from "../lib/studio/hooks/use-ai-connection";
import { useStudioUiPrefs } from "../lib/studio/hooks/use-studio-ui-prefs";
import { useMoneyMachine } from "../lib/studio/hooks/use-money-machine";
import { usePersuasion } from "../lib/studio/hooks/use-persuasion";
import { useExperiments } from "../lib/studio/hooks/use-experiments";
import { useRetargetingLoops, useChecklist, useProgram, useBlockOps, useClientValue, DEFAULT_RAVING_FANS } from "../lib/studio/hooks/use-studio-domains";
import { computeProgramProgress } from "../lib/program-progress";
import { DEMO_DOC } from "../lib/demo-project";
import { ACCENT, barBtn, barGhost, barPrimary, setActiveCurrency, money, num, signedMoney, iconBtn } from "../lib/studio-ui";
import { AI_PROVIDERS, getAIProvider } from "../lib/ai/providers";
import { streamAIChat } from "../lib/ai/client";
import { loadGrounding, withGrounding } from "../lib/ai-grounding";
import { loadUiMode, saveUiMode, applyUiMode, type UiMode } from "../lib/ui-mode";
import { LibraryProjectCard, type LibProject } from "../components/LibraryProjectCard";
import { confirmDialog, promptDialog } from "../components/Modal";
import { SubscriptionModal } from "../components/SubscriptionModal";
import { ProgrammeCentre } from "../components/ProgrammeCentre";
import { AccountSettingsModal } from "../components/AccountSettingsModal";
import { ModelCentre } from "../components/ModelCentre";
import { FORCE_STARTER_KIT } from "../components/ProgramCentre";
import { GuidedTour } from "../components/GuidedTour";
import { useApiKeysAndWebhooks } from "../components/studio/useApiKeysAndWebhooks";
import { useWorkspaceMembers } from "../components/studio/useWorkspaceMembers";
import { useProjectComments } from "../components/studio/useProjectComments";
import { RiskPanel } from "../components/studio/RiskPanel";
import { ConstraintsPanel } from "../components/studio/ConstraintsPanel";
import { ChecklistPanel } from "../components/studio/ChecklistPanel";
import { ToolsHub } from "../components/studio/ToolsHub";
import { GlassDrawer } from "../components/studio/GlassDrawer";
import { GlossaryLayer } from "../components/studio/GlossaryLayer";
import { THEME_CSS } from "../lib/studio/theme-css";
import { friendlyFirstName } from "../lib/studio/greeting";
import { type Mode, type InspTab } from "../lib/studio/types";
import { VarianceList, CalibrateList, DecidePanel, ReportView, clientSummaryToHtml, reportToHtml } from "../components/studio/ReportPanels";
import { SimulatePanel, GoalSolver, ScenarioCompare, ScenarioBuilder } from "../components/studio/SimulatePanels";
import { renderFunnelToPng } from "../lib/studio/canvas-export";
import { InspectorTabs, ActualEditor } from "../components/studio/InspectorPanels";
import { ShortcutsOverlay } from "../components/studio/ShortcutsOverlay";
import { CommandPalette, type PaletteCommand } from "../components/studio/CommandPalette";
import { WhatsNew } from "../components/studio/WhatsNew";
import { SetupWizard, ConfigureSteps, TemplateGallery } from "../components/studio/SetupModals";
import { JourneyPanel, RecurringPanel, TimelinePanel, RetargetingPanel, type JourneySessionRow } from "../components/studio/InsightPanels";
import { CommentsPanel, NotesPanel } from "../components/studio/CollabPanels";
import { LandingAudit } from "../components/studio/LandingAudit";
import { FunnelAudit } from "../components/studio/FunnelAudit";
import { blockAuditText, funnelAuditTargets as computeAuditTargets, isAuditablePage } from "../lib/studio/audit-source";
import { benchmarkFor } from "../lib/studio/benchmarks";
import { rankFixes, type FixSignal } from "../lib/studio/fix-first";
import { buildBriefHtml } from "../lib/studio/brief";
import { FixFirst } from "../components/studio/FixFirst";
import { parseFunnelEdits } from "../lib/studio/parse-funnel-edits";
import { applyFunnelEdits } from "../lib/studio/apply-funnel-edits";
import { AiFunnelBuilder, type BuiltFunnel } from "../components/studio/AiFunnelBuilder";
import { ImpersonationBanner, TriNav, HomeCard, AttnRow, ReadinessRing, timeAgo } from "../components/studio/HomeWidgets";
import { BrandMark, BRAND_BY_KEY, LIBRARY, type LibCat, type LibItem } from "../components/studio/blocks-catalog";
import { DEFAULT_FUNNEL_NAME, freshInitial, type RecurringSummary, type Ws } from "../components/studio/studio-internal";
import { kpiCards as kpiCardsView } from "../components/studio/ResultCards";
import { StudioTopBar } from "../components/studio/StudioTopBar";

import { MIN_W, MAX_W, cardH, signedPct, inspectorBridge, STICKY_COLORS, nodeTypes, edgeTypes, initialNodes, initialEdges } from "../components/studio/FunnelCanvas";
import { EDGE_LINE_STYLE, EDGE_LINE_LABEL, BLOCK_CHECKLIST_PRESET, DATE_PERIOD_LABEL, WEBHOOK_EVENT_TYPES, ACTIVITY_LABEL, LOOP_STAGES, ADVANCED_STAGE_MODES, TOOL_MODES, NAV_SECTION_OF, NAV_SECTION_DEFAULT, type DatePeriod } from "../lib/studio/funnel-constants";

let addCounter = 1;

// Starter templates. Money is in minor units (100 = $1.00); rates are 0..1.
import { TEMPLATES, buildTemplate, PLAYBOOKS, inferPlaybook, type Template, type TemplateCategory, type Playbook } from "../lib/studio/templates";
import { isUntouchedStarter, matchUntouchedTemplate } from "../lib/studio/blank-project";

/** A button that opens a small glass dropdown below it, closing on an outside
 *  click. Used to fold sprawling one-button-per-action toolbars (File, Tools)
 *  into a single control — the header's real "dead space" fix. */
import { HeaderMenu, MenuItem, MenuDivider, MenuLabel } from "../components/studio/header-menu";
import { snippetFor } from "../lib/studio/embed-snippet";
import { parseActualsCsv } from "../lib/studio/parse-actuals-csv";
import { copyText } from "../lib/clipboard";

// Left-aligned icon + label for dropdown MenuItems (which lay their children out
// space-between), matching the StudioTopBar "More" menu.
const menuGlyph = { display: "inline-flex", alignItems: "center", gap: 8 } as const;

/** Mints an opaque id for a brand-new project — used the first time a
 *  document (new canvas, template, playbook, wizard, import, or the
 *  untouched default canvas once it's given a real name) is actually saved
 *  to the server. Independent of the display name, so a later rename never
 *  changes it — see `projectId`/`resetProjectIdentity` in StudioInner. */
function newProjectId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function StudioInner({ user, onLogout, onEmailChanged, onAvatarChanged, impersonatedBy, onStopImpersonating }: { user: { id: string; email: string; avatarUrl?: string; superAdmin?: boolean }; onLogout: () => void; onEmailChanged: (email: string) => void; onAvatarChanged: (avatarUrl: string | undefined) => void; impersonatedBy?: string; onStopImpersonating: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>("sale");
  // "home" (the Command Centre) is the post-login landing view — it answers
  // "how's the business, what needs attention, what's next, what changed" in
  // one screen instead of dropping straight into the project library.
  const [view, setView] = useState<"library" | "canvas" | "home">("home");
  const [libProjects, setLibProjects] = useState<LibProject[]>([]);
  // The bin: funnels soft-deleted within the last 30 days, restorable.
  const [bin, setBin] = useState<{ id: string; name: string; deletedAt: string }[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState("");
  const [libState, setLibState] = useState<"active" | "archived" | "all">("active");
  // Per-user, persisted shell UI prefs (onboarding strip, define-business
  // nudge, coach band) — see lib/studio/hooks/use-studio-ui-prefs.
  const { onboardingDismissed, dismissOnboarding, defNoticeDismissed, dismissDefNotice, coachCollapsed, toggleCoach } = useStudioUiPrefs(user.id);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardName, setWizardName] = useState("");
  const [wizardWho, setWizardWho] = useState("");
  const [wizardOffer, setWizardOffer] = useState("");
  const [wizardPlaybookKey, setWizardPlaybookKey] = useState<string | null>(null);
  const [configureQueue, setConfigureQueue] = useState<{ kind: "template"; item: Template } | { kind: "playbook"; item: Playbook } | null>(null);
  const [configureSteps, setConfigureSteps] = useState<{ id: string; label: string; url: string }[]>([]);
  const [templateCat, setTemplateCat] = useState<TemplateCategory>("Golden Examples");
  const [galleryTab, setGalleryTab] = useState<"funnel" | "playbook">("funnel");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [layerNumbers, setLayerNumbers] = useState(true);
  const [layerNotes, setLayerNotes] = useState(false);
  const [layerFlow, setLayerFlow] = useState(false);
  const [layerRisk, setLayerRisk] = useState(false);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>("this_month");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"profile" | "security" | "workspace" | "referrals" | "preferences">("profile");
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  // Deep-link: the persistent nav points here so surfaces that live ONLY in the
  // Studio (the account/workspace settings modal and the subscription/billing
  // modal) are reachable from anywhere in the app instead of dead-ending on the
  // Command Centre. ?panel=account opens settings; ?panel=subscription opens
  // billing.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const panel = params.get("panel");
      if (panel === "account") { setAccountOpen(true); setAccountTab("workspace"); }
      else if (panel === "subscription") { setSubscriptionOpen(true); }
      else if (panel === "programme") { setProgrammeOpen(true); }
      // ?panel=bi opens straight into Business Intelligence — now a standalone
      // Psychology page rather than an in-canvas mode; the programme's module
      // deep-links use this so "Open the tool" lands on the Define/Goals/7
      // Systems/Money Machine tabs instead of the bare canvas. Reads ?ws=
      // straight from the URL (not the component's own wsQuery, which isn't
      // resolved yet this early on mount) so a workspace-scoped deep-link
      // still carries through.
      else if (panel === "bi") {
        const ws = params.get("ws");
        window.location.href = `/psychology/business-intelligence${ws ? `?ws=${encodeURIComponent(ws)}` : ""}`;
      }
    } catch { /* SSR-safe */ }
  }, []);
  const [programmeOpen, setProgrammeOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [snapOn, setSnapOn] = useState(false);
  // Default CLOSED so the canvas loads unobstructed — the open card floats over
  // the graph and covered the first node on load. It's one click to open ("☰
  // Tools") and the choice is remembered, so anyone who opens it keeps it open.
  const [canvasToolbarOpen, setCanvasToolbarOpen] = useState(false);
  useEffect(() => { try { setCanvasToolbarOpen(localStorage.getItem("gb-canvas-toolbar-open") === "1"); } catch { /* default closed */ } }, []);
  const toggleCanvasToolbar = useCallback(() => setCanvasToolbarOpen((v) => {
    const next = !v;
    try { localStorage.setItem("gb-canvas-toolbar-open", next ? "1" : "0"); } catch { /* non-fatal */ }
    return next;
  }), []);
  // Project comments live in a hook (needs funnelName + wsQuery + commentsOpen,
  // declared below); the destructure is at the hook call further down.
  const [histOpen, setHistOpen] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; email: string; createdAt: string; note: string; revenue?: number; profit?: number }[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<{ id: string; at: string; actorEmail: string; action: string; projectName?: string; detail?: string }[]>([]);
  const [revNote, setRevNote] = useState("");
  // Optimistic-concurrency bookkeeping for cloud autosave (two-editors clobber
  // fix). baseRef holds the updatedAt token the server last handed us for the
  // CURRENT project id; every autosave/serverSave sends it so the server can
  // 409 when another editor saved in between.
  // `conflict` set = a save was refused; the banner shows Reload/Overwrite and
  // autosave pauses so we never silently overwrite the other editor.
  const baseRef = useRef<{ id: string; updatedAt: string }>({ id: "", updatedAt: "" });
  const [conflict, setConflict] = useState<{ updatedAt: string; name: string } | null>(null);
  // The stable server-row id this editor is bound to — deliberately separate
  // from funnelName (the display name) so a rename can never change it. Empty
  // means "never saved yet"; the first save mints one (see newProjectId).
  // A project's NAME used to double as its save key, so renaming to an
  // existing project's name silently overwrote it, and even a non-colliding
  // rename orphaned the old row (still saved server-side, now unreachable
  // from the library). projectId is the fix: every save / revisions /
  // tracking / share / comments call below keys off THIS, never funnelName.
  const [projectId, setProjectId] = useState("");
  // Unbinds this editor from its current row so the next save starts a fresh
  // one. Called by every "start a DIFFERENT document" path (New, template,
  // playbook, wizard, import, demo, opening another project) — never by a
  // plain rename, which is the whole point of the fix above.
  const resetProjectIdentity = useCallback(() => {
    setProjectId("");
    baseRef.current = { id: "", updatedAt: "" };
    setConflict(null);
  }, []);
  const [publicOrigin, setPublicOrigin] = useState("");
  const [originDraft, setOriginDraft] = useState("");
  const [originMsg, setOriginMsg] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [mode, setMode] = useState<Mode>("plan");
  // Review/Simulate/Decide only earn their keep once there's real ACTUAL
  // data to compare against — collapsed behind "More" for a first-time
  // user so the header reads as 2 steps, not 5, but never hidden while
  // you're actually on one of them (see the loop stepper render below).
  const [advancedLoopOpen, setAdvancedLoopOpen] = useState(false);
  const [actuals, setActuals] = useState<Record<string, NodeActuals>>({});
  const [funnelName, setFunnelName] = useState(DEFAULT_FUNNEL_NAME);
  const [scenExpAmount, setScenExpAmount] = useState(0);
  const [scenExpRate, setScenExpRate] = useState(0);
  const [funnelCurrency, setFunnelCurrency] = useState("USD");
  const [savedList, setSavedList] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [draftDoc, setDraftDoc] = useState<FunnelDoc | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [landingAuditOpen, setLandingAuditOpen] = useState(false);
  const [landingAuditNodeId, setLandingAuditNodeId] = useState<string | null>(null);
  const [funnelAuditOpen, setFunnelAuditOpen] = useState(false);
  const [fixFirstOpen, setFixFirstOpen] = useState(false);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [toolsHubOpen, setToolsHubOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{ configured: boolean; count: number; lastReceivedAt: string | null; completedCount: number; completedAmountTotal: number } | null>(null);
  const [stripeTargetId, setStripeTargetId] = useState("");
  // NOTE: the Stripe-status fetch effect lives further down, after wsQuery is
  // declared — it's scoped to the active workspace (?ws=), so it can't be
  // hoisted above that declaration.
  // API keys + outbound webhooks (+ delivery log) for the Integrations panel
  // now live in a self-contained hook (see components/studio/useApiKeysAndWebhooks).
  // It needs wsQuery + integrationsOpen, both declared further down, so the hook
  // call itself is placed after those — this destructure is filled in there.
  const { aiOpen, setAiOpen, aiProvider, aiKey, aiKeyInput, setAiKeyInput, aiModel, aiMessages, setAiMessages, aiInput, setAiInput, aiBusy, setAiBusy, aiErr, setAiErr, aiTest, aiAbortRef, saveAiKey, clearAiKey, changeAiModel, changeAiProvider, testAiConnection, callOpenRouter } = useAiConnection();
  const COPILOT_SYSTEM = "You are OneVYRT's AI Copilot: a blunt, practical business and revenue-funnel advisor embedded in a funnel-planning tool. You are given a JSON snapshot of the user's current plan — funnel blocks, simulation results, risk, goals, decisions, checklist, objections, and assumptions. Answer using only the data you were given, cite actual numbers where relevant, never invent data, and keep answers under 250 words unless the user asks for more detail.";
  const askCopilot = useCallback(async (question: string, context?: string) => {
    if (!aiKey || !question.trim()) return;
    const userMsg = { role: "user" as const, content: context ? `${question}\n\nCurrent plan snapshot:\n${context}` : question };
    const history = [...aiMessages, userMsg];
    // Show the user's turn plus an empty assistant bubble we fill as tokens
    // stream in, so the reply appears word-by-word instead of after a long pause.
    setAiMessages([...history, { role: "assistant", content: "" }]);
    setAiInput(""); setAiBusy(true); setAiErr("");
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      await streamAIChat(
        { provider: aiProvider, apiKey: aiKey, model: aiModel },
        COPILOT_SYSTEM, history,
        (delta) => setAiMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + delta };
          return copy;
        }),
        700,
        controller.signal,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error calling the AI.";
      // Drop a still-empty assistant bubble; keep a partial one the user already saw.
      setAiMessages((m) => {
        const last = m[m.length - 1];
        return last && last.role === "assistant" && !last.content ? m.slice(0, -1) : m;
      });
      // A user-initiated Stop is intentional, not an error to surface.
      if (msg !== "Generation cancelled.") setAiErr(msg);
    } finally { setAiBusy(false); aiAbortRef.current = null; }
  }, [aiKey, aiMessages, aiProvider, aiModel]);

  // Copilot "Apply edit": the AI proposes concrete funnel ops (validated by
  // parseFunnelEdits) which applyFunnelEdits applies to the canvas. The change
  // is a normal setNodes/setEdges, so the existing undo history captures it —
  // ⌘Z reverts a bad suggestion.
  const [aiEditBusy, setAiEditBusy] = useState(false);
  const applyAiEdit = useCallback(async (instruction: string) => {
    if (!aiKey || !instruction.trim() || aiEditBusy) return;
    setAiEditBusy(true); setAiErr("");
    try {
      const g = await loadGrounding();
      const snapshot = {
        nodes: nodes.filter((n) => n.type !== "annot").map((n) => ({ id: n.id, kind: (n.data as RFNodeData).kind, label: (n.data as RFNodeData).label })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
      };
      const system = 'You edit a marketing funnel. Given the current funnel JSON and an instruction, reply with ONLY a JSON object {"edits":[...]}. Each edit is exactly one of: {"op":"add_node","id":"<new-id>","kind":"traffic|step|offer|split","label":"..."}, {"op":"update_node","id":"<existing-id>","label":"..."}, {"op":"delete_node","id":"<existing-id>"}, {"op":"add_edge","source":"<id>","target":"<id>"}, {"op":"delete_edge","source":"<id>","target":"<id>"}. Use existing ids for updates/deletes/edges; invent short new ids for added nodes. No prose, no code fences.';
      const user = `Current funnel:\n${JSON.stringify(snapshot)}\n\nInstruction: ${instruction.trim()}`;
      const reply = await callOpenRouter(system, [{ role: "user", content: withGrounding(g, user) }], 700);
      const parsed = parseFunnelEdits(reply, nodes.map((n) => n.id));
      if (!parsed || parsed.ops.length === 0) { setAiErr("The AI didn't propose a usable change — try rephrasing."); return; }
      const res = applyFunnelEdits(parsed.ops, nodes, edges);
      setNodes(res.nodes); setEdges(res.edges);
      setAiInput("");
      setStatus(`Applied ${res.applied} AI change${res.applied === 1 ? "" : "s"} — ⌘Z to undo`);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Couldn't apply the edit.");
    } finally { setAiEditBusy(false); }
  }, [aiKey, aiEditBusy, nodes, edges, callOpenRouter, setNodes, setEdges]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [constraintDraft, setConstraintDraft] = useState<{ kind: ConstraintKind; nodeId: string; metric: ThresholdMetric; direction: "under" | "over"; value: string }>(
    { kind: "budget_cap", nodeId: "", metric: "cpa", direction: "under", value: "" },
  );
  const [serverList, setServerList] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [calibSnap, setCalibSnap] = useState<Node[] | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const { riskRegister, setRiskRegister, addRiskEntry, cycleRiskStatus, removeRiskEntry } = useRiskRegister();

  const [retargetingOpen, setRetargetingOpen] = useState(false);
  const { retargetingLoops, setRetargetingLoops, addRetargetingLoop, removeRetargetingLoop } = useRetargetingLoops();
  const [loopDraft, setLoopDraft] = useState<{ fromNodeId: string; fromPort: RetargetingLoop["fromPort"]; toNodeId: string; decayPct: string }>(
    { fromNodeId: "", fromPort: "no", toNodeId: "", decayPct: "30" },
  );

  const [checklistOpen, setChecklistOpen] = useState(false);
  const { checklist, setChecklist, addChecklistItem, toggleChecklistDone, removeChecklistItem } = useChecklist();
  // One click gives every block a starter readiness item instead of an
  // empty checklist per node — same "seed it, don't leave it blank" pattern
  // as the 7 Systems starter kit. Deduped by (node, text) so re-clicking is safe.
  const presetChecklistForAllBlocks = useCallback(() => {
    setChecklist((cs) => {
      const existing = new Set(cs.map((c) => `${c.linkedNodeId ?? ""}::${c.text.toLowerCase()}`));
      const added: ChecklistItem[] = [];
      for (const n of nodes) {
        if (n.type === "annot") continue;
        const kind = (n.data as RFNodeData).kind;
        const texts = BLOCK_CHECKLIST_PRESET[kind] ?? [];
        for (const text of texts) {
          const key = `${n.id}::${text.toLowerCase()}`;
          if (existing.has(key)) continue;
          existing.add(key);
          added.push({
            id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}${added.length}`,
            text, done: false, createdAt: new Date().toISOString(), linkedNodeId: n.id,
          });
        }
      }
      return [...cs, ...added];
    });
  }, [nodes]);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const { definition, setDefinition, setForceActions, setVisitedLessons, setIntroSeen, setGraduationSeen, program } = useProgram();

  const { moneyMachineCfg, setMoneyMachineCfg, moneyMachineTargets, setMoneyMachineTargets, moneyMachineLedger, setMoneyMachineLedger } = useMoneyMachine();

  const { objections, setObjections, hooks, setHooks, mindfulness, setMindfulness } = usePersuasion();

  const { assumptions, setAssumptions, addAssumption, updateAssumption, experiments, setExperiments, addExperiment, updateExperiment, goals, setGoals, addGoal, updateGoal } = useExperiments();

  const { blockOps, setBlockOps, updateBlockOps } = useBlockOps();

  const { profitDrivers, setProfitDrivers, clientPromises, setClientPromises, ravingFansInputs, setRavingFansInputs } = useClientValue();

  useEffect(() => { setSavedList(readIndex()); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const doc = deserializeDoc(raw);
      if (doc.nodes.length > 0) setDraftDoc(doc);
    } catch { /* no valid draft */ }
  }, []);

  const applyDoc = useCallback((doc: FunnelDoc) => {
    setPeriodStart(doc.period?.start ?? "");
    setPeriodEnd(doc.period?.end ?? "");
    setScenExpAmount(doc.expenses?.amount ?? 0);
    setScenExpRate(doc.expenses?.rate ?? 0);
    setNodes(docToNodes(doc));
    setEdges(docToEdges(doc));
    setActuals(doc.actuals as Record<string, NodeActuals>);
    setDecisions(doc.decisions ?? []);
    setRiskRegister(doc.riskRegister ?? []);
    setRetargetingLoops(doc.retargetingLoops ?? []);
    setChecklist(doc.checklist ?? []);
    setNotes(doc.notes ?? "");
    setDefinition(doc.program?.definition ?? {});
    setForceActions(doc.program?.forceActions ?? []);
    setVisitedLessons(doc.program?.visitedLessons ?? []);
    setIntroSeen(doc.program?.introSeen ?? false);
    setGraduationSeen(doc.program?.graduationSeen ?? false);
    setMoneyMachineCfg(doc.moneyMachine ?? DEFAULT_MONEY_MACHINE_CONFIG);
    setMoneyMachineTargets(doc.moneyMachineTargets ?? {});
    setMoneyMachineLedger(doc.moneyMachineLedger ?? []);
    setGoals(doc.goals ?? []);
    setAssumptions(doc.assumptions ?? []);
    setExperiments(doc.experiments ?? []);
    setBlockOps(doc.blockOps ?? []);
    setObjections(doc.objections ?? []);
    setHooks(doc.hooks ?? []);
    setProfitDrivers(doc.profitDrivers ?? DEFAULT_PROFIT_DRIVER_INPUTS);
    setClientPromises(doc.clientPromises ?? []);
    setRavingFansInputs(doc.ravingFans ?? DEFAULT_RAVING_FANS);
    setMindfulness(doc.mindfulness ?? []);
    setFunnelName(doc.name);
    setFunnelCurrency(doc.currency ?? "USD");
    setSelectedId(null);
  }, [setNodes, setEdges]);

  // Free plan: no real projects, just this one read-only worked example so
  // people can see every part of the product filled in before upgrading.
  // Never saved anywhere — applyDoc only touches local React state.
  const openDemoProject = useCallback(() => {
    applyDoc(DEMO_DOC);
    resetProjectIdentity();
    setMode("plan");
    setView("canvas");
    setStatus("Viewing the read-only demo — upgrade to build and save your own funnels.");
  }, [applyDoc, resetProjectIdentity]);

  const saveCurrent = useCallback(() => {
    const name = funnelName.trim() || "Untitled funnel";
    try {
      localStorage.setItem(keyOf(name), serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps)));
      const list = readIndex(); if (!list.includes(name)) { list.push(name); writeIndex(list); }
      setSavedList(readIndex()); setStatus(`Saved "${name}"`);
    } catch { setStatus("Save failed (storage unavailable)."); }
  }, [funnelName, nodes, edges, actuals, decisions, funnelCurrency, scenExpAmount, scenExpRate, periodStart, periodEnd, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps]);

  // Serialize the whole in-memory project exactly as autosave/serverSave do, in
  // one place so the conflict "overwrite with mine" path can't drift from them.
  const buildDocString = useCallback((name: string) =>
    serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps)),
    [nodes, edges, actuals, decisions, funnelCurrency, scenExpAmount, scenExpRate, periodStart, periodEnd, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps]);

  const loadNamed = useCallback((name: string) => {
    const json = localStorage.getItem(keyOf(name));
    if (!json) { setStatus(`"${name}" not found.`); return; }
    try { applyDoc(deserializeDoc(json)); setStatus(`Loaded "${name}"`); }
    catch (e) { setStatus(e instanceof PersistError ? e.message : "Load failed."); }
  }, [applyDoc]);

  const [workspaces, setWorkspaces] = useState<Ws[]>([]);
  const onWorkspaceRenamed = useCallback((wsId: string, name: string) => {
    setWorkspaces((ws) => ws.map((w) => (w.id === wsId ? { ...w, name } : w)));
  }, []);
  const [activeWsId, setActiveWsId] = useState<string>("");
  const [membersOpen, setMembersOpen] = useState(false);
  // Workspace-members invite form + handlers now live in a hook (needs
  // activeWsId + refreshWorkspaces, declared below); the destructure is there.
  const [trackingOpen, setTrackingOpen] = useState(false);
  // Onboarding checklist CTAs open/create a project, but the follow-up step
  // (jump to Business Intelligence, or open the tracking panel) needs state
  // that only exists AFTER that project has actually loaded — funnelName in
  // particular. Rather than race React's async state updates, queue the
  // follow-up and let this effect fire it once we're really on the canvas.
  const [pendingOnboardingAction, setPendingOnboardingAction] = useState<"kpi" | "tracking" | "map" | "goal" | "resume-program" | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [edgePopover, setEdgePopover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [trackKey, setTrackKey] = useState("");
  const [trackCounts, setTrackCounts] = useState<Record<string, { visits: number; conversions: number; revenue: number }>>({});
  const [trackMsg, setTrackMsg] = useState("");
  const [journeySessions, setJourneySessions] = useState<JourneySessionRow[]>([]);
  const [journeyIdx, setJourneyIdx] = useState(0);
  const wsQuery = activeWsId ? `?ws=${encodeURIComponent(activeWsId)}` : "";

  // Stripe webhook status for the Integrations panel — scoped to the active
  // workspace (the endpoint now returns only this workspace's aggregates).
  useEffect(() => {
    if (!integrationsOpen) return;
    let live = true;
    fetch(`/api/webhooks/stripe${wsQuery}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setStripeStatus(d); }).catch(() => { if (live) setStripeStatus(null); });
    return () => { live = false; };
  }, [integrationsOpen, wsQuery]);

  // Developer-settings slice (API keys + outbound webhooks + delivery log) —
  // extracted whole into a hook; see components/studio/useApiKeysAndWebhooks.
  const {
    apiKeys, apiKeyNameInput, setApiKeyNameInput, apiKeyBusy, apiKeyErr, newApiKey,
    createApiKeyClick, revokeApiKeyClick,
    webhooks, webhookUrlInput, setWebhookUrlInput, webhookEventsInput, setWebhookEventsInput,
    webhookBusy, webhookErr, newWebhookSecret, openWebhookLog, webhookLogs,
    toggleWebhookLog, createWebhookClick, deleteWebhookClick,
  } = useApiKeysAndWebhooks(wsQuery, integrationsOpen);

  const refreshServer = useCallback(async () => {
    try { const r = await fetch(`/api/projects${wsQuery}`); if (r.ok) setServerList(await r.json() as { id: string; name: string }[]); } catch { /* offline: server optional */ }
  }, [wsQuery]);
  useEffect(() => { void refreshServer(); }, [refreshServer]);

  const headlineRef = useRef<{ revenue?: number; profit?: number }>({});
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/settings");
        if (r.ok) { const d = await r.json() as { publicOrigin: string }; setPublicOrigin(d.publicOrigin); setOriginDraft(d.publicOrigin); }
      } catch { /* settings are optional */ }
    })();
  }, []);
  const saveOrigin = useCallback(async () => {
    setOriginMsg("");
    try {
      const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicOrigin: originDraft }) });
      const d = await r.json() as { publicOrigin?: string; error?: string };
      if (!r.ok) { setOriginMsg(d.error ?? "Could not save."); return; }
      setPublicOrigin(d.publicOrigin ?? "");
      setOriginDraft(d.publicOrigin ?? "");
      setOriginMsg(d.publicOrigin ? "Saved \u2014 the snippet now points here." : "Cleared \u2014 the snippet uses this page's origin.");
    } catch { setOriginMsg("Could not reach the server."); }
  }, [originDraft]);

  const revUrl = useCallback((pid: string) => `/api/projects/${encodeURIComponent(pid)}/revisions${wsQuery}`, [wsQuery]);
  const refreshRevisions = useCallback(async () => {
    const pid = projectId; if (!pid) return;
    try {
      const r = await fetch(revUrl(pid));
      if (r.ok) { const d = await r.json() as { revisions: typeof revisions }; setRevisions(d.revisions); }
    } catch { /* server optional */ }
  }, [projectId, revUrl]);
  useEffect(() => { if (histOpen) void refreshRevisions(); }, [histOpen, refreshRevisions]);

  const refreshActivity = useCallback(async () => {
    if (!activeWsId) return;
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}/activity`);
      if (r.ok) { const d = await r.json() as { activity: typeof activity }; setActivity(d.activity); }
    } catch { /* server optional */ }
  }, [activeWsId]);
  useEffect(() => { if (activityOpen) void refreshActivity(); }, [activityOpen, refreshActivity]);

  const serverSave = useCallback(async () => {
    const name = funnelName.trim() || "Untitled funnel";
    // Mint once, and commit it to state BEFORE the request goes out (not just
    // on success) \u2014 so a failed save followed by a retry reuses the SAME id
    // instead of minting a second one and risking a duplicate row.
    const pid = projectId || newProjectId();
    if (pid !== projectId) setProjectId(pid);
    try {
      const doc = serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps));
      const base = baseRef.current.id === pid ? baseRef.current.updatedAt : "";
      const r = await fetch(`/api/projects${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: pid, name, doc, baseUpdatedAt: base }) });
      if (r.status === 409) {
        const cf = await r.json().catch(() => null) as { current?: { updatedAt: string; name: string } } | null;
        setConflict(cf?.current ?? { updatedAt: "", name });
        setStatus("Changed elsewhere \u2014 reload before saving, or overwrite from the banner.");
        return;
      }
      if (!r.ok) throw new Error("save failed");
      const saved = await r.json().catch(() => null) as { updatedAt?: string } | null;
      baseRef.current = { id: pid, updatedAt: saved?.updatedAt ?? "" };
      setConflict(null);
      // Snapshot on explicit save only \u2014 autosave would flood the history.
      try {
        await fetch(`/api/projects/${encodeURIComponent(pid)}/revisions${wsQuery}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ doc, note: revNote.trim(), ...headlineRef.current }),
        });
        setRevNote("");
      } catch { /* history is best-effort; never block a save */ }
      await refreshServer(); setStatus(`Saved "${name}" to server \u2601`);
    } catch { setStatus("Server save failed (is the app reachable?)."); }
  }, [funnelName, projectId, nodes, edges, actuals, decisions, refreshServer, wsQuery, scenExpAmount, scenExpRate, revNote, funnelCurrency, periodStart, periodEnd, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps]);

  const restoreRevision = useCallback(async (revId: string) => {
    const pid = projectId; if (!pid) return;
    if (!(await confirmDialog({ title: "Restore this snapshot?", message: "Your current version is saved to history first, so nothing is lost.", confirmLabel: "Restore" }))) return;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(pid)}/revisions${wsQuery}${wsQuery ? "&" : "?"}rev=${encodeURIComponent(revId)}`);
      if (!r.ok) { setStatus("Revision not found."); return; }
      const d = await r.json() as { doc: string };
      // A snapshot of THIS SAME project \u2014 applyDoc will reset funnelName to
      // whatever it was called at snapshot time, but projectId (not touched
      // here) stays bound to this row, exactly as it should.
      applyDoc(deserializeDoc(d.doc));
      setStatus("Snapshot restored \u2014 save to keep it.");
      await refreshRevisions();
    } catch { setStatus("Restore failed."); }
  }, [projectId, wsQuery, applyDoc, refreshRevisions]);

  // Each project needs its own doc (for KPIs/definition) and its tracking
  // counts. Fetch both together, and fetch every project concurrently — a
  // library of N projects was previously 1 + 2N *serial* round-trips. A single
  // broken project must still never break the whole library, so failures fall
  // back to a bare card rather than rejecting the batch.
  const loadOneLibProject = useCallback(async (meta: { id: string; name: string }): Promise<LibProject> => {
    const base: LibProject = { id: meta.id, name: meta.name, archived: false, kpi: null, nodeCount: 0, hasDefinition: false, hasTrackingData: false, hasGoals: false };
    try {
      const [pr, tr] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(meta.id)}${wsQuery}`),
        fetch(`/api/projects/${encodeURIComponent(meta.id)}/tracking${wsQuery}`),
      ]);
      if (pr.ok) {
        const proj = await pr.json() as { name: string; doc: string };
        const doc = deserializeDoc(proj.doc);
        base.archived = doc.archived === true;
        base.nodeCount = doc.nodes.length;
        base.hasDefinition = Object.values(doc.program?.definition ?? {}).some((v) => typeof v === "string" && v.trim().length > 0);
        base.hasGoals = (doc.goals?.length ?? 0) > 0;
        const readiness = computeReadiness(doc.goals ?? [], doc.assumptions ?? [], doc.experiments ?? []);
        base.readiness = { score: readiness.score, label: readiness.label };
        const progress = computeProgramProgress({
          definition: doc.program?.definition ?? {}, forceActions: doc.program?.forceActions ?? [],
          mindfulness: doc.mindfulness ?? [], clientPromises: doc.clientPromises ?? [],
          ravingFansInputs: doc.ravingFans ?? { retentionRate: 0, referralRate: 0 },
          visitedLessons: doc.program?.visitedLessons ?? [],
        });
        base.programProgress = { doneCount: progress.doneCount, total: progress.total, allDone: progress.allDone };
        const rfNodes = docToNodes(doc).filter((n) => n.type !== "annot").map((n) => ({ id: n.id, data: n.data as RFNodeData }));
        const rfEdges = docToEdges(doc).map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle }));
        const f = toFunnel(rfNodes, rfEdges);
        if (doc.expenses) f.expenses = doc.expenses;
        // A brand-new project starts as the untouched traffic->landing->offer
        // starter (freshInitial()) so the canvas isn't blank — but its stock
        // numbers ($97 price, 1,000 visitors...) aren't the founder's real
        // business. Showing simulate()'s revenue/profit for that would present
        // an invented result as if it were a computed one, so the card stays
        // "not started" (kpi: null) until something has actually been edited.
        if (!isUntouchedStarter(rfNodes, rfEdges, !!doc.expenses)) {
          const t = simulate(f).totals;
          base.kpi = { traffic: t.visitors, orders: t.buyers, revenue: t.revenue, profit: t.grossProfit, roas: t.cost > 0 ? t.revenue / t.cost : null };
          // If the project is still an unedited built-in template, its KPIs are
          // the template author's sample numbers, not the founder's — mark them
          // as example data so the card frames them honestly (kept visible, not
          // blanked, since the founder deliberately chose the template).
          const docHasActuals = !!doc.actuals && Object.keys(doc.actuals).length > 0;
          base.exampleTemplate = matchUntouchedTemplate(rfNodes, rfEdges, docHasActuals, !!doc.expenses);
        }
      }
      if (tr.ok) {
        const { counts } = await tr.json() as { counts: Record<string, { visits: number; conversions: number; revenue: number }> };
        base.hasTrackingData = Object.values(counts).some((c) => c.visits > 0 || c.conversions > 0);
        // Real traffic has flowed through it — this is no longer just a sample.
        if (base.hasTrackingData) base.exampleTemplate = null;
      }
    } catch { /* a broken project must not break the library */ }
    return base;
  }, [wsQuery]);
  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    try {
      const r = await fetch(`/api/projects${wsQuery}`);
      if (!r.ok) { setLibProjects([]); return; }
      const list = await r.json() as { id: string; name: string }[];
      setLibProjects(await Promise.all(list.map(loadOneLibProject)));
    } catch { setLibProjects([]); }
    finally { setLibLoading(false); }
  }, [wsQuery, loadOneLibProject]);
  useEffect(() => { if (view === "library" || view === "home") void loadLibrary(); }, [view, loadLibrary]);

  const openProject = useCallback(async (id: string, target: "canvas" | "home" = "canvas") => {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(id)}${wsQuery}`);
      if (!r.ok) { setStatus("Not found on server."); return; }
      const proj = await r.json() as { name: string; doc: string; updatedAt?: string };
      const parsed = deserializeDoc(proj.doc);
      applyDoc(parsed);
      // Bind this editor to the row we just loaded: id is the REAL server id
      // (never derived from the name), and this updatedAt is the token every
      // autosave sends so a concurrent editor's later save is detected.
      setProjectId(id);
      baseRef.current = { id, updatedAt: proj.updatedAt ?? "" };
      setConflict(null);
      setView(target);
    } catch { setStatus("Open failed."); }
  }, [wsQuery, applyDoc]);

  // Any change of project identity (opening another project, starting a new one,
  // or renaming) clears a stale conflict so autosave resumes for the new/renamed
  // project. Reloading the SAME project keeps the name, so openProject clears it
  // explicitly there.
  useEffect(() => { setConflict(null); }, [funnelName]);

  // The Command Centre needs a real project's numbers to show something
  // other than zeros — auto-open the first active project the moment the
  // library list arrives, once, so a fresh login lands on real data instead
  // of an empty dashboard. Never fires again once a canvas has real content
  // (nodes.length > 0), so it can't clobber whatever the user opens next.
  const homeAutoOpened = useRef(false);
  useEffect(() => {
    if (view !== "home" || nodes.length > 0 || homeAutoOpened.current) return;
    const active = libProjects.find((p) => !p.archived);
    if (active) { homeAutoOpened.current = true; void openProject(active.id, "home"); }
  }, [view, libProjects, nodes.length, openProject]);

  // Command Centre's "what changed" and "programme" cards read workspace-wide
  // state that isn't otherwise loaded outside their own panels.
  const [homeActivity, setHomeActivity] = useState<{ id: string; at: string; actorEmail: string; action: string; detail?: string }[]>([]);
  const [homeProgramme, setHomeProgramme] = useState<{ completedLessons: number; totalLessons: number; percentComplete: number } | null>(null);
  useEffect(() => {
    if (view !== "home" || !activeWsId) return;
    let live = true;
    fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}/activity`).then((r) => (r.ok ? r.json() : null))
      .then((d: { activity?: typeof homeActivity } | null) => { if (live && d?.activity) setHomeActivity(d.activity); }).catch(() => {});
    fetch(`/api/programme/enrollment?ws=${encodeURIComponent(activeWsId)}`).then((r) => (r.ok ? r.json() : null))
      .then((d: { summary?: { completedLessons: number; totalLessons: number; percentComplete: number } } | null) => { if (live && d?.summary) setHomeProgramme(d.summary); }).catch(() => {});
    return () => { live = false; };
  }, [view, activeWsId]);

  const duplicateProject = useCallback(async (pr: LibProject) => {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(pr.id)}${wsQuery}`);
      if (!r.ok) return;
      const proj = await r.json() as { name: string; doc: string };
      const doc = deserializeDoc(proj.doc);
      let name = `${proj.name} copy`;
      const taken = new Set(libProjects.map((x) => x.name));
      let n = 2;
      while (taken.has(name)) { name = `${proj.name} copy ${n++}`; }
      doc.name = name;
      // A fresh id, never derived from the name — so renaming either the
      // original or the copy later can't collide with or orphan the other.
      await fetch(`/api/projects${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: newProjectId(), name, doc: serializeDoc(doc) }) });
      await loadLibrary();
    } catch { setStatus("Duplicate failed."); }
  }, [wsQuery, libProjects, loadLibrary]);

  const loadBin = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/deleted${wsQuery}`);
      if (!r.ok) { setBin([]); return; }
      const d = await r.json() as { id: string; name: string; deletedAt: string }[];
      setBin(Array.isArray(d) ? d : []);
    } catch { setBin([]); }
  }, [wsQuery]);
  useEffect(() => { if (view === "library" || view === "home") void loadBin(); }, [view, loadBin]);

  const deleteProject = useCallback(async (pr: LibProject) => {
    if (!(await confirmDialog({ title: `Delete "${pr.name}"?`, message: "It moves to Recently deleted — you can restore it for 30 days before it's gone for good.", danger: true, confirmLabel: "Delete" }))) return;
    try {
      await fetch(`/api/projects/${encodeURIComponent(pr.id)}${wsQuery}`, { method: "DELETE" });
      await Promise.all([loadLibrary(), loadBin()]);
    } catch { setStatus("Delete failed."); }
  }, [wsQuery, loadLibrary, loadBin]);

  // Restore a binned funnel back to the library.
  const restoreFunnel = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(id)}/restore${wsQuery}`, { method: "POST" });
      if (!r.ok) { setStatus("Restore failed."); return; }
      await Promise.all([loadLibrary(), loadBin()]);
      setStatus("Funnel restored.");
    } catch { setStatus("Restore failed."); }
  }, [wsQuery, loadLibrary, loadBin]);

  // Empty one funnel from the bin for good — the only truly irreversible delete,
  // so it uses the type-to-confirm (paste disabled) safety.
  const purgeFunnel = useCallback(async (id: string, name: string) => {
    if (!(await confirmDialog({ title: `Delete "${name}" forever?`, message: "This cannot be undone — the funnel and its history are permanently removed.", danger: true, confirmLabel: "Delete forever", requireType: "DELETE" }))) return;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(id)}${wsQuery}${wsQuery ? "&" : "?"}permanent=1`, { method: "DELETE" });
      if (!r.ok) { setStatus("Permanent delete failed."); return; }
      await loadBin();
    } catch { setStatus("Permanent delete failed."); }
  }, [wsQuery, loadBin]);

  const toggleArchive = useCallback(async (pr: LibProject) => {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(pr.id)}${wsQuery}`);
      if (!r.ok) return;
      const proj = await r.json() as { name: string; doc: string };
      const doc = deserializeDoc(proj.doc);
      doc.archived = !pr.archived;
      await fetch(`/api/projects${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: pr.id, name: proj.name, doc: serializeDoc(doc) }) });
      await loadLibrary();
    } catch { setStatus("Archive failed."); }
  }, [wsQuery, loadLibrary]);

  const newProject = useCallback((name: string) => {
    resetProjectIdentity();
    const fresh = freshInitial();
    setNodes(fresh.nodes); setEdges(fresh.edges);
    setActuals({}); setDecisions([]); setScenExpAmount(0); setScenExpRate(0);
    setFunnelName(name); setFunnelCurrency("USD"); setSelectedId(null);
    // A brand-new project has no business definition yet — Business
    // Intelligence (now a standalone Psychology page, not a canvas mode) is
    // where that gets filled in; the canvas itself always opens on PLAN.
    setDefinition({}); setForceActions([]); setObjections([]); setHooks([]); setProfitDrivers(DEFAULT_PROFIT_DRIVER_INPUTS);
    setClientPromises([]); setRavingFansInputs(DEFAULT_RAVING_FANS);
    setMode("plan");
    setView("canvas");
  }, [setNodes, setEdges, resetProjectIdentity]);

  const newFromTemplate = useCallback((tpl: Template) => {
    resetProjectIdentity();
    const built = buildTemplate(tpl);
    setNodes(built.nodes); setEdges(built.edges);
    setActuals({}); setDecisions([]); setScenExpAmount(0); setScenExpRate(0);
    setFunnelName(tpl.name); setFunnelCurrency("USD"); setMode("plan"); setSelectedId(null);
    setView("canvas"); setStatus(`Started from "${tpl.name}" template`);
  }, [setNodes, setEdges, resetProjectIdentity]);

  // AI funnel builder: a validated BuiltFunnel becomes a Template and rides the
  // exact same apply path as any other template (newFromTemplate).
  const buildFromAi = useCallback((f: BuiltFunnel) => {
    newFromTemplate({ key: "ai", name: f.name, blurb: "Generated by AI", category: "Lead Generation", nodes: f.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })), edges: f.edges });
    setAiBuilderOpen(false);
    setStatus("Built a starter funnel with AI — edit anything you like.");
  }, [newFromTemplate]);

  // A playbook is a template plus the business-definition + checklist that go
  // with it — unlike newFromTemplate, this seeds the business definition (the
  // workbook lives on the Business Intelligence Psychology page now, not an
  // in-canvas mode) so there's still real substance to finish there, not a
  // blank slate.
  // Applies the configured step labels/URLs on top of a template/playbook's
  // canvas before it's built — "which real page is this?" instead of
  // dropping in the template's generic default labels untouched.
  const finishConfigure = useCallback(() => {
    if (!configureQueue) return;
    resetProjectIdentity();
    const overrides = new Map(configureSteps.map((s) => [s.id, s]));
    const applyOverrides = (built: { nodes: Node[]; edges: Edge[] }) => ({
      ...built,
      nodes: built.nodes.map((n) => {
        const o = overrides.get(n.id);
        if (!o) return n;
        const data = { ...(n.data as RFNodeData) };
        if (o.label.trim()) data.label = o.label.trim();
        if (o.url.trim()) data.ui = { ...(data.ui ?? {}), url: o.url.trim() };
        return { ...n, data };
      }),
    });
    if (configureQueue.kind === "template") {
      const tpl = configureQueue.item;
      const built = applyOverrides(buildTemplate(tpl));
      setNodes(built.nodes); setEdges(built.edges);
      setActuals({}); setDecisions([]); setScenExpAmount(0); setScenExpRate(0);
      setFunnelName(tpl.name); setFunnelCurrency("USD"); setMode("plan"); setSelectedId(null);
      setView("canvas"); setStatus(`Started from "${tpl.name}" template — steps configured.`);
    } else {
      const pb = configureQueue.item;
      const tpl = TEMPLATES.find((t) => t.key === pb.templateKey);
      const built = applyOverrides(tpl ? buildTemplate(tpl) : freshInitial());
      setNodes(built.nodes); setEdges(built.edges);
      setActuals({}); setDecisions([]); setScenExpAmount(0); setScenExpRate(0);
      setFunnelName(pb.name); setFunnelCurrency("USD"); setSelectedId(null);
      setDefinition(pb.definition); setForceActions([]); setObjections([]); setHooks([]); setProfitDrivers(DEFAULT_PROFIT_DRIVER_INPUTS);
      setClientPromises([]); setRavingFansInputs(DEFAULT_RAVING_FANS);
      setChecklist(pb.checklist.map((text) => ({
        id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        text, done: false, createdAt: new Date().toISOString(),
      })));
      setMode("plan");
      setView("canvas"); setStatus(`Started "${pb.name}" playbook — steps configured, finish the business definition to unlock it.`);
    }
    setConfigureQueue(null); setConfigureSteps([]);
  }, [configureQueue, configureSteps, setNodes, setEdges, resetProjectIdentity]);

  // Generates the canvas FROM what the user already typed into Business
  // Definition, instead of asking them to also pick a template — the
  // definition they already wrote stays untouched, only the canvas and
  // checklist come from the inferred playbook.
  const generateStarterMap = useCallback(() => {
    const pb = inferPlaybook(definition);
    if (!pb) return;
    const tpl = TEMPLATES.find((t) => t.key === pb.templateKey);
    const built = tpl ? buildTemplate(tpl) : freshInitial();
    setNodes(built.nodes); setEdges(built.edges); setSelectedId(null);
    setChecklist((cs) => {
      const existingText = new Set(cs.map((c) => c.text));
      const added = pb.checklist.filter((t) => !existingText.has(t)).map((text) => ({
        id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        text, done: false, createdAt: new Date().toISOString(),
      }));
      return [...cs, ...added];
    });
    setMode("plan");
    setStatus(`Generated a starter map from your answers — closest fit was "${pb.name}".`);
  }, [definition, setNodes, setEdges, setChecklist]);

  // Guided Setup: for someone with no business plan at all, one flow that
  // creates the definition, the canvas (from a playbook if one was picked,
  // otherwise the golden starter), and a 7 Systems starter kit together —
  // instead of making them discover Define / Playbooks / 7 Systems as three
  // separate, unconnected buttons.
  const finishWizard = useCallback(() => {
    resetProjectIdentity();
    const name = wizardName.trim() || "New business";
    const pb = wizardPlaybookKey ? PLAYBOOKS.find((p) => p.key === wizardPlaybookKey) ?? null : null;
    if (pb) {
      const tpl = TEMPLATES.find((t) => t.key === pb.templateKey);
      const built = tpl ? buildTemplate(tpl) : freshInitial();
      setNodes(built.nodes); setEdges(built.edges);
      setChecklist(pb.checklist.map((text) => ({
        id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        text, done: false, createdAt: new Date().toISOString(),
      })));
    } else {
      const fresh = freshInitial();
      setNodes(fresh.nodes); setEdges(fresh.edges);
      setChecklist([]);
    }
    setActuals({}); setDecisions([]); setScenExpAmount(0); setScenExpRate(0); setSelectedId(null);
    setFunnelName(name); setFunnelCurrency("USD");
    setDefinition({
      businessName: name,
      whoServe: wizardWho.trim() || pb?.definition.whoServe,
      mainOffer: wizardOffer.trim() || pb?.definition.mainOffer,
      mainConstraint: pb?.definition.mainConstraint,
    });
    setForceActions(FORCE_STARTER_KIT.map((s) => ({
      id: `fa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}${s.force}`,
      force: s.force, principle: s.principle, actionItem: s.actionItem,
      status: "open", priority: "medium", createdAt: new Date().toISOString(),
    })));
    setObjections([]); setHooks([]); setProfitDrivers(DEFAULT_PROFIT_DRIVER_INPUTS);
    setClientPromises([]); setRavingFansInputs(DEFAULT_RAVING_FANS);
    setMode("plan");
    setView("canvas");
    setWizardOpen(false); setWizardStep(0); setWizardName(""); setWizardWho(""); setWizardOffer(""); setWizardPlaybookKey(null);
    setStatus("Guided setup complete — business definition, starter map and 7 Systems starter kit are all in place.");
  }, [wizardName, wizardWho, wizardOffer, wizardPlaybookKey, setNodes, setEdges, setChecklist, resetProjectIdentity]);

  const serverOpen = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(id)}${wsQuery}`);
      if (!r.ok) { setStatus("Not found on server."); return; }
      const proj = await r.json() as { name: string; doc: string; updatedAt?: string };
      applyDoc(deserializeDoc(proj.doc));
      // Same binding as openProject: id is the real server id, never derived
      // from the name.
      setProjectId(id);
      baseRef.current = { id, updatedAt: proj.updatedAt ?? "" };
      setConflict(null);
      setStatus(`Opened "${proj.name}" from server \u2601`);
    } catch (e) { setStatus(e instanceof PersistError ? e.message : "Server open failed."); }
  }, [applyDoc, wsQuery]);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const r = await fetch("/api/workspaces");
      if (r.ok) {
        const list = await r.json() as Ws[];
        setWorkspaces(list);
        // Honour a ?ws=<id> deep-link (from the /businesses portfolio) on first
        // load, so "Open" on a business/client switches straight into it — while
        // a later manual switch (cur already set + valid) is always preserved.
        const wsParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ws") : null;
        setActiveWsId((cur) => {
          if (cur && list.some((w) => w.id === cur)) return cur;
          if (wsParam && list.some((w) => w.id === wsParam)) return wsParam;
          return list[0]?.id ?? "";
        });
      }
    } catch { /* server optional */ }
  }, []);
  useEffect(() => { void refreshWorkspaces(); }, [refreshWorkspaces]);

  const createWorkspace = useCallback(async () => {
    const name = await promptDialog({ title: "New workspace", placeholder: "Workspace name", confirmLabel: "Create" });
    if (!name) return;
    try {
      const r = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      if (r.ok) { const ws = await r.json() as Ws; await refreshWorkspaces(); setActiveWsId(ws.id); setStatus(`Workspace "${ws.name}" created`); }
      else { const msg = (await r.json().catch(() => null))?.error as string | undefined; setStatus(msg || "Could not create workspace."); }
    } catch { setStatus("Could not create workspace."); }
  }, [refreshWorkspaces]);

  // Workspace-members slice extracted whole; see components/studio/useWorkspaceMembers.
  const { inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviteMsg, invite, removeWsMember } = useWorkspaceMembers(activeWsId, refreshWorkspaces);

  // Project-comments slice extracted whole; see components/studio/useProjectComments.
  const { comments, commentDraft, setCommentDraft, postComment, removeComment } = useProjectComments(projectId, wsQuery, commentsOpen);

  const trackingUrl = useCallback((pid: string) => `/api/projects/${encodeURIComponent(pid)}/tracking${wsQuery}`, [wsQuery]);
  const exportTrackingCsv = useCallback(() => {
    const rows = [["node_id", "node_label", "visits", "conversions", "revenue_minor"]];
    const labelOf = (id: string) => (nodes.find((n) => n.id === id)?.data as RFNodeData | undefined)?.label ?? id;
    for (const [nodeId, c] of Object.entries(trackCounts)) {
      const esc = (x: string) => /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
      rows.push([nodeId, esc(labelOf(nodeId)), String(c.visits ?? 0), String(c.conversions ?? 0), String(c.revenue ?? 0)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(funnelName || "funnel").replace(/[^a-z0-9]+/gi, "-")}-tracking.csv`;
    a.click(); URL.revokeObjectURL(url);
    setTrackMsg("Exported CSV \u2713");
  }, [trackCounts, nodes, funnelName]);
  const importCsvRef = useRef<HTMLInputElement>(null);
  // The inverse of Export CSV: load actuals from a file back into the counts,
  // merging per node (a column absent from the file leaves that metric as-is).
  const importTrackingCsv = useCallback(async (file: File) => {
    try {
      const { rows, skipped } = parseActualsCsv(await file.text());
      setTrackCounts((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          const cur = next[r.nodeId] ?? { visits: 0, conversions: 0, revenue: 0 };
          next[r.nodeId] = {
            visits: r.visits ?? cur.visits,
            conversions: r.conversions ?? cur.conversions,
            revenue: r.revenue ?? cur.revenue,
          };
        }
        return next;
      });
      setTrackMsg(`Imported ${rows.length} row${rows.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""} \u2713`);
    } catch (e) {
      setTrackMsg(e instanceof Error ? e.message : "Could not read that CSV.");
    }
  }, []);

  const clearTracking = useCallback(async () => {
    if (!projectId) return;
    if (!(await confirmDialog({ title: "Clear tracking data?", message: "Clear all recorded tracking data for this funnel? This cannot be undone.", danger: true, confirmLabel: "Clear" }))) return;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tracking${wsQuery}`, { method: "DELETE" });
      if (!r.ok) { setTrackMsg("Could not clear (viewers cannot reset)."); return; }
      setTrackCounts({}); setTrackMsg("Tracking data cleared \u2713");
    } catch { setTrackMsg("Could not reach the server."); }
  }, [projectId, wsQuery]);

  const refreshTracking = useCallback(async () => {
    const pid = projectId; if (!pid) return;
    try {
      const r = await fetch(trackingUrl(pid));
      if (r.ok) { const d = await r.json() as { key: string; counts: Record<string, { visits: number; conversions: number; revenue: number }>; journeys?: JourneySessionRow[] }; setTrackKey(d.key); setTrackCounts(d.counts); setJourneySessions(d.journeys ?? []); setJourneyIdx(0); }
    } catch { /* server optional */ }
  }, [projectId, trackingUrl]);
  useEffect(() => { if (journeyOpen) void refreshTracking(); }, [journeyOpen, refreshTracking]);
  const openTracking = useCallback(async () => {
    if (!funnelName.trim()) { setStatus("Name the funnel first, then open Tracking."); return; }
    setTrackMsg(""); await refreshTracking(); setTrackingOpen(true);
  }, [funnelName, refreshTracking]);

  useEffect(() => {
    if (view !== "canvas" || !pendingOnboardingAction || !funnelName.trim()) return;
    if (pendingOnboardingAction === "kpi" || pendingOnboardingAction === "goal" || pendingOnboardingAction === "resume-program") { window.location.href = `/psychology/business-intelligence${wsQuery}`; return; }
    else if (pendingOnboardingAction === "map") setTourOpen(true);
    else void openTracking();
    setPendingOnboardingAction(null);
  }, [view, pendingOnboardingAction, funnelName, openTracking, wsQuery]);
  const pullTracking = useCallback(() => {
    setActuals((a) => {
      const next = { ...a };
      for (const [nodeId, c] of Object.entries(trackCounts)) next[nodeId] = { ...next[nodeId], visitors: c.visits, buyers: c.conversions, revenue: c.revenue ?? 0 };
      return next;
    });
    setMode("actual"); setTrackingOpen(false); setStatus("Pulled live data into actuals \u2192 ACTUAL");
  }, [trackCounts]);
  const pullStripeIntoActuals = useCallback(() => {
    if (!stripeStatus || !stripeTargetId) return;
    setActuals((a) => ({ ...a, [stripeTargetId]: { ...a[stripeTargetId], buyers: stripeStatus.completedCount, revenue: stripeStatus.completedAmountTotal } }));
    setMode("actual"); setIntegrationsOpen(false); setStatus(`Pulled ${stripeStatus.completedCount} Stripe sale(s) into actuals → ACTUAL`);
  }, [stripeStatus, stripeTargetId]);
  const resetTracking = useCallback(async () => {
    const pid = projectId; if (!pid) return;
    // Confirm (analytics history is wiped) and don't claim success on a failed
    // DELETE — this previously showed "Counts reset." even when nothing was.
    if (!(await confirmDialog({ title: "Reset tracking counts?", message: "This clears this funnel's recorded views and steps. It can't be undone.", danger: true, confirmLabel: "Reset counts" }))) return;
    try {
      const r = await fetch(trackingUrl(pid), { method: "DELETE" });
      if (!r.ok) { setTrackMsg("Reset failed."); return; }
      setTrackCounts({}); setTrackMsg("Counts reset.");
    } catch { setTrackMsg("Reset failed."); }
  }, [projectId, trackingUrl]);

  const deleteNamed = useCallback(async (name: string) => {
    if (!name) return;
    if (!(await confirmDialog({ title: "Delete local copy?", message: `Delete the local (this-browser) copy of "${name}"? The server library copy is not affected.`, danger: true, confirmLabel: "Delete local" }))) return;
    localStorage.removeItem(keyOf(name));
    writeIndex(readIndex().filter((n) => n !== name));
    setSavedList(readIndex()); setStatus(`Deleted local copy of "${name}"`);
  }, []);

  const exportFile = useCallback(() => {
    const name = funnelName.trim() || "funnel";
    const blob = new Blob([serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.json`; a.click();
    URL.revokeObjectURL(url); setStatus(`Exported ${name}.json`);
  }, [funnelName, nodes, edges, actuals, decisions, funnelCurrency, scenExpAmount, scenExpRate, periodStart, periodEnd, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps]);

  const onImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    f.text().then((txt) => {
      try { applyDoc(deserializeDoc(txt)); resetProjectIdentity(); setStatus(`Imported ${f.name}`); }
      catch (err) { setStatus(err instanceof PersistError ? err.message : "Import failed."); }
    });
    e.target.value = "";
  }, [applyDoc, resetProjectIdentity]);

  const newFunnel = useCallback(() => {
    resetProjectIdentity();
    const { nodes: n, edges: ed } = freshInitial();
    setNodes(n); setEdges(ed); setActuals({}); setDecisions([]); setFunnelName(DEFAULT_FUNNEL_NAME); setFunnelCurrency("USD"); setSelectedId(null); setStatus("New funnel");
  }, [setNodes, setEdges, resetProjectIdentity]);

  const onConnect = useCallback((c: Connection) => {
    if (c.source === c.target) { setStatus("Can't connect a block to itself."); return; }
    setEdges((eds) => {
      const pinned: Connection = {
        ...c,
        // Default to the horizontal ports so lines run right -> left, never over the top.
        sourceHandle: c.sourceHandle ?? "out",
        targetHandle: c.targetHandle ?? "in",
      };
      const dup = eds.some((e) => e.source === pinned.source && e.target === pinned.target && (e.sourceHandle ?? "out") === (pinned.sourceHandle ?? "out"));
      if (dup) { setStatus("That connection already exists."); return eds; }
      return addEdge(pinned, eds);
    });
  }, [setEdges]);

  // Annotations (type "annot") live in the same `nodes` array for free
  // drag/select/duplicate, but must never reach the engine — filtered out
  // once here, then reused at every toFunnel() call site below.
  //
  // While a node is being dragged, `nodes` is rewritten every frame (position
  // only), which would give simNodes a fresh identity each frame and re-run the
  // whole simulate() ~60x/sec — even though position doesn't affect the result.
  // Hold the last value steady during a drag so the sim memo below doesn't
  // invalidate; it recomputes once the drag settles.
  const lastSimNodes = useRef<typeof nodes>([]);
  const simNodes = useMemo(() => {
    if (lastSimNodes.current.length && nodes.some((n) => n.dragging)) return lastSimNodes.current;
    const next = nodes.filter((n) => n.type !== "annot");
    lastSimNodes.current = next;
    return next;
  }, [nodes]);

  const sim = useMemo(() => {
    try {
      const funnel = toFunnel(
        simNodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
        edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      );
      return { ok: true as const, data: simulate(funnel) };
    } catch (e) {
      return { ok: false as const, error: e instanceof FunnelError ? e.message : String(e) };
    }
  }, [simNodes, edges]);

  const plan = sim.ok ? sim.data.totals : null;
  // Whether the open project is still exactly the untouched starter
  // freshInitial() seeds for every brand-new project — its stock numbers
  // ($97 price, 1,000 visitors...) simulate a real-looking revenue/profit
  // that isn't the founder's actual business. Gates the home dashboard's
  // "how the business is doing" figures and next-step guidance so a fresh
  // project never presents an invented result as a real one.
  const homeIsUntouched = useMemo(
    () => isUntouchedStarter(
      nodes.filter((n) => n.type !== "annot").map((n) => ({ id: n.id, data: n.data as RFNodeData })),
      edges.map((e) => ({ source: e.source, target: e.target })),
      false,
    ),
    [nodes, edges],
  );
  const risk = useMemo<RiskReport | null>(() => {
    if (!sim.ok) return null;
    try {
      const funnel = toFunnel(
        simNodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
        edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      );
      return assessRisk(funnel);
    } catch { return null; }
  }, [simNodes, edges, sim.ok]);
  const constraintReport = useMemo<ConstraintReport | null>(() => {
    if (!sim.ok) return null;
    try {
      const funnel = toFunnel(
        simNodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
        edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      );
      return evaluateConstraints(funnel, constraints);
    } catch { return null; }
  }, [simNodes, edges, sim.ok, constraints]);
  const recurring = useMemo<RecurringSummary | null>(() => {
    if (!sim.ok) return null;
    const totals = sim.data.totals;
    if (!totals.mrr && !totals.ltv) return null;
    let subscribers = 0;
    let trafficCost = 0;
    const byNode: RecurringSummary["byNode"] = [];
    for (const n of nodes) {
      const d = n.data as RFNodeData;
      const res = sim.data.nodes[n.id];
      if (!res) continue;
      if (d.kind === "traffic") { trafficCost += res.cost; continue; }
      if (d.kind !== "offer") continue;
      const subs = res.buyers * (d.recurringRate ?? 0);
      if (subs > 0 || (res.mrr ?? 0) > 0) {
        subscribers += subs;
        byNode.push({ nodeId: n.id, label: d.label || n.id, subscribers: subs, mrr: res.mrr ?? 0, ltv: res.ltv ?? 0 });
      }
    }
    const mrr = totals.mrr ?? 0;
    const ltv = totals.ltv ?? 0;
    const avgLtvPerSub = subscribers > 0 ? ltv / subscribers : null;
    const cac = subscribers > 0 ? Math.round(trafficCost / subscribers) : null;
    return {
      mrr, arr: mrr * 12, ltv, subscribers, avgLtvPerSub, cac,
      ltvToCac: avgLtvPerSub != null && cac != null && cac > 0 ? avgLtvPerSub / cac : null,
      byNode: byNode.sort((a, b) => b.mrr - a.mrr),
    };
  }, [nodes, sim]);
  const timeline = useMemo<TimelineReport | null>(() => {
    if (!sim.ok) return null;
    const hasAnyDelay = nodes.some((n) => ((n.data as RFNodeData).delayDays ?? 0) > 0);
    if (!hasAnyDelay) return null;
    try {
      const funnel = toFunnel(
        simNodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
        edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      );
      return computeTimeline(funnel, sim.data);
    } catch { return null; }
  }, [nodes, simNodes, edges, sim]);
  const addConstraint = useCallback(() => {
    const v = parseFloat(constraintDraft.value);
    if (!Number.isFinite(v) || v <= 0) return;
    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    let c: Constraint;
    if (constraintDraft.kind === "budget_cap") {
      c = { id, kind: "budget_cap", limitMinor: Math.round(v * 100) };
    } else if (constraintDraft.kind === "capacity_limit") {
      if (!constraintDraft.nodeId) return;
      c = { id, kind: "capacity_limit", nodeId: constraintDraft.nodeId, maxUnits: v };
    } else if (constraintDraft.kind === "rate_limit") {
      if (!constraintDraft.nodeId) return;
      c = { id, kind: "rate_limit", nodeId: constraintDraft.nodeId, maxVisitors: v };
    } else {
      c = { id, kind: "min_threshold", metric: constraintDraft.metric, direction: constraintDraft.direction, value: constraintDraft.metric === "cpa" ? Math.round(v * 100) : v };
    }
    setConstraints((prev) => [...prev, c]);
    setConstraintDraft((d) => ({ ...d, value: "" }));
  }, [constraintDraft]);
  const removeConstraint = useCallback((id: string) => {
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  }, []);
  useEffect(() => {
    headlineRef.current = plan ? { revenue: plan.revenue, profit: plan.grossProfit } : {};
  }, [plan]);
  const actualTotals = useMemo(() => aggregateActuals(actuals), [actuals]);
  const anyActuals = hasActuals(actuals);

  // The open project is still an unedited built-in template → its plan numbers
  // are the template author's sample, not the founder's own. Names the template
  // so the home "how the business is doing" card frames the figures as an
  // example. Cleared the instant any number, node, edge or actual changes.
  const homeExampleTemplate = useMemo(
    () => matchUntouchedTemplate(
      nodes.filter((n) => n.type !== "annot").map((n) => ({ id: n.id, data: n.data as RFNodeData })),
      edges.map((e) => ({ source: e.source, target: e.target })),
      anyActuals,
      scenExpAmount > 0 || scenExpRate > 0,
    ),
    [nodes, edges, anyActuals, scenExpAmount, scenExpRate],
  );

  const funnel = useMemo(() => {
    try {
      const f = toFunnel(
        simNodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
        edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      );
      if (scenExpAmount > 0 || scenExpRate > 0) f.expenses = { amount: Math.round(scenExpAmount), rate: scenExpRate };
      return f;
    } catch { return null; }
  }, [simNodes, edges, scenExpAmount, scenExpRate]);

  const calibration = useMemo(
    () => (funnel && sim.ok && anyActuals ? computeCalibration(funnel, sim.data, actuals) : null),
    [funnel, sim, anyActuals, actuals],
  );

  // Kept as its own memo rather than folded into the main `sim` used
  // everywhere else — retargeting is opt-in per project, and isolating it
  // avoids touching the (extensively tested) core simulation path.
  const retargetingResult = useMemo(
    () => (funnel && retargetingLoops.length ? simulateWithRetargeting(funnel, retargetingLoops) : null),
    [funnel, retargetingLoops],
  );
  const cloneNodes = useCallback(() => nodes.map((n) => ({ ...n, data: { ...(n.data as RFNodeData) } })), [nodes]);
  const applyProposal = useCallback((pr: CalibProposal) => {
    setCalibSnap((snap) => snap ?? cloneNodes());
    setNodes((ns) => ns.map((n) => (n.id === pr.nodeId ? { ...n, data: { ...(n.data as RFNodeData), [pr.field]: pr.proposedValue } } : n)));
  }, [cloneNodes, setNodes]);
  const applyAllCalib = useCallback(() => {
    if (!calibration) return;
    setCalibSnap((snap) => snap ?? cloneNodes());
    const byNode: Record<string, CalibProposal[]> = {};
    calibration.proposals.forEach((pr) => { (byNode[pr.nodeId] ||= []).push(pr); });
    setNodes((ns) => ns.map((n) => {
      const ps = byNode[n.id]; if (!ps) return n;
      const data = { ...(n.data as RFNodeData) } as Record<string, unknown>;
      ps.forEach((pr) => { data[pr.field] = pr.proposedValue; });
      return { ...n, data: data as unknown as RFNodeData };
    }));
  }, [calibration, cloneNodes, setNodes]);
  const revertCalib = useCallback(() => {
    if (calibSnap) { setNodes(calibSnap); setCalibSnap(null); }
  }, [calibSnap, setNodes]);

  const addDecision = useCallback((input: Omit<Decision, "id" | "createdAt" | "status" | "measurement">) => {
    const d: Decision = { ...input, id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())), createdAt: new Date().toISOString(), status: "open" };
    setDecisions((ds) => [d, ...ds]);
  }, []);
  const measureDecision = useCallback((id: string, m: { baseline: number; expected: number; observed: number; learning: string }) => {
    setDecisions((ds) => ds.map((d) => (d.id === id ? closeDecision(d, { ...m, measuredAt: new Date().toISOString() }) : d)));
  }, []);
  const deleteDecision = useCallback((id: string) => setDecisions((ds) => ds.filter((d) => d.id !== id)), []);
  const approveDecisionAction = useCallback((id: string, approvedBy: string) => {
    setDecisions((ds) => ds.map((d) => (d.id === id ? approveDecision(d, approvedBy) : d)));
  }, []);
  const revokeApprovalAction = useCallback((id: string) => {
    setDecisions((ds) => ds.map((d) => (d.id === id ? revokeApproval(d) : d)));
  }, []);

  const report = useMemo(
    () => (mode === "report" && funnel && sim.ok ? buildReport(funnelName.trim() || "Funnel", funnel, sim.data, actuals, decisions, new Date().toISOString()) : null),
    [mode, funnel, sim, funnelName, actuals, decisions],
  );
  const exportReport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([reportToHtml(report)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report.name || "funnel"}-report.html`; a.click();
    URL.revokeObjectURL(url); setStatus("Report exported");
  }, [report]);
  const exportReportCsv = useCallback(() => {
    if (!report) return;
    const rows: (string | number)[][] = [["Metric", "Value"]];
    rows.push(["Plan profit", money(report.headline.planProfit)]);
    if (report.headline.actualProfit != null) rows.push(["Actual profit", money(report.headline.actualProfit)]);
    if (report.headline.correctedProfit != null) rows.push(["Corrected profit", money(report.headline.correctedProfit)]);
    if (report.headline.profitGap != null) rows.push(["Profit gap", money(report.headline.profitGap)]);
    if (report.headline.biggestLeakLabel) rows.push(["Biggest leak", `${report.headline.biggestLeakLabel} (${money(report.headline.biggestLeakImpact ?? 0)})`]);
    if (report.variance && report.variance.ranked.length) {
      rows.push([]);
      rows.push(["Block", "Metric", "Plan", "Actual", "% off plan", "Profit impact"]);
      for (const v of report.variance.ranked) {
        rows.push([report.labels[v.nodeId] ?? v.nodeId, v.metric, money(v.plan), money(v.actual), v.pctOffPlan != null ? `${(v.pctOffPlan * 100).toFixed(1)}%` : "", money(v.profitImpact)]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report.name || "funnel"}-report.csv`; a.click();
    URL.revokeObjectURL(url); setStatus("Report exported (CSV)");
  }, [report]);
  const exportReportPdf = useCallback(async () => {
    if (!report) return;
    // Load jsPDF (a large dependency) only when the user actually exports a
    // PDF, so it stays out of the studio's initial bundle.
    const { jsPDF } = await import("jspdf");
    const h = report.headline;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 48;
    let y = 56;
    const pageH = doc.internal.pageSize.getHeight();
    const nextLine = (dy: number) => { y += dy; if (y > pageH - 48) { doc.addPage(); y = 56; } };

    doc.setFontSize(20).setFont("helvetica", "bold");
    doc.text(report.name || "Funnel report", marginX, y);
    nextLine(18);
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(107, 114, 128);
    doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, marginX, y);
    doc.setTextColor(17, 24, 39);
    nextLine(28);

    doc.setFontSize(12).setFont("helvetica", "bold");
    doc.text("Headline", marginX, y);
    nextLine(18);
    doc.setFontSize(11).setFont("helvetica", "normal");
    const headlineRows: [string, string][] = [["Plan profit", money(h.planProfit)]];
    if (h.actualProfit != null) headlineRows.push(["Actual profit", money(h.actualProfit)]);
    if (h.correctedProfit != null) headlineRows.push(["Corrected profit", money(h.correctedProfit)]);
    if (h.profitGap != null) headlineRows.push(["Profit gap", signedMoney(h.profitGap)]);
    if (h.biggestLeakLabel) headlineRows.push(["Biggest leak", `${h.biggestLeakLabel} (${signedMoney(h.biggestLeakImpact ?? 0)})`]);
    for (const [k, v] of headlineRows) { doc.text(k, marginX, y); doc.text(v, marginX + 220, y); nextLine(16); }

    if (report.variance && report.variance.ranked.length) {
      nextLine(10);
      doc.setFontSize(12).setFont("helvetica", "bold");
      doc.text("Where the funnel leaked", marginX, y);
      nextLine(18);
      doc.setFontSize(10).setFont("helvetica", "normal");
      for (const v of report.variance.ranked) {
        const label = report.labels[v.nodeId] ?? v.nodeId;
        const mid = `${v.metric}${v.pctOffPlan != null ? " " + signedPct(v.pctOffPlan) : ""}`;
        doc.text(label, marginX, y);
        doc.text(mid, marginX + 200, y);
        doc.text(signedMoney(v.profitImpact), marginX + 340, y);
        nextLine(15);
      }
    }

    if (report.calibration && report.calibration.proposals.length) {
      nextLine(10);
      doc.setFontSize(12).setFont("helvetica", "bold");
      doc.text("Corrected rates (calibration)", marginX, y);
      nextLine(18);
      doc.setFontSize(10).setFont("helvetica", "normal");
      const fmtProp = (unit: CalibProposal["unit"], v: number) => (unit === "minor" ? money(v) : unit === "rate" ? `${(v * 100).toFixed(1)}%` : num(v));
      for (const pr of report.calibration.proposals) {
        const label = report.labels[pr.nodeId] ?? pr.nodeId;
        doc.text(label, marginX, y);
        doc.text(pr.field, marginX + 200, y);
        doc.text(`${fmtProp(pr.unit, pr.planValue)} -> ${fmtProp(pr.unit, pr.proposedValue)}`, marginX + 340, y);
        nextLine(15);
      }
    }

    doc.save(`${report.name || "funnel"}-report.pdf`);
    setStatus("Report exported (PDF)");
  }, [report]);
  const printReport = useCallback(() => { window.print(); }, []);
  const exportClientSummary = useCallback(() => {
    if (!report) return;
    const blob = new Blob([clientSummaryToHtml(report)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report.name || "funnel"}-summary.html`; a.click();
    URL.revokeObjectURL(url); setStatus("Client summary exported");
  }, [report]);

  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [uiMode, setUiMode] = useState<UiMode>("guided");
  const [inspectorWidth, setInspectorWidth] = useState(340);
  // Same reasoning as libOpen above: closed by default on narrow screens so
  // the canvas actually has room, not permanently squeezed between two
  // side panels neither of which fit a phone-width screen.
  const [inspectorOpen, setInspectorOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 900);
  useEffect(() => { try { const w = parseInt(localStorage.getItem("gb-inspector-w") || "", 10); if (w >= 280 && w <= 760) setInspectorWidth(w); } catch {} }, []);
  const startResize = useCallback((e: { preventDefault: () => void }) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => { const w = Math.max(280, Math.min(760, window.innerWidth - ev.clientX)); setInspectorWidth(w); };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      setInspectorWidth((w) => { try { localStorage.setItem("gb-inspector-w", String(w)); } catch {} return w; });
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }, []);
  useEffect(() => { try { const t = localStorage.getItem("gb-theme"); if (t === "light" || t === "dark") setTheme(t); } catch {} }, []);
  const toggleTheme = useCallback(() => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("gb-theme", n); } catch {} return n; }), []);
  // Experience level (Guided/Pro) — reflected onto <html data-uimode> so the
  // guided hints and pro-only tools show/hide app-wide via CSS.
  useEffect(() => { const m = loadUiMode(); setUiMode(m); applyUiMode(m); }, []);
  const changeUiMode = useCallback((m: UiMode) => { setUiMode(m); saveUiMode(m); applyUiMode(m); }, []);
  // Guided/Pro now lives in Account settings › Preferences (audit Phase 2 — it
  // is no longer a persistent toggle in the working surface). When it is changed
  // there, <html data-uimode> flips; observe it so this component's React logic
  // (e.g. the first-run tour gate) stays in sync without a reload. Mirrors the
  // data-theme observer the global nav already uses.
  useEffect(() => {
    const read = () => { const m = document.documentElement.getAttribute("data-uimode"); if (m === "guided" || m === "pro") setUiMode(m); };
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-uimode"] });
    return () => obs.disconnect();
  }, []);
  // First-run guided tour: a brand-new Guided-mode user auto-sees the canvas
  // walkthrough the first time they reach the canvas — where the tour's
  // anchors (data-tour="blocks"/"canvas"/"inspector") actually exist. Pro
  // users and anyone who's already seen it are never interrupted; the flag is
  // set the moment it fires so it never repeats.
  useEffect(() => {
    if (uiMode !== "guided" || view !== "canvas") return;
    try {
      if (localStorage.getItem("gb-tour-seen")) return;
      localStorage.setItem("gb-tour-seen", "1");
    } catch { return; }
    setTourOpen(true);
  }, [uiMode, view]);
  const ModeSwitch = (
    <div className="gb-mode-switch" title="Guided keeps it simple for beginners; Pro reveals every tool">
      <button aria-pressed={uiMode === "guided"} onClick={() => changeUiMode("guided")}>🌱 Guided</button>
      <button aria-pressed={uiMode === "pro"} onClick={() => changeUiMode("pro")}>⚡ Pro</button>
    </div>
  );
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [candidate, setCandidate] = useState<ScenarioOverride[]>([]);
  const scenarioComparison = useMemo<ScenarioComparison | null>(
    () => (mode === "scenarios" && funnel && sim.ok ? compareScenarios(funnel, scenarios) : null),
    [mode, funnel, sim, scenarios],
  );
  const simComparison = useMemo<ScenarioComparison | null>(
    () => (mode === "simulate" && funnel && sim.ok && candidate.length ? compareScenarios(funnel, [{ id: "_cand", name: "Candidate", overrides: candidate }]) : null),
    [mode, funnel, sim, candidate],
  );
  const addScenario = useCallback((sc: Scenario) => setScenarios((xs) => [...xs, sc]), []);
  const deleteScenario = useCallback((id: string) => setScenarios((xs) => xs.filter((x) => x.id !== id)), []);

  const variance = useMemo(
    () => (sim.ok && anyActuals ? computeVariance(sim.data, actuals) : null),
    [sim, actuals, anyActuals],
  );
  const varByNode = useMemo(() => {
    const m: Record<string, NodeVariance> = {};
    variance?.nodes.forEach((v) => (m[v.nodeId] = v));
    return m;
  }, [variance]);
  const labelOf = useMemo(() => {
    const m: Record<string, string> = {};
    nodes.forEach((n) => (m[n.id] = (n.data as RFNodeData).label));
    return m;
  }, [nodes]);

  // Full context the Copilot reasons over — kept to the fields an answer
  // could actually cite, not the whole persisted doc (canvas positions,
  // annotations, etc. would just burn tokens for no benefit).
  const copilotContext = useMemo(() => JSON.stringify({
    plan, risk, variance, recurring,
    blocks: nodes.filter((n) => n.type !== "annot").map((n) => {
      const d = n.data as RFNodeData;
      return { label: d.label, kind: d.kind };
    }),
    businessDefinition: definition,
    goals: goals.map((g) => ({ level: g.level, title: g.title, status: g.status })),
    openDecisions: decisions.filter((d) => d.status === "open").map((d) => ({ move: d.move, dueDate: d.dueDate })),
    openRisks: riskRegister.filter((r) => r.status === "open").map((r) => ({ label: r.label, severity: r.severity })),
    openChecklist: checklist.filter((c) => !c.done).map((c) => c.text).slice(0, 25),
    objections: objections.map((o) => o.objection),
    assumptions: assumptions.filter((a) => a.status === "untested").map((a) => ({ text: a.text, confidence: a.confidence })),
  }), [plan, risk, variance, recurring, nodes, definition, goals, decisions, riskRegister, checklist, objections, assumptions]);

  // --- Command Centre derived state — every card reads state that already
  // drives an existing panel (readiness score, biggest leak, decision log,
  // risk assumptions, experiment register, integration status); nothing new
  // is computed here beyond picking "the one that matters most right now." ---
  const homeReadiness = useMemo(() => computeReadiness(goals, assumptions, experiments), [goals, assumptions, experiments]);
  const homeBiggestLeak = variance?.biggestLeak ?? null;
  const homeOverdueDecisions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return decisions.filter((d) => d.status === "open" && isOverdue(d.dueDate, today));
  }, [decisions]);
  const homeTopRisks = useMemo(() => (risk?.assumptions ?? []).filter((a) => a.severity === "high").slice(0, 3), [risk]);
  // Unified view over the 7 Systems, Goal Hierarchy, and Experiment
  // Register — via the canonical per-project action-item adapter
  // (packages/engine/src/action-items.ts), which resolves the roadmap
  // doc's "one action-plan system" cross-cutting question as a read-only
  // view rather than a data migration. Decisions keep their own existing
  // homeOverdueDecisions path above (a separate Fix First "kind") —
  // folding them in here too would double-count them.
  const homeActionItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return collectActionItems({ forceActions: program.forceActions, goals, experiments }, today);
  }, [program.forceActions, goals, experiments]);
  // The ranked "fix first" list: every warning signal folded into one order.
  const fixFirstItems = useMemo(() => {
    const signals: FixSignal[] = [];
    if (homeBiggestLeak && homeBiggestLeak.profitImpact < 0) {
      const label = labelOf[homeBiggestLeak.nodeId] ?? "a step";
      signals.push({ kind: "leak", nodeId: homeBiggestLeak.nodeId, title: `Fix ${label}`, detail: `Leaking ${money(Math.abs(homeBiggestLeak.profitImpact))}/mo against plan.`, impact: homeBiggestLeak.profitImpact, weight: 90 });
    }
    for (const d of homeOverdueDecisions) {
      signals.push({ kind: "decision", title: d.move || d.problem || "Overdue decision", detail: `Due ${d.dueDate} and still open in the Decision Log.`, weight: 80 });
    }
    for (const a of homeTopRisks) {
      signals.push({ kind: "risk", title: a.label, detail: a.message, weight: 75 });
    }
    for (const item of homeActionItems) {
      if (!item.needsAttention) continue;
      // Fix First wants a "why you're seeing this HERE" message, which is
      // necessarily source-specific — the adapter normalizes identity/
      // owner/due/status/priority, not this per-surface copy. Text
      // preserved exactly from before this used the shared adapter.
      const detail =
        item.source === "forceAction" ? `Due ${item.due} and still open in your 7 Systems.`
        : item.source === "goal" ? "At risk in your Goal Hierarchy."
        : "Completed and awaiting a decision in your Experiment Register.";
      // New: weight now varies with the source's own declared priority
      // (only ForceActionItem has a real one) instead of a flat 70 for
      // every item regardless of how important its own system says it is.
      const weight = item.priority === "high" ? 80 : item.priority === "low" ? 60 : 70;
      signals.push({ kind: "actionItem", title: item.title, detail, weight });
    }
    for (const n of nodes) {
      const nd = n.data as RFNodeData;
      const b = benchmarkFor(nd.kind, nd.passRate ?? nd.conversionRate ?? nd.yesRate);
      if (b && b.band === "below") signals.push({ kind: "benchmark", nodeId: n.id, title: nd.label || nd.kind, detail: b.message, weight: 50 });
      const score = (nd.ui as Record<string, unknown> | undefined)?.auditScore;
      if (typeof score === "number" && score < 60) signals.push({ kind: "audit", nodeId: n.id, title: nd.label || nd.kind, detail: `Landing-audit score ${Math.round(score)}/100 — below par. Open the audit for fixes.`, weight: 65 });
    }
    return rankFixes(signals);
  }, [homeBiggestLeak, homeOverdueDecisions, homeTopRisks, homeActionItems, nodes, labelOf, homeIsUntouched]);
  // One-page printable brief: assemble a snapshot and open it in a print window.
  const printBrief = useCallback(() => {
    const FIX_TAG: Record<string, string> = { leak: "Money leak", decision: "Overdue", risk: "Risk", audit: "Weak page", benchmark: "Below norm", actionItem: "Overdue" };
    const nodeMetric = (d: RFNodeData): string =>
      d.kind === "traffic" ? `${d.visitors ?? 0} @ ${money(d.costPerVisitor ?? 0)}`
      : d.kind === "step" ? `${Math.round((d.passRate ?? 0) * 100)}% pass`
      : d.kind === "offer" ? `${Math.round((d.conversionRate ?? 0) * 100)}% @ ${money(d.price ?? 0)}`
      : `${Math.round((d.yesRate ?? 0) * 100)}% yes`;
    const html = buildBriefHtml({
      funnelName: funnelName || "Untitled funnel",
      generatedOn: new Date().toISOString().slice(0, 10),
      revenue: money(plan?.revenue ?? 0),
      profit: money((anyActuals ? actualTotals.grossProfit : plan?.grossProfit) ?? 0),
      profitLabel: anyActuals ? "Actual profit" : "Plan profit",
      blocks: nodes.filter((n) => n.type !== "annot").map((n) => {
        const d = n.data as RFNodeData;
        const score = (d.ui as Record<string, unknown> | undefined)?.auditScore;
        return { label: d.label || d.kind, kind: d.kind, metric: nodeMetric(d), auditScore: typeof score === "number" ? score : undefined };
      }),
      fixes: fixFirstItems.slice(0, 8).map((f) => ({ rank: f.rank, tag: FIX_TAG[f.kind] ?? f.kind, title: f.title, detail: f.detail })),
    });
    const w = window.open("", "_blank");
    if (!w) { setStatus("Allow pop-ups to export the brief."); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 250);
  }, [funnelName, nodes, plan, actualTotals, anyActuals, fixFirstItems]);
  const homeCurrentExperiment = useMemo(
    () => experiments.find((e) => e.status === "running") ?? experiments.find((e) => e.status === "planned") ?? null,
    [experiments],
  );
  const homeTracking = useMemo(() => ({
    total: nodes.length,
    connected: nodes.filter((n) => (n.data as RFNodeData).integrationStatus === "connected").length,
  }), [nodes]);
  const homeNextAction = useMemo<{
    eyebrow: string; title: string; body: string; cta: string; go: () => void;
    bullets?: { icon: string; label: string }[]; reassure?: string; proof?: string;
  }>(() => {
    // The guided sequence, in the order a real user hits it: build → enter
    // real numbers → fix the biggest leak → clear decisions/risks → improve.
    // Whatever is true earliest wins, so there's always exactly one next move.
    // An untouched project (still the freshInitial() starter) counts as
    // "nothing built yet" here too — nodes.length is never 0 in practice
    // (every new project starts with the 3-node starter), so without this a
    // brand-new project skipped straight to "Step 2 — enter real numbers"
    // before the founder had customised a single thing.
    if (nodes.length === 0 || homeIsUntouched) {
      return {
        eyebrow: "Step 1 · Build it",
        title: "Know if your funnel makes money — before you spend on ads",
        body: "Most funnels fail in the math, not the design — and you find out after the ad spend. Map yours, simulate the numbers, and see the next move in minutes.",
        cta: "Model my funnel",
        go: () => setView("library"),
        bullets: [
          { icon: "🗺️", label: "Map the funnel from a proven template" },
          { icon: "🧮", label: "Simulate the numbers before you commit" },
          { icon: "🎯", label: "Know exactly what to fix next" },
        ],
        reassure: "Free to start · your AI key is saved securely to your account",
        proof: "Built on the DigitalMarketer funnel framework",
      };
    }
    if (!anyActuals) {
      return {
        eyebrow: "Step 2 · Get real numbers",
        title: "Type in what actually happened",
        body: "You've got a plan. Now run the funnel and enter your real numbers for each block — that's what turns this from a guess into a decision.",
        cta: "Enter real numbers", go: () => { setMode("actual"); setView("canvas"); },
      };
    }
    if (homeBiggestLeak && homeBiggestLeak.profitImpact < 0) {
      const label = labelOf[homeBiggestLeak.nodeId] ?? "this step";
      return {
        eyebrow: "Step 3 · Fix what's broken", title: `Fix ${label}`,
        body: `${label} is leaking ${money(Math.abs(homeBiggestLeak.profitImpact))}/mo against plan — your single biggest gap between plan and reality right now.`,
        cta: "See the leak", go: () => { setMode("variance"); setView("canvas"); },
      };
    }
    if (homeOverdueDecisions.length > 0) {
      const d = homeOverdueDecisions[0]!;
      return {
        eyebrow: "Step 5 · Decide", title: d.move || d.problem || "An overdue decision",
        body: `Due ${d.dueDate} and still waiting on your call. Make it, and it folds back into the plan.`,
        cta: "Make the call", go: () => { setMode("decide"); setView("canvas"); },
      };
    }
    if (homeTopRisks.length > 0) {
      const r = homeTopRisks[0]!;
      return { eyebrow: "Step 3 · Fix what's broken", title: r.label, body: r.message, cta: "Check the assumption", go: () => { setMode("plan"); setView("canvas"); } };
    }
    if (homeReadiness.topIssues.length > 0) {
      return {
        eyebrow: "Worth a look", title: homeReadiness.topIssues[0]!,
        body: "Flagged by your Business Readiness Score.", cta: "Open Business Intelligence", go: () => { window.location.href = `/psychology/business-intelligence${wsQuery}`; },
      };
    }
    return {
      eyebrow: "Nice — you're on track", title: "No urgent gaps right now",
      body: "Good time to test a fix: change one number and see if it makes more money, then commit it.",
      cta: "Test a fix", go: () => { setMode("simulate"); setView("canvas"); },
    };
  }, [homeBiggestLeak, homeOverdueDecisions, homeTopRisks, homeReadiness, nodes.length, anyActuals, labelOf, wsQuery]);

  // Highest-severity assumption flag per node, from the same RiskReport the
  // Risk panel already shows — the Risk Layer is just that data surfaced as
  // a badge on the canvas instead of read only inside the panel.
  const riskByNode = useMemo(() => {
    if (!layerRisk || !risk) return null;
    const order = { low: 0, medium: 1, high: 2 } as const;
    const m = new Map<string, "low" | "medium" | "high">();
    for (const a of risk.assumptions) {
      const prev = m.get(a.nodeId);
      if (!prev || order[a.severity] > order[prev]) m.set(a.nodeId, a.severity);
    }
    return m;
  }, [layerRisk, risk]);
  const displayNodes = useMemo(
    () => nodes.map((n) => {
      const a = actuals[n.id];
      const hasActual = !!a && Object.values(a).some((x) => typeof x === "number" && x > 0);
      // Accessible name so keyboard/SR users hear the block's name and type
      // when they Tab to it, instead of React Flow's generic "Node <id>" (§999).
      const KIND_ARIA: Record<string, string> = { traffic: "traffic source", step: "funnel step", offer: "offer", split: "split test", decision: "decision" };
      const nd = n.data as RFNodeData;
      const ariaLabel = n.type === "annot"
        ? (() => { const t = (n.data as { text?: string }).text?.trim(); return t ? `Note: ${t}` : "Sticky note"; })()
        : `${nd.label?.trim() || "Untitled block"}, ${KIND_ARIA[nd.kind] ?? "block"}`;
      return { ...n, ariaLabel, data: { ...nd, _mode: mode, _v: mode === "variance" ? varByNode[n.id] : undefined, _in: sim.ok ? sim.data.nodes[n.id]?.inflow : undefined, _hasActual: hasActual, _showNote: layerNotes, _riskSeverity: riskByNode?.get(n.id) } };
    }),
    [nodes, mode, varByNode, sim, actuals, layerNotes, riskByNode],
  );

  // Edges read as live data, not bare lines: each carries the simulated people
  // count (and, where a rate applies, the conversion rate) flowing through it —
  // computed straight from the same per-node emissions the engine already tracks.
  // Numbers (the text label) and Flow (thickness/color/movement) are independent
  // layers over the same underlying amt/pct, so the canvas can stay quiet by default.
  const displayEdges = useMemo(() => {
    const withAmt = edges.map((e) => {
      if (!sim.ok) return { e, amt: null as number | null, pct: null as number | null };
      const port = (e.sourceHandle ?? "out") as "out" | "yes" | "no";
      const res = sim.data.nodes[e.source];
      const amt = res?.emissions[port] ?? null;
      const pct = amt != null && res && res.kind !== "traffic" && res.inflow > 0 ? Math.round((amt / res.inflow) * 100) : null;
      return { e, amt, pct };
    });
    const maxAmt = Math.max(1, ...withAmt.map((w) => w.amt ?? 0));
    return withAmt.map(({ e, amt, pct }) => {
      const lineType = ((e.data as Record<string, unknown> | undefined)?.lineType as EdgeLineType | undefined) ?? "primary";
      const lineStyle = EDGE_LINE_STYLE[lineType];
      let styled = lineType === "primary" ? e : { ...e, style: { ...(e.style ?? {}), ...lineStyle } };
      if (layerFlow && amt != null) {
        const share = amt / maxAmt;
        const color = pct != null ? (pct >= 50 ? "#16a34a" : pct >= 20 ? "#d97706" : "#dc2626") : ACCENT;
        const strokeWidth = 1.5 + share * 4.5;
        styled = { ...styled, animated: true, style: { ...(styled.style ?? {}), stroke: color, strokeWidth } };
      }
      if (!layerNumbers || amt == null) return styled;
      const dataLabel = `${num(Math.round(amt))}${pct != null ? ` · ${pct}%` : ""}`;
      const caption = typeof e.label === "string" && e.label ? e.label : null;
      return {
        ...styled,
        label: caption ? `${caption} · ${dataLabel}` : dataLabel,
        labelStyle: { fill: "var(--dim)", fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    });
  }, [edges, sim, layerNumbers, layerFlow]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); dupRef.current(); }
      // "?" opens the keyboard cheat sheet (no modifier — Shift+/ produces "?").
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      else if (e.key === "?" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<RFNodeData>) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as RFNodeData), ...changes } } : n))),
    [setNodes],
  );
  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }, [setNodes, setEdges]);
  // Props for the single-block landing audit: seed the modal from the block's
  // own copy (its note + name + offer numbers) and write the resulting score
  // back onto the node so it shows as a badge on the canvas.
  const landingAuditProps = useMemo(() => {
    const node = landingAuditNodeId ? nodes.find((n) => n.id === landingAuditNodeId) : null;
    if (!node) return { pageLabel: null as string | null, initialText: "", onScore: undefined as ((s: number) => void) | undefined };
    const d = node.data as RFNodeData;
    const initialText = blockAuditText({
      id: node.id, kind: d.kind, label: d.label,
      note: (d.ui as Record<string, unknown> | undefined)?.note as string | undefined,
      price: d.price, passRate: d.passRate, conversionRate: d.conversionRate,
    });
    const onScore = (score: number) => {
      const ui = { ...((d.ui as Record<string, unknown>) ?? {}), auditScore: score };
      patch(node.id, { ui } as Partial<RFNodeData>);
    };
    return { pageLabel: d.label ?? null, initialText, onScore };
  }, [landingAuditNodeId, nodes, patch]);
  // Every page block with copy, for the funnel-wide audit runner.
  const auditTargets = useMemo(() => computeAuditTargets(nodes.map((n) => {
    const d = n.data as RFNodeData;
    return { id: n.id, kind: d.kind, label: d.label, note: (d.ui as Record<string, unknown> | undefined)?.note as string | undefined, price: d.price, passRate: d.passRate, conversionRate: d.conversionRate };
  })), [nodes]);
  const setAuditScore = useCallback((id: string, score: number) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const d = n.data as RFNodeData;
      const ui = { ...((d.ui as Record<string, unknown>) ?? {}), auditScore: score };
      return { ...n, data: { ...d, ui } };
    }));
  }, [setNodes]);
  const setNodeWidth = useCallback((id: string, w: number) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as RFNodeData), w: Math.max(MIN_W, Math.min(MAX_W, w)) } } : n)));
  }, [setNodes]);
  const multiSelected = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const setSelectedUi = useCallback((patch: Record<string, unknown>) => {
    const ids = multiSelected.map((n) => n.id);
    setNodes((ns) => ns.map((n) => (ids.includes(n.id)
      ? { ...n, ...(patch.locked !== undefined ? { draggable: !patch.locked } : {}), data: { ...(n.data as RFNodeData), ui: { ...(((n.data as RFNodeData).ui as Record<string, unknown>) ?? {}), ...patch } } }
      : n)));
  }, [multiSelected, setNodes]);
  const lockSelected = useCallback(() => setSelectedUi({ locked: true }), [setSelectedUi]);
  const unlockSelected = useCallback(() => setSelectedUi({ locked: false }), [setSelectedUi]);
  const groupSelected = useCallback(() => setSelectedUi({ groupId: `g${Date.now().toString(36)}` }), [setSelectedUi]);
  const ungroupSelected = useCallback(() => setSelectedUi({ groupId: undefined }), [setSelectedUi]);

  const ALIGN_NODE_H_ESTIMATE = 90; // cards now hug content and vary in real height; close enough for align, not pixel-exact
  const alignSelected = useCallback((edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (multiSelected.length < 2) return;
    const widthOf = (n: Node) => ((n.data as RFNodeData).w as number) ?? 132;
    const ids = new Set(multiSelected.map((n) => n.id));
    const xs = multiSelected.map((n) => n.position.x);
    const rights = multiSelected.map((n) => n.position.x + widthOf(n));
    const ys = multiSelected.map((n) => n.position.y);
    const bottoms = ys.map((y) => y + ALIGN_NODE_H_ESTIMATE);
    const minX = Math.min(...xs), maxRight = Math.max(...rights);
    const minY = Math.min(...ys), maxBottom = Math.max(...bottoms);
    setNodes((ns) => ns.map((n) => {
      if (!ids.has(n.id)) return n;
      const w = widthOf(n);
      if (edge === "left") return { ...n, position: { ...n.position, x: minX } };
      if (edge === "right") return { ...n, position: { ...n.position, x: maxRight - w } };
      if (edge === "center") return { ...n, position: { ...n.position, x: (minX + maxRight) / 2 - w / 2 } };
      if (edge === "top") return { ...n, position: { ...n.position, y: minY } };
      if (edge === "bottom") return { ...n, position: { ...n.position, y: maxBottom - ALIGN_NODE_H_ESTIMATE } };
      return { ...n, position: { ...n.position, y: (minY + maxBottom) / 2 - ALIGN_NODE_H_ESTIMATE / 2 } };
    }));
  }, [multiSelected, setNodes]);

  const arrangeSelected = useCallback((direction: "horizontal" | "vertical") => {
    if (multiSelected.length < 2) return;
    const ids = new Set(multiSelected.map((n) => n.id));
    if (direction === "horizontal") {
      const avgY = multiSelected.reduce((s, n) => s + n.position.y, 0) / multiSelected.length;
      setNodes((ns) => ns.map((n) => (ids.has(n.id) ? { ...n, position: { ...n.position, y: avgY } } : n)));
    } else {
      const avgX = multiSelected.reduce((s, n) => s + n.position.x, 0) / multiSelected.length;
      setNodes((ns) => ns.map((n) => (ids.has(n.id) ? { ...n, position: { ...n.position, x: avgX } } : n)));
    }
  }, [multiSelected, setNodes]);

  const distributeSelected = useCallback((axis: "horizontal" | "vertical") => {
    if (multiSelected.length < 3) return;
    const sorted = [...multiSelected].sort((a, b) => (axis === "horizontal" ? a.position.x - b.position.x : a.position.y - b.position.y));
    const first = sorted[0]!, last = sorted[sorted.length - 1]!;
    const span = axis === "horizontal" ? last.position.x - first.position.x : last.position.y - first.position.y;
    const step = span / (sorted.length - 1);
    const startVal = axis === "horizontal" ? first.position.x : first.position.y;
    const target = new Map(sorted.map((n, i) => [n.id, startVal + step * i]));
    setNodes((ns) => ns.map((n) => (target.has(n.id)
      ? { ...n, position: axis === "horizontal" ? { ...n.position, x: target.get(n.id)! } : { ...n.position, y: target.get(n.id)! } }
      : n)));
  }, [multiSelected, setNodes]);

  const bringForward = useCallback(() => {
    const ids = new Set(multiSelected.map((n) => n.id));
    setNodes((ns) => [...ns.filter((n) => !ids.has(n.id)), ...ns.filter((n) => ids.has(n.id))]);
  }, [multiSelected, setNodes]);
  const sendBackward = useCallback(() => {
    const ids = new Set(multiSelected.map((n) => n.id));
    setNodes((ns) => [...ns.filter((n) => ids.has(n.id)), ...ns.filter((n) => !ids.has(n.id))]);
  }, [multiSelected, setNodes]);
  const duplicateSelected = useCallback(() => {
    if (!multiSelected.length) return;
    const idMap = new Map<string, string>();
    const copies = multiSelected.map((n) => {
      const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      idMap.set(n.id, id);
      return { ...n, id, selected: false, position: { x: n.position.x + 28, y: n.position.y + 28 }, data: { ...(n.data as RFNodeData) } };
    });
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...copies]);
  }, [multiSelected, setNodes]);
  const deleteSelected = useCallback(() => {
    const ids = new Set(multiSelected.map((n) => n.id));
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setSelectedId(null);
  }, [multiSelected, setNodes, setEdges]);
  // Chains the selected blocks left-to-right (by x position) instead of
  // dragging each connector by hand — the auto-arrange "connect selected"
  // builder from the journey-map spec.
  const connectSelectedInSequence = useCallback(() => {
    if (multiSelected.length < 2) return;
    const sorted = [...multiSelected].sort((a, b) => a.position.x - b.position.x);
    setEdges((eds) => {
      let next = eds;
      for (let i = 0; i < sorted.length - 1; i++) {
        const source = sorted[i]!.id, target = sorted[i + 1]!.id;
        if (source === target) continue;
        const dup = next.some((e) => e.source === source && e.target === target && (e.sourceHandle ?? "out") === "out");
        if (dup) continue;
        next = addEdge({ source, target, sourceHandle: "out", targetHandle: "in" }, next);
      }
      return next;
    });
  }, [multiSelected, setEdges]);
  const patchActual = useCallback(
    (id: string, changes: Partial<NodeActuals>) => setActuals((a) => ({ ...a, [id]: { ...a[id], ...changes } })),
    [],
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [inspTab, setInspTab] = useState<InspTab>("basics");
  useEffect(() => {
    inspectorBridge.openTab = (t) => { setInspTab(t); setInspectorOpen(true); };
    inspectorBridge.openChecklist = () => setChecklistOpen(true);
    inspectorBridge.auditPage = (nodeId) => { setLandingAuditNodeId(nodeId); setLandingAuditOpen(true); };
    return () => { inspectorBridge.openTab = undefined; inspectorBridge.openChecklist = undefined; inspectorBridge.auditPage = undefined; };
  }, [setInspTab, setInspectorOpen, setChecklistOpen]);
  const [libQuery, setLibQuery] = useState("");
  const [libCat, setLibCat] = useState<"all" | LibCat>("all");
  // Defaults closed on narrow screens — on a phone, the blocks library
  // eating most of the width before you've even touched the canvas is the
  // single biggest contributor to the "everything is cut off" mobile feel.
  const [libOpen, setLibOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 900);

  const dupRef = useRef<() => void>(() => {});
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  // html-to-image's DOM-clone approach hung indefinitely in this dev
  // environment (tried viewport-only scoping, skipFonts, cacheBust — no
  // change), so the canvas is drawn directly from node/edge state onto a
  // <canvas> instead. Synchronous, no serialization of the live styled DOM,
  // so it cannot hang the way the library did.
  const exportCanvasPng = useCallback((scale: 1 | 2 | 3 = 2) => {
    if (nodes.length === 0) { setStatus("Nothing to export — the canvas is empty."); return; }
    const dataUrl = renderFunnelToPng(nodes, edges, scale);
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `${(funnelName.trim() || "funnel")}${scale > 1 ? `@${scale}x` : ""}.png`; a.click();
    setStatus(`Canvas exported (PNG ×${scale})`);
  }, [nodes, edges, funnelName]);
  // First-version "Share Tool" per the local-first plan: a single self-
  // contained HTML file — no server, no link, no auth — that anyone can
  // open to see a read-only snapshot of the canvas and its numbers. Real
  // cloud share (links, passwords, revoke) waits on approved auth/cloud
  // persistence; this needs none of that.
  const exportViewOnlyHtml = useCallback(() => {
    if (nodes.length === 0) { setStatus("Nothing to export — the canvas is empty."); return; }
    const dataUrl = renderFunnelToPng(nodes, edges, 2);
    const totals = sim.ok ? sim.data.totals : null;
    const name = funnelName.trim() || "Untitled funnel";
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const kpiRow = (label: string, val: string) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;min-width:100px"><div style="font-size:11px;color:#64748b">${esc(label)}</div><div style="font-size:16px;font-weight:500;color:#0f172a">${esc(val)}</div></div>`;
    const kpis = totals ? [
      kpiRow("Visitors", num(totals.visitors)), kpiRow("Buyers", num(totals.buyers)),
      kpiRow("Revenue", money(totals.revenue)), kpiRow("Total Cost", money(totals.cost)), kpiRow("Gross Profit", money(totals.grossProfit)),
    ].join("") : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} — view only</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px">
<div style="max-width:960px;margin:0 auto">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
<h1 style="font-size:18px;margin:0">${esc(name)}</h1>
<span style="font-size:12px;color:#64748b;background:#e2e8f0;border-radius:999px;padding:4px 10px">View only · exported ${esc(new Date().toLocaleDateString())}</span>
</div>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">${kpis}</div>
<img src="${dataUrl}" alt="Funnel map" style="max-width:100%;border:1px solid #e2e8f0;border-radius:12px;background:#fff" />
<p style="font-size:11px;color:#94a3b8;margin-top:16px">Generated by OneVYRT. This is a static snapshot — it does not update and cannot be edited.</p>
</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-view-only.html`; a.click();
    URL.revokeObjectURL(url);
    setStatus("View-only HTML exported");
  }, [nodes, edges, sim, funnelName]);
  const downloadCsv = useCallback((filename: string, rows: (string | number)[][]) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, []);
  const exportNodesCsv = useCallback(() => {
    if (nodes.length === 0) { setStatus("Nothing to export — the canvas is empty."); return; }
    const rows: (string | number)[][] = [["id", "label", "kind", "x", "y"]];
    for (const n of nodes) {
      const d = n.data as RFNodeData;
      rows.push([n.id, d.label ?? "", n.type === "annot" ? (d.kind as string) : d.kind, Math.round(n.position.x), Math.round(n.position.y)]);
    }
    downloadCsv(`${(funnelName.trim() || "funnel")}-steps.csv`, rows);
    setStatus("Canvas blocks exported (CSV)");
  }, [nodes, funnelName, downloadCsv]);
  const exportEdgesCsv = useCallback(() => {
    if (edges.length === 0) { setStatus("Nothing to export — no connecting lines yet."); return; }
    const rows: (string | number)[][] = [["source", "target", "port", "line_type", "label", "people", "rate_pct"]];
    for (const e of edges) {
      const port = e.sourceHandle ?? "out";
      const lineType = ((e.data as Record<string, unknown> | undefined)?.lineType as string | undefined) ?? "primary";
      const res = sim.ok ? sim.data.nodes[e.source] : undefined;
      const amt = res?.emissions[port as "out" | "yes" | "no"];
      const pct = amt != null && res && res.kind !== "traffic" && res.inflow > 0 ? Math.round((amt / res.inflow) * 100) : "";
      rows.push([e.source, e.target, port, lineType, typeof e.label === "string" ? e.label : "", amt != null ? Math.round(amt) : "", pct]);
    }
    downloadCsv(`${(funnelName.trim() || "funnel")}-connections.csv`, rows);
    setStatus("Canvas connections exported (CSV)");
  }, [edges, sim, funnelName, downloadCsv]);
  const rfi = useReactFlow();
  const addFromLib = useCallback((item: LibItem, pos?: { x: number; y: number }) => {
    const data = { ...defaultData(item.kind, item.label), brand: item.brand } as RFNodeData;
    if (item.dest) { data.visitors = 0; data.costPerVisitor = 0; }
    const position = pos ?? { x: 140 + Math.random() * 320, y: 300 + Math.random() * 140 };
    let newId = "";
    setNodes((ns) => {
      const used = new Set(ns.map((n) => n.id));
      do { newId = `${item.kind}-${addCounter++}`; } while (used.has(newId));
      return [...ns, { id: newId, type: "gb", position, data }];
    });
    setSelectedId(newId);
  }, [setNodes]);
  // Sticky notes and text labels are just React Flow nodes of a different
  // type ("annot"), so they get drag/select/duplicate/delete/align for free
  // from the same multi-select tooling as funnel blocks — they're filtered
  // out at every toFunnel() call site (see `simNodes`) so the engine never
  // sees them.
  const addAnnotation = useCallback((kind: "text" | "sticky") => {
    let newId = "";
    setNodes((ns) => {
      const used = new Set(ns.map((n) => n.id));
      do { newId = `annot-${addCounter++}`; } while (used.has(newId));
      const position = { x: 140 + Math.random() * 320, y: 300 + Math.random() * 140 };
      const data: AnnotationData = kind === "sticky" ? { kind, color: STICKY_COLORS[0] } : { kind };
      return [...ns, { id: newId, type: "annot", position, data }];
    });
    setSelectedId(newId);
  }, [setNodes]);
  // Builds a chained "Email 1 -> Email 2 -> ... -> Email N" run in one action
  // instead of dragging + wiring each step by hand. If exactly one node is
  // selected, the run starts connected from it (the common case: attach a
  // follow-up sequence to a landing page or opt-in step).
  const addEmailSequence = useCallback(async () => {
    const raw = await promptDialog({ title: "Email sequence", message: "How many emails in the sequence?", defaultValue: "3", inputType: "number", confirmLabel: "Add" });
    if (raw == null) return;
    const n = Math.max(1, Math.min(20, Math.round(Number(raw)) || 0));
    if (!n) return;
    const anchor = nodes.find((nd) => nd.id === selectedId);
    const baseX = anchor ? anchor.position.x + 260 : 140 + Math.random() * 200;
    const baseY = anchor ? anchor.position.y : 300 + Math.random() * 140;
    // Ids and nodes are computed up front (not inside the setNodes updater)
    // because setEdges right below needs the new ids synchronously — a
    // functional setNodes updater runs on React's schedule, not inline, so
    // mutating an outer array from inside it and reading that array
    // immediately after would see it still empty.
    const used = new Set(nodes.map((nd) => nd.id));
    const newIds: string[] = [];
    const added: Node[] = [];
    for (let i = 0; i < n; i++) {
      let id = "";
      do { id = `step-${addCounter++}`; } while (used.has(id));
      used.add(id);
      newIds.push(id);
      const data = { ...defaultData("step", `Email ${i + 1}`), brand: "email" } as RFNodeData;
      added.push({ id, type: "gb", position: { x: baseX + i * 260, y: baseY }, data });
    }
    setNodes((ns) => [...ns, ...added]);
    setEdges((eds) => {
      let next = eds;
      const chain = anchor ? [anchor.id, ...newIds] : newIds;
      for (let i = 0; i < chain.length - 1; i++) {
        next = addEdge({ source: chain[i]!, target: chain[i + 1]!, sourceHandle: "out", targetHandle: "in" }, next);
      }
      return next;
    });
    setStatus(`Added a ${n}-email sequence.`);
  }, [nodes, selectedId, setNodes, setEdges]);
  const onCanvasDrop = useCallback((e: { preventDefault: () => void; dataTransfer: DataTransfer | null; clientX: number; clientY: number }) => {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("application/gearbox-block");
    if (!raw) return;
    const item = LIBRARY.find((l) => l.id === raw);
    if (!item) return;
    const pos = rfi.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addFromLib(item, pos);
  }, [rfi, addFromLib]);
  const libItems = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    return LIBRARY.filter((l) => (libCat === "all" || l.cat === libCat) && (!q || l.label.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q)));
  }, [libQuery, libCat]);

  const addNode = useCallback((kind: RFNodeData["kind"]) => {
    setNodes((ns) => {
      const used = new Set(ns.map((n) => n.id));
      let id: string;
      do { id = `${kind}-${addCounter++}`; } while (used.has(id));
      let anchor: { x: number; y: number } | null = null;
      for (const n of ns) { if (!anchor || n.position.x > anchor.x) anchor = { x: n.position.x, y: n.position.y }; }
      const pos = anchor ? { x: anchor.x + 200, y: anchor.y } : { x: 160, y: 240 };
      queueMicrotask(() => setSelectedId(id));
      return [...ns, { id, type: "gb", position: pos, data: defaultData(kind, kind[0]!.toUpperCase() + kind.slice(1)) }];
    });
  }, [setNodes]);

  // Layered auto-layout: column = longest-path depth from a source, so flow
  // always reads left-to-right; row = position within that depth, in
  // topological order, so parallel branches don't stack on top of each other.
  const tidyLayout = useCallback(() => {
    if (!funnel) { setStatus("Fix the graph errors before tidying the layout."); return; }
    let order: string[];
    try { order = topoOrder(funnel); } catch { setStatus("Can't auto-layout a graph with a cycle."); return; }
    const depth = new Map<string, number>();
    for (const id of order) depth.set(id, 0);
    for (const id of order) {
      for (const e of edges) {
        if (e.source !== id) continue;
        const d = (depth.get(id) ?? 0) + 1;
        if (d > (depth.get(e.target) ?? 0)) depth.set(e.target, d);
      }
    }
    const byDepth = new Map<number, string[]>();
    for (const id of order) {
      const d = depth.get(id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(id);
    }
    const COL_W = 260, ROW_H = 190;
    setNodes((ns) => ns.map((n) => {
      const d = depth.get(n.id) ?? 0;
      const col = byDepth.get(d) ?? [n.id];
      const row = Math.max(0, col.indexOf(n.id));
      return { ...n, position: { x: 80 + d * COL_W, y: 80 + row * ROW_H } };
    }));
    setStatus("Layout tidied");
  }, [funnel, edges, setNodes]);

  const zoomToSelection = useCallback(() => {
    const targets = multiSelected.length ? multiSelected : nodes.filter((n) => n.id === selectedId);
    if (!targets.length) { setStatus("Select one or more blocks first."); return; }
    rfi.fitView({ nodes: targets, padding: 0.3, duration: 300, maxZoom: 1.5 });
  }, [multiSelected, selectedId, nodes, rfi]);

  // Result/metric summary cards — moved to components/studio/ResultCards
  // (split slice 2). These thin wrappers pass the live values through so every
  // call site stays unchanged and behaviour is identical.
  const kpiCards = () => kpiCardsView(plan, actualTotals, datePeriod, mode);

  setActiveCurrency(funnelCurrency);
  const activeWs = workspaces.find((w) => w.id === activeWsId) ?? null;
  const myRole = activeWs?.members.find((m) => m.userId === user.id)?.role ?? "owner";
  // Free plan gets a read-only worked example instead of real projects — see
  // openDemoProject and the library-view free-plan gate below. A super-admin
  // (see lib/admin) always has every plan capability, instance-wide, without
  // their workspace's stored plan ever being touched.
  const isFreePlan = !user.superAdmin && (activeWs?.plan ?? "free") === "free";
  // A workspace can end up over its seat quota after a downgrade (Business
  // -> Pro with existing teammates still invited) — plan changes never
  // forcibly remove anyone, so instead only the owner keeps edit access
  // until the workspace is back within its new plan's seat limit.
  const isOverSeatQuota = !user.superAdmin && (activeWs?.plan ?? "free") !== "business" && (activeWs?.plan ?? "free") !== "performance"
    && (activeWs?.members.length ?? 1) > 1 && activeWs?.ownerId !== user.id;
  const canEdit = myRole !== "viewer" && !isFreePlan && !isOverSeatQuota;
  // Owner or manager: rename the workspace and manage its members. The owner
  // additionally holds ownership transfer / deletion (admin-only surfaces).
  const isOwner = !activeWs || activeWs.ownerId === user.id;
  const canManageWs = isOwner || myRole === "manager";

  // Click a line to open its settings popover (label + line type) instead of
  // a blocking window.prompt — matches the rest of the canvas's inline-editing style.
  const onEdgeClick = useCallback((e: { clientX: number; clientY: number }, edge: Edge) => {
    if (!canEdit) return;
    setEdgePopover({ id: edge.id, x: e.clientX, y: e.clientY });
  }, [canEdit]);
  const patchEdgeLabel = useCallback((id: string, label: string) => {
    const trimmed = label.trim().slice(0, 80);
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: trimmed || undefined } : e)));
  }, [setEdges]);
  const patchEdgeLineType = useCallback((id: string, lineType: EdgeLineType) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, data: { ...(e.data ?? {}), lineType } } : e)));
  }, [setEdges]);

  // Duplicates the whole current selection (or just the active node), keeping
  // any edges that ran between two copied nodes — so duplicating a connected
  // sub-graph gives you a working copy, not disconnected orphans.
  const duplicateNode = useCallback(() => {
    if (!canEdit) return;
    setNodes((ns) => {
      const srcs = ns.filter((n) => n.selected || n.id === selectedId);
      if (srcs.length === 0) return ns;
      const idMap = new Map<string, string>();
      const copies: Node[] = srcs.map((src, i) => {
        const id = `n${Date.now().toString(36)}${i}`;
        idMap.set(src.id, id);
        return {
          ...src, id, selected: true,
          position: { x: src.position.x + 28, y: src.position.y + 28 },
          data: { ...(src.data as RFNodeData), label: srcs.length === 1 ? `${(src.data as RFNodeData).label} copy` : (src.data as RFNodeData).label },
        };
      });
      const newIds = copies.map((c) => c.id);
      queueMicrotask(() => {
        setEdges((es) => [
          ...es,
          ...es.filter((e) => idMap.has(e.source) && idMap.has(e.target))
            .map((e) => ({ ...e, id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}-${e.sourceHandle ?? "out"}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! })),
        ]);
        setSelectedId(newIds[0] ?? null);
      });
      return [...ns.map((n) => ({ ...n, selected: false })), ...copies];
    });
  }, [canEdit, selectedId, setNodes, setEdges]);
  useEffect(() => { dupRef.current = duplicateNode; }, [duplicateNode]);
  const periodInfo = useMemo(() => {
    const p = { start: periodStart, end: periodEnd };
    if (!isValidPeriod(p) || !anyActuals) return null;
    return {
      label: describePeriod(p),
      days: periodDays(p),
      revPerDay: perDay(actualTotals.revenue, p),
      profitPerDay: perDay(actualTotals.revenue - actualTotals.cost, p),
    };
  }, [periodStart, periodEnd, anyActuals, actualTotals]);
  const loopNow = LOOP_STAGES.find((x) => x.m === mode) ?? { n: 0, m: mode, label: mode.toUpperCase(), blurb: "Tooling view \u2014 the loop stays where you left it." };

  // ---- undo / redo -------------------------------------------------------
  interface Snap { n: Node[]; e: Edge[]; }
  const histRef = useRef<{ past: Snap[]; future: Snap[]; last: string }>({ past: [], future: [], last: "" });
  const applyingRef = useRef(false);
  useEffect(() => {
    // Drag jank fix: React Flow rewrites node positions every animation frame
    // while a block is being dragged, so this effect fires each frame. Skip the
    // whole-graph JSON.stringify until the drag settles (the `dragging` flag
    // clears) — otherwise a large funnel serializes 60×/second just to move one
    // block. Bonus: the whole drag becomes a single undo step, not 60.
    if (nodes.some((n) => n.dragging)) return;
    const snap = JSON.stringify({ n: nodes, e: edges });
    if (applyingRef.current) { applyingRef.current = false; histRef.current.last = snap; return; }
    if (histRef.current.last === "") { histRef.current.last = snap; return; }
    if (histRef.current.last === snap) return;
    const t = setTimeout(() => {
      const h = histRef.current;
      if (h.last === snap) return;
      h.past.push(JSON.parse(h.last) as Snap);
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      h.last = snap;
      setCanUndo(true); setCanRedo(false);
    }, 350);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (!h.past.length) return;
    const prev = h.past.pop()!;
    h.future.push(JSON.parse(h.last) as Snap);
    applyingRef.current = true;
    h.last = JSON.stringify(prev);
    setNodes(prev.n); setEdges(prev.e);
    setCanUndo(h.past.length > 0); setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (!h.future.length) return;
    const next = h.future.pop()!;
    h.past.push(JSON.parse(h.last) as Snap);
    applyingRef.current = true;
    h.last = JSON.stringify(next);
    setNodes(next.n); setEdges(next.e);
    setCanUndo(true); setCanRedo(h.future.length > 0);
  }, [setNodes, setEdges]);

  const paletteCommands = useMemo<PaletteCommand[]>(() => [
    { id: "mode-plan", title: "Go to Plan", section: "Navigate", keywords: ["mode"], run: () => setMode("plan") },
    { id: "mode-model", title: "Go to Model", section: "Navigate", run: () => setMode("model") },
    { id: "mode-actual", title: "Go to Actual", section: "Navigate", keywords: ["results"], run: () => setMode("actual") },
    { id: "mode-report", title: "Go to Report", section: "Navigate", run: () => setMode("report") },
    { id: "mode-simulate", title: "Go to Simulate", section: "Navigate", keywords: ["forecast"], run: () => setMode("simulate") },
    { id: "undo", title: "Undo", section: "Edit", shortcut: "⌘Z", run: () => undo() },
    { id: "redo", title: "Redo", section: "Edit", shortcut: "⌘⇧Z", run: () => redo() },
    { id: "ai", title: "Open AI Copilot", section: "Tools", keywords: ["assistant", "chat"], run: () => setAiOpen(true) },
    { id: "tracking", title: "Open Live Tracking", section: "Tools", keywords: ["analytics", "visits"], run: () => setTrackingOpen(true) },
    { id: "shortcuts", title: "Keyboard shortcuts", section: "Help", shortcut: "?", run: () => setShortcutsOpen(true) },
    { id: "whats-new", title: "What's new", section: "Help", keywords: ["changelog", "updates"], run: () => setWhatsNewOpen(true) },
    { id: "landing-audit", title: "Audit my landing page (AI)", section: "AI", keywords: ["copy", "deiss", "conversion", "review"], run: () => { setLandingAuditNodeId(null); setLandingAuditOpen(true); } },
    { id: "funnel-audit", title: "Audit the whole funnel (AI)", section: "AI", keywords: ["copy", "deiss", "conversion", "pages", "every"], run: () => setFunnelAuditOpen(true) },
    { id: "fix-first", title: "What to fix first", section: "Review", keywords: ["priority", "gaps", "leak", "next", "urgent"], run: () => setFixFirstOpen(true) },
    { id: "print-brief", title: "Export one-page brief (print / PDF)", section: "Review", keywords: ["pdf", "print", "export", "report", "brief"], run: printBrief },
  ], [undo, redo]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = ev.key.toLowerCase();
      if (k === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
      else if ((k === "z" && ev.shiftKey) || k === "y") { ev.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const [autoMsg, setAutoMsg] = useState("");
  // Persistence state machine — kept DELIBERATELY separate from `sim.ok` (the
  // model/validation result). The visible save badge must reflect whether the
  // document actually persisted, never whether the simulation happened to
  // succeed; conflating the two showed "Saved" after a failed autosave and
  // "Error" when persistence was fine but the model had a validation issue.
  type SaveState = "idle" | "unnamed" | "saving" | "saved" | "failed" | "conflict";
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string>("");
  const [retryNonce, setRetryNonce] = useState(0);
  const autoReady = useRef(false);
  useEffect(() => {
    if (!autoReady.current) { autoReady.current = true; return; }
    if (!canEdit) return;
    const name = funnelName.trim();
    if (!name) return;
    // Same drag-jank guard as the undo history above: while a block is being
    // dragged, positions change every frame. Don't serialize the whole doc to
    // the local draft (or reschedule the server autosave) on each frame — wait
    // for the drag to settle. The final position still saves on drag-end, and
    // any non-drag edit runs this normally (no node is dragging then).
    if (nodes.some((n) => n.dragging)) return;
    // Local crash-recovery draft: always written, even offline or as a viewer.
    try {
      localStorage.setItem(DRAFT_KEY, serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps)));
      // Sidecar so a restored draft rebinds to the SAME row instead of
      // minting a new one; "" (never saved yet) is a valid value too.
      localStorage.setItem(DRAFT_ID_KEY, projectId);
    } catch { /* storage full or blocked: non-fatal */ }
    // Don't let autosave create a phantom project for an unnamed canvas. A funnel
    // still on the default "Untitled funnel" name is a scratch draft (protected by
    // the local draft written just above). Persisting it server-side would make it
    // reappear in the library the instant it's deleted, because the next edit
    // re-POSTs it under the same id. Give it a real name — or use Save — and normal
    // server autosave resumes.
    if (name === DEFAULT_FUNNEL_NAME) { setAutoMsg("Name this funnel to save it"); setSaveState("unnamed"); return; }
    // Mint the project's id once, and commit it to state right away (not
    // just on success) — a name typed straight into the untouched default
    // canvas is this project's first real save, and a failed attempt
    // followed by a retry must reuse the SAME id, never mint a second one.
    const pid = projectId || newProjectId();
    if (pid !== projectId) setProjectId(pid);
    // A save was already refused over another editor's version (finding B):
    // pause autosave so we never clobber theirs. The local draft above still
    // captures edits; the banner's Reload/Overwrite clears this and resumes.
    if (conflict) { setSaveState("conflict"); return; }
    setSaveState("saving"); // edits pending / in-flight — not yet persisted
    const t = setTimeout(() => {
      void (async () => {
        try {
          const doc = serializeDoc(toDoc(name, nodes, edges, actuals, decisions, funnelCurrency, { amount: scenExpAmount, rate: scenExpRate }, { start: periodStart, end: periodEnd }, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps));
          // Send the last-seen version token (only when it belongs to THIS
          // name) so the server 409s instead of overwriting a copy someone else
          // saved meanwhile. A new/renamed project has no matching token →
          // unchecked first save, then we adopt whatever the server returns.
          const base = baseRef.current.id === pid ? baseRef.current.updatedAt : "";
          const r = await fetch(`/api/projects${wsQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: pid, name, doc, baseUpdatedAt: base }) });
          if (r.status === 409) {
            const cf = await r.json().catch(() => null) as { current?: { updatedAt: string; name: string } } | null;
            setConflict(cf?.current ?? { updatedAt: "", name });
            setAutoMsg("Changed elsewhere — reload"); setSaveState("conflict");
            return;
          }
          // The local draft (line ~3223) exists purely for crash recovery
          // between writing it and this autosave landing \u2014 once the
          // autosave itself succeeds, the content is safely persisted
          // server-side and the draft is no longer "unsaved" by any
          // definition. Previously this was only ever cleared by an
          // explicit Dismiss/Restore click, so the "unsaved draft found"
          // banner resurfaced after essentially every normal editing
          // session, whether or not anything was ever actually at risk.
          if (r.ok) {
            try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_ID_KEY); } catch { /* non-fatal */ }
            // Adopt the server's new version token so our next save is checked
            // against it (and never false-conflicts with our own write).
            const saved = await r.json().catch(() => null) as { updatedAt?: string } | null;
            baseRef.current = { id: pid, updatedAt: saved?.updatedAt ?? "" };
          }
          const at = new Date().toLocaleTimeString();
          setAutoMsg(r.ok ? `Autosaved \u00b7 ${at}` : "Autosave failed");
          setSaveState(r.ok ? "saved" : "failed");
          if (r.ok) setSavedAt(at);
        } catch { setAutoMsg("Autosave failed"); setSaveState("failed"); }
      })();
    }, 1500);
    return () => clearTimeout(t);
  }, [nodes, edges, actuals, decisions, funnelCurrency, funnelName, projectId, canEdit, wsQuery, scenExpAmount, scenExpRate, periodStart, periodEnd, riskRegister, checklist, notes, program, moneyMachineCfg, objections, hooks, profitDrivers, clientPromises, ravingFansInputs, retargetingLoops, mindfulness, goals, assumptions, experiments, moneyMachineTargets, moneyMachineLedger, blockOps, retryNonce, conflict]);

  // Conflict banner actions (finding B). Reload pulls the version saved
  // elsewhere (openProject rebinds the version token and clears the conflict);
  // Overwrite force-saves the local edits over it (the deliberate escape hatch).
  const reloadLatest = useCallback(() => {
    if (projectId) void openProject(projectId);
  }, [projectId, openProject]);
  const overwriteWithMine = useCallback(async () => {
    const name = funnelName.trim(); if (!name) return;
    const pid = projectId || newProjectId();
    if (pid !== projectId) setProjectId(pid);
    setSaveState("saving");
    try {
      const r = await fetch(`/api/projects${wsQuery}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: pid, name, doc: buildDocString(name), force: true }),
      });
      if (!r.ok) { setSaveState("failed"); setAutoMsg("Save failed"); return; }
      const saved = await r.json().catch(() => null) as { updatedAt?: string } | null;
      baseRef.current = { id: pid, updatedAt: saved?.updatedAt ?? "" };
      setConflict(null);
      try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_ID_KEY); } catch { /* non-fatal */ }
      const at = new Date().toLocaleTimeString();
      setSavedAt(at); setSaveState("saved"); setAutoMsg(`Saved (replaced the other copy) · ${at}`);
    } catch { setSaveState("failed"); setAutoMsg("Save failed"); }
  }, [funnelName, projectId, wsQuery, buildDocString]);

  // The Studio's top bar for the home and library screens. Rendered from ONE
  // place so the two can never drift apart — previously each view kept its own
  // copy of this header, and the library copy silently lost the Campaign Studio
  // / Business OS / Guided-Pro controls. `onStart` is the only per-view
  // difference: home is already on Start (no-op), library returns to home.
  const renderTopBar = (onStart: () => void) => (
    <StudioTopBar
      onStart={onStart}
      user={user}
      workspaces={workspaces}
      activeWsId={activeWsId}
      setActiveWsId={setActiveWsId}
      modeSwitch={ModeSwitch}
      theme={theme}
      toggleTheme={toggleTheme}
      setMode={setMode}
      setView={setView}
      onProgramme={() => setProgrammeOpen(true)}
      onAccount={() => { setAccountOpen(true); setAccountTab("profile"); }}
      onSubscription={() => setSubscriptionOpen(true)}
      onLogout={onLogout}
    />
  );

  // The always-available Studio overlays (⌘K palette, shortcuts, what's new,
  // landing/funnel audits, fix-first). Defined once and rendered in each view
  // instead of the previous three byte-identical copies (split slice 4).
  const overlays = (
    <>
    {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    {paletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}
    {whatsNewOpen && <WhatsNew onClose={() => setWhatsNewOpen(false)} />}
    {landingAuditOpen && <LandingAudit pageLabel={landingAuditProps.pageLabel} initialText={landingAuditProps.initialText} onScore={landingAuditProps.onScore} onClose={() => { setLandingAuditOpen(false); setLandingAuditNodeId(null); }} />}
    {funnelAuditOpen && <FunnelAudit targets={auditTargets} onScore={setAuditScore} onClose={() => setFunnelAuditOpen(false)} />}
    {fixFirstOpen && <FixFirst items={fixFirstItems} onOpenBlock={(id) => setSelectedId(id)} onClose={() => setFixFirstOpen(false)} />}
    </>
  );
  if (view === "home") {
    const wsName = activeWs?.name ?? "your business";
    const revenue = plan?.revenue ?? 0;
    const planProfit = plan?.grossProfit ?? 0;
    const actualProfit = anyActuals ? actualTotals.grossProfit : null;
    const profitDeltaPct = actualProfit != null && planProfit !== 0 ? Math.round(((actualProfit - planProfit) / Math.abs(planProfit)) * 100) : null;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = friendlyFirstName(user.email);
    const trackedPct = homeTracking.total > 0 ? Math.round((homeTracking.connected / homeTracking.total) * 100) : null;
    const attnCount = homeOverdueDecisions.length + homeTopRisks.length;
    const readinessLabelText = homeReadiness.label === "strong" ? "Strong" : homeReadiness.label === "developing" ? "Developing" : homeReadiness.label === "fragile" ? "Fragile" : "Not started";

    return (
      <div data-theme={theme} className="gb-fill-min" style={{ background: "var(--canvas)", color: "var(--text)", fontFamily: "var(--font-roboto), Roboto, Arial, \"Helvetica Neue\", Helvetica, sans-serif" }}>
        <style>{THEME_CSS}</style>
        {impersonatedBy && <ImpersonationBanner email={user.email} onStop={onStopImpersonating} />}
        {overlays}
        {renderTopBar(() => { /* already on Start */ })}
        {/* ?panel=account/subscription/programme deep-links (see the
            one-time effect above) only ever rendered these three modals in
            the "library" view's own return block — meaning a user whose
            Studio session starts on "home" (the default for any account with
            no projects yet, e.g. a coach opening /studio?panel=programme who
            has never built a funnel of their own) got a totally silent
            no-op: the effect set programmeOpen/accountOpen/subscriptionOpen,
            but nothing anywhere in the "home" branch ever read that state to
            render them. Mirrored here rather than hoisted out of the
            per-view branches, matching how this file already repeats
            overlays/renderTopBar/ImpersonationBanner per view above. */}
        {accountOpen && <AccountSettingsModal user={user} tab={accountTab} setTab={setAccountTab} activeWs={activeWs} onClose={() => setAccountOpen(false)} onRenamed={onWorkspaceRenamed} onEmailChanged={onEmailChanged} onAvatarChanged={onAvatarChanged} onDeleted={onLogout} />}
        {subscriptionOpen && <SubscriptionModal onClose={() => setSubscriptionOpen(false)} activeWsId={activeWsId} />}
        {programmeOpen && <ProgrammeCentre onClose={() => setProgrammeOpen(false)} activeWsId={activeWsId} onSwitchWorkspace={setActiveWsId}
          onManageMembers={() => { setProgrammeOpen(false); setView("canvas"); setMembersOpen(true); }} />}

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(34px, 5vw, 60px) 20px 72px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              {/* Hero band: one dominant, tightly-tracked line — Apple register,
                  dialled down to dashboard scale (this is a working screen, not
                  a marketing page). */}
              <div style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.04 }}>{greeting}{firstName ? `, ${firstName}` : ""}</div>
              <div style={{ fontSize: 15, color: "var(--dim)", marginTop: 8, maxWidth: "52ch", lineHeight: 1.45 }}>Here's where {wsName} stands and what to do next.</div>
            </div>
            {homeReadiness.score != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ReadinessRing score={homeReadiness.score} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--dim)", textTransform: "uppercase" }}>Business readiness</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{readinessLabelText}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: "linear-gradient(120deg, var(--accent-soft), var(--surface) 65%)", border: "1px solid var(--border2)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 14, flex: 1, minWidth: 260 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{"→"}</div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: ACCENT, textTransform: "uppercase", marginBottom: 4 }}>{homeNextAction.eyebrow}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{homeNextAction.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--dim)", maxWidth: 520 }}>{homeNextAction.body}</div>
                {homeNextAction.bullets && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    {homeNextAction.bullets.map((b) => (
                      <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)" }}>
                        <span aria-hidden style={{ fontSize: 14 }}>{b.icon}</span>{b.label}
                      </div>
                    ))}
                  </div>
                )}
                {(homeNextAction.reassure || homeNextAction.proof) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 12 }}>
                    {homeNextAction.reassure && <span style={{ fontSize: 11.5, color: "var(--good-border)", fontWeight: 500 }}>✓ {homeNextAction.reassure}</span>}
                    {homeNextAction.proof && <span style={{ fontSize: 11.5, color: "var(--dim)" }}>{homeNextAction.proof}</span>}
                  </div>
                )}
              </div>
            </div>
            <button onClick={homeNextAction.go} style={{ ...barPrimary, padding: "10px 18px", fontSize: 13.5 }}>{homeNextAction.cta} {"→"}</button>
          </div>

          <div className="gb-home-grid">

            <HomeCard span={2} eyebrow="📊 How the business is doing"
              pill={!homeIsUntouched && profitDeltaPct != null ? { text: `${profitDeltaPct >= 0 ? "+" : ""}${profitDeltaPct}% vs plan`, tone: profitDeltaPct >= 0 ? "good" : "warn" } : undefined}>
              {homeIsUntouched ? (
                <div style={{ fontSize: 12.5, color: "var(--dim)" }}>Not started — build your funnel to see plan numbers here.</div>
              ) : (
                <>
                  {homeExampleTemplate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11.5, color: "var(--dim)" }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#1d4ed8", background: "rgba(29,78,216,0.10)", borderRadius: 5, padding: "2px 6px" }}>Example</span>
                      <span>Sample numbers from the &ldquo;{homeExampleTemplate}&rdquo; template — edit the funnel to make them yours.</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                    <div><div style={{ fontSize: 11, color: "var(--dim)" }}>{anyActuals ? "Actual profit" : "Plan profit"}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{money(actualProfit ?? planProfit)}</div></div>
                    <div><div style={{ fontSize: 11, color: "var(--dim)" }}>Revenue</div><div style={{ fontSize: 20, fontWeight: 700 }}>{money(revenue)}</div></div>
                  </div>
                </>
              )}
              <button onClick={() => { setMode(anyActuals ? "variance" : "plan"); setView("canvas"); }} style={{ ...barGhost, marginTop: 12, fontSize: 11.5 }}>Open full report {"→"}</button>
            </HomeCard>

            <HomeCard span={2} eyebrow="⚠ What needs attention"
              pill={attnCount > 0 ? { text: `${attnCount} flagged`, tone: "crit" } : { text: "All clear", tone: "good" }}>
              {attnCount === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--dim)" }}>Nothing overdue and no high-risk assumptions right now.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {homeOverdueDecisions.slice(0, 2).map((d) => (
                    <AttnRow key={d.id} crit title={d.move || d.problem || "Overdue decision"} sub={`Due ${d.dueDate}`} onClick={() => { setMode("decide"); setView("canvas"); }} />
                  ))}
                  {homeTopRisks.map((r, i) => (
                    <AttnRow key={`${r.nodeId}-${i}`} title={r.label} sub={r.message} onClick={() => { setMode("plan"); setView("canvas"); }} />
                  ))}
                </div>
              )}
            </HomeCard>

            <HomeCard eyebrow="📡 Tracking health"
              pill={trackedPct != null ? { text: `${trackedPct}%`, tone: trackedPct >= 80 ? "good" : trackedPct >= 40 ? "warn" : "crit" } : undefined}>
              {homeTracking.total === 0 ? <div style={{ fontSize: 12.5, color: "var(--dim)" }}>No nodes on the canvas yet.</div> : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{homeTracking.connected} / {homeTracking.total}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)" }}>blocks connected to real tracking</div>
                </>
              )}
            </HomeCard>

            <HomeCard eyebrow="🧪 Current experiment">
              {homeCurrentExperiment ? (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{homeCurrentExperiment.hypothesis}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3, textTransform: "capitalize" }}>{homeCurrentExperiment.status}</div>
                </>
              ) : <div style={{ fontSize: 12.5, color: "var(--dim)" }}>No experiment running. Log one from the Experiment Register.</div>}
            </HomeCard>

            <HomeCard eyebrow="🎓 Programme"
              pill={homeProgramme ? { text: `${homeProgramme.percentComplete}%`, tone: homeProgramme.percentComplete >= 100 ? "good" : "neutral" } : undefined}>
              {homeProgramme ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{homeProgramme.completedLessons} / {homeProgramme.totalLessons}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)" }}>lessons done</div>
                </>
              ) : (
                <div role="status" aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div className="gb-skel" style={{ width: 70, height: 20 }} />
                  <div className="gb-skel" style={{ width: 90, height: 11 }} />
                </div>
              )}
            </HomeCard>

            <HomeCard span={2} eyebrow="🕒 What changed">
              {homeActivity.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--dim)" }}>No activity logged yet.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {homeActivity.slice(0, 4).map((a) => (
                    <div key={a.id} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "baseline" }}>
                      <span style={{ color: "var(--dim)", fontSize: 10.5, width: 30, flexShrink: 0 }}>{timeAgo(a.at)}</span>
                      <span><b>{a.actorEmail.split("@")[0]}</b> {a.action}{a.detail ? ` — ${a.detail}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </HomeCard>

            <div className="gb-home-full" style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--dim)", textTransform: "uppercase" }}>{"📁 Projects"}</div>
                <button onClick={() => setView("library")} style={{ ...barGhost, fontSize: 11.5 }}>View library {"→"}</button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
                {libProjects.filter((p) => !p.archived).slice(0, 6).map((p) => (
                  <button key={p.id} onClick={() => void openProject(p.id, "canvas")}
                    style={{ flex: "0 0 170px", textAlign: "left", background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>{p.nodeCount} block{p.nodeCount === 1 ? "" : "s"}</div>
                  </button>
                ))}
                <button onClick={() => setView("library")}
                  style={{ flex: "0 0 170px", border: "1.5px dashed var(--border3)", borderRadius: 10, color: "var(--dim)", fontSize: 12, fontWeight: 700, background: "transparent", cursor: "pointer" }}>+ New project</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "library") {
    const q = libSearch.trim().toLowerCase();
    const shown = libProjects.filter((pr) =>
      (libState === "all" || (libState === "archived" ? pr.archived : !pr.archived)) &&
      (!q || pr.name.toLowerCase().includes(q)));
    const showOnboarding = !onboardingDismissed;
    return (
      <div data-theme={theme} className="gb-fill-min" style={{ background: "var(--canvas)", color: "var(--text)", fontFamily: "var(--font-roboto), Roboto, Arial, \"Helvetica Neue\", Helvetica, sans-serif" }}>
        <style>{THEME_CSS}</style>
        {impersonatedBy && <ImpersonationBanner email={user.email} onStop={onStopImpersonating} />}
        {overlays}
        {renderTopBar(() => setView("home"))}
        {accountOpen && <AccountSettingsModal user={user} tab={accountTab} setTab={setAccountTab} activeWs={activeWs} onClose={() => setAccountOpen(false)} onRenamed={onWorkspaceRenamed} onEmailChanged={onEmailChanged} onAvatarChanged={onAvatarChanged} onDeleted={onLogout} />}
        {subscriptionOpen && <SubscriptionModal onClose={() => setSubscriptionOpen(false)} activeWsId={activeWsId} />}
        {programmeOpen && <ProgrammeCentre onClose={() => setProgrammeOpen(false)} activeWsId={activeWsId} onSwitchWorkspace={setActiveWsId}
          onManageMembers={() => { setProgrammeOpen(false); setView("canvas"); setMembersOpen(true); }} />}

        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 18px 60px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ marginRight: "auto" }}>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>PROJECT LIBRARY</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>Your funnel projects</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Every project carries its own graph, assumptions, live simulation and financial results.</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", background: "var(--surface)" }}>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>PROJECTS</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{shown.length}</div>
            </div>
          </div>

          {isFreePlan && (
            <div style={{ border: "1px solid var(--border2)", borderRadius: 14, padding: "32px 24px", background: "var(--surface)", textAlign: "center" }}>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700, marginBottom: 8 }}>FREE PLAN</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>See everything, build nothing - yet</div>
              <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.6 }}>
                The free plan doesn't include your own projects. Open the read-only demo below to see a fully worked funnel with the canvas, program and reports all filled in, then upgrade to build and save your own.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={openDemoProject} style={barPrimary}>Open the read-only demo</button>
                <button onClick={() => setSubscriptionOpen(true)} style={barGhost}>Upgrade to build your own</button>
              </div>
            </div>
          )}
          {!isFreePlan && showOnboarding && <StudioPlanNudge onDismiss={dismissOnboarding} />}

          {!isFreePlan && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search projects"
              style={{ flex: "1 1 260px", background: "var(--surface)", border: "1px solid var(--border3)", borderRadius: 9, color: "var(--text)", padding: "8px 11px", fontSize: 13 }} />
            {(["active", "archived", "all"] as const).map((st) => (
              <button key={st} onClick={() => setLibState(st)}
                style={{ ...barGhost, textTransform: "capitalize", background: libState === st ? "var(--accent-soft)" : "var(--surface)", color: libState === st ? ACCENT : "var(--muted)", borderColor: libState === st ? ACCENT : "var(--border3)" }}>{st === "all" ? "All states" : st}</button>
            ))}
            <label style={{ ...barGhost, background: "var(--surface)", cursor: canEdit ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center" }}>
              {"\u2191 Import JSON"}
              <input type="file" accept="application/json" disabled={!canEdit} style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; void f.text().then((t) => { try { applyDoc(deserializeDoc(t)); setView("canvas"); } catch (err) { setStatus(err instanceof PersistError ? err.message : "Invalid file."); } }); }} />
            </label>
            <button disabled={!canEdit} onClick={() => { setWizardOpen(true); setWizardStep(0); }}
              title="No business plan yet? Answer a few questions and get a definition, a starter map, and a 7 Systems starter kit together."
              style={{ ...barPrimary, opacity: canEdit ? 1 : 0.5 }}>{"\ud83e\udded Build my plan"}</button>
            <button disabled={!canEdit} title="20 proven value-ladders \u2014 McDonald's, ClickFunnels, Costco\u2026 pick one and watch it pay off"
              onClick={() => { setGalleryTab("funnel"); setTemplateCat("Golden Examples"); setTemplateGalleryOpen(true); }}
              style={{ ...barGhost, background: "var(--surface)", opacity: canEdit ? 1 : 0.5 }}>{"\u2726 Golden examples"}</button>
            <button disabled={!canEdit} onClick={() => setTemplateGalleryOpen(true)}
              title="Start from a proven funnel template"
              style={{ ...barGhost, background: "var(--surface)", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }}>◈ Templates…</button>
            <button disabled={!canEdit} onClick={async () => { const n = await promptDialog({ title: "New project", placeholder: "Project name", defaultValue: "New funnel", confirmLabel: "Create" }); if (n) newProject(n); }}
              style={{ ...barPrimary, opacity: canEdit ? 1 : 0.5 }}>+ New project</button>
          </div>}

          {!isFreePlan && libLoading && (
            <div role="status" aria-label="Loading projects" style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 260, border: "1px solid var(--border2)", borderRadius: 13, padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="gb-skel" style={{ width: "70%", height: 15 }} />
                  <div className="gb-skel" style={{ width: "45%", height: 11 }} />
                  <div className="gb-skel" style={{ width: "100%", height: 44, borderRadius: 10 }} />
                </div>
              ))}
            </div>
          )}
          {!isFreePlan && !libLoading && shown.length === 0 && (
            <div style={{ border: "1px dashed var(--border3)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--dim)", background: "var(--surface)" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{libProjects.length === 0 ? "No projects yet" : "Nothing matches those filters"}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{libProjects.length === 0 ? "Start from the golden template or create a new project." : "Try a different search or state filter."}</div>
            </div>
          )}
          {!isFreePlan && <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {shown.map((pr) => (
              <LibraryProjectCard key={pr.id} pr={pr} canEdit={canEdit}
                onOpen={openProject} onDuplicate={duplicateProject}
                onDelete={deleteProject} onToggleArchive={toggleArchive}
                onResumeProgram={(id) => { setPendingOnboardingAction("resume-program"); void openProject(id); }} />
            ))}
          </div>}
          {!isFreePlan && bin.length > 0 && (
            <div style={{ marginTop: 26, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", overflow: "hidden", maxWidth: 620 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <MarketingIcon name="trash" size={15} /> Recently deleted <span style={{ fontWeight: 500, color: "var(--dim)", fontSize: 12 }}>· restorable for 30 days, then removed automatically</span>
              </div>
              {bin.map((b, i) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i === bin.length - 1 ? "none" : "1px solid var(--border)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>deleted {new Date(b.deletedAt).toLocaleDateString()}</div>
                  </div>
                  {canEdit && <button style={barPrimary} onClick={() => void restoreFunnel(b.id)}>Restore</button>}
                  {canEdit && <button style={barGhost} onClick={() => void purgeFunnel(b.id, b.name)}>Delete forever</button>}
                </div>
              ))}
            </div>
          )}
          {status && <div style={{ marginTop: 16, fontSize: 13, color: "var(--dim)" }}>{status}</div>}
        </div>
        {wizardOpen && (
          <SetupWizard step={wizardStep} name={wizardName} who={wizardWho} offer={wizardOffer} playbookKey={wizardPlaybookKey}
            setStep={setWizardStep} setName={setWizardName} setWho={setWizardWho} setOffer={setWizardOffer} setPlaybookKey={setWizardPlaybookKey}
            onClose={() => setWizardOpen(false)} onFinish={finishWizard} />
        )}
        {configureQueue && (
          <ConfigureSteps queue={configureQueue} steps={configureSteps} setSteps={setConfigureSteps}
            onClose={() => { setConfigureQueue(null); setConfigureSteps([]); }} onFinish={finishConfigure} />
        )}
        {templateGalleryOpen && (
          <TemplateGallery tab={galleryTab} setTab={setGalleryTab} cat={templateCat} setCat={setTemplateCat}
            onClose={() => setTemplateGalleryOpen(false)}
            onStart={(queue, steps) => { setConfigureQueue(queue); setConfigureSteps(steps); setTemplateGalleryOpen(false); }} />
        )}
      </div>
    );
  }

  return (
    <div data-theme={theme} className="gb-fill-fixed" style={{ display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-roboto), Roboto, Arial, \"Helvetica Neue\", Helvetica, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      <GlossaryLayer onAskCopilot={(termLabel) => { setAiOpen(true); void askCopilot(`What does "${termLabel}" mean in the context of my plan?`, copilotContext); }} />
      {impersonatedBy && <ImpersonationBanner email={user.email} onStop={onStopImpersonating} />}
        {overlays}
      {tourOpen && <GuidedTour onClose={() => setTourOpen(false)} />}
      {/* Skip link: the first focusable element on the canvas, so a keyboard
          user can jump past the toolbar straight to the workspace (#gb-main). */}
      <a href="#gb-main" className="gb-skip">Skip to content</a>
      {aiBuilderOpen && <AiFunnelBuilder onBuild={buildFromAi} onClose={() => setAiBuilderOpen(false)} />}
      <div style={{ padding: "7px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
        <button onClick={() => setView("library")} style={{ ...barGhost, marginRight: 4 }} title="Back to project library">{"←"}</button>
        <button onClick={undo} disabled={!canUndo} style={{ ...barGhost, opacity: canUndo ? 1 : 0.4 }} title="Undo (Ctrl+Z)" aria-label="Undo">{"↶"}</button>
        <button onClick={redo} disabled={!canRedo} style={{ ...barGhost, opacity: canRedo ? 1 : 0.4, marginRight: 4 }} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">{"↷"}</button>
        <button onClick={() => setShortcutsOpen(true)} style={{ ...barGhost, marginRight: 4 }} title="Keyboard shortcuts">?</button>
        <a href="/command-center" title="Dashboard" aria-label="Dashboard" style={{ marginRight: 6, display: "flex", alignItems: "center", gap: 6, flexShrink: 0, textDecoration: "none", color: "inherit" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <AppLogoMark size={20} interactive />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap" }}>ONEVYRT</span>
        </a>

        <TriNav active={NAV_SECTION_OF[mode]} onPick={(s) => { if (s === NAV_SECTION_OF[mode]) return; setMode(NAV_SECTION_DEFAULT[s]); }} />
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 2px" }} />

        {/* The Reality Loop stepper lives here now — one fixed, stable place at
            the top, never reflowing the header when you switch stages.
            Plan/Actual stay visible always. Review/Simulate/Decide only
            compare real results against plan, so they're not just collapsed
            behind "More" — the "More" affordance itself stays hidden until
            you've logged at least one real ACTUAL number, so a first-time
            user sees exactly Plan -> Actual and nothing promising more than
            that yet. Once you're already on one of the three (or you've
            opened "More" once this session), it stays reachable regardless
            — logging actuals is what unlocks it, not what re-locks it. */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {(() => {
            const loopExpanded = advancedLoopOpen || ADVANCED_STAGE_MODES.has(mode);
            const moreAvailable = anyActuals || loopExpanded;
            const visibleStages = loopExpanded ? LOOP_STAGES : LOOP_STAGES.filter((st) => !ADVANCED_STAGE_MODES.has(st.m));
            return (
              <>
                {visibleStages.map((st, idx) => (
                  <div key={st.m} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button onClick={() => setMode(st.m)} title={st.blurb} style={{
                      display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                      background: mode === st.m ? `${st.hue}18` : "transparent",
                      border: `1px solid ${mode === st.m ? st.hue : "transparent"}`,
                      borderRadius: 999, padding: "8px 13px", minHeight: 36, transition: "background .12s, border-color .12s",
                    }}>
                      <span style={{
                        width: 19, height: 19, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11.5, fontWeight: 700, background: st.hue, color: "#fff",
                        boxShadow: mode === st.m ? `0 0 0 2px ${st.hue}44` : "none",
                      }}>{st.n}</span>
                      <span data-term={st.term} style={{ fontSize: 11, letterSpacing: 0.6, fontWeight: 700, color: mode === st.m ? st.hue : "var(--muted)" }}>{st.label}</span>
                    </button>
                    {idx < visibleStages.length - 1 && <span style={{ fontSize: 11, color: "var(--dim)" }}>{"→"}</span>}
                  </div>
                ))}
                {!loopExpanded && moreAvailable && (
                  <>
                    <span style={{ fontSize: 11, color: "var(--dim)" }}>{"→"}</span>
                    <button onClick={() => setAdvancedLoopOpen(true)} title="Review, Simulate and Decide — compare real results against plan"
                      style={{ ...barGhost, display: "flex", alignItems: "center", gap: 4, padding: "8px 13px", minHeight: 36, borderRadius: 999 }}>
                      <span style={{ fontSize: 11, letterSpacing: 0.6, fontWeight: 700 }}>More</span>
                      <span style={{ fontSize: 10 }}>▾</span>
                    </button>
                  </>
                )}
                {loopExpanded && (
                  <button onClick={() => setAdvancedLoopOpen(false)} title="Collapse Review/Simulate/Decide"
                    style={{ ...barGhost, padding: "8px 11px", minHeight: 36, borderRadius: 999, marginLeft: 2 }}>
                    <span style={{ fontSize: 10 }}>▴</span>
                  </button>
                )}
              </>
            );
          })()}
          <button onClick={() => setMode("plan")} title="Back to PLAN — restart the loop" style={{ ...barGhost, marginLeft: 4, color: "#e11d48", padding: "7px 11px", minHeight: 36 }}>{"↺"}</button>
        </div>
        {loopNow.n > 0 && (
          <div style={{ padding: "1px 4px 0", fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 }}>
            <b style={{ color: "var(--muted)" }}>Step {loopNow.n} of 5 · {loopNow.label}:</b> {loopNow.blurb}
          </div>
        )}
      </div>

      {/* Persistent "Next move" coach — always visible in every stage, so the
          user never has to work out which mode does what: it names the one
          thing to do right now and jumps them straight there. The brain is
          homeNextAction (build → real numbers → fix → decide). */}
      <div data-tour="nextmove" style={{ padding: coachCollapsed ? "4px 18px" : "8px 18px", borderBottom: "1px solid var(--border)", background: "var(--accent-soft)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span aria-hidden style={{ fontSize: coachCollapsed ? 12 : 15, flexShrink: 0 }}>👉</span>
        {coachCollapsed ? (
          <button onClick={homeNextAction.go} title={`${homeNextAction.cta} — ${homeNextAction.title}`}
            style={{ flex: 1, minWidth: 160, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "var(--text)" }}>
            <b style={{ color: ACCENT, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 10 }}>Next move</b> · {homeNextAction.title}
          </button>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: ACCENT, textTransform: "uppercase" }}>Your next move · {homeNextAction.eyebrow}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{homeNextAction.title}</div>
            </div>
            <button onClick={homeNextAction.go} style={{ ...barPrimary, padding: "8px 16px", fontSize: 13, flexShrink: 0 }}>{homeNextAction.cta} {"→"}</button>
          </>
        )}
        <button onClick={toggleCoach} aria-expanded={!coachCollapsed} title={coachCollapsed ? "Show the next-move coach" : "Collapse to a slim strip"} aria-label={coachCollapsed ? "Expand next-move coach" : "Collapse next-move coach"}
          style={{ ...barGhost, padding: "3px 9px", fontSize: 12, flexShrink: 0 }}>{coachCollapsed ? "▸" : "▾"}</button>
      </div>

      {/* Trust: a brand-new project is still the untouched starter, whose stock
          numbers ($97 price, 1,000 visitors…) are NOT the founder's business.
          The KPI row below shows those figures, so label them plainly as an
          example instead of letting them read as a real plan. homeIsUntouched
          flips false the moment any block value is edited, so this banner
          disappears on its own — no dismiss needed. */}
      {homeIsUntouched && (
        <div role="note" style={{ padding: "5px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
          <span><b style={{ color: "var(--text)" }}>Example numbers</b> — these show how the model works. Edit any block to replace them with your own; the figures below are not your results yet.</span>
        </div>
      )}

      {/* Live KPI row: current numbers (always the plan/actual KPI set —
          never swapped for mode-specific cards, so nothing reflows when you
          switch stages) plus the tool-view switcher. */}
      <div style={{ padding: "5px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 2, flexShrink: 0 }}>
          {TOOL_MODES.map((t) => (
            <button key={t.m} data-term={t.term} className="gb-pro-only" onClick={() => setMode(t.m)} title={t.label} style={{
              background: mode === t.m ? ACCENT : "transparent",
              color: mode === t.m ? "#ffffff" : "var(--muted)",
              border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500,
              cursor: "pointer", letterSpacing: 0.4,
            }}>{t.label}</button>
          ))}
        </div>
        {/* Guided/Pro moved to Account settings › Preferences (audit Phase 2) —
            it no longer sits in the canvas working surface. */}
        {mode === "plan" && (
          <select aria-label="Reporting period" value={datePeriod} onChange={(e) => setDatePeriod(e.target.value as DatePeriod)}
            title="Forecast period — scales the KPI cards below, a display lens only, nothing per-node changes"
            style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 7, padding: "3px 7px", fontSize: 11, flexShrink: 0 }}>
            {(Object.keys(DATE_PERIOD_LABEL) as DatePeriod[]).map((p) => <option key={p} value={p}>{DATE_PERIOD_LABEL[p]}</option>)}
          </select>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "1 1 auto", minWidth: 0 }}>
          {!plan ? (
            <div style={{ background: "var(--bad-bg)", border: "1px solid var(--bad-border)", borderRadius: 8, padding: "5px 10px", color: "var(--bad-text)", fontSize: 12 }}>{sim.ok ? "" : sim.error}</div>
          ) : kpiCards()}
        </div>
      </div>

      <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={funnelName} onChange={(e) => setFunnelName(e.target.value)} placeholder="Funnel name"
          aria-label="Funnel name" maxLength={80}
          title={funnelName.trim() === DEFAULT_FUNNEL_NAME ? "Name this funnel to save it to your library" : "Funnel name"}
          style={{ background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: "6px 9px", fontSize: 13, width: 190 }} />
        <select value={funnelCurrency} onChange={(e) => setFunnelCurrency(e.target.value)} title="Funnel currency"
          style={{ background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: "6px 9px", fontSize: 13, cursor: "pointer" }}>
          {currencyCodes().map((code) => <option key={code} value={code}>{code} {CURRENCIES[code]!.symbol}</option>)}
        </select>

        <span data-tour="save" style={{ display: "inline-block" }}>
        <HeaderMenu label="File ▾" title="Save, open, export and import">
          {/* Cloud library first — it is the primary, autosaved home for the
              project (audit Phase 2: "cloud autosave by default; browser-only
              recovery hidden from normal users"). On-device recovery is moved to
              the bottom and de-emphasised as the fallback it is. */}
          <MenuLabel>PROJECT LIBRARY · autosaved</MenuLabel>
          <MenuItem onClick={() => void serverSave()} disabled={!canEdit} title={canEdit ? "Save a named checkpoint to the project library (shared, with history) — your work also autosaves here continuously" : "Viewers cannot save in this workspace"}><span style={menuGlyph}><MarketingIcon name="cloud" size={15} /> Save checkpoint</span></MenuItem>
          {serverList.length > 0 && (
            <div style={{ padding: "2px 10px" }}>
              <select aria-label="Open a saved project" value="" onFocus={() => void refreshServer()} onChange={(e) => { if (e.target.value) void serverOpen(e.target.value); }}
                style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 7, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}>
                <option value="">Open from library…</option>
                {serverList.map((proj) => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
              </select>
            </div>
          )}
          <MenuDivider />
          <MenuItem onClick={exportFile}>⬇ Export JSON</MenuItem>
          <MenuLabel>EXPORT PNG</MenuLabel>
          <MenuItem onClick={() => exportCanvasPng(1)}>⬇ Canvas PNG ×1</MenuItem>
          <MenuItem onClick={() => exportCanvasPng(2)}>⬇ Canvas PNG ×2</MenuItem>
          <MenuItem onClick={() => exportCanvasPng(3)}>⬇ Canvas PNG ×3</MenuItem>
          <MenuLabel>EXPORT CSV</MenuLabel>
          <MenuItem onClick={exportNodesCsv}>⬇ Canvas blocks (CSV)</MenuItem>
          <MenuItem onClick={exportEdgesCsv}>⬇ Canvas conversions / lines</MenuItem>
          <MenuLabel>SHARE</MenuLabel>
          <MenuItem onClick={exportViewOnlyHtml} title="A self-contained HTML file anyone can open — no link, no account, no server">⬇ View-only HTML</MenuItem>
          <MenuItem onClick={() => fileRef.current?.click()}>⬆ Import JSON</MenuItem>
          <MenuDivider />
          <MenuItem onClick={newFunnel}>✦ New funnel</MenuItem>
          <MenuDivider />
          <MenuLabel>ON-DEVICE RECOVERY · this browser only</MenuLabel>
          <MenuItem onClick={saveCurrent} title="Keep a copy in this browser as a fallback — the cloud library above is the real save"><span style={menuGlyph}><MarketingIcon name="save" size={15} /> Save local copy</span></MenuItem>
          <MenuItem onClick={() => deleteNamed(funnelName.trim())} danger title="Delete the local copy. The cloud library copy stays."><span style={menuGlyph}><MarketingIcon name="trash" size={15} /> Delete local copy</span></MenuItem>
          {savedList.length > 0 && (
            <div style={{ padding: "2px 10px" }}>
              <select aria-label="Open a saved checkpoint" value="" onChange={(e) => { if (e.target.value) loadNamed(e.target.value); }}
                style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 7, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}>
                <option value="">Open local copy…</option>
                {savedList.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </HeaderMenu>
        </span>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} style={{ display: "none" }} />

        {/* Persistence indicator — reflects the SAVE state machine, never sim.ok.
            A separate model-error chip (below) reports validation independently,
            so "Saved" can never mask a failed autosave and a model error can
            never masquerade as a save failure. */}
        {(() => {
          const label = saveState === "saved" ? `✓ Saved${savedAt ? ` · ${savedAt}` : ""}`
            : saveState === "saving" ? "Saving…"
            : saveState === "failed" ? "⚠ Save failed — retry"
            : saveState === "conflict" ? "⚠ Changed elsewhere — reload"
            : saveState === "unnamed" ? "Name this funnel to save it"
            : "";
          if (!label) return null;
          const color = saveState === "failed" ? "#dc2626" : saveState === "conflict" ? "#b45309" : "var(--dim)";
          if (saveState === "failed") {
            return (
              <button onClick={() => setRetryNonce((n) => n + 1)} title="Retry saving now"
                style={{ fontSize: 11, color, whiteSpace: "nowrap", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}>
                {label}
              </button>
            );
          }
          if (saveState === "conflict") {
            return (
              <button onClick={reloadLatest} title="Another editor saved this project — reload their version (use the banner to overwrite with yours instead)"
                style={{ fontSize: 11, color, whiteSpace: "nowrap", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}>
                {label}
              </button>
            );
          }
          return (
            <span title={autoMsg || "Autosaved to project library"} aria-live="polite"
              style={{ fontSize: 11, color, whiteSpace: "nowrap" }}>{label}</span>
          );
        })()}
        {!sim.ok && (
          <span title="Simulation error — see the PLAN panel for details. This is a model/validation issue, not a save problem."
            style={{ fontSize: 11, color: "#b45309", whiteSpace: "nowrap" }}>⚠ Model error</span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {status && <span style={{ fontSize: 13, color: "var(--dim)" }}>{status}</span>}
          <div title="Canvas layers — toggle what shows on the map" style={{ display: "flex", gap: 4, padding: 3, background: "var(--surface2)", borderRadius: 12 }}>
            {/* Icon-only toggles: title is help, aria-label is the accessible
                name, aria-pressed exposes the on/off state to assistive tech (2B). */}
            <button onClick={() => setLayerNumbers((v) => !v)} aria-label="Numbers layer" aria-pressed={layerNumbers} title="Numbers layer: rate/people on connecting lines" style={iconBtn(layerNumbers)}><MarketingIcon name="hash" size={16} /></button>
            <button onClick={() => setLayerNotes((v) => !v)} aria-label="Notes layer" aria-pressed={layerNotes} title="Notes layer: show a marker on nodes with a note" style={iconBtn(layerNotes)}><MarketingIcon name="pen" size={16} /></button>
            <button onClick={() => setLayerFlow((v) => !v)} aria-label="Flow layer" aria-pressed={layerFlow} title="Flow layer: colors and thickens lines by simulated volume/health, with a moving-flow animation" style={iconBtn(layerFlow)}><MarketingIcon name="wave" size={16} /></button>
            <button onClick={() => setLayerRisk((v) => !v)} aria-label="Risk layer" aria-pressed={layerRisk} title="Risk layer: shows a colored dot on blocks with a flagged assumption" style={iconBtn(layerRisk)}><MarketingIcon name="warning" size={16} /></button>
          </div>
          <button onClick={() => void openTracking()} style={{ ...barBtn, display: "inline-flex", alignItems: "center", gap: 6 }} title="Live tracking"><MarketingIcon name="signal" size={15} /> Live</button>
          <button onClick={() => setCommentsOpen((v) => !v)} style={{ ...barBtn, display: "inline-flex", alignItems: "center", gap: 6 }} title="Project comments"><MarketingIcon name="message" size={15} />{comments.length ? ` ${comments.length}` : ""}</button>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <button onClick={() => setToolsHubOpen(true)} style={{ ...barBtn, display: "inline-flex", alignItems: "center", gap: 6 }} title="Readiness, risk, history, AI Copilot and more"><MarketingIcon name="gear" size={15} /> Tools</button>
            {Boolean((risk && risk.score >= 50) || (constraintReport != null && !constraintReport.allSatisfied)) && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: "#dc2626", border: "1.5px solid var(--surface)" }} />
            )}
          </span>
          <button onClick={toggleTheme} title="Toggle light / dark" style={{ ...barGhost, display: "inline-flex", alignItems: "center" }}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            <MarketingIcon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
          {/* Solo users (one workspace) don't need a switcher — it's chrome for
              a choice they don't have. Show it only once there's more than one
              workspace to switch between; creating a second one lives in the
              account menu below, so the path is never lost. */}
          {workspaces.length > 1 && (
            <select aria-label="Active workspace" value={activeWsId} onChange={(e) => { if (e.target.value === "__new__") { void createWorkspace(); } else { setActiveWsId(e.target.value); setMembersOpen(false); } }}
              title="Active workspace"
              style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", maxWidth: 130 }}>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}{w.ownerId === user.id ? "" : " · shared"}</option>)}
              <option value="__new__">+ New workspace…</option>
            </select>
          )}
          <HeaderMenu label={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" width={20} height={20} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : user.email.slice(0, 1).toUpperCase()}
              </span>
            </span>
          } title={user.email} align="right">
            <MenuLabel>{user.email}</MenuLabel>
            {user.superAdmin && (
              <MenuLabel><span style={{ color: ACCENT, fontWeight: 700 }}>{"★"} SUPER ADMIN</span></MenuLabel>
            )}
            {activeWs && canManageWs && (
              <MenuItem onClick={() => setMembersOpen((o) => !o)}><span style={menuGlyph}><MarketingIcon name="audiences" size={15} /> Manage members</span></MenuItem>
            )}
            <MenuItem onClick={() => void createWorkspace()}><span style={menuGlyph}><span style={{ display: "inline-flex", width: 15, justifyContent: "center", fontWeight: 700 }}>+</span> New workspace</span></MenuItem>
            <MenuItem onClick={() => { setAccountOpen(true); setAccountTab("profile"); }}><span style={menuGlyph}><MarketingIcon name="gear" size={15} /> Account settings</span></MenuItem>
            <MenuItem onClick={() => setSubscriptionOpen(true)}><span style={menuGlyph}><MarketingIcon name="card" size={15} /> Subscription</span></MenuItem>
            {/* Campaign Studio is part of the same app, gated by a separate
                entitlement (see lib/entitlements). The destination page shows
                the enable/upsell state itself, so this entry is shown to
                everyone rather than hidden behind a client-side plan check. */}
            <MenuItem onClick={() => { window.location.href = "/campaign-studio/brand"; }}><span style={menuGlyph}><MarketingIcon name="campaigns" size={15} /> Campaign Studio</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="compass" size={15} /> Business OS</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/psychology/business-intelligence${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="insights" size={15} /> Business Intelligence</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business/drivers${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="tree" size={15} /> Driver Tree</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business/constraint${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="plan" size={15} /> Growth Constraint</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business/execution${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="bolt" size={15} /> Execution Centre</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business/launches${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="rocket" size={15} /> Launch OS</span></MenuItem>
            <MenuItem onClick={() => { window.location.href = `/business/review${wsQuery}`; }}><span style={menuGlyph}><MarketingIcon name="refresh" size={15} /> Review · Close the loop</span></MenuItem>
            {user.superAdmin && (
              <MenuItem onClick={() => { window.location.href = "/admin"; }}><span style={menuGlyph}><MarketingIcon name="gear" size={15} /> Admin</span></MenuItem>
            )}
            <MenuDivider />
            <MenuItem onClick={() => void onLogout()} danger>Log out</MenuItem>
          </HeaderMenu>
        </div>
      {/* members panel */}
      {histOpen && (
        <GlassDrawer width={400} label="Project history" onClose={() => setHistOpen(false)}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>PROJECT HISTORY</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Revisions</div>
              </div>
              <button onClick={() => setHistOpen(false)} style={barGhost}>{"\u2715"}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>A snapshot is taken every time you save. Restoring an older snapshot keeps the existing history intact.</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 120 }}>
            {revisions.length === 0 && <div style={{ textAlign: "center", color: "var(--dim)", fontSize: 13, padding: 24 }}>No snapshots yet — hit {"\u2601"} Save to take the first.</div>}
            {revisions.map((r, i) => (
              <div key={r.id} style={{ border: `1px solid ${i === 0 ? ACCENT : "var(--border)"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{i === 0 ? "Latest" : `#${revisions.length - i}`} · {r.email}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                {r.note && <div style={{ fontSize: 13, marginTop: 3 }}>{r.note}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 11, color: "var(--dim)" }}>
                  {r.revenue != null && <span>REV {money(r.revenue)}</span>}
                  {r.profit != null && <span style={{ color: r.profit >= 0 ? "#16a34a" : "#e11d48" }}>PROFIT {money(r.profit)}</span>}
                </div>
                {canEdit && <button onClick={() => void restoreRevision(r.id)} style={{ ...barGhost, marginTop: 6, fontSize: 11 }}>{"\u21ba Restore"}</button>}
              </div>
            ))}
          </div>
          {canEdit && (
            <div style={{ borderTop: "1px solid var(--border)", padding: 10 }}>
              <input value={revNote} onChange={(e) => setRevNote(e.target.value)} placeholder="Note for the next save \u2014 e.g. before price test"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: "7px 9px", fontSize: 13 }} />
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 5 }}>Attached to the snapshot taken on your next {"\u2601"} Save.</div>
            </div>
          )}
        </GlassDrawer>
      )}
      {activityOpen && (
        <GlassDrawer width={400} label="Activity" onClose={() => setActivityOpen(false)}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>COLLABORATION</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Activity feed</div>
              </div>
              <button onClick={() => setActivityOpen(false)} style={barGhost} aria-label="Close activity panel">{"✕"}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>What's happened across this workspace — project creates, saves, comments and membership changes.</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 120 }}>
            {activity.length === 0 && <div style={{ textAlign: "center", color: "var(--dim)", fontSize: 13, padding: 24 }}>Nothing yet — activity shows up here as your team works.</div>}
            {activity.map((a) => (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{a.actorEmail}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{new Date(a.at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 3 }}>
                  {ACTIVITY_LABEL[a.action] ?? a.action}{a.projectName ? ` · ${a.projectName}` : ""}
                </div>
                {a.detail && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{a.detail}</div>}
              </div>
            ))}
          </div>
        </GlassDrawer>
      )}
      {commentsOpen && (
        <CommentsPanel comments={comments} draft={commentDraft} setDraft={setCommentDraft}
          postComment={() => void postComment()} removeComment={(id) => void removeComment(id)}
          canEdit={canEdit} userId={user.id} onClose={() => setCommentsOpen(false)} />
      )}
      {/* tracking panel */}
      {trackingOpen && (
        <GlassDrawer width={460} label="Live tracking" onClose={() => setTrackingOpen(false)}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>📡 Live tracking · {funnelName}</div>
            <button onClick={() => setTrackingOpen(false)} style={barGhost} aria-label="Close tracking panel">✕</button>
          </div>
          <div style={{ overflowY: "auto", padding: 18 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Tracking key</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, padding: "6px 9px", color: "var(--text)", marginBottom: 14, userSelect: "all" }}>{trackKey || "\u2014"}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Embed snippet — paste once on your funnel pages, then call gbTrack per page</div>
          <div style={{ border: `1px solid ${publicOrigin ? "var(--border)" : "#fbbf24"}`, background: publicOrigin ? "var(--surface2)" : "#fffbeb", borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>PUBLIC TRACKING URL</div>
            <div style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 7px" }}>
              {publicOrigin
                ? "Snippets point here, so they work on any live funnel page."
                : "Not set \u2014 the snippet below uses this page's address, which only works on your own network. Set a public URL before pasting it on a real page."}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={originDraft} onChange={(e) => setOriginDraft(e.target.value)} placeholder="https://track.yourdomain.com"
                style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 13 }} />
              <button onClick={() => void saveOrigin()} style={barPrimary}>Save</button>
            </div>
            {originMsg && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{originMsg}</div>}
          </div>
          <textarea readOnly value={snippetFor(trackKey, publicOrigin)} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", boxSizing: "border-box", height: 128, fontFamily: "ui-monospace, monospace", fontSize: 11, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: 9, resize: "vertical" }} />
          <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.6, margin: "8px 0" }}>
            <b>Tracking Google/Facebook/Instagram/TikTok/etc. separately:</b> give each ad's destination URL a <code style={{ background: "var(--surface2)", padding: "0 4px", borderRadius: 4 }}>utm_source</code> (every ad platform can auto-fill this) — e.g. <code style={{ background: "var(--surface2)", padding: "0 4px", borderRadius: 4 }}>yoursite.com/?utm_source=facebook</code>. No separate landing page or snippet needed per channel; it's picked up automatically and shows up as the source in People Journeys.
          </div>
          <div style={{ display: "flex", gap: 6, margin: "8px 0 16px" }}>
            <button onClick={() => { void copyText(snippetFor(trackKey, publicOrigin)).then((ok) => setTrackMsg(ok ? "Snippet copied \u2713" : "Could not copy \u2014 select the snippet manually")); }} style={barBtn}>Copy snippet</button>
            <button onClick={() => void refreshTracking()} style={barGhost}>Refresh counts</button>
            <button onClick={exportTrackingCsv} style={barGhost} title="Download counts as CSV">Export CSV</button>
            <button onClick={() => importCsvRef.current?.click()} disabled={!canEdit} style={{ ...barGhost, opacity: canEdit ? 1 : 0.5 }} title="Load counts from a CSV (same format as Export)">Import CSV</button>
            <input ref={importCsvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTrackingCsv(f); e.target.value = ""; }} />
            <button onClick={() => void clearTracking()} disabled={!canEdit} style={{ ...barGhost, color: "#dc2626", opacity: canEdit ? 1 : 0.5 }} title="Delete all recorded tracking data">Clear data</button>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Live counts by block</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ display: "flex", fontSize: 11, color: "var(--dim)", background: "var(--bg)", padding: "6px 10px", fontWeight: 500 }}>
              <span style={{ flex: 2 }}>Block</span><span style={{ flex: 3, fontFamily: "ui-monospace, monospace" }}>id (use in gbTrack)</span><span style={{ flex: 1, textAlign: "right" }}>visits</span><span style={{ flex: 1, textAlign: "right" }}>conv.</span><span style={{ flex: 2, textAlign: "right" }}>revenue</span>
            </div>
            {nodes.map((n) => { const c = trackCounts[n.id]; const lbl = (n.data as RFNodeData).label ?? n.id; return (
              <div key={n.id} style={{ display: "flex", fontSize: 13, color: "var(--text)", padding: "6px 10px", borderTop: "1px solid var(--border)" }}>
                <span style={{ flex: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lbl}</span>
                <span style={{ flex: 3, fontFamily: "ui-monospace, monospace", color: "var(--muted)", userSelect: "all" }}>{n.id}</span>
                <span style={{ flex: 1, textAlign: "right", color: c ? "#4ade80" : "var(--dim)" }}>{c?.visits ?? 0}</span>
                <span style={{ flex: 1, textAlign: "right", color: c?.conversions ? "#60a5fa" : "var(--dim)" }}>{c?.conversions ?? 0}</span>
                <span style={{ flex: 2, textAlign: "right", color: c?.revenue ? "#4ade80" : "var(--dim)" }}>{c?.revenue ? money(c.revenue) : "\u2014"}</span>
              </div>); })}
            {nodes.length === 0 && <div style={{ padding: "10px", fontSize: 13, color: "var(--dim)" }}>Add nodes to your funnel to see them here.</div>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={pullTracking} style={barPrimary}>Pull into actuals</button>
            <button onClick={() => void resetTracking()} style={barGhost}>Reset counts</button>
            {trackMsg && <span style={{ fontSize: 11, color: "var(--dim)", marginLeft: 4 }}>{trackMsg}</span>}
          </div>
          </div>
        </GlassDrawer>
      )}
      {accountOpen && <AccountSettingsModal user={user} tab={accountTab} setTab={setAccountTab} activeWs={activeWs} onClose={() => setAccountOpen(false)} onRenamed={onWorkspaceRenamed} onEmailChanged={onEmailChanged} onAvatarChanged={onAvatarChanged} onDeleted={onLogout} />}
      {subscriptionOpen && <SubscriptionModal onClose={() => setSubscriptionOpen(false)} activeWsId={activeWsId} />}
      {membersOpen && activeWs && canManageWs && (
        <GlassDrawer width={320} label="Workspace members" onClose={() => setMembersOpen(false)} style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{activeWs.name} · members</div>
            <button onClick={() => setMembersOpen(false)} style={barGhost} aria-label="Close members panel">✕</button>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 12 }}>
            {activeWs.members.map((m) => {
              const removable = m.userId !== activeWs.ownerId && m.userId !== user.id;
              return (
                <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", padding: "4px 0" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.userId === user.id ? `${user.email} (you)` : `${m.userId.slice(0, 12)}\u2026`}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ color: "var(--dim)" }}>{m.role}</span>
                    {removable && <button onClick={() => void removeWsMember(m.userId)} title="Remove from workspace" style={{ ...barGhost, fontSize: 11, padding: "1px 6px", color: "#e11d48", borderColor: "transparent" }}>{"\u2715"}</button>}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            {!user.superAdmin && activeWs.plan !== "business" && activeWs.plan !== "performance" ? (
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                {(activeWs.plan ?? "free") === "free" ? "The free plan" : "Pro"} is a single-profile plan — upgrade to Business to invite teammates.
                <button onClick={() => { setMembersOpen(false); setSubscriptionOpen(true); }} style={{ ...barGhost, display: "block", width: "100%", justifyContent: "center", marginTop: 8 }}>Upgrade to Business</button>
              </div>
            ) : (
              <>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void invite(); }} placeholder="email to invite" style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "manager" | "editor" | "viewer")} style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13 }}>
                    {isOwner && <option value="manager">manager</option>}
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button onClick={() => void invite()} style={barPrimary}>Invite</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 8 }}>Managers can edit projects, rename the workspace, and manage members. Editors edit projects. Viewers read only.</div>
              </>
            )}
            {inviteMsg && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 6 }}>{inviteMsg}</div>}
          </div>
        </GlassDrawer>
      )}

      </div>

      {toolsHubOpen && (
        <ToolsHub
          risk={risk} constraintReport={constraintReport} checklist={checklist} hasNotes={notes.trim().length > 0}
          retargetingCount={retargetingLoops.length} hasRecurring={!!recurring} hasTimeline={!!timeline}
          onOpenTour={() => { setToolsHubOpen(false); setTourOpen(true); }}
          onOpenNotes={() => { setToolsHubOpen(false); setNotesOpen(true); }}
          onOpenChecklist={() => { setToolsHubOpen(false); setChecklistOpen(true); }}
          onOpenHistory={() => { setToolsHubOpen(false); setHistOpen(true); }}
          onOpenActivity={() => { setToolsHubOpen(false); setActivityOpen(true); }}
          onOpenRisk={() => { setToolsHubOpen(false); setRiskOpen(true); }}
          onOpenRetargeting={() => { setToolsHubOpen(false); setRetargetingOpen(true); }}
          onOpenJourneys={() => { setToolsHubOpen(false); setJourneyOpen(true); }}
          onOpenConstraints={() => { setToolsHubOpen(false); setConstraintsOpen(true); }}
          onOpenRecurring={() => { setToolsHubOpen(false); setRecurringOpen(true); }}
          onOpenTimeline={() => { setToolsHubOpen(false); setTimelineOpen(true); }}
          onOpenAiCopilot={() => { setToolsHubOpen(false); setAiOpen(true); }}
          onOpenIntegrations={() => { setToolsHubOpen(false); setIntegrationsOpen(true); }}
          onClose={() => setToolsHubOpen(false)}
        />
      )}
      {riskOpen && (
        <RiskPanel risk={risk} riskRegister={riskRegister} funnelCurrency={funnelCurrency}
          addRiskEntry={addRiskEntry} removeRiskEntry={removeRiskEntry} cycleRiskStatus={cycleRiskStatus}
          onClose={() => setRiskOpen(false)} />
      )}
      {notesOpen && (
        <NotesPanel notes={notes} setNotes={setNotes} onClose={() => setNotesOpen(false)} />
      )}
      {checklistOpen && (
        <ChecklistPanel nodes={nodes} checklist={checklist} addChecklistItem={addChecklistItem}
          toggleChecklistDone={toggleChecklistDone} removeChecklistItem={removeChecklistItem}
          presetChecklistForAllBlocks={presetChecklistForAllBlocks} onClose={() => setChecklistOpen(false)} />
      )}
      {journeyOpen && (
        <JourneyPanel sessions={journeySessions} idx={journeyIdx} setIdx={setJourneyIdx} nodes={nodes} onClose={() => setJourneyOpen(false)} />
      )}
      {retargetingOpen && (
        <RetargetingPanel nodes={nodes} loopDraft={loopDraft} setLoopDraft={setLoopDraft}
          addRetargetingLoop={addRetargetingLoop} retargetingLoops={retargetingLoops} removeRetargetingLoop={removeRetargetingLoop}
          retargetingResult={retargetingResult} labelOf={labelOf} funnelCurrency={funnelCurrency}
          onClose={() => setRetargetingOpen(false)} />
      )}
      {constraintsOpen && (
        <ConstraintsPanel nodes={nodes} funnelCurrency={funnelCurrency} constraintDraft={constraintDraft}
          setConstraintDraft={setConstraintDraft} constraintReport={constraintReport} addConstraint={addConstraint}
          removeConstraint={removeConstraint} onClose={() => setConstraintsOpen(false)} />
      )}
      {recurringOpen && recurring && (
        <RecurringPanel recurring={recurring} onClose={() => setRecurringOpen(false)} />
      )}
      {timelineOpen && timeline && (
        <TimelinePanel timeline={timeline} labelOf={labelOf} onClose={() => setTimelineOpen(false)} />
      )}
      {aiOpen && (
        <GlassDrawer width={420} label="AI Copilot" onClose={() => setAiOpen(false)}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>AI COPILOT</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Ask about this model</div>
            </div>
            <button onClick={() => setAiOpen(false)} style={barGhost}>Close</button>
          </div>
          {!aiKey ? (
            <div style={{ overflowY: "auto", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "var(--dim)", marginBottom: 8 }}>CONNECT YOUR AI</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {AI_PROVIDERS.map((p) => {
                  const on = aiProvider === p.id;
                  return (
                    <button key={p.id} onClick={() => changeAiProvider(p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 500,
                        border: `1px solid ${on ? p.hue : "var(--border3)"}`, background: on ? `${p.hue}1e` : "transparent", color: on ? p.hue : "var(--muted)" }}>
                      <span>{p.icon}</span>{p.name}
                    </button>
                  );
                })}
              </div>
              {aiProvider === "manual" ? (
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>No AI connected — pick a provider above to generate copy and chat, or keep writing it yourself.</div>
              ) : (() => {
                const prov = getAIProvider(aiProvider);
                return (<>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                    {prov?.note} Your key is saved to your account (encrypted) and sent straight to the provider. {prov?.keyUrl && <a href={prov.keyUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>Get a key →</a>}
                  </div>
                  <input value={aiKeyInput} onChange={(e) => setAiKeyInput(e.target.value)} placeholder={prov?.keyPrefix ? `${prov.keyPrefix}...` : "your API key"} type="password"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8 }} />
                  <button onClick={saveAiKey} disabled={!aiKeyInput.trim()} style={{ ...barPrimary, width: "100%", opacity: aiKeyInput.trim() ? 1 : 0.5 }}>Save key</button>
                </>);
              })()}
            </div>
          ) : (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border2)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{getAIProvider(aiProvider)?.icon} Key saved in this browser ({getAIProvider(aiProvider)?.name})</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={testAiConnection} disabled={aiTest.state === "testing"} style={{ ...barGhost, padding: "2px 8px", fontSize: 11, opacity: aiTest.state === "testing" ? 0.5 : 1 }}>
                      {aiTest.state === "testing" ? "Testing…" : "Test"}
                    </button>
                    {aiMessages.length > 0 && <button onClick={() => setAiMessages([])} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Clear chat</button>}
                    <button onClick={clearAiKey} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Remove key</button>
                  </div>
                </div>
                {aiTest.state === "ok" && <div style={{ fontSize: 11, color: "var(--good-border)" }}>✓ Connection works.</div>}
                {aiTest.state === "err" && <div style={{ fontSize: 11, color: "var(--bad-text)" }}>✗ {aiTest.msg}</div>}
                <input value={aiModel} onChange={(e) => changeAiModel(e.target.value)} placeholder={getAIProvider(aiProvider)?.defaultModel} list="copilot-ai-models"
                  title="The model id for your provider"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 11.5, fontFamily: "monospace" }} />
                <datalist id="copilot-ai-models">{(getAIProvider(aiProvider)?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {aiMessages.length === 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                    <button disabled={aiBusy || !plan} style={barGhost}
                      onClick={() => askCopilot("Explain what this funnel's numbers mean and where the biggest opportunity is.", copilotContext)}>
                      Explain my numbers
                    </button>
                    <button disabled={aiBusy || !risk} style={barGhost}
                      onClick={() => askCopilot("Explain the biggest risks in this plan and what to test first.", copilotContext)}>
                      Explain my risk
                    </button>
                    <button disabled={aiBusy || !variance} style={barGhost}
                      onClick={() => askCopilot("Explain why actual results differ from plan and what to fix first.", copilotContext)}>
                      Explain variance
                    </button>
                    <button disabled={aiBusy} style={barGhost}
                      onClick={() => askCopilot("Look at my whole plan and tell me the single most important thing to work on next, and why.", copilotContext)}>
                      What should I do next?
                    </button>
                  </div>
                )}
                {aiMessages.map((m, i) => (
                  <div key={i} style={{
                    fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", borderRadius: 8, padding: "10px 12px",
                    alignSelf: m.role === "user" ? "flex-end" : "stretch", maxWidth: m.role === "user" ? "88%" : undefined,
                    background: m.role === "user" ? ACCENT : "var(--surface2)", color: m.role === "user" ? "#fff" : "var(--text)",
                  }}>
                    {m.content.split("\n\nCurrent plan snapshot:\n")[0]}
                  </div>
                ))}
                {aiBusy && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--dim)" }}>
                    <span>Thinking…</span>
                    <button onClick={() => aiAbortRef.current?.abort()} style={{ ...barGhost, padding: "2px 10px", fontSize: 11 }}>Stop</button>
                  </div>
                )}
                {aiErr && <div role="alert" style={{ fontSize: 13, color: "#dc2626" }}>{aiErr}</div>}
              </div>
              <div style={{ padding: 12, borderTop: "1px solid var(--border2)", display: "flex", gap: 6 }}>
                <input value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && aiInput.trim() && !aiBusy) askCopilot(aiInput, aiMessages.length === 0 ? copilotContext : undefined); }}
                  placeholder="Ask anything about this plan…" disabled={aiBusy}
                  style={{ flex: 1, boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 13 }} />
                <button disabled={aiBusy || !aiInput.trim()} style={{ ...barPrimary, opacity: aiBusy || !aiInput.trim() ? 0.5 : 1 }}
                  onClick={() => askCopilot(aiInput, aiMessages.length === 0 ? copilotContext : undefined)}>
                  Send
                </button>
                <button disabled={aiEditBusy || aiBusy || !aiInput.trim()} style={{ ...barGhost, opacity: aiEditBusy || aiBusy || !aiInput.trim() ? 0.5 : 1 }}
                  title="Apply this as a change to the funnel — adds/edits/removes blocks (⌘Z to undo)"
                  onClick={() => applyAiEdit(aiInput)}>
                  {aiEditBusy ? "Applying…" : "Apply"}
                </button>
              </div>
            </>
          )}
        </GlassDrawer>
      )}
      {integrationsOpen && (
        <GlassDrawer width={420} label="Integrations" onClose={() => setIntegrationsOpen(false)}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>INTEGRATIONS</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Webhook receivers</div>
            </div>
            <button onClick={() => setIntegrationsOpen(false)} style={barGhost}>Close</button>
          </div>
          <div style={{ overflowY: "auto", padding: 16 }}>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface2)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Stripe</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: stripeStatus?.configured ? "#16a34a22" : "#64748b22", color: stripeStatus?.configured ? "#16a34a" : "#64748b" }}>
                  {stripeStatus == null ? "…" : stripeStatus.configured ? "CONNECTED" : "NOT CONFIGURED"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                {stripeStatus?.configured
                  ? `${stripeStatus.count} event${stripeStatus.count === 1 ? "" : "s"} received${stripeStatus.lastReceivedAt ? ` · last ${new Date(stripeStatus.lastReceivedAt).toLocaleString()}` : ""}`
                  : "Set STRIPE_WEBHOOK_SECRET on the server (from your own Stripe dashboard → Webhooks) to accept real events."}
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 6, wordBreak: "break-all" }}>
                Endpoint: <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe</code>
              </div>
              {stripeStatus && stripeStatus.completedCount > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                    {stripeStatus.completedCount} completed checkout{stripeStatus.completedCount === 1 ? "" : "s"} · {money(stripeStatus.completedAmountTotal)} total
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select aria-label="Stripe payout account" value={stripeTargetId} onChange={(e) => setStripeTargetId(e.target.value)}
                      style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 7px", fontSize: 13 }}>
                      <option value="">Pull into which offer?</option>
                      {nodes.filter((n) => (n.data as RFNodeData).kind === "offer").map((n) => (
                        <option key={n.id} value={n.id}>{(n.data as RFNodeData).label || n.id}</option>
                      ))}
                    </select>
                    <button onClick={pullStripeIntoActuals} disabled={!stripeTargetId} style={{ ...barPrimary, opacity: stripeTargetId ? 1 : 0.5 }}>Pull into actuals</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface2)", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>API keys</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                Read-only access to this workspace's projects for external tools (Zapier, a script, a BI dashboard) — <code>Authorization: Bearer &lt;key&gt;</code> against <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/v1/projects</code>.
              </div>
              {newApiKey && (
                <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "var(--good-bg, #10261b)", border: "1px solid var(--good-border, #1f6f47)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Copy it now — it won't be shown again.</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ flex: 1, fontSize: 11.5, wordBreak: "break-all" }}>{newApiKey}</code>
                    <button onClick={() => { navigator.clipboard?.writeText(newApiKey).catch(() => {}); }} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Copy</button>
                  </div>
                </div>
              )}
              {(apiKeys ?? []).filter((k) => !k.revoked).map((k) => (
                <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--dim)" }}>
                      <code>{k.prefix}…</code> · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                    </div>
                  </div>
                  <button onClick={() => revokeApiKeyClick(k.id)} style={{ ...barGhost, padding: "2px 8px", fontSize: 11, flexShrink: 0 }}>Revoke</button>
                </div>
              ))}
              {apiKeys && apiKeys.filter((k) => !k.revoked).length === 0 && !newApiKey && (
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>No active keys.</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={apiKeyNameInput} onChange={(e) => setApiKeyNameInput(e.target.value)} placeholder="Key name (e.g. Zapier)"
                  style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 7px", fontSize: 13 }} />
                <button onClick={createApiKeyClick} disabled={apiKeyBusy} style={{ ...barPrimary, opacity: apiKeyBusy ? 0.5 : 1 }}>Generate</button>
              </div>
              {apiKeyErr && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>{apiKeyErr}</div>}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface2)", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Outbound webhooks</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                Push a signed POST to your own URL when something happens here — a project is created or deleted. Verify it with HMAC-SHA256 over <code>{"{timestamp}.{rawBody}"}</code> using the secret, same scheme as Stripe's own webhooks.
              </div>
              {newWebhookSecret && (
                <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "var(--good-bg, #10261b)", border: "1px solid var(--good-border, #1f6f47)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Signing secret — copy it now, it won't be shown again.</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ flex: 1, fontSize: 11.5, wordBreak: "break-all" }}>{newWebhookSecret}</code>
                    <button onClick={() => { navigator.clipboard?.writeText(newWebhookSecret).catch(() => {}); }} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Copy</button>
                  </div>
                </div>
              )}
              {(webhooks ?? []).map((w) => {
                const ok = w.lastStatus != null && w.lastStatus < 400;
                const state = w.disabled ? "disabled" : !w.lastDeliveryAt ? "pending" : ok ? "delivered" : "failed";
                const pill = { delivered: { bg: "var(--good-bg)", fg: "var(--good-border)" }, failed: { bg: "var(--bad-bg)", fg: "var(--bad-text)" }, pending: { bg: "var(--chip)", fg: "var(--muted)" }, disabled: { bg: "var(--chip)", fg: "var(--dim)" } }[state];
                return (
                  <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: pill.fg, background: pill.bg, borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>{state}{state === "failed" && w.lastStatus != null ? ` ${w.lastStatus}` : ""}</span>
                        <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.url}</div>
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 2 }}>
                        {w.events.join(", ")}{w.lastDeliveryAt ? ` · last attempt ${new Date(w.lastDeliveryAt).toLocaleString()}` : " · no deliveries yet"}
                      </div>
                      {state === "failed" && w.lastError && (
                        <div style={{ fontSize: 10.5, color: "var(--bad-text)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.lastError}>⚠ {w.lastError}</div>
                      )}
                      {openWebhookLog === w.id && (() => {
                        const log = webhookLogs[w.id];
                        if (log === "loading") return <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 6 }}>Loading deliveries…</div>;
                        if (!log || log.length === 0) return <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 6 }}>No deliveries recorded yet.</div>;
                        return (
                          <div style={{ marginTop: 6, borderLeft: "2px solid var(--border2)", paddingLeft: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {log.map((d) => (
                              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                                <span style={{ fontWeight: 700, color: d.ok ? "var(--good-border)" : "var(--bad-text)", flexShrink: 0, width: 30 }}>{d.status ?? "—"}</span>
                                <span style={{ color: "var(--muted)", flexShrink: 0 }}>{d.event}</span>
                                <span style={{ color: "var(--dim)", marginLeft: "auto", flexShrink: 0 }}>{new Date(d.at).toLocaleString()}</span>
                                {d.error && <span style={{ color: "var(--bad-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.error}>⚠</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => toggleWebhookLog(w.id)} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }} aria-expanded={openWebhookLog === w.id}>{openWebhookLog === w.id ? "Hide log" : "Log"}</button>
                      <button onClick={() => deleteWebhookClick(w.id)} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Delete</button>
                    </div>
                  </div>
                );
              })}
              {webhooks && webhooks.length === 0 && !newWebhookSecret && (
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>No webhooks registered.</div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, marginBottom: 8 }}>
                {WEBHOOK_EVENT_TYPES.map((ev) => (
                  <label key={ev} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text)", cursor: "pointer" }}>
                    <input type="checkbox" checked={webhookEventsInput.includes(ev)}
                      onChange={(e) => setWebhookEventsInput((evs) => e.target.checked ? [...evs, ev] : evs.filter((x) => x !== ev))} />
                    {ev}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={webhookUrlInput} onChange={(e) => setWebhookUrlInput(e.target.value)} placeholder="https://your-endpoint.example.com/hook"
                  style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 7px", fontSize: 13 }} />
                <button onClick={createWebhookClick} disabled={webhookBusy || !webhookUrlInput.trim() || webhookEventsInput.length === 0} style={{ ...barPrimary, opacity: webhookBusy || !webhookUrlInput.trim() || webhookEventsInput.length === 0 ? 0.5 : 1 }}>Register</button>
              </div>
              {webhookErr && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>{webhookErr}</div>}
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.6 }}>
              Ad platform connections (Meta, Google, TikTok) and CRM integrations each require registering an OAuth app in that platform's own developer console — something only you can do with your own accounts. This panel covers the pieces that don't: verified webhook receivers for events those platforms (or Stripe) push to you, API keys for pulling your own data out, and outbound webhooks for pushing events to your own tools.
            </div>
          </div>
        </GlassDrawer>
      )}
      {/* Two-editors conflict (finding B): a save was refused because someone
          else saved this project after we opened it. Autosave is paused; the
          user reloads their version or overwrites it with the local edits. */}
      {conflict && (
        <div role="alert" style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", background: "var(--ds-warn-soft, #fef3c7)", display: "flex", alignItems: "center", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text)" }}>
            Someone else saved this project{conflict.name ? ` (“${conflict.name}”)` : ""} after you opened it. Autosave is paused so your edits don&apos;t overwrite theirs.
          </span>
          <button onClick={reloadLatest} style={{ ...barPrimary, padding: "4px 12px" }}>Reload latest</button>
          <button onClick={() => void overwriteWithMine()} style={{ ...barGhost, padding: "4px 12px" }} title="Save your current version over the one saved elsewhere">Overwrite with mine</button>
        </div>
      )}
      {/* Keyboard-shortcuts cheat sheet is rendered once per view branch via
          <ShortcutsOverlay>, which is focus-trapped and announced as a dialog. */}
      {draftDoc && (
        <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", background: "var(--accent-soft)", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <span style={{ color: "var(--text)" }}>An unsaved draft from a previous session was found.</span>
          <button onClick={() => {
              applyDoc(draftDoc); setFunnelName(draftDoc.name || "Recovered draft");
              // Rebind to whatever row the draft was saved under (possibly
              // "" — never saved yet — which correctly mints a fresh id on
              // the next save, same as any other brand-new document).
              let savedId = "";
              try { savedId = localStorage.getItem(DRAFT_ID_KEY) ?? ""; } catch { /* ignore */ }
              setProjectId(savedId);
              baseRef.current = { id: "", updatedAt: "" };
              setConflict(null);
              setDraftDoc(null); setStatus("Draft restored");
            }}
            style={{ ...barPrimary, padding: "4px 12px" }}>Restore draft</button>
          <button onClick={() => { try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_ID_KEY); } catch {} setDraftDoc(null); }}
            style={{ ...barGhost, padding: "4px 12px" }}>Dismiss</button>
        </div>
      )}
      {!defNoticeDismissed && !definition.businessName && !definition.breakthrough && (
        <div style={{ padding: "6px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ color: "var(--dim)" }}>This project doesn&apos;t have a business definition yet — the canvas works either way, but Business Intelligence gives every model a why.</span>
          <button onClick={() => { window.location.href = `/psychology/business-intelligence${wsQuery}`; }} style={{ ...barGhost, padding: "3px 10px", fontSize: 12, flexShrink: 0 }}>Continue Program →</button>
          <button onClick={dismissDefNotice} title="Dismiss this reminder" aria-label="Dismiss this reminder" style={{ ...barGhost, padding: "3px 8px", fontSize: 12, flexShrink: 0, marginLeft: "auto" }}>✕</button>
        </div>
      )}
      {canEdit && (definition.mainOffer || definition.whoServe) && nodes.length === 3 && nodes.every((n) => ["traffic", "landing", "sale"].includes(n.id)) && (
        <div style={{ padding: "6px 18px", borderBottom: "1px solid var(--border)", background: "var(--accent-soft)", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ color: "var(--text)" }}>You&apos;ve answered the business definition — generate a starter map from it instead of the generic canvas?</span>
          <button onClick={generateStarterMap} style={{ ...barPrimary, padding: "3px 10px", fontSize: 12, flexShrink: 0 }}>✦ Generate starter map</button>
        </div>
      )}
      {(mode === "actual" || mode === "variance") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: mode === "actual" ? "var(--accent-soft)" : "transparent", borderBottom: "1px solid var(--border)", padding: "7px 18px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: mode === "actual" ? 700 : 400, color: mode === "actual" ? ACCENT : "var(--dim)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {mode === "actual" ? "ACTUAL" : "REVIEW \u2014 read-only. Green beat plan, red leaked."}
          </span>
          {mode === "actual" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border3)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700, flexShrink: 0 }}>PERIOD</span>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={!canEdit}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "4px 7px", fontSize: 13 }} />
              <span style={{ color: "var(--dim)", fontSize: 13 }}>{"\u2192"}</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled={!canEdit}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "4px 7px", fontSize: 13 }} />
              {periodInfo ? (
                <>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{periodInfo.label}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 11 }}>
                    <span style={{ color: "var(--muted)" }}>REVENUE/DAY <b style={{ color: "var(--text)" }}>{money(periodInfo.revPerDay)}</b></span>
                    <span style={{ color: "var(--muted)" }}>PROFIT/DAY <b style={{ color: periodInfo.profitPerDay >= 0 ? "#16a34a" : "#e11d48" }}>{money(periodInfo.profitPerDay)}</b></span>
                    <span style={{ color: "var(--muted)" }}>30-DAY RUN RATE <b style={{ color: "var(--text)" }}>{money(periodInfo.profitPerDay * 30)}</b></span>
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--dim)" }}>{periodStart || periodEnd ? "Set a valid start and end to see run-rate." : "Set the window these numbers cover \u2014 $40k means nothing until you know if it was a week or a quarter."}</span>
              )}
            </>
          )}
        </div>
      )}

      {mode === "report" ? (
        <ReportView report={report} onExport={exportReport} onExportCsv={exportReportCsv} onExportPdf={exportReportPdf} onExportClientSummary={exportClientSummary} onPrint={printReport} />
      ) : (
      <div id="gb-main" role="main" tabIndex={-1} style={{ display: "flex", flex: 1, minHeight: 0, outline: "none" }}>
        {libOpen && (
          <div data-tour="blocks" style={{ width: 232, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>BLOCKS</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Live modelling library</div>
                </div>
                <button onClick={() => setLibOpen(false)} style={barGhost} title="Hide library">{"\u25c0"}</button>
              </div>
              <input value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder={"\ud83d\udd0d  Search blocks\u2026"}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 9, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: "7px 9px", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {(["all", "traffic", "pages", "communication", "meetings", "actions", "business", "logic", "offline"] as const).map((c) => (
                  <button key={c} onClick={() => setLibCat(c)}
                    style={{ ...barGhost, padding: "3px 8px", fontSize: 11, textTransform: "capitalize",
                      background: libCat === c ? "var(--accent-soft)" : "transparent",
                      color: libCat === c ? ACCENT : "var(--muted)",
                      borderColor: libCat === c ? ACCENT : "var(--border3)" }}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignContent: "start" }}>
              {libItems.map((item) => {
                const b = BRAND_BY_KEY[item.brand]!;
                return (
                  <div key={item.id} draggable={canEdit}
                    role="button" tabIndex={canEdit ? 0 : -1} aria-label={`Add ${item.label} \u2014 ${item.sub}`} aria-disabled={!canEdit}
                    onDragStart={(e) => e.dataTransfer.setData("application/gearbox-block", item.id)}
                    onClick={() => canEdit && addFromLib(item)}
                    onKeyDown={(e) => { if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); addFromLib(item); } }}
                    title={`${item.label} \u2014 ${item.sub}`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "5px 2px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.55, textAlign: "center", minWidth: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <BrandMark brand={b} size={16} fallback={b.glyph} />
                    <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.2, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                  </div>
                );
              })}
              {libItems.length === 0 && <div style={{ fontSize: 11, color: "var(--dim)", padding: 10 }}>No blocks match that search.</div>}
            </div>
            <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--dim)" }}>Click to add · Drag for precise placement</div>
          </div>
        )}
        {!libOpen && (
          <button onClick={() => setLibOpen(true)} title="Show block library"
            style={{ ...barGhost, alignSelf: "flex-start", margin: 8 }}>{"\u25b6 Blocks"}</button>
        )}
        <div ref={canvasWrapRef} data-tour="canvas" style={{ flex: 1, minWidth: 0, background: "var(--canvas)" }} onDrop={onCanvasDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}>
          {mode === "scenarios" || mode === "simulate" ? (
            <ScenarioCompare comparison={mode === "scenarios" ? scenarioComparison : simComparison} mode={mode === "scenarios" ? "scenarios" : "simulate"} />
          ) : mode === "model" ? (
            <ModelCentre nodes={nodes} patch={patch} />
          ) : (
          /* Read-only gate at the canvas level (nodesDraggable / nodesConnectable
             / deleteKeyCode below): viewers, free-plan and over-seat users can
             pan, zoom, select and inspect but can't drag, rewire or delete.
             Autosave already bails on !canEdit, so before this those edits
             silently vanished (or wrecked the shared demo). One gate here beats
             ~30 scattered `canEdit &&` guards on individual controls. */
          <ReactFlow nodes={displayNodes} edges={displayEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            aria-label="Funnel canvas. Press Tab to move between blocks; with a block selected, arrow keys move it."
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_e, n) => setSelectedId(n.id)} onPaneClick={() => { setSelectedId(null); setEdgePopover(null); }}
            onEdgeClick={onEdgeClick}
            nodesDraggable={canEdit} nodesConnectable={canEdit} elementsSelectable
            /* Keyboard a11y: Tab focuses a block, arrow keys nudge it (⇧ = faster).
               nodesFocusable is React Flow's default, but pin it on so a future
               prop change can't silently drop keyboard navigation. */
            nodesFocusable
            fitView colorMode={theme} deleteKeyCode={canEdit ? ["Delete", "Backspace"] : null}
            snapToGrid={snapOn} snapGrid={[18, 18]}
            defaultEdgeOptions={{
              type: "river",
              style: { stroke: "rgba(10,158,110,0.45)", strokeWidth: 2 },
            }}
            onNodesDelete={(ns) => { if (ns.some((n) => n.id === selectedId)) setSelectedId(null); }}>
            <Background color="var(--border3)" gap={20} size={1.2} />
            {/* Just zoom in/out — the one affordance the custom toolbar doesn't
                cover (scroll-to-zoom isn't obvious to everyone). Fit view is
                already a labelled button in the Tools card, and the interactive
                "lock" toggle only muddies things next to the plan/role
                read-only gate, so both are hidden rather than left as bare,
                redundant icons. */}
            <Controls showFitView={false} showInteractive={false} aria-label="Zoom controls" />
            {/* Canvas toolbar: view actions on top, insert actions below a
                divider, grouped into one card so it reads as an intentional
                toolbar and stays clear of React Flow's native zoom controls
                (which live at the bottom-left). Collapsible + remembered per
                browser, since it sits on top of the canvas and some users
                want it out of the way entirely. */}
            {!canvasToolbarOpen && (
              <button className="gb-canvas-toolbar-reopen" onClick={toggleCanvasToolbar} title="Show canvas toolbar">☰ Tools</button>
            )}
            {canvasToolbarOpen && (
            <div className="gb-canvas-toolbar">
              <div className="gb-canvas-tool-header">
                <span>TOOLS</span>
                <button className="gb-canvas-tool-collapse" onClick={toggleCanvasToolbar} title="Hide this toolbar" aria-label="Hide canvas toolbar">✕</button>
              </div>
              <button className="gb-canvas-tool" onClick={() => rfi.fitView({ padding: 0.2, duration: 300 })} title="Fit all blocks in view">⛶ Fit</button>
              <button className="gb-canvas-tool" onClick={zoomToSelection} title="Zoom to selected block(s)">⌖ Zoom to selection</button>
              {canEdit && (
                <button className="gb-canvas-tool" onClick={tidyLayout} title="Auto-arrange blocks left-to-right by flow order">⇉ Tidy layout</button>
              )}
              {canEdit && (
                <button className="gb-canvas-tool" onClick={() => setSnapOn((v) => !v)} title="Snap block positions to an 18px grid"
                  style={snapOn ? { background: "var(--accent-soft)", borderColor: ACCENT, color: ACCENT } : undefined}># Snap to grid {snapOn ? "on" : "off"}</button>
              )}
              {(mode === "plan" || mode === "actual") && (
                <button className="gb-canvas-tool" onClick={() => setExplorerOpen((v) => !v)} title="What feeds this block, and what it feeds — floats over the canvas so it doesn't need the right panel open"
                  style={explorerOpen ? { background: "var(--accent-soft)", borderColor: ACCENT, color: ACCENT } : undefined}>🔎 Explorer</button>
              )}
              {canEdit && <div className="gb-canvas-tool-sep" />}
              {canEdit && (
                <button className="gb-canvas-tool" onClick={addEmailSequence} title="Add a chained run of N email steps — connected from the selected block if one is selected">✉ Add email sequence</button>
              )}
              {canEdit && (
                <button className="gb-canvas-tool" onClick={() => addAnnotation("sticky")} title="Add a sticky note — never part of the simulation, just a canvas comment">🗒 Sticky note</button>
              )}
              {canEdit && (
                <button className="gb-canvas-tool" onClick={() => addAnnotation("text")} title="Add a text label — never part of the simulation, just a canvas comment">T Text</button>
              )}
            </div>
            )}
            {explorerOpen && (mode === "plan" || mode === "actual") && (
              <div style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 260, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(15,23,42,.15)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>EXPLORER</span>
                  <button onClick={() => setExplorerOpen(false)} style={{ ...barGhost, padding: "2px 7px" }} aria-label="Close explorer">✕</button>
                </div>
                {!selected ? (
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>Select a block to explore its connections.</div>
                ) : (() => {
                  const feeders = edges.filter((e) => e.target === selected.id).map((e) => e.source);
                  const feeds = edges.filter((e) => e.source === selected.id).map((e) => e.target);
                  const Row = (id: string) => (
                    <button key={id} onClick={() => setSelectedId(id)}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "var(--text)", cursor: "pointer", marginBottom: 4 }}>
                      {labelOf[id] ?? id}
                    </button>
                  );
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(selected.data as RFNodeData).label ?? selected.id}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>FEEDS THIS ({feeders.length})</div>
                      {feeders.length === 0 ? <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Nothing — this is a source.</div> : <div style={{ marginBottom: 10 }}>{feeders.map(Row)}</div>}
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>THIS FEEDS ({feeds.length})</div>
                      {feeds.length === 0 ? <div style={{ fontSize: 12, color: "var(--dim)" }}>Nothing downstream yet.</div> : <div>{feeds.map(Row)}</div>}
                    </>
                  );
                })()}
              </div>
            )}
            {edgePopover && canEdit && (() => {
              const edge = edges.find((e) => e.id === edgePopover.id);
              if (!edge) return null;
              const lineType = ((edge.data as Record<string, unknown> | undefined)?.lineType as EdgeLineType | undefined) ?? "primary";
              return (
                <div style={{ position: "fixed", left: edgePopover.x, top: edgePopover.y, zIndex: 20, width: 220, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(15,23,42,.2)", padding: 10 }}
                  onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>LINE SETTINGS</span>
                    <button onClick={() => setEdgePopover(null)} style={{ ...barGhost, padding: "2px 7px" }} aria-label="Close">✕</button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Label</div>
                  <input defaultValue={typeof edge.label === "string" ? edge.label : ""}
                    onBlur={(e) => patchEdgeLabel(edgePopover.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="e.g. 20% off"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 7px", fontSize: 12, marginBottom: 10 }} />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Line type</div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                    {(["primary", "secondary", "conditional"] as EdgeLineType[]).map((lt) => (
                      <button key={lt} onClick={() => patchEdgeLineType(edgePopover.id, lt)}
                        style={{ flex: 1, padding: "5px 4px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                          background: lineType === lt ? "var(--accent-soft)" : "var(--surface2)",
                          color: lineType === lt ? ACCENT : "var(--muted)",
                          border: `1px solid ${lineType === lt ? ACCENT : "var(--border3)"}` }}>
                        {EDGE_LINE_LABEL[lt]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setEdges((eds) => eds.filter((e) => e.id !== edgePopover.id)); setEdgePopover(null); }}
                    style={{ ...barGhost, width: "100%", color: "#dc2626", borderColor: "var(--ds-danger-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><MarketingIcon name="trash" size={14} /> Delete line</button>
                </div>
              );
            })()}
            {canEdit && multiSelected.length >= 2 && (
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", boxShadow: "0 1px 3px rgba(15,23,42,.1)" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>{multiSelected.length} selected</span>
                <HeaderMenu label="Align ▾" title="Align selected blocks">
                  <MenuItem onClick={() => alignSelected("left")}>⇤ Left</MenuItem>
                  <MenuItem onClick={() => alignSelected("center")}>↔ Center</MenuItem>
                  <MenuItem onClick={() => alignSelected("right")}>⇥ Right</MenuItem>
                  <MenuDivider />
                  <MenuItem onClick={() => alignSelected("top")}>⇡ Top</MenuItem>
                  <MenuItem onClick={() => alignSelected("middle")}>↕ Middle</MenuItem>
                  <MenuItem onClick={() => alignSelected("bottom")}>⇣ Bottom</MenuItem>
                </HeaderMenu>
                <HeaderMenu label="Arrange ▾" title="Arrange selected blocks">
                  <MenuItem onClick={() => arrangeSelected("horizontal")}>⟷ In a row</MenuItem>
                  <MenuItem onClick={() => arrangeSelected("vertical")}>⟺ In a column</MenuItem>
                  <MenuDivider />
                  <MenuItem onClick={() => distributeSelected("horizontal")} disabled={multiSelected.length < 3}>Distribute horizontally</MenuItem>
                  <MenuItem onClick={() => distributeSelected("vertical")} disabled={multiSelected.length < 3}>Distribute vertically</MenuItem>
                </HeaderMenu>
                <button onClick={lockSelected} style={{ ...barGhost, display: "inline-flex", alignItems: "center", gap: 6 }} title="Lock selected (prevent drag)"><MarketingIcon name="lock" size={14} /> Lock</button>
                <button onClick={unlockSelected} style={barGhost} title="Unlock selected">🔓 Unlock</button>
                <button onClick={groupSelected} style={barGhost} title="Tag selected as a group">⛓ Group</button>
                <button onClick={ungroupSelected} style={barGhost} title="Remove group tag">Ungroup</button>
                <HeaderMenu label="More ▾" title="More actions" align="right">
                  <MenuItem onClick={duplicateSelected}>⧉ Duplicate</MenuItem>
                  <MenuItem onClick={connectSelectedInSequence}>→ Connect in sequence</MenuItem>
                  <MenuItem onClick={bringForward}>⬆ Bring forward</MenuItem>
                  <MenuItem onClick={sendBackward}>⬇ Send backward</MenuItem>
                  <MenuDivider />
                  <MenuItem onClick={deleteSelected} danger>🗑 Delete</MenuItem>
                </HeaderMenu>
              </div>
            )}
            {nodes.length === 0 && canEdit && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, pointerEvents: "none" }}>
                <div style={{ pointerEvents: "auto", textAlign: "center", background: "var(--surface)", border: "1px dashed var(--border3)", borderRadius: 16, padding: "28px 32px", maxWidth: 320 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>This canvas is empty</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Describe your business and let AI map a starter funnel — or add blocks yourself.</div>
                  <button onClick={() => setAiBuilderOpen(true)} style={{ ...barPrimary, marginBottom: 12, width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}><MarketingIcon name="spark" size={14} /> Build a funnel with AI</button>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => addNode("traffic")} style={barGhost}>+ Traffic source</button>
                    <button onClick={() => addNode("step")} style={barGhost}>+ Page / step</button>
                    <button onClick={() => addNode("offer")} style={barGhost}>+ Offer</button>
                  </div>
                  <button onClick={() => setView("library")} style={{ ...barGhost, marginTop: 10, border: "none", textDecoration: "underline" }}>{"← Back to project library"}</button>
                </div>
              </div>
            )}
            <MiniMap pannable zoomable style={{ background: "var(--surface)" }} />
          </ReactFlow>
          )}
        </div>

        {!inspectorOpen && (
          <button onClick={() => setInspectorOpen(true)} title="Show inspector"
            style={{ ...barGhost, alignSelf: "flex-start", margin: 8 }}>{"Inspector \u25c0"}</button>
        )}
        {inspectorOpen && (
        <div data-tour="inspector" style={{ width: inspectorWidth, flexShrink: 0, borderLeft: "1px solid var(--glass-border)", padding: 16, paddingTop: 0, overflowY: "auto", position: "relative", background: "var(--glass-bg)", backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)" }}>
          <div onMouseDown={startResize} title="Drag to resize" style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft, rgba(10,158,110,0.18))")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")} />
          {/* Sticky frosted header so the panel title stays legible while its
              contents scroll — matches the floating-panel glass elsewhere. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5, margin: "0 -16px 12px", padding: "12px 16px", background: "var(--glass-bg)", backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)", borderBottom: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: 13, letterSpacing: 0.6, color: "var(--muted)" }}>
              {mode === "model" ? "MODEL CENTRE" : mode === "plan" ? "NODE EDITOR (PLAN)" : mode === "actual" ? "OBSERVED (ACTUAL)" : mode === "variance" ? "REVIEW \u00b7 PROFIT LEAKS (RANKED)" : mode === "calibrate" ? "CALIBRATION (PROPOSE \u2192 APPLY)" : mode === "scenarios" ? "SAVED SCENARIOS" : mode === "solve" ? "GOAL SOLVER" : mode === "simulate" ? "TEST A FIX \u00b7 CANDIDATE vs BASELINE" : "DECISION LOG"}
            </div>
            <button onClick={() => setInspectorOpen(false)} title="Hide inspector" style={{ ...barGhost, padding: "2px 7px", fontSize: 11 }}>{"\u25b6"}</button>
          </div>
          {mode === "variance" && (
            <button onClick={() => setMode("report")} style={{ ...barGhost, marginBottom: 12, width: "100%", justifyContent: "center", display: "flex" }}>
              {"\ud83d\udcca View full scoreboard \u2192"}
            </button>
          )}
          {mode === "decide" && (
            <button onClick={() => setMode("calibrate")} style={{ ...barGhost, marginBottom: 12, width: "100%", justifyContent: "center", display: "flex" }}>
              {"\u21ba Apply to plan (calibrate) \u2192"}
            </button>
          )}
          {selected && canEdit && selected.type !== "annot" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>BLOCK SIZE</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{(() => { const w = Math.round(((selected.data as RFNodeData).w as number) ?? 182); return `${w} \u00d7 ${cardH(w)} \u00b7 drag corner`; })()}</div>
              </div>
              <button onClick={() => setNodeWidth(selected.id, ((((selected.data as RFNodeData).w as number) ?? 182) - 20))} style={barGhost} title="Smaller">{"\u2212"}</button>
              <button onClick={() => setNodeWidth(selected.id, 182)} style={barGhost} title="Reset to standard">Std</button>
              <button onClick={() => setNodeWidth(selected.id, ((((selected.data as RFNodeData).w as number) ?? 182) + 20))} style={barGhost} title="Bigger">+</button>
              <button onClick={() => deleteNode(selected.id)} style={{ ...barGhost, color: "#e11d48", borderColor: "var(--ds-danger-soft)" }} title="Delete this block">{"\ud83d\uddd1"}</button>
            </div>
          )}
          {selected && canEdit && selected.type !== "annot" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>ICON</span>
              <select aria-label="Block icon" value={(((selected.data as RFNodeData).brand as string) ?? "")} onChange={(e) => patch(selected.id, { brand: e.target.value || undefined } as Partial<RFNodeData>)}
                style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}>
                <option value="">Auto (from name)</option>
                {Object.entries(BRAND_BY_KEY).map(([k, b]) => <option key={k} value={k}>{b.glyph}  {b.name}</option>)}
              </select>
            </div>
          )}
          {selected && canEdit && selected.type !== "annot" && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>NOTE</span>
              <textarea
                value={String((((selected.data as RFNodeData).ui as Record<string, unknown> | undefined)?.note as string) ?? "")}
                onChange={(e) => {
                  const ui = { ...(((selected.data as RFNodeData).ui as Record<string, string | number | boolean>) ?? {}) };
                  if (e.target.value) ui.note = e.target.value; else delete ui.note;
                  patch(selected.id, { ui } as Partial<RFNodeData>);
                }}
                placeholder="Page copy, offer notes, tracking URL, why this rate…"
                style={{ width: "100%", minHeight: 56, marginTop: 3, boxSizing: "border-box", resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 12, lineHeight: 1.4, fontFamily: "inherit" }} />
              {isAuditablePage((selected.data as RFNodeData).kind) && (
                <button onClick={() => { setLandingAuditNodeId(selected.id); setLandingAuditOpen(true); }}
                  style={{ ...barGhost, marginTop: 6, fontSize: 11.5 }} title="Audit this page against Ryan Deiss landing-page principles (your AI)">
                  🔍 Audit this page
                </button>
              )}
              {(() => {
                const d = selected.data as RFNodeData;
                const b = benchmarkFor(d.kind, d.passRate ?? d.conversionRate ?? d.yesRate);
                if (!b) return null;
                const tone = b.band === "below" ? "var(--bad-text)" : b.band === "above" ? "var(--warn-text)" : "var(--good-border)";
                return (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
                    <span style={{ color: tone, fontWeight: 700 }}>{b.band === "below" ? "▼ Below benchmark" : b.band === "above" ? "▲ Above benchmark" : "● On benchmark"}</span>
                    <span> — {b.message}</span>
                  </div>
                );
              })()}
            </div>
          )}
          {selected && selected.type !== "annot" && funnel && (mode === "plan" || mode === "actual") && (() => {
            const step = exploreStep(funnel, selected.id);
            return (
              <div style={{ marginBottom: 12, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500, marginBottom: 6 }}>STEP EXPLORER</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>Traffic feeding this: </span>
                  {step.upstreamTrafficSources.length === 0 ? <span style={{ color: "var(--dim)" }}>none (this is a source)</span> : step.upstreamTrafficSources.map((id) => labelOf[id] ?? id).join(", ")}
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--muted)" }}>Offers reachable: </span>
                  {step.downstreamOffers.length === 0 ? <span style={{ color: "var(--dim)" }}>none downstream</span> : step.downstreamOffers.map((id) => labelOf[id] ?? id).join(", ")}
                </div>
              </div>
            );
          })()}
          {selected && (mode === "plan" || mode === "actual") && ((selected.data as RFNodeData).kind === "step" || (selected.data as RFNodeData).kind === "offer") && (() => {
            const d = selected.data as RFNodeData;
            const kind = d.kind as "step" | "offer";
            const rate = kind === "step" ? d.passRate : d.conversionRate;
            if (typeof rate !== "number") return null;
            const key = inferBenchmarkKey(d.label ?? "", kind);
            const cmp = compareToBenchmark(rate, key);
            const color = cmp.verdict === "typical" ? "#16a34a" : cmp.verdict === "below" ? "#dc2626" : "#d97706";
            const verdictText = cmp.verdict === "typical" ? "within typical range" : cmp.verdict === "below" ? "below typical" : "above typical (verify it's real)";
            return (
              <div style={{ marginBottom: 12, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500, marginBottom: 6 }}>BENCHMARK</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 3 }}>{cmp.label}: typical {Math.round(cmp.range.low * 100)}–{Math.round(cmp.range.high * 100)}%</div>
                <div style={{ fontSize: 13, fontWeight: 500, color }}>{Math.round(rate * 100)}% — {verdictText}</div>
              </div>
            );
          })()}
          {mode === "model" ? (
            <div style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.6 }}>Every block’s assumptions are editable in the grid. Totals update live in the header as you type.</div>
          ) : mode === "variance" ? (
            <VarianceList variance={variance} labelOf={labelOf} />
          ) : mode === "calibrate" ? (
            <CalibrateList calibration={calibration} labelOf={labelOf} applyProposal={applyProposal} applyAll={applyAllCalib} revert={revertCalib} hasSnapshot={calibSnap !== null} />
          ) : mode === "decide" ? (
            <DecidePanel decisions={decisions} biggestLeakId={variance?.biggestLeak?.nodeId} labelOf={labelOf} onAdd={addDecision} onMeasure={measureDecision} onDelete={deleteDecision} onApprove={approveDecisionAction} onRevokeApproval={revokeApprovalAction} />
          ) : mode === "scenarios" ? (
            <ScenarioBuilder nodes={nodes} scenarios={scenarios} onAdd={addScenario} onDelete={deleteScenario} />
          ) : mode === "simulate" ? (
            <SimulatePanel nodes={nodes} candidate={candidate} setCandidate={setCandidate} comparison={simComparison} patch={patch} onPromote={addDecision} />
          ) : mode === "solve" ? (
            <GoalSolver funnel={funnel} nodes={nodes} patch={patch} />
          ) : selected && selected.type === "annot" ? (
            <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              This is a {(selected.data as AnnotationData).kind === "sticky" ? "sticky note" : "text label"} — edit it directly on the canvas. It&apos;s never part of the simulation.
            </div>
          ) : selected ? (
            mode === "plan"
              ? <InspectorTabs node={selected} tab={inspTab} setTab={setInspTab} patch={patch} patchActual={patchActual} actual={actuals[selected.id] ?? {}} res={sim.ok ? sim.data.nodes[selected.id] : undefined} canEdit={canEdit}
                  blockOps={blockOps} updateBlockOps={updateBlockOps} assumptions={assumptions} experiments={experiments} riskRegister={riskRegister} goals={goals}
                  updateAssumption={updateAssumption} addAssumption={addAssumption} updateExperiment={updateExperiment} addExperiment={addExperiment} updateGoal={updateGoal} addGoal={addGoal} />
              : <ActualEditor node={selected} actual={actuals[selected.id] ?? {}} patchActual={patchActual} />
          ) : (
            <div style={{ color: "var(--dim)", fontSize: 13 }}>Click a block to {mode === "plan" ? "edit its plan numbers" : "enter what actually happened"}.</div>
          )}
          <div style={{ position: "sticky", bottom: -16, marginTop: 16, marginLeft: -16, marginRight: -16, padding: "9px 16px", background: "var(--surface2)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Live model</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: plan && plan.grossProfit >= 0 ? "#16a34a" : "#e11d48" }}>{plan ? money(plan.grossProfit) + " profit" : "\u2014"}</span>
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
}






/**
 * The studio canvas, wrapped in the React Flow provider. Exported (not the
 * default) so the light shell (app/studio-shell.tsx) can lazy-load it with
 * next/dynamic — that's what keeps React Flow, jsPDF, ProgramCentre and every
 * panel out of the signed-out first load. The auth gate lives in the shell.
 */
export function StudioCanvas(props: Parameters<typeof StudioInner>[0]) {
  return <ReactFlowProvider><StudioInner {...props} /></ReactFlowProvider>;
}
