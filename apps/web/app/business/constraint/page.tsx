"use client";
/**
 * Business OS — Growth Constraint Engine. Score each area of the business by how
 * much it holds growth back right now; the engine surfaces the top-scored area
 * as the likely constraint. Then declare the constraint, the single move to
 * relieve it, and what to stop doing elsewhere — and carry that into the active
 * sprint. Styled with the shared design-system tokens, so it follows the user's
 * light/dark theme like the rest of the Business OS.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { RecentExperiments } from "../../../components/studio/RecentExperiments";
import { MarketingIcon } from "../../../components/MarketingIcons";
import type { ConstraintArea, ConstraintData } from "../../../lib/constraint";

const DEFAULT_AREAS = [
  "Traffic & attention", "Lead capture & conversion", "Sales & closing", "Offer & pricing",
  "Delivery & fulfilment", "Retention & repeat", "Margin & profit", "Cash & finance",
  "Team & capacity", "Systems & operations",
];
function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }

// Severity 0–5 as a calm-to-critical ramp built from the shared status tokens
// (not fixed hex) so each swatch pairs an accessible foreground with its own
// soft background and adapts correctly in both the light and dark theme.
const SEV_SCALE: { n: number; word: string; bg: string; border: string; text: string }[] = [
  { n: 0, word: "fine — not holding anything back", bg: "var(--ds-bg-subtle)", border: "var(--ds-border-strong)", text: "var(--ds-text-secondary)" },
  { n: 1, word: "minor drag", bg: "var(--ds-success-soft)", border: "var(--ds-success)", text: "var(--ds-success)" },
  { n: 2, word: "noticeable", bg: "var(--ds-info-soft)", border: "var(--ds-info)", text: "var(--ds-info)" },
  { n: 3, word: "significant", bg: "var(--ds-warning-soft)", border: "var(--ds-warning)", text: "var(--ds-warning)" },
  { n: 4, word: "major", bg: "var(--ds-warning-soft)", border: "var(--ds-warning)", text: "var(--ds-warning)" },
  { n: 5, word: "strangling growth", bg: "var(--ds-danger-soft)", border: "var(--ds-danger)", text: "var(--ds-danger)" },
];

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

export default function ConstraintPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<ConstraintData>({ areas: [], chosen: "", why: "", relieve: "", stopDoing: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
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
  // Load once on mount so the AI-diagnose grounding (Brand Brain / Business-OS
  // strategy) is visible up front via GroundingChips, not just silently spliced
  // into the prompt inside aiDiagnose() below.
  useEffect(() => { void loadGrounding().then(setG); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/constraint${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as ConstraintData;
      setData({ areas: d.areas ?? [], chosen: d.chosen ?? "", why: d.why ?? "", relieve: d.relieve ?? "", stopDoing: d.stopDoing ?? "", updatedAt: d.updatedAt });
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };
  const mutate = (fn: (d: ConstraintData) => ConstraintData) => { setData((p) => fn(p)); setDirty(true); };

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/constraint${wsQuery}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(latest.current) });
      const b = await r.json() as ConstraintData & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      setData({ areas: b.areas ?? [], chosen: b.chosen ?? "", why: b.why ?? "", relieve: b.relieve ?? "", stopDoing: b.stopDoing ?? "", updatedAt: b.updatedAt });
      setDirty(false); flash("Saved.");
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  // AI: read the scored areas + evidence and diagnose the single constraint,
  // why it's the constraint, the move to relieve it, and what to under-invest in.
  const aiDiagnose = async () => {
    if (getAiProvider() === "manual") { setAiOpen(true); setErr("Connect an AI provider first (the ⚙ AI button)."); return; }
    const scored = latest.current.areas.filter((a) => a.severity > 0 || a.evidence.trim());
    if (scored.length === 0) { setErr("Score a few areas (and add evidence) first — the AI diagnoses from those."); return; }
    setAiBusy(true); setErr("");
    try {
      const lines = latest.current.areas.map((a) => `- ${a.area || "area"}: severity ${a.severity}/5${a.evidence ? ` — ${a.evidence}` : ""}`).join("\n");
      const system = "You are a Theory-of-Constraints business diagnostician. Given areas scored by how much each holds growth back (0-5) with evidence, identify the SINGLE biggest constraint right now and how to act on it. Return ONLY JSON: { chosen (the constraint, a short phrase), why (the evidence-based reason, 1-2 sentences), relieve (the one move to loosen it, 1-2 sentences), stopDoing (what to under-invest in until it moves, 1 sentence) }.";
      const user = `Scored areas:\n${lines}\n\nReturn the JSON now.`;
      const g = await loadGrounding();
      const reply = await callOpenRouter(aiKey, aiModel, system, withGrounding(g, user), 400);
      const j = extractJson(reply) as { chosen?: string; why?: string; relieve?: string; stopDoing?: string };
      mutate((d) => ({ ...d, chosen: j.chosen ?? d.chosen, why: j.why ?? d.why, relieve: j.relieve ?? d.relieve, stopDoing: j.stopDoing ?? d.stopDoing }));
      flash("AI diagnosed your constraint — review and commit to it.");
    } catch (e) { setErr(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(false); }
  };

  const seedAreas = () => mutate((d) => ({ ...d, areas: DEFAULT_AREAS.map((area) => ({ id: uid(), area, severity: 0, evidence: "" })) }));
  const addArea = () => mutate((d) => ({ ...d, areas: [...d.areas, { id: uid(), area: "", severity: 0, evidence: "" }] }));
  const updateArea = (id: string, patch: Partial<ConstraintArea>) => mutate((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const removeArea = (id: string) => mutate((d) => ({ ...d, areas: d.areas.filter((a) => a.id !== id) }));

  const top = useMemo(() => {
    let best: ConstraintArea | null = null;
    for (const a of data.areas) { if (a.severity > 0 && (!best || a.severity > best.severity)) best = a; }
    return best;
  }, [data.areas]);

  // Derived, read-only context for the verdict banner and the progress hint —
  // neither changes what's saved, just how clearly the diagnosis reads.
  const scoredCount = useMemo(() => data.areas.filter((a) => a.severity > 0).length, [data.areas]);
  const tiedCount = useMemo(() => (top ? data.areas.filter((a) => a.id !== top.id && a.severity === top.severity).length : 0), [data.areas, top]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading your constraint diagnosis…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Constraint Engine." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your constraint." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="cn-header">
        <div>
          <div className="eyebrow">Business OS</div>
          <h1>Growth Constraint</h1>
          <p className="sub">One area limits growth more than the rest right now. Find it, and point everything at it — before you optimise anything else.</p>
        </div>
        <div className="header-right">
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI settings" aria-expanded={aiOpen} aria-controls="cn-ai-panel"><MarketingIcon name="gear" size={14} /> AI</button>
          <a href="/business/diagnostic" className="btn ghost sm"><MarketingIcon name="plan" size={14} /> Diagnostic</a>
          <a href="/business/drivers" className="btn ghost sm"><MarketingIcon name="tree" size={14} /> Driver Tree</a>
          <a href="/business/execution" className="btn ghost sm"><MarketingIcon name="bolt" size={14} /> Execution</a>
          <a href="/business/review" className="btn ghost sm"><MarketingIcon name="refresh" size={14} /> Review</a>
          <a href="/business" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a>
          <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>
        </div>
      </div>

      <RecentExperiments />

      {aiOpen && (
        <div className="ai-key-card" id="cn-ai-panel">
          <div className="cols">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Your key is saved to your account (encrypted) and sent straight to the AI provider. Used across the whole app&apos;s AI.</p>
        </div>
      )}
      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      {top ? (
        <div className="verdict">
          <div className="verdict-badge"><MarketingIcon name="plan" size={12} /> Likely constraint</div>
          <h2 className="verdict-name">{top.area || "(unnamed area)"}</h2>
          <div className="verdict-sev">
            Severity {top.severity}/5
            {tiedCount > 0 && (
              <span className="verdict-tie" title={`${tiedCount} other area${tiedCount > 1 ? "s" : ""} also scored ${top.severity}/5. This one leads — fix it first, then look at the others.`}> · +{tiedCount} tied</span>
            )}
          </div>
          {top.evidence && <div className="verdict-evidence">“{top.evidence}”</div>}
        </div>
      ) : data.areas.length > 0 && (
        <div className="verdict verdict-pending">
          <div className="verdict-pending-ic" aria-hidden="true"><MarketingIcon name="plan" size={18} /></div>
          <div>
            <h2 className="verdict-pending-title">Your likely constraint will appear here</h2>
            <p className="verdict-pending-sub">Score at least one area below (0–5) — the highest one becomes your likely constraint.</p>
          </div>
        </div>
      )}

      {/* Areas */}
      <div className="sec-head">
        <div><h2 className="sec-title">Score the areas</h2><p className="hint">How much is each area holding growth back right now? 0 = fine, 5 = this is strangling us.</p></div>
        <button className="btn sm" onClick={addArea}>+ Add area</button>
      </div>

      {data.areas.length > 0 && (
        <div className="progress-row">
          <div className="progress-bar" role="img" aria-label={`${scoredCount} of ${data.areas.length} areas scored`}>
            <span style={{ width: `${Math.round((scoredCount / data.areas.length) * 100)}%` }} />
          </div>
          <span className="progress-label">{scoredCount} of {data.areas.length} scored</span>
        </div>
      )}

      {data.areas.length === 0 && (
        <div className="panel center empty-panel">
          <div className="empty-ic" aria-hidden="true"><MarketingIcon name="plan" size={22} /></div>
          <div className="empty-title">No areas scored yet</div>
          <p className="empty-sub">Start from the ten standard growth areas — rename, remove or add your own once they're in.</p>
          <button className="btn primary" onClick={seedAreas}>Load the standard areas</button>
        </div>
      )}

      <div className="areas">
        {data.areas.map((a) => {
          const isTop = top?.id === a.id;
          return (
            <div key={a.id} className={`area ${isTop ? "is-top" : ""}`}>
              <div className="area-top">
                <input className="area-name" value={a.area} onChange={(e) => updateArea(a.id, { area: e.target.value })} placeholder="Area name" aria-label="Area name" />
                {isTop && <span className="area-flag"><MarketingIcon name="plan" size={11} /> Likely constraint</span>}
                <div className="sev-row" role="group" aria-label={`Severity for ${a.area || "this area"}, 0 to 5`}>
                  {SEV_SCALE.map((s) => (
                    <button key={s.n} type="button" className={`sev ${a.severity === s.n ? "on" : ""}`} style={a.severity === s.n ? { background: s.bg, borderColor: s.border, color: s.text } : undefined} onClick={() => updateArea(a.id, { severity: s.n })} aria-pressed={a.severity === s.n} title={`${s.n} — ${s.word}`}>{s.n}</button>
                  ))}
                </div>
                <button className="tool danger" title="Remove area" aria-label={`Remove ${a.area || "this area"}`} onClick={() => removeArea(a.id)}>×</button>
              </div>
              <input className="area-ev" value={a.evidence} onChange={(e) => updateArea(a.id, { evidence: e.target.value })} placeholder="Evidence — what tells you this? (a number, a symptom)" aria-label="Evidence" />
            </div>
          );
        })}
      </div>

      {/* Declare */}
      <div className="sec-head">
        <div><h2 className="sec-title">Declare the constraint</h2><p className="hint">Commit to one. Relieve it first; deliberately under-invest elsewhere until it's no longer the bottleneck.</p></div>
        <div className="ai-diagnose-col">
          <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
          <button className="btn sm ai" onClick={() => void aiDiagnose()} disabled={aiBusy}>{aiBusy ? <><span className="mini-spin" aria-hidden="true" /> Diagnosing…</> : <><MarketingIcon name="spark" size={13} /> AI diagnose</>}</button>
        </div>
      </div>
      <div className="panel decl">
        <div className="decl-main">
          <label className="mini"><span>The constraint we're focusing on</span>
            <div className="row-inline">
              <input list="area-list" value={data.chosen} onChange={(e) => mutate((d) => ({ ...d, chosen: e.target.value }))} placeholder={top ? top.area : "e.g. Sales & closing"} />
              {top && top.area && data.chosen !== top.area && (
                <button type="button" className="btn ghost sm" onClick={() => mutate((d) => ({ ...d, chosen: top.area }))} aria-label={`Set the constraint to ${top.area}`}>Use likely constraint</button>
              )}
            </div>
            <datalist id="area-list">{data.areas.map((a) => <option key={a.id} value={a.area} />)}</datalist>
          </label>
        </div>
        <label className="mini"><span>Why it's the constraint (the evidence)</span>
          <textarea className="ta" value={data.why} onChange={(e) => mutate((d) => ({ ...d, why: e.target.value }))} placeholder="What proves this is the thing holding us back?" />
        </label>
        <div className="cols">
          <label className="mini relieve"><span>The single move to relieve it</span>
            <textarea className="ta" value={data.relieve} onChange={(e) => mutate((d) => ({ ...d, relieve: e.target.value }))} placeholder="The one change that loosens this bottleneck." />
          </label>
          <label className="mini stop"><span>What we'll stop / under-invest in</span>
            <textarea className="ta" value={data.stopDoing} onChange={(e) => mutate((d) => ({ ...d, stopDoing: e.target.value }))} placeholder="What gets less attention until the constraint moves." />
          </label>
        </div>
        <div className="carry">
          <span className="carry-ic" aria-hidden="true">→</span>
          <p>Carry this into a sprint: open the <a className="carry-link" href="/business/execution">Execution Centre<span className="carry-arrow" aria-hidden="true">→</span></a> and set the active sprint's focus to <strong>{data.chosen || "your constraint"}</strong>.</p>
        </div>
      </div>

      <div className="step-bar">
        <div className="step-count">{dirty ? "Unsaved changes" : data.updatedAt ? "All changes saved" : "Nothing saved yet"}</div>
        <div className="step-actions"><button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save constraint"}</button></div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="cn-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.cn-root{
  /* Colour/border/status tokens come from the shared design system (theme-aware
     via :root[data-theme]) — do NOT hardcode them here. Radius and easing are
     theme-invariant so they're safe to pin locally; the ring is left un-redefined
     so it resolves to the system's real per-theme colour (green in light, violet
     in dark) instead of a frozen hue; the shadow is re-pinned for dark mode
     below, since a flat rgba can't adapt to the theme on its own the way a
     var() reference can. */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:900px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .cn-root{
  /* Softer, black-based shadows read better on the navy dark surface. */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.cn-root *{box-sizing:border-box;}
.cn-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.cn-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;line-height:1.7;}
.header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.mini-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--ds-brand-soft);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-1px;}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.ai-key-card{background:linear-gradient(180deg,var(--ds-brand-soft),var(--ds-surface-subtle) 65%);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px 17px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.panel.center.empty-panel{gap:8px;}
.empty-panel .btn{margin-top:2px;}
.empty-ic{color:var(--ds-text-tertiary);display:inline-flex;}
.empty-title{font-weight:700;font-size:14.5px;color:var(--text);}
.empty-sub{color:var(--muted);font-size:12.5px;max-width:44ch;margin:0;line-height:1.55;}
.lock{font-size:34px;}
input,textarea{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:60px;resize:vertical;}
.cols{display:flex;gap:12px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:200px;}
.mini{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:500;color:var(--muted);}
.row-inline{display:flex;gap:8px;flex-wrap:wrap;}
.row-inline input{flex:1;min-width:140px;}

.verdict{background:linear-gradient(135deg,var(--ds-brand-solid),var(--ds-brand-solid-hover));color:var(--ds-brand-contrast);border-radius:var(--ds-radius-lg);padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;box-shadow:var(--ds-shadow-md);animation:cnVerdictIn .45s var(--ds-ease) both;}
.verdict-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:rgba(255,255,255,.22);padding:4px 10px;border-radius:999px;flex:none;}
.verdict-name{margin:0;font-size:20px;font-weight:700;letter-spacing:-.3px;}
.verdict-sev{margin-left:auto;font-size:13px;font-weight:500;opacity:.92;}
.verdict-tie{font-weight:500;opacity:.85;}
.verdict-evidence{flex-basis:100%;font-size:12.5px;font-style:italic;opacity:.92;}
.verdict.verdict-pending{background:var(--ds-bg-subtle);border:1px dashed var(--ds-border-strong);color:var(--text);box-shadow:none;}
.verdict-pending-ic{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--ds-surface);color:var(--ds-text-tertiary);flex:none;}
.verdict-pending-title{margin:0;font-weight:700;font-size:14px;}
.verdict-pending-sub{margin:2px 0 0;font-size:12.5px;color:var(--muted);}
@keyframes cnVerdictIn{from{opacity:0;transform:translateY(6px);}}

.sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:18px 2px 12px;}
.sec-title{font-size:18px;margin:0;letter-spacing:-.3px;}
.ai-diagnose-col{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none;}

.progress-row{display:flex;align-items:center;gap:10px;margin:0 2px 12px;}
.progress-bar{flex:1;height:6px;border-radius:999px;background:var(--ds-bg-subtle);border:1px solid var(--border);overflow:hidden;}
.progress-bar>span{display:block;height:100%;border-radius:999px;background:var(--ds-brand);transition:width .5s var(--ds-ease);animation:cnBarFill .6s var(--ds-ease) both;}
@keyframes cnBarFill{from{width:0 !important;}}
.progress-label{font-size:11.5px;color:var(--muted);font-weight:500;white-space:nowrap;}

.areas{display:flex;flex-direction:column;gap:8px;}
.area{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;display:flex;flex-direction:column;gap:9px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease);}
.area:hover{box-shadow:var(--ds-shadow-sm);border-color:var(--ds-border-strong);}
.area.is-top{border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-xs);}
.area.is-top:hover{box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-sm);}
.area-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.area-name{flex:1;min-width:150px;font-weight:500;font-size:14px;}
.area-flag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;letter-spacing:.2px;color:var(--ds-brand-active);background:var(--ds-brand-soft);border-radius:999px;padding:3px 9px;white-space:nowrap;flex:none;}
.sev-row{display:flex;gap:4px;flex:none;flex-wrap:wrap;}
.sev{width:30px;height:30px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;font-weight:700;font-size:12.5px;color:var(--muted);transition:border-color .15s var(--ds-ease),background .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.sev:hover{border-color:var(--ds-border-strong);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.sev:active{transform:translateY(0);}
.sev:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.sev.on{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.area-ev{font-size:12.5px;}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;flex:none;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.tool:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.tool:active{transform:translateY(0);}
.tool:focus-visible{outline:2px solid var(--ds-brand);outline-offset:1px;}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);}

.decl{display:flex;flex-direction:column;gap:12px;}
.decl-main{background:var(--ds-brand-soft);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px;}
.mini.relieve,.mini.stop{padding-left:10px;border-left:3px solid var(--border-strong);border-radius:2px;}
.mini.relieve{border-left-color:var(--ds-brand);}
.carry{display:flex;gap:10px;align-items:flex-start;background:var(--ds-brand-soft);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-md);padding:10px 12px;margin-top:2px;}
.carry-ic{flex:none;color:var(--ds-brand-active);font-weight:700;line-height:1.4;}
.carry p{margin:0;font-size:12.5px;color:var(--muted);}
.carry-link{color:var(--ds-brand-active);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;transition:color .15s var(--ds-ease);}
.carry-link:hover{color:var(--ds-brand-hover);}
.carry-link:hover .carry-arrow{transform:translateX(3px);}
.carry-link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:4px;}
.carry-arrow{display:inline-block;transition:transform .15s var(--ds-ease);}
.carry strong{color:var(--text);}

.step-bar{position:sticky;bottom:14px;margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.step-actions{display:flex;gap:9px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* Respect reduced motion: no transitions, animations or hover lifts. */
@media (prefers-reduced-motion: reduce){ .cn-root *{ transition:none!important; animation:none!important; } }
`;
