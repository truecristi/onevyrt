"use client";
/**
 * AI Insights — the flywheel's "learn" step made legible. Pulls the workspace's
 * real acquisition metrics (server snapshot, no AI) and turns them into a plain-
 * English weekly read with the owner's own connected AI (key stays client-side).
 * Shows the numbers regardless; the AI digest is generated on demand.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { insightsPrompt, parseInsights, isSnapshotEmpty, type InsightsSnapshot, type InsightsDigest } from "../../../lib/insights/prompt";
import { SkeletonStats } from "../../../components/Skeleton";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { EmptyState } from "../../../components/ui/EmptyState";

function pct(x: number): string { return `${Math.round((x || 0) * 100)}%`; }
function money(n: number, ccy: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n); }
  catch { return `${ccy} ${Math.round(n)}`; }
}

export default function InsightsPage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [snap, setSnap] = useState<InsightsSnapshot | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [digest, setDigest] = useState<InsightsDigest | null>(null);
  const [g, setG] = useState<Grounding | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/insights", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json(); setSnap(d.snapshot); setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadGrounding().then(setG); }, []);

  const empty = useMemo(() => (snap ? isSnapshotEmpty(snap) : true), [snap]);

  const generate = useCallback(async () => {
    if (!snap) return;
    setErr("");
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") { setErr("Connect an AI provider first — or use the included AI."); setAiOpen(true); return; }
    setBusy(true); setDigest(null);
    try {
      const { system, user } = insightsPrompt(snap);
      const g = await loadGrounding();
      const reply = await callAI(conn, system, withGrounding(g, user), 1100);
      setDigest(parseInsights(reply));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate the digest — check your AI connection.");
    } finally { setBusy(false); }
  }, [snap]);

  if (state === "loading") return <Shell><SkeletonStats n={4} /></Shell>;
  if (state === "not-authenticated") return <Shell><EmptyState icon="lock" title="Please sign in" action={<a className="btn primary" href="/">Go to sign in</a>} /></Shell>;
  if (state === "error" || !snap) return <Shell><EmptyState icon="warning" title="Couldn&rsquo;t load insights" action={<button className="btn" onClick={() => void load()}>Retry</button>} /></Shell>;

  const o = snap.overview, e = snap.economics;

  // Diagnosis, computed straight from the snapshot — no AI required. The funnel
  // is two conversions: leads → qualified, then qualified → booked. The weaker
  // conversion is the biggest leak; qualifying wins ties because it sits
  // upstream, so fixing it lifts every stage below it too.
  const lostQualify = Math.max(0, o.leadsTotal - o.qualified);
  const lostBook = Math.max(0, o.qualified - o.bookingsTotal);
  const weakest: 0 | 1 | null =
    o.leadsTotal === 0 ? null
      : o.qualified === 0 ? 0
        : o.qualifyRate <= o.bookRate ? 0 : 1;
  const weak =
    weakest === 0
      ? { lead: "Your biggest drop-off is at the qualify step.", why: "Most people who opt in aren't the right fit. Sharpen who you attract — or loosen qualifying questions that turn good-fit people away." }
      : weakest === 1
        ? { lead: "Your biggest drop-off is at the booking step.", why: "The fit is there but the call isn't. Make booking effortless — a clearer calendar and a stronger reason to book now." }
        : null;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Insights</div>
          <h1>What&rsquo;s working</h1>
          <p className="sub">Your real acquisition numbers in plain English — the best angle to double down on, and the biggest leak to fix.</p>
        </div>
        <button className="btn ai" onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen} aria-controls="ai-connect-panel" aria-label="AI connection settings">
          <MarketingIcon name="gear" size={15} /> AI
        </button>
      </div>

      {aiOpen && <div className="card ai-panel" id="ai-connect-panel"><AiConnectFields /></div>}

      {/* The numbers (always shown) */}
      <div className="stats">
        <Stat n={o.leadsTotal} l="leads" sub={`${o.leads7d} in 7 days`} tone="info" />
        <Stat n={o.qualified} l="qualified" sub={`${pct(o.qualifyRate)} qualify rate`} tone="brand" hero />
        <Stat n={o.bookingsTotal} l="booked" sub={`${pct(o.bookRate)} of qualified`} tone="success" />
        <Stat n={e.costPerQualified > 0 ? money(e.costPerQualified, snap.currency) : "—"} l="cost / qualified" sub={e.costPerBooking > 0 ? `${money(e.costPerBooking, snap.currency)} / booked` : "add ad spend for CAC"} tone="warning" />
      </div>

      {/* Diagnosis — where people fall out of the funnel, from your own numbers */}
      {o.leadsTotal > 0 && (
        <section className="card diag lift" aria-label="Funnel diagnosis">
          <div className="diag-h">
            <span className="diag-ic" aria-hidden="true"><MarketingIcon name="funnels" size={16} /></span>
            <span className="diag-title">Where you&rsquo;re losing people</span>
            {e.costPerQualified > 0 && <span className="diag-chip" title="Cost per qualified lead">{money(e.costPerQualified, snap.currency)} / qualified</span>}
          </div>
          <p className="diag-sub">Each stage drops some people. Your weakest stage is the biggest opportunity — fix it first and everything below it lifts too.</p>
          <div className="fn">
            <div className="fn-stage" data-tone="info">
              <span className="fn-l">Leads</span>
              <span className="fn-sub">opted in</span>
              <span className="fn-n">{o.leadsTotal}</span>
            </div>
            <div className={`fn-drop${weakest === 0 ? " leak" : ""}`}>
              <span className="fn-rate">{pct(o.qualifyRate)} qualify</span>
              <span className="fn-lost">{lostQualify} didn&rsquo;t</span>
              {weakest === 0 && <span className="leak-pill">Biggest leak</span>}
            </div>
            <div className="fn-stage" data-tone="brand">
              <span className="fn-l">Qualified</span>
              <span className="fn-sub">a real fit</span>
              <span className="fn-n">{o.qualified}</span>
            </div>
            <div className={`fn-drop${weakest === 1 ? " leak" : ""}`}>
              <span className="fn-rate">{pct(o.bookRate)} book</span>
              <span className="fn-lost">{lostBook} didn&rsquo;t</span>
              {weakest === 1 && <span className="leak-pill">Biggest leak</span>}
            </div>
            <div className="fn-stage" data-tone="success">
              <span className="fn-l">Booked</span>
              <span className="fn-sub">on your calendar</span>
              <span className="fn-n">{o.bookingsTotal}</span>
            </div>
          </div>
          {weak && (
            <div className="diag-why">
              <span className="diag-why-tag">Fix this first</span>
              <span className="diag-why-txt"><b>{weak.lead}</b> {weak.why}</span>
            </div>
          )}
        </section>
      )}

      {/* The AI read */}
      {empty
        ? <div className="empty"><span className="empty-ic" aria-hidden="true"><MarketingIcon name="insights" size={22} /></span><span><b>No acquisition data yet.</b> Publish a funnel and drive some traffic — once leads come in, your numbers and your first AI read appear right here.</span></div>
        : (
          <div className="digest-wrap">
            <div className="digest-ground"><GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} /></div>
            {!digest && <button className="btn primary big" disabled={busy} onClick={() => void generate()}>{busy ? "Reading your numbers…" : "✨ Generate this week's read"}</button>}
            {err && <div className="err" role="alert"><MarketingIcon name="warning" size={15} /> {err}</div>}
            {digest && (
              <div className="digest">
                <div className="dg-head">
                  <div className="dg-eyebrow"><MarketingIcon name="spark" size={13} /> Your AI read</div>
                  <div className="dg-headline">{digest.headline}</div>
                  {digest.summary && <div className="dg-summary">{digest.summary}</div>}
                  <button className="btn tiny" disabled={busy} onClick={() => void generate()}>{busy ? "…" : "↻ Regenerate"}</button>
                </div>
                <div className="dg-list">
                  {digest.insights.map((ins, i) => (
                    <div className="ins" key={i}>
                      <span className="ins-num" aria-hidden="true">{i + 1}</span>
                      <div className="ins-body">
                        <div className="ins-title">{ins.title}</div>
                        {ins.detail && <div className="ins-detail">{ins.detail}</div>}
                        {ins.action && <div className="ins-action"><span className="ins-action-tag">Do this</span>{ins.action}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hint">Generated from your numbers by your connected AI. Not stored — regenerate any time.</div>
              </div>
            )}
          </div>
        )}

      {/* Angle leaderboard — the raw signal behind the read */}
      {snap.angles.length > 0 && (
        <div className="card lift">
          <div className="card-h"><span className="card-ic" aria-hidden="true"><MarketingIcon name="trophy" size={16} /></span> Angles by qualify rate</div>
          <p className="card-sub">An &ldquo;angle&rdquo; is the promise your ad leads with. A higher qualify rate means that message is pulling in the right people — do more of it.</p>
          <div className="lb">
            {snap.angles.map((a, i) => (
              <div className={`lb-row ${i === 0 ? "top" : ""}`} key={a.angle}>
                <span className="lb-name">{i === 0 && <span className="lb-crown" aria-hidden="true">🏆 </span>}{a.angle}</span>
                <span className="lb-bar" aria-hidden="true"><span style={{ width: `${Math.round(a.qualifyRate * 100)}%` }} /></span>
                <span className="lb-stat"><b>{pct(a.qualifyRate)}</b> · {a.qualified}/{a.leads}{a.costPerQualified > 0 ? <span className="lb-cost"> · {money(a.costPerQualified, snap.currency)}/q</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Stat({ n, l, sub, tone, hero }: { n: number | string; l: string; sub: string; tone?: "info" | "brand" | "success" | "warning"; hero?: boolean }) {
  return <div className="stat" data-tone={tone}><div className={`stat-n${hero ? " grad" : ""}`}>{n}</div><div className="stat-l">{l}</div><div className="stat-sub">{sub}</div></div>;
}

function Shell({ children }: { children: ReactNode }) { return <div className="in-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.in-root{
  /* Local aliases point at the theme-aware design-system tokens, so this page
     tracks BOTH the light theme and the navy-blue-grey dark theme on its own —
     no hand-rolled dark palette to drift out of sync. */
  --surface:var(--ds-surface);
  --text:var(--ds-text-primary);
  --muted:var(--ds-text-secondary);
  --tertiary:var(--ds-text-tertiary);
  --border:var(--ds-border-subtle);
  --border-strong:var(--ds-border-default);
  --bg:var(--ds-bg-app);
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--bg);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.in-root *{box-sizing:border-box;}

.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.hub-header h1{font-size:26px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ds-brand);box-shadow:0 0 0 3px var(--ds-brand-soft);}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:62ch;line-height:1.5;}

/* Buttons: the design system's canonical .btn drives colour, size, hover,
   active-press and the focus ring. Only per-page layout tweaks live here. */
.btn.big{width:100%;}
.btn.tiny{margin-left:auto;}

.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.card.lift{transition:transform .15s var(--ds-ease,ease),box-shadow .15s var(--ds-ease,ease),border-color .15s var(--ds-ease,ease);}
.card.lift:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-md);border-color:var(--border-strong);}
.card-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-bottom:4px;}
.card-ic{display:inline-flex;color:var(--ds-brand);}
.card-sub{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0 0 12px;max-width:60ch;}
.ai-panel{display:flex;flex-direction:column;gap:8px;}

.err{display:flex;align-items:center;gap:7px;color:var(--ds-danger);background:var(--ds-danger-soft);border:1px solid var(--ds-danger);border-radius:10px;padding:9px 12px;font-size:13px;font-weight:500;margin-top:10px;}
.hint{font-size:11.5px;color:var(--tertiary);margin-top:12px;line-height:1.5;}
.empty{display:flex;flex-direction:column;align-items:center;gap:9px;background:var(--surface);border:1px dashed var(--border-strong);border-radius:12px;padding:30px 22px;text-align:center;color:var(--muted);font-size:13.5px;line-height:1.6;margin-bottom:14px;}
.empty-ic{display:inline-flex;color:var(--ds-brand);opacity:.9;}
.empty b{color:var(--text);display:block;font-size:15px;margin-bottom:2px;}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;}
.stat{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 15px 14px;box-shadow:var(--ds-shadow-xs);transition:transform .15s var(--ds-ease,ease),box-shadow .15s var(--ds-ease,ease),border-color .15s var(--ds-ease,ease);}
.stat::before{content:"";position:absolute;left:0;top:0;height:3px;width:100%;background:var(--stat-accent,var(--ds-border-strong));}
.stat:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-md);border-color:var(--border-strong);}
.stat[data-tone="info"]{--stat-accent:var(--ds-info);}
.stat[data-tone="brand"]{--stat-accent:var(--ds-brand);}
.stat[data-tone="success"]{--stat-accent:var(--ds-success);}
.stat[data-tone="warning"]{--stat-accent:var(--ds-warning);}
.stat-n{font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1.1;}
.stat-n.grad{background-image:linear-gradient(90deg,var(--ds-brand-active),var(--ds-brand));color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.stat-n.grad{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.stat-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tertiary);margin-top:5px;}
.stat[data-tone="info"] .stat-l{color:var(--ds-info);}
.stat[data-tone="brand"] .stat-l{color:var(--ds-brand-active);}
.stat[data-tone="success"] .stat-l{color:var(--ds-success);}
.stat[data-tone="warning"] .stat-l{color:var(--ds-warning);}
.stat-sub{font-size:11.5px;color:var(--muted);margin-top:4px;}

/* Diagnosis band — the weakest funnel step + cost per qualified, at a glance */
.diag-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.diag-ic{display:inline-flex;color:var(--ds-brand);}
.diag-title{font-size:15px;font-weight:700;letter-spacing:-.1px;}
.diag-chip{margin-left:auto;display:inline-flex;align-items:center;font-size:12px;font-weight:600;color:var(--ds-warning);background:var(--ds-warning-soft);border:1px solid var(--ds-warning);border-radius:999px;padding:3px 10px;}
.diag-sub{font-size:12.5px;color:var(--muted);line-height:1.5;margin:7px 0 12px;max-width:62ch;}
.fn{display:flex;flex-direction:column;gap:6px;}
.fn-stage{display:flex;align-items:baseline;gap:8px;padding:10px 13px;border-radius:10px;background:var(--ds-bg-subtle);border-left:3px solid var(--stage-accent,var(--ds-border-strong));}
.fn-stage[data-tone="info"]{--stage-accent:var(--ds-info);}
.fn-stage[data-tone="brand"]{--stage-accent:var(--ds-brand);}
.fn-stage[data-tone="success"]{--stage-accent:var(--ds-success);}
.fn-l{font-size:14px;font-weight:700;color:var(--text);}
.fn-sub{font-size:11.5px;color:var(--tertiary);}
.fn-n{margin-left:auto;font-size:20px;font-weight:700;letter-spacing:-.4px;color:var(--text);}
.fn-drop{display:flex;align-items:center;gap:8px;padding:2px 13px;font-size:12px;color:var(--muted);}
.fn-drop::before{content:"↓";font-weight:800;font-size:13px;line-height:1;color:var(--tertiary);}
.fn-rate{font-weight:700;color:var(--text);}
.fn-lost{color:var(--tertiary);}
.fn-drop.leak{color:var(--ds-warning);}
.fn-drop.leak::before,.fn-drop.leak .fn-rate,.fn-drop.leak .fn-lost{color:var(--ds-warning);}
.leak-pill{margin-left:auto;display:inline-flex;align-items:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-warning);background:var(--ds-warning-soft);border:1px solid var(--ds-warning);border-radius:999px;padding:2px 8px;}
.diag-why{margin-top:12px;display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;background:var(--ds-brand-soft);border:1px solid var(--ds-border-subtle);border-radius:10px;padding:11px 12px;}
.diag-why-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand-active);background:var(--surface);border-radius:6px;padding:3px 8px;}
.diag-why-txt{flex:1;min-width:200px;font-size:12.5px;color:var(--text);line-height:1.5;}
.diag-why-txt b{font-weight:700;}

.digest-wrap{margin-bottom:14px;}
.digest-ground{margin-bottom:10px;}
.digest{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--ds-shadow-sm);}
.dg-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:14px;}
.dg-eyebrow{width:100%;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-brand-active);}
.dg-headline{font-size:17px;font-weight:700;letter-spacing:-.2px;line-height:1.3;flex:1;min-width:60%;}
.dg-summary{font-size:13px;color:var(--muted);line-height:1.5;width:100%;}
.dg-list{display:flex;flex-direction:column;gap:12px;}
.ins{display:flex;gap:10px;align-items:flex-start;border-left:3px solid var(--ds-brand);padding-left:12px;}
.ins-num{flex:none;width:20px;height:20px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand-active);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;}
.ins-body{flex:1;min-width:0;}
.ins-title{font-size:14.5px;font-weight:700;}
.ins-detail{font-size:13px;color:var(--muted);line-height:1.5;margin-top:3px;}
.ins-action{font-size:13px;color:var(--text);line-height:1.5;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;}
.ins-action-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-brand-active);background:var(--ds-brand-soft);border-radius:6px;padding:2px 7px;}

.lb{display:flex;flex-direction:column;gap:3px;}
.lb-row{display:grid;grid-template-columns:130px 1fr auto;gap:10px;align-items:center;font-size:12.5px;padding:5px 7px;border-radius:8px;transition:background .15s var(--ds-ease,ease);}
.lb-row:hover{background:var(--ds-bg-subtle);}
.lb-row.top{background:var(--ds-brand-soft);}
.lb-name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lb-row.top .lb-name{font-weight:700;color:var(--ds-brand-active);}
.lb-bar{height:8px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;}
.lb-bar span{display:block;height:100%;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));border-radius:99px;}
.lb-stat{font-size:11.5px;color:var(--muted);white-space:nowrap;}.lb-stat b{color:var(--ds-brand-active);font-size:13px;}
.lb-cost{color:var(--tertiary);}

@media (prefers-reduced-motion: reduce){.in-root *{transition:none!important;animation:none!important;}}
`;
