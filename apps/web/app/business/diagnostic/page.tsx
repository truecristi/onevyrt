"use client";
/**
 * Business OS — Business Diagnostic (platform spec Section 2's "7 Forces
 * wheel", first slice). A periodic full-business baseline across 8 fixed
 * categories: score where you are, where you want to be, how confident you
 * are in that score, the evidence behind it, the biggest constraint in that
 * category, and what you'd do about it.
 *
 * Deliberately narrower than the full spec for now: no radar/wheel chart,
 * gap ranking, historical trend, coach-vs-owner comparison, generated
 * 90-day plan, or reassessment scheduling yet — see docs/
 * IMPLEMENTATION_ROADMAP.md's "Section 2 — dedicated scoping pass".
 *
 * Distinct from /business/constraint (lib/constraint.ts): that tool
 * declares the ONE currently-active growth bottleneck from an open-ended,
 * user-editable area list. This is a full-business scorecard across a
 * FIXED taxonomy, meant to be revisited periodically — a different job,
 * not a duplicate. Styled with the shared design-system tokens, so it
 * follows the user's light/dark theme like the rest of the Business OS.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { MarketingIcon } from "../../../components/MarketingIcons";
// From the pure model file, not lib/business-diagnostic.ts directly: that
// module also holds the server-only persistence code (imports lib/db.ts →
// `pg`, which needs Node built-ins), and this is a client component — see
// lib/studio/diagnostic-model.ts's header comment for why the split exists.
import {
  DIAGNOSTIC_CATEGORY_ORDER, DIAGNOSTIC_CATEGORY_LABELS, DIAGNOSTIC_CATEGORY_PROMPTS,
  type DiagnosticCategoryId, type DiagnosticCategoryEntry, type DiagnosticConfidence, type BusinessDiagnostic,
} from "../../../lib/studio/diagnostic-model";

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";
const EMPTY_ENTRY: DiagnosticCategoryEntry = { score: 0, target: 0, confidence: "low", evidence: "", biggestConstraint: "", recommendedActions: "" };
const CONF_LABEL: Record<DiagnosticConfidence, string> = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" };

export default function DiagnosticPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [diagnostic, setDiagnostic] = useState<BusinessDiagnostic>({ categories: {} });
  const [openId, setOpenId] = useState<DiagnosticCategoryId | null>(null);
  const [draft, setDraft] = useState<DiagnosticCategoryEntry>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so
  // this page reads and writes the SAME workspace Studio is working in.
  // Absent → the personal workspace. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/diagnostic${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as BusinessDiagnostic;
      setDiagnostic({ categories: d.categories ?? {}, updatedAt: d.updatedAt });
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };

  const openCategory = (id: DiagnosticCategoryId) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setDraft(diagnostic.categories[id] ?? EMPTY_ENTRY);
    setErr("");
  };

  const save = useCallback(async (categoryId: DiagnosticCategoryId, entry: DiagnosticCategoryEntry) => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/diagnostic${wsQuery}`, {
        method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId, entry }),
      });
      const b = await r.json() as BusinessDiagnostic & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      setDiagnostic({ categories: b.categories ?? {}, updatedAt: b.updatedAt });
      flash("Saved.");
      setOpenId(null);
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading your diagnostic…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Business Diagnostic." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your diagnostic." onRetry={() => void load()} /></Shell>;

  const scoredCount = DIAGNOSTIC_CATEGORY_ORDER.filter((id) => diagnostic.categories[id]).length;

  return (
    <Shell>
      <div className="dg-header">
        <div>
          <div className="eyebrow">Business OS</div>
          <h1>Business Diagnostic</h1>
          <p className="sub">A baseline across the 8 forces that decide whether growth is easy or hard right now. Score where you are, name what&apos;s holding each one back, and what you&apos;d do about it.</p>
        </div>
        <div className="header-right">
          <a href={`/business/constraint${wsQuery}`} className="btn ghost sm"><MarketingIcon name="plan" size={14} /> Constraint</a>
          <a href={`/business${wsQuery}`} className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a>
          <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>
        </div>
      </div>

      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}

      <div className="dg-progress-row">
        <div className="dg-progress-bar" role="img" aria-label={`${scoredCount} of ${DIAGNOSTIC_CATEGORY_ORDER.length} categories scored`}>
          <span style={{ width: `${Math.round((scoredCount / DIAGNOSTIC_CATEGORY_ORDER.length) * 100)}%` }} />
        </div>
        <span className="dg-progress-label">{scoredCount} of {DIAGNOSTIC_CATEGORY_ORDER.length} scored</span>
      </div>

      <div className="dg-grid">
        {DIAGNOSTIC_CATEGORY_ORDER.map((id) => {
          const entry = diagnostic.categories[id];
          const isOpen = openId === id;
          return (
            <div key={id} className={`dg-card ${isOpen ? "is-open" : ""}`}>
              <button type="button" className="dg-card-head" onClick={() => openCategory(id)} aria-expanded={isOpen}>
                <div className="dg-card-title-row">
                  <span className="dg-card-title">{DIAGNOSTIC_CATEGORY_LABELS[id]}</span>
                  {entry ? <span className="dg-score-badge">{entry.score}/100</span> : <span className="dg-score-badge dg-score-badge--empty">Not scored</span>}
                </div>
                <p className="dg-card-prompt">{DIAGNOSTIC_CATEGORY_PROMPTS[id]}</p>
              </button>
              {isOpen && (
                <div className="dg-card-body">
                  {err && <div className="msg err" role="alert">{err}</div>}
                  <div className="dg-cols">
                    <label className="dg-mini"><span>Current score (0–100)</span>
                      <input type="number" min={0} max={100} value={draft.score} onChange={(e) => setDraft((d) => ({ ...d, score: Number(e.target.value) }))} />
                    </label>
                    <label className="dg-mini"><span>Target score (0–100)</span>
                      <input type="number" min={0} max={100} value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: Number(e.target.value) }))} />
                    </label>
                    <label className="dg-mini"><span>Confidence in this score</span>
                      <select value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value as DiagnosticConfidence }))}>
                        <option value="low">{CONF_LABEL.low}</option>
                        <option value="medium">{CONF_LABEL.medium}</option>
                        <option value="high">{CONF_LABEL.high}</option>
                      </select>
                    </label>
                  </div>
                  <label className="dg-mini"><span>Evidence — what tells you this?</span>
                    <textarea className="dg-ta" value={draft.evidence} onChange={(e) => setDraft((d) => ({ ...d, evidence: e.target.value }))} placeholder="A number, a symptom, a story." />
                  </label>
                  <label className="dg-mini"><span>Biggest constraint in this area</span>
                    <textarea className="dg-ta" value={draft.biggestConstraint} onChange={(e) => setDraft((d) => ({ ...d, biggestConstraint: e.target.value }))} placeholder="The #1 thing holding this back right now." />
                  </label>
                  <label className="dg-mini"><span>Recommended actions</span>
                    <textarea className="dg-ta" value={draft.recommendedActions} onChange={(e) => setDraft((d) => ({ ...d, recommendedActions: e.target.value }))} placeholder="What you'd do about it." />
                  </label>
                  <div className="dg-card-actions">
                    <button className="btn ghost sm" onClick={() => setOpenId(null)}>Cancel</button>
                    <button className="btn primary sm" onClick={() => void save(id, draft)} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="dg-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.dg-root{
  /* Colour/border/status tokens come from the shared design system (theme-
     aware via :root[data-theme]) — do NOT hardcode them here. */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:980px;margin:0 auto;padding:26px 18px 80px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .dg-root{
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.dg-root *{box-sizing:border-box;}
.dg-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.dg-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;text-align:center;color:var(--muted);}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:dgspin .8s linear infinite;}
@keyframes dgspin{to{transform:rotate(360deg);}}

.dg-progress-row{display:flex;align-items:center;gap:10px;margin:0 2px 16px;}
.dg-progress-bar{flex:1;height:6px;border-radius:999px;background:var(--ds-bg-subtle);border:1px solid var(--border);overflow:hidden;}
.dg-progress-bar>span{display:block;height:100%;border-radius:999px;background:var(--ds-brand);transition:width .5s var(--ds-ease);}
.dg-progress-label{font-size:11.5px;color:var(--muted);font-weight:500;white-space:nowrap;}

.dg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}
.dg-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease);overflow:hidden;}
.dg-card:hover{box-shadow:var(--ds-shadow-md);border-color:var(--ds-border-strong);}
.dg-card.is-open{grid-column:1/-1;border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-xs);}
.dg-card-head{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;width:100%;padding:14px 16px;cursor:pointer;}
.dg-card-head:focus-visible{outline:2px solid var(--ds-brand);outline-offset:-2px;}
.dg-card-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.dg-card-title{font-weight:600;font-size:14.5px;}
.dg-score-badge{font-size:12px;font-weight:700;color:var(--ds-brand-active);background:var(--ds-brand-soft);border-radius:999px;padding:3px 10px;white-space:nowrap;flex:none;}
.dg-score-badge--empty{color:var(--ds-text-tertiary);background:var(--ds-bg-subtle);}
.dg-card-prompt{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;}
.dg-card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--border);}
.dg-cols{display:flex;gap:12px;flex-wrap:wrap;}
.dg-cols>*{flex:1;min-width:140px;}
.dg-mini{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:500;color:var(--muted);}
.dg-mini input,.dg-mini select,.dg-mini textarea{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
.dg-mini input:focus,.dg-mini select:focus,.dg-mini textarea:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
.dg-mini textarea::placeholder,.dg-mini input::placeholder{color:var(--ds-text-disabled);}
.dg-ta{min-height:56px;resize:vertical;}
.dg-card-actions{display:flex;justify-content:flex-end;gap:8px;}

/* Respect reduced motion: no transitions, animations or hover lifts. */
@media (prefers-reduced-motion: reduce){ .dg-root *{ transition:none!important; animation:none!important; } }
`;
