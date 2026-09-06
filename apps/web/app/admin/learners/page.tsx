"use client";

/**
 * /admin/learners — the platform-admin "everyone" console. Every enrolled
 * learner across the WHOLE platform (every workspace, every owner), one
 * searchable table/grid, with an engagement status pill and a one-click
 * "Reach out" per learner — the owner's Cardone-University-style overview of
 * who's stuck, independent of any single coach's roster.
 *
 * Reads the new GET /api/admin/learners (platform-admin only — 403 for a
 * signed-in non-admin, 401 signed-out). Engagement classification is the same
 * lib/coach/engagement.ts used by /businesses and the coach roster, so "gone
 * quiet 24d" means the same thing everywhere in the product; overdueCount has
 * no platform-wide equivalent here so it's passed as 0 (this surface has no
 * per-goal overdue data — the status still correctly separates absence from
 * pending-review from steady progress without it).
 *
 * "Reach out" opens components/coach/ReachOutModal for the clicked learner
 * (one bit of state: which learner, or none). onSent refetches the roster so
 * any resulting activity/state change is reflected; onClose just dismisses —
 * the two are independent so the modal can show its own "sent" confirmation
 * before the admin closes it.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { PageShell } from "../../../components/ui/PageShell";
import { ReachOutModal } from "../../../components/coach/ReachOutModal";
import { LearnerDetailDrawer } from "../../../components/coach/LearnerDetailDrawer";
import { classifyEngagement, type Engagement } from "../../../lib/coach/engagement";

type Plan = "free" | "pro" | "business" | "performance";
type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

interface AdminLearner {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  plan: Plan;
  summary: {
    totalLessons: number;
    completedLessons: number;
    percentComplete: number;
    currentLessonId: string | null;
    awaitingReview: { lessonId: string }[];
    changesRequested: string[];
  };
  currentLessonTitle?: string | null;
  lastActivityAt: string | null;
}

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", business: "Business", performance: "Performance" };
function planBadgeClass(plan: Plan): string {
  if (plan === "business" || plan === "performance") return "ds-badge ds-badge--brand";
  if (plan === "pro") return "ds-badge ds-badge--info";
  return "ds-badge";
}

/** Reduce a platform learner row to its engagement status — same signal the
 *  coach roster and /businesses use (see lib/coach/engagement.ts). No
 *  per-goal "overdue" concept exists at the platform level, so that input is
 *  always 0 here; absence, progress and pending-review still classify fine
 *  without it. */
function engagementOf(l: AdminLearner): Engagement {
  return classifyEngagement({
    percentComplete: l.summary.percentComplete,
    awaitingReviewCount: l.summary.awaitingReview.length,
    changesRequestedCount: l.summary.changesRequested.length,
    overdueCount: 0,
    lastActivityAt: l.lastActivityAt,
  });
}
function byAttention(list: AdminLearner[]): AdminLearner[] {
  return [...list].sort((a, b) => engagementOf(b).attention - engagementOf(a).attention);
}

type RosterFilter = "all" | "at_risk" | "review" | "on_track";
const FILTERS: { key: RosterFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "at_risk", label: "Gone quiet" },
  { key: "review", label: "Needs review" },
  { key: "on_track", label: "On track" },
];
function matchesFilter(l: AdminLearner, f: RosterFilter): boolean {
  if (f === "all") return true;
  const e = engagementOf(l);
  if (f === "at_risk") return e.atRisk;
  if (f === "review") return l.summary.awaitingReview.length > 0 || l.summary.changesRequested.length > 0;
  if (f === "on_track") return e.status === "on_track" || e.status === "completed";
  return true;
}
function matchesSearch(l: AdminLearner, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return l.workspaceName.toLowerCase().includes(needle) || (l.ownerEmail ?? "").toLowerCase().includes(needle);
}

const PILL_TONE: Record<Engagement["tone"], string> = {
  good: "adl-pill--good", info: "adl-pill--info", warn: "adl-pill--warn", danger: "adl-pill--danger", muted: "adl-pill--muted",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "No activity yet";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "Active recently";
  if (ms < 60_000) return "Active just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `Active ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Active ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `Active ${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `Active ${mo}mo ago`;
  return `Active ${Math.floor(mo / 12)}y ago`;
}

function LearnerCard({ l, onReachOut, onDetail }: { l: AdminLearner; onReachOut: (l: AdminLearner) => void; onDetail: (l: AdminLearner) => void }) {
  const eng = engagementOf(l);
  const accent = eng.tone === "danger" ? "var(--ds-danger)" : eng.tone === "warn" ? "var(--ds-warning)" : "var(--ds-border-subtle)";

  return (
    <div className="adl-card" style={{ borderLeftColor: accent }}>
      <div className="adl-card-top">
        <div className="adl-card-id">
          <h3 className="adl-name" title={l.workspaceName}>{l.workspaceName}</h3>
          <span className="adl-owner" title={l.ownerEmail ?? undefined}>{l.ownerEmail ?? "No owner email"}</span>
        </div>
        <span className={planBadgeClass(l.plan)}>{PLAN_LABEL[l.plan]}</span>
      </div>

      <div className="adl-status">
        <span className={`adl-pill ${PILL_TONE[eng.tone]}`}>{eng.label}</span>
        {l.summary.awaitingReview.length > 0 && (
          <span className="ds-badge ds-badge--info">{l.summary.awaitingReview.length} awaiting review</span>
        )}
        {l.summary.changesRequested.length > 0 && (
          <span className="ds-badge ds-badge--warning">{l.summary.changesRequested.length} changes requested</span>
        )}
      </div>

      <div className="adl-progress">
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={l.summary.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${l.workspaceName} journey progress`}
        >
          <span className="progress-fill" style={{ width: `${l.summary.percentComplete}%` }} />
        </div>
        <div className="adl-progress-caption">
          <span>{l.summary.percentComplete}% complete</span>
          <span>{l.summary.completedLessons}/{l.summary.totalLessons} modules</span>
        </div>
      </div>

      <div className="adl-card-foot">
        <span className="adl-activity">{timeAgo(l.lastActivityAt)}</span>
        <div className="adl-foot-actions">
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => onDetail(l)} aria-label={`View ${l.workspaceName}'s progress`}>
            Details
          </button>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => onReachOut(l)} aria-label={`Reach out to ${l.workspaceName}`}>
            <MarketingIcon name="message" size={14} /> Reach out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLearnersPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [learners, setLearners] = useState<AdminLearner[]>([]);
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [query, setQuery] = useState("");
  // The one piece of state for "which learner's Reach-out modal is open" —
  // null means closed.
  const [reachOutFor, setReachOutFor] = useState<AdminLearner | null>(null);
  const [detailFor, setDetailFor] = useState<AdminLearner | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/admin/learners", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const data = await r.json() as { learners?: AdminLearner[] };
      setLearners(data.learners ?? []);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // At-risk / review counts are computed across the WHOLE roster (not the
  // filtered/searched view) so the summary strip always reflects the full
  // platform, same as /businesses' roster-wide "gone quiet" count.
  const atRiskCount = useMemo(() => learners.filter((l) => engagementOf(l).atRisk).length, [learners]);
  const reviewCount = useMemo(
    () => learners.filter((l) => l.summary.awaitingReview.length > 0 || l.summary.changesRequested.length > 0).length,
    [learners],
  );

  const visible = useMemo(
    () => byAttention(learners.filter((l) => matchesFilter(l, filter) && matchesSearch(l, query))),
    [learners, filter, query],
  );

  const actions = (
    <>
      <button className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => void load()} disabled={state === "loading"}>
        <MarketingIcon name="refresh" size={14} /> Refresh
      </button>
      <a href="/admin" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="home" size={14} /> Admin home</a>
    </>
  );

  return (
    <PageShell
      className="adl"
      maxWidth={1200}
      eyebrow="Admin"
      title="All learners"
      subtitle="Every enrolled learner across the whole platform — who's stuck, who's waiting on a review, and who to reach out to next."
      actions={actions}
    >
      <style>{CSS}</style>

      {state === "loading" && (
        <div className="panel center">
          <div className="spinner" />
          <p className="ds-body">Loading learners…</p>
        </div>
      )}

      {state === "error" && (
        <div className="panel center">
          <span className="notice-icon notice-icon--warn" aria-hidden="true"><MarketingIcon name="warning" size={20} /></span>
          <p className="ds-body">Something went wrong loading learners. <button className="link" onClick={() => void load()}>Try again</button></p>
        </div>
      )}

      {state === "not-authenticated" && (
        <div className="panel notice">
          <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="lock" size={20} /></span>
          <h2>Sign in</h2>
          <p className="ds-help">Sign in with a platform-admin account to view every learner.</p>
          <a className="ds-btn ds-btn--primary ds-btn--sm" href="/">Sign in</a>
        </div>
      )}

      {state === "forbidden" && (
        <div className="panel notice">
          <span className="notice-icon notice-icon--warn" aria-hidden="true"><MarketingIcon name="lock" size={20} /></span>
          <h2>Restricted</h2>
          <p className="ds-help">You need platform-admin access to view this.</p>
        </div>
      )}

      {state === "ok" && (
        <>
          <div className="adl-summary">
            <div className="adl-stat">
              <span className="adl-stat-n">{learners.length}</span>
              <span className="adl-stat-l">Total learners</span>
            </div>
            <div className="adl-stat adl-stat--danger">
              <span className="adl-stat-n">{atRiskCount}</span>
              <span className="adl-stat-l">Gone quiet / at risk</span>
            </div>
            <div className="adl-stat adl-stat--info">
              <span className="adl-stat-n">{reviewCount}</span>
              <span className="adl-stat-l">Awaiting review</span>
            </div>
          </div>

          <div className="adl-toolbar">
            <div className="adl-search">
              <MarketingIcon name="search" size={14} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by business name or owner email…"
                aria-label="Search learners by business name or owner email"
              />
            </div>

            {learners.length > 0 && (
              <div className="adl-filters" aria-label="Filter learners">
                {FILTERS.map((f) => {
                  const n = f.key === "all" ? learners.length : learners.filter((l) => matchesFilter(l, f.key)).length;
                  return (
                    <button
                      key={f.key}
                      aria-pressed={filter === f.key}
                      className={`adl-filter ${filter === f.key ? "is-active" : ""}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label} <span className="adl-filter-n">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {learners.length === 0 ? (
            <div className="adl-empty">
              <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="audiences" size={20} /></span>
              <h3>No learners yet</h3>
              <p className="ds-help">Once businesses enrol in the programme, every learner shows up here.</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="adl-nomatch">No learners match this filter.</p>
          ) : (
            <div className="adl-grid">
              {visible.map((l) => <LearnerCard key={l.workspaceId} l={l} onReachOut={setReachOutFor} onDetail={setDetailFor} />)}
            </div>
          )}
        </>
      )}

      {reachOutFor && (
        <ReachOutModal
          wsId={reachOutFor.workspaceId}
          workspaceName={reachOutFor.workspaceName}
          daysIdle={engagementOf(reachOutFor).daysSinceActivity}
          currentModule={reachOutFor.currentLessonTitle ?? undefined}
          onClose={() => setReachOutFor(null)}
          onSent={() => { void load(); }}
        />
      )}
      {detailFor && (
        <LearnerDetailDrawer wsId={detailFor.workspaceId} workspaceName={detailFor.workspaceName} onClose={() => setDetailFor(null)} />
      )}
    </PageShell>
  );
}

// Page-specific layout only — every colour comes from the shared --ds-*
// tokens (app/design-system.css) so this follows the light/navy-dark theme
// automatically. Everything is scoped under .adl so nothing leaks to other
// pages; bare class names (panel/notice-icon/spinner/link) are scoped with a
// `.adl` ancestor, mirroring the exact idiom of app/businesses/page.tsx.
const CSS = `
.adl .panel{background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:20px 22px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--ds-shadow-sm);}
.adl .panel.center{align-items:center;justify-content:center;min-height:180px;text-align:center;}
.adl .panel.notice{align-items:center;text-align:center;}
.adl .panel.notice h2{margin:0;font-size:18px;}
.adl .notice-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;}
.adl .notice-icon--info{background:var(--ds-info-soft);color:var(--ds-info);}
.adl .notice-icon--warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.adl .link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;border-radius:4px;transition:color .15s ease;}
.adl .link:hover{color:var(--ds-brand-hover);}
.adl .link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.adl .spinner{width:28px;height:28px;border:3px solid var(--ds-border-default);border-top-color:var(--ds-brand);border-radius:50%;animation:adl-spin .8s linear infinite;}
@keyframes adl-spin{to{transform:rotate(360deg);}}

.adl-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px;}
.adl-stat{display:flex;flex-direction:column;gap:4px;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:14px 16px;box-shadow:var(--ds-shadow-sm);}
.adl-stat-n{font-size:26px;font-weight:800;letter-spacing:-.5px;color:var(--ds-text-primary);line-height:1.1;}
.adl-stat-l{font-size:12px;color:var(--ds-text-tertiary);font-weight:600;}
.adl-stat--danger .adl-stat-n{color:var(--ds-danger,#c81e1e);}
.adl-stat--info .adl-stat-n{color:var(--ds-info,#2563eb);}

.adl-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;}
.adl-search{display:flex;align-items:center;gap:8px;flex:1 1 260px;max-width:380px;padding:0 12px;height:36px;border-radius:var(--ds-radius-lg,10px);border:1px solid var(--ds-border-default);background:var(--ds-surface);color:var(--ds-text-tertiary);transition:border-color .15s ease;}
.adl-search:focus-within{border-color:var(--ds-brand,#088057);}
.adl-search input{border:none;background:transparent;outline:none;font:inherit;font-size:13px;color:var(--ds-text-primary);flex:1;height:100%;min-width:0;}
.adl-search input::placeholder{color:var(--ds-text-tertiary);}

.adl-filters{display:flex;flex-wrap:wrap;gap:8px;}
.adl-filter{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:99px;border:1px solid var(--ds-border-default);background:var(--ds-surface);color:var(--ds-text-secondary);display:inline-flex;align-items:center;gap:6px;transition:border-color .15s,background .15s,color .15s;}
.adl-filter:hover{border-color:var(--ds-brand,#088057);color:var(--ds-text-primary);}
.adl-filter.is-active{background:var(--ds-brand,#088057);border-color:var(--ds-brand,#088057);color:#fff;}
.adl-filter-n{font-size:11px;font-weight:800;opacity:.8;}
.adl-filter.is-active .adl-filter-n{opacity:.95;}

.adl-nomatch{font-size:13px;color:var(--ds-text-tertiary);padding:18px 4px;margin:0;}

.adl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px;}

.adl-card{display:flex;flex-direction:column;gap:12px;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-left:3px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:18px;box-shadow:var(--ds-shadow-sm);transition:box-shadow .16s var(--ds-ease,ease),transform .16s var(--ds-ease,ease),border-color .16s ease;}
.adl-card:hover{box-shadow:var(--ds-shadow-md);transform:translateY(-2px);border-color:var(--ds-border-default);}
.adl-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.adl-card-id{display:flex;flex-direction:column;gap:2px;min-width:0;}
.adl-name{margin:0;font-size:15.5px;font-weight:700;letter-spacing:-.2px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.adl-owner{font-size:12px;color:var(--ds-text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.adl-status{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
.adl-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.02em;padding:3px 9px;border-radius:99px;border:1px solid transparent;}
.adl-pill--good{color:var(--ds-success,#088057);background:color-mix(in srgb,var(--ds-success,#088057) 12%,transparent);border-color:color-mix(in srgb,var(--ds-success,#088057) 28%,transparent);}
.adl-pill--info{color:var(--ds-info,#2563eb);background:color-mix(in srgb,var(--ds-info,#2563eb) 12%,transparent);border-color:color-mix(in srgb,var(--ds-info,#2563eb) 28%,transparent);}
.adl-pill--warn{color:var(--ds-warning,#b45309);background:color-mix(in srgb,var(--ds-warning,#f59e0b) 15%,transparent);border-color:color-mix(in srgb,var(--ds-warning,#f59e0b) 34%,transparent);}
.adl-pill--danger{color:var(--ds-danger,#dc2626);background:color-mix(in srgb,var(--ds-danger,#dc2626) 12%,transparent);border-color:color-mix(in srgb,var(--ds-danger,#dc2626) 30%,transparent);}
.adl-pill--muted{color:var(--ds-text-tertiary);background:var(--ds-bg-subtle);border-color:var(--ds-border-subtle);}

.adl-progress{display:flex;flex-direction:column;gap:6px;}
.adl .progress-track{height:6px;border-radius:99px;background:var(--ds-bg-subtle);overflow:hidden;border:1px solid var(--ds-border-subtle);}
.adl .progress-fill{display:block;height:100%;border-radius:99px;background:var(--ds-brand);transition:width .4s ease;}
.adl-progress-caption{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--ds-text-tertiary);}

.adl-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;margin-top:2px;border-top:1px solid var(--ds-border-subtle);}
.adl-foot-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.adl-activity{font-size:11.5px;color:var(--ds-text-tertiary);}

.adl-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:36px 24px;background:var(--ds-surface);border:1px dashed var(--ds-border-default);border-radius:var(--ds-radius-lg);}
.adl-empty h3{margin:0;font-size:15px;font-weight:700;}

@media (prefers-reduced-motion: reduce){ .adl *:not(.spinner){transition:none!important;animation:none!important;} }
`;
