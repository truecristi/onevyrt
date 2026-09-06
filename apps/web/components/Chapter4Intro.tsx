"use client";
/**
 * Chapter4Intro — the live overlay for /programme/chapter-4. The server page
 * passes the STRUCTURE (chapter title/outcome, the 5 subchapters with their
 * engine moduleId) so it renders with no flash; this client component then
 * reads /api/programme/enrollment (the same endpoint ProgrammeJourney and
 * LessonGuide already use) for the learner's real position: whether Chapter 3
 * is approved yet (the prerequisite), each subchapter's status, and the
 * chapter-level gate (ready to submit / awaiting review / approved) — the
 * SAME chapterGates() the whole rest of the programme reads, so this page can
 * never disagree with /programme about where the learner actually stands.
 *
 * Submitting the chapter's output for coach review is also handled here
 * (POST /api/programme/chapters/chapter-4/submit) — the exact endpoint
 * ProgrammeJourney's generic per-chapter gate block already posts to, so a
 * submission made from either surface is the same submission.
 */
import { useEffect, useState } from "react";

type LessonStatus = "locked" | "available" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
type ChapterGateState = "locked" | "in_progress" | "ready_to_submit" | "awaiting_review" | "changes_requested" | "approved";
interface ChapterSubmission { evidence: string; coachFeedback?: string; }
interface ChapterGate { stageId: string; state: ChapterGateState; lessonsComplete: number; lessonsTotal: number; submission?: ChapterSubmission; }
interface MapLesson { id: string; status: LessonStatus; }
interface MapNode { stageId: string; lessons: MapLesson[]; }
interface ProgrammeMap { nodes: MapNode[]; }

export interface Chapter4IntroSubchapter { code: string; slug: string; title: string; moduleId: string; }

const STATUS_META: Record<LessonStatus, { label: string; cls: string }> = {
  locked: { label: "Locked", cls: "locked" },
  available: { label: "Not started", cls: "neutral" },
  in_progress: { label: "In progress", cls: "active" },
  submitted: { label: "In review", cls: "review" },
  changes_requested: { label: "Changes requested", cls: "changes" },
  approved: { label: "Done", cls: "done" },
  completed: { label: "Done", cls: "done" },
};

export function Chapter4Intro({ stageTitle, stageOutcome, subchapters }: { stageTitle: string; stageOutcome: string; subchapters: Chapter4IntroSubchapter[] }) {
  const [phase, setPhase] = useState<"loading" | "anon" | "ok" | "error">("loading");
  const [map, setMap] = useState<ProgrammeMap | null>(null);
  const [gate, setGate] = useState<ChapterGate | null>(null);
  const [ch3Locked, setCh3Locked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
        const gates = (j.chapterGates as ChapterGate[] | undefined) ?? [];
        setMap((j.map as ProgrammeMap) ?? null);
        setGate(gates.find((g) => g.stageId === "chapter-4") ?? null);
        setCh3Locked(gates.find((g) => g.stageId === "chapter-3")?.state !== "approved" && gates.find((g) => g.stageId === "chapter-4")?.state === "locked");
        setPhase("ok");
      } catch { if (live) setPhase("error"); }
    })();
    return () => { live = false; };
  }, [reloadKey]);

  const statusOf = (moduleId: string): LessonStatus | null => {
    if (!map) return null;
    const node = map.nodes.find((n) => n.stageId === "chapter-4");
    return node?.lessons.find((l) => l.id === moduleId)?.status ?? null;
  };

  const firstUnlocked = subchapters.find((s) => {
    const st = statusOf(s.moduleId);
    return st === "available" || st === "in_progress" || st === "submitted" || st === "changes_requested";
  });
  const startHref = firstUnlocked ? `/programme/chapter-4/${firstUnlocked.code}` : `/programme/chapter-4/${subchapters[0]?.code ?? "4.1"}`;
  const allDone = subchapters.length > 0 && subchapters.every((s) => { const st = statusOf(s.moduleId); return st === "approved" || st === "completed"; });

  const submit = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/programme/chapters/chapter-4/submit", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence: draft.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Couldn't submit — try again."); setBusy(false); return; }
      setDraft(""); setBusy(false);
      setReloadKey((k) => k + 1);
    } catch { setErr("Network error — try again."); setBusy(false); }
  };

  return (
    <div className="c4i" data-state="momentum">
      <style>{css}</style>

      <a className="c4i-back" href="/programme">← Back to your programme</a>

      <header className="c4i-head">
        <span className="c4i-chip">Chapter 4 · Improve &amp; Scale</span>
        <h1 className="c4i-title">{stageTitle}</h1>
        <p className="c4i-outcome">{stageOutcome}</p>
      </header>

      {phase === "anon" && (
        <div className="c4i-banner anon">
          <span>Sign in to start Chapter 4 and track your progress.</span>
          <a className="c4i-banner-btn" href="/">Sign in →</a>
        </div>
      )}
      {phase === "error" && (
        <div className="c4i-banner error">We couldn&rsquo;t load your progress just now — you can still read the chapter below.</div>
      )}
      {phase === "ok" && ch3Locked && (
        <div className="c4i-banner locked">
          <strong>Chapter 3 isn&rsquo;t approved yet.</strong> Finish and submit your Numbers &amp; Control Dashboard, and get your coach&rsquo;s
          sign-off, before Chapter 4 opens up. <a href="/programme">Go to your programme →</a>
        </div>
      )}

      <section className="c4i-arc">
        <p className="c4i-arc-intro">
          You know your numbers now — so before improving anything, find the ONE thing actually holding growth back. This chapter
          walks that in order:
        </p>
        <ol className="c4i-arc-steps">
          <li><strong>4.1 Find the Bottleneck</strong> — score every growth area, name the single real constraint.</li>
          <li><strong>4.2 Improve Conversion</strong> — fix the weakest step from lead to appointment to sale.</li>
          <li><strong>4.3 Improve Profit</strong> — pull the one price, margin or cost lever with the biggest impact.</li>
          <li><strong>4.4 Systemise &amp; Automate</strong> — move one founder-only task off yourself for good.</li>
          <li><strong>4.5 Build the Growth Plan</strong> — turn all four into one dated, owned 90-day plan and submit it.</li>
        </ol>
        <p className="c4i-output"><span className="c4i-output-label">Output</span> Growth &amp; Improvement Plan</p>
      </section>

      <ol className="c4i-list">
        {subchapters.map((s, i) => {
          const status = statusOf(s.moduleId);
          const meta = status ? STATUS_META[status] : null;
          const locked = status === "locked" || status === null;
          const body = (
            <>
              <span className="c4i-num">{meta?.cls === "done" ? "✓" : i + 1}</span>
              <span className="c4i-item-title">{s.code} — {s.title}</span>
              {meta && <span className={`c4i-pill ${meta.cls}`}>{meta.label}</span>}
            </>
          );
          return (
            <li key={s.code} className={`c4i-item ${meta?.cls ?? ""}`}>
              {locked ? <span className="c4i-item-static">{body}</span> : <a className="c4i-item-link" href={`/programme/chapter-4/${s.code}`}>{body}</a>}
            </li>
          );
        })}
      </ol>

      {phase === "ok" && !ch3Locked && (
        <a className="c4i-cta" href={startHref}>
          {allDone ? "Review your subchapters →" : "Start Chapter 4 →"}
        </a>
      )}

      {phase === "ok" && gate && gate.state !== "locked" && gate.state !== "in_progress" && (
        <section className="c4i-gate" data-gate={gate.state}>
          {gate.state === "ready_to_submit" && (
            <>
              <div className="c4i-gate-title">All 5 subchapters complete — submit your Growth &amp; Improvement Plan</div>
              <textarea className="c4i-ta" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Summarise your Growth & Improvement Plan — your constraint, conversion fix, profit lever, systemised task and 90-day roadmap — for your coach to review." />
              {err && <div className="c4i-err">{err}</div>}
              <button className="c4i-btn" disabled={busy || !draft.trim()} onClick={() => void submit()}>
                {busy ? "Submitting…" : "Submit for approval"}
              </button>
            </>
          )}
          {gate.state === "awaiting_review" && (
            <div className="c4i-gate-title">Submitted — your coach is reviewing your Growth &amp; Improvement Plan.</div>
          )}
          {gate.state === "changes_requested" && (
            <>
              <div className="c4i-gate-title">Your coach asked for changes</div>
              {gate.submission?.coachFeedback && <div className="c4i-gate-note">Coach: {gate.submission.coachFeedback}</div>}
              <textarea className="c4i-ta" value={draft || gate.submission?.evidence || ""} onChange={(e) => setDraft(e.target.value)} />
              {err && <div className="c4i-err">{err}</div>}
              <button className="c4i-btn" disabled={busy || !(draft || gate.submission?.evidence || "").trim()} onClick={() => { if (!draft) setDraft(gate.submission?.evidence ?? ""); void submit(); }}>
                {busy ? "Submitting…" : "Revise & resubmit"}
              </button>
            </>
          )}
          {gate.state === "approved" && (
            <div className="c4i-gate-title">✓ Approved — your Growth &amp; Improvement Plan is complete. <a href="/programme/chapter-4/growth-plan">View it →</a></div>
          )}
        </section>
      )}
    </div>
  );
}

const css = `
.c4i { max-width: 760px; margin: 0 auto; padding: 28px 20px 72px; color: var(--ds-text-primary, #111827); }
.c4i-back { display: inline-block; text-decoration: none; font-size: 13px; font-weight: 600; color: var(--ds-text-secondary, #475569); margin-bottom: 18px; }
.c4i-back:hover { color: var(--st, #7c3aed); }
.c4i-chip { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;
  color: var(--st, #7c3aed); background: color-mix(in srgb, var(--st, #7c3aed) 12%, var(--ds-surface, #fff)); }
.c4i-title { font-size: clamp(24px, 4vw, 34px); line-height: 1.14; font-weight: 800; letter-spacing: -.01em; margin: 10px 0; text-wrap: balance; }
.c4i-outcome { font-size: 15.5px; color: var(--ds-text-secondary, #475569); margin: 0 0 6px; line-height: 1.5; }

.c4i-banner { margin: 18px 0 0; border-radius: var(--ds-radius-lg, 14px); padding: 13px 16px; font-size: 14px; line-height: 1.5;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--ds-border-subtle, #e8ecf2); background: var(--ds-surface, #fff); color: var(--ds-text-primary); }
.c4i-banner a { color: var(--st, #7c3aed); font-weight: 700; text-decoration: none; }
.c4i-banner.anon { background: color-mix(in srgb, var(--st, #7c3aed) 10%, var(--ds-surface, #fff)); border-color: var(--st, #7c3aed); }
.c4i-banner.locked { background: var(--ds-warning-soft, #fff4e0); border-color: color-mix(in srgb, var(--ds-warning, #b45309) 40%, transparent); }
.c4i-banner.error { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); }
.c4i-banner-btn { text-decoration: none; font-weight: 700; font-size: 13px; color: #fff; background: var(--st, #7c3aed); border-radius: 9px; padding: 8px 14px; white-space: nowrap; }

.c4i-arc { margin-top: 20px; background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e8ecf2);
  border-radius: var(--ds-radius-lg, 14px); padding: 18px 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.c4i-arc-intro { font-size: 15px; line-height: 1.6; margin: 0 0 12px; color: var(--ds-text-primary, #111827); }
.c4i-arc-steps { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; font-size: 14px; line-height: 1.5; color: var(--ds-text-secondary, #475569); }
.c4i-arc-steps strong { color: var(--ds-text-primary, #111827); }
.c4i-output { font-size: 13px; margin: 8px 0 0; }
.c4i-output-label { font-weight: 700; color: var(--st, #7c3aed); margin-right: 6px; }

.c4i-list { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.c4i-item-link, .c4i-item-static { display: flex; gap: 12px; align-items: center; text-decoration: none; color: inherit;
  border: 1px solid var(--ds-border-subtle, #e8ecf2); border-radius: 12px; padding: 12px 14px; background: var(--ds-surface, #fff); }
.c4i-item-link:hover { border-color: var(--st, #7c3aed); }
.c4i-item.locked .c4i-item-title { color: var(--ds-text-tertiary, #94a3b8); }
.c4i-num { flex: none; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 700;
  color: var(--ds-text-secondary, #475569); background: var(--ds-bg-subtle, #f1f4f9); }
.c4i-item.done .c4i-num { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.c4i-item-title { font-size: 14.5px; font-weight: 600; }
.c4i-pill { margin-left: auto; font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-secondary); }
.c4i-pill.done { background: var(--ds-success-soft, #e7f6f0); color: var(--ds-success, #088057); }
.c4i-pill.review { background: var(--ds-info-soft, #e6effe); color: var(--ds-info, #2563eb); }
.c4i-pill.changes { background: var(--ds-warning-soft, #fff4e0); color: var(--ds-warning, #b45309); }
.c4i-pill.active { background: color-mix(in srgb, var(--st, #7c3aed) 14%, var(--ds-surface, #fff)); color: var(--st, #7c3aed); }
.c4i-pill.locked { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-tertiary); }

.c4i-cta { display: block; text-align: center; text-decoration: none; margin-top: 20px; border-radius: 12px; padding: 14px 16px;
  background: linear-gradient(135deg, var(--st, #7c3aed), #a78bfa); color: #fff; font-weight: 700; font-size: 15px;
  box-shadow: 0 10px 26px -12px rgba(124,58,237,.5); }

.c4i-gate { margin-top: 20px; padding: 16px 18px; border-radius: var(--ds-radius-lg, 14px); border: 1px solid var(--ds-border-subtle, #e8ecf2); background: var(--ds-bg-subtle, #f1f4f9); }
.c4i-gate[data-gate="approved"] { background: var(--ds-success-soft, #e7f6f0); border-color: color-mix(in srgb, var(--ds-success, #088057) 32%, transparent); }
.c4i-gate[data-gate="awaiting_review"] { background: var(--ds-info-soft, #e6effe); border-color: color-mix(in srgb, var(--ds-info, #2563eb) 30%, transparent); }
.c4i-gate[data-gate="changes_requested"] { background: var(--ds-warning-soft, #fff4e0); border-color: color-mix(in srgb, var(--ds-warning, #b45309) 34%, transparent); }
.c4i-gate[data-gate="ready_to_submit"] { background: color-mix(in srgb, var(--st, #7c3aed) 8%, var(--ds-surface, #fff)); border-color: var(--st, #7c3aed); }
.c4i-gate-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.c4i-gate-title a { color: var(--st, #7c3aed); }
.c4i-gate-note { font-size: 12.5px; color: var(--ds-text-secondary, #475569); margin-bottom: 8px; }
.c4i-ta { width: 100%; box-sizing: border-box; min-height: 90px; resize: vertical; border-radius: 9px; padding: 9px 11px; font: inherit; font-size: 13.5px;
  border: 1px solid var(--ds-border-default, #dadce0); background: var(--ds-surface, #fff); color: var(--ds-text-primary, #111827); margin-bottom: 8px; }
.c4i-err { font-size: 12.5px; color: var(--ds-danger, #dc2626); margin-bottom: 8px; }
.c4i-btn { font: inherit; font-size: 13px; font-weight: 700; border-radius: 9px; padding: 9px 16px; cursor: pointer; border: none;
  background: var(--st, #7c3aed); color: #fff; }
.c4i-btn:disabled { opacity: .55; cursor: default; }
`;
