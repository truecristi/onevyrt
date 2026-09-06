"use client";
/**
 * Business OS — the hub. One home for the whole operating loop, presented as a
 * guided workflow: six numbered steps, each with a live status pulled from its
 * own API, a "Continue" that jumps to the first unfinished step, and a footer
 * that links back into the rest of ONEVYRT (Funnel Studio, Campaign Studio) so
 * the OS is visibly part of the app, not a silo. This is what the toolbar's
 * "Business OS" points at.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Notice } from "../../components/ui/Notice";
import { SkeletonStats } from "../../components/Skeleton";
import { MarketingIcon, type MarketingIconName } from "../../components/MarketingIcons";
import ConnectPayments from "../../components/ConnectPayments";
import { computeStatus, type StatusMap } from "../../lib/business/progress";
import type { MyBusiness, MyBusinessCompleteness } from "@onevyrt/engine";

/** The unified business profile summary, as returned by
 *  GET /api/my-business/summary — the single "enter a fact once, see it
 *  everywhere" assembly (definition + reality map + brand). */
interface MyBusinessSummary { myBusiness: MyBusiness; completeness: MyBusinessCompleteness; }

interface StepDef { key: string; n: number; icon: MarketingIconName; title: string; desc: string; href: string; }
const STEPS: StepDef[] = [
  { key: "reality", n: 1, icon: "compass", title: "Reality Map", desc: "Where you are, where you're going, and the gap.", href: "/business/reality" },
  { key: "drivers", n: 2, icon: "tree", title: "Key Driver Tree", desc: "The levers that multiply to produce the number.", href: "/business/drivers" },
  { key: "constraint", n: 3, icon: "plan", title: "Growth Constraint", desc: "The one bottleneck to focus everything on.", href: "/business/constraint" },
  { key: "execution", n: 4, icon: "bolt", title: "Execution Centre", desc: "90-day goals → sprints → weighted tasks.", href: "/business/execution" },
  { key: "launches", n: 5, icon: "rocket", title: "Launch OS", desc: "Get each launch ready — then GO.", href: "/business/launches" },
  { key: "review", n: 6, icon: "refresh", title: "Review", desc: "Actual vs plan, learn, feed it back — loop.", href: "/business/review" },
];

interface AcqSummary { leadsTotal: number; qualified: number; nurture: number; unqualified: number; leads7d: number; bookingsTotal: number; upcoming: number; qualifyRate: number; bookRate: number; }

export default function BusinessHubPage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [status, setStatus] = useState<StatusMap>({});
  const [acq, setAcq] = useState<AcqSummary | null>(null);
  const [acqClaimable, setAcqClaimable] = useState(false);
  // The unified business profile — assembled from every store by the engine and
  // served by /api/my-business/summary. Non-blocking: a failure just hides the
  // panel, so the hub never waits on it.
  const [profile, setProfile] = useState<MyBusinessSummary | null>(null);
  // Acknowledge the Stripe Connect onboarding return. The start route sends the
  // owner back to /business?connect=done (or =refresh if they bailed early);
  // this was never read, so a successful connect landed with no confirmation
  // and an unfinished one gave no nudge. Read it once, then strip it from the
  // URL so a refresh doesn't re-show the banner.
  const [connectMsg, setConnectMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads the SAME workspace Studio is working in. Absent → the personal
  // workspace, exactly as before. Captured once (lazy) to avoid a server/client
  // hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("connect");
      if (p === "done") setConnectMsg({ tone: "ok", text: "Payment account connected — you can now collect payments in your funnels." });
      else if (p === "refresh") setConnectMsg({ tone: "warn", text: "Your payment setup isn't finished. Reopen it below to complete the details Stripe still needs." });
      if (p) { const url = new URL(window.location.href); url.searchParams.delete("connect"); window.history.replaceState({}, "", url.toString()); }
    } catch { /* SSR-safe / no query */ }
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const paths: Record<string, string> = {
        reality: `/api/business/reality${wsQuery}`, drivers: `/api/business/drivers${wsQuery}`, constraint: `/api/business/constraint${wsQuery}`,
        execution: `/api/business/execution${wsQuery}`, launches: `/api/business/launches${wsQuery}`, review: `/api/business/review${wsQuery}`,
      };
      const entries = await Promise.all(Object.entries(paths).map(async ([k, p]) => {
        const r = await fetch(p, { credentials: "include" });
        return [k, r.status, r.ok, r.ok ? await r.json().catch(() => null) : null] as const;
      }));
      if (entries.some(([, code]) => code === 401)) { setState("not-authenticated"); return; }
      // A transient load failure on any step surfaces as an error with a retry —
      // never fold a step that couldn't load into "not started", which would
      // silently revert real progress to 0/6 done on a blip.
      if (entries.some(([, , ok]) => !ok)) { setState("error"); return; }
      const map: StatusMap = {};
      for (const [k, , , d] of entries) map[k] = computeStatus(k, d);
      setStatus(map); setState("ok");
      // Acquisition snapshot — non-blocking; a failure just hides the card.
      try {
        const ar = await fetch(`/api/business/leads${wsQuery}`, { credentials: "include" });
        if (ar.ok) { const d = await ar.json(); setAcq(d.summary ?? null); setAcqClaimable(Boolean(d.demoClaimable)); }
      } catch { /* card stays hidden */ }
      // Unified business profile — non-blocking; a failure just hides the panel.
      try {
        const pr = await fetch(`/api/my-business/summary${wsQuery}`, { credentials: "include" });
        if (pr.ok) { const d = (await pr.json()) as MyBusinessSummary; setProfile(d); }
      } catch { /* panel stays hidden */ }
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const firstUnfinished = useMemo(() => STEPS.find((s) => !status[s.key]?.done) ?? STEPS[0]!, [status]);
  const doneCount = useMemo(() => STEPS.filter((s) => status[s.key]?.done).length, [status]);
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const remaining = STEPS.length - doneCount;
  // Plain-language nudge under the progress bar — tells the user where they are
  // in the loop and what "done" gets them, so the number feels motivating.
  const motivator =
    doneCount === 0
      ? "Start anywhere — step 1 maps where you are today."
      : doneCount === STEPS.length
      ? "Full loop complete. Review your results, then run it again."
      : doneCount * 2 >= STEPS.length
      ? `Over halfway — ${remaining} step${remaining === 1 ? "" : "s"} left to close the loop.`
      : `Good start — ${remaining} step${remaining === 1 ? "" : "s"} left in your operating loop.`;

  if (state === "loading") return <Shell><SkeletonStats n={4} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="Sign in to open your Business OS." href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your Business OS — your progress is safe. Try again." onRetry={() => void load()} /></Shell>;

  // A few headline facts from the unified profile for the "in one place" panel —
  // only the ones actually captured (anywhere), so the panel shows real merged
  // data, never blank rows.
  const mb = profile?.myBusiness;
  const profileFacts: { label: string; value: string }[] = mb
    ? [
        { label: "Business", value: mb.identity?.name },
        { label: "Who you serve", value: mb.customer?.whoYouServe },
        { label: "Main offer", value: mb.offer?.mainOffer },
        { label: "Biggest constraint", value: mb.strategy?.mainConstraint },
        { label: "Where you're headed", value: mb.direction?.vision ?? mb.direction?.want36m },
        { label: "Revenue now", value: mb.numbers?.revenue },
      ].flatMap((f) => (typeof f.value === "string" && f.value.trim() !== "" ? [{ label: f.label, value: f.value }] : []))
    : [];

  return (
    <Shell>
      {connectMsg && (
        <div role="status" aria-live="polite" style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 14px", borderRadius: 12, fontSize: 13.5, fontWeight: 500,
          border: "1px solid", borderColor: connectMsg.tone === "ok" ? "var(--ds-brand)" : "var(--ds-warning)",
          background: connectMsg.tone === "ok" ? "var(--ds-brand-soft)" : "var(--ds-warning-soft)",
          color: connectMsg.tone === "ok" ? "var(--ds-brand)" : "var(--ds-warning)",
        }}>
          <MarketingIcon name={connectMsg.tone === "ok" ? "check" : "warning"} size={16} />
          <span>{connectMsg.text}</span>
        </div>
      )}
      <div className="hub-header">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />ONEVYRT · Business OS</div>
          <h1>Your business, as one workflow</h1>
          <p className="sub">Work it top to bottom — where you are, what drives the number, the one constraint, execute, launch, then review and loop. Everything connects.</p>
        </div>
        <a href={`/command-center${wsQuery}`} className="btn ghost">📊 Dashboard</a>
      </div>

      {/* Your business, in one place — the unified profile assembled from every
          store (definition + reality map + brand). Enter a fact anywhere; it
          shows up here. Links to the full profile at /business/profile. */}
      {profile && (
        <a className="mbprofile" href={`/business/profile${wsQuery}`} aria-label="Open your full business profile">
          <div className="mbp-head">
            <div className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />Your business, in one place</div>
            <span className="mbp-open">View full profile →</span>
          </div>
          <p className="mbp-why">Every fact you enter — in the Reality Map, Business Intelligence or Brand — assembled into one profile, so you never define the same thing twice.</p>
          <div className="mbp-prog">
            <div className="mbp-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profile.completeness.percent} aria-label="Profile completeness">
              <span style={{ width: `${profile.completeness.percent}%` }} />
            </div>
            <span className="mbp-pct">{profile.completeness.percent}% complete</span>
          </div>
          {profileFacts.length > 0 ? (
            <div className="mbp-facts">
              {profileFacts.slice(0, 6).map((f) => (
                <div className="mbp-fact" key={f.label}>
                  <div className="mbp-fl">{f.label}</div>
                  <div className="mbp-fv">{f.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mbp-empty">Nothing captured yet — fill in your Reality Map or Business Intelligence and your whole business shows up here.</div>
          )}
        </a>
      )}

      {/* Progress + continue */}
      <div className="hub-top">
        <div className="prog-wrap">
          <div className="prog-row">
            <div
              className="prog-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={doneCount}
              aria-valuetext={`${doneCount} of ${STEPS.length} steps done`}
              aria-label="Workflow progress"
            ><span style={{ width: `${pct}%` }} /></div>
            <span className="prog-num">{doneCount}/{STEPS.length} done</span>
          </div>
          <p className="prog-help">{motivator}</p>
        </div>
        <a className="btn primary" href={`${firstUnfinished.href}${wsQuery}`}>{doneCount === 0 ? "Start the workflow →" : doneCount === STEPS.length ? "Review & loop →" : `Continue: ${firstUnfinished.title} →`}</a>
      </div>

      {/* Acquisition snapshot — the ad → qualify → book loop, at a glance */}
      {acq && (acq.leadsTotal > 0 || acq.bookingsTotal > 0) && (
        <a className="acq" href={`/business/leads${wsQuery}`} aria-label="Open your acquisition inbox">
          <div className="acq-head"><span className="acq-ic" aria-hidden="true">🧲</span><span className="acq-title">Acquisition</span><span className="acq-open">Open inbox →</span></div>
          <p className="acq-why">Your ad → qualify → book loop, at a glance.</p>
          <div className="acq-stats">
            <div className="acq-stat s-info"><div className="acq-n">{acq.leadsTotal}</div><div className="acq-l">leads{acq.leads7d > 0 ? ` · ${acq.leads7d} this week` : ""}</div></div>
            <div className="acq-stat s-success"><div className="acq-n">{acq.qualified}</div><div className="acq-l">qualified · {Math.round(acq.qualifyRate * 100)}%</div></div>
            <div className="acq-stat s-warning"><div className="acq-n">{acq.upcoming}</div><div className="acq-l">calls upcoming</div></div>
            <div className="acq-stat s-brand"><div className="acq-n">{Math.round(acq.bookRate * 100)}%</div><div className="acq-l">book rate</div></div>
          </div>
        </a>
      )}
      {acqClaimable && !acq?.leadsTotal && (
        <a className="acq claim" href={`/business/leads${wsQuery}`}>
          <div className="acq-head"><span className="acq-ic">🧲</span><span className="acq-title">Acquisition</span><span className="acq-open">Set up →</span></div>
          <div className="acq-empty">See qualified leads &amp; booked calls in one inbox. Claim the demo funnel to see it working.</div>
        </a>
      )}

      {/* The loop, as numbered steps */}
      <div className="flow-steps">
        {STEPS.map((s, i) => {
          const st = status[s.key];
          const isNext = s.key === firstUnfinished.key && !st?.done;
          const statusLabel = st?.done ? "done" : isNext ? "continue here" : st?.started ? "in progress" : "not started";
          return (
            <div key={s.key}>
              <a
                className={`fs-card ${st?.done ? "done" : ""} ${isNext ? "next" : ""}`}
                href={`${s.href}${wsQuery}`}
                aria-label={`Step ${s.n}: ${s.title}, ${statusLabel}. ${s.desc}${st?.stat ? ` ${st.stat}.` : ""}`}
              >
                <div className="fs-num" aria-hidden="true">{st?.done ? "✓" : s.n}</div>
                <div className="fs-body">
                  <div className="fs-titlerow">
                    <span className="fs-ic" aria-hidden="true"><MarketingIcon name={s.icon} size={16} /></span>
                    <span className="fs-title">{s.title}</span>
                    {isNext && <span className="fs-tag continue">Continue here</span>}
                    {st?.done ? <span className="fs-tag done">Done</span> : st?.started ? <span className="fs-tag started">In progress</span> : null}
                  </div>
                  <div className="fs-desc">{s.desc}</div>
                  {st?.stat && <div className="fs-stat">{st.stat}</div>}
                </div>
                <div className="fs-open" aria-hidden="true">Open →</div>
              </a>
              {i < STEPS.length - 1 && <div className={`fs-link ${st?.done ? "done" : ""}`} aria-hidden="true" />}
              {i === STEPS.length - 1 && <div className="fs-loop">↺ feeds back into your Reality Map</div>}
            </div>
          );
        })}
      </div>

      {/* Collect payments through your funnels (Stripe Connect) */}
      <ConnectPayments />

      {/* Connected to the rest of ONEVYRT */}
      <div className="hub-connect">
        <div className="hc-title">Part of OneVYRT — jump anywhere</div>
        <p className="hc-why">Every tool below feeds the same operating loop — open any of them whenever you need it.</p>
        <div className="hc-links">
          <a className="hc-link" href={`/business/diagnostic${wsQuery}`}><MarketingIcon name="plan" size={20} /><span>Business Diagnostic</span><em>Baseline across the 8 forces</em></a>
          <a className="hc-link" href={`/business/message${wsQuery}`}><MarketingIcon name="message" size={20} /><span>Message</span><em>Your one-liner — start here</em></a>
          <a className="hc-link" href={`/business/funnels${wsQuery}`}><MarketingIcon name="funnels" size={20} /><span>Lead Funnel Builder</span><em>Build your qualification funnel</em></a>
          <a className="hc-link" href={`/business/leads${wsQuery}`}><MarketingIcon name="leads" size={20} /><span>Leads Inbox</span><em>Qualified leads & booked calls</em></a>
          <a className="hc-link" href={`/studio${wsQuery}`}><MarketingIcon name="studio" size={20} /><span>Studio</span><em>Model the economics & flow</em></a>
          <a className="hc-link" href={`/campaign-studio/brand${wsQuery}`}><MarketingIcon name="campaigns" size={20} /><span>Campaign Studio</span><em>Brand, campaigns & AI</em></a>
          <a className="hc-link" href={`/campaign-studio/campaigns${wsQuery}`}><MarketingIcon name="rocket" size={20} /><span>Campaigns</span><em>Templates & flows</em></a>
          <a className="hc-link" href={`/studio?panel=programme${wsQuery ? `&${wsQuery.slice(1)}` : ""}`}><MarketingIcon name="book" size={20} /><span>Programme</span><em>Course & coaching (in-app)</em></a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-text-disabled:#94a3b8;--ds-danger-soft:#fff1f1;
  --prog-grad-end:#3fd39e; /* decorative gradient tip for the progress fill (light) */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ring:0 0 0 3px rgba(10,158,110,.2);--ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--accent:var(--ds-brand);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-warn-soft:#2a2005;--ds-muted-soft:#1a2234;
  --prog-grad-end:#34d399; /* decorative gradient tip for the progress fill (dark) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.hub-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:27px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow-dot{width:6px;height:6px;border-radius:50%;background:var(--ds-brand);margin-right:7px;box-shadow:0 0 0 3px var(--ds-brand-soft);}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:60ch;line-height:1.5;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:160px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}

.hub-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:16px;box-shadow:var(--ds-shadow-xs);}
.prog-wrap{display:flex;flex-direction:column;gap:7px;flex:1;min-width:220px;}
.prog-row{display:flex;align-items:center;gap:12px;}
.prog-track{flex:1;height:9px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(15,23,42,.05);}
.prog-track span{display:block;height:100%;min-width:0;background:linear-gradient(90deg,var(--ds-brand),var(--prog-grad-end));border-radius:99px;transition:width .5s var(--ds-ease);}
.prog-num{font-size:12.5px;font-weight:700;color:var(--muted);white-space:nowrap;}
.prog-help{margin:0;font-size:12px;color:var(--muted);line-height:1.45;}

.flow-steps{display:flex;flex-direction:column;}
.fs-card{display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px 16px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.fs-card:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.fs-card:active{transform:translateY(0);}
.fs-card:focus-visible{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.fs-card.next{border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-xs);}
.fs-card.next:hover{box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-md);}
.fs-card.done{background:var(--ds-success-soft);}
.fs-num{width:34px;height:34px;border-radius:50%;background:var(--ds-bg-subtle);color:var(--muted);font-weight:700;font-size:15px;display:grid;place-items:center;flex:none;}
.fs-card.done .fs-num{background:var(--ds-success);color:#fff;}
.fs-card.next .fs-num{background:var(--ds-brand);color:#fff;}
.fs-body{flex:1;min-width:0;}
.fs-titlerow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.fs-ic{display:inline-flex;color:var(--ds-brand);}
.fs-title{font-weight:700;font-size:15.5px;letter-spacing:-.2px;}
.fs-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:var(--ds-brand);color:#fff;padding:2px 8px;border-radius:999px;}
.fs-tag.continue{animation:tagPulse 2.2s var(--ds-ease) infinite;}
@keyframes tagPulse{0%,100%{box-shadow:0 0 0 0 rgba(8,128,87,0);}55%{box-shadow:0 0 0 4px rgba(8,128,87,.16);}}
.fs-tag.done{background:var(--ds-success-soft);color:var(--ds-success);}
.fs-tag.started{background:var(--ds-warning-soft);color:var(--ds-warning);}
.fs-desc{font-size:12.5px;color:var(--muted);margin-top:2px;}
.fs-stat{font-size:12px;color:var(--ds-brand);font-weight:500;margin-top:5px;background:var(--ds-brand-soft);display:inline-block;padding:2px 9px;border-radius:999px;}
.fs-card.done .fs-stat{color:var(--ds-success);background:var(--ds-surface);}
.fs-open{font-size:12.5px;color:var(--muted);font-weight:600;flex:none;transition:color .15s,transform .15s;}
.fs-card:hover .fs-open{color:var(--ds-brand);transform:translateX(2px);}
.fs-link{width:2px;height:12px;background:var(--ds-border-default);margin-left:31px;transition:background .3s var(--ds-ease);}
.fs-link.done{background:var(--ds-success);}
.fs-loop{font-size:11.5px;color:var(--ds-text-tertiary);font-weight:500;margin:8px 0 0 8px;}

.hub-connect{margin-top:26px;border-top:1px solid var(--border);padding-top:18px;}
.hc-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand);margin-bottom:4px;}
.hc-why{margin:0 0 12px;font-size:12.5px;color:var(--muted);line-height:1.45;max-width:56ch;}
.hc-links{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;}
.hc-link{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,transform .1s,box-shadow .15s;}
.hc-link svg{color:var(--ds-brand);}
.hc-link:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:var(--ds-shadow-md);}
.hc-link:focus-visible{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.hc-link span{font-size:13.5px;font-weight:700;margin-top:4px;}
.hc-link em{font-size:11.5px;color:var(--muted);font-style:normal;font-weight:500;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.acq{display:block;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:16px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.acq:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.acq:focus-visible{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.acq:hover .acq-open{text-decoration:underline;}
.acq.claim{border-style:dashed;border-color:var(--ds-border-strong);}
.acq-head{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.acq-ic{font-size:16px;}
.acq-title{font-weight:700;font-size:14px;letter-spacing:-.2px;}
.acq-open{margin-left:auto;font-size:12px;font-weight:600;color:var(--ds-brand);}
.acq-why{margin:0 0 12px;font-size:12px;color:var(--muted);line-height:1.4;}
.acq-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.acq-stat{background:var(--ds-bg-subtle);border-radius:var(--ds-radius-md);padding:10px 12px;border:1px solid transparent;}
.acq-stat.s-info{background:var(--ds-info-soft);border-color:color-mix(in srgb,var(--ds-info) 22%,transparent);}
.acq-stat.s-info .acq-n{color:var(--ds-info);}
.acq-stat.s-success{background:var(--ds-success-soft);border-color:color-mix(in srgb,var(--ds-success) 22%,transparent);}
.acq-stat.s-success .acq-n{color:var(--ds-success);}
.acq-stat.s-warning{background:var(--ds-warning-soft);border-color:color-mix(in srgb,var(--ds-warning) 22%,transparent);}
.acq-stat.s-warning .acq-n{color:var(--ds-warning);}
.acq-stat.s-brand{background:var(--ds-brand-soft);border-color:color-mix(in srgb,var(--ds-brand) 22%,transparent);}
.acq-stat.s-brand .acq-n{color:var(--ds-brand);}
.acq-n{font-size:22px;font-weight:700;line-height:1;letter-spacing:-.5px;}
.acq-l{font-size:11px;color:var(--muted);margin-top:5px;line-height:1.3;}
.acq-empty{font-size:13px;color:var(--muted);line-height:1.5;}
@media(max-width:560px){.acq-stats{grid-template-columns:repeat(2,1fr);}}

/* Your business, in one place — the unified profile panel. */
.mbprofile{display:block;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;margin-bottom:16px;text-decoration:none;color:var(--text);box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.mbprofile:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.mbprofile:focus-visible{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.mbp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;}
.mbp-open{font-size:12px;font-weight:600;color:var(--ds-brand);white-space:nowrap;}
.mbprofile:hover .mbp-open{text-decoration:underline;}
.mbp-why{margin:0 0 12px;font-size:12px;color:var(--muted);line-height:1.45;max-width:62ch;}
.mbp-prog{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.mbp-track{flex:1;height:8px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(15,23,42,.05);}
.mbp-track span{display:block;height:100%;min-width:0;background:linear-gradient(90deg,var(--ds-brand),var(--prog-grad-end));border-radius:99px;transition:width .5s var(--ds-ease);}
.mbp-pct{font-size:12px;font-weight:700;color:var(--muted);white-space:nowrap;}
.mbp-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;}
.mbp-fact{background:var(--ds-bg-subtle);border-radius:var(--ds-radius-md);padding:9px 12px;min-width:0;}
.mbp-fl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-brand);margin-bottom:3px;}
.mbp-fv{font-size:12.5px;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.mbp-empty{font-size:12.5px;color:var(--muted);line-height:1.5;}

/* Respect users who prefer less motion — kill transitions + the tag pulse. */
@media (prefers-reduced-motion: reduce){
  .hub-root *{transition:none!important;animation:none!important;}
}
`;
