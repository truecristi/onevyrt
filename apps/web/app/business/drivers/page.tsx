"use client";
/**
 * Business OS — Key Driver Tree. Breaks the outcome number into the chain of
 * drivers that multiply to produce it, and computes each driver's leverage
 * (how much the outcome moves if that one driver hits its target) so the
 * highest-leverage lever is obvious. Feeds the 90-day goals in the Execution
 * Centre. Styled entirely from the shared DS colour tokens, so it follows the
 * app's light/navy-dark theme like the rest of the Business OS.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { MarketingIcon } from "../../../components/MarketingIcons";

interface Driver { id: string; label: string; current: string; target: string; note: string; source?: string; }
interface DriverTree { outcomeLabel: string; outcomeTarget: string; drivers: Driver[]; updatedAt?: string; }
interface LiveMetric { key: string; label: string; value: number; display: string; }

function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }
function parseNum(s: string): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim(); if (!t) return NaN;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[%$,\s]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) < 1 && n !== 0) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Common driver chains a user can load and then adapt.
const MODELS: { id: string; name: string; outcome: string; drivers: string[] }[] = [
  { id: "revenue", name: "Revenue engine", outcome: "Monthly revenue", drivers: ["Traffic / reach", "Lead conversion rate", "Sale conversion rate", "Average order value", "Purchase frequency"] },
  { id: "sales", name: "Sales pipeline", outcome: "Monthly new revenue", drivers: ["Leads", "Booking rate", "Show-up rate", "Close rate", "Average deal size"] },
  { id: "ecom", name: "E-commerce", outcome: "Monthly revenue", drivers: ["Sessions", "Conversion rate", "Average order value"] },
  { id: "profit", name: "Profit", outcome: "Monthly profit", drivers: ["Revenue", "Gross margin %", "Net margin multiplier"] },
];

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

export default function DriverTreePage() {
  const [state, setState] = useState<ViewState>("loading");
  const [tree, setTree] = useState<DriverTree>({ outcomeLabel: "Monthly revenue", outcomeTarget: "", drivers: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiKey, setAiKeyState] = useState("");
  const [aiModel, setAiModelState] = useState("openai/gpt-4o-mini");
  const latest = useRef(tree); latest.current = tree;
  const [live, setLive] = useState<LiveMetric[]>([]);
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

  useEffect(() => { setAiKeyState(getAiKey()); setAiModelState(getAiModel()); }, []);
  useEffect(() => { void loadGrounding().then(setG); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/drivers${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as DriverTree & { live?: LiveMetric[] };
      setTree({ outcomeLabel: d.outcomeLabel || "Monthly revenue", outcomeTarget: d.outcomeTarget || "", drivers: d.drivers ?? [], updatedAt: d.updatedAt });
      setLive(d.live ?? []);
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };
  const mutate = (fn: (t: DriverTree) => DriverTree) => { setTree((p) => fn(p)); setDirty(true); };

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/drivers${wsQuery}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(latest.current) });
      const b = await r.json() as DriverTree & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      setTree({ outcomeLabel: b.outcomeLabel || "Monthly revenue", outcomeTarget: b.outcomeTarget || "", drivers: b.drivers ?? [], updatedAt: b.updatedAt });
      setDirty(false); flash("Saved.");
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  // AI: propose the driver chain that multiplies to the outcome, with realistic
  // current/target values seeded from what the user already entered.
  const aiModelPropose = async () => {
    if (getAiProvider() === "manual") { setAiOpen(true); setErr("Connect an AI provider first (the ⚙ AI button)."); return; }
    setAiBusy(true); setErr("");
    try {
      const t = latest.current;
      const g = await loadGrounding();
      const system = "You are a growth strategist. Propose the chain of multiplicative drivers that produce the given outcome number (e.g. traffic × conversion × average value × frequency). Return ONLY JSON: { drivers: [{ label, current, target }] } with 3-6 drivers. Use plain numbers; write percentages with a % sign (e.g. \"3%\"). Base values on the outcome/target if given, otherwise leave current/target as reasonable placeholders.";
      const user = `Outcome: ${t.outcomeLabel || "Monthly revenue"}\nTarget: ${t.outcomeTarget || "(not set)"}\n${t.drivers.length ? `Existing drivers: ${t.drivers.map((d) => d.label).filter(Boolean).join(", ")}\n` : ""}Return the JSON now.`;
      const reply = await callOpenRouter(aiKey, aiModel, system, withGrounding(g, user), 500);
      const j = extractJson(reply) as { drivers?: { label?: string; current?: string; target?: string }[] };
      if (Array.isArray(j.drivers) && j.drivers.length) {
        mutate((tr) => ({ ...tr, drivers: j.drivers!.slice(0, 12).map((d) => ({ id: uid(), label: String(d.label ?? ""), current: String(d.current ?? ""), target: String(d.target ?? ""), note: "" })) }));
        flash("AI proposed a driver model — adjust the numbers to your reality.");
      } else setErr("The AI didn't return usable drivers — try again.");
    } catch (e) { setErr(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(false); }
  };

  const pullTarget = async () => {
    try {
      const r = await fetch(`/api/business/reality${wsQuery}`, { credentials: "include" });
      if (!r.ok) return;
      const m = await r.json() as { targetRevenue?: string };
      if (m.targetRevenue) { mutate((t) => ({ ...t, outcomeTarget: m.targetRevenue as string })); flash("Pulled target from the Reality Map."); }
      else flash("No target set in the Reality Map yet.");
    } catch { /* ignore */ }
  };

  const loadModel = (id: string) => {
    const m = MODELS.find((x) => x.id === id); if (!m) return;
    mutate((t) => ({ ...t, outcomeLabel: m.outcome, drivers: m.drivers.map((label) => ({ id: uid(), label, current: "", target: "", note: "" })) }));
  };
  const addDriver = () => mutate((t) => ({ ...t, drivers: [...t.drivers, { id: uid(), label: "", current: "", target: "", note: "" }] }));
  const updateDriver = (id: string, patch: Partial<Driver>) => mutate((t) => ({ ...t, drivers: t.drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const removeDriver = (id: string) => mutate((t) => ({ ...t, drivers: t.drivers.filter((d) => d.id !== id) }));
  const moveDriver = (id: string, dir: -1 | 1) => mutate((t) => {
    const i = t.drivers.findIndex((d) => d.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= t.drivers.length) return t;
    const next = [...t.drivers]; const a = next[i]!, b = next[j]!; next[i] = b; next[j] = a; return { ...t, drivers: next };
  });

  // --- live model maths ---
  const model = useMemo(() => {
    const curs = tree.drivers.map((d) => parseNum(d.current));
    const tgts = tree.drivers.map((d) => parseNum(d.target));
    const allCur = curs.length > 0 && curs.every((n) => Number.isFinite(n));
    const allTgt = tgts.length > 0 && tgts.every((n) => Number.isFinite(n));
    const prodCur = allCur ? curs.reduce((a, b) => a * b, 1) : NaN;
    const prodTgt = allTgt ? tgts.reduce((a, b) => a * b, 1) : NaN;
    // Per-driver leverage: factor the outcome scales by if only this driver hits target.
    const factors = tree.drivers.map((_, i) => {
      const c = curs[i], t = tgts[i];
      if (c === undefined || t === undefined || !Number.isFinite(c) || !Number.isFinite(t) || c === 0) return NaN;
      return t / c;
    });
    let topIdx = -1, topFactor = 1;
    factors.forEach((f, i) => { if (Number.isFinite(f) && f > topFactor) { topFactor = f; topIdx = i; } });
    const target = parseNum(tree.outcomeTarget);
    return { prodCur, prodTgt, factors, topIdx, topFactor, target, allCur, allTgt };
  }, [tree.drivers, tree.outcomeTarget]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading your driver tree…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Driver Tree." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your driver tree." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="dt-header">
        <div className="dt-title-row">
          <span className="dt-head-icon" aria-hidden="true"><MarketingIcon name="tree" size={20} /></span>
          <div>
            <div className="eyebrow">Business OS</div>
            <h1>Key Driver Tree</h1>
            <p className="sub">Break the number into the levers that multiply to produce it. See which single lever moves it most — that's where the next goal should point.</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI settings"><MarketingIcon name="gear" size={14} /> AI</button>
          <a href="/business/reality" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Reality Map</a>
          <a href="/business/constraint" className="btn ghost sm"><MarketingIcon name="plan" size={14} /> Constraint</a>
          <a href="/business/execution" className="btn ghost sm"><MarketingIcon name="bolt" size={14} /> Execution</a>
          <a href="/business/review" className="btn ghost sm"><MarketingIcon name="refresh" size={14} /> Review</a>
          <a href="/business" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a>
          <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>
        </div>
      </div>

      {aiOpen && (
        <div className="panel dt-ai-panel">
          <div className="dt-panel-head">
            <span className="ds-eyebrow" style={{ color: "var(--ds-info)" }}><MarketingIcon name="gear" size={11} /> AI settings</span>
          </div>
          <div className="cols">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Your key is saved to your account (encrypted) and sent straight to the AI provider. Used across the whole app&apos;s AI.</p>
        </div>
      )}
      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      {/* Outcome */}
      <div className="panel dt-outcome">
        <div className="dt-panel-head">
          <span className="ds-eyebrow" style={{ color: "var(--ds-info)" }}>The outcome</span>
          <p className="dt-panel-why">The single number every driver below multiplies into. Name what you&rsquo;re growing, then set a target — or pull one straight from your Reality Map.</p>
        </div>
        <div className="cols">
          <label className="mini"><span>Outcome — the number this tree produces</span>
            <input value={tree.outcomeLabel} onChange={(e) => mutate((t) => ({ ...t, outcomeLabel: e.target.value }))} placeholder="Monthly revenue" />
          </label>
          <label className="mini"><span>Target</span>
            <div className="row-inline">
              <input value={tree.outcomeTarget} onChange={(e) => mutate((t) => ({ ...t, outcomeTarget: e.target.value }))} placeholder="$50,000" />
              <button className="btn ghost sm" title="Pull from Reality Map" aria-label="Pull target from the Reality Map" onClick={() => void pullTarget()}>↩ Pull</button>
            </div>
          </label>
        </div>
        {tree.drivers.length === 0 && (
          <div className="models">
            <span className="models-lbl">Start from a model:</span>
            {MODELS.map((m) => <button key={m.id} className="chip-btn" onClick={() => loadModel(m.id)}>{m.name}</button>)}
          </div>
        )}
      </div>

      {/* Drivers */}
      <div className="sec-head">
        <div><h2 className="sec-title">Drivers</h2><p className="hint">Values multiply together into the outcome above. Enter percentages with a % sign (3% = 0.03) — the maths handles it. <strong>Leverage</strong> shows how far the outcome moves if that one driver alone hits target — the biggest number is where to focus next.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn sm ai" onClick={() => void aiModelPropose()} disabled={aiBusy}>{aiBusy ? "Thinking…" : <><MarketingIcon name="spark" size={13} /> AI propose</>}</button>
          <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
          <button className="btn sm" onClick={addDriver}>+ Add driver</button>
        </div>
      </div>

      {live.length > 0 && (
        <div className="live-strip">
          <span className="live-title"><MarketingIcon name="signal" size={13} /> Live from your funnels</span>
          {live.map((m) => <span key={m.key} className="live-chip"><b>{m.display}</b> {m.label}</span>)}
          <span className="live-hint">Link a driver&rsquo;s current value to any of these below — it&rsquo;ll track reality automatically, no manual updates needed.</span>
        </div>
      )}

      {tree.drivers.length === 0 && (
        <div className="panel center muted-panel">
          <span className="dt-empty-icon" aria-hidden="true"><MarketingIcon name="tree" size={20} /></span>
          <p>No drivers yet. Load a model above, or add your own below, to start mapping the levers that move your number.</p>
        </div>
      )}

      <div className="drivers">
        {tree.drivers.map((d, i) => {
          const f = model.factors[i];
          const isTop = i === model.topIdx && model.topIdx >= 0;
          const barPct = f !== undefined && Number.isFinite(f) && f > 0 ? Math.max(6, Math.min(100, (f / Math.max(model.topFactor, 1)) * 100)) : 0;
          return (
            <div key={d.id}>
              <div className={`driver ${isTop ? "is-top" : ""}`}>
                <div className="driver-idx">{i + 1}</div>
                <div className="driver-body">
                  <div className="driver-top">
                    <input className="driver-label" value={d.label} onChange={(e) => updateDriver(d.id, { label: e.target.value })} placeholder="Driver name (e.g. Conversion rate)" aria-label={`Driver ${i + 1} name`} />
                    <div className="driver-tools">
                      <button className="tool" title="Move up" aria-label="Move driver up" onClick={() => moveDriver(d.id, -1)} disabled={i === 0}>↑</button>
                      <button className="tool" title="Move down" aria-label="Move driver down" onClick={() => moveDriver(d.id, 1)} disabled={i === tree.drivers.length - 1}>↓</button>
                      <button className="tool danger" title="Remove" aria-label="Remove driver" onClick={() => removeDriver(d.id)}>×</button>
                    </div>
                  </div>
                  <div className="cols">
                    <label className="mini"><span>Current {d.source && <em className="linked"><MarketingIcon name="link" size={10} /> live</em>}</span>
                      <input value={d.current} readOnly={!!d.source} className={d.source ? "linked-input" : ""}
                        onChange={(e) => updateDriver(d.id, { current: e.target.value })} placeholder="e.g. 2%" /></label>
                    <label className="mini"><span>Target</span><input value={d.target} onChange={(e) => updateDriver(d.id, { target: e.target.value })} placeholder="e.g. 3.5%" /></label>
                    <div className="mini lev">
                      <span>Leverage</span>
                      <div className={`lev-val ${isTop ? "top" : ""}`} title="How much the outcome scales if only this driver hits its target">
                        {f !== undefined && Number.isFinite(f) ? `×${fmt(f)}` : "—"}{isTop && <span className="lev-tag"><MarketingIcon name="plan" size={9} /> highest</span>}
                      </div>
                      {barPct > 0 && <div className={`dt-lev-bar ${isTop ? "is-top" : ""}`} aria-hidden="true"><span style={{ width: `${barPct}%` }} /></div>}
                    </div>
                  </div>
                  {live.length > 0 && (
                    <div className="driver-link">
                      <span className="dl-label"><MarketingIcon name="link" size={11} /> Live link</span>
                      <select aria-label={`Link driver ${i + 1} to a live metric`} value={d.source ?? ""} onChange={(e) => { const key = e.target.value; updateDriver(d.id, { source: key || undefined, ...(key ? { current: live.find((m) => m.key === key)?.display ?? d.current } : {}) }); }}>
                        <option value="">— manual —</option>
                        {live.map((m) => <option key={m.key} value={m.key}>{m.label} · {m.display}</option>)}
                      </select>
                      {d.source && <span className="dl-note">tracks your funnels live</span>}
                    </div>
                  )}
                  <input className="driver-note" value={d.note} onChange={(e) => updateDriver(d.id, { note: e.target.value })} placeholder="How you'd move it (optional)" aria-label={`Driver ${i + 1} notes`} />
                </div>
              </div>
              {i < tree.drivers.length - 1 && <div className="mult">×</div>}
            </div>
          );
        })}
      </div>

      {/* Result */}
      {tree.drivers.length > 0 && (
        <div className="panel result">
          <div className="dt-panel-head">
            <span className="ds-eyebrow" style={{ color: "var(--ds-brand-active)" }}>What this produces</span>
            <p className="dt-panel-why">Every driver above multiplies into this — today&rsquo;s number, and where you land if each one hits target.</p>
          </div>
          <div className="res-grid">
            <div className="res-cell"><span className="res-l">Modeled now</span><span className="res-n">{fmt(model.prodCur)}</span></div>
            <div className="res-arrow">→</div>
            <div className="res-cell"><span className="res-l">Modeled at target</span><span className="res-n ds-gradient-text">{fmt(model.prodTgt)}</span></div>
            {Number.isFinite(model.target) && (
              <div className="res-cell"><span className="res-l">Your stated target</span><span className="res-n">{fmt(model.target)}</span></div>
            )}
          </div>
          {model.topIdx >= 0 && (
            <div className="dt-focus">
              <span className="dt-focus-icon" aria-hidden="true"><MarketingIcon name="plan" size={15} /></span>
              <p className="dt-focus-text">
                <span className="dt-focus-eyebrow">Focus here next</span>
                Highest-leverage lever: <strong>{tree.drivers[model.topIdx]?.label || `Driver ${model.topIdx + 1}`}</strong> — moving it to target alone scales the outcome ×{fmt(model.topFactor)}. Point your next 90-day goal here.
              </p>
            </div>
          )}
          {!model.allCur && <p className="res-note dim">Fill every driver's current value (as numbers) to compute the modeled outcome.</p>}
        </div>
      )}

      <div className="step-bar">
        <div className={`step-count dt-status dt-status--${dirty ? "warn" : tree.updatedAt ? "ok" : "muted"}`}>
          <span className="dt-status-dot" aria-hidden="true" />
          {dirty ? "Unsaved changes" : tree.updatedAt ? "All changes saved" : "Nothing saved yet"}
        </div>
        <div className="step-actions"><button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save driver tree"}</button></div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="dt-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.dt-root{
  /* Theme-aware colour tokens inherited from the shared design system — not
     hardcoded here (hardcoding froze the page in light mode). */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  /* --ds-shadow-xs/md and --ds-ring are intentionally NOT redefined here (they
     used to be, pinned to light-mode rgba values) — that shadowed the shared
     dark-theme versions from design-system.css, so shadows/focus rings went
     nearly invisible in dark mode. Falling through to the real tokens instead. */
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:900px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.dt-root *{box-sizing:border-box;}
.dt-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.dt-title-row{display:flex;gap:14px;align-items:flex-start;}
.dt-head-icon{flex:none;width:40px;height:40px;border-radius:12px;background:var(--ds-brand-soft);color:var(--ds-brand-active);display:grid;place-items:center;margin-top:2px;}
.dt-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;}
.header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.dt-root .btn.primary:hover{transform:translateY(-1px);}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;transition:box-shadow .15s var(--ds-ease);}
.panel:not(.center):hover,.panel:not(.center):focus-within{box-shadow:var(--ds-shadow-sm);}
.panel.dt-outcome,.panel.dt-ai-panel{border-left:3px solid var(--ds-info);}
.dt-panel-head{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;}
.dt-panel-why{margin:0;font-size:12.5px;line-height:1.5;color:var(--muted);max-width:70ch;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:120px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.muted-panel{color:var(--muted);font-size:13px;}
.muted-panel p{margin:0;max-width:46ch;}
.dt-empty-icon{width:40px;height:40px;border-radius:50%;background:var(--ds-bg-subtle);color:var(--ds-text-tertiary);display:grid;place-items:center;}
.lock{font-size:34px;}
input{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder{color:var(--ds-text-disabled);}
.cols{display:flex;gap:12px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:120px;}
.mini{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:500;color:var(--muted);}
.row-inline{display:flex;gap:6px;}
.row-inline input{flex:1;}
.models{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px;}
.models-lbl{font-size:12px;font-weight:500;color:var(--muted);}
.chip-btn{background:var(--ds-brand-soft);border:1px solid transparent;color:var(--ds-brand-active);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:500;cursor:pointer;transition:background .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.chip-btn:hover{background:var(--ds-brand);color:var(--ds-brand-contrast);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.chip-btn:active{transform:translateY(0);}
.chip-btn:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:18px 2px 12px;}
.sec-title{font-size:18px;margin:0;letter-spacing:-.3px;}

.drivers{display:flex;flex-direction:column;}
.driver{display:flex;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:13px 14px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease);}
.driver:hover,.driver:focus-within{box-shadow:var(--ds-shadow-sm);border-color:var(--ds-border-strong);}
.driver.is-top{border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-xs);}
.driver.is-top:hover,.driver.is-top:focus-within{box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-sm);}
.driver-idx{width:26px;height:26px;border-radius:50%;background:var(--ds-bg-subtle);color:var(--muted);font-weight:700;font-size:12px;display:grid;place-items:center;flex:none;}
.driver.is-top .driver-idx{background:var(--ds-brand);color:var(--ds-brand-contrast);}
.driver-body{flex:1;display:flex;flex-direction:column;gap:9px;}
.driver-top{display:flex;gap:8px;align-items:center;}
.driver-label{font-weight:700;font-size:14px;border-color:transparent;background:transparent;}
.driver-label:hover{background:var(--ds-surface-subtle);}
.driver-label:focus{background:var(--surface);border-color:var(--accent);}
.driver-tools{display:flex;gap:4px;flex:none;}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),background .15s var(--ds-ease),transform .15s var(--ds-ease);}
.tool:hover{border-color:var(--ds-border-strong);color:var(--text);transform:translateY(-1px);}
.tool:active{transform:translateY(0);}
.tool:disabled{opacity:.35;cursor:default;}
.tool:disabled:hover{transform:none;}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);background:var(--ds-danger-soft);}
.tool:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.lev{align-items:flex-start;}
.lev-val{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:var(--muted);padding:6px 0;}
.lev-val.top{color:var(--ds-brand-active);}
.lev-tag{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;background:var(--ds-warning-soft);color:var(--ds-warning);padding:2px 7px;border-radius:999px;letter-spacing:.3px;border:1px solid color-mix(in srgb,var(--ds-warning) 30%,transparent);}
.dt-lev-bar{width:100%;height:5px;border-radius:99px;background:var(--ds-bg-subtle);overflow:hidden;margin-top:2px;}
.dt-lev-bar span{display:block;height:100%;border-radius:99px;background:var(--ds-text-tertiary);opacity:.5;transition:width .5s var(--ds-ease);}
.dt-lev-bar.is-top span{background:var(--ds-warning);opacity:1;}
.driver-note{font-size:12.5px;color:var(--muted);}
.mult{text-align:center;color:var(--ds-text-tertiary);font-weight:700;font-size:15px;padding:4px 0;}

.live-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--ds-brand-soft);border:1px solid color-mix(in srgb,var(--ds-brand) 26%,transparent);border-radius:12px;padding:11px 13px;margin-bottom:14px;}
.live-title{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ds-brand-active);letter-spacing:.2px;}
.live-chip{font-size:12px;color:var(--ds-text-primary);background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:999px;padding:3px 9px;}
.live-chip b{color:var(--ds-brand-active);font-weight:700;}
.live-hint{font-size:11.5px;color:var(--ds-text-secondary);flex-basis:100%;}
.linked em.linked{display:inline-flex;align-items:center;gap:3px;font-style:normal;font-size:10px;font-weight:700;color:var(--ds-brand-active);}
.linked-input{background:var(--ds-brand-soft)!important;color:var(--ds-brand-active)!important;font-weight:700;}
.driver-link{display:flex;align-items:center;gap:8px;margin:8px 0 2px;flex-wrap:wrap;}
.dl-label{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--muted);}
.driver-link select{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--ds-border-default);border-radius:8px;background:var(--surface);color:var(--text);max-width:100%;transition:border-color .15s var(--ds-ease);}
.driver-link select:hover{border-color:var(--ds-border-strong);}
.driver-link select:focus-visible{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
.dl-note{font-size:11px;color:var(--ds-brand-active);font-weight:500;}

.result{background:linear-gradient(180deg,var(--ds-brand-soft),var(--surface));border-left:3px solid var(--ds-brand);}
.res-grid{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}
.res-cell{display:flex;flex-direction:column;gap:2px;}
.res-l{font-size:11.5px;font-weight:500;color:var(--muted);}
.res-n{font-size:24px;font-weight:700;letter-spacing:-.5px;}
.res-n.brand{color:var(--ds-brand);}
.res-arrow{font-size:20px;color:var(--ds-text-tertiary);}
.res-note{font-size:13px;margin:14px 0 0;color:var(--text);}
.res-note.dim{color:var(--muted);}
.res-note strong{color:var(--ds-brand);}
.dt-focus{display:flex;gap:10px;align-items:flex-start;background:var(--ds-warning-soft);border:1px solid color-mix(in srgb,var(--ds-warning) 30%,transparent);border-left:3px solid var(--ds-warning);border-radius:var(--ds-radius-md);padding:12px 14px;margin-top:14px;}
.dt-focus-icon{flex:none;width:26px;height:26px;border-radius:50%;background:var(--ds-surface);color:var(--ds-warning);display:grid;place-items:center;}
.dt-focus-eyebrow{display:block;font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ds-warning);margin-bottom:3px;}
.dt-focus-text{margin:0;font-size:13px;line-height:1.5;color:var(--text);}
.dt-focus-text strong{color:var(--ds-brand-active);}

.step-bar{position:sticky;bottom:14px;margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);flex-wrap:wrap;gap:10px;}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.dt-status{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;font-weight:600;}
.dt-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none;}
.dt-status--warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.dt-status--ok{background:var(--ds-success-soft);color:var(--ds-success);}
.dt-status--muted{background:var(--ds-bg-subtle);color:var(--muted);}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
/* Reduced motion: kill transitions/animations except the loading spinner,
   which communicates real status (a frozen spinner reads as "stuck"). Mirrors
   the site-wide exemption in globals.css; kept local too since this page's
   own hover/lift/bar-fill transitions are declared in this scoped stylesheet. */
@media (prefers-reduced-motion: reduce){ .dt-root *:not(.spinner){transition:none!important;animation:none!important;} }
`;
