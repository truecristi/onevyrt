"use client";

/**
 * Asset Writer — build a marketing asset section by section from its anatomy
 * (see lib/asset-anatomy), generating any section with the user's own
 * connected AI (see lib/ai). Pick email / landing page / ad / SMS, give a
 * short brief, then write or AI-generate each part. The key stays in the
 * browser; generation goes straight to the connected provider.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ASSET_TYPES, getAssetType, type AssetTypeId, type AssetSection } from "../../../lib/asset-anatomy";
import { templatesForType } from "../../../lib/asset-templates";
import { AI_PROVIDERS, getAIProvider, keyLooksValid, type AIProviderId } from "../../../lib/ai/providers";
import { callAI, loadConnection, saveConnection } from "../../../lib/ai/client";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { Notice } from "../../../components/ui/Notice";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, strategyBlock, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";

const INK = "var(--ds-text-primary)";

type ViewState = "loading" | "ok" | "not-authenticated" | "not-enabled" | "forbidden" | "error";

export default function AssetWriterPage() {
  const [state, setState] = useState<ViewState>("loading");

  const [aiProvider, setAiProvider] = useState<AIProviderId>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  const [typeId, setTypeId] = useState<AssetTypeId>("email");
  const [brief, setBrief] = useState("");
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const type = getAssetType(typeId)!;

  // Gate the tool behind the campaign_studio entitlement — the same add-on
  // every other Campaign Studio page checks (see brand/campaigns). Reads the
  // dedicated entitlements endpoint so we can show a proper "not enabled"
  // upsell; it 401s when signed out, which stands in for the auth check.
  const load = useCallback(async () => {
    setState("loading");
    try {
      const entRes = await fetch("/api/campaign-studio/entitlements", { credentials: "include" });
      if (entRes.status === 401) { setState("not-authenticated"); return; }
      if (entRes.status === 403) { setState("forbidden"); return; }
      if (!entRes.ok) { setState("error"); return; }
      const entitlements = await entRes.json() as { entitlement: string }[];
      setState(entitlements.some((e) => e.entitlement === "campaign_studio") ? "ok" : "not-enabled");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const c = loadConnection();
    if (c) { setAiProvider(c.provider); setAiKey(c.apiKey); setAiModel(c.model); }
    void loadBrandProfile().then(setBrand); // ground generation in the Brand Brain when there is one
    void loadStrategyBrief().then(setStrategy); // …and in the Business-OS strategy when there is one
  }, []);

  const persist = (p: AIProviderId, k: string, m: string) => saveConnection({ provider: p, apiKey: k, model: m });
  const saveProvider = (p: AIProviderId) => { setAiProvider(p); persist(p, aiKey, aiModel); };
  const saveKey = (k: string) => { setAiKey(k); persist(aiProvider, k, aiModel); };
  const saveModel = (m: string) => { setAiModel(m); persist(aiProvider, aiKey, m); };

  const assembled = useMemo(
    () => type.sections.map((s) => (values[s.key] || "").trim()).filter(Boolean).join("\n\n"),
    [type, values],
  );

  const generate = async (section: AssetSection) => {
    if (aiProvider === "manual") { setAiOpen(true); setErr("Connect an AI provider first."); return; }
    setBusy(section.key); setErr("");
    try {
      const soFar = type.sections
        .filter((s) => s.key !== section.key && (values[s.key] || "").trim())
        .map((s) => `${s.name}: ${(values[s.key] || "").trim()}`)
        .join("\n");
      const system = "You are a senior direct-response copywriter. Write ready-to-use copy for ONE section of a marketing asset. When a BRAND brief is given, write in that brand's voice and use its real facts — never contradict or invent past them. When a BUSINESS STRATEGY is given, make the copy serve that strategy — speak to the stated goal, gaps and constraint. Return only the copy for that section — no labels, no headings, no explanation, no markdown.";
      const user = [
        hasBrand(brand) ? `BRAND:\n${brandBrief(brand)}` : "",
        strategyBlock(strategy),
        `ASSET: ${type.name}`,
        brief ? `ABOUT: ${brief}` : "",
        soFar ? `WHAT'S WRITTEN SO FAR:\n${soFar}` : "",
        `SECTION TO WRITE: ${section.name}`,
        `PURPOSE: ${section.purpose}`,
        `HOW TO WRITE IT: ${section.guidance}`,
        section.maxWords ? `Keep it to about ${section.maxWords} words.` : "",
        `Write the ${section.name} now.`,
      ].filter(Boolean).join("\n");
      const text = await callAI({ provider: aiProvider, apiKey: aiKey, model: aiModel }, system, user, 400);
      setValues((v) => ({ ...v, [section.key]: text }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  };

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(assembled); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const prov = getAIProvider(aiProvider);
  const aiReady = aiProvider !== "manual" && aiKey.trim().length > 0;
  const total = type.sections.length;
  const done = type.sections.filter((s) => (values[s.key] || "").trim()).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const words = assembled ? assembled.trim().split(/\s+/).filter(Boolean).length : 0;

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "radial-gradient(900px 640px at 12% -6%, rgba(10,158,110,0.07), transparent 60%), radial-gradient(800px 560px at 92% 3%, rgba(106,92,240,0.06), transparent 55%), var(--ds-bg-app)", color: INK, fontFamily: "var(--font-roboto), Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif", padding: "0 20px 60px" };
  const section: React.CSSProperties = { maxWidth: 880, margin: "0 auto" };

  if (state !== "ok") return (
    <div className="aw-root" style={wrap}>
      <style>{CSS}</style>
      <div style={{ ...section, paddingTop: 80 }}>
        {state === "loading" && <div className="aw-card aw-loading"><div className="aw-spinner" aria-hidden /><span>Loading…</span></div>}
        {state === "not-authenticated" && <Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Asset Writer — it runs on your own AI key." href="/" cta="Go to sign in" />}
        {state === "not-enabled" && <Notice icon="✨" title="Campaign Studio isn't enabled here" body="It's included with the Performance plan, or available as an add-on for Pro / Business." />}
        {state === "forbidden" && <Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" />}
        {state === "error" && <Notice icon="⚠️" title="Something went wrong" body="We couldn't load the Asset Writer." onRetry={() => void load()} />}
      </div>
    </div>
  );

  return (
    <div className="aw-root" style={wrap}>
      <style>{CSS}</style>

      <div style={{ ...section, paddingTop: 28, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto", minWidth: 0 }}>
          <div className="aw-eyebrow">✦ Campaign Studio</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "3px 0 0", letterSpacing: -0.3 }}>Asset Writer</h1>
          <p className="aw-sub">Draft an email, landing page, ad or SMS one part at a time — write it yourself or let your connected AI draft any section. Grounded in your brand and strategy, built around one clear ask, ready to copy.</p>
          <div style={{ marginTop: 10 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <a href="/campaign-studio/campaigns" className="aw-btn aw-btn--ghost">Campaigns</a>
          <button className="aw-btn aw-btn--ghost" onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen}
            aria-label={`AI provider ${prov?.name}, ${aiReady ? "connected" : "not connected"}. Toggle AI settings.`}>
            <span className={"aw-dot " + (aiReady ? "aw-dot--ok" : "aw-dot--idle")} aria-hidden />
            <span aria-hidden>{prov?.icon}</span> AI: {prov?.name}
          </button>
        </div>
      </div>

      {aiOpen && (
        <div style={{ ...section, marginTop: 14 }}>
          <div className="aw-card">
            <div className="aw-panel-lead">
              <span className={"aw-pill " + (aiReady ? "aw-pill--ok" : "aw-pill--idle")}>{aiReady ? "● Connected" : "● Not connected"}</span>
              <span>Bring your own AI. Your key stays in your browser and this account — every generation goes straight to the provider, never through our servers.</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "13px 0 14px" }}>
              {AI_PROVIDERS.map((p) => {
                const on = aiProvider === p.id;
                return (
                  <button key={p.id} className="aw-chip aw-chip--sm" onClick={() => saveProvider(p.id)} aria-pressed={on}
                    style={{ border: `1px solid ${on ? p.hue : "var(--ds-border-default)"}`, background: on ? `${p.hue}14` : "var(--ds-surface)", color: on ? p.hue : "var(--ds-text-primary)" }}>
                    <span aria-hidden>{p.icon}</span>{p.name}
                  </button>
                );
              })}
            </div>
            {aiProvider !== "manual" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label className="aw-label">{prov?.name} API key<span className="aw-label-hint">Saved to your account, sent straight to the provider.</span>
                  <input type="password" value={aiKey} onChange={(e) => saveKey(e.target.value)} placeholder={prov?.keyPrefix ? `${prov.keyPrefix}…` : "your API key"} className="aw-input" style={{ marginTop: 6 }} autoComplete="off" />
                </label>
                <label className="aw-label">Model<span className="aw-label-hint">Optional — defaults to {prov?.defaultModel || "the provider default"}.</span>
                  <input value={aiModel} onChange={(e) => saveModel(e.target.value)} placeholder={prov?.defaultModel} list="aw-models" className="aw-input" style={{ marginTop: 6 }} />
                  <datalist id="aw-models">{(prov?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                </label>
              </div>
            )}
            <p className="aw-note">{prov?.note}{" "}{prov?.keyUrl && <a href={prov.keyUrl} target="_blank" rel="noreferrer" className="aw-link">Get a key →</a>}</p>
            {aiProvider !== "manual" && prov && aiKey.trim() && !keyLooksValid(prov, aiKey) && (
              <p className="aw-warn">That doesn&apos;t look like a {prov.name} key — double-check it.</p>
            )}
          </div>
        </div>
      )}

      {/* Asset type + brief */}
      <div style={{ ...section, marginTop: 18 }}>
        <div className="aw-step-eyebrow">1 · Pick what you&apos;re writing</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "9px 0 12px" }}>
          {ASSET_TYPES.map((a) => {
            const on = typeId === a.id;
            return (
              <button key={a.id} className={"aw-chip" + (on ? " aw-chip--on" : "")} aria-pressed={on}
                onClick={() => { setTypeId(a.id); setValues({}); setErr(""); }}>
                <span aria-hidden>{a.icon}</span>{a.name}
              </button>
            );
          })}
        </div>
        <div className="aw-summary">{type.summary}</div>

        <label className="aw-step-eyebrow" htmlFor="aw-brief" style={{ display: "block", margin: "16px 0 0" }}>2 · Give it a one-line brief</label>
        <input id="aw-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What's this about? e.g. Abandoned-cart recovery for a skincare store" className="aw-input" style={{ marginTop: 9 }} />
        <p className="aw-hint">One line on what you&apos;re selling and to whom — the AI folds this into every section it writes.</p>

        <div style={{ marginTop: 16 }}>
          <div className="aw-step-eyebrow">Start from a template</div>
          <p className="aw-hint" style={{ margin: "6px 0 10px" }}>Load a fully-written draft, then edit or regenerate any part.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {templatesForType(typeId).map((t) => (
              <button key={t.id} className="aw-btn aw-btn--tmpl" onClick={() => { setValues({ ...t.values }); setErr(""); }} title={t.description}>{t.name}</button>
            ))}
            <button className="aw-btn aw-btn--ghost aw-btn--muted" onClick={() => setValues(Object.fromEntries(type.sections.map((s) => [s.key, s.example])))} title="Fill every section with the generic anatomy examples">Generic example</button>
            {Object.keys(values).length > 0 && <button className="aw-btn aw-btn--ghost aw-btn--muted" onClick={() => setValues({})}>Clear all</button>}
          </div>
        </div>
      </div>

      {err && <div style={{ ...section, marginTop: 12 }}><div role="alert" className="aw-alert">{err}</div></div>}

      {/* Progress */}
      <div style={{ ...section, marginTop: 18 }}>
        <div className="aw-step-eyebrow" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <span>3 · Write each section</span>
          <span className="aw-progress-label">{done} of {total} written</span>
        </div>
        <div className="aw-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`${done} of ${total} sections written`}>
          <div className="aw-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Sections */}
      <div style={{ ...section, marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {type.sections.map((s, i) => {
          const filled = !!(values[s.key] || "").trim();
          const wc = (values[s.key] || "").trim().split(/\s+/).filter(Boolean).length;
          const over = s.maxWords ? wc > s.maxWords : false;
          return (
            <div key={s.key} className={"aw-card aw-card--section" + (filled ? " aw-card--filled" : "")}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="aw-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.name}</span>
                  {s.optional && <span className="aw-optional">optional</span>}
                  {filled && <span className="aw-done" aria-label="written">✓ written</span>}
                </div>
                <button className="aw-btn aw-btn--primary" onClick={() => void generate(s)} disabled={busy === s.key}
                  aria-label={`${values[s.key] ? "Regenerate" : "Generate"} the ${s.name} with AI`}>
                  {busy === s.key ? <span className="aw-writing">Writing…</span> : values[s.key] ? "↻ Regenerate" : <><MarketingIcon name="spark" size={13} /> Generate</>}
                </button>
              </div>
              <div className="aw-purpose">{s.purpose}</div>
              <div className="aw-tip"><span aria-hidden>💡</span><span>{s.guidance}</span></div>
              <textarea value={values[s.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} placeholder={s.example} rows={s.key === "story" || s.key === "objections" ? 4 : 2}
                className="aw-textarea" aria-label={s.name} />
              {s.maxWords && (
                <div className={"aw-count" + (over ? " aw-count--over" : "")}>{wc}/{s.maxWords} words{over ? " — trim to keep it punchy" : ""}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assembled */}
      {assembled ? (
        <div style={{ ...section, marginTop: 18 }}>
          <div className="aw-card aw-assembled">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span className="aw-num aw-num--done" aria-hidden>✓</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Assembled {type.name.toLowerCase()}</div>
                  <div className="aw-assembled-sub">{done} of {total} sections · {words} {words === 1 ? "word" : "words"} · ready to paste</div>
                </div>
              </div>
              <button className="aw-btn aw-btn--ghost" onClick={() => void copyAll()} aria-live="polite">{copied ? "Copied ✓" : "Copy all"}</button>
            </div>
            <pre className="aw-pre">{assembled}</pre>
          </div>
        </div>
      ) : (
        <div style={{ ...section, marginTop: 18 }}>
          <div className="aw-empty">
            <div className="aw-empty__icon" aria-hidden>✍️</div>
            <div className="aw-empty__title">Your assembled {type.name.toLowerCase()} will appear here</div>
            <div className="aw-empty__sub">Write or generate the sections above — then copy the whole thing in one click.</div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.aw-root *{box-sizing:border-box}

.aw-eyebrow{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--ds-brand)}
.aw-step-eyebrow{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ds-text-tertiary)}
.aw-sub{font-size:13.5px;line-height:1.55;color:var(--ds-text-secondary);max-width:64ch;margin:8px 0 0}
.aw-summary{font-size:13px;color:var(--ds-text-secondary);line-height:1.5}
.aw-hint{font-size:12.5px;color:var(--ds-text-tertiary);line-height:1.5;margin:7px 0 0}
.aw-note{font-size:12.5px;color:var(--ds-text-tertiary);margin-top:10px;line-height:1.5}
.aw-warn{font-size:12.5px;color:var(--ds-warning);margin-top:6px;font-weight:500}
.aw-link{color:var(--ds-brand);font-weight:500;text-decoration:none}
.aw-link:hover{text-decoration:underline}
.aw-purpose{font-size:12.5px;color:var(--ds-text-secondary);margin-bottom:8px;line-height:1.45}

.aw-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.aw-dot--ok{background:var(--ds-success);box-shadow:0 0 0 3px var(--ds-success-soft)}
.aw-dot--idle{background:var(--ds-warning);box-shadow:0 0 0 3px var(--ds-warning-soft)}

.aw-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;line-height:1.4;white-space:nowrap;flex:none}
.aw-pill--ok{background:var(--ds-success-soft);color:var(--ds-success)}
.aw-pill--idle{background:var(--ds-warning-soft);color:var(--ds-warning)}

.aw-card{background:var(--ds-surface);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);border:1px solid var(--ds-border-default);border-radius:21px;padding:18px;box-shadow:var(--ds-shadow-md);transition:transform var(--ds-dur-hover,.15s) var(--ds-ease),box-shadow var(--ds-dur-hover,.15s) var(--ds-ease),border-color var(--ds-dur-hover,.15s) var(--ds-ease)}
.aw-card--section{position:relative;overflow:hidden}
.aw-card--section:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-lg)}
.aw-card--filled::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ds-brand)}

.aw-panel-lead{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--ds-text-secondary);line-height:1.5}
.aw-label{font-size:12px;color:var(--ds-text-secondary);font-weight:500;display:block}
.aw-label-hint{display:block;font-size:11px;color:var(--ds-text-tertiary);font-weight:400;margin-top:2px}

.aw-input,.aw-textarea{width:100%;box-sizing:border-box;background:var(--ds-surface);border:1px solid var(--ds-border-default);border-radius:13px;color:var(--ds-text-primary);padding:10px 12px;font-size:14px;font-family:inherit;transition:border-color var(--ds-dur-hover,.15s) var(--ds-ease),box-shadow var(--ds-dur-hover,.15s) var(--ds-ease)}
.aw-textarea{resize:vertical;line-height:1.5;min-height:46px}
.aw-input:hover,.aw-textarea:hover{border-color:var(--ds-border-strong)}
.aw-input:focus,.aw-textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring)}
.aw-input::placeholder,.aw-textarea::placeholder{color:var(--ds-text-disabled)}

.aw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:11px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;border:1px solid transparent;text-decoration:none;white-space:nowrap;transition:transform var(--ds-dur-hover,.15s) var(--ds-ease),box-shadow var(--ds-dur-hover,.15s) var(--ds-ease),background var(--ds-dur-hover,.15s) var(--ds-ease),border-color var(--ds-dur-hover,.15s) var(--ds-ease),color var(--ds-dur-hover,.15s) var(--ds-ease)}
.aw-btn:active{transform:translateY(.5px) scale(.99)}
.aw-btn:disabled{opacity:.6;cursor:default;pointer-events:none}
.aw-btn:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px}
.aw-btn--primary{background:var(--ds-brand-solid);color:#fff;padding:9px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(15,23,42,.12)}
.aw-btn--primary:not(:disabled):hover{background:var(--ds-brand-solid-hover);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 6px 16px -6px rgba(10,158,110,.45)}
.aw-btn--ghost{background:transparent;border-color:var(--ds-border-default);color:var(--ds-text-primary);padding:8px 14px}
.aw-btn--ghost:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm)}
.aw-btn--tmpl{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-brand);padding:8px 14px}
.aw-btn--tmpl:hover{border-color:var(--ds-brand-hover);color:var(--ds-brand-hover);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm)}
.aw-btn--muted{color:var(--ds-text-tertiary)}
.aw-btn--muted:hover{color:var(--ds-text-secondary)}

.aw-chip{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:11px;cursor:pointer;font-size:14px;font-weight:500;border:1px solid var(--ds-border-default);background:var(--ds-surface);color:var(--ds-text-primary);font-family:inherit;transition:transform var(--ds-dur-hover,.15s) var(--ds-ease),box-shadow var(--ds-dur-hover,.15s) var(--ds-ease),border-color var(--ds-dur-hover,.15s) var(--ds-ease),background var(--ds-dur-hover,.15s) var(--ds-ease),color var(--ds-dur-hover,.15s) var(--ds-ease)}
.aw-chip:hover{border-color:var(--ds-border-strong);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm)}
.aw-chip:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px}
.aw-chip--on{border-color:var(--ds-brand)!important;background:var(--ds-brand-soft)!important;color:var(--ds-brand)!important}
.aw-chip--sm{padding:7px 13px;font-size:13px}

.aw-num{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;padding:0 7px;border-radius:99px;background:var(--ds-brand-soft);color:var(--ds-brand);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;flex:none}
.aw-num--done{background:var(--ds-success-soft);color:var(--ds-success)}
.aw-optional{font-size:11px;color:var(--ds-text-tertiary);font-weight:500}
.aw-done{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ds-success);background:var(--ds-success-soft);padding:2px 8px;border-radius:99px}

.aw-tip{display:flex;gap:7px;align-items:flex-start;font-size:12px;color:var(--ds-text-secondary);background:var(--ds-info-soft);border-left:2px solid var(--ds-info);border-radius:8px;padding:7px 10px;line-height:1.45;margin-bottom:10px}
.aw-tip span:first-child{flex:none}

.aw-count{margin-top:7px;font-size:11px;color:var(--ds-text-tertiary);font-variant-numeric:tabular-nums;text-align:right}
.aw-count--over{color:var(--ds-warning);font-weight:600}

.aw-progress{height:7px;border-radius:99px;background:var(--ds-bg-subtle);overflow:hidden;border:1px solid var(--ds-border-subtle)}
.aw-progress__bar{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ds-brand),var(--ds-success));transition:width var(--ds-dur-panel,.3s) var(--ds-ease)}
.aw-progress-label{text-transform:none;letter-spacing:0;color:var(--ds-text-tertiary);font-weight:600;font-size:11.5px}

.aw-alert{background:var(--ds-danger-soft);border:1px solid var(--ds-danger);color:var(--ds-danger);border-radius:10px;padding:10px 14px;font-size:13px;font-weight:500}

.aw-assembled{background:var(--ds-surface-subtle);box-shadow:inset 3px 0 0 var(--ds-brand),var(--ds-shadow-md)}
.aw-assembled-sub{font-size:11.5px;color:var(--ds-text-tertiary);margin-top:2px}
.aw-pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.6;margin:0;color:var(--ds-text-primary)}

.aw-empty{border:1px dashed var(--ds-border-default);border-radius:21px;padding:30px 20px;text-align:center;background:var(--ds-surface-subtle)}
.aw-empty__icon{font-size:26px;line-height:1}
.aw-empty__title{font-size:14px;font-weight:600;color:var(--ds-text-secondary);margin-top:10px}
.aw-empty__sub{font-size:12.5px;color:var(--ds-text-tertiary);margin-top:4px;line-height:1.5}

.aw-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;text-align:center;color:var(--ds-text-tertiary);font-size:13px}
.aw-spinner{width:28px;height:28px;border:3px solid var(--ds-border-default);border-top-color:var(--ds-brand);border-radius:50%;animation:aw-spin .8s linear infinite}
@keyframes aw-spin{to{transform:rotate(360deg)}}

.aw-writing{animation:aw-pulse 1s ease-in-out infinite}
@keyframes aw-pulse{0%,100%{opacity:1}50%{opacity:.5}}

@media (prefers-reduced-motion:reduce){.aw-root *{transition:none!important;animation:none!important}}
`;
