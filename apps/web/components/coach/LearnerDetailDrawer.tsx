"use client";
/**
 * LearnerDetailDrawer — the coach/admin engagement console's "full picture"
 * drill-down. Opened from a learner row/card on /businesses and
 * /admin/learners, it turns a roster's generic "gone quiet 9d" pill into
 * something a coach can actually act on: exactly which module they stalled
 * on, what's still ahead of them, and what they've done recently — so the
 * reach-out that follows can say "you stalled on Module 7" instead of "hey,
 * checking in".
 *
 * Self-contained, like ReachOutModal: it fetches its own data
 * (GET /api/coach/learner) and renders its own loading/error/forbidden
 * states, so any surface can open it with nothing more than a workspace id.
 * The "Reach out" footer button hands off to the existing ReachOutModal,
 * prefilled with the learner's actual current module rather than a generic
 * "in a while".
 */
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogA11y } from "../../lib/use-dialog-a11y";
import { classifyEngagement, type Engagement } from "../../lib/coach/engagement";
import { ReachOutModal } from "./ReachOutModal";
import { LearnerPurposeCard } from "./LearnerPurposeCard";

type Plan = "free" | "pro" | "business" | "performance";

interface MapLesson {
  id: string;
  title: string;
  order: number;
  status: string;
}
interface MapNode {
  stageId: string;
  title: string;
  order: number;
  output: string | null;
  status: string;
  lessons: MapLesson[];
  completedLessons: number;
  totalLessons: number;
}
interface ActivityEntry {
  at: string;
  action: string;
  detail?: string;
  actorEmail: string;
}
/** Mirrors CoachMessage in components/programme/CoachMessages.tsx — the
 *  learner-facing read side of the same /api/programme/messages history. */
interface CoachMessage {
  id: string;
  at: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
  read: boolean;
}
interface Detail {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  plan: Plan;
  lastActivityAt: string | null;
  summary: {
    totalLessons: number;
    completedLessons: number;
    percentComplete: number;
    currentLessonId: string | null;
    awaitingReview: { lessonId: string }[];
    changesRequested: string[];
  };
  snapshot: {
    readinessScore: number | null;
    readinessLabel: string;
    topGoal: { title: string; level: string; status: string } | null;
    overdueCount: number;
    readinessBaseline: { score: number; capturedAt: string } | null;
  };
  map: {
    nodes: MapNode[];
    overallPercent: number;
    completedLessons: number;
    totalLessons: number;
    currentStageId: string | null;
    currentLessonId: string | null;
  };
  recentActivity: ActivityEntry[];
  whyCreed: { why: string; creed: string } | null;
}

type ViewState = "loading" | "ok" | "error" | "forbidden";
type LessonState = "done" | "current" | "upcoming";

const PILL_TONE: Record<Engagement["tone"], string> = {
  good: "lde-pill--good", info: "lde-pill--info", warn: "lde-pill--warn", danger: "lde-pill--danger", muted: "lde-pill--muted",
};

const READINESS_TEXT: Record<string, string> = {
  no_data: "Not enough data", fragile: "Fragile", developing: "Developing", strong: "Strong",
};
/** readinessLabel is a plain string on the wire (not a closed union here), so
 *  known values get their app-wide display text and anything unrecognised
 *  still reads fine — underscores swapped for spaces, first letter capped. */
function readinessLabelText(label: string): string {
  const known = READINESS_TEXT[label];
  if (known) return known;
  const spaced = label.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : label;
}

/** Plain relative-time phrase ("3h ago", "just now") — no leading verb, so it
 *  reads naturally both after "Last active: " and inside an activity row. */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "recently";
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** "lesson.completed" -> "lesson completed". Deliberately minimal — this is
 *  a light readability pass, not a full label dictionary. */
function humanizeAction(action: string): string {
  return action.replace(/[._]+/g, " ").trim() || action;
}

function byOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/** done if the status string reports completion, current if it's the map's
 *  pointer lesson, everything else is upcoming — deliberately not an
 *  exhaustive switch over LessonStatus values so new statuses fall through
 *  safely instead of needing this file updated too. */
function lessonState(status: string, lessonId: string, currentLessonId: string | null): LessonState {
  if (status.includes("complete")) return "done";
  if (currentLessonId !== null && lessonId === currentLessonId) return "current";
  return "upcoming";
}

const GLYPH: Record<LessonState, string> = { done: "✓", current: "●", upcoming: "○" };
// "current" already has a visible "current" tag next to it (below) — only
// done/upcoming need a hidden label, so screen-reader users can tell them
// apart from just the (aria-hidden) glyph.
const STATE_LABEL: Record<Exclude<LessonState, "current">, string> = { done: "Completed", upcoming: "Upcoming" };

function ModuleChapter({ node, currentLessonId }: { node: MapNode; currentLessonId: string | null }) {
  const lessons = byOrder(node.lessons);
  return (
    <div className="lde-chapter">
      <div className="lde-chapter-head">
        <span className="lde-chapter-title">{node.title}</span>
        <span className="lde-chapter-count">{node.completedLessons}/{node.totalLessons}</span>
      </div>
      <ul className="lde-lessons">
        {lessons.map((lesson) => {
          const st = lessonState(lesson.status, lesson.id, currentLessonId);
          return (
            <li key={lesson.id} className={`lde-lesson lde-lesson--${st}`}>
              <span className={`lde-glyph lde-glyph--${st}`} aria-hidden="true">{GLYPH[st]}</span>
              {st !== "current" && <span className="lde-sr-only">{STATE_LABEL[st]}</span>}
              <span className="lde-lesson-title">{lesson.title}</span>
              {st === "current" && <span className="lde-current-tag">current</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Everything below the always-visible header — only mounted once the fetch
 *  has actually resolved, so it can treat `detail`/`eng` as non-null. */
function LearnerDetailBody({
  detail, eng, wsId, workspaceName, reach, onReach, onCloseReach, messages,
}: {
  detail: Detail;
  eng: Engagement;
  wsId: string;
  workspaceName: string;
  reach: boolean;
  onReach: () => void;
  onCloseReach: () => void;
  messages: CoachMessage[];
}) {
  const nodes = byOrder(detail.map.nodes);
  const currentLessonTitle =
    detail.map.nodes.flatMap((n) => n.lessons).find((l) => l.id === detail.map.currentLessonId)?.title ?? null;
  const baseline = detail.snapshot.readinessBaseline;
  const showBaseline = baseline !== null && detail.snapshot.readinessScore !== null && baseline.score !== detail.snapshot.readinessScore;

  return (
    <>
      <div className="lde-readiness">
        {detail.snapshot.readinessScore == null ? (
          "Readiness: Not enough data yet"
        ) : (
          <>
            Readiness: {detail.snapshot.readinessScore}/100 ({readinessLabelText(detail.snapshot.readinessLabel)})
            {showBaseline && baseline && (
              <span className="lde-readiness-delta"> &middot; {baseline.score} &rarr; {detail.snapshot.readinessScore}</span>
            )}
          </>
        )}
      </div>

      <LearnerPurposeCard
        why={detail.whyCreed?.why}
        creed={detail.whyCreed?.creed}
      />

      <div className="lde-progress">
        <div
          className="lde-track"
          role="progressbar"
          aria-valuenow={detail.summary.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall progress"
        >
          <span className="lde-fill" style={{ width: `${detail.summary.percentComplete}%` }} />
        </div>
        <div className="lde-progress-caption">
          <span>{detail.summary.percentComplete}% complete</span>
          <span>{detail.summary.completedLessons}/{detail.summary.totalLessons} modules</span>
        </div>
      </div>

      <section className="lde-section">
        <h3 className="lde-section-title">Progress by module</h3>
        {nodes.length === 0 ? (
          <p className="lde-muted">No modules yet.</p>
        ) : (
          <div className="lde-chapters">
            {nodes.map((node) => (
              <ModuleChapter key={node.stageId} node={node} currentLessonId={detail.map.currentLessonId} />
            ))}
          </div>
        )}
      </section>

      <section className="lde-section">
        <h3 className="lde-section-title">Recent activity</h3>
        {detail.recentActivity.length === 0 ? (
          <p className="lde-muted">No recorded activity yet.</p>
        ) : (
          <ul className="lde-activity">
            {detail.recentActivity.slice(0, 12).map((item, i) => (
              <li key={`${item.at}-${i}`} className="lde-activity-item">
                {humanizeAction(item.action)} &middot; {timeAgo(item.at)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lde-section">
        <h3 className="lde-section-title">Past messages</h3>
        {messages.length === 0 ? (
          <p className="lde-muted">No messages sent yet.</p>
        ) : (
          <ul className="lde-messages">
            {messages.map((m) => (
              <li key={m.id} className="lde-message">
                <div className="lde-message-meta">
                  <span className="lde-message-from">{m.fromName || m.fromEmail}</span>
                  <span className="lde-message-time">{timeAgo(m.at)}</span>
                </div>
                {m.subject && <div className="lde-message-subject">{m.subject}</div>}
                <p className="lde-message-body">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="lde-footer">
        <button type="button" className="lde-btn lde-btn--primary" onClick={onReach}>
          Reach out
        </button>
      </footer>

      {reach && (
        <ReachOutModal
          wsId={wsId}
          workspaceName={workspaceName}
          daysIdle={eng.daysSinceActivity}
          currentModule={currentLessonTitle}
          onClose={onCloseReach}
        />
      )}
    </>
  );
}

export function LearnerDetailDrawer({
  wsId,
  workspaceName,
  onClose,
}: {
  wsId: string;
  workspaceName: string;
  onClose: () => void;
}): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, onClose);
  const liveRef = useRef(true);
  useEffect(() => () => { liveRef.current = false; }, []);

  const [state, setState] = useState<ViewState>("loading");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reach, setReach] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch(`/api/coach/learner?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
      if (!liveRef.current) return;
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = (await r.json()) as Detail;
      if (!liveRef.current) return;
      setDetail(d);
      setState("ok");
    } catch {
      if (liveRef.current) setState("error");
    }
  }, [wsId]);

  // Best-effort past-outreach history: never blocks or breaks the drawer —
  // a failed fetch just leaves the "Past messages" section at its empty state.
  const loadMessages = useCallback(async () => {
    try {
      const r = await fetch(`/api/programme/messages?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
      if (!liveRef.current || !r.ok) return;
      const d = (await r.json()) as { messages?: CoachMessage[] };
      if (!liveRef.current) return;
      setMessages(d.messages ?? []);
    } catch {
      /* history stays empty */
    }
  }, [wsId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const eng: Engagement | null = detail
    ? classifyEngagement({
        percentComplete: detail.summary.percentComplete,
        awaitingReviewCount: detail.summary.awaitingReview.length,
        changesRequestedCount: detail.summary.changesRequested.length,
        overdueCount: detail.snapshot.overdueCount,
        lastActivityAt: detail.lastActivityAt,
      })
    : null;

  return (
    <div className="lde-scrim" onClick={onClose}>
      <style>{CSS}</style>
      <div
        ref={panelRef}
        className="lde-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${workspaceName} — learner details`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="lde-close" onClick={onClose} aria-label="Close learner details">&times;</button>

        <header className="lde-header">
          <h2 className="lde-name">{workspaceName}</h2>
          {state === "ok" && detail && detail.ownerEmail && <div className="lde-owner">{detail.ownerEmail}</div>}
          {state === "ok" && detail && eng && (
            <div className="lde-header-row">
              <span className={`lde-pill ${PILL_TONE[eng.tone]}`}>{eng.label}</span>
              <span className="lde-lastactive">Last active: {timeAgo(detail.lastActivityAt)}</span>
            </div>
          )}
        </header>

        <div className="lde-body">
          {state === "loading" && (
            <div className="lde-center">
              <div className="lde-spinner" aria-hidden="true" />
              <p className="lde-muted">Loading learner&hellip;</p>
            </div>
          )}

          {state === "error" && (
            <div className="lde-center">
              <p className="lde-muted">Something went wrong loading this learner.</p>
              <button type="button" className="lde-btn lde-btn--secondary" onClick={() => void load()}>Retry</button>
            </div>
          )}

          {state === "forbidden" && (
            <div className="lde-center">
              <p className="lde-muted">You don&apos;t have access to this learner.</p>
            </div>
          )}

          {state === "ok" && detail && eng && (
            <LearnerDetailBody
              detail={detail}
              eng={eng}
              wsId={wsId}
              workspaceName={workspaceName}
              reach={reach}
              messages={messages}
              onReach={() => setReach(true)}
              onCloseReach={() => { setReach(false); void loadMessages(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Scoped entirely under .lde- (no bare class names) so this can't collide
// with anything on the host page. Tokens carry literal fallbacks, same idiom
// as OtoCard.tsx / ReachOutModal.tsx, so it stays legible even if
// design-system.css hasn't loaded yet and follows the light/navy-dark theme
// automatically once it has.
const CSS = `
.lde-scrim { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 60; animation: lde-fade-in .15s ease-out; }
.lde-panel { position: fixed; top: 0; right: 0; height: 100%; width: min(440px, 100%); overflow-y: auto; box-sizing: border-box; background: var(--ds-surface, #fff); border-left: 1px solid var(--ds-border-subtle, #e5e7eb); box-shadow: 0 20px 60px rgba(15,23,42,.25); padding: 24px 22px 32px; display: flex; flex-direction: column; gap: 16px; animation: lde-slide-in .22s ease-out; }

.lde-close { position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--ds-border-subtle, #e5e7eb); background: var(--ds-surface, #fff); color: var(--ds-text-secondary, #475569); font-size: 18px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s ease, color .15s ease; }
.lde-close:hover { background: var(--ds-bg-subtle, #f1f4f9); color: var(--ds-text-primary, #111827); }
.lde-close:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }

.lde-header { display: flex; flex-direction: column; gap: 7px; padding-right: 36px; }
.lde-name { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -.3px; line-height: 1.3; color: var(--ds-text-primary, #111827); }
.lde-owner { font-size: 12.5px; color: var(--ds-text-secondary, #475569); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.lde-header-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.lde-lastactive { font-size: 11.5px; color: var(--ds-text-tertiary, #64748b); }

.lde-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; letter-spacing: .02em; padding: 3px 9px; border-radius: 99px; border: 1px solid transparent; }
.lde-pill--good { color: var(--ds-success, #088057); background: color-mix(in srgb, var(--ds-success, #088057) 12%, transparent); border-color: color-mix(in srgb, var(--ds-success, #088057) 28%, transparent); }
.lde-pill--info { color: var(--ds-info, #2563eb); background: color-mix(in srgb, var(--ds-info, #2563eb) 12%, transparent); border-color: color-mix(in srgb, var(--ds-info, #2563eb) 28%, transparent); }
.lde-pill--warn { color: var(--ds-warning, #b45309); background: color-mix(in srgb, var(--ds-warning, #b45309) 15%, transparent); border-color: color-mix(in srgb, var(--ds-warning, #b45309) 34%, transparent); }
.lde-pill--danger { color: var(--ds-danger, #dc2626); background: color-mix(in srgb, var(--ds-danger, #dc2626) 12%, transparent); border-color: color-mix(in srgb, var(--ds-danger, #dc2626) 30%, transparent); }
.lde-pill--muted { color: var(--ds-text-tertiary, #64748b); background: var(--ds-bg-subtle, #f1f4f9); border-color: var(--ds-border-subtle, #e5e7eb); }

.lde-body { display: flex; flex-direction: column; gap: 18px; flex: 1; }

.lde-readiness { font-size: 13px; font-weight: 600; color: var(--ds-text-primary, #111827); }
.lde-readiness-delta { font-weight: 700; color: var(--ds-text-secondary, #475569); }

.lde-progress { display: flex; flex-direction: column; gap: 6px; }
.lde-track { height: 6px; border-radius: 99px; background: var(--ds-bg-subtle, #f1f4f9); overflow: hidden; border: 1px solid var(--ds-border-subtle, #e5e7eb); }
.lde-fill { display: block; height: 100%; border-radius: 99px; background: var(--ds-brand, #088057); transition: width .4s ease; }
.lde-progress-caption { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--ds-text-tertiary, #64748b); }

.lde-section { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid var(--ds-border-subtle, #e5e7eb); }
.lde-section-title { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--ds-text-tertiary, #64748b); }
.lde-muted { font-size: 13px; color: var(--ds-text-tertiary, #64748b); margin: 0; }

.lde-chapters { display: flex; flex-direction: column; gap: 12px; }
.lde-chapter { border: 1px solid var(--ds-border-subtle, #e5e7eb); border-radius: var(--ds-radius-lg, 14px); padding: 10px 12px; background: var(--ds-bg-subtle, #f1f4f9); }
.lde-chapter-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.lde-chapter-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 700; color: var(--ds-text-primary, #111827); }
.lde-chapter-count { flex: 0 0 auto; font-size: 11px; font-weight: 700; color: var(--ds-text-tertiary, #64748b); }

.lde-lessons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.lde-lesson { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ds-text-secondary, #475569); }
.lde-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.lde-glyph { flex: 0 0 auto; width: 14px; text-align: center; font-size: 12px; }
.lde-glyph--done { color: var(--ds-success, #088057); }
.lde-glyph--current { color: var(--ds-warning, #b45309); }
.lde-glyph--upcoming { color: var(--ds-text-tertiary, #64748b); }
.lde-lesson-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lde-lesson--current .lde-lesson-title { font-weight: 800; color: var(--ds-text-primary, #111827); }
.lde-current-tag { flex: 0 0 auto; font-size: 9.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ds-warning, #b45309); background: color-mix(in srgb, var(--ds-warning, #b45309) 15%, transparent); border-radius: 99px; padding: 2px 7px; }

.lde-activity { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.lde-activity-item { font-size: 12.5px; line-height: 1.5; color: var(--ds-text-secondary, #475569); padding-bottom: 7px; border-bottom: 1px solid var(--ds-border-subtle, #e5e7eb); }
.lde-activity-item:last-child { border-bottom: none; padding-bottom: 0; }

.lde-messages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.lde-message { display: flex; flex-direction: column; gap: 3px; padding-bottom: 10px; border-bottom: 1px solid var(--ds-border-subtle, #e5e7eb); }
.lde-message:last-child { border-bottom: none; padding-bottom: 0; }
.lde-message-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.lde-message-from { font-size: 12.5px; font-weight: 700; color: var(--ds-text-primary, #111827); }
.lde-message-time { flex: 0 0 auto; font-size: 11px; color: var(--ds-text-tertiary, #64748b); white-space: nowrap; }
.lde-message-subject { font-size: 13px; font-weight: 800; color: var(--ds-text-primary, #111827); }
.lde-message-body { font-size: 12.5px; line-height: 1.5; color: var(--ds-text-secondary, #475569); margin: 0; white-space: pre-line; }

.lde-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--ds-border-subtle, #e5e7eb); display: flex; justify-content: flex-end; }

.lde-btn { font: inherit; font-size: 13.5px; font-weight: 700; border-radius: 10px; padding: 9px 18px; cursor: pointer; transition: opacity .15s ease; }
.lde-btn:hover { opacity: .92; }
.lde-btn--primary { background: var(--ds-brand, #088057); border: none; color: #fff; }
.lde-btn--secondary { background: transparent; border: 1px solid var(--ds-border-subtle, #e5e7eb); color: var(--ds-text-primary, #111827); }
.lde-btn:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }

.lde-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; min-height: 200px; margin: auto 0; }
.lde-spinner { width: 26px; height: 26px; border: 3px solid var(--ds-border-subtle, #e5e7eb); border-top-color: var(--ds-brand, #088057); border-radius: 50%; animation: lde-spin .8s linear infinite; }

@keyframes lde-spin { to { transform: rotate(360deg); } }
@keyframes lde-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes lde-fade-in { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .lde-scrim, .lde-panel, .lde-fill, .lde-close, .lde-btn { animation: none !important; transition: none !important; }
}

.lpc-section {
  padding: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.lpc-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
}

.lpc-card {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.lpc-why {
  border-left: 3px solid #2563eb;
  background: #eff6ff;
}

.lpc-creed {
  border-left: 3px solid #d97706;
  background: #fef3c7;
}

@media (prefers-color-scheme: dark) {
  .lpc-section {
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  .lpc-title {
    color: rgba(255, 255, 255, 0.6);
  }

  .lpc-card {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
  }

  .lpc-why {
    background: rgba(37, 99, 235, 0.1);
  }

  .lpc-creed {
    background: rgba(217, 119, 6, 0.1);
  }
}

.lpc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.lpc-icon {
  font-size: 16px;
  line-height: 1;
}

.lpc-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(0, 0, 0, 0.7);
}

@media (prefers-color-scheme: dark) {
  .lpc-label {
    color: rgba(255, 255, 255, 0.7);
  }
}

.lpc-content {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.9);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .lpc-content {
    color: rgba(255, 255, 255, 0.9);
  }
}

.lpc-note {
  margin: 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .lpc-note {
    color: rgba(255, 255, 255, 0.5);
  }
}

.lpc-empty {
  padding: 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .lpc-empty {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.lpc-empty-text {
  margin: 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .lpc-empty-text {
    color: rgba(255, 255, 255, 0.6);
  }
}

.lpc-coaching-tip {
  margin: 12px 0 0 0;
  padding: 10px;
  background: rgba(37, 99, 235, 0.05);
  border-left: 2px solid #2563eb;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .lpc-coaching-tip {
    background: rgba(37, 99, 235, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
}
`;
