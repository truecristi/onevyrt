"use client";
/**
 * Launch Studio (Command Center) — the guided home that turns a scattered set
 * of tools into ONE path you follow to build momentum to sell. The six stages
 * (Plan → Build → Launch → Convert → Measure → Grow) are the workflow a new
 * business runs; each stage lights up from real signals (a live funnel, first
 * leads, first booked call, spend/CAC), a momentum meter shows how far along
 * you are, and a single "do this next" button pushes you to the very next
 * action. The dashboard (this-week stats + surface tiles) sits below for when
 * you already know where you're going.
 *
 * Integrated motivation & decision flows:
 * - WhyAndCreedSection: Motivational north star
 * - MotivationWidget: Daily reflection streak + checkpoint tracking
 * - MajorDecisionReminder: Pause & reflect before big decisions
 * - NotificationToast: Status/action feedback
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SkeletonStats } from "../../components/Skeleton";
import { MarketingIcon, type MarketingIconName } from "../../components/MarketingIcons";
import { EMPTY_OFFER, parseOfferPrice, type OfferData } from "../../lib/studio/offer-coach";
import { persuasionScore, type PersuasionScore } from "../../lib/studio/persuasion-score";
import { economicsViability, type EconomicsData, type Viability } from "../../lib/studio/economics";
import { executionReadiness } from "../../lib/studio/execution-readiness";
import { computeJourney, type Journey, type JourneySignals } from "../../lib/studio/journey";
import { launchReadiness } from "../../lib/studio/launch-readiness";
import { topRecommendation, fromProgrammeNextAction, fromMomentumNextMove, fromJourneyNextStep, fromReadinessGap } from "../../lib/recommendations";
import { computeMoves, shouldResetBaseline, type Move, type ProgressSnapshot, type ProgressStats } from "../../lib/studio/weekly-moved";
import { scoreWeek, streakLabel, type StreakRecord } from "../../lib/studio/streak";
import StrategyCard from "../../components/StrategyCard";
import type { GoldenExample } from "../../lib/studio/golden-example";
import { loadJourneyInputs } from "../../lib/journey-signals";
import JourneyCelebration from "../../components/JourneyCelebration";
import { CoachMessages } from "../../components/programme/CoachMessages";
import type { MessageInput } from "../../lib/studio/message-copy";
import { EmptyState } from "../../components/ui/EmptyState";
import { CANONICAL_ROUTES } from "../../lib/navigation/canonical-routes";
import { WhyAndCreedSection } from "../../components/dashboard/WhyAndCreedSection";
import type { WhyAndCreedData } from "../../lib/dashboard/why-creed";
import MotivationWidget from "../../components/dashboard/MotivationWidget";
import { MajorDecisionReminder } from "../../components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "../../hooks/useMajorDecisionReminder";

interface Acquisition { hasFunnel: boolean; funnelCount: number; leadsTotal: number; leads7d: number; qualified: number; qualifyRate: number; booked: number; upcoming: number; views: number; cac: number; spend: number; currency: string; }
interface Plan { target: string; constraint: string | null; topDriver: string | null; executionPct: number; execDone: number; execTotal: number; hasPlan: boolean; }
interface NextMove { label: string; href: string; why: string; }
interface Winner { headline: string; reason: string; rate: number; }
interface Payload { acquisition: Acquisition; plan: Plan; nextMove: NextMove; winner?: Winner | null; }
/** The learner's next step on the canonical programme road (engine nextAction),
 *  as returned by /api/programme/enrollment. Drives Home's primary "next move"
 *  so a new learner starts at the beginning of the programme, not a mid-path tool. */
interface ProgrammeAction { currentStageId: string | null; currentLessonId: string | null; currentLessonTitle: string | null; overallPercent: number; ctaLabel: string; ctaHref: string; done: boolean; }
/** Notification toast: brief status updates shown at top of page */
interface NotificationToast { id: string; type: "success" | "info" | "warning" | "error"; title: string; message?: string; duration?: number; }

function money(n: number, ccy: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n); }
  catch { return `${ccy} ${Math.round(n)}`; }
}

const SURFACES: { icon: MarketingIconName; label: string; href: string; tag: string; cur?: boolean }[] = [
  { icon: "home", label: "Dashboard", href: CANONICAL_ROUTES.home, tag: "See", cur: true },
  { icon: "book", label: "Programme", href: CANONICAL_ROUTES.programme, tag: "Start" },
  { icon: "compass", label: "Your Plan", href: CANONICAL_ROUTES.start, tag: "Start" },
  { icon: "message", label: "Message", href: CANONICAL_ROUTES.businessMessage, tag: "Plan" },
  { icon: "plan", label: "Business OS", href: CANONICAL_ROUTES.business, tag: "Plan" },
  { icon: "studio", label: "Studio", href: CANONICAL_ROUTES.studio, tag: "Build" },
  { icon: "funnels", label: "Lead Funnel Builder", href: CANONICAL_ROUTES.businessFunnels, tag: "Build" },
  { icon: "campaigns", label: "Campaign Studio", href: CANONICAL_ROUTES.campaignStudioBrand, tag: "Build" },
  { icon: "leads", label: "Leads Inbox", href: CANONICAL_ROUTES.businessLeads, tag: "Convert" },
  { icon: "audiences", label: "Audiences", href: CANONICAL_ROUTES.businessSegments, tag: "Convert" },
  { icon: "community", label: "Community", href: CANONICAL_ROUTES.community, tag: "Grow" },
  { icon: "book", label: "Glossary", href: CANONICAL_ROUTES.glossary, tag: "Learn" },
];

export default function CommandCenterPage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [msgDone, setMsgDone] = useState(false);
  const [persuasion, setPersuasion] = useState<PersuasionScore | null>(null);
  const [viability, setViability] = useState<Viability | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [whyCreedData, setWhyCreedData] = useState<WhyAndCreedData | null>(null);
  // Set when a price or economics has been touched but not both, so the tile
  // can nudge toward what's missing instead of computing a real (and possibly
  // misleading) score from an untouched half of the picture.
  const [viabilityHint, setViabilityHint] = useState<string | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [signals, setSignals] = useState<JourneySignals | null>(null);
  const [programmeAction, setProgrammeAction] = useState<ProgrammeAction | null>(null);
  // Flips true once the programme-enrollment fetch has settled (success OR
  // failure) so the "next move" card can wait for a stable topMove instead of
  // briefly showing a non-programme move and swapping under the user.
  const [programmeActionReady, setProgrammeActionReady] = useState(false);
  const [moves, setMoves] = useState<{ list: Move[]; since?: string } | null>(null);
  const [streak, setStreak] = useState<StreakRecord | null>(null);
  const [golden, setGolden] = useState<GoldenExample | null>(null);
  const [welcome, setWelcome] = useState(false);
  // Grow nudge: once there's a real result, prompt to share the winner. Sticky-
  // dismissed so it never nags.
  const [growDismissed, setGrowDismissed] = useState(true);

  // Notification toasts: show success/info/warning/error messages at top
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // 90-day checkpoint tracking: check if a checkpoint is due soon
  const [checkpointDue, setCheckpointDue] = useState<{ daysUntil: number; date: Date } | null>(null);

  // Major decision reminder state: shown before high-impact actions
  const decisionReminder = useMajorDecisionReminder({
    debounceMs: 1000,
    sessionOnly: true,
    onApprove: (metadata) => {
      addToast({
        type: "success",
        title: "Decision approved",
        message: `Proceeding with ${metadata.context}`,
        duration: 3000,
      });
    },
    onReflect: (metadata) => {
      addToast({
        type: "info",
        title: "Taking a moment to reflect",
        message: `Paused on ${metadata.context}. Take your time.`,
        duration: 4000,
      });
    },
  });

  // Pending actions detection: count actions that need attention
  const [pendingActions, setPendingActions] = useState<number>(0);

  useEffect(() => { try { setGrowDismissed(localStorage.getItem("ov-grow-nudge-dismissed") === "1"); } catch { /* show by default */ setGrowDismissed(false); } }, []);
  const dismissGrow = () => { setGrowDismissed(true); try { localStorage.setItem("ov-grow-nudge-dismissed", "1"); } catch { /* non-fatal */ } };
  useEffect(() => { try { setWelcome(!localStorage.getItem("ov-seen-studio")); } catch { /* ignore */ } }, []);
  const dismissWelcome = () => { setWelcome(false); try { localStorage.setItem("ov-seen-studio", "1"); } catch { /* ignore */ } };

  // Utility: add a notification toast to the queue
  const addToast = useCallback((toast: Omit<NotificationToast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const withId: NotificationToast = { ...toast, id };
    setToasts((prev) => [...prev, withId]);

    // Auto-dismiss after duration (default 3s)
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  // Utility: dismiss a toast by id
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/command-center", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      setData(await r.json()); setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // The learner's real position on the programme road — the canonical journey.
  // Home's primary "Your next move" starts here (the foundational work at the
  // beginning), so a new learner is never told to jump ahead to a mid-path tool.
  // Fetched on its own so it never blocks or breaks the main dashboard payload.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/programme/enrollment", { credentials: "include" });
        if (!r.ok || !live) return;
        const j = await r.json();
        if (live && j?.nextAction) setProgrammeAction(j.nextAction as ProgrammeAction);
      } catch { /* the programme move is optional — the other moves still lead */ }
      finally { if (live) setProgrammeActionReady(true); }
    })();
    return () => { live = false; };
  }, []);

  // Load the user's Why & Creed motivational statement. This provides the
  // emotional north star on the dashboard — so they see their why every time
  // they log in and feel the energy to work on their business.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/command-center/why-creed", { credentials: "include" });
        if (!r.ok || !live) return;
        const d = await r.json();
        if (live && d) {
          setWhyCreedData(d);
          if (d.workspaceId) setWorkspaceId(d.workspaceId);
        }
      } catch { /* non-critical — why/creed is optional */ }
    })();
    return () => { live = false; };
  }, []);

  // The guided-plan next step / overdue nudge, so the "comeback" reaches the
  // owner on the home they land on — not only if they open Your Plan. Runs once
  // `data` is in and hands it to loadJourneyInputs, so /api/command-center isn't
  // fetched twice on this page's load.
  useEffect(() => {
    if (!data) return;
    (async () => {
      try { const { signals: jsig, state: jstate } = await loadJourneyInputs({ commandCenter: data }); setSignals(jsig); setJourney(computeJourney(jsig, jstate, new Date().toISOString())); }
      catch { /* non-critical */ }
    })();
  }, [data]);

  // "What moved this week": diff a saved weekly baseline against where things
  // stand now. Runs once both the dashboard payload and journey signals are in.
  // Baseline lives in localStorage and rolls forward once a week so the digest
  // shows the whole week's progress, not just since the last page load.
  useEffect(() => {
    if (!data || !signals) return;
    const r = launchReadiness(signals);
    const cur: ProgressStats = {
      readinessDone: r.done,
      leads: data.acquisition.leadsTotal ?? 0,
      booked: data.acquisition.booked ?? 0,
      funnels: data.acquisition.funnelCount ?? 0,
      views: data.acquisition.views ?? 0,
    };
    let prev: ProgressSnapshot | null = null;
    try { const raw = localStorage.getItem("ov-progress-snapshot"); if (raw) prev = JSON.parse(raw) as ProgressSnapshot; } catch { /* ignore */ }
    const nowISO = new Date().toISOString();
    const weekMoves = computeMoves(prev, cur);
    setMoves({ list: weekMoves, since: prev?.at });

    // Read the running streak; show it live.
    let sr: StreakRecord | null = null;
    try { const raw = localStorage.getItem("ov-streak"); if (raw) sr = JSON.parse(raw) as StreakRecord; } catch { /* ignore */ }
    if (shouldResetBaseline(prev, nowISO)) {
      // The week just closed: score it onto the streak (moved = any forward
      // delta over the week that just ended), then roll the baseline forward.
      if (prev) {
        const upd = scoreWeek(sr, weekMoves.length > 0, prev.at);
        sr = upd.record;
        try { localStorage.setItem("ov-streak", JSON.stringify(sr)); } catch { /* ignore */ }
        // Persist to the durable server copy so the run survives a browser
        // clear, a new device, and a restore. Fire-and-forget; localStorage is
        // the working copy. The server merge never lowers the all-time best.
        void fetch("/api/business/streak", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(sr) }).catch(() => {});
      }
      try { localStorage.setItem("ov-progress-snapshot", JSON.stringify({ at: nowISO, ...cur })); } catch { /* ignore */ }
    }
    setStreak(sr);
  }, [data, signals]);

  // Hydrate the streak from the durable server copy on mount, so a fresh device,
  // a cleared browser, or a restore shows the real run instead of starting cold.
  // Adopt the server value only when this device has nothing or is behind it, so
  // an in-progress local run is never clobbered by a stale server read.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/business/streak", { credentials: "include" });
        if (!r.ok || !live) return;
        const server = (await r.json()) as StreakRecord;
        if (!live || !server || typeof server.weeks !== "number" || (server.weeks <= 0 && server.best <= 0)) return;
        let local: StreakRecord | null = null;
        try { const raw = localStorage.getItem("ov-streak"); if (raw) local = JSON.parse(raw) as StreakRecord; } catch { /* ignore */ }
        const behind = !local || server.best > (local.best ?? 0) || server.weeks > (local.weeks ?? 0);
        if (!behind) return;
        try { localStorage.setItem("ov-streak", JSON.stringify(server)); } catch { /* ignore */ }
        setStreak(server);
      } catch { /* offline — keep the local copy */ }
    })();
    return () => { live = false; };
  }, []);

  // Compute 90-day checkpoint: if user has completed a chapter, show when next check-in is due
  useEffect(() => {
    if (!programmeAction || !programmeAction.done) return;
    try {
      const lastCheckpointStr = localStorage.getItem("ov-90day-checkpoint");
      const lastCheckpoint = lastCheckpointStr ? new Date(lastCheckpointStr) : null;
      const now = new Date();
      const nextCheckpoint = lastCheckpoint ? new Date(lastCheckpoint.getTime() + 90 * 24 * 60 * 60 * 1000) : now;
      const daysUntil = Math.ceil((nextCheckpoint.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= 0) {
        setCheckpointDue({ daysUntil: 0, date: nextCheckpoint });
        addToast({ type: "info", title: "Your 90-day checkpoint is due", message: "Review your progress and plan your next steps", duration: 5000 });
      } else if (daysUntil <= 7) {
        setCheckpointDue({ daysUntil, date: nextCheckpoint });
      }
    } catch { /* non-critical */ }
  }, [programmeAction, addToast]);

  // Detect pending actions: count items needing attention (overdue steps, pending submissions, etc.)
  useEffect(() => {
    let pending = 0;
    if (journey?.overdueCount && journey.overdueCount > 0) pending += journey.overdueCount;
    if (data?.winner) pending += 1; // Winner to scale
    if (!msgDone && data?.acquisition.leadsTotal === 0) pending += 1; // Message not done yet
    setPendingActions(pending);
  }, [journey, data, msgDone]);

  // The Message stage lights up once the one-liner is complete, and the
  // Psychology card shows a live persuasion score (Message + Offer +
  // Presentation). Fetched separately so it never blocks or breaks the main
  // dashboard payload.
  useEffect(() => {
    (async () => {
      let message: MessageInput | null = null;
      let offer: OfferData | null = null;
      let economics: EconomicsData | null = null;
      let presentationChecked: string[] = [];
      try {
        const [rm, ro, re, rp] = await Promise.all([
          fetch("/api/business/message", { credentials: "include" }),
          fetch("/api/business/offer", { credentials: "include" }),
          fetch("/api/business/economics", { credentials: "include" }),
          fetch("/api/business/presentation", { credentials: "include" }),
        ]);
        if (rm.ok) message = (await rm.json()) as MessageInput;
        if (ro.ok) offer = { ...EMPTY_OFFER, ...(await ro.json()) };
        if (re.ok) economics = (await re.json()) as EconomicsData;
        if (rp.ok) { const arr = (await rp.json())?.checked; if (Array.isArray(arr)) presentationChecked = arr.filter((x: unknown) => typeof x === "string"); }
      } catch { /* non-critical */ }
      if (presentationChecked.length === 0) {
        try { const raw = localStorage.getItem("ov-presentation-checked"); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) presentationChecked = arr.filter((x) => typeof x === "string"); } } catch { /* ignore */ }
      }
      const o = (message?.oneLiner ?? {}) as { problem?: string; solution?: string; result?: string };
      setMsgDone(!!(o.problem?.trim() && o.solution?.trim() && o.result?.trim()));
      setPersuasion(persuasionScore({ message, offer, presentationChecked }));
      try {
        const rg = await fetch("/api/business/golden-example", { credentials: "include" });
        if (rg.ok) { const g = await rg.json(); if (g && Array.isArray(g.ladder) && g.ladder.length) setGolden(g as GoldenExample); }
      } catch { /* strategy card is optional */ }
      if (economics) {
        const price = parseOfferPrice(offer?.price);
        // getEconomics only stamps updatedAt once a workspace has actually
        // saved a record — an untouched economics record (all zeros) has none.
        // A real score needs both a real price and a real saved economics
        // record; either alone would be computing from an unset half as if it
        // were a deliberate zero (see PR #96's fix on the Numbers hub for the
        // same issue).
        const econReal = typeof economics.updatedAt === "string";
        const priceSet = price > 0;
        if (priceSet && econReal) setViability(economicsViability(economics, price));
        else if (priceSet || econReal) setViabilityHint(priceSet ? "Add your costs" : "Set your price");
      }
    })();
  }, []);

  if (state === "loading") return <Shell><SkeletonStats n={4} /></Shell>;
  if (state === "not-authenticated") return <Shell><EmptyState icon="lock" title="Please sign in" action={<a className="btn primary" href="/">Go to sign in</a>} /></Shell>;
  if (state === "error" || !data) return <Shell><EmptyState icon="warning" title="Couldn&rsquo;t load your dashboard" action={<button className="btn" onClick={() => void load()}>Retry</button>} /></Shell>;

  const { acquisition: a, plan: p, nextMove } = data;
  const readiness = signals ? launchReadiness(signals) : null;

  // ONE next move. This page used to show three "Do this next" answers at once
  // (the guided-plan step, the momentum engine's pick, and the readiness gaps),
  // which could disagree. Rank them all through the shared prioritiser and let
  // the winner be the single authoritative call-to-action at the top; the plan
  // entry and momentum stage below are reframed as context, not rival commands.
  // The programme road leads: a learner's real next step on the ONEVYRT
  // programme (foundational identity work first) is THE journey, so it outranks
  // the selling-machine moves until every chapter is complete.
  const topMove = topRecommendation([
    fromProgrammeNextAction(programmeAction),
    fromMomentumNextMove(nextMove),
    fromJourneyNextStep(journey?.nextStep ?? null, { overdueCount: journey?.overdueCount ?? 0 }),
    fromReadinessGap(readiness?.gaps?.[0] ?? null),
  ]);

  // The workflow as stages, each lit by a real signal. This is the momentum path.
  const stages: { key: string; name: string; icon: MarketingIconName; blurb: string; done: boolean; href: string; cta: string; stat?: string }[] = [
    { key: "message", name: "Message", icon: "spark", blurb: "Nail your one-liner so customers instantly get why you matter.", done: msgDone, href: CANONICAL_ROUTES.businessMessage, cta: "Write your one-liner", stat: msgDone ? "One-liner ready" : undefined },
    { key: "plan", name: "Plan", icon: "plan", blurb: "Model the offer & economics — know it can sell before you spend.", done: p.hasPlan || !!p.constraint || !!p.target, href: CANONICAL_ROUTES.business, cta: "Open Business OS", stat: p.constraint ? `Constraint: ${p.constraint}` : (p.target ? "Target set" : undefined) },
    { key: "build", name: "Build", icon: "studio", blurb: "Map the funnel and publish your live qualification funnel.", done: a.hasFunnel, href: CANONICAL_ROUTES.businessFunnels, cta: "Build a funnel", stat: a.hasFunnel ? `${a.funnelCount} funnel${a.funnelCount === 1 ? "" : "s"} live` : undefined },
    { key: "launch", name: "Launch", icon: "rocket", blurb: "Craft the creative and drive traffic to your funnel.", done: a.views > 0 || a.spend > 0, href: CANONICAL_ROUTES.campaignStudioBrand, cta: "Open Campaign Studio", stat: a.views > 0 ? `${a.views} funnel visit${a.views === 1 ? "" : "s"}` : undefined },
    { key: "convert", name: "Convert", icon: "leads", blurb: "Turn leads into booked calls, then broadcast to your audiences.", done: a.booked > 0, href: CANONICAL_ROUTES.businessLeads, cta: "Open Leads", stat: a.leadsTotal > 0 ? `${a.leadsTotal} lead${a.leadsTotal === 1 ? "" : "s"} · ${a.booked} booked` : undefined },
    { key: "measure", name: "Measure", icon: "insights", blurb: "Watch cost per qualified lead and fix the weakest step.", done: a.spend > 0, href: "/command-center/insights", cta: "Open Insights", stat: a.spend > 0 && a.qualified > 0 ? `${money(a.cac, a.currency)} per qualified` : undefined },
    { key: "grow", name: "Grow", icon: "community", blurb: "Share a winning funnel and swipe proven ones from others.", done: false, href: CANONICAL_ROUTES.community, cta: "Open Community" },
  ];
  // Grow is an ongoing habit, not a step you "finish" — so momentum is measured
  // across the six actionable stages (Message → Measure). This avoids the meter
  // getting stuck at 86% once everything real is done.
  const core = stages.filter((s) => s.key !== "grow");
  const doneCount = core.filter((s) => s.done).length;
  const momentum = Math.round((doneCount / core.length) * 100);
  const activeKey = core.find((s) => !s.done)?.key ?? null;
  const activeStage = activeKey ? stages.find((s) => s.key === activeKey) ?? null : null;
  const headline = momentum >= 100
    ? "You've built the machine — now compound it."
    : momentum >= 66 ? "Great momentum. Keep the loop turning."
    : momentum >= 33 ? "You're building momentum — keep going."
    : "Let's build your selling machine, one step at a time.";

  return (
    <Shell>
      {/* Notification toasts: show at top-right, auto-dismiss */}
      <div className="cc-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>

      {/* Major decision reminder: shown when pending actions exist */}
      {pendingActions > 0 && whyCreedData && (
        <MajorDecisionReminder
          isOpen={decisionReminder.isOpen}
          onApprove={decisionReminder.handleApprove}
          onReflect={decisionReminder.handleReflect}
          whyAndCreedData={whyCreedData}
          decisionContext={{
            title: `${pendingActions} action${pendingActions === 1 ? "" : "s"} pending`,
            description: "Take a moment to align your decisions with your purpose before moving forward",
            icon: <div className="text-2xl">⚡</div>,
          }}
        />
      )}

      <div className="cc-header">
        <div>
          <div className="eyebrow">ONEVYRT · Dashboard</div>
          <h1>Build momentum to sell</h1>
          <p className="cc-sub">Your daily home base. Do the one next move at the top, and watch each stage light up on its own as your business comes together.</p>
        </div>
        <a href={CANONICAL_ROUTES.studio} className="btn ghost"><MarketingIcon name="studio" size={16} /> Studio</a>
      </div>

      {/* Your Why & Creed — the emotional north star. Displayed prominently
          so every login reminds you why you're building, and every action
          flows from that purpose. */}
      {workspaceId && (
        <WhyAndCreedSection
          workspaceId={workspaceId}
          data={whyCreedData}
          onUpdate={setWhyCreedData}
        />
      )}

      {/* Daily reflection & motivation widget. Tracks your consistency and
          shows the next 90-day checkpoint. Appears below Why & Creed to keep
          the momentum energy visible. */}
      {workspaceId && (
        <MotivationWidget />
      )}

      {/* 90-day checkpoint reminder: shown when due within 7 days */}
      {checkpointDue && checkpointDue.daysUntil <= 7 && (
        <div className={`cc-checkpoint-reminder ${checkpointDue.daysUntil === 0 ? "cc-checkpoint-due" : ""}`}>
          <div className="checkpoint-icon">📊</div>
          <div className="checkpoint-content">
            <div className="checkpoint-title">
              {checkpointDue.daysUntil === 0
                ? "Your 90-day checkpoint is due today"
                : `Your 90-day checkpoint is due in ${checkpointDue.daysUntil} day${checkpointDue.daysUntil === 1 ? "" : "s"}`}
            </div>
            <div className="checkpoint-text">Review your growth, celebrate wins, and plan your next moves.</div>
          </div>
          <a href={CANONICAL_ROUTES.accountTransformationReport} className="checkpoint-cta">Review progress →</a>
        </div>
      )}

      <JourneyCelebration journey={journey} />

      {/* A coach/mentor's "reach out" note, shown to the learner when they come
          back. Renders nothing when there's nothing unread. */}
      <CoachMessages />

      {/* The single authoritative next move (shared prioritiser). Everything
          below is context — the plan entry, the readiness ring, the momentum
          stage — none of which claims "do this next" any more. */}
      {!programmeActionReady ? (
        <div className="nextmove nextmove-skel" aria-hidden="true">
          <span className="nm-ic" />
          <span className="nm-txt">
            <span className="nm-skel-bar nm-skel-bar-tag" />
            <span className="nm-skel-bar nm-skel-bar-title" />
          </span>
        </div>
      ) : topMove && (
        <a className="nextmove" href={topMove.href}>
          <span className="nm-ic"><MarketingIcon name="spark" size={20} /></span>
          <span className="nm-txt">
            <span className="nm-tag">Your next move</span>
            <b className="nm-title">{topMove.title}</b>
            {topMove.why && <span className="nm-why">{topMove.why}</span>}
          </span>
          <span className="nm-go">{topMove.cta || "Go"} →</span>
        </a>
      )}

      <a className="plan-cta" href={CANONICAL_ROUTES.start}>
        <span className="plan-ic"><MarketingIcon name="compass" size={20} /></span>
        <span className="plan-txt">
          {journey && journey.finished ? (
            <><b>🎉 Your plan is complete</b><span>You&rsquo;ve done the whole setup — you&rsquo;re selling. Revisit any step to sharpen it.</span></>
          ) : journey ? (
            <><b>Your step-by-step plan</b>
              <span>{journey.done}/{journey.total} done · {journey.overdueCount > 0 ? `${journey.overdueCount} step${journey.overdueCount === 1 ? "" : "s"} past their date` : "you're on track — keep going"}.</span></>
          ) : (
            <><b>Your step-by-step plan</b><span>The whole path from here to your first booked call — with dates, in order.</span></>
          )}
        </span>
        <span className="plan-go">Open your plan →</span>
      </a>

      {readiness && (
        <div className={`lr ${readiness.ready ? "lr-ready" : ""}`}>
          <div className="lr-top">
            <div className="lr-ring" title="Launch checklist" style={{ ["--lr-pct" as string]: `${readiness.score}%` }}>
              <span className="lr-ring-n">{readiness.done}<i>/{readiness.total}</i></span>
            </div>
            <div className="lr-head">
              <div className="lr-k">Ready to sell? <span className="lr-stage">{readiness.stage}</span></div>
              <div className="lr-headline">{readiness.headline}</div>
            </div>
          </div>
          {readiness.gaps.length > 0 && (
            <div className="lr-gaps">
              {readiness.gaps.map((g) => (
                <a className="lr-gap" href={g.href} key={g.key}>
                  <span className="lr-gap-area">{g.area}</span>
                  <span className="lr-gap-label">{g.label}</span>
                  <span className="lr-gap-cta">{g.cta} →</span>
                </a>
              ))}
            </div>
          )}
          {readiness.ready && (
            <div className="lr-go">
              <a className="lr-go-btn primary" href="/psychology/kit">Open your Sales Kit — copy &amp; go live →</a>
              <a className="lr-go-btn" href={CANONICAL_ROUTES.businessFunnels}>Drive traffic to your funnel</a>
            </div>
          )}
        </div>
      )}

      {moves && moves.list.length > 0 && (
        <div className="moved">
          <div className="moved-head">
            <div className="moved-k">✨ What moved{moves.since ? ` since ${new Date(moves.since).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : " this week"}</div>
            {streak && streak.weeks > 0 && <span className="moved-streak" title={streak.best > streak.weeks ? `Best: ${streak.best} weeks` : "Your best run yet"}>🔥 {streakLabel(streak)}</span>}
          </div>
          <div className="moved-list">
            {moves.list.map((m) => (
              <span className={`moved-chip ${m.tone}`} key={m.key}>{m.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Grow: when the ad data shows a clear winning creative, point straight at
          scaling it. Only appears once detectCreativeWinner is confident (enough
          leads, a real margin) — so it's a signal, not noise. */}
      {data.winner && (
        <a className="grow-nudge winner-nudge" href={CANONICAL_ROUTES.campaignStudioCreative}>
          <span className="grow-ic">📈</span>
          <span className="grow-txt">
            <b>You have a winning ad.</b>
            <span>{data.winner.reason}</span>
          </span>
          <span className="grow-go">Scale it →</span>
        </a>
      )}

      {/* Grow: once a funnel is actually booking calls, nudge to share the win. */}
      {!growDismissed && a.booked > 0 && (
        <a className="grow-nudge" href={CANONICAL_ROUTES.community}>
          <span className="grow-ic">🏆</span>
          <span className="grow-txt">
            <b>You've got a winner — {a.booked} booked call{a.booked === 1 ? "" : "s"}.</b>
            <span>Share your funnel in the Community swipe file — help others and get your work seen.</span>
          </span>
          <span className="grow-go">Share it →</span>
          <button className="grow-x" onClick={(e) => { e.preventDefault(); dismissGrow(); }} aria-label="Dismiss">✕</button>
        </a>
      )}

      {/* Streak still shows on a quiet week, so the run stays visible. */}
      {moves && moves.list.length === 0 && streak && streak.weeks > 0 && (
        <div className="moved moved-quiet">
          <span className="moved-streak">🔥 {streakLabel(streak)}</span>
          <span className="moved-quiet-t">Keep it alive — take one action this week.</span>
        </div>
      )}

      {golden && <StrategyCard example={golden} />}

      {welcome && (
        <div className="welcome">
          <button className="welcome-x" onClick={dismissWelcome} aria-label="Dismiss">✕</button>
          <div className="welcome-tag">Welcome to your Dashboard</div>
          <div className="welcome-h">Not sure where to start? You don&rsquo;t have to guess.</div>
          <p className="welcome-p">The <b>programme</b> walks you from Uncertainty to Freedom, one module at a time — it&rsquo;s the spine of everything here. Follow it and you can&rsquo;t get lost.</p>
          <a className="welcome-cta" href={CANONICAL_ROUTES.programme} onClick={dismissWelcome}>Open the programme →</a>
        </div>
      )}

      {/* Momentum + the single next action */}
      <div className="momentum">
        <div className="m-top">
          <div className="m-lead">
            <div className="m-pct">{momentum}%</div>
            <div className="m-head">{headline}</div>
          </div>
          <div className="m-count">{doneCount}<span>/{core.length} stages</span></div>
        </div>
        <div className="m-track"><span style={{ width: `${momentum}%` }} /></div>
        {activeStage
          ? <a className="m-next" href={nextMove.href || activeStage.href}>
              <div className="mn-tag">Your current stage · {activeStage.name}</div>
              <div className="mn-label">{nextMove.label} <span className="mn-arrow">→</span></div>
              <div className="mn-why">{nextMove.why}</div>
            </a>
          : <a className="m-next" href={CANONICAL_ROUTES.community}>
              <div className="mn-tag">You're set up</div>
              <div className="mn-label">Compound it in Community <span className="mn-arrow">→</span></div>
              <div className="mn-why">The machine is built. Share your winning funnel and swipe proven ones to keep growing.</div>
            </a>}
      </div>

      {/* The three pillars — Psychology first */}
      <div className="sec-head">
        <h2 className="sec-title">Your business, in three layers</h2>
        <p className="sec-sub">Psychology, Numbers, and Execution. Get how you sell right first, prove the maths, then make it run.</p>
      </div>
      <div className="pillars3">
        <a className="p3 p3-psych" href="/psychology">
          <div className="p3-badge">Start here</div>
          {persuasion && persuasion.score > 0 && (
            <div className="p3-score" title="Persuasion score — Message + Offer + Presentation">
              <span className="p3-score-n">{persuasion.score}</span>
              <span className="p3-score-l">{persuasion.stage}</span>
            </div>
          )}
          <span className="p3-ic"><MarketingIcon name="message" size={22} /></span>
          <div className="p3-name">Psychology</div>
          <div className="p3-desc">How you sell &amp; present — why people buy. Get this right first; the rest has something worth scaling.</div>
          <div className="p3-go">Open the psychology pillar →</div>
        </a>
        <div className="p3-rail">
          <a className="p3 p3-sm p3-num" href="/numbers">
            <span className="p3-ic-sm"><MarketingIcon name="insights" size={18} /></span>
            <div><div className="p3-name">Numbers</div><div className="p3-desc">Does it work? Break-even, funnel math, insights.</div></div>
            {viability ? (
              <span className={`p3-badge-sm ${viability.viable ? (viability.score >= 60 ? "good" : viability.score >= 40 ? "ok" : "warn") : "bad"}`}>
                {viability.viable ? `${viability.score} · ${viability.stage}` : "Not viable"}
              </span>
            ) : viabilityHint ? (
              <span className="p3-badge-sm none">{viabilityHint}</span>
            ) : null}
          </a>
          <a className="p3 p3-sm p3-exec" href="/execution">
            <span className="p3-ic-sm"><MarketingIcon name="rocket" size={18} /></span>
            <div><div className="p3-name">Execution</div><div className="p3-desc">Make it run — funnels, leads, campaigns.</div></div>
            {data && (() => { const e = executionReadiness(data.acquisition); return (
              <span className={`p3-badge-sm ${e.score >= 75 ? "exec-good" : e.score >= 25 ? "exec-warn" : "exec-none"}`} title="Execution score">{e.score} · {e.stage}</span>
            ); })()}
          </a>
        </div>
      </div>

      {/* The journey — follow the steps */}
      <div className="sec-head">
        <h2 className="sec-title">Your path to selling</h2>
        <p className="sec-sub">Six stages from message to measurement. Each ticks itself off the moment a real signal proves it&rsquo;s done &mdash; nothing to check by hand.</p>
      </div>
      <div className="journey">
        {stages.map((s) => {
          const status = s.key === "grow" ? "ongoing" : s.done ? "done" : s.key === activeKey ? "active" : "upcoming";
          const pill = status === "done" ? "Done" : status === "active" ? "Do next" : status === "ongoing" ? "Ongoing" : "Upcoming";
          return (
            <a key={s.key} className={`stage ${status}`} href={s.href}>
              <div className="stage-rail"><span className="stage-badge">{s.done ? <MarketingIcon name="check" size={16} /> : <MarketingIcon name={s.icon} size={16} />}</span></div>
              <div className="stage-body">
                <div className="stage-top">
                  <span className="stage-name">{s.name}</span>
                  <span className={`stage-pill ${status}`}>{pill}</span>
                </div>
                <div className="stage-blurb">{s.blurb}</div>
                {s.stat && <div className="stage-stat">{s.stat}</div>}
                {status !== "done" && <div className="stage-cta">{s.cta} →</div>}
              </div>
            </a>
          );
        })}
      </div>

      {/* This week — acquisition hero stats */}
      <div className="sec-head">
        <h2 className="sec-title">This week</h2>
        <p className="sec-sub">Your last 7 days &mdash; proof that traffic is turning into leads, and leads into booked calls.</p>
      </div>
      <div className="stats">
        <div className={`stat s-leads${a.leads7d > 0 ? "" : " is-zero"}`}><div className="stat-n">{a.leads7d}</div><div className="stat-l">new leads</div></div>
        <div className={`stat s-qual${a.qualified > 0 ? "" : " is-zero"}`}><div className="stat-n">{a.qualified}</div><div className="stat-l">qualified · {Math.round(a.qualifyRate * 100)}%</div></div>
        <div className={`stat s-calls${a.upcoming > 0 ? "" : " is-zero"}`}><div className="stat-n">{a.upcoming}</div><div className="stat-l">calls upcoming</div></div>
        <div className={`stat s-cost${a.spend > 0 && a.qualified > 0 ? "" : " is-zero"}`}><div className="stat-n">{a.spend > 0 && a.qualified > 0 ? money(a.cac, a.currency) : "—"}</div><div className="stat-l">cost / qualified</div></div>
      </div>
      {a.leadsTotal === 0 && (
        <p className="stats-empty">{a.views > 0
          ? "Traffic is arriving but no leads captured yet — check your funnel has a clear, working opt-in."
          : "No leads yet — publish a funnel and send it traffic, and your first leads and calls will appear here."}</p>
      )}

      <div className="cards">
        {/* Psychology — the "start here" pillar; a summary card so all three
            layers (sell / plan / acquire) have an at-a-glance card here, not
            just the two that point into Business OS. */}
        <a className="card" href="/psychology">
          <div className="card-h"><MarketingIcon name="message" size={17} /> Psychology <span className="card-open">Open →</span></div>
          {persuasion && persuasion.score > 0
            ? <ul className="facts">
                <li>Persuasion score: <b>{persuasion.score}</b> · {persuasion.stage}</li>
                <li>Message <b>{persuasion.parts.message}</b> · Offer <b>{persuasion.parts.offer}</b> · Presentation <b>{persuasion.parts.presentation}</b></li>
              </ul>
            : <div className="empty">Sharpen how you sell — your Message, Offer &amp; Presentation. Start here.</div>}
        </a>

        {/* Numbers — does it work? break-even viability + the plan behind it. */}
        <a className="card" href="/numbers">
          <div className="card-h"><MarketingIcon name="insights" size={17} /> Numbers <span className="card-open">Open →</span></div>
          {viability || p.hasPlan
            ? <ul className="facts">
                {viability && <li>Viability: <b>{viability.viable ? viability.score : "Not viable"}</b>{viability.viable ? ` · ${viability.stage}` : ""}</li>}
                {p.constraint && <li>Constraint: <b>{p.constraint}</b></li>}
                {p.target && <li>Target: <b>{p.target}</b></li>}
                {p.hasPlan && <li>Execution: <b>{p.executionPct}%</b>{p.execTotal > 0 ? ` (${p.execDone}/${p.execTotal})` : ""}</li>}
              </ul>
            : <div className="empty">Model break-even &amp; your plan — know it can sell before you spend.</div>}
        </a>

        {/* Execution — make it run: funnels, leads, campaigns. */}
        <a className="card" href="/execution">
          <div className="card-h"><MarketingIcon name="rocket" size={17} /> Execution <span className="card-open">Open →</span></div>
          {a.hasFunnel
            ? <ul className="facts">
                <li><b>{a.funnelCount}</b> funnel{a.funnelCount === 1 ? "" : "s"} live</li>
                <li><b>{a.leadsTotal}</b> leads all-time · <b>{a.booked}</b> booked</li>
                <li><b>{a.views}</b> funnel visits tracked</li>
              </ul>
            : <div className="empty">No funnel yet — build one to start capturing leads.</div>}
        </a>
      </div>

      {/* Jump anywhere */}
      <div className="sec-head">
        <h2 className="sec-title">Jump anywhere</h2>
        <p className="sec-sub">Every workspace in one place. The tag on each tile shows which part of the journey it belongs to.</p>
      </div>
      <div className="nav-tiles">
        {SURFACES.map((s) => (
          <a key={s.label} className={`tile ${s.cur ? "cur" : ""}`} href={s.href}>
            <span className="tile-ic"><MarketingIcon name={s.icon} size={20} /></span>
            <span className="tile-label">{s.label}</span>
            <span className="tile-tag">{s.tag}</span>
          </a>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="cc-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.cc-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-muted-soft:#f1f5f9;
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .cc-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-muted-soft:#1a2234;
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.cc-root *{box-sizing:border-box;}
.cc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.cc-header h1{font-size:27px;font-weight:700;margin:2px 0 0;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.cc-sub{font-size:13.5px;color:var(--ds-text-secondary);line-height:1.5;margin:7px 0 0;max-width:54ch;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:200px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:48px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}

/* The single next move — the one prominent green CTA on the page. */
.nextmove{display:flex;align-items:center;gap:14px;text-decoration:none;background:linear-gradient(135deg,var(--ds-brand),#0bb87f);color:#fff;border-radius:var(--ds-radius-lg);padding:16px 18px;margin-bottom:14px;box-shadow:0 14px 32px -14px rgba(10,158,110,.55);transition:transform .15s,box-shadow .15s;}
.nextmove:hover{transform:translateY(-2px);box-shadow:0 18px 38px -14px rgba(10,158,110,.65);}
.nextmove:focus-visible{outline:2px solid var(--ds-brand-contrast);outline-offset:3px;}
.nm-ic{flex:0 0 auto;width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.18);display:inline-flex;align-items:center;justify-content:center;}
.nm-ic svg{color:#fff;}
.nm-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.nm-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;opacity:.85;}
.nm-title{font-size:16px;font-weight:700;letter-spacing:-.2px;}
.nm-why{font-size:12.5px;line-height:1.4;opacity:.92;}
.nm-go{flex:0 0 auto;font-size:13px;font-weight:700;white-space:nowrap;transition:transform .15s var(--ds-ease);}
.nextmove:hover .nm-go{transform:translateX(3px);}
@media(max-width:560px){.nextmove{flex-wrap:wrap;}.nm-go{width:100%;}}
.nextmove.nextmove-skel{background:var(--ds-surface-subtle);box-shadow:none;cursor:default;}
.nextmove-skel .nm-ic{background:var(--border-strong);}
.nm-skel-bar{display:block;border-radius:5px;background:var(--border-strong);}
.nm-skel-bar-tag{width:110px;height:8px;margin-bottom:8px;}
.nm-skel-bar-title{width:55%;height:13px;}

/* Plan entry — now a quiet, secondary surface so the next-move hero leads. */
.plan-cta{display:flex;align-items:center;gap:14px;text-decoration:none;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:var(--ds-radius-lg);padding:15px 18px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s,transform .15s;}
.plan-cta:hover{transform:translateY(-1px);border-color:var(--ds-brand);}
.plan-ic{flex:0 0 auto;width:40px;height:40px;border-radius:11px;background:var(--ds-brand-soft);display:inline-flex;align-items:center;justify-content:center;}
.plan-ic svg{color:var(--ds-brand);}
.plan-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.plan-txt b{font-size:15px;font-weight:700;letter-spacing:-.2px;}
.plan-txt span{font-size:12.5px;line-height:1.45;color:var(--muted);}
.plan-go{flex:0 0 auto;font-size:13px;font-weight:700;white-space:nowrap;color:var(--ds-brand);transition:transform .15s var(--ds-ease);}
.plan-cta:hover .plan-go{transform:translateX(3px);}
@media(max-width:560px){.plan-cta{flex-wrap:wrap;}.plan-go{width:100%;}}
.lr{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 18px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);}
.lr-ready{border-color:var(--ds-brand);}
.lr-top{display:flex;align-items:center;gap:15px;}
.lr-ring{position:relative;flex:0 0 auto;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--ds-brand) var(--lr-pct),var(--ds-surface-subtle) 0);}
.lr-ring::before{content:"";position:absolute;width:44px;height:44px;border-radius:50%;background:var(--surface);}
.lr-ring-n{position:relative;font-size:17px;font-weight:700;color:var(--text);letter-spacing:-.5px;}
.lr-ring-n i{font-size:11px;font-weight:700;color:var(--ds-text-tertiary);font-style:normal;}
.lr-head{min-width:0;}
.lr-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.lr-stage{color:var(--ds-brand);}
.lr-headline{font-size:15px;font-weight:700;color:var(--text);line-height:1.4;margin-top:3px;}
.lr-gaps{display:flex;flex-direction:column;gap:7px;margin-top:13px;}
.lr-gap{display:flex;align-items:center;gap:10px;text-decoration:none;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:10px;padding:9px 12px;transition:border-color .15s;}
.lr-gap:hover{border-color:var(--ds-brand);}
/* --ds-brand-hover (not --ds-brand) here: on dark mode's --ds-surface-subtle
   (#334155) the base brand green (#10b981) is only 4.08:1 — fails WCAG AA.
   The hover shade (#14d8a8) clears 4.5:1; same swap already used above for
   .moved-chip.win / .stage-pill for the same reason. */
.lr-gap-area{flex:0 0 auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-brand-hover);min-width:82px;}
.lr-gap-label{flex:1;font-size:13.5px;color:var(--text);line-height:1.4;}
.lr-gap-cta{flex:0 0 auto;font-size:12.5px;font-weight:700;color:var(--ds-brand-hover);white-space:nowrap;}
@media(max-width:520px){.lr-gap{flex-wrap:wrap;}.lr-gap-area{min-width:0;}}
.lr-go{display:flex;flex-wrap:wrap;gap:9px;margin-top:13px;}
.lr-go-btn{text-decoration:none;font-size:13px;font-weight:700;border-radius:10px;padding:9px 14px;border:1px solid var(--border-strong);color:var(--text);background:var(--surface);}
.lr-go-btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.lr-go-btn:hover{border-color:var(--ds-brand);}
.moved{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);}
.moved-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
.moved-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.moved-streak{flex:0 0 auto;font-size:12px;font-weight:700;color:var(--ds-warning);background:var(--ds-warning-soft);border:1px solid var(--ds-warning);border-radius:999px;padding:3px 10px;white-space:nowrap;}
.moved-quiet{display:flex;align-items:center;gap:11px;flex-wrap:wrap;}
.moved-quiet-t{font-size:13px;color:var(--muted);}
.grow-nudge{position:relative;display:flex;align-items:center;gap:13px;text-decoration:none;background:linear-gradient(135deg,var(--ds-warning-soft),var(--surface));border:1px solid var(--ds-warning);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);color:var(--text);transition:transform .15s var(--ds-ease),border-color .15s,box-shadow .15s;}
.grow-nudge:hover{border-color:var(--ds-warning);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
/* The winner nudge is a positive "scale this" signal — brand green, not the amber grow tint. */
.winner-nudge{background:linear-gradient(135deg,var(--ds-brand-soft,#e7f6f0),var(--surface));border-color:var(--ds-brand,#088057);}
.winner-nudge:hover{border-color:var(--ds-brand-hover,#08875e);}
.winner-nudge .grow-go{color:var(--ds-brand,#088057);}
.grow-ic{flex:0 0 auto;font-size:22px;}
.grow-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}
.grow-txt b{font-size:14px;font-weight:700;}
.grow-txt span{font-size:12.5px;color:var(--muted);line-height:1.45;}
.grow-go{flex:0 0 auto;font-size:13px;font-weight:700;color:var(--ds-warning);white-space:nowrap;transition:transform .15s var(--ds-ease);}
.grow-nudge:hover .grow-go{transform:translateX(2px);}
.grow-x{position:absolute;top:8px;right:9px;background:transparent;border:none;color:var(--ds-text-tertiary);font-size:13px;cursor:pointer;line-height:1;padding:2px;border-radius:6px;transition:color .15s,background .15s;}
.grow-x:hover{color:var(--ds-text-secondary);background:var(--ds-bg-subtle);}
.moved-list{display:flex;flex-wrap:wrap;gap:8px;}
.moved-chip{font-size:13px;font-weight:500;line-height:1.3;border-radius:999px;padding:6px 12px;border:1px solid var(--border);}
.moved-chip.win{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-brand-hover);}
.moved-chip.progress{background:var(--ds-surface-subtle);color:var(--muted);}
.welcome{position:relative;background:var(--surface);border:1px solid var(--ds-brand);border-left:4px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:18px 20px;margin-bottom:20px;box-shadow:var(--ds-shadow-md);}
.welcome-x{position:absolute;top:10px;right:12px;background:transparent;border:none;color:var(--ds-text-tertiary);font-size:14px;cursor:pointer;padding:4px;}
.welcome-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-brand);margin-bottom:5px;}
.welcome-h{font-size:18px;font-weight:700;letter-spacing:-.3px;margin-bottom:6px;}
.welcome-p{font-size:13.5px;color:var(--muted);line-height:1.55;margin:0 0 12px;max-width:64ch;}
.welcome-p b{color:var(--text);font-weight:700;}
.welcome-cta{display:inline-block;text-decoration:none;background:var(--ds-brand-solid);color:var(--ds-brand-contrast);border:none;border-radius:var(--ds-radius-md);padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;}
.welcome-cta:hover{background:var(--ds-brand-solid-hover);}

/* Momentum hero */
.momentum{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px 20px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:26px;}
.m-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;}
.m-lead{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;}
.m-pct{font-size:40px;font-weight:700;letter-spacing:-1.5px;line-height:1;background:linear-gradient(135deg,var(--ds-brand),#0bb87f);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.m-head{font-size:15px;font-weight:500;color:var(--text);max-width:34ch;line-height:1.35;}
.m-count{font-size:22px;font-weight:700;color:var(--text);white-space:nowrap;}
.m-count span{font-size:12px;font-weight:500;color:var(--ds-text-tertiary);}
.m-track{height:10px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;margin-bottom:16px;}
.m-track span{position:relative;display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ds-brand),#3fd39e);transition:width .5s var(--ds-ease);}
.m-track span::after{content:"";position:absolute;inset:0;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-120%);animation:m-sheen 2.2s var(--ds-ease) .35s 1;}
@keyframes m-sheen{to{transform:translateX(120%);}}
.m-next{display:block;background:linear-gradient(135deg,var(--ds-brand),#0bb87f);color:#fff;border-radius:var(--ds-radius-lg);padding:16px 18px;text-decoration:none;box-shadow:0 10px 26px -10px rgba(10,158,110,.5);transition:transform .1s,box-shadow .15s;}
.m-next:hover{transform:translateY(-1px);box-shadow:0 16px 34px -10px rgba(10,158,110,.55);}
.mn-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;opacity:.85;margin-bottom:5px;}
.mn-label{font-size:19px;font-weight:700;letter-spacing:-.3px;line-height:1.2;}
.mn-arrow{display:inline-block;transition:transform .15s;}
.m-next:hover .mn-arrow{transform:translateX(3px);}
.mn-why{font-size:13px;opacity:.92;margin-top:5px;line-height:1.45;}

/* Journey stepper */
.sec-head{margin:0 0 13px;}
.sec-title{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin:0;}
.sec-title::before{content:"";flex:0 0 auto;width:16px;height:3px;border-radius:3px;background:var(--ds-brand);}
.sec-sub{font-size:13px;line-height:1.5;color:var(--ds-text-secondary);margin:5px 0 0;max-width:62ch;}
.pillars3{display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:26px;}
@media(max-width:640px){.pillars3{grid-template-columns:1fr;}}
.p3{position:relative;display:block;text-decoration:none;color:var(--text);border-radius:var(--ds-radius-lg,12px);border:1px solid var(--border);background:var(--surface);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,transform .15s,box-shadow .15s;}
.p3:hover{transform:translateY(-2px);box-shadow:var(--ds-shadow-md);border-color:var(--border-strong);}
.p3-psych{padding:20px 22px;color:#fff;background:linear-gradient(135deg,var(--ds-brand),#0bb87f);border-color:transparent;box-shadow:0 12px 30px -14px rgba(10,158,110,.5);}
.p3-psych:hover{box-shadow:0 16px 34px -14px rgba(10,158,110,.6);}
.p3-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:rgba(255,255,255,.2);border-radius:20px;padding:3px 10px;margin-bottom:12px;}
.p3-score{position:absolute;top:16px;right:16px;display:flex;flex-direction:column;align-items:center;line-height:1;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:12px;padding:7px 12px;backdrop-filter:blur(4px);}
.p3-score-n{font-size:22px;font-weight:700;letter-spacing:-.5px;}
.p3-score-l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;opacity:.9;margin-top:3px;}
.p3-ic{width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.18);display:inline-flex;align-items:center;justify-content:center;color:#fff;}
.p3-psych .p3-name{font-size:20px;font-weight:700;letter-spacing:-.4px;margin:10px 0 5px;}
.p3-psych .p3-desc{font-size:13px;line-height:1.5;opacity:.94;max-width:44ch;}
.p3-go{margin-top:14px;font-size:13px;font-weight:700;}
.p3-rail{display:flex;flex-direction:column;gap:12px;}
.p3-sm{flex:1;display:flex;align-items:center;gap:12px;padding:14px 16px;}
.p3-sm:hover{border-color:var(--border-strong);}
.p3-ic-sm{width:34px;height:34px;flex:0 0 auto;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;}
.p3-num .p3-ic-sm{background:var(--ds-info-soft);color:var(--ds-info);}
.p3-exec .p3-ic-sm{background:var(--ds-warning-soft);color:var(--ds-warning);}
.p3-sm .p3-name{font-size:15px;font-weight:700;}
.p3-sm .p3-desc{font-size:12px;color:var(--muted);line-height:1.4;margin-top:2px;}
.p3-badge-sm{margin-left:auto;flex:0 0 auto;font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 9px;white-space:nowrap;}
.p3-badge-sm.good{background:var(--ds-success-soft);color:var(--ds-success);}
.p3-badge-sm.ok{background:var(--ds-info-soft);color:var(--ds-info);}
.p3-badge-sm.warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.p3-badge-sm.bad{background:var(--ds-danger-soft);color:var(--ds-danger);}
.p3-badge-sm.none{background:var(--ds-surface-subtle,#fafbfc);color:var(--ds-text-tertiary,#586173);border:1px solid var(--border);}
.p3-badge-sm.exec-good{background:var(--ds-success-soft);color:var(--ds-success);}
.p3-badge-sm.exec-warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.p3-badge-sm.exec-none{background:var(--ds-surface-subtle,#fafbfc);color:var(--ds-text-tertiary,#586173);border:1px solid var(--border);}
.journey{display:flex;flex-direction:column;margin-bottom:26px;}
.stage{display:flex;gap:14px;text-decoration:none;color:var(--text);position:relative;}
.stage-rail{position:relative;display:flex;justify-content:center;width:34px;flex:none;}
.stage-rail::before{content:"";position:absolute;top:0;bottom:0;width:2px;background:var(--border-strong);}
.stage:first-child .stage-rail::before{top:17px;}
.stage:last-child .stage-rail::before{bottom:calc(100% - 34px);}
.stage-badge{position:relative;z-index:1;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--ds-bg-subtle);color:var(--muted);border:2px solid var(--surface);box-shadow:0 0 0 1px var(--border-strong);}
.stage.done .stage-badge{background:var(--ds-success-soft);color:var(--ds-success);box-shadow:0 0 0 1px var(--ds-success-soft);}
.stage.active .stage-badge{background:var(--ds-brand);color:#fff;box-shadow:0 0 0 4px var(--ds-brand-soft);}
.stage-body{flex:1;min-width:0;padding:6px 0 20px;border-bottom:0;}
.stage:not(:last-child) .stage-body{border-bottom:1px solid var(--border);}
.stage-top{display:flex;align-items:center;gap:9px;}
.stage-name{font-size:15px;font-weight:700;letter-spacing:-.2px;}
.stage.upcoming .stage-name{opacity:.72;}
/* Dim the upcoming blurb with a lighter (still WCAG-AA) token rather than
   opacity — opacity fades text toward the background and silently kills
   contrast (#475569 at .72 opacity reads as ~3.6:1). */
.stage.upcoming .stage-blurb{color:var(--ds-text-tertiary);}
.stage-pill{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:2px 8px;border-radius:99px;background:var(--ds-muted-soft);color:var(--ds-text-tertiary);}
.stage-pill.done{background:var(--ds-success-soft);color:var(--ds-success);}
.stage-pill.active{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.stage-pill.ongoing{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.stage-blurb{font-size:13px;color:var(--ds-text-secondary);line-height:1.5;margin-top:4px;}
.stage-stat{font-size:12px;font-weight:700;color:var(--ds-text-primary);margin-top:6px;display:inline-flex;align-items:center;gap:6px;}
.stage-stat::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ds-success);display:inline-block;}
.stage-cta{font-size:12.5px;font-weight:700;color:var(--ds-brand);margin-top:7px;transition:transform .15s var(--ds-ease);}
.stage:hover .stage-name{color:var(--ds-brand);}
.stage:hover .stage-cta{transform:translateX(3px);}
.stage:focus-visible{outline-offset:4px;border-radius:8px;}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;}
.stat{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--border-strong);border-radius:var(--ds-radius-lg);padding:14px 15px;box-shadow:var(--ds-shadow-xs);}
.stat.s-leads{border-left-color:var(--ds-brand);}
.stat.s-qual{border-left-color:var(--ds-info);}
.stat.s-calls{border-left-color:var(--ds-success);}
.stat.s-cost{border-left-color:var(--ds-warning);}
/* A quiet week reads calm, not like a failure: zeros recede so real numbers pop. */
.stat.is-zero{border-left-color:var(--border-strong);}
.stat.is-zero .stat-n{color:var(--ds-text-tertiary);}
.stat-n{font-size:26px;font-weight:700;letter-spacing:-.6px;line-height:1;}
.stat-l{font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.3;}
.stats-empty{font-size:13px;line-height:1.5;color:var(--ds-text-secondary);margin:4px 0 24px;padding:11px 14px 11px 13px;background:var(--ds-brand-soft);border:1px solid var(--ds-border-subtle);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-md);}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:24px;}
.card{display:block;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.card:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.card-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-bottom:12px;}
.card-open{margin-left:auto;font-size:12px;font-weight:500;color:var(--ds-brand);transition:transform .15s var(--ds-ease);}
.card:hover .card-open{transform:translateX(2px);}
.facts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;}
.facts li{font-size:13px;color:var(--muted);}
.facts b{color:var(--text);font-weight:700;}
.empty{font-size:13px;color:var(--ds-text-tertiary);line-height:1.5;}

.nav-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.tile{display:flex;flex-direction:column;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:13px 14px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,transform .1s;position:relative;}
.tile{transition:border-color .15s,transform .12s var(--ds-ease,ease),box-shadow .15s;}
.tile:hover{border-color:var(--ds-brand);transform:translateY(-2px);box-shadow:var(--ds-shadow-sm);}
.tile.cur{border-color:var(--ds-brand);background:var(--ds-brand-soft);}
.tile-ic{color:var(--ds-brand);display:inline-flex;}
.tile-label{font-size:13.5px;font-weight:700;margin-top:5px;}
.tile-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
@media(max-width:560px){.stats{grid-template-columns:repeat(2,1fr);}.cards{grid-template-columns:1fr;}.m-pct{font-size:34px;}}

/* Keyboard focus on the brand-green CTAs — a plain green ring is invisible on
   green, so use a white ring with an offset that reads clearly in both themes. */
.m-next:focus-visible,.p3-psych:focus-visible,.welcome-cta:focus-visible,.lr-go-btn.primary:focus-visible{outline:2px solid var(--ds-brand-contrast);outline-offset:3px;}

/* Notification toasts — dismiss-able, auto-clear status messages at top-right */
.cc-toasts{position:fixed;top:20px;right:20px;z-index:100;display:flex;flex-direction:column;gap:10px;max-width:380px;pointer-events:none;}
.toast{pointer-events:auto;display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;box-shadow:var(--ds-shadow-md);animation:slideInRight .3s var(--ds-ease);min-width:280px;}
@keyframes slideInRight{from{transform:translateX(400px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.toast-content{flex:1;display:flex;flex-direction:column;gap:2px;}
.toast-title{font-size:14px;font-weight:700;color:var(--text);}
.toast-message{font-size:12.5px;color:var(--muted);line-height:1.4;}
.toast-close{background:transparent;border:none;color:var(--ds-text-tertiary);font-size:18px;cursor:pointer;padding:0;line-height:1;flex:0 0 auto;transition:color .15s;}
.toast-close:hover{color:var(--text);}
.toast-success{border-left:3px solid var(--ds-success);}.toast-success .toast-title{color:var(--ds-success);}
.toast-info{border-left:3px solid var(--ds-info);}.toast-info .toast-title{color:var(--ds-info);}
.toast-warning{border-left:3px solid var(--ds-warning);}.toast-warning .toast-title{color:var(--ds-warning);}
.toast-error{border-left:3px solid var(--ds-danger);}.toast-error .toast-title{color:var(--ds-danger);}
@media(max-width:480px){.cc-toasts{left:10px;right:10px;max-width:none;}.toast{min-width:auto;}}

/* 90-day checkpoint reminder — appears when checkpoint is due */
.cc-checkpoint-reminder{display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--ds-info-soft);border-left:4px solid var(--ds-info);border-radius:var(--ds-radius-lg);padding:16px 18px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);}
.cc-checkpoint-due{border-left-color:var(--ds-warning);border-color:var(--ds-warning-soft);background:linear-gradient(135deg,var(--ds-warning-soft),var(--surface));}
.checkpoint-icon{flex:0 0 auto;font-size:28px;}
.checkpoint-content{flex:1;display:flex;flex-direction:column;gap:2px;}
.checkpoint-title{font-size:14px;font-weight:700;color:var(--text);}
.checkpoint-text{font-size:12.5px;color:var(--muted);line-height:1.4;}
.checkpoint-cta{flex:0 0 auto;text-decoration:none;font-size:13px;font-weight:700;color:var(--ds-info);white-space:nowrap;transition:transform .15s var(--ds-ease);}
.cc-checkpoint-due .checkpoint-cta{color:var(--ds-warning);}
.cc-checkpoint-reminder:hover .checkpoint-cta{transform:translateX(3px);}
@media(max-width:560px){.cc-checkpoint-reminder{flex-wrap:wrap;}.checkpoint-cta{width:100%;}}

/* Respect reduced-motion: kill every transition + animation on this page. */
@media (prefers-reduced-motion: reduce){.cc-root *{transition:none!important;animation:none!important;}}
`;
