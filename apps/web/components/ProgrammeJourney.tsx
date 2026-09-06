"use client";
/**
 * The live, walkable ONEVYRT journey. The server passes the programme STRUCTURE
 * (chapters + modules + each module's tool link) so signed-out visitors still
 * see the whole path with no flash; this client component then overlays the
 * signed-in learner's real position from /api/programme/enrollment (the engine's
 * buildProgrammeMap): each module shows done / current / available / locked, the
 * path is locked in order (a locked module isn't a link), the current step is
 * highlighted with a Continue-into-its-tool button, and progress is shown per
 * chapter and overall.
 *
 * Coach-approval gates (submitting a chapter's OUTPUT for review) are wired via
 * the engine's chapterGates() and stored in chapter_submissions. The gates lock
 * progression from Start → Chapter 1 → 2 → 3 → 4 → Finish, requiring coach
 * approval of each chapter's artifact (Blueprint, System, Dashboard, Growth Plan).
 */
import { useEffect, useState } from "react";

type PsychologicalState = "uncertainty" | "clarity" | "confidence" | "control" | "momentum" | "freedom";
type LessonStatus = "locked" | "available" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
type ReadinessLabel = "no_data" | "fragile" | "developing" | "strong";

export interface JourneyModule { id: string; title: string; outcome: string; toolHref: string | null; }
export interface JourneyStage { id: string; num: number; title: string; outcome: string; state: PsychologicalState; output: string | null; modules: JourneyModule[]; }

interface MapLesson { id: string; status: LessonStatus; }
interface MapNode { stageId: string; status: "complete" | "current" | "available" | "locked"; lessons: MapLesson[]; completedLessons: number; totalLessons: number; }
interface ProgrammeMap { nodes: MapNode[]; currentStageId: string | null; currentLessonId: string | null; overallPercent: number; completedLessons: number; totalLessons: number; }
interface NextAction { currentLessonId: string | null; currentLessonTitle: string | null; ctaLabel: string; done: boolean; overallPercent: number; }
interface ReadinessBaseline { score: number; capturedAt: string; }
interface ProgrammeSnapshot { readinessScore: number | null; readinessLabel: ReadinessLabel; readinessBaseline?: ReadinessBaseline | null; }

// Chapter-level gate state, from the engine's chapterGates (via the enrollment
// API). The learner submits a chapter's OUTPUT for coach sign-off; on the
// self-paced track (no coach) a completed chapter simply reads "complete" and
// nothing needs submitting — the lessons above never hard-lock on this.
type ChapterGateState = "locked" | "in_progress" | "ready_to_submit" | "awaiting_review" | "changes_requested" | "approved";
interface ChapterSubmission { stageId: string; submittedAt: string; evidence: string; reviewStatus: "submitted" | "approved" | "changes_requested"; coachFeedback?: string; }
interface ChapterGate { stageId: string; title: string; order: number; output: string | null; state: ChapterGateState; lessonsComplete: number; lessonsTotal: number; unlocksNext: boolean; submission?: ChapterSubmission; }

const STATE_LABEL: Record<PsychologicalState, string> = {
  uncertainty: "Uncertainty", clarity: "Clarity", confidence: "Confidence", control: "Control", momentum: "Momentum", freedom: "Freedom",
};

/**
 * The chapter's one-line framing: the psychological SHIFT this chapter makes and
 * why it matters — distinct from `stage.outcome` (states the goal) and
 * `stage.output` (names the document produced). Keyed by state, not stage id, so
 * it holds even if chapters are renumbered or the DB copy drifts.
 */
const STATE_INTRO: Record<PsychologicalState, string> = {
  uncertainty:
    "You start by facing the business exactly as it is today, not as you'd like it to be. That honest look becomes your starting Readiness Score — the baseline every later chapter gets measured against.",
  clarity:
    "Right now, the problem probably feels vague — something's off, but you can't quite name it. This chapter turns that fog into a sharp definition: your founder psychology, the business you're really in, your customer, and the message that finally lands.",
  confidence:
    "Knowing isn't the same as doing. Here, what you just defined becomes a live machine — offer, funnel, marketing, sales, delivery — built and running, not just planned.",
  control:
    "A business you can't measure runs on hope, not fact. This chapter puts numbers under everything you've built — your freedom number, your unit economics, the levers that actually move revenue — so you steer by reality from here on.",
  momentum:
    "You know your numbers now — so find the one thing actually holding growth back, and fix that before anything else. Improve conversion, improve profit, systemise the work that only runs because you personally do it, and turn all of it into one dated 90-day Growth & Improvement Plan.",
  freedom:
    "This is where you close the loop. Re-score your Readiness against day one, name what only you can do, and leave with your next 90 days already planned.",
};

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);

/** Visual treatment for a module row, derived from its live status. */
function treat(status: LessonStatus | null, isCurrent: boolean): { cls: string; pill: string | null; linkable: boolean } {
  if (status === "locked") return { cls: "locked", pill: "Locked", linkable: false };
  if (status === "approved" || status === "completed") return { cls: "done", pill: "Done", linkable: true };
  if (isCurrent) return { cls: "current", pill: "Continue", linkable: true };
  if (status === "submitted") return { cls: "review", pill: "In review", linkable: true };
  if (status === "changes_requested") return { cls: "changes", pill: "Changes requested", linkable: true };
  if (status === "in_progress") return { cls: "active", pill: "In progress", linkable: true };
  return { cls: "neutral", pill: null, linkable: true }; // available, or anon/loading (unknown)
}

/**
 * Compact Readiness stat for the live-status band. Colour follows the label;
 * `readinessBaseline` is a newer, optional field that may be absent from an
 * older cached response, so it's read defensively via optional chaining. When
 * a baseline is present with a different score than the current one, renders
 * the before → after through-line instead of just the current score.
 */
function readinessStat(snapshot: ProgrammeSnapshot | null) {
  if (!snapshot) return null;
  if (snapshot.readinessScore == null) {
    return <div className="pg-live-readiness muted">Readiness — not started</div>;
  }
  const baseline = snapshot.readinessBaseline;
  const hasDelta = typeof baseline?.score === "number" && baseline?.score !== snapshot.readinessScore;
  return (
    <div className="pg-live-readiness" data-rlabel={snapshot.readinessLabel}>
      <span className="pg-live-readiness-label">Readiness</span>
      <span className="pg-live-readiness-score">
        {hasDelta && baseline ? (
          <>{baseline.score} <span className="pg-live-readiness-arrow" aria-hidden="true">→</span> {snapshot.readinessScore}</>
        ) : (
          snapshot.readinessScore
        )}
      </span>
    </div>
  );
}

export function ProgrammeJourney({ stages, totalModules }: { stages: JourneyStage[]; totalModules: number }) {
  const [phase, setPhase] = useState<"loading" | "anon" | "ok" | "error">("loading");
  const [map, setMap] = useState<ProgrammeMap | null>(null);
  const [action, setAction] = useState<NextAction | null>(null);
  const [snapshot, setSnapshot] = useState<ProgrammeSnapshot | null>(null);
  const [gates, setGates] = useState<ChapterGate[]>([]);
  const [hasCoach, setHasCoach] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Chapter-output submit form: which chapter's form is open, its draft, and busy/error.
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/programme/enrollment", { credentials: "include" });
        if (!live) return;
        if (r.status === 401) { setPhase("anon"); return; }
        if (!r.ok) { setPhase("error"); return; }
        const j = await r.json();
        if (!live) return;
        setMap((j.map as ProgrammeMap) ?? null);
        setAction((j.nextAction as NextAction) ?? null);
        setSnapshot((j.snapshot as ProgrammeSnapshot) ?? null);
        setGates((j.chapterGates as ChapterGate[]) ?? []);
        setHasCoach(Boolean(j.hasCoach));
        setPhase("ok");
      } catch { if (live) setPhase("error"); }
    })();
    return () => { live = false; };
  }, [reloadKey]);

  const gateOf = (stageId: string): ChapterGate | null => gates.find((g) => g.stageId === stageId) ?? null;

  const submitChapter = async (stageId: string) => {
    if (gateBusy || !draft.trim()) return;
    setGateBusy(true); setGateErr("");
    try {
      const r = await fetch(`/api/programme/chapters/${encodeURIComponent(stageId)}/submit`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence: draft.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setGateErr((d as { error?: string }).error || "Couldn't submit — try again."); setGateBusy(false); return; }
      setOpenStageId(null); setDraft(""); setGateBusy(false);
      setReloadKey((k) => k + 1); // re-fetch so the gate state updates
    } catch { setGateErr("Network error — try again."); setGateBusy(false); }
  };

  const statusOf = (id: string): LessonStatus | null => {
    if (!map) return null;
    for (const n of map.nodes) { const l = n.lessons.find((x) => x.id === id); if (l) return l.status; }
    return null;
  };
  const nodeOf = (stageId: string): MapNode | null => map?.nodes.find((n) => n.stageId === stageId) ?? null;
  const currentId = map?.currentLessonId ?? null;
  const currentModule = currentId ? stages.flatMap((s) => s.modules).find((m) => m.id === currentId) ?? null : null;
  // Modules open their GUIDED lesson step (/programme/lesson/[id]), which then
  // links out to the actual tool — so the journey is walked through the guide,
  // not straight into a raw tool.
  const continueHref = currentModule ? `/programme/lesson/${currentModule.id}` : null;

  return (
    <div className="pg">
      <style>{css}</style>

      <header className="pg-head">
        <p className="pg-eyebrow">ONEVYRT · Programme</p>
        <h1 className="pg-title">Your transformation, in four chapters</h1>
        <p className="pg-sub">
          One path from uncertainty to freedom — {totalModules} modules, each wired to a tool you already have, in one locked order.
        </p>
        <ol className="pg-arc" aria-label="Psychological progression">
          {stages.map((s, i) => (
            <li key={s.id} className="pg-arc-item" data-state={s.state}>
              <span className="pg-arc-dot" aria-hidden="true" />
              <span className="pg-arc-label">{STATE_LABEL[s.state]}</span>
              {i < stages.length - 1 && <span className="pg-arc-sep" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
      </header>

      {/* Live status band — the one clear "where am I / what's next". */}
      {phase === "ok" && map && (
        <div className="pg-live">
          <div className="pg-live-top">
            <div className="pg-live-left">
              <div className="pg-live-count">{map.completedLessons}<span> / {map.totalLessons} modules</span></div>
              {readinessStat(snapshot)}
            </div>
            <div className="pg-live-pct">{map.overallPercent}%</div>
          </div>
          <div className="pg-live-bar"><span style={{ width: `${map.overallPercent}%` }} /></div>
          {action?.done ? (
            <a className="pg-cta done" href={continueHrefForFinish(stages)}>
              🎉 Programme complete — view your Transformation Report →
            </a>
          ) : currentModule && continueHref ? (
            <a className="pg-cta" href={continueHref}>
              <span className="pg-cta-tag">{action?.ctaLabel ?? "Continue"}</span>
              <span className="pg-cta-title">{currentModule.title}</span>
              <span className="pg-cta-go">Open →</span>
            </a>
          ) : (
            <div className="pg-cta muted">You&rsquo;re all caught up — your coach opens the next step.</div>
          )}
        </div>
      )}
      {phase === "anon" && (
        <div className="pg-signin">
          <span>Sign in to start your journey and track your progress.</span>
          <a className="pg-signin-btn" href="/">Sign in →</a>
        </div>
      )}

      <div className="pg-stages">
        {stages.map((stage) => {
          const node = nodeOf(stage.id);
          const chapterLocked = node?.status === "locked";
          return (
            <section key={stage.id} className={`pg-stage${chapterLocked ? " pg-stage-locked" : ""}`} data-state={stage.state}>
              <div className="pg-stage-rail" aria-hidden="true">
                <span className="pg-stage-num">{stage.num}</span>
              </div>
              <div className="pg-stage-body">
                <div className="pg-stage-head">
                  <span className="pg-chip">{STATE_LABEL[stage.state]}</span>
                  <h2 className="pg-stage-title">{stage.title}</h2>
                  {node && (
                    <span className={`pg-stage-status ${node.status}`}>
                      {node.status === "complete" ? "Complete"
                        : node.status === "locked" ? "Locked"
                        : `${node.completedLessons}/${node.totalLessons}`}
                    </span>
                  )}
                </div>
                <p className="pg-stage-intro">{STATE_INTRO[stage.state]}</p>
                {stage.outcome && <p className="pg-stage-outcome">{stage.outcome}</p>}
                {stage.output && (
                  <p className="pg-output"><span className="pg-output-label">Output</span> {stage.output}</p>
                )}
                {stage.modules.length > 0 && (
                  <ul className="pg-lessons">
                    {stage.modules.map((m, i) => {
                      const status = statusOf(m.id);
                      const isCurrent = m.id === currentId;
                      const t = treat(status, isCurrent);
                      const canLink = t.linkable; // links to the guided lesson step, which always exists
                      const body = (
                        <>
                          <span className="pg-lesson-num">
                            {t.cls === "done" ? <CheckIcon /> : t.cls === "locked" ? <LockIcon /> : i + 1}
                          </span>
                          <span className="pg-lesson-text">
                            <span className="pg-lesson-title">{m.title}</span>
                            {m.outcome && <span className="pg-lesson-outcome">{m.outcome}</span>}
                          </span>
                          {t.pill && <span className={`pg-lesson-pill ${t.cls}`}>{t.pill}</span>}
                          {canLink && !t.pill && <span className="pg-lesson-go" aria-hidden="true">Open →</span>}
                        </>
                      );
                      return (
                        <li key={m.id} className={`pg-lesson ${t.cls}`}>
                          {canLink
                            ? <a className="pg-lesson-link" href={`/programme/lesson/${m.id}`}>{body}</a>
                            : <span className="pg-lesson-static" aria-disabled={t.cls === "locked" ? true : undefined}>{body}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {phase === "ok" && (() => {
                  const g = gateOf(stage.id);
                  // Only a meaningful moment gets a milestone — never a locked
                  // future chapter or one whose lessons are still in progress.
                  if (!g || g.lessonsTotal === 0 || g.state === "locked" || g.state === "in_progress") return null;
                  const output = g.output ?? "chapter output";
                  const formOpen = openStageId === stage.id;
                  const form = (
                    <>
                      <textarea className="pg-gate-ta" value={draft} onChange={(e) => setDraft(e.target.value)}
                        placeholder={`Summarise your ${output} — what you produced this chapter, for your coach to review.`} />
                      {gateErr && <div className="pg-gate-err">{gateErr}</div>}
                      <div className="pg-gate-actions">
                        <button className="pg-gate-btn primary" disabled={gateBusy || !draft.trim()} onClick={() => void submitChapter(stage.id)}>
                          {gateBusy ? "Submitting…" : "Submit for review"}
                        </button>
                        <button className="pg-gate-btn ghost" onClick={() => { setOpenStageId(null); setDraft(""); setGateErr(""); }}>Cancel</button>
                      </div>
                    </>
                  );
                  if (g.state === "approved") {
                    return (
                      <div className="pg-gate approved">
                        <span className="pg-gate-ic" aria-hidden="true"><CheckIcon /></span>
                        <div className="pg-gate-body">
                          <div className="pg-gate-title">Chapter output approved — {output}</div>
                          {g.submission?.coachFeedback && <div className="pg-gate-note">Coach: {g.submission.coachFeedback}</div>}
                        </div>
                      </div>
                    );
                  }
                  if (g.state === "awaiting_review") {
                    return (
                      <div className="pg-gate review">
                        <div className="pg-gate-body">
                          <div className="pg-gate-title">Chapter output submitted — with your coach</div>
                          <div className="pg-gate-note">You&rsquo;ll hear back once they&rsquo;ve reviewed your {output}.</div>
                        </div>
                      </div>
                    );
                  }
                  if (g.state === "changes_requested") {
                    return (
                      <div className="pg-gate changes">
                        <div className="pg-gate-body">
                          <div className="pg-gate-title">Your coach asked for changes</div>
                          {g.submission?.coachFeedback && <div className="pg-gate-note">Coach: {g.submission.coachFeedback}</div>}
                          {formOpen ? form : (
                            <button className="pg-gate-btn primary" onClick={() => { setOpenStageId(stage.id); setDraft(g.submission?.evidence ?? ""); setGateErr(""); }}>Revise &amp; resubmit →</button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  // ready_to_submit — with a coach it's a submit step; solo, it's simply done.
                  if (!hasCoach) {
                    return (
                      <div className="pg-gate solo">
                        <span className="pg-gate-ic" aria-hidden="true"><CheckIcon /></span>
                        <div className="pg-gate-body">
                          <div className="pg-gate-title">Chapter complete — {output} done</div>
                          <div className="pg-gate-note">On the self-paced track, that&rsquo;s the chapter. Straight on to the next.</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="pg-gate ready">
                      <div className="pg-gate-body">
                        <div className="pg-gate-title">Chapter complete — submit your {output} for review</div>
                        {formOpen ? form : (
                          <button className="pg-gate-btn primary" onClick={() => { setOpenStageId(stage.id); setDraft(""); setGateErr(""); }}>Submit chapter output →</button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          );
        })}
      </div>

      <p className="pg-foot">
        The scattered tools, sequenced into one journey. Modules unlock in order as work is completed — and with a coach on your
        workspace, submissions get their review.
      </p>
    </div>
  );
}

/** The Finish chapter's tool, for the "programme complete" CTA. */
function continueHrefForFinish(stages: JourneyStage[]): string {
  const finish = stages.find((s) => s.id === "finish");
  return finish?.modules[0]?.toolHref ?? "/numbers";
}

const css = `
.pg { max-width: 880px; margin: 0 auto; padding: 40px 20px 72px; color: var(--ds-text-primary, #111827); }
.pg-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ds-brand, #088057); margin: 0 0 8px; }
.pg-title { font-size: clamp(26px, 4vw, 38px); line-height: 1.12; font-weight: 800; margin: 0 0 10px; letter-spacing: -.01em; text-wrap: balance; }
.pg-sub { font-size: 16px; color: var(--ds-text-secondary, #475569); margin: 0 0 22px; }
.pg-arc { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; list-style: none; padding: 14px 16px; margin: 0 0 8px;
  background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e8ecf2); border-radius: var(--ds-radius-lg, 14px); }
.pg-arc-item { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ds-text-secondary, #475569); }
.pg-arc-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--st, #94a3b8); box-shadow: 0 0 0 3px color-mix(in srgb, var(--st, #94a3b8) 20%, transparent); }
.pg-arc-sep { color: var(--ds-text-disabled, #94a3b8); margin-left: 4px; }

/* Live status band */
.pg-live { background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e8ecf2); border-radius: var(--ds-radius-lg, 14px);
  padding: 16px 18px; margin: 16px 0 6px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.pg-live-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.pg-live-count { font-size: 15px; font-weight: 700; color: var(--ds-text-primary); }
.pg-live-count span { font-size: 13px; font-weight: 500; color: var(--ds-text-tertiary); }
.pg-live-left { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.pg-live-readiness { display: inline-flex; align-items: baseline; gap: 5px; padding-left: 14px; border-left: 1px solid var(--ds-border-subtle, #e8ecf2); }
.pg-live-readiness.muted { font-size: 13px; font-weight: 500; color: var(--ds-text-tertiary); }
.pg-live-readiness-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--ds-text-tertiary); }
.pg-live-readiness-score { font-size: 14px; font-weight: 800; color: var(--ds-text-primary); }
.pg-live-readiness-arrow { font-weight: 600; opacity: .65; }
.pg-live-readiness[data-rlabel="no_data"] .pg-live-readiness-score { color: var(--ds-text-tertiary); }
.pg-live-readiness[data-rlabel="fragile"] .pg-live-readiness-score { color: var(--ds-danger, #dc2626); }
.pg-live-readiness[data-rlabel="developing"] .pg-live-readiness-score { color: var(--ds-warning, #b45309); }
.pg-live-readiness[data-rlabel="strong"] .pg-live-readiness-score { color: var(--ds-success, #088057); }
.pg-live-pct { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ds-brand, #088057); }
.pg-live-bar { height: 8px; border-radius: 99px; background: var(--ds-bg-subtle, #f1f4f9); overflow: hidden; margin: 10px 0 14px; }
.pg-live-bar span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--ds-brand, #088057), #3fd39e); transition: width .5s cubic-bezier(.2,.7,.3,1); }
.pg-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; text-decoration: none; border-radius: 12px; padding: 13px 16px;
  background: linear-gradient(135deg, var(--ds-brand-solid, #088057), #0bb87f); color: #fff; box-shadow: 0 10px 26px -12px rgba(10,158,110,.5); transition: transform .12s, box-shadow .15s; }
.pg-cta:hover { transform: translateY(-1px); box-shadow: 0 16px 32px -12px rgba(10,158,110,.55); }
.pg-cta-tag { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; background: rgba(255,255,255,.2); border-radius: 999px; padding: 3px 9px; }
.pg-cta-title { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.pg-cta-go { margin-left: auto; font-size: 13px; font-weight: 700; white-space: nowrap; }
.pg-cta.done { justify-content: center; font-size: 15px; font-weight: 700; }
.pg-cta.muted { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); box-shadow: none; font-size: 13.5px; justify-content: center; }
.pg-signin { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 16px 0 6px;
  background: var(--ds-brand-soft, #e7f6f0); border: 1px solid var(--ds-brand, #088057); border-radius: var(--ds-radius-lg, 14px); padding: 13px 16px; font-size: 14px; color: var(--ds-text-primary); }
.pg-signin-btn { text-decoration: none; font-weight: 700; font-size: 13px; color: #fff; background: var(--ds-brand-solid, #088057); border-radius: 9px; padding: 8px 14px; white-space: nowrap; }

.pg-stages { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.pg-stage { display: grid; grid-template-columns: 44px 1fr; background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border-subtle, #e8ecf2); border-left: 4px solid var(--st, #088057);
  border-radius: var(--ds-radius-lg, 14px); overflow: hidden; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.pg-stage-locked { opacity: .72; }
.pg-stage-rail { display: flex; align-items: flex-start; justify-content: center; padding-top: 22px; }
.pg-stage-num { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: color-mix(in srgb, var(--st, #088057) 14%, var(--ds-surface, #fff)); color: var(--st, #088057); font-weight: 800; font-size: 13px; }
.pg-stage-body { padding: 18px 20px 20px 4px; }
.pg-stage-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pg-chip { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px;
  color: var(--st, #088057); background: color-mix(in srgb, var(--st, #088057) 12%, var(--ds-surface, #fff)); }
.pg-stage-title { font-size: 18px; font-weight: 750; margin: 0; }
.pg-stage-status { margin-left: auto; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); }
.pg-stage-status.complete { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.pg-stage-status.current { background: var(--ds-brand-soft, #e7f6f0); color: var(--ds-brand-active, #088057); }
.pg-stage-status.locked { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-tertiary); }
.pg-stage-intro { font-size: 15px; line-height: 1.5; color: var(--ds-text-secondary, #475569); margin: 8px 0 0; }
.pg-stage-outcome { font-size: 14px; color: var(--ds-text-secondary, #475569); margin: 8px 0 0; }
.pg-output { font-size: 13px; margin: 12px 0 0; color: var(--ds-text-primary, #111827); }
.pg-output-label { font-weight: 700; color: var(--ds-brand, #088057); margin-right: 6px; }

.pg-lessons { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pg-lesson { display: block; }
.pg-lesson-link, .pg-lesson-static { display: flex; gap: 12px; align-items: center; text-decoration: none; color: inherit;
  border: 1px solid transparent; border-radius: 10px; padding: 9px 11px; margin: 0 -11px; transition: border-color .15s, background .15s; }
.pg-lesson-link { cursor: pointer; }
.pg-lesson-link:hover { border-color: var(--st, #088057); background: color-mix(in srgb, var(--st, #088057) 6%, transparent); }
.pg-lesson-link:focus-visible { outline: 2px solid var(--st, #088057); outline-offset: 2px; }
.pg-lesson.current .pg-lesson-link { border-color: var(--ds-brand, #088057); background: color-mix(in srgb, var(--ds-brand, #088057) 8%, transparent); }
.pg-lesson.locked .pg-lesson-static { cursor: not-allowed; }
.pg-lesson.locked .pg-lesson-title, .pg-lesson.locked .pg-lesson-outcome { color: var(--ds-text-tertiary, #94a3b8); }
.pg-lesson-num { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; margin-top: 0;
  font-size: 11px; font-weight: 700; color: var(--ds-text-secondary, #475569); background: var(--ds-bg-subtle, #f1f4f9); }
.pg-lesson.done .pg-lesson-num { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.pg-lesson.current .pg-lesson-num { background: var(--ds-brand, #088057); color: #fff; }
.pg-lesson.locked .pg-lesson-num { color: var(--ds-text-tertiary, #94a3b8); }
.pg-lesson-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pg-lesson-title { font-size: 14px; font-weight: 600; }
.pg-lesson-outcome { font-size: 12.5px; color: var(--ds-text-tertiary, #586173); }
.pg-lesson-pill { flex: none; margin-left: auto; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); }
.pg-lesson-pill.done { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.pg-lesson-pill.current { background: var(--ds-brand-solid, #088057); color: #fff; }
.pg-lesson-pill.review { background: var(--ds-info-soft, #e6effe); color: var(--ds-info, #2563eb); }
.pg-lesson-pill.changes { background: var(--ds-warning-soft, #fff4e0); color: var(--ds-warning, #b45309); }
.pg-lesson-pill.active { background: var(--ds-brand-soft, #e7f6f0); color: var(--ds-brand-active, #088057); }
.pg-lesson-pill.locked { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-tertiary); }
.pg-lesson-go { flex: none; margin-left: auto; align-self: center; font-size: 12px; font-weight: 700; white-space: nowrap;
  color: var(--st, #088057); opacity: 0; transition: opacity .15s; }
.pg-lesson-link:hover .pg-lesson-go, .pg-lesson-link:focus-visible .pg-lesson-go { opacity: 1; }
@media (hover: none) { .pg-lesson-go { opacity: 1; } }
.pg-foot { max-width: 640px; margin: 26px auto 0; text-align: center; font-size: 13px; color: var(--ds-text-tertiary, #586173); }

/* Chapter-output milestone — the coach sign-off moment (or, self-paced, the
   "chapter complete" beat). Sits at the foot of a chapter's module list. */
.pg-gate { display: flex; gap: 12px; align-items: flex-start; margin: 14px 0 0; padding: 13px 15px; border-radius: 12px;
  border: 1px solid var(--ds-border-subtle, #e8ecf2); background: var(--ds-bg-subtle, #f1f4f9); }
.pg-gate.approved, .pg-gate.solo { border-color: color-mix(in srgb, var(--ds-success, #088057) 32%, transparent); background: var(--ds-success-soft, #e7f6f0); }
.pg-gate.review { border-color: color-mix(in srgb, var(--ds-info, #2563eb) 30%, transparent); background: var(--ds-info-soft, #e6effe); }
.pg-gate.changes { border-color: color-mix(in srgb, var(--ds-warning, #b45309) 34%, transparent); background: var(--ds-warning-soft, #fff4e0); }
.pg-gate.ready { border-color: var(--ds-brand, #088057); background: var(--ds-brand-soft, #e7f6f0); }
.pg-gate-ic { flex: none; width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; color: #fff; background: var(--ds-success, #088057); margin-top: 1px; }
.pg-gate-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.pg-gate-title { font-size: 14px; font-weight: 700; color: var(--ds-text-primary, #111827); }
.pg-gate-note { font-size: 12.5px; color: var(--ds-text-secondary, #475569); line-height: 1.5; }
.pg-gate-ta { width: 100%; box-sizing: border-box; min-height: 84px; resize: vertical; border-radius: 9px; padding: 9px 11px; font: inherit; font-size: 13.5px;
  border: 1px solid var(--ds-border-default, #dadce0); background: var(--ds-surface, #fff); color: var(--ds-text-primary, #111827); }
.pg-gate-err { font-size: 12.5px; color: var(--ds-danger, #dc2626); }
.pg-gate-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.pg-gate-btn { font: inherit; font-size: 13px; font-weight: 700; border-radius: 9px; padding: 8px 14px; cursor: pointer; border: 1px solid transparent; align-self: flex-start; }
.pg-gate-btn.primary { background: var(--ds-brand-solid, #088057); color: #fff; }
.pg-gate-btn.primary:disabled { opacity: .55; cursor: default; }
.pg-gate-btn.ghost { background: transparent; border-color: var(--ds-border-default, #dadce0); color: var(--ds-text-secondary, #475569); }
.pg-gate-btn:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }

.pg-stage[data-state="uncertainty"], .pg-arc-item[data-state="uncertainty"] { --st: #64748b; }
.pg-stage[data-state="clarity"], .pg-arc-item[data-state="clarity"] { --st: #2563eb; }
.pg-stage[data-state="confidence"], .pg-arc-item[data-state="confidence"] { --st: #16a34a; }
.pg-stage[data-state="control"], .pg-arc-item[data-state="control"] { --st: #d97706; }
.pg-stage[data-state="momentum"], .pg-arc-item[data-state="momentum"] { --st: #dc2626; }
.pg-stage[data-state="freedom"], .pg-arc-item[data-state="freedom"] { --st: #0891b2; }

/* Mobile-first responsive design for small screens (375px–639px) */
@media (max-width: 639px) {
  .pg { padding: 20px 12px 48px; }
  .pg-title { font-size: clamp(18px, 5vw, 24px); }
  .pg-sub { font-size: 14px; margin: 0 0 16px; }
  .pg-arc { flex-wrap: wrap; gap: 8px 6px; padding: 10px 12px; margin-bottom: 12px; }
  .pg-arc-item { font-size: 12px; }
  .pg-arc-sep { display: none; }

  .pg-live { padding: 12px 14px; margin: 12px 0 8px; }
  .pg-live-top { flex-direction: column; align-items: flex-start; gap: 8px; }
  .pg-live-left { flex-direction: column; gap: 8px; width: 100%; }
  .pg-live-readiness { padding-left: 0; border-left: none; width: 100%; }
  .pg-live-pct { font-size: 18px; }

  .pg-stage { grid-template-columns: 36px 1fr; border-radius: 10px; }
  .pg-stage-num { width: 24px; height: 24px; font-size: 12px; }
  .pg-stage-title { font-size: 16px; }
  .pg-stage-status { font-size: 10px; padding: 3px 8px; }
  .pg-stage-intro { font-size: 14px; margin: 6px 0 0; }
  .pg-stage-outcome { font-size: 13px; margin: 6px 0 0; }

  .pg-lessons { gap: 6px; margin: 10px 0 0; }
  .pg-lesson-link, .pg-lesson-static { padding: 8px 9px; margin: 0 -9px; gap: 10px; }
  .pg-lesson-num { width: 20px; height: 20px; font-size: 10px; }
  .pg-lesson-title { font-size: 13px; }
  .pg-lesson-outcome { font-size: 11.5px; }
  .pg-lesson-pill { font-size: 9.5px; padding: 2px 7px; }
  .pg-lesson-go { font-size: 11px; }

  .pg-gate { padding: 10px 12px; margin: 10px 0 0; gap: 10px; }
  .pg-gate-title { font-size: 13px; }
  .pg-gate-note { font-size: 12px; }
  .pg-gate-ta { min-height: 80px; font-size: 13px; padding: 8px 10px; }
  .pg-gate-btn { min-height: 44px; font-size: 12px; padding: 10px 12px; }
  .pg-gate-ic { width: 20px; height: 20px; }

  .pg-cta { min-height: 44px; padding: 10px 12px; gap: 8px; font-size: 14px; }
  .pg-cta-tag { font-size: 10px; padding: 3px 8px; }
  .pg-cta-title { font-size: 14px; }
  .pg-cta-go { font-size: 12px; margin-left: auto; }

  .pg-foot { font-size: 12px; margin: 20px auto 0; }
  .pg-signin { padding: 10px 12px; font-size: 13px; }
  .pg-signin-btn { font-size: 12px; padding: 7px 12px; }
}

/* Tablet and larger screens (640px+) */
@media (min-width: 640px) {
  .pg { padding: 40px 20px 72px; }

  /* Ensure minimum touch targets remain on larger screens */
  .pg-cta, .pg-gate-btn { min-height: 44px; }
  .pg-lesson-link { min-height: 44px; display: flex; align-items: center; }
}
`;
