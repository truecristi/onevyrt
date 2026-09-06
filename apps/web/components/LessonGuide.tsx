"use client";
/**
 * LessonGuide — the live, walkable per-module step. The server passes the module
 * STRUCTURE (stage, title, outcome, teaching, assignment, tool route) so the page
 * renders with no flash; this client component then overlays the signed-in
 * learner's real status for THIS module from /api/programme/enrollment (the
 * engine's buildProgrammeMap) and wires the action the journey needs:
 * "Submit for review" (POST …/submit). (A "Mark as started" button used to sit
 * next to the tool link, but canSubmit already accepts status "available"
 * directly — the "in_progress" transition it caused gated nothing, so it was
 * retired; see withLessonParam below for the tool-link change.)
 *
 * It respects the same locked-in-order rule the hub does: a module the learner
 * hasn't unlocked yet shows a clear locked state with the submit disabled, and an
 * already-approved module shows a done state but still lets them revisit the tool.
 * Visual language mirrors ProgrammeJourney (same --ds tokens, the per-stage --st
 * accent, card/pill styling) and is theme-aware via the design-system tokens.
 */
import { useEffect, useState } from "react";
import type { ModuleTeaching } from "../lib/programme-manual";
import { LessonVisualsRenderer } from "./LessonVisualsRenderer";

type PsychologicalState = "uncertainty" | "clarity" | "confidence" | "control" | "momentum" | "freedom";
type LessonStatus = "locked" | "available" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";

export interface LessonGuideChecklistItem { id: string; label: string; }
export interface LessonGuideAssignment {
  title: string;
  instructions: string;
  evidencePrompt: string;
  checklist: LessonGuideChecklistItem[];
}
/** The module immediately before/after this one in the locked journey order —
 *  enough to render a prev/next link. The destination page enforces its own
 *  lock state, so these are always navigable (you can read ahead, not act ahead). */
export interface LessonNeighbor { id: string; title: string; }

// Only the slice of the enrollment payload this page reads: THIS module's status,
// found in map.nodes[].lessons[] by id (the same map the hub renders from).
interface MapLesson { id: string; status: LessonStatus; }
interface MapNode { lessons: MapLesson[]; }
interface ProgrammeMap { nodes: MapNode[]; }

// The map above only carries status — a lesson's own submission history (what
// the learner actually turned in, and any coach feedback) lives on the raw
// enrollment instead, keyed the same way by lessonId.
interface Submission { submittedAt: string; evidence: string; reviewStatus: "pending" | "approved" | "changes_requested"; coachFeedback?: string; }
interface EnrollmentLessonEntry { lessonId: string; submissions?: Submission[]; }
interface Enrollment { lessons: EnrollmentLessonEntry[]; }

// The workspace's Business Readiness Score, carried on the same response —
// surfaced only on the programme's Start/Finish bookend modules.
// readinessBaseline is a newer field landing in a separate change, so it's
// read defensively: it may be absent on an older response, or explicitly
// null for a workspace with no baseline captured yet.
type ReadinessLabel = "no_data" | "fragile" | "developing" | "strong";
interface ReadinessBaseline { score: number; capturedAt: string; }
interface BusinessSnapshot { readinessScore: number | null; readinessLabel: ReadinessLabel; readinessBaseline?: ReadinessBaseline | null; }

interface Props {
  lessonId: string;
  stageTitle: string;
  stageState: PsychologicalState;
  moduleTitle: string;
  outcome: string;
  content: string;
  /** The expanded manual teaching (What this is / Why / How / Example). When
   *  present it replaces the plain `content` paragraph with the structured read;
   *  when null, `content` is the fallback so nothing breaks for an un-authored module. */
  teaching?: ModuleTeaching | null;
  /** A single lesson video and/or supplementary links, when this module has
   *  them (curriculum-content.ts's own videoUrl/resourceUrls fields —
   *  populated for some lessons, independent of `teaching`). Rendered
   *  right below the content/teaching block, above the tool link. */
  videoUrl?: string;
  resourceUrls?: string[];
  toolHref: string | null;
  assignment: LessonGuideAssignment | null;
  /** This module's 1-based place inside its chapter, and the chapter's size —
   *  rendered as "Module 2 of 5" so the learner is never lost. Both 0 when unknown. */
  numInStage?: number;
  countInStage?: number;
  prev?: LessonNeighbor | null;
  next?: LessonNeighbor | null;
  /** Where prev/next neighbour links point: `${basePath}/${neighbor.id}`.
   *  Defaults to "/programme/lesson" (the whole-programme guided path); a
   *  bespoke chapter route (e.g. Chapter 4's own /programme/chapter-4/[id])
   *  passes its own basePath so a neighbour's `id` can be that chapter's own
   *  identifier (a subchapter code like "4.2") rather than the engine's
   *  lessonId — this prop never dereferences `id`, it only builds a URL. */
  basePath?: string;
  /** The top "← Back to…" link's destination and label. Defaults to the
   *  whole-programme hub, matching every existing caller exactly. */
  backHref?: string;
  backLabel?: string;
  /** Suppresses the top back-link entirely — for an embedding that already
   *  has its own way out (a modal's close button, e.g. ProgrammeCentre's
   *  lesson pane) where a link to a full page would navigate away from the
   *  modal's own shell instead of just closing it. Doesn't affect the
   *  prev/next nav (that only renders when prev/next are actually passed,
   *  which an embedded caller can simply omit). */
  hideBack?: boolean;
  /** Called right after a successful submission. This component always
   *  refreshes its OWN status from a fresh /api/programme/enrollment fetch
   *  regardless — this is only for a parent that keeps its own separate
   *  copy of enrollment/status data alongside this component (e.g.
   *  ProgrammeCentre's sidebar) and needs to know when to refetch it too. */
  onSubmitted?: () => void;
}

const STATUS_META: Record<LessonStatus, { label: string; cls: string }> = {
  locked: { label: "Locked", cls: "locked" },
  available: { label: "Ready to start", cls: "neutral" },
  in_progress: { label: "In progress", cls: "active" },
  submitted: { label: "In review", cls: "review" },
  changes_requested: { label: "Changes requested", cls: "changes" },
  approved: { label: "Done", cls: "done" },
  completed: { label: "Done", cls: "done" },
};

const READINESS_TEXT: Record<Exclude<ReadinessLabel, "no_data">, string> = {
  fragile: "Fragile",
  developing: "Developing",
  strong: "Strong",
};

/** Appends this lesson's id to the tool link as a `lesson` query param, so the
 *  destination tool can render a "back to your lesson" strip. Respects an
 *  existing query string on `toolHref` (append with `&`, not `?`), and passes
 *  `null` straight through since a module can have no tool at all. */
function withLessonParam(href: string | null, lessonId: string): string | null {
  if (!href) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}lesson=${encodeURIComponent(lessonId)}`;
}

export function LessonGuide({ lessonId, stageTitle, stageState, moduleTitle, outcome, content, teaching = null, videoUrl, resourceUrls, toolHref, assignment, numInStage = 0, countInStage = 0, prev = null, next = null, basePath = "/programme/lesson", backHref = "/programme", backLabel = "← Back to your programme", hideBack = false, onSubmitted }: Props) {
  const [phase, setPhase] = useState<"loading" | "anon" | "ok" | "error">("loading");
  const [status, setStatus] = useState<LessonStatus | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [evidence, setEvidence] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [notice, setNotice] = useState("");
  // This lesson's own last submission (if any) and the workspace's Business
  // Readiness snapshot — both ride along on the same /enrollment response.
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);

  // Load (and reload after an action) THIS module's live status. Mirrors the
  // ProgrammeJourney fetch: 401 → signed-out, any other non-OK → a soft error
  // state that still shows the teaching + tool. Never throws.
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
        const map = (j.map as ProgrammeMap | undefined) ?? null;
        let s: LessonStatus | null = null;
        if (map) {
          for (const n of map.nodes) { const l = n.lessons.find((x) => x.id === lessonId); if (l) { s = l.status; break; } }
        }
        setStatus(s);
        setRole((j.role as string | undefined) ?? null);

        // The raw enrollment (not the map) carries this lesson's submission
        // history — take the latest one, if any, so a returning learner sees
        // what they actually turned in rather than only a status pill.
        const enrollment = (j.enrollment as Enrollment | undefined) ?? null;
        const entry = enrollment?.lessons.find((l) => l.lessonId === lessonId);
        const subs = entry?.submissions;
        setLastSubmission(subs && subs.length > 0 ? subs[subs.length - 1]! : null);

        setSnapshot((j.snapshot as BusinessSnapshot | undefined) ?? null);
        setPhase("ok");
      } catch { if (live) setPhase("error"); }
    })();
    return () => { live = false; };
  }, [lessonId, reloadKey]);

  const submit = async () => {
    if (submitBusy || !evidence.trim()) return;
    setSubmitBusy(true); setActionErr(""); setNotice("");
    try {
      const r = await fetch(`/api/programme/lessons/${encodeURIComponent(lessonId)}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence, checklistChecked: [...checked] }),
      });
      if (r.status === 401) { setActionErr("Please sign in to submit your work."); setPhase("anon"); setSubmitBusy(false); return; }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setActionErr((d as { error?: string }).error || "Couldn't submit — please try again.");
        setSubmitBusy(false); return;
      }
      setNotice("Submitted ✓ — if a coach is on this workspace they'll review it; on the self-paced track your work is approved automatically and the next module unlocks.");
      setEvidence("");
      setChecked(new Set());
      setReloadKey((k) => k + 1);
      onSubmitted?.();
    } catch { setActionErr("Network error — is the app reachable?"); }
    setSubmitBusy(false);
  };

  const toggle = (id: string) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const meta = status ? STATUS_META[status] : null;
  // Managers see all content unlocked for reviewing learner progress
  const isLocked = status === "locked" && role !== "manager";
  const isDone = status === "approved" || status === "completed";
  const canSubmit = phase === "ok" && (status === "available" || status === "in_progress" || status === "changes_requested");
  const showTool = !!toolHref && !isLocked; // a locked module shouldn't send you into its tool yet (unless you're a manager)
  const toolLink = withLessonParam(toolHref, lessonId);
  // Readiness only means something as a "where did I start / where am I now"
  // signal on the programme's two bookend modules.
  const showReadiness = lessonId === "m-start-assessment" || lessonId === "m-finish-transformation";

  return (
    <div className="lg" data-state={stageState}>
      <style>{css}</style>

      {!hideBack && <a className="lg-back" href={backHref}>{backLabel}</a>}

      <header className="lg-head">
        <div className="lg-head-top">
          <span className="lg-chip">{stageTitle}</span>
          {countInStage > 0 && <span className="lg-count">Module {numInStage} of {countInStage}</span>}
          {meta && <span className={`lg-pill ${meta.cls}`}>{meta.label}</span>}
        </div>
        <h1 className="lg-title">{moduleTitle}</h1>
        {outcome && <p className="lg-outcome">{outcome}</p>}
        {showReadiness && snapshot && (
          <p className="lg-readiness">
            <span className="lg-readiness-label">Readiness</span>
            <span className={`lg-readiness-value rd-${snapshot.readinessLabel}`}>
              {snapshot.readinessLabel === "no_data"
                ? "Not started yet — it appears once you log goals, assumptions or experiments."
                : `${READINESS_TEXT[snapshot.readinessLabel]} (${snapshot.readinessScore})`}
            </span>
            {lessonId === "m-finish-transformation" && snapshot.readinessBaseline && snapshot.readinessScore != null && (
              <span className="lg-readiness-delta">Start {snapshot.readinessBaseline.score} → now {snapshot.readinessScore}</span>
            )}
          </p>
        )}
      </header>

      {/* Live status banner — the one clear "where does this module stand for me". */}
      {phase === "anon" && (
        <div className="lg-banner anon">
          <span>Sign in to track your progress, mark this module started and submit it for coach review.</span>
          <a className="lg-banner-btn" href="/">Sign in →</a>
        </div>
      )}
      {phase === "error" && (
        <div className="lg-banner error">
          We couldn&rsquo;t load your progress just now. You can still read the module and open the tool — refresh to try the actions again.
        </div>
      )}
      {phase === "ok" && isLocked && (
        <div className="lg-banner locked">
          <strong>This module is locked.</strong> The programme unlocks in order — finish the previous step and get it approved, and this one opens up.
        </div>
      )}
      {phase === "ok" && status === "submitted" && (
        <div className="lg-banner review">
          <strong>Submitted — in review.</strong> It&rsquo;ll come back approved, or with changes requested. You can still revisit the tool below in the meantime.
        </div>
      )}
      {phase === "ok" && status === "changes_requested" && (
        <div className="lg-banner changes">
          <strong>Your coach requested changes.</strong> Update your work in the tool, then submit again below.
        </div>
      )}
      {phase === "ok" && isDone && (
        <div className="lg-banner done">
          <strong>Module complete.</strong> Nice work — you can revisit the tool anytime.
        </div>
      )}

      {/* Teaching + the way into the tool. When the module has expanded manual
          teaching, render the structured read; otherwise the base paragraph. */}
      <section className="lg-card">
        {teaching ? (
          <div className="lg-read">
            <div className="lg-read-block">
              <h2 className="lg-read-h">What this is</h2>
              <p className="lg-read-p">{teaching.whatThisIs}</p>
            </div>
            <div className="lg-read-block">
              <h2 className="lg-read-h">Why it matters</h2>
              <p className="lg-read-p">{teaching.why}</p>
            </div>
            {teaching.mantraPrompt && (
              <div className="lg-read-block">
                <h2 className="lg-read-h accent">Your why — one line to come back to</h2>
                <p className="lg-mantra">{teaching.mantraPrompt}</p>
              </div>
            )}
            <div className="lg-read-block">
              <h2 className="lg-read-h">How to do it</h2>
              <ol className="lg-how">
                {teaching.how.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>
            {teaching.example && (
              <div className="lg-read-block">
                <h2 className="lg-read-h">Example</h2>
                <p className="lg-example">{teaching.example}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="lg-card-title">What to do in this module</h2>
            {content && <p className="lg-content">{content}</p>}
          </>
        )}
        {videoUrl && (
          <p className="lg-media-link"><a href={videoUrl} target="_blank" rel="noreferrer">▶ Watch the lesson video</a></p>
        )}
        {resourceUrls && resourceUrls.length > 0 && (
          <div className="lg-resources">
            {resourceUrls.map((u) => <p key={u} className="lg-media-link"><a href={u} target="_blank" rel="noreferrer">📎 {u}</a></p>)}
          </div>
        )}
        {showTool && (
          <div className="lg-tool-row">
            {/* target=_blank: opens in a new tab so leaving for the tool never
                unloads this page and wipes the evidence draft / checklist below.
                The lesson id rides along as a query param so the tool can show
                a "back to your lesson" strip. */}
            <a className="lg-tool" href={toolLink!} target="_blank" rel="noopener">Open the tool →</a>
          </div>
        )}
        {!toolHref && <p className="lg-note">If a coach is on this workspace, they&rsquo;ll point you to the right tool for this step.</p>}
      </section>

      {/* Lesson visuals (when available for this module) — rendered between
          teaching and assignment to provide visual context and reinforce concepts. */}
      <LessonVisualsRenderer lessonId={lessonId} />

      {/* The learner's own last submission for this module — read-only, shown
          above the live assignment card so a returning learner (or one whose
          coach requested changes) can see exactly what they turned in before. */}
      {assignment && lastSubmission && (status === "submitted" || status === "changes_requested" || status === "approved") && (
        <section className="lg-card lg-submission">
          <div className="lg-submission-head">
            <span className="lg-submission-title">Your submission — {new Date(lastSubmission.submittedAt).toLocaleDateString()}</span>
          </div>
          <p className="lg-submission-evidence">{lastSubmission.evidence}</p>
          {lastSubmission.coachFeedback && (
            <div className="lg-submission-feedback">
              <span className="lg-submission-feedback-label">Coach feedback</span>
              <span className="lg-submission-feedback-text">{lastSubmission.coachFeedback}</span>
            </div>
          )}
        </section>
      )}

      {/* The assignment: what to submit, the checklist, and the evidence box. */}
      {assignment && (
        <section className="lg-card">
          <h2 className="lg-card-title">{assignment.title}</h2>
          {assignment.instructions && <p className="lg-instructions">{assignment.instructions}</p>}

          {canSubmit ? (
            <>
              {assignment.checklist.length > 0 && (
                <ul className="lg-checklist">
                  {assignment.checklist.map((c) => (
                    <li key={c.id}>
                      <label className="lg-check">
                        <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} />
                        <span>{c.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <label className="lg-evidence-label" htmlFor="lg-evidence">{assignment.evidencePrompt}</label>
              <textarea
                id="lg-evidence"
                className="lg-textarea"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Your evidence…"
              />
              {actionErr && <div className="lg-msg err">{actionErr}</div>}
              {notice && <div className="lg-msg ok">{notice}</div>}
              <div className="lg-actions">
                <button className="lg-btn primary" onClick={() => void submit()} disabled={submitBusy || !evidence.trim()}>
                  {submitBusy ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            </>
          ) : (
            <>
              {assignment.checklist.length > 0 && (
                <ul className="lg-checklist static">
                  {assignment.checklist.map((c) => (
                    <li key={c.id}><span className="lg-check-dot" aria-hidden="true" /><span>{c.label}</span></li>
                  ))}
                </ul>
              )}
              <p className="lg-evidence-label static">{assignment.evidencePrompt}</p>
              {actionErr && <div className="lg-msg err">{actionErr}</div>}
              {notice && <div className="lg-msg ok">{notice}</div>}
              {isLocked && <p className="lg-note">Submitting opens once this module is unlocked.</p>}
              {status === "submitted" && <p className="lg-note">Your submission is in — nothing more to do right now.</p>}
              {isDone && <p className="lg-note">This module is approved. There&rsquo;s nothing left to submit.</p>}
              {phase === "anon" && <p className="lg-note">Sign in to fill this in and submit it.</p>}
              {phase === "loading" && <p className="lg-note">Checking your progress…</p>}
              {phase === "error" && <p className="lg-note">Progress unavailable — refresh to submit.</p>}
            </>
          )}
        </section>
      )}

      {/* Walk the journey: the module before and after this one, in locked order.
          Each destination enforces its own lock state, so reading ahead is fine —
          acting ahead is not. */}
      {(prev || next) && (
        <nav className="lg-nav" aria-label="Move through the programme">
          {prev ? (
            <a className="lg-nav-link prev" href={`${basePath}/${encodeURIComponent(prev.id)}`}>
              <span className="lg-nav-dir">← Previous module</span>
              <span className="lg-nav-title">{prev.title}</span>
            </a>
          ) : <span className="lg-nav-spacer" aria-hidden="true" />}
          {next ? (
            <a className="lg-nav-link next" href={`${basePath}/${encodeURIComponent(next.id)}`}>
              <span className="lg-nav-dir">Next module →</span>
              <span className="lg-nav-title">{next.title}</span>
            </a>
          ) : (
            <a className="lg-nav-link next done-link" href={backHref}>
              <span className="lg-nav-dir">Back to your programme →</span>
              <span className="lg-nav-title">You&rsquo;re at the finish line</span>
            </a>
          )}
        </nav>
      )}
    </div>
  );
}

const css = `
.lg { max-width: 760px; margin: 0 auto; padding: 28px 20px 72px; color: var(--ds-text-primary, #111827); }
.lg-back { display: inline-block; text-decoration: none; font-size: 13px; font-weight: 600; color: var(--ds-text-secondary, #475569); margin-bottom: 18px; }
.lg-back:hover { color: var(--st, #088057); }

.lg-head { margin-bottom: 6px; }
.lg-head-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.lg-chip { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;
  color: var(--st, #088057); background: color-mix(in srgb, var(--st, #088057) 12%, var(--ds-surface, #fff)); }
.lg-pill { margin-left: auto; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); }
.lg-pill.done { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.lg-pill.review { background: var(--ds-info-soft, #e6effe); color: var(--ds-info, #2563eb); }
.lg-pill.changes { background: var(--ds-warning-soft, #fff4e0); color: var(--ds-warning, #b45309); }
.lg-pill.active { background: var(--ds-brand-soft, #e7f6f0); color: var(--ds-brand-active, #088057); }
.lg-pill.locked { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-tertiary); }
.lg-pill.neutral { background: var(--ds-brand-soft, #e7f6f0); color: var(--ds-brand-active, #088057); }
.lg-count { font-size: 11px; font-weight: 700; letter-spacing: .02em; color: var(--ds-text-tertiary, #586173);
  padding: 3px 9px; border-radius: 999px; background: var(--ds-bg-subtle, #f1f4f9); }
.lg-title { font-size: clamp(24px, 4vw, 34px); line-height: 1.14; font-weight: 800; letter-spacing: -.01em; margin: 0 0 10px; text-wrap: balance; }
.lg-outcome { font-size: 15.5px; color: var(--ds-text-secondary, #475569); margin: 0; line-height: 1.5; }

.lg-readiness { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; margin: 10px 0 0; color: var(--ds-text-secondary, #475569); }
.lg-readiness-label { font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; color: var(--ds-text-tertiary, #586173); }
.lg-readiness-value { font-weight: 750; }
.lg-readiness-value.rd-fragile { color: var(--ds-danger, #c81e1e); }
.lg-readiness-value.rd-developing { color: var(--ds-warning, #b45309); }
.lg-readiness-value.rd-strong { color: var(--ds-success, #088057); }
.lg-readiness-value.rd-no_data { color: var(--ds-text-tertiary, #586173); font-weight: 600; }
.lg-readiness-delta { font-size: 12px; color: var(--ds-text-tertiary, #586173); padding-left: 8px; border-left: 1px solid var(--ds-border-subtle, #e8ecf2); }

.lg-banner { margin: 20px 0 0; border-radius: var(--ds-radius-lg, 14px); padding: 13px 16px; font-size: 14px; line-height: 1.5;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--ds-border-subtle, #e8ecf2); background: var(--ds-surface, #fff); color: var(--ds-text-primary); }
.lg-banner strong { font-weight: 750; }
.lg-banner.anon { background: var(--ds-brand-soft, #e7f6f0); border-color: var(--ds-brand, #088057); }
.lg-banner.locked { background: var(--ds-bg-subtle, #f1f4f9); border-color: var(--ds-border-default, #dde3eb); color: var(--ds-text-secondary); }
.lg-banner.review { background: var(--ds-info-soft, #e6effe); border-color: color-mix(in srgb, var(--ds-info, #2563eb) 40%, transparent); }
.lg-banner.changes { background: var(--ds-warning-soft, #fff4e0); border-color: color-mix(in srgb, var(--ds-warning, #b45309) 40%, transparent); }
.lg-banner.done { background: var(--ds-success-soft, #e7f6f0); border-color: color-mix(in srgb, var(--ds-success, #088057) 40%, transparent); }
.lg-banner.error { background: var(--ds-bg-subtle, #f1f4f9); border-color: var(--ds-border-default, #dde3eb); color: var(--ds-text-secondary); }
.lg-banner-btn { text-decoration: none; font-weight: 700; font-size: 13px; color: #fff; background: var(--ds-brand-solid, #088057); border-radius: 9px; padding: 8px 14px; white-space: nowrap; }

.lg-card { margin-top: 18px; background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e8ecf2);
  border-radius: var(--ds-radius-lg, 14px); padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.lg-card-title { font-size: 16px; font-weight: 750; margin: 0 0 10px; }
.lg-content { font-size: 15px; line-height: 1.65; color: var(--ds-text-primary, #111827); margin: 0; white-space: pre-wrap; }
.lg-resources { margin-top: 4px; }
.lg-media-link { margin: 8px 0 0; }
.lg-media-link a { color: var(--st, #088057); font-size: 13.5px; font-weight: 600; text-decoration: none; }
.lg-media-link a:hover { text-decoration: underline; }

/* Read-only recap of the learner's own last submission, shown above the
   (possibly still-editable) assignment card. */
.lg-submission-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.lg-submission-title { font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; color: var(--ds-text-tertiary, #586173); }
.lg-submission-evidence { font-size: 14.5px; line-height: 1.6; color: var(--ds-text-primary, #111827); margin: 0; white-space: pre-wrap; }
.lg-submission-feedback { margin-top: 14px; padding: 11px 13px; border-radius: var(--ds-radius-sm, 9px);
  background: var(--ds-bg-subtle, #f1f4f9); border-left: 3px solid var(--st, #088057); }
.lg-submission-feedback-label { display: block; font-size: 10.5px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase;
  color: var(--ds-text-tertiary, #586173); margin-bottom: 4px; }
.lg-submission-feedback-text { font-size: 13.5px; line-height: 1.55; color: var(--ds-text-primary, #111827); }

/* Structured manual read: What this is / Why / (Your why) / How / Example. */
.lg-read { display: flex; flex-direction: column; gap: 18px; }
.lg-read-block { display: block; }
.lg-read-h { font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase;
  color: var(--ds-text-tertiary, #586173); margin: 0 0 7px; }
.lg-read-h.accent { color: var(--st, #088057); }
.lg-read-p { font-size: 15px; line-height: 1.65; color: var(--ds-text-primary, #111827); margin: 0; }
.lg-mantra { font-size: 15.5px; line-height: 1.55; font-style: italic; color: var(--ds-text-primary, #111827);
  margin: 0; padding: 8px 0 8px 15px; border-left: 3px solid var(--st, #088057); }
.lg-how { margin: 0; padding: 0; list-style: none; counter-reset: how; display: flex; flex-direction: column; gap: 9px; }
.lg-how li { position: relative; padding-left: 34px; font-size: 14.5px; line-height: 1.5; color: var(--ds-text-primary, #111827); }
.lg-how li::before { counter-increment: how; content: counter(how); position: absolute; left: 0; top: -1px;
  width: 23px; height: 23px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--st, #088057);
  background: color-mix(in srgb, var(--st, #088057) 12%, var(--ds-surface, #fff));
  border: 1px solid color-mix(in srgb, var(--st, #088057) 34%, transparent); }
.lg-example { font-size: 14px; line-height: 1.6; color: var(--ds-text-secondary, #475569); margin: 0;
  padding: 12px 14px; border-radius: var(--ds-radius-sm, 9px);
  background: var(--ds-bg-subtle, #f1f4f9); border: 1px solid var(--ds-border-subtle, #e8ecf2); }

.lg-instructions { font-size: 14px; line-height: 1.6; color: var(--ds-text-secondary, #475569); margin: 0 0 14px; }
.lg-note { font-size: 13px; color: var(--ds-text-tertiary, #586173); margin: 12px 0 0; }

.lg-tool-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
.lg-tool { display: inline-flex; align-items: center; text-decoration: none; font-size: 14px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--ds-brand-solid, #088057), #0bb87f); border-radius: 11px; padding: 11px 18px;
  box-shadow: 0 10px 26px -12px rgba(10,158,110,.5); transition: transform .12s, box-shadow .15s; }
.lg-tool:hover { transform: translateY(-1px); box-shadow: 0 16px 32px -12px rgba(10,158,110,.55); }

.lg-btn { font: inherit; font-size: 13.5px; font-weight: 700; border-radius: 11px; padding: 10px 16px; cursor: pointer;
  border: 1px solid transparent; transition: background .15s, border-color .15s, opacity .15s; }
.lg-btn:disabled { opacity: .55; cursor: default; }
.lg-btn.primary { background: var(--ds-brand-solid, #088057); color: #fff; }
.lg-btn.primary:hover:not(:disabled) { background: var(--ds-brand-solid-hover, #077049); }
.lg-btn.ghost { background: transparent; border-color: var(--ds-border-default, #dde3eb); color: var(--ds-text-primary, #111827); }
.lg-btn.ghost:hover:not(:disabled) { border-color: var(--st, #088057); color: var(--st, #088057); }

.lg-checklist { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.lg-check { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.4; cursor: pointer; color: var(--ds-text-primary, #111827); }
.lg-check input { margin-top: 2px; width: 16px; height: 16px; accent-color: var(--ds-brand, #088057); flex: none; }
.lg-checklist.static li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.4; color: var(--ds-text-secondary, #475569); }
.lg-check-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; background: var(--ds-border-strong, #cbd5e1); }

.lg-evidence-label { display: block; font-size: 13px; font-weight: 600; color: var(--ds-text-primary, #111827); margin: 0 0 7px; }
.lg-evidence-label.static { color: var(--ds-text-secondary, #475569); font-weight: 500; }
.lg-textarea { width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; padding: 11px 12px; font: inherit; font-size: 14px;
  background: var(--ds-surface, #fff); color: var(--ds-text-primary, #111827); border: 1px solid var(--ds-border-default, #dde3eb); border-radius: var(--ds-radius-sm, 9px); }
.lg-textarea:focus { outline: none; border-color: var(--ds-brand, #088057); box-shadow: var(--ds-ring, 0 0 0 3px rgba(10,158,110,.2)); }
.lg-textarea::placeholder { color: var(--ds-text-disabled, #94a3b8); }

.lg-msg { font-size: 13px; margin-top: 10px; }
.lg-msg.err { color: var(--ds-danger, #c81e1e); }
.lg-msg.ok { color: var(--ds-success, #12703a); }
.lg-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

.lg-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 30px; }
.lg-nav-spacer { display: block; }
.lg-nav-link { display: flex; flex-direction: column; gap: 4px; text-decoration: none; padding: 14px 16px;
  border-radius: var(--ds-radius-lg, 14px); border: 1px solid var(--ds-border-subtle, #e8ecf2);
  background: var(--ds-surface, #fff); transition: border-color .15s, transform .12s, box-shadow .15s; }
.lg-nav-link:hover { border-color: var(--st, #088057); transform: translateY(-1px); box-shadow: 0 8px 22px -14px rgba(16,24,40,.4); }
.lg-nav-link.next { text-align: right; align-items: flex-end; }
.lg-nav-dir { font-size: 11.5px; font-weight: 700; letter-spacing: .02em; color: var(--st, #088057); }
.lg-nav-title { font-size: 14px; font-weight: 650; color: var(--ds-text-primary, #111827); line-height: 1.3; }
.lg-nav-link.done-link .lg-nav-title { color: var(--ds-text-secondary, #475569); }
@media (max-width: 560px) { .lg-nav { grid-template-columns: 1fr; } .lg-nav-link.next { text-align: left; align-items: flex-start; } }

.lg[data-state="uncertainty"] { --st: #64748b; }
.lg[data-state="clarity"] { --st: #2563eb; }
.lg[data-state="confidence"] { --st: #088057; }
.lg[data-state="control"] { --st: #b45309; }
.lg[data-state="momentum"] { --st: #7c3aed; }
.lg[data-state="freedom"] { --st: #12703a; }
`;
