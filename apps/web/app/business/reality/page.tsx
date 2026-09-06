"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadBrandProfile, brandBrief, hasBrand } from "../../../lib/campaign/brand-brief";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { PageShell } from "../../../components/ui/PageShell";
import { Button } from "../../../components/ui/Button";
import type { BusinessRealityMap as RealityMap, RealityNow, RealityGap } from "../../../lib/reality";

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

// Original ONEVYRT lifecycle stages (generic business-maturity terms).
const STAGES = ["Validate", "Survive", "Establish", "Grow", "Systemise", "Optimise", "Scale", "Renew"];

// Every field this page tracks, used only for a friendly "how much of your
// reality map is captured" readout below — purely presentational, recomputed
// from `map` on each render (no extra state, nothing sent anywhere).
const FIELD_COUNT = 16;
function countCaptured(m: RealityMap): number {
  const vals = [
    m.businessIn, m.businessReallyIn, m.businessNeedToBeIn,
    m.now?.revenue, m.now?.profit, m.now?.customers, m.now?.team, m.now?.stage,
    m.want12m, m.want36m, m.targetRevenue,
    m.gaps?.capability, m.gaps?.acquisition, m.gaps?.product, m.gaps?.team, m.gaps?.system,
  ];
  return vals.filter((v) => (v ?? "").trim().length > 0).length;
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="ds-field"><span className="ds-label">{label}</span>{children}{help && <span className="ds-help">{help}</span>}</label>;
}
function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function money(n: number): string {
  return (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString();
}

export default function RealityMapPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [map, setMap] = useState<RealityMap>({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiKey, setAiKeyState] = useState("");
  const [aiModel, setAiModelState] = useState("openai/gpt-4o-mini");
  // Display-only: mirrors what aiPositioning() below grounds in, so the
  // GroundingChips next to its button reflect reality before the user clicks.
  const [brandOn, setBrandOn] = useState(false);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // map reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  useEffect(() => { setAiKeyState(getAiKey()); setAiModelState(getAiModel()); }, []);
  useEffect(() => { void loadBrandProfile().then((b) => setBrandOn(hasBrand(b))); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const load = useCallback(async () => {
    setState("loading"); setMsg("");
    try {
      const r = await fetch(`/api/business/reality${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      setMap(await r.json() as RealityMap);
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const set = (patch: Partial<RealityMap>) => setMap((m) => ({ ...m, ...patch }));
  const setNow = (patch: Partial<RealityNow>) => setMap((m) => ({ ...m, now: { ...m.now, ...patch } }));
  const setGap = (patch: Partial<RealityGap>) => setMap((m) => ({ ...m, gaps: { ...m.gaps, ...patch } }));

  const save = useCallback(async () => {
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`/api/business/reality${wsQuery}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(map) });
      const d = await r.json() as RealityMap & { error?: string };
      if (!r.ok) { setMsg(d.error ?? "Could not save."); setSaving(false); return; }
      setMap(d); setMsg("Saved ✓");
    } catch { setMsg("Network error."); }
    setSaving(false);
  }, [map, wsQuery]);

  // AI: from the surface "what business are you in", propose the deeper outcome
  // customers actually buy and where the business needs to go.
  const aiPositioning = async () => {
    if (getAiProvider() === "manual") { setAiOpen(true); setMsg("Connect an AI provider first (the AI button)."); return; }
    if (!map.businessIn?.trim()) { setMsg("Fill in \"what business are you in?\" first — the AI builds on it."); return; }
    setAiBusy(true); setMsg("");
    try {
      const system = "You are a sharp positioning strategist (in the spirit of jobs-to-be-done and StoryBrand). Given the surface description of a business, articulate the DEEPER outcome customers actually buy, and where the business needs to head. Return ONLY JSON with keys: really (the deeper outcome/transformation customers pay for, 1-2 sentences) and need (the business it needs to become to win, 1-2 sentences).";
      const user = `Surface business: ${map.businessIn}\n${map.businessReallyIn ? `Current 'really in' note: ${map.businessReallyIn}\n` : ""}${map.now?.customers ? `Customers: ${map.now.customers}\n` : ""}Return the JSON now.`;
      // Ground in the workspace's brand voice only — NOT the Business-OS
      // strategy brief. This page IS the source of that strategy, so feeding
      // it back in here would be circular.
      const brand = await loadBrandProfile();
      const grounded = hasBrand(brand) ? `BRAND (write in this voice):\n${brandBrief(brand)}\n\n${user}` : user;
      const reply = await callOpenRouter(aiKey, aiModel, system, grounded, 300);
      const j = extractJson(reply) as { really?: string; need?: string };
      set({ businessReallyIn: j.really ?? map.businessReallyIn, businessNeedToBeIn: j.need ?? map.businessNeedToBeIn });
      setMsg("AI drafted your positioning — refine it in your words.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(false); }
  };

  const nowRev = num(map.now?.revenue);
  const targetRev = num(map.targetRevenue);
  const revGap = nowRev != null && targetRev != null ? targetRev - nowRev : null;
  const gapReached = revGap != null && revGap <= 0;
  const captured = countCaptured(map);
  const pct = Math.round((captured / FIELD_COUNT) * 100);
  const stageIdx = STAGES.indexOf(map.now?.stage ?? "");

  const nav = (
    <>
      <button className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setAiOpen((v) => !v)} title="AI settings"><MarketingIcon name="gear" size={14} /> AI</button>
      <a href="/business/drivers" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="tree" size={14} /> Driver Tree</a>
      <a href="/business/constraint" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="plan" size={14} /> Constraint</a>
      <a href="/business/execution" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="bolt" size={14} /> Execution Centre</a>
      <a href="/business/review" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="refresh" size={14} /> Review</a>
      <a href="/business" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="compass" size={14} /> Overview</a>
      <a href="/" className="ds-btn ds-btn--ghost ds-btn--sm"><MarketingIcon name="home" size={14} /> Home</a>
    </>
  );

  return (
    <PageShell
      className="rm"
      maxWidth={820}
      eyebrow="Business OS"
      title="Business Reality Map"
      subtitle="Where you are, where you're going, and the gap between them. The starting point of every decision."
      actions={nav}
    >
      <style>{CSS}</style>

      {aiOpen && (
        <section className="panel">
          <div className="grid">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="ds-help">Get a key at openrouter.ai — it&apos;s saved to your account (encrypted) and sent straight to the provider. Used across the whole app&apos;s AI.</p>
        </section>
      )}

      {msg && (
        <div className={`msg ${msg.includes("✓") ? "ok" : "err"}`} role="status" aria-live="polite">
          <MarketingIcon name={msg.includes("✓") ? "check" : "warning"} size={14} />
          <span>{msg}</span>
        </div>
      )}

      {state === "loading" && <div className="panel center"><div className="spinner" /><p className="ds-body">Loading your reality map…</p></div>}
      {state === "error" && (
        <div className="panel center">
          <span className="notice-icon notice-icon--warn" aria-hidden="true"><MarketingIcon name="warning" size={20} /></span>
          <p className="ds-body">Something went wrong loading your reality map. <button className="link" onClick={() => void load()}>Try again</button></p>
        </div>
      )}
      {state === "not-authenticated" && (
        <div className="panel notice">
          <span className="notice-icon notice-icon--info" aria-hidden="true"><MarketingIcon name="lock" size={20} /></span>
          <h2>Sign in required</h2>
          <p className="ds-help">Sign in to view and update your workspace&apos;s reality map.</p>
        </div>
      )}
      {state === "forbidden" && (
        <div className="panel notice">
          <span className="notice-icon notice-icon--warn" aria-hidden="true"><MarketingIcon name="warning" size={20} /></span>
          <h2>Not a member of this workspace</h2>
          <p className="ds-help">Ask a workspace admin to add you, then refresh this page.</p>
        </div>
      )}

      {state === "ok" && (
        <>
          <section className="intro-band">
            <div className="intro-row">
              <span className="intro-icon" aria-hidden="true"><MarketingIcon name="lock" size={14} /></span>
              <p className="intro-copy">Only your workspace can see this, and nothing here is graded. Rough numbers are fine to start — the honest baseline matters more than precision, and you can refine anything later.</p>
            </div>
            <div className="intro-progress">
              <div className="intro-progress-head">
                <span>Reality map progress</span>
                {captured >= FIELD_COUNT
                  ? <span className="progress-done"><MarketingIcon name="check" size={12} /> Fully captured</span>
                  : <span>{captured} of {FIELD_COUNT} captured</span>}
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={captured} aria-valuemin={0} aria-valuemax={FIELD_COUNT} aria-label="Reality map fields captured">
                <span className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </section>

          <section className="panel panel--info">
            <div className="panel-head">
              <span className="ds-eyebrow" style={{ color: "var(--ds-info)" }}>Positioning</span>
              <h2>What business are you in?</h2>
              <p className="panel-why">The surface answer undersells you — the deeper outcome people actually pay for is what sharpens your offers and marketing. Not sure? Fill in the first box and let AI suggest the rest below.</p>
            </div>
            <Field label="What business are you in? (the surface answer)"><textarea className="ds-textarea" value={map.businessIn ?? ""} onChange={(e) => set({ businessIn: e.target.value })} placeholder="e.g. Business-planning software." /></Field>
            <Field label="What business are you REALLY in? (the deeper outcome people buy)"><textarea className="ds-textarea" value={map.businessReallyIn ?? ""} onChange={(e) => set({ businessReallyIn: e.target.value })} placeholder="e.g. Decision confidence for founders." /></Field>
            <Field label="What business do you NEED to be in? (where this has to go)"><textarea className="ds-textarea" value={map.businessNeedToBeIn ?? ""} onChange={(e) => set({ businessNeedToBeIn: e.target.value })} placeholder="e.g. A business operating system founders run on daily." /></Field>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", alignSelf: "flex-start" }}>
              <Button variant="secondary" onClick={() => void aiPositioning()} disabled={aiBusy}>{aiBusy ? "Thinking…" : <><MarketingIcon name="spark" size={13} /> AI: clarify what you&apos;re really in</>}</Button>
              <GroundingChips brand={brandOn} strategy={false} showStrategy={false} />
            </div>
          </section>

          <section className="panel panel--warn">
            <div className="panel-head">
              <span className="ds-eyebrow" style={{ color: "var(--ds-warning)" }}>Today</span>
              <h2>Where are you now?</h2>
              <p className="panel-why">The honest starting line, not the aspirational one. Rough numbers are fine — what matters is that they&apos;re real, since everything else is measured from here.</p>
            </div>
            <div className="grid">
              <Field label="Revenue" help="Monthly or annual — just note which. Rough is fine."><input className="ds-input" value={map.now?.revenue ?? ""} onChange={(e) => setNow({ revenue: e.target.value })} placeholder="£ / month or year" /></Field>
              <Field label="Profit" help="Before tax is fine, if that&apos;s easier to pull."><input className="ds-input" value={map.now?.profit ?? ""} onChange={(e) => setNow({ profit: e.target.value })} placeholder="£" /></Field>
              <Field label="Customers" help="Paying customers or active users — whatever fits your business."><input className="ds-input" value={map.now?.customers ?? ""} onChange={(e) => setNow({ customers: e.target.value })} /></Field>
              <Field label="Team size" help="Include yourself, plus full-time equivalents."><input className="ds-input" value={map.now?.team ?? ""} onChange={(e) => setNow({ team: e.target.value })} /></Field>
              <Field label="Stage" help="Which maturity stage best fits today.">
                <>
                  <select className="ds-input" value={map.now?.stage ?? ""} onChange={(e) => setNow({ stage: e.target.value })}>
                    <option value="">Select…</option>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {stageIdx >= 0 && <span className="ds-badge ds-badge--brand stage-pill">Stage {stageIdx + 1} of {STAGES.length}</span>}
                </>
              </Field>
            </div>
          </section>

          <section className="panel panel--good">
            <div className="panel-head">
              <span className="ds-eyebrow" style={{ color: "var(--ds-success)" }}>The vision</span>
              <h2>Where do you want to be?</h2>
              <p className="panel-why">Paint it specific enough that you&apos;d recognise it if you arrived — that&apos;s what turns a wish into a target you can work back from.</p>
            </div>
            <Field label="In 12 months" help="Be concrete — revenue, team, what&apos;s true then that isn&apos;t now."><textarea className="ds-textarea" value={map.want12m ?? ""} onChange={(e) => set({ want12m: e.target.value })} placeholder="The concrete picture a year out." /></Field>
            <Field label="In 36 months" help="Zoom out — the shape of the business, not just a bigger number."><textarea className="ds-textarea" value={map.want36m ?? ""} onChange={(e) => set({ want36m: e.target.value })} placeholder="The 3-year vision." /></Field>
            <Field label="Target revenue" help="Used to compute the revenue gap below."><input className="ds-input" value={map.targetRevenue ?? ""} onChange={(e) => set({ targetRevenue: e.target.value })} placeholder="£" /></Field>
          </section>

          <section className="panel gap-panel">
            <div className="panel-head">
              <span className="ds-eyebrow" style={{ color: "var(--ds-brand-active)" }}>The gap</span>
              <h2>The gap</h2>
              <p className="panel-why">The distance between now and the vision is the actual work. Name each gap and it stops being a vague worry and becomes something you can plan against.</p>
            </div>
            {revGap != null ? (
              <div className="gap-metric">
                <span className="gap-label">{gapReached ? "Target status" : "Revenue gap (target − now)"}</span>
                <span className={`gap-value ${gapReached ? "good" : "ds-gradient-text"}`}>
                  {gapReached ? (revGap < 0 ? "Ahead of target" : "Target reached") : money(revGap)}
                </span>
                <span className="gap-hint">
                  {gapReached
                    ? (revGap < 0 ? `${money(Math.abs(revGap))} ahead — nice work.` : "You're exactly on target.")
                    : "Still to close — this is what the work below closes."}
                </span>
              </div>
            ) : (
              <p className="gap-empty"><MarketingIcon name="insights" size={14} /> Add your current revenue above and a target revenue below — your gap shows up here automatically.</p>
            )}
            <div className="grid">
              <Field label="Capability gap"><input className="ds-input" value={map.gaps?.capability ?? ""} onChange={(e) => setGap({ capability: e.target.value })} placeholder="What we can't yet do." /></Field>
              <Field label="Acquisition gap"><input className="ds-input" value={map.gaps?.acquisition ?? ""} onChange={(e) => setGap({ acquisition: e.target.value })} placeholder="How we get customers." /></Field>
              <Field label="Product gap"><input className="ds-input" value={map.gaps?.product ?? ""} onChange={(e) => setGap({ product: e.target.value })} /></Field>
              <Field label="Team gap"><input className="ds-input" value={map.gaps?.team ?? ""} onChange={(e) => setGap({ team: e.target.value })} /></Field>
              <Field label="System gap"><input className="ds-input" value={map.gaps?.system ?? ""} onChange={(e) => setGap({ system: e.target.value })} placeholder="Processes / tools missing." /></Field>
            </div>
          </section>

          <div className="save-bar">
            <span className="ds-help">The map feeds the constraint &amp; driver systems next.</span>
            <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save reality map"}</Button>
          </div>
        </>
      )}
    </PageShell>
  );
}

// Page-specific layout only. All colour/typography/controls come from the
// shared design system (app/design-system.css) — no local token overrides, so
// this page follows the light/dark theme instead of being hardcoded light.
// Everything is scoped under .rm so nothing leaks to other pages. Semantic
// tokens (info/warning/success/brand) tag each section so the page reads as
// Positioning → Today → Vision → Gap at a glance, not just four grey cards.
const CSS = `
.rm .panel{background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:20px 22px;margin-bottom:14px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--ds-shadow-sm);transition:box-shadow .15s ease,border-color .15s ease;}
.rm .panel:hover,.rm .panel:focus-within{box-shadow:var(--ds-shadow-md);}
.rm .panel--info{border-left:3px solid var(--ds-info);}
.rm .panel--warn{border-left:3px solid var(--ds-warning);}
.rm .panel--good{border-left:3px solid var(--ds-success);}
.rm .panel.center{align-items:center;justify-content:center;min-height:180px;text-align:center;}
.rm .panel.notice{text-align:center;}
.rm .panel.notice h2{margin:0;font-size:18px;}
.rm .notice-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;}
.rm .notice-icon--info{background:var(--ds-info-soft);color:var(--ds-info);}
.rm .notice-icon--warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.rm .panel-head{display:flex;flex-direction:column;gap:4px;}
.rm .panel-head h2{font-size:18px;margin:0;letter-spacing:-.3px;}
.rm .panel-why{margin:0;font-size:12.5px;line-height:1.55;color:var(--ds-text-secondary);max-width:68ch;}
.rm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
.rm .link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;border-radius:4px;transition:color .15s ease;}
.rm .link:hover{color:var(--ds-brand-hover);}
.rm .link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.rm .msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;display:flex;align-items:center;gap:8px;}
.rm .msg.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.rm .msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);}
.rm .intro-band{background:var(--ds-info-soft);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:14px;display:flex;flex-direction:column;gap:12px;}
.rm .intro-row{display:flex;align-items:flex-start;gap:10px;}
.rm .intro-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--ds-surface);color:var(--ds-info);margin-top:1px;}
.rm .intro-copy{margin:0;font-size:12.5px;line-height:1.55;color:var(--ds-text-secondary);max-width:72ch;}
.rm .intro-progress{display:flex;flex-direction:column;gap:6px;}
.rm .intro-progress-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;letter-spacing:.5px;}
.rm .progress-done{display:inline-flex;align-items:center;gap:4px;color:var(--ds-success);text-transform:none;letter-spacing:0;}
.rm .progress-track{height:7px;border-radius:99px;background:var(--ds-surface);overflow:hidden;border:1px solid var(--ds-border-subtle);}
.rm .progress-fill{display:block;height:100%;border-radius:99px;background:var(--ds-brand);transition:width .4s ease;}
.rm .stage-pill{align-self:flex-start;}
.rm .gap-panel{background:var(--ds-brand-soft);border-color:transparent;}
.rm .gap-metric{display:flex;flex-direction:column;gap:4px;}
.rm .gap-label{font-size:12px;color:var(--ds-text-secondary);}
.rm .gap-value{font-size:28px;font-weight:700;letter-spacing:-.5px;}
.rm .gap-value.good{color:var(--ds-success);}
.rm .gap-hint{font-size:12px;color:var(--ds-text-secondary);}
.rm .gap-empty{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ds-text-secondary);background:var(--ds-surface);border:1px dashed var(--ds-border-default);border-radius:var(--ds-radius-md);padding:10px 12px;margin:0;}
.rm .save-bar{position:sticky;bottom:14px;margin-top:16px;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-md);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 4px 12px -2px rgba(15,23,42,.10);}
.rm .spinner{width:28px;height:28px;border:3px solid var(--ds-border-default);border-top-color:var(--ds-brand);border-radius:50%;animation:rm-spin .8s linear infinite;margin-bottom:10px;}
@keyframes rm-spin{to{transform:rotate(360deg);}}
/* Honour reduced-motion, but keep the loading spinner turning (it communicates
   real status, not decoration) — matches the site-wide exemption in globals.css. */
@media (prefers-reduced-motion: reduce){ .rm *:not(.spinner){transition:none!important;animation:none!important;} }
`;
