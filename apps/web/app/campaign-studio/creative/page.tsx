"use client";
/**
 * Creative Studio — the front of the acquisition flywheel. Turn a brief into a
 * ranked set of Meta ad creative angles with your own connected AI (key stays
 * in the browser), each pre-linked to one of your qualification funnels so a
 * lead traces back to the exact creative. Generation is client-side (callAI);
 * ranking + parsing is the pure lib/campaign/creative engine.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { Notice } from "../../../components/ui/Notice";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { creativePrompt, parseCreatives, creativeLink, type CreativeVariant } from "../../../lib/campaign/creative";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { copyText } from "../../../lib/clipboard";
import { confirmDialog } from "../../../components/Modal";

interface FunnelLite { slug: string; doc: { title: string; intro?: string }; published: boolean; }
interface TrackedCreative { id: string; funnelSlug: string; creativeId: string; angle: string | null; headline: string; score: number; spend: number; leads: number; qualified: number; booked: number; qualifyRate: number; costPerQualified: number; costPerBooking: number; }
interface AnglePerf { angle: string; creatives: number; spend: number; leads: number; qualified: number; booked: number; qualifyRate: number; costPerQualified: number; }
interface SwipeCreative { id: string; headline: string; primaryText: string | null; cta: string | null; angle: string | null; score: number; uses: number; mine: boolean; authorName: string | null; }

function cac(n: number): string { return n > 0 ? `$${n < 100 ? n.toFixed(0) : Math.round(n)}` : "—"; }

type ViewState = "loading" | "ok" | "not-authenticated" | "not-enabled" | "forbidden" | "error";

export default function CreativeStudioPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [funnels, setFunnels] = useState<FunnelLite[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(4);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [variants, setVariants] = useState<CreativeVariant[] | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [tracked, setTracked] = useState<TrackedCreative[]>([]);
  const [angles, setAngles] = useState<AnglePerf[]>([]);
  const [useWinners, setUseWinners] = useState(true);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string>("");
  const [swipe, setSwipe] = useState<SwipeCreative[]>([]);
  const [sharedKeys, setSharedKeys] = useState<Set<string>>(new Set());
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []); // ground creative in the Brand Brain + Business-OS strategy
  const [sharingKey, setSharingKey] = useState<string>("");

  // Gate the whole tool behind the campaign_studio entitlement — the same
  // add-on every other Campaign Studio page checks (see brand/campaigns). Reads
  // the dedicated entitlements endpoint so we can show a proper "not enabled"
  // upsell instead of the gated data APIs just 403ing silently.
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

  const loadTracked = useCallback(async () => {
    try {
      const r = await fetch("/api/campaign/creatives", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setTracked(d.creatives ?? []); setAngles(d.angles ?? []); }
    } catch { /* leave empty */ }
  }, []);

  const loadSwipe = useCallback(async () => {
    try {
      const r = await fetch("/api/community/creatives", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setSwipe(d.creatives ?? []); }
    } catch { /* leave empty */ }
  }, []);

  const shareCreative = useCallback(async (v: CreativeVariant) => {
    setSharingKey(v.creativeId); setErr("");
    try {
      const r = await fetch("/api/community/creatives", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ headline: v.headline, primaryText: v.primaryText, cta: v.cta, angle: v.angle, score: v.score }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Could not share."); return; }
      setSharedKeys((s) => new Set(s).add(v.creativeId));
      await loadSwipe();
    } catch { setErr("Network error sharing the creative."); }
    finally { setSharingKey(""); }
  }, [loadSwipe]);

  const copySwipe = useCallback((c: SwipeCreative) => {
    const text = [c.headline, c.primaryText, c.cta ? `CTA: ${c.cta}` : ""].filter(Boolean).join("\n\n");
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(`sw${c.id}`); window.setTimeout(() => setCopied(""), 1500);
      // Bump the use counter (best-effort) and reflect it locally.
      void fetch(`/api/community/creatives?id=${encodeURIComponent(c.id)}`, { method: "PATCH", credentials: "include" }).catch(() => {});
      setSwipe((list) => list.map((x) => x.id === c.id ? { ...x, uses: x.uses + 1 } : x));
    });
  }, []);

  const unshareSwipe = useCallback(async (id: string) => {
    const ok = await confirmDialog({ title: "Unshare from the community?", message: "Other owners will no longer see this creative in the shared library. You can re-share it later.", confirmLabel: "Unshare", danger: true });
    if (!ok) return;
    setErr("");
    try {
      const r = await fetch(`/api/community/creatives?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) setSwipe((list) => list.filter((x) => x.id !== id)); // keep it on failure rather than lie it's unshared
      else { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Could not unshare — please try again."); }
    } catch { setErr("Network error — couldn't unshare the creative."); }
  }, []);

  const winningAngles = useMemo(() => angles.filter((a) => a.qualified > 0).slice(0, 5).map((a) => a.angle), [angles]);

  // Purely presentational: the tracked creative with the lowest cost per
  // qualified lead, so we can flag it as the winner — only once there are at
  // least two comparable creatives ("best of one" isn't a real result).
  const bestTrackedId = useMemo(() => {
    const contenders = tracked.filter((t) => t.qualified > 0 && t.costPerQualified > 0);
    if (contenders.length < 2) return null;
    return contenders.reduce((best, t) => (t.costPerQualified < best.costPerQualified ? t : best)).id;
  }, [tracked]);

  useEffect(() => {
    void fetch("/api/business/funnels", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { funnels: [] }))
      .then((d: { funnels?: FunnelLite[] }) => setFunnels(d.funnels ?? []))
      .catch(() => {});
    void loadTracked();
    void loadSwipe();
  }, [loadTracked, loadSwipe]);

  const saveTrack = useCallback(async (v: CreativeVariant) => {
    if (!slug) { setErr("Pick a funnel first so the tracked creative has a destination."); return; }
    setSavingKey(v.creativeId); setErr("");
    try {
      const r = await fetch("/api/campaign/creatives", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ funnelSlug: slug, creativeId: v.creativeId, angle: v.angle, headline: v.headline, primaryText: v.primaryText, cta: v.cta, score: v.score }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Could not save."); return; }
      setSavedKeys((s) => new Set(s).add(v.creativeId));
      await loadTracked();
    } catch { setErr("Network error saving the creative."); }
    finally { setSavingKey(""); }
  }, [slug, loadTracked]);

  // The workspace one-liner (from the Message step) — folded into the brief so
  // the AI creative starts from your core message, not a blank prompt.
  const [oneLiner, setOneLiner] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/business/message", { credentials: "include" });
        if (!r.ok) return;
        const m = await r.json();
        const o = (m?.oneLiner ?? {}) as { problem?: string; solution?: string; result?: string };
        const p = (o.problem ?? "").trim().replace(/[.]+$/, "");
        const s = (o.solution ?? "").trim().replace(/[.]+$/, "");
        const res = (o.result ?? "").trim().replace(/[.]+$/, "");
        if (p && s && res) setOneLiner(`${p}. ${s}, so ${res}.`);
      } catch { /* non-critical */ }
    })();
  }, []);

  const selected = useMemo(() => funnels.find((f) => f.slug === slug), [funnels, slug]);
  // Seed the brief from the chosen funnel (and your one-liner) so the page isn't
  // a blank prompt.
  useEffect(() => {
    if (selected && !brief.trim()) {
      const msg = oneLiner ? `Core message: ${oneLiner}\n` : "";
      setBrief(`${msg}Offer / funnel: ${selected.doc.title}\n${selected.doc.intro ?? ""}\nAudience: (describe your ideal customer)\nWhat makes it worth their time: `);
    }
  }, [selected, oneLiner]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    setErr(""); setCopied("");
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") { setErr("Connect an AI provider first — or use the included AI."); setAiOpen(true); return; }
    if (brief.trim().length < 12) { setErr("Add a short brief — what you're selling and to whom."); return; }
    setBusy(true); setVariants(null);
    try {
      const seed = useWinners ? winningAngles : [];
      const { system, user } = creativePrompt(brief, count, seed, hasBrand(brand) ? brandBrief(brand) : "", strategy?.has ? strategy.brief : "");
      const reply = await callAI(conn, system, user, 1800);
      const v = parseCreatives(reply);
      if (v.length === 0) { setErr("The model didn't return usable creative — try again or tweak the brief."); return; }
      setVariants(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed — check your AI connection.");
    } finally { setBusy(false); }
  }, [brief, count, useWinners, winningAngles, brand]);

  const setSpend = useCallback(async (id: string, spend: number) => {
    try {
      await fetch("/api/campaign/creatives", { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, spend }) });
      await loadTracked();
    } catch { /* ignore */ }
  }, [loadTracked]);

  const copy = useCallback((key: string, text: string) => {
    void copyText(text).then((ok) => { if (ok) { setCopied(key); window.setTimeout(() => setCopied(""), 1500); } });
  }, []);

  if (state !== "ok") {
    return (
      <div className="cs-root"><style>{CSS}</style>
        {state === "loading" && <div className="card" style={{ textAlign: "center", color: "var(--ds-text-tertiary)" }}>Loading…</div>}
        {state === "not-authenticated" && <Notice icon="🔑" title="Please sign in" body="You need to be signed in to use Creative Studio." href="/" cta="Go to sign in" />}
        {state === "not-enabled" && <Notice icon="✨" title="Campaign Studio isn't enabled here" body="It's included with the Performance plan, or available as an add-on for Pro / Business." />}
        {state === "forbidden" && <Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" />}
        {state === "error" && <Notice icon="⚠️" title="Something went wrong" body="We couldn't load Creative Studio." onRetry={() => void load()} />}
      </div>
    );
  }

  return (
    <div className="cs-root"><style>{CSS}</style>
      <div className="cs-header">
        <div>
          <div className="eyebrow">ONEVYRT · Creative Studio</div>
          <h1>Ad creative that feeds your funnel</h1>
          <p className="sub">Generate ranked ad angles with your own AI, each pre-linked to a qualification funnel — so every lead traces back to the exact creative.</p>
          <div style={{ marginTop: 8 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        </div>
        <button className="btn ghost" aria-expanded={aiOpen} aria-controls="ai-panel" onClick={() => setAiOpen((o) => !o)}><MarketingIcon name="gear" size={14} /> AI</button>
      </div>

      {aiOpen && <div className="card ai-panel" id="ai-panel"><AiConnectFields /></div>}

      <div className="card">
        <div className="cs-card-eyebrow" style={{ color: "var(--ds-info)" }}>
          <span className="cs-sec-icon" style={{ background: "var(--ds-info-soft)", color: "var(--ds-info)" }}><MarketingIcon name="pen" size={12} /></span>
          The brief
        </div>
        <p className="cs-sec-why">Tell the AI what you are selling, to whom, and why it is worth their time — the more specific the brief, the sharper the resulting angles.</p>
        <div className="row2">
          <label className="mini"><span>Point at funnel</span>
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">— pick a funnel —</option>
              {funnels.map((f) => <option key={f.slug} value={f.slug}>{f.doc.title} (/q/{f.slug})</option>)}
            </select>
          </label>
          <label className="mini"><span>Variants</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {funnels.length === 0 && (
          <div className="cs-callout cs-callout--warn">
            <MarketingIcon name="warning" size={14} />
            <span>No funnels yet — <a href="/business/funnels">build one first</a> so your creative has somewhere to send people.</span>
          </div>
        )}
        <label className="mini" style={{ marginTop: 10 }}><span>Brief</span>
          <textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What you're selling, to whom, and why it's worth their time." />
        </label>
        {winningAngles.length > 0 && (
          <label className="winners-toggle">
            <input type="checkbox" checked={useWinners} onChange={(e) => setUseWinners(e.target.checked)} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MarketingIcon name="spark" size={13} /> Bias toward my winning angles <em>({winningAngles.join(", ")})</em></span>
          </label>
        )}
        {err && <div className="err" role="alert"><MarketingIcon name="warning" size={14} /><span>{err}</span></div>}
        <button className="btn primary big" disabled={busy} onClick={() => void generate()}>
          {busy
            ? <><span className="mini-spin" aria-hidden="true" /> Generating…</>
            : <><MarketingIcon name="spark" size={14} /> {winningAngles.length > 0 && useWinners ? "Generate more like my winners" : "Generate ranked creative"}</>}
        </button>
      </div>

      {variants && (
        <div className="results">
          <div className="sec-title">
            <span className="cs-sec-icon" style={{ background: "var(--ds-brand-soft)", color: "var(--ds-brand-active)" }}><MarketingIcon name="spark" size={13} /></span>
            {variants.length} angles, best first
          </div>
          <p className="cs-sec-why">Each angle is scored out of 100 on how likely it is to convert for your offer — the top card is your best bet to test first.</p>
          {variants.map((v, i) => {
            const link = slug ? creativeLink(slug, v) : "";
            return (
              <div className={`cv ${i === 0 ? "top" : ""}`} key={v.creativeId}>
                <div className="cv-head">
                  <span className="cv-rank">#{i + 1}</span>
                  <span className="cv-angle">{v.angle}</span>
                  {i === 0 && <span className="ds-badge ds-badge--warning"><MarketingIcon name="trophy" size={12} /> Best bet</span>}
                  <span className="cv-score" title={v.why}><b className={i === 0 ? "ds-gradient-text" : undefined}>{v.score}</b>/100</span>
                </div>
                <div className="cv-scorebar"><span style={{ width: `${v.score}%` }} /></div>
                <div className="cv-headline">{v.headline}</div>
                <div className="cv-body">{v.primaryText}</div>
                <div className="cv-cta">CTA: <b>{v.cta}</b></div>
                {v.why && <div className="cv-why"><b>Why:</b> {v.why}</div>}
                <div className="cv-actions">
                  <button className={`btn sm ${savedKeys.has(v.creativeId) ? "success" : "primary"}`} disabled={!slug || savedKeys.has(v.creativeId) || savingKey === v.creativeId} onClick={() => void saveTrack(v)}>
                    {savedKeys.has(v.creativeId) ? "Tracking ✓" : savingKey === v.creativeId ? "Saving…" : <><MarketingIcon name="save" size={13} /> Save & track</>}
                  </button>
                  <button className={`btn sm ${copied === `h${i}` ? "success" : ""}`} onClick={() => copy(`h${i}`, `${v.headline}\n\n${v.primaryText}\n\n${v.cta}`)}>{copied === `h${i}` ? "Copied ✓" : "Copy ad"}</button>
                  <button className={`btn sm ${sharedKeys.has(v.creativeId) ? "success" : ""}`} disabled={sharedKeys.has(v.creativeId) || sharingKey === v.creativeId} onClick={() => void shareCreative(v)}>{sharedKeys.has(v.creativeId) ? "Shared ✓" : sharingKey === v.creativeId ? "Sharing…" : <><MarketingIcon name="cloud" size={13} /> Share</>}</button>
                  {link && <button className={`btn sm ${copied === `l${i}` ? "success" : ""}`} onClick={() => copy(`l${i}`, new URL(link, window.location.origin).toString())}>{copied === `l${i}` ? "Link copied ✓" : "Copy funnel link"}</button>}
                  {link && <a className="btn sm ghost" href={link} target="_blank" rel="noreferrer">Preview →</a>}
                </div>
              </div>
            );
          })}
          {!slug && (
            <div className="cs-callout cs-callout--warn">
              <MarketingIcon name="warning" size={14} />
              <span>Pick a funnel above and regenerate to attach tracked funnel links to each creative.</span>
            </div>
          )}
        </div>
      )}

      {angles.some((a) => a.leads > 0) && (
        <div className="winning">
          <div className="sec-title">
            <span className="cs-sec-icon" style={{ background: "var(--ds-warning-soft)", color: "var(--ds-warning)" }}><MarketingIcon name="trophy" size={13} /></span>
            What&rsquo;s winning — by angle
          </div>
          <p className="cs-sec-why">Rolled up from your tracked creatives below, ranked by qualify rate — lean into what is already converting.</p>
          <div className="wn-list">
            {angles.filter((a) => a.leads > 0).map((a, i) => (
              <div className={`wn-row ${i === 0 ? "top" : ""}`} key={a.angle}>
                <span className="wn-angle">{i === 0 && <span className="wn-crown" title="Best-performing angle" aria-label="Best-performing angle"><MarketingIcon name="trophy" size={11} /></span>}{a.angle}</span>
                <span className="wn-bar"><span style={{ width: `${Math.round(a.qualifyRate * 100)}%` }} /></span>
                <span className="wn-stat"><b>{Math.round(a.qualifyRate * 100)}%</b> qual · {a.qualified}/{a.leads}{a.costPerQualified > 0 ? <> · <b>{cac(a.costPerQualified)}</b>/qual</> : null}</span>
              </div>
            ))}
          </div>
          <div className="hint">Rolled up across your tracked creatives. Tick &ldquo;bias toward my winning angles&rdquo; above and regenerate to compound on what converts.</div>
        </div>
      )}

      {tracked.length > 0 && (
        <div className="tracked">
          <div className="sec-title">
            <span className="cs-sec-icon" style={{ background: "var(--ds-success-soft)", color: "var(--ds-success)" }}><MarketingIcon name="insights" size={13} /></span>
            Tracked creatives — real performance
          </div>
          <p className="cs-sec-why">Your tracked creatives, ranked by what they actually cost to earn a qualified lead.</p>
          <div className="tr-table">
            <div className="tr-row tr-head"><span>Creative</span><span>Spend</span><span>Leads</span><span>Qual.</span><span>Booked</span><span title="Cost per qualified lead">CAC/qual</span></div>
            {tracked.map((t) => (
              <div className="tr-row" key={t.id}>
                <span className="tr-hl">
                  <span className="cs-tr-hl-top">
                    <b>{t.headline}</b>
                    {bestTrackedId === t.id && <span className="ds-badge ds-badge--warning cs-badge-sm" title="Your lowest cost per qualified lead among tracked creatives"><MarketingIcon name="trophy" size={10} /> Best CAC</span>}
                  </span>
                  <em>{t.angle || "—"} · score {t.score} · /q/{t.funnelSlug}</em>
                </span>
                <span className="tr-spend"><i>$</i><input type="number" min="0" step="1" defaultValue={t.spend || ""} placeholder="0" aria-label={`Ad spend for ${t.headline}`}
                  onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== t.spend) void setSpend(t.id, v); }} /></span>
                <span>{t.leads}</span>
                <span className="tr-q">{t.qualified}{t.leads > 0 ? <em> {Math.round(t.qualifyRate * 100)}%</em> : null}</span>
                <span>{t.booked}</span>
                <span className="tr-cac">{cac(t.costPerQualified)}</span>
              </div>
            ))}
          </div>
          <div className="hint">Enter what you spent on each ad — CAC (cost per qualified lead) is computed live against the qualified leads its tracked link produced.</div>
        </div>
      )}

      <div className="swipe">
        <div className="sec-title">
          <span className="cs-sec-icon" style={{ background: "var(--ds-info-soft)", color: "var(--ds-info)" }}><MarketingIcon name="community" size={13} /></span>
          Community swipe file
        </div>
        <p className="cs-sec-why">In direct-response marketing, a &ldquo;swipe file&rdquo; is a stash of ad copy that already works — borrow an angle below, or share one of yours above.</p>
        {swipe.length === 0
          ? (
            <div className="cs-callout cs-callout--info">
              <MarketingIcon name="community" size={14} />
              <span>No shared creatives yet. Generate some above and hit <b>Share</b> to seed the swipe file — and copy what other owners have shared.</span>
            </div>
          )
          : <div className="sw-list">
              {swipe.map((c) => (
                <div className="sw-card" key={c.id}>
                  {c.mine && <button className="sw-unpub" title="Unpublish" aria-label="Unshare this creative from the community" onClick={() => void unshareSwipe(c.id)}><MarketingIcon name="trash" size={11} /></button>}
                  <div className="sw-meta">
                    <span className="ds-badge ds-badge--brand cs-badge-sm">{c.angle || "Ad"}</span>
                    <span>by {c.mine ? "you" : (c.authorName || "an owner")} · {c.uses} copie{c.uses === 1 ? "" : "s"}</span>
                  </div>
                  <div className="sw-headline">{c.headline}</div>
                  {c.primaryText && <div className="sw-body">{c.primaryText}</div>}
                  {c.cta && <div className="sw-cta">CTA: <b>{c.cta}</b></div>}
                  <button className={`btn sm ${copied === `sw${c.id}` ? "success" : ""}`} onClick={() => copySwipe(c)}>{copied === `sw${c.id}` ? "Copied ✓" : "Copy ad"}</button>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

// Page-specific layout only. Local custom properties (--surface, --text, etc.)
// are aliases onto the shared design-system tokens (app/design-system.css) —
// not hardcoded hex — so this page follows the light/navy-dark theme switch
// automatically; a separate [data-theme="dark"] override block is no longer
// needed here. New chrome (callouts, section icons, badges) draws from the
// same --ds-* tokens: info=explain, warning=attention/winner, success=real
// performance, brand=primary action, danger=destructive.
const CSS = `
.cs-root{--surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--bg:var(--ds-bg-app);
  max-width:760px;margin:0 auto;padding:24px 18px 120px;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border-radius:16px;}
.cs-root *{box-sizing:border-box;}
.cs-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.cs-header h1{font-size:24px;font-weight:700;margin:2px 0 5px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:60ch;line-height:1.5;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:10px;padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s,box-shadow .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.btn:disabled{opacity:.55;cursor:default;}
.btn:disabled:hover,.btn[disabled]:hover{transform:none;box-shadow:none;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.big{width:100%;justify-content:center;font-size:14px;padding:12px;margin-top:12px;}
.btn.sm{padding:6px 11px;font-size:12px;border-radius:8px;}
.btn.success,.btn.sm.success{background:var(--ds-success-soft);border-color:transparent;color:var(--ds-success);}
.mini-spin{width:13px;height:13px;display:inline-block;border:2px solid rgba(255,255,255,.35);border-top-color:currentColor;border-radius:50%;animation:cs-spin .7s linear infinite;flex:0 0 auto;}
@keyframes cs-spin{to{transform:rotate(360deg);}}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.ai-panel{display:flex;flex-direction:column;gap:8px;animation:cs-panel-in .2s ease both;}
@keyframes cs-panel-in{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.cs-card-eyebrow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;}
.cs-sec-why{font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 12px;max-width:64ch;}
.cs-sec-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:7px;flex:0 0 auto;}
.row2{display:grid;grid-template-columns:1fr 100px;gap:10px;}
.mini{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:500;color:var(--muted);}
.mini select,.mini input,.mini textarea{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;width:100%;transition:border-color .15s,box-shadow .15s;}
.mini textarea{resize:vertical;line-height:1.5;}
.mini select:hover,.mini input:hover,.mini textarea:hover{border-color:var(--ds-border-strong);}
.mini select:focus,.mini input:focus,.mini textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.cs-callout{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:10px;font-size:12.5px;line-height:1.5;margin-top:10px;color:var(--muted);}
.cs-callout svg{flex:0 0 auto;margin-top:1px;}
.cs-callout>span{flex:1;min-width:0;}
.cs-callout--warn{background:var(--ds-warning-soft);}
.cs-callout--warn svg{color:var(--ds-warning);}
.cs-callout--warn a{color:var(--ds-warning);font-weight:600;}
.cs-callout--info{background:var(--ds-info-soft);}
.cs-callout--info svg{color:var(--ds-info);}
.cs-callout--info b{color:var(--ds-info);}
.hint{font-size:12.5px;color:var(--ds-text-tertiary);margin-top:8px;line-height:1.5;}
.hint a{color:var(--ds-brand);font-weight:500;}
.err{display:flex;align-items:flex-start;gap:8px;background:var(--ds-danger-soft);color:var(--ds-danger);font-size:13px;font-weight:500;margin-top:10px;padding:9px 12px;border-radius:10px;line-height:1.45;}
.err svg{flex:0 0 auto;margin-top:1px;}
.err>span{flex:1;min-width:0;}
.sec-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin:4px 0 6px;}
.results{margin-top:6px;}
@keyframes cs-item-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes cs-fill{from{transform:scaleX(0);}to{transform:scaleX(1);}}
.cv{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:15px 16px;box-shadow:var(--ds-shadow-xs);margin-bottom:10px;transition:transform .15s ease,box-shadow .15s ease;animation:cs-item-in .3s ease both;}
.cv:hover{transform:translateY(-2px);box-shadow:var(--ds-shadow-md);}
.cv:nth-child(2){animation-delay:40ms;}.cv:nth-child(3){animation-delay:80ms;}.cv:nth-child(4){animation-delay:120ms;}.cv:nth-child(5){animation-delay:160ms;}.cv:nth-child(6){animation-delay:200ms;}
.cv.top{border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-sm),0 10px 22px -10px var(--ds-brand-soft);}
.cv.top:hover{box-shadow:0 0 0 1px var(--ds-brand),var(--ds-shadow-md),0 14px 26px -10px var(--ds-brand-soft);}
.cv-head{display:flex;align-items:center;gap:9px;margin-bottom:8px;flex-wrap:wrap;}
.cv-rank{font-size:12px;font-weight:700;color:var(--ds-brand-contrast);background:var(--ds-brand);border-radius:6px;padding:2px 7px;}
.cv-angle{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);}
.cv-score{margin-left:auto;font-size:12px;color:var(--muted);}
.cv-score b{font-size:16px;color:var(--text);}
.cv-scorebar{height:5px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;margin-bottom:11px;}
.cv-scorebar span{display:block;height:100%;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));border-radius:99px;transform-origin:left;animation:cs-fill .8s ease both;}
.cv-headline{font-size:17px;font-weight:700;letter-spacing:-.2px;line-height:1.25;margin-bottom:6px;}
.cv-body{font-size:14px;color:var(--muted);line-height:1.5;white-space:pre-wrap;margin-bottom:8px;}
.cv-cta{font-size:12.5px;color:var(--muted);}.cv-cta b{color:var(--text);}
.cv-why{display:flex;gap:6px;font-size:12px;color:var(--muted);margin-top:8px;padding:7px 10px;background:var(--ds-info-soft);border-radius:8px;line-height:1.5;}
.cv-why b{color:var(--ds-info);font-weight:700;flex:0 0 auto;}
.cv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.btn.sm.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.sm.primary:hover{background:var(--ds-brand-hover);}
.winners-toggle{display:flex;align-items:center;gap:8px;margin-top:12px;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--ds-bg-subtle);font-size:13px;font-weight:500;color:var(--text);cursor:pointer;transition:background .15s,border-color .15s;}
.winners-toggle:hover{border-color:var(--ds-border-strong);}
.winners-toggle:has(input:checked){background:var(--ds-brand-soft);border-color:var(--ds-brand);}
.winners-toggle input{width:auto;accent-color:var(--ds-brand);}
.winners-toggle em{font-style:normal;font-weight:500;color:var(--ds-text-tertiary);}
.winners-toggle:has(input:checked) em{color:var(--ds-brand-active);}
.winning{margin-top:26px;}
.wn-list{display:flex;flex-direction:column;gap:6px;}
.wn-row{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 13px;font-size:13px;transition:border-color .15s,box-shadow .15s;}
.wn-row:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-xs);}
.wn-row.top{border-color:var(--ds-brand);box-shadow:0 0 0 1px var(--ds-brand);}
.wn-angle{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wn-crown{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--ds-warning-soft);color:var(--ds-warning);margin-right:5px;vertical-align:-4px;}
.wn-bar{height:8px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;}
.wn-bar span{display:block;height:100%;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));border-radius:99px;transform-origin:left;animation:cs-fill .8s ease both;}
.wn-stat{font-size:11.5px;color:var(--ds-text-tertiary);white-space:nowrap;}
.wn-stat b{color:var(--ds-brand);font-size:13px;}
.tracked{margin-top:26px;}
.tr-table{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);}
.tr-row{display:grid;grid-template-columns:1fr 74px 46px 60px 52px 56px;gap:8px;align-items:center;padding:10px 13px;border-bottom:1px solid var(--border);font-size:13px;transition:background .15s;}
.tr-row:last-child{border-bottom:none;}
.tr-row:not(.tr-head):hover{background:var(--ds-bg-subtle);}
.tr-row span:not(.tr-hl):not(.tr-spend){text-align:right;font-variant-numeric:tabular-nums;}
.tr-head{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:700;background:var(--bg);}
.tr-head span:not(.tr-hl){text-align:right;}
.tr-hl{display:flex;flex-direction:column;min-width:0;}
.cs-tr-hl-top{display:flex;align-items:center;gap:6px;min-width:0;}
.tr-hl b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.tr-hl em{font-size:11px;color:var(--ds-text-tertiary);font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tr-spend{display:flex;align-items:center;gap:2px;}
.tr-spend i{font-style:normal;color:var(--ds-text-disabled);font-size:12px;}
.tr-spend input{width:100%;min-width:0;font:inherit;font-size:12.5px;padding:4px 6px;border:1px solid var(--border-strong);border-radius:7px;background:var(--surface);color:var(--text);text-align:right;transition:border-color .15s,box-shadow .15s;}
.tr-spend input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.tr-q{color:var(--ds-brand);font-weight:700;}
.tr-q em{font-style:normal;font-size:11px;color:var(--ds-text-tertiary);font-weight:500;}
.tr-cac{font-weight:700;color:var(--text);}
.cs-badge-sm{height:18px;padding:0 7px;font-size:10px;gap:3px;flex:0 0 auto;white-space:nowrap;}
.swipe{margin-top:26px;}
.sw-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;}
.sw-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;gap:7px;transition:transform .15s ease,box-shadow .15s ease;animation:cs-item-in .3s ease both;}
.sw-card:hover{transform:translateY(-2px);box-shadow:var(--ds-shadow-md);}
.sw-card:nth-child(2){animation-delay:40ms;}.sw-card:nth-child(3){animation-delay:80ms;}.sw-card:nth-child(4){animation-delay:120ms;}.sw-card:nth-child(5){animation-delay:160ms;}.sw-card:nth-child(6){animation-delay:200ms;}
.sw-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--ds-text-tertiary);}
.sw-headline{font-size:15px;font-weight:700;letter-spacing:-.2px;line-height:1.3;}
.sw-body{font-size:13px;color:var(--muted);line-height:1.5;white-space:pre-wrap;}
.sw-cta{font-size:12px;color:var(--muted);}.sw-cta b{color:var(--text);}
.sw-card .btn.sm{align-self:flex-start;margin-top:auto;}
.sw-unpub{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;border:1px solid var(--border-strong);background:var(--surface);color:var(--ds-danger);cursor:pointer;display:grid;place-items:center;line-height:1;transition:background .15s,border-color .15s,transform .15s;}
.sw-unpub:hover{background:var(--ds-danger-soft);border-color:var(--ds-danger);transform:scale(1.08);}
/* Motion is handled site-wide by globals.css (every transition/animation is
   collapsed under prefers-reduced-motion except .spinner/.mini-spin, which
   keep turning on purpose so a loading state never reads as "stuck"). Our
   .mini-spin above reuses that exact exemption, so no local override is
   needed here. */
`;
