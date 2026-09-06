"use client";

/**
 * /businesses — the "My Businesses" portfolio home. A founder with several
 * businesses (or an agency coaching clients) sees every workspace they own
 * AND every client they coach side by side — journey progress, Readiness,
 * and what needs attention — instead of switching workspaces one at a time
 * to find out. Reads the existing GET /api/programme/coach-workspaces (no
 * new backend); "owner" entries are the user's own businesses, "manager"
 * entries are the clients they coach (see lib/enrollments.ts's header on
 * why "coach" = manager, not a dedicated role).
 *
 * Each card's "Open →" deep-links to /studio?ws=<id>, which funnel-studio.tsx
 * already honours on load to switch straight into that workspace. When a card
 * has items awaiting review or changes requested, those live in the Studio's
 * Programme panel rather than the canvas, so the link instead reads
 * "Review →" and points to /studio?ws=<id>&panel=programme (also already
 * honoured by funnel-studio.tsx, which opens the Programme panel on load).
 *
 * The header's and Clients-empty-state's "Invite a client" buttons reuse that
 * exact same ?ws=<id>&panel=programme deep link — it lands on the Programme
 * Centre's "My clients" tab, whose own "+ Invite a client or coach" button is
 * the app's real (and only) invite surface, POSTing to the existing
 * /api/workspaces/:id/members (see useWorkspaceMembers.ts). No new invite
 * mechanism here, just a front door to the one that already exists.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketingIcon } from "../../components/MarketingIcons";
import { PageShell } from "../../components/ui/PageShell";
import { classifyEngagement, type Engagement } from "../../lib/coach/engagement";
import { ReachOutModal } from "../../components/coach/ReachOutModal";
import { LearnerDetailDrawer } from "../../components/coach/LearnerDetailDrawer";

type Plan = "free" | "pro" | "business" | "performance";
type ReadinessLabel = "no_data" | "fragile" | "developing" | "strong";
type Role = "owner" | "manager";
type ViewState = "loading" | "ok" | "not-authenticated" | "error";

interface CoachClient {
  workspaceId: string;
  workspaceName: string;
  plan: Plan;
  role: Role;
  summary: {
    totalLessons: number;
    completedLessons: number;
    percentComplete: number;
    currentLessonId: string | null;
    awaitingReview: { lessonId: string }[];
    changesRequested: string[];
  };
  /** Human title of the learner's current module — for a readable "reach out"
   *  message. Absent on older API responses. */
  currentLessonTitle?: string | null;
  snapshot: {
    readinessScore: number | null;
    readinessLabel: ReadinessLabel;
    topGoal: { title: string } | null;
    overdueCount: number;
    /** Optional — absent on older API responses; code defensively. */
    readinessBaseline?: { score: number; capturedAt: string } | null;
  };
  lastActivityAt: string | null;
  accessGranted: boolean;
}

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", business: "Business", performance: "Performance" };
function planBadgeClass(plan: Plan): string {
  if (plan === "business" || plan === "performance") return "ds-badge ds-badge--brand";
  if (plan === "pro") return "ds-badge ds-badge--info";
  return "ds-badge";
}

const READINESS_TEXT: Record<ReadinessLabel, string> = { no_data: "Not enough data", fragile: "Fragile", developing: "Developing", strong: "Strong" };
const READINESS_COLOR: Record<ReadinessLabel, string> = {
  no_data: "var(--ds-text-tertiary)", fragile: "var(--ds-danger)", developing: "var(--ds-warning)", strong: "var(--ds-success)",
};

/** Score suffix for the Readiness line — "<baseline> → <score>" when a
 *  captured baseline exists and differs from the live score, else just the
 *  score. readinessBaseline may be absent (older API responses). */
function readinessScoreText(s: CoachClient["snapshot"]): string {
  if (s.readinessScore == null) return "";
  const baseline = s.readinessBaseline;
  if (baseline && baseline.score !== s.readinessScore) return ` · ${baseline.score} → ${s.readinessScore}`;
  return ` · ${s.readinessScore}`;
}

/** Reduce a roster client to its engagement status — inactivity, progress and
 *  pending-review state folded into one signal (see lib/coach/engagement.ts).
 *  This is what makes a learner who simply stopped showing up rise to the top
 *  instead of sinking below everyone with a pending review. */
function engagementOf(c: CoachClient): Engagement {
  return classifyEngagement({
    percentComplete: c.summary.percentComplete,
    awaitingReviewCount: c.summary.awaitingReview.length,
    changesRequestedCount: c.summary.changesRequested.length,
    overdueCount: c.snapshot.overdueCount,
    lastActivityAt: c.lastActivityAt,
  });
}
function byAttention(list: CoachClient[]): CoachClient[] {
  return [...list].sort((a, b) => engagementOf(b).attention - engagementOf(a).attention);
}

type RosterFilter = "all" | "at_risk" | "review" | "on_track";
const FILTERS: { key: RosterFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "at_risk", label: "Gone quiet" },
  { key: "review", label: "Needs review" },
  { key: "on_track", label: "On track" },
];
function matchesFilter(c: CoachClient, f: RosterFilter): boolean {
  if (f === "all") return true;
  const e = engagementOf(c);
  if (f === "at_risk") return e.atRisk;
  if (f === "review") return c.summary.awaitingReview.length > 0 || c.summary.changesRequested.length > 0;
  if (f === "on_track") return e.status === "on_track" || e.status === "completed";
  return true;
}

const PILL_TONE: Record<Engagement["tone"], string> = {
  good: "biz-pill--good", info: "biz-pill--info", warn: "biz-pill--warn", danger: "biz-pill--danger", muted: "biz-pill--muted",
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

interface Chip { label: string; variant: "info" | "warning" | "danger"; }
function chipsFor(c: CoachClient): Chip[] {
  const chips: Chip[] = [];
  if (c.summary.awaitingReview.length > 0) chips.push({ label: `${c.summary.awaitingReview.length} awaiting review`, variant: "info" });
  if (c.snapshot.overdueCount > 0) chips.push({ label: `${c.snapshot.overdueCount} overdue`, variant: "danger" });
  if (c.summary.changesRequested.length > 0) chips.push({ label: `${c.summary.changesRequested.length} changes requested`, variant: "warning" });
  if (!c.accessGranted) chips.push({ label: "Access paused", variant: "danger" });
  return chips;
}

function BusinessCard({ c }: { c: CoachClient }) {
  const eng = engagementOf(c);
  const [reachOpen, setReachOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const chips = chipsFor(c);
  // "Reach out" only makes sense for clients you coach (managed), not your own
  // businesses. Highlight it when they've gone quiet.
  const canReachOut = c.role === "manager";
  const hasDanger = chips.some((chip) => chip.variant === "danger") || eng.tone === "danger";
  const accent = hasDanger ? "var(--ds-danger)" : (chips.length > 0 || eng.atRisk) ? "var(--ds-warning)" : "var(--ds-border-subtle)";
  const readinessColor = READINESS_COLOR[c.snapshot.readinessLabel];
  // Attention-aware Open: awaiting-review / changes-requested items live in
  // the Studio's Programme panel, not the canvas, so deep-link there instead.
  const needsReview = c.summary.awaitingReview.length > 0 || c.summary.changesRequested.length > 0;
  const openHref = `/studio?ws=${encodeURIComponent(c.workspaceId)}${needsReview ? "&panel=programme" : ""}`;
  const openLabel = needsReview ? "Review" : "Open";

  return (
    <div className="biz-card" style={{ borderLeftColor: accent }}>
      <div className="biz-card-top">
        <h3 className="biz-name">{c.workspaceName}</h3>
        <span className={planBadgeClass(c.plan)}>{PLAN_LABEL[c.plan]}</span>
      </div>

      <div className="biz-status">
        <span className={`biz-pill ${PILL_TONE[eng.tone]}`}>{eng.label}</span>
      </div>

      <div className="biz-readiness" style={{ color: readinessColor }}>
        <span className="ds-dot" aria-hidden="true" />
        {READINESS_TEXT[c.snapshot.readinessLabel]}{readinessScoreText(c.snapshot)}
      </div>

      <div className="biz-progress">
        <div className="progress-track" role="progressbar" aria-valuenow={c.summary.percentComplete} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.workspaceName} journey progress`}>
          <span className="progress-fill" style={{ width: `${c.summary.percentComplete}%` }} />
        </div>
        <div className="biz-progress-caption">
          <span>{c.summary.percentComplete}% complete</span>
          <span>{c.summary.completedLessons}/{c.summary.totalLessons} modules</span>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="biz-chips">
          {chips.map((chip) => <span key={chip.label} className={`ds-badge ds-badge--${chip.variant}`}>{chip.label}</span>)}
        </div>
      )}

      <div className="biz-card-foot">
        <span className="biz-activity">{timeAgo(c.lastActivityAt)}</span>
        <div className="biz-foot-actions">
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setDetailOpen(true)} aria-label={`View ${c.workspaceName}'s progress`}>
            Details
          </button>
          {canReachOut && (
            <button
              type="button"
              className={`ds-btn ds-btn--sm ${eng.atRisk ? "ds-btn--primary" : "ds-btn--ghost"}`}
              onClick={() => setReachOpen(true)}
              aria-label={`Reach out to ${c.workspaceName}`}
            >
              Reach out
            </button>
          )}
          <a className="ds-btn ds-btn--secondary ds-btn--sm" href={openHref} aria-label={`${openLabel} ${c.workspaceName} in Studio`}>
            {openLabel} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
      {reachOpen && (
        <ReachOutModal
          wsId={c.workspaceId}
          workspaceName={c.workspaceName}
          daysIdle={eng.daysSinceActivity}
          currentModule={c.currentLessonTitle ?? undefined}
          onClose={() => setReachOpen(false)}
        />
      )}
      {detailOpen && (
        <LearnerDetailDrawer wsId={c.workspaceId} workspaceName={c.workspaceName} onClose={() => setDetailOpen(false)} />
      )}
    </div>
  );
}

export default function BusinessesPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [clients, setClients] = useState<CoachClient[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/programme/coach-workspaces", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const data = await r.json() as { clients?: CoachClient[] };
      setClients(data.clients ?? []);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [filter, setFilter] = useState<RosterFilter>("all");

  // At-risk count is computed across ALL clients (not the filtered view) so the
  // "N have gone quiet" alert reflects the whole roster even while filtered.
  const atRiskCount = useMemo(() => clients.filter((c) => engagementOf(c).atRisk).length, [clients]);
  const ownedTotal = clients.filter((c) => c.role === "owner").length;
  const managedTotal = clients.filter((c) => c.role === "manager").length;
  const owned = byAttention(clients.filter((c) => c.role === "owner" && matchesFilter(c, filter)));
  const managed = byAttention(clients.filter((c) => c.role === "manager" && matchesFilter(c, filter)));

  // "Invite a client" front door: there's no dedicated invite-a-client
  // endpoint (a client's workspace only starts appearing under Clients once
  // ITS owner adds this user as a "manager" member — see lib/enrollments.ts's
  // header). The real, existing surface for that is the Studio's Programme
  // Centre "My clients" tab, whose own "+ Invite a client or coach" button
  // opens the workspace-members invite form (POST /api/workspaces/:id/members,
  // see useWorkspaceMembers.ts). Deep-link there the same way this page's own
  // card links already do — `?ws=<id>&panel=programme` — rather than routing
  // to the account/workspace settings tab, which has no invite UI at all.
  // Picks the first (most-attention) owned business as the landing workspace;
  // falls back to a bare Studio link pre-first-business, same as the "No
  // businesses yet" CTA below.
  const primaryOwnedId = byAttention(clients.filter((c) => c.role === "owner"))[0]?.workspaceId;
  const inviteHref = primaryOwnedId ? `/studio?ws=${encodeURIComponent(primaryOwnedId)}&panel=programme` : "/studio";

  const actions = (
    <>
      <a href={inviteHref} className="ds-btn ds-btn--primary ds-btn--sm">
        <MarketingIcon name="audiences" size={14} /> Invite a client
      </a>
      <button className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => void load()} disabled={state === "loading"}>
        <MarketingIcon name="refresh" size={14} /> Refresh
      </button>
      <a href="/" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="home" size={14} /> Home</a>
    </>
  );

  return (
    <PageShell
      className="biz"
      maxWidth={1200}
      eyebrow="Portfolio"
      title="My Businesses & Clients"
      subtitle="Every business you own and every client you coach, side by side — journey progress, Readiness, and what needs attention, all in one place."
      actions={actions}
    >
      <style>{CSS}</style>

      {state === "loading" && (
        <div className="panel center">
          <div className="spinner" />
          <p className="ds-body">Loading your businesses…</p>
        </div>
      )}

      {state === "error" && (
        <div className="panel center">
          <span className="notice-icon notice-icon--warn" aria-hidden="true"><MarketingIcon name="warning" size={20} /></span>
          <p className="ds-body">Something went wrong loading your businesses. <button className="link" onClick={() => void load()}>Try again</button></p>
        </div>
      )}

      {state === "not-authenticated" && (
        <div className="panel notice">
          <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="lock" size={20} /></span>
          <h2>Sign in to see your businesses</h2>
          <p className="ds-help">Sign in to view every business you own and every client you coach, side by side.</p>
          <a className="ds-btn ds-btn--primary ds-btn--sm" href="/">Sign in</a>
        </div>
      )}

      {state === "ok" && (
        <>
          {atRiskCount > 0 && (
            <button
              type="button"
              className="biz-alert"
              onClick={() => setFilter(filter === "at_risk" ? "all" : "at_risk")}
              aria-pressed={filter === "at_risk"}
            >
              <span className="biz-alert-icon" aria-hidden="true"><MarketingIcon name="warning" size={18} /></span>
              <span className="biz-alert-text">
                <strong>{atRiskCount} {atRiskCount === 1 ? "learner has" : "learners have"} gone quiet.</strong>{" "}
                {filter === "at_risk" ? "Showing them now — tap to show everyone." : "Tap to see who to reach out to."}
              </span>
              <span className="biz-alert-go" aria-hidden="true">→</span>
            </button>
          )}

          {clients.length > 0 && (
            <div className="biz-filters" aria-label="Filter learners">
              {FILTERS.map((f) => {
                const n = f.key === "all" ? clients.length : clients.filter((c) => matchesFilter(c, f.key)).length;
                return (
                  <button
                    key={f.key}
                    aria-pressed={filter === f.key}
                    className={`biz-filter ${filter === f.key ? "is-active" : ""}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label} <span className="biz-filter-n">{n}</span>
                  </button>
                );
              })}
            </div>
          )}

          <section className="biz-section">
            <div className="biz-section-head">
              <h2>My Businesses</h2>
              <span className="ds-help">{ownedTotal} {ownedTotal === 1 ? "business" : "businesses"}</span>
            </div>
            {ownedTotal === 0 ? (
              <div className="biz-empty">
                <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="home" size={20} /></span>
                <h3>No businesses yet</h3>
                <p className="ds-help">Start a project in Studio and it shows up here as one of your businesses.</p>
                <a className="ds-btn ds-btn--primary ds-btn--sm" href="/studio">Go to Studio</a>
              </div>
            ) : owned.length === 0 ? (
              <p className="biz-nomatch">None of your businesses match this filter.</p>
            ) : (
              <div className="biz-grid">
                {owned.map((c) => <BusinessCard key={c.workspaceId} c={c} />)}
              </div>
            )}
          </section>

          <section className="biz-section">
            <div className="biz-section-head">
              <h2>Clients</h2>
              <span className="ds-help">{managedTotal} {managedTotal === 1 ? "client" : "clients"}</span>
            </div>
            {managedTotal === 0 ? (
              <div className="biz-empty">
                <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="audiences" size={20} /></span>
                <h3>No clients yet</h3>
                <p className="ds-help">Invite a client — once you're added as a manager on their workspace, their journey progress and Readiness show up here.</p>
                <a className="ds-btn ds-btn--primary ds-btn--sm" href={inviteHref}>
                  <MarketingIcon name="audiences" size={14} /> Invite a client
                </a>
              </div>
            ) : managed.length === 0 ? (
              <p className="biz-nomatch">None of your clients match this filter.</p>
            ) : (
              <div className="biz-grid">
                {managed.map((c) => <BusinessCard key={c.workspaceId} c={c} />)}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}

// Page-specific layout only — every colour comes from the shared --ds-*
// tokens (app/design-system.css) so this follows the light/navy-dark theme
// automatically. Everything is scoped under .biz so nothing leaks to other
// pages; bare class names (panel/notice-icon/spinner/link) mirror the exact
// idiom of app/business/reality/page.tsx's .rm scope.
const CSS = `
.biz .panel{background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:20px 22px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--ds-shadow-sm);}
.biz .panel.center{align-items:center;justify-content:center;min-height:180px;text-align:center;}
.biz .panel.notice{align-items:center;text-align:center;}
.biz .panel.notice h2{margin:0;font-size:18px;}
.biz .notice-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;}
.biz .notice-icon--info{background:var(--ds-info-soft);color:var(--ds-info);}
.biz .notice-icon--warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.biz .link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;border-radius:4px;transition:color .15s ease;}
.biz .link:hover{color:var(--ds-brand-hover);}
.biz .link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.biz .spinner{width:28px;height:28px;border:3px solid var(--ds-border-default);border-top-color:var(--ds-brand);border-radius:50%;animation:biz-spin .8s linear infinite;}
@keyframes biz-spin{to{transform:rotate(360deg);}}

.biz-section{margin-bottom:var(--ds-space-8);}
.biz-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px;}
.biz-section-head h2{margin:0;font-size:19px;font-weight:700;letter-spacing:-.3px;}

.biz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:16px;}

.biz-card{display:flex;flex-direction:column;gap:12px;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-left:3px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:18px;box-shadow:var(--ds-shadow-sm);transition:box-shadow .16s var(--ds-ease,ease),transform .16s var(--ds-ease,ease),border-color .16s ease;}
.biz-card:hover{box-shadow:var(--ds-shadow-md);transform:translateY(-2px);border-color:var(--ds-border-default);}
.biz-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.biz-name{margin:0;font-size:15.5px;font-weight:700;letter-spacing:-.2px;line-height:1.35;}

.biz-status{display:flex;}
.biz-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.02em;padding:3px 9px;border-radius:99px;border:1px solid transparent;}
.biz-pill--good{color:var(--ds-success,#088057);background:color-mix(in srgb,var(--ds-success,#088057) 12%,transparent);border-color:color-mix(in srgb,var(--ds-success,#088057) 28%,transparent);}
.biz-pill--info{color:var(--ds-info,#2563eb);background:color-mix(in srgb,var(--ds-info,#2563eb) 12%,transparent);border-color:color-mix(in srgb,var(--ds-info,#2563eb) 28%,transparent);}
.biz-pill--warn{color:var(--ds-warning,#b45309);background:color-mix(in srgb,var(--ds-warning,#f59e0b) 15%,transparent);border-color:color-mix(in srgb,var(--ds-warning,#f59e0b) 34%,transparent);}
.biz-pill--danger{color:var(--ds-danger,#dc2626);background:color-mix(in srgb,var(--ds-danger,#dc2626) 12%,transparent);border-color:color-mix(in srgb,var(--ds-danger,#dc2626) 30%,transparent);}
.biz-pill--muted{color:var(--ds-text-tertiary);background:var(--ds-bg-subtle);border-color:var(--ds-border-subtle);}

.biz-alert{width:100%;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;font:inherit;margin-bottom:16px;padding:13px 16px;border-radius:var(--ds-radius-lg);border:1px solid color-mix(in srgb,var(--ds-warning,#f59e0b) 40%,transparent);background:color-mix(in srgb,var(--ds-warning,#f59e0b) 12%,var(--ds-surface));color:var(--ds-text-primary);transition:border-color .15s,box-shadow .15s;}
.biz-alert:hover{border-color:var(--ds-warning,#f59e0b);box-shadow:var(--ds-shadow-sm);}
.biz-alert[aria-pressed="true"]{border-color:var(--ds-warning,#f59e0b);background:color-mix(in srgb,var(--ds-warning,#f59e0b) 18%,var(--ds-surface));}
.biz-alert-icon{color:var(--ds-warning,#b45309);display:flex;flex:0 0 auto;}
.biz-alert-text{flex:1;font-size:13px;line-height:1.4;}
.biz-alert-go{color:var(--ds-warning,#b45309);font-weight:800;flex:0 0 auto;}

.biz-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
.biz-filter{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:99px;border:1px solid var(--ds-border-default);background:var(--ds-surface);color:var(--ds-text-secondary);display:inline-flex;align-items:center;gap:6px;transition:border-color .15s,background .15s,color .15s;}
.biz-filter:hover{border-color:var(--ds-brand,#088057);color:var(--ds-text-primary);}
.biz-filter.is-active{background:var(--ds-brand,#088057);border-color:var(--ds-brand,#088057);color:#fff;}
.biz-filter-n{font-size:11px;font-weight:800;opacity:.8;}
.biz-filter.is-active .biz-filter-n{opacity:.95;}

.biz-nomatch{font-size:13px;color:var(--ds-text-tertiary);padding:18px 4px;margin:0;}

.biz-readiness{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;}

.biz-progress{display:flex;flex-direction:column;gap:6px;}
.biz .progress-track{height:6px;border-radius:99px;background:var(--ds-bg-subtle);overflow:hidden;border:1px solid var(--ds-border-subtle);}
.biz .progress-fill{display:block;height:100%;border-radius:99px;background:var(--ds-brand);transition:width .4s ease;}
.biz-progress-caption{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--ds-text-tertiary);}

.biz-chips{display:flex;flex-wrap:wrap;gap:6px;}

.biz-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;margin-top:2px;border-top:1px solid var(--ds-border-subtle);}
.biz-foot-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.biz-activity{font-size:11.5px;color:var(--ds-text-tertiary);}

.biz-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:36px 24px;background:var(--ds-surface);border:1px dashed var(--ds-border-default);border-radius:var(--ds-radius-lg);}
.biz-empty h3{margin:0;font-size:15px;font-weight:700;}

@media (prefers-reduced-motion: reduce){ .biz *:not(.spinner){transition:none!important;animation:none!important;} }
`;
