"use client";
/**
 * Business OS — Review / Close the Loop. Records what actually happened against
 * the plan's targets (pulled from the Driver Tree), captures the retro, and
 * feeds it back: push the current-state snapshot into the Reality Map's "now"
 * and point at the next constraint. Each pass is a review cycle; the history
 * shows the loop turning. Styled with the shared design-system tokens, so it
 * follows the user's light/dark theme like the rest of the app.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { MarketingIcon, type MarketingIconName } from "../../../components/MarketingIcons";
import { GroundingChips } from "../../../components/campaign/GroundingChips";

interface MetricActual { id: string; label: string; target: string; actual: string; note: string; }
interface StateSnapshot { revenue: string; profit: string; customers: string; team: string; }
interface ReviewCycle { id: string; period: string; date: string; metrics: MetricActual[]; snapshot: StateSnapshot; worked: string; didnt: string; learned: string; decision: string; nextConstraint: string; }
interface ReviewData { cycles: ReviewCycle[]; updatedAt?: string; }

interface LoopStep { icon: MarketingIconName; label: string; href: string; }
const LOOP_STEPS: LoopStep[] = [
  { icon: "compass", label: "Reality", href: "/business/reality" },
  { icon: "tree", label: "Drivers", href: "/business/drivers" },
  { icon: "plan", label: "Constraint", href: "/business/constraint" },
  { icon: "bolt", label: "Execute", href: "/business/execution" },
  { icon: "rocket", label: "Launch", href: "/business/launches" },
  { icon: "refresh", label: "Review", href: "/business/review" },
];

function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }
function parseNum(s: string): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim(); if (!t) return NaN;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[%$,\s]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}
/** Actual as a share of target, with a hit band. Higher is better (works for
 *  "grow this" metrics, the common case). */
function variance(target: string, actual: string): { pct: number | null; band: "hit" | "near" | "miss" | "none" } {
  const t = parseNum(target), a = parseNum(actual);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t === 0) return { pct: null, band: "none" };
  const ratio = a / t;
  const pct = Math.round(ratio * 100);
  const band = ratio >= 1 ? "hit" : ratio >= 0.8 ? "near" : "miss";
  return { pct, band };
}
/** Plain-language meaning behind a variance band, for tooltips and screen readers. */
function bandLabel(band: "hit" | "near" | "miss" | "none"): string {
  switch (band) {
    case "hit": return "on target";
    case "near": return "close — within 20%";
    case "miss": return "missed target";
    default: return "not enough data to score yet";
  }
}

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

export default function ReviewPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<ReviewData>({ cycles: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pushing, setPushing] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiKey, setAiKeyState] = useState("");
  const [aiModel, setAiModelState] = useState("openai/gpt-4o-mini");
  const [g, setG] = useState<Grounding | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });
  const latest = useRef(data); latest.current = data;

  useEffect(() => { setAiKeyState(getAiKey()); setAiModelState(getAiModel()); }, []);
  // Surface what the AI review is grounded in (was invisible — loadGrounding()
  // fed the prompt with no on-screen trace). Loaded once on mount for display;
  // the fresh loadGrounding() inside aiReview() below still runs per click so
  // generation always reflects current data.
  useEffect(() => { void loadGrounding().then(setG); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/review${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as ReviewData;
      setData({ cycles: d.cycles ?? [], updatedAt: d.updatedAt });
      if (d.cycles?.[0]) setOpen({ [d.cycles[0].id]: true });
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 3000); };
  const mutate = (fn: (d: ReviewData) => ReviewData) => { setData((p) => fn(p)); setDirty(true); };

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/review${wsQuery}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(latest.current) });
      const b = await r.json() as ReviewData & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      setData({ cycles: b.cycles ?? [], updatedAt: b.updatedAt });
      setDirty(false); flash("Saved.");
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  // New cycle: seed metrics from the Driver Tree targets and prefill the
  // snapshot from the current Reality Map "now" — so closing the loop starts
  // from the plan you set at the top of it.
  const newCycle = async () => {
    const cycle: ReviewCycle = { id: uid(), period: "", date: "", metrics: [], snapshot: { revenue: "", profit: "", customers: "", team: "" }, worked: "", didnt: "", learned: "", decision: "", nextConstraint: "" };
    try {
      const [dr, re] = await Promise.all([
        fetch(`/api/business/drivers${wsQuery}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/business/reality${wsQuery}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      // Seed only from a REAL driver tree (saved, or with a target/drivers) —
      // getDriverTree returns a default outcome label even for an untouched
      // tree, so gating on that alone would seed a stray row and hide the
      // "fill the Driver Tree first" tip below.
      const drivers = dr && Array.isArray(dr.drivers) ? dr.drivers : [];
      const treeReal = !!(dr && typeof dr === "object" && (dr.updatedAt || dr.outcomeTarget || drivers.length));
      if (treeReal) {
        const metrics: MetricActual[] = [];
        if (dr.outcomeLabel) metrics.push({ id: uid(), label: dr.outcomeLabel, target: dr.outcomeTarget ?? "", actual: "", note: "outcome" });
        for (const d of drivers) metrics.push({ id: uid(), label: d.label ?? "", target: d.target ?? "", actual: "", note: "" });
        cycle.metrics = metrics;
      }
      if (re && typeof re === "object" && re.now) cycle.snapshot = { revenue: re.now.revenue ?? "", profit: re.now.profit ?? "", customers: re.now.customers ?? "", team: re.now.team ?? "" };
    } catch { /* seed is best-effort */ }
    mutate((d) => ({ ...d, cycles: [cycle, ...d.cycles] }));
    setOpen((o) => ({ ...o, [cycle.id]: true }));
    if (cycle.metrics.length === 0) flash("New cycle added. Tip: fill the Driver Tree first to auto-load targets here.");
  };

  const removeCycle = (id: string) => mutate((d) => ({ ...d, cycles: d.cycles.filter((c) => c.id !== id) }));
  const patchCycle = (id: string, patch: Partial<ReviewCycle>) => mutate((d) => ({ ...d, cycles: d.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  // Feed the snapshot back into the Reality Map's "now" without clobbering the
  // rest of the map: read it, merge, write it back.
  const pushToReality = async (cycle: ReviewCycle) => {
    setPushing(cycle.id); setErr("");
    try {
      // Only carry snapshot fields the user actually filled. The route does
      // a true partial merge (lib/reality.ts's patchReality) so this can
      // PATCH just the "now" fields directly — no need to GET the current
      // map first, and nothing else in it is ever touched.
      const snap = Object.fromEntries(Object.entries(cycle.snapshot).filter(([, v]) => typeof v === "string" && v.trim()));
      const pr = await fetch(`/api/business/reality${wsQuery}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ now: snap }) });
      if (!pr.ok) { const b = await pr.json().catch(() => ({})); setErr(b.error ?? "Could not update the Reality Map."); return; }
      flash("Reality Map 'now' updated from this cycle. The loop is closed — pick the next constraint.");
    } catch { setErr("Could not update the Reality Map."); }
    finally { setPushing(null); }
  };

  // AI review: read the cycle's actual-vs-target scoreboard and draft the retro
  // (worked / didn't / learned / decided) plus the next constraint to attack.
  const aiReview = async (cycle: ReviewCycle) => {
    if (getAiProvider() === "manual") { setAiOpen(true); setErr("Connect an AI provider first (the ⚙ AI button)."); return; }
    setAiBusy(cycle.id); setErr("");
    try {
      const scoreboard = cycle.metrics.map((m) => {
        const v = variance(m.target, m.actual);
        return `- ${m.label || "metric"}: target ${m.target || "?"}, actual ${m.actual || "?"}${v.pct !== null ? ` (${v.pct}% of target)` : ""}`;
      }).join("\n") || "(no metrics recorded)";
      const system = "You are a sharp business operating coach. Given a period's results vs targets, write a crisp, honest retrospective. Be specific and practical. Return ONLY a JSON object with keys: worked, didnt, learned, decision, nextConstraint. Each value is 1-3 short sentences; nextConstraint is a short phrase naming the single biggest thing now limiting growth.";
      const user = `PERIOD: ${cycle.period || "(unnamed)"}\n\nSCOREBOARD (actual vs target):\n${scoreboard}\n\nCurrent-state snapshot: revenue ${cycle.snapshot.revenue || "?"}, profit ${cycle.snapshot.profit || "?"}, customers ${cycle.snapshot.customers || "?"}, team ${cycle.snapshot.team || "?"}.\n\nWrite the retrospective as JSON now.`;
      const g = await loadGrounding();
      const reply = await callOpenRouter(aiKey, aiModel, system, withGrounding(g, user), 500);
      const j = extractJson(reply) as { worked?: string; didnt?: string; learned?: string; decision?: string; nextConstraint?: string };
      patchCycle(cycle.id, {
        worked: j.worked ?? cycle.worked, didnt: j.didnt ?? cycle.didnt, learned: j.learned ?? cycle.learned,
        decision: j.decision ?? cycle.decision, nextConstraint: j.nextConstraint ?? cycle.nextConstraint,
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "AI review failed."); }
    finally { setAiBusy(null); }
  };

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading your reviews…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use Review." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your reviews." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="rv-header">
        <div>
          <div className="eyebrow">Business OS · Close the loop</div>
          <h1>Review</h1>
          <p className="sub">What actually happened vs the plan — and what you'll change. Feed it back into the map, then attack the next constraint.</p>
        </div>
        <div className="header-right">
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI settings" aria-expanded={aiOpen} aria-controls="rv-ai-panel"><MarketingIcon name="gear" size={14} /> AI</button>
          <a href="/business" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a>
          <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>
        </div>
      </div>

      {aiOpen && (
        <div className="ai-key-card" id="rv-ai-panel">
          <div className="cols">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="hint">Get a key at openrouter.ai — it's saved to your account (encrypted) and sent straight to the provider. Used across the whole app's AI.</p>
        </div>
      )}

      {/* Loop ribbon — this is the step that closes it */}
      <div className="loop" aria-label="Business OS loop — you are here">
        {LOOP_STEPS.map((s, i) => {
          const isHere = s.label === "Review";
          return (
            <span key={s.label} className="loop-step-wrap">
              <a className={`loop-step ${isHere ? "here" : ""}`} href={s.href} aria-current={isHere ? "step" : undefined}><span className="loop-ic" aria-hidden="true"><MarketingIcon name={s.icon} size={14} /></span>{s.label}</a>
              <span className="loop-arrow" aria-hidden="true">{i === LOOP_STEPS.length - 1 ? "↺" : "→"}</span>
            </span>
          );
        })}
      </div>

      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      <div className="sec-head">
        <div><h2 className="sec-title">Review cycles</h2><p className="hint">One per period (a month, a sprint, a launch). New cycles auto-load your Driver Tree targets to score against.</p></div>
        <button className="btn primary" onClick={() => void newCycle()}>+ New review cycle</button>
      </div>

      {data.cycles.length === 0 && (
        <div className="panel center empty-panel">
          <div className="empty-ic" aria-hidden="true">🔄</div>
          <div className="empty-title">No reviews yet</div>
          <p className="empty-sub">Once a period wraps and you've got real numbers, start your first cycle above — it pulls in your Driver Tree targets automatically, so you're scoring actual vs. plan from day one.</p>
        </div>
      )}

      {data.cycles.map((c) => {
        const isOpen = open[c.id];
        // One variance() pass per metric, shared by the collapsed-row pill, the
        // "at a glance" summary and the scoreboard rows below — so the numbers
        // can't drift out of sync with each other.
        const vs = c.metrics.map((m) => variance(m.target, m.actual));
        const scoredVs = vs.filter((v) => v.band !== "none");
        const hits = scoredVs.filter((v) => v.band === "hit").length;
        const nears = scoredVs.filter((v) => v.band === "near").length;
        const misses = scoredVs.filter((v) => v.band === "miss").length;
        const scored = scoredVs.length;
        const avgPct = scored > 0 ? Math.round(scoredVs.reduce((s, v) => s + (v.pct ?? 0), 0) / scored) : null;
        const cycleBand: "hit" | "near" | "miss" = hits === scored ? "hit" : misses === 0 ? "near" : "miss";
        const barWidth = Math.max(4, Math.min(100, avgPct ?? 0));
        const bodyId = `rv-body-${c.id}`;
        return (
          <div key={c.id} className="cycle">
            <button className="cycle-bar" onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} aria-expanded={isOpen} aria-controls={bodyId}>
              <span className="cycle-caret" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
              <span className="cycle-title">{c.period || "Untitled cycle"}</span>
              {c.date && <span className="cycle-date">{c.date}</span>}
              {scored > 0 && <span className={`cycle-score ${cycleBand}`}>{hits}/{scored} targets hit</span>}
            </button>
            {isOpen && (
              <div className="cycle-body" id={bodyId}>
                <div className="cols">
                  <label className="mini"><span>Period</span><input value={c.period} onChange={(e) => patchCycle(c.id, { period: e.target.value })} placeholder="e.g. August 2026" /></label>
                  <label className="mini"><span>Date reviewed</span><input type="date" value={c.date} onChange={(e) => patchCycle(c.id, { date: e.target.value })} /></label>
                </div>

                {/* Scoreboard */}
                <div className="sub-h">Scoreboard — actual vs target</div>
                <p className="hint">Actual as a share of target — <span className="tag hit">100%+ hit</span> <span className="tag near">80–99% close</span> <span className="tag miss">under 80% miss</span>.</p>
                {scored > 0 && (
                  <div className="glance">
                    <div className="glance-hero">
                      <span className={`glance-num ${cycleBand}`}>{avgPct ?? 0}%</span>
                      <span className="glance-label">average vs target</span>
                    </div>
                    <div className="glance-bar" role="img" aria-label={`Averaging ${avgPct ?? 0}% of target across ${scored} scored metric${scored === 1 ? "" : "s"}`}>
                      <span className={cycleBand} style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="glance-chips">
                      {hits > 0 && <span className="tag hit">{hits} hit</span>}
                      {nears > 0 && <span className="tag near">{nears} close</span>}
                      {misses > 0 && <span className="tag miss">{misses} missed</span>}
                    </div>
                  </div>
                )}
                {c.metrics.length === 0
                  ? <p className="muted-panel">No metrics — <button className="linkbtn" onClick={() => patchCycle(c.id, { metrics: [{ id: uid(), label: "", target: "", actual: "", note: "" }] })}>add one</button> or fill the Driver Tree and start a new cycle.</p>
                  : (
                    <div className="scoreboard">
                      <div className="sb-row sb-head"><span>Metric</span><span>Target</span><span>Actual</span><span>vs target</span><span /></div>
                      {c.metrics.map((m, i) => {
                        const v = vs[i]!;
                        const vTitle = v.pct === null ? "Add a target and an actual to score this metric" : `${v.pct}% of target — ${bandLabel(v.band)}`;
                        return (
                          <div key={m.id} className="sb-row">
                            <input aria-label="Metric name" value={m.label} onChange={(e) => patchCycle(c.id, { metrics: c.metrics.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)) })} placeholder="Metric" />
                            <input aria-label="Target" value={m.target} onChange={(e) => patchCycle(c.id, { metrics: c.metrics.map((x) => (x.id === m.id ? { ...x, target: e.target.value } : x)) })} placeholder="Target" />
                            <input aria-label="Actual" value={m.actual} onChange={(e) => patchCycle(c.id, { metrics: c.metrics.map((x) => (x.id === m.id ? { ...x, actual: e.target.value } : x)) })} placeholder="Actual" />
                            <span className={`vbadge ${v.band}`} title={vTitle} aria-label={vTitle}>{v.pct === null ? "—" : `${v.pct}%`}</span>
                            <button className="tool danger" title="Remove metric" aria-label="Remove metric" onClick={() => patchCycle(c.id, { metrics: c.metrics.filter((x) => x.id !== m.id) })}>×</button>
                          </div>
                        );
                      })}
                      <button className="btn ghost sm" onClick={() => patchCycle(c.id, { metrics: [...c.metrics, { id: uid(), label: "", target: "", actual: "", note: "" }] })}>+ Metric</button>
                    </div>
                  )}

                {/* Retro */}
                <div className="sub-h-row">
                  <div className="sub-h">What we learned</div>
                  <div className="sub-h-actions">
                    <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
                    <button className="btn ai sm" onClick={() => void aiReview(c)} disabled={aiBusy === c.id}>
                      {aiBusy === c.id ? <><span className="mini-spin" aria-hidden="true" /> Analysing…</> : <><MarketingIcon name="spark" size={13} /> AI review this cycle</>}
                    </button>
                  </div>
                </div>
                <p className="hint">Be honest about the gap above, then turn it into a decision — that's what actually changes next cycle.</p>
                <div className="cols">
                  <label className="mini retro-worked"><span>✅ What worked</span><textarea className="ta" value={c.worked} onChange={(e) => patchCycle(c.id, { worked: e.target.value })} /></label>
                  <label className="mini retro-didnt"><span>❌ What didn't</span><textarea className="ta" value={c.didnt} onChange={(e) => patchCycle(c.id, { didnt: e.target.value })} /></label>
                </div>
                <div className="cols">
                  <label className="mini retro-learned"><span>💡 The key learning</span><textarea className="ta" value={c.learned} onChange={(e) => patchCycle(c.id, { learned: e.target.value })} /></label>
                  <label className="mini retro-decision"><span>➡️ What we'll change</span><textarea className="ta" value={c.decision} onChange={(e) => patchCycle(c.id, { decision: e.target.value })} /></label>
                </div>

                {/* Feed back */}
                <div className="sub-h">Feed it back</div>
                <p className="hint">Update the map with what's true now, then name the one thing to fix next — that's the loop closing.</p>
                <div className="feedback">
                  <div className="snap">
                    <div className="snap-title">🧭 Current-state snapshot</div>
                    <div className="cols">
                      <label className="mini"><span>Revenue</span><input value={c.snapshot.revenue} onChange={(e) => patchCycle(c.id, { snapshot: { ...c.snapshot, revenue: e.target.value } })} /></label>
                      <label className="mini"><span>Profit</span><input value={c.snapshot.profit} onChange={(e) => patchCycle(c.id, { snapshot: { ...c.snapshot, profit: e.target.value } })} /></label>
                      <label className="mini"><span>Customers</span><input value={c.snapshot.customers} onChange={(e) => patchCycle(c.id, { snapshot: { ...c.snapshot, customers: e.target.value } })} /></label>
                      <label className="mini"><span>Team</span><input value={c.snapshot.team} onChange={(e) => patchCycle(c.id, { snapshot: { ...c.snapshot, team: e.target.value } })} /></label>
                    </div>
                    <button className="btn sm" onClick={() => void pushToReality(c)} disabled={pushing === c.id}>{pushing === c.id ? "Updating…" : "↥ Push snapshot to Reality Map 'now'"}</button>
                  </div>
                  <label className="mini next"><span>🎯 Next constraint to attack</span>
                    <input value={c.nextConstraint} onChange={(e) => patchCycle(c.id, { nextConstraint: e.target.value })} placeholder="What limits growth next?" />
                    <a className="next-link" href="/business/constraint">Open the Constraint Engine <span className="next-arrow" aria-hidden="true">→</span></a>
                  </label>
                </div>

                <div className="cycle-foot"><button className="btn ghost sm" onClick={() => removeCycle(c.id)}>Delete cycle</button></div>
              </div>
            )}
          </div>
        );
      })}

      <div className="step-bar">
        <div className="step-count">{dirty ? "Unsaved changes" : data.updatedAt ? "All changes saved" : "Nothing saved yet"}</div>
        <div className="step-actions"><button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save reviews"}</button></div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="rv-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.rv-root{
  /* Colour tokens inherited from the shared design system (theme-aware). Ring,
     ease and warning colours are intentionally left un-redefined here so they
     resolve to the system's real per-theme values instead of a frozen hue. */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:920px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .rv-root{
  /* Softer, black-based shadows read better on the navy dark surface. */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.rv-root *{box-sizing:border-box;}
.rv-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;}
.rv-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;line-height:1.7;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.linkbtn{background:none;border:none;color:var(--ds-brand-active);cursor:pointer;font:inherit;padding:0;font-weight:500;text-decoration:underline;text-decoration-color:transparent;transition:text-decoration-color .15s var(--ds-ease);}
.linkbtn:hover{text-decoration-color:currentColor;}
.linkbtn:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:2px;}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:120px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.muted-panel{color:var(--muted);font-size:13px;}
.empty-panel{gap:5px;}
.empty-ic{font-size:26px;line-height:1;}
.empty-title{font-weight:700;font-size:14.5px;color:var(--text);}
.empty-sub{color:var(--muted);font-size:12.5px;max-width:44ch;margin:0;line-height:1.55;}
.lock{font-size:34px;}
input,textarea{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:56px;resize:vertical;}
.cols{display:flex;gap:12px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:140px;}
.mini{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:500;color:var(--muted);}

/* Small colour tags — reused for the scoreboard legend and the hit/near/miss
   counts in the "at a glance" strip below, so a colour always means the same
   thing everywhere on the page. */
.tag{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;}
.tag.hit{background:var(--ds-success-soft);color:var(--ds-success);}
.tag.near{background:var(--ds-warning-soft);color:var(--ds-warning);}
.tag.miss{background:var(--ds-danger-soft);color:var(--ds-danger);}

/* Loop ribbon */
.loop{display:flex;align-items:center;flex-wrap:wrap;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:10px 12px;margin-bottom:16px;box-shadow:var(--ds-shadow-xs);}
.loop-step-wrap{display:inline-flex;align-items:center;gap:2px;}
.loop-step{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--ds-radius-md);font-size:12.5px;font-weight:500;color:var(--muted);text-decoration:none;transition:background .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.loop-step:hover{background:var(--ds-bg-subtle);color:var(--text);transform:translateY(-1px);}
.loop-step:active{transform:translateY(0);}
.loop-step:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.loop-step.here{background:linear-gradient(135deg,var(--ds-brand),var(--ds-brand-hover));color:#fff;box-shadow:0 2px 8px -2px rgba(10,158,110,.4);}
.loop-step.here:hover{background:linear-gradient(135deg,var(--ds-brand),var(--ds-brand-hover));color:#fff;}
.loop-ic{font-size:14px;}
.loop-arrow{color:var(--ds-text-disabled);font-size:13px;padding:0 2px;}

.sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:18px 2px 12px;}
.sec-title{font-size:18px;margin:0;letter-spacing:-.3px;}

.cycle{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);margin-bottom:12px;box-shadow:var(--ds-shadow-xs);overflow:hidden;transition:box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease);}
.cycle:hover{box-shadow:var(--ds-shadow-sm);border-color:var(--ds-border-strong);}
.cycle-bar{width:100%;display:flex;align-items:center;gap:10px;padding:13px 15px;background:none;border:none;cursor:pointer;font:inherit;text-align:left;color:var(--text);transition:background .15s var(--ds-ease);}
.cycle-bar:hover{background:var(--ds-surface-subtle);}
.cycle-bar:focus-visible{outline:2px solid var(--ds-brand);outline-offset:-2px;}
.cycle-caret{color:var(--muted);font-size:12px;}
.cycle-title{font-weight:700;font-size:15px;flex:1;}
.cycle-date{font-size:12px;color:var(--muted);}
.cycle-score{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--ds-bg-subtle);color:var(--muted);transition:background .15s var(--ds-ease),color .15s var(--ds-ease);}
.cycle-score.hit{background:var(--ds-success-soft);color:var(--ds-success);}
.cycle-score.near{background:var(--ds-warning-soft);color:var(--ds-warning);}
.cycle-score.miss{background:var(--ds-danger-soft);color:var(--ds-danger);}
.cycle-body{padding:4px 15px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--border);}
.sub-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin-top:6px;}

/* "At a glance" — this cycle's scored metrics averaged into one headline
   number, plus how many landed in each band. The detailed scoreboard below
   backs this up row by row. */
.glance{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 16px;}
.glance-hero{display:flex;flex-direction:column;line-height:1.15;flex:0 0 auto;}
.glance-num{font-size:28px;font-weight:800;letter-spacing:-.5px;}
.glance-num.hit{color:var(--ds-success);}
.glance-num.near{color:var(--ds-warning);}
.glance-num.miss{color:var(--ds-danger);}
.glance-label{font-size:11px;color:var(--muted);font-weight:500;}
.glance-bar{flex:1;min-width:100px;height:8px;border-radius:999px;background:var(--surface);border:1px solid var(--border);overflow:hidden;}
.glance-bar>span{display:block;height:100%;border-radius:999px;transition:width .5s var(--ds-ease);animation:rvGlanceFill .6s var(--ds-ease) both;}
.glance-bar>span.hit{background:var(--ds-success);}
.glance-bar>span.near{background:var(--ds-warning);}
.glance-bar>span.miss{background:var(--ds-danger);}
@keyframes rvGlanceFill{from{width:0 !important;}}
.glance-chips{display:flex;gap:6px;flex-wrap:wrap;flex:0 0 auto;}

.scoreboard{display:flex;flex-direction:column;gap:6px;}
.sb-row{display:grid;grid-template-columns:1.6fr 1fr 1fr 74px 30px;gap:8px;align-items:center;}
.sb-row.sb-head{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:700;}
.sb-row.sb-head span{padding-left:2px;}
.vbadge{font-size:12px;font-weight:700;text-align:center;padding:5px 4px;border-radius:var(--ds-radius-sm);background:var(--ds-bg-subtle);color:var(--muted);}
.vbadge.hit{background:var(--ds-success-soft);color:var(--ds-success);}
.vbadge.near{background:var(--ds-warning-soft);color:var(--ds-warning);}
.vbadge.miss{background:var(--ds-danger-soft);color:var(--ds-danger);}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.tool:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.tool:active{transform:translateY(0);}
.tool:focus-visible{outline:2px solid var(--ds-brand);outline-offset:1px;}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);}

.feedback{display:flex;gap:14px;flex-wrap:wrap;}
.snap{flex:2;min-width:280px;background:var(--ds-info-soft);border:1px solid var(--border);border-left:3px solid var(--ds-info);border-radius:var(--ds-radius-lg);padding:14px;display:flex;flex-direction:column;gap:10px;}
.snap-title{font-size:12.5px;font-weight:700;}
.next{flex:1;min-width:200px;background:var(--ds-brand-soft);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px;}
.next-link{font-size:12px;color:var(--ds-brand-active);font-weight:600;margin-top:8px;display:inline-flex;align-items:center;gap:3px;text-decoration:none;transition:color .15s var(--ds-ease);}
.next-link:hover{color:var(--ds-brand-hover);}
.next-link:hover .next-arrow{transform:translateX(3px);}
.next-link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:4px;}
.next-arrow{display:inline-block;transition:transform .15s var(--ds-ease);}
.cycle-foot{margin-top:4px;}

/* Colour-coded left rail on the retro fields, matching each field's own
   emoji: green = worked, red = didn't, blue = the insight, brand = the
   decision going forward. */
.mini.retro-worked,.mini.retro-didnt,.mini.retro-learned,.mini.retro-decision{padding-left:10px;border-left:3px solid var(--border-strong);border-radius:2px;}
.mini.retro-worked{border-left-color:var(--ds-success);}
.mini.retro-didnt{border-left-color:var(--ds-danger);}
.mini.retro-learned{border-left-color:var(--ds-info);}
.mini.retro-decision{border-left-color:var(--ds-brand);}

.ai-key-card{background:linear-gradient(180deg,var(--ds-brand-soft),var(--ds-surface-subtle) 65%);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px 17px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;}
.sub-h-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;flex-wrap:wrap;}
.sub-h-row .sub-h{margin-top:0;}
.sub-h-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.btn.ai{border-color:var(--ds-brand);color:var(--ds-brand);background:var(--ds-brand-soft);}
.btn.ai:hover{background:#e7e3ff;border-color:var(--ds-brand);}
.mini-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--ds-brand-soft);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-1px;}
.step-bar{position:sticky;bottom:14px;margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.step-actions{display:flex;gap:9px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* Respect reduced-motion: no transitions, animations or hover lifts. */
@media (prefers-reduced-motion: reduce){ .rv-root *{ transition:none!important; animation:none!important; } }
`;
