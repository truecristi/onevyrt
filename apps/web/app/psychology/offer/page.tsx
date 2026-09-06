"use client";
/**
 * Offer & positioning coach — the "Positioning & Offer" area of the Psychology
 * pillar. Shape a named offer with a specific promise, a value stack, price
 * framing, a guarantee and answered objections; a live strength score keeps it
 * honest, and AI can draft a first version from the saved Message. Saved to the
 * workspace_business `offer` section (lib/offer.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { useToast } from "../../../components/Toast";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { EMPTY_OFFER, scoreOffer, OFFER_DRAFT_SYSTEM, buildOfferDraftPrompt, parseOfferDraft, OBJECTIONS_SYSTEM, buildObjectionsPrompt, parseObjections, composePositioning, scorePositioning, POSITIONING_SYSTEM, buildPositioningPrompt, parsePositioning, type OfferData } from "../../../lib/studio/offer-coach";
import { offerAssets } from "../../../lib/studio/platform-export";
import ExportPanel from "../../../components/ExportPanel";
import Explain from "../../../components/Explain";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import type { MessageInput } from "../../../lib/studio/message-copy";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { RecentExperiments } from "../../../components/studio/RecentExperiments";

export default function OfferCoachPage() {
  const toast = useToast();
  const [offer, setOffer] = useState<OfferData>(EMPTY_OFFER);
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [objBusy, setObjBusy] = useState(false);
  const [posBusy, setPosBusy] = useState(false);
  // True right after "Draft with AI" fills the offer / positioning fields —
  // content the user hasn't reviewed or written a word of yet, even though the
  // strength score updates on it immediately. Cleared the moment they edit any
  // field in that section (they've now looked at it) or save (they've accepted
  // it), so it never lingers as a stale banner on content that's actually theirs.
  const [offerDraftPending, setOfferDraftPending] = useState(false);
  const [positioningDraftPending, setPositioningDraftPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ro, rm] = await Promise.all([
        fetch("/api/business/offer", { credentials: "include" }),
        fetch("/api/business/message", { credentials: "include" }),
      ]);
      if (ro.status === 401) { setState("not-authenticated"); return; }
      if (!ro.ok) { setState("error"); return; }
      const o = (await ro.json()) as OfferData;
      setOffer({ ...EMPTY_OFFER, ...o, deliverables: o.deliverables ?? [], objections: o.objections ?? [] });
      if (rm.ok) setMsg((await rm.json()) as MessageInput);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []);

  const health = useMemo(() => scoreOffer(offer), [offer]);
  const tone = !health.started ? "none" : health.score >= 80 ? "good" : health.score >= 50 ? "warn" : "bad";
  const positioning = useMemo(() => scorePositioning(offer), [offer]);
  const positioningLine = useMemo(() => composePositioning(offer), [offer]);

  // A live, plain-language checklist of the parts that make up an offer — purely
  // derived from what's already typed, so it guides without changing behaviour.
  // Each chip jumps to the card that owns that part.
  const steps = useMemo(() => {
    const deliv = offer.deliverables.filter((d) => d.trim()).length;
    const objs = offer.objections.filter((o) => o.q.trim()).length;
    return [
      { key: "name", label: "Name", done: !!offer.name.trim(), href: "#offer-core" },
      { key: "promise", label: "Promise", done: !!offer.promise.trim(), href: "#offer-core" },
      { key: "positioning", label: "Positioning", done: positioning.started, href: "#offer-positioning" },
      { key: "stack", label: "Value stack", done: deliv >= 1, href: "#offer-includes" },
      { key: "price", label: "Price", done: !!offer.price.trim(), href: "#offer-price" },
      { key: "guarantee", label: "Guarantee", done: !!offer.guarantee.trim(), href: "#offer-price" },
      { key: "objections", label: "Objections", done: objs >= 1, href: "#offer-objections" },
    ];
  }, [offer, positioning.started]);
  const stepsDone = steps.filter((s) => s.done).length;

  const POSITIONING_KEYS = new Set(["audience", "alternative", "edge"]);
  const set = <K extends keyof OfferData>(k: K, v: OfferData[K]) => {
    setSaved(false);
    setOffer((o) => ({ ...o, [k]: v }));
    // Editing a field is the user reviewing it — the "unreviewed AI draft"
    // banner for that section no longer applies once they've touched it.
    if (POSITIONING_KEYS.has(k as string)) setPositioningDraftPending(false);
    else setOfferDraftPending(false);
  };
  // Live mirror of the offer for async handlers: a callAI round-trip takes
  // seconds, and reading the click-time `offer` closure there would merge
  // against a stale snapshot (dropping edits made while waiting).
  const offerLive = useRef(offer);
  useEffect(() => { offerLive.current = offer; }, [offer]);
  const setDeliv = (i: number, v: string) => set("deliverables", offer.deliverables.map((d, j) => (j === i ? v : d)));
  const addDeliv = () => set("deliverables", [...offer.deliverables, ""]);
  const rmDeliv = (i: number) => set("deliverables", offer.deliverables.filter((_, j) => j !== i));
  const setObj = (i: number, key: "q" | "a", v: string) => set("objections", offer.objections.map((o, j) => (j === i ? { ...o, [key]: v } : o)));
  const addObj = () => set("objections", [...offer.objections, { q: "", a: "" }]);
  const rmObj = (i: number) => set("objections", offer.objections.filter((_, j) => j !== i));

  // Brand + strategy context spliced into every AI prompt below, so the draft,
  // objections and positioning all write in the saved Brand Brain's voice.
  const groundingCtx = [hasBrand(brand) && `BRAND:\n${brandBrief(brand)}`, strategy?.has ? strategy.brief : ""].filter(Boolean).join("\n");

  const draftWithAI = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setAiBusy(true);
    try {
      const reply = await callAI(conn, OFFER_DRAFT_SYSTEM, buildOfferDraftPrompt(msg, groundingCtx), 900);
      const draft = parseOfferDraft(reply);
      if (!draft) { toast("The model didn't return a usable offer — try again.", "error"); return; }
      // The draft prompt fills the offer fields but NOT positioning
      // (audience / alternative / edge — those have their own "Draft with AI"
      // button). Preserve whatever the user already wrote there so drafting the
      // offer never silently wipes their positioning work.
      setOffer((o) => ({ ...EMPTY_OFFER, ...draft, audience: o.audience, alternative: o.alternative, edge: o.edge }));
      setSaved(false);
      setOfferDraftPending(true);
      toast("Drafted an offer from your Message — tune it and save.");
    } catch (e) { toast(e instanceof Error ? e.message : "Draft failed — check your AI connection.", "error"); }
    finally { setAiBusy(false); }
  };

  // AI-suggest the objections most likely to stop this sale, with answers.
  const suggestObjections = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setObjBusy(true);
    try {
      const reply = await callAI(conn, OBJECTIONS_SYSTEM, buildObjectionsPrompt(offer, msg, groundingCtx), 700);
      const objs = parseObjections(reply);
      if (objs.length === 0) { toast("The model didn't return usable objections — try again.", "error"); return; }
      // Append any that aren't already present (by question), keeping the user's
      // own. Read the LIVE objections (via ref), not the click-time closure —
      // the AI round-trip takes seconds and the inputs stay editable, so the
      // stale snapshot would silently revert anything typed meanwhile.
      const cur = offerLive.current.objections;
      const have = new Set(cur.map((x) => x.q.trim().toLowerCase()).filter(Boolean));
      const fresh = objs.filter((x) => !have.has(x.q.trim().toLowerCase()));
      if (fresh.length === 0) { toast("Those objections are already covered in your list."); return; }
      // Write via setOffer directly, not the set() helper — set() clears the
      // draft-pending banner on every edit (that's for the user's own typing),
      // and this write is the AI's, not theirs.
      setOffer((o) => ({ ...o, objections: [...cur.filter((x) => x.q.trim() || x.a.trim()), ...fresh] }));
      setSaved(false);
      setOfferDraftPending(true);
      toast(`Added ${fresh.length} objection${fresh.length === 1 ? "" : "s"} — edit any in your own words.`);
    } catch (e) { toast(e instanceof Error ? e.message : "Suggest failed — check your AI connection.", "error"); }
    finally { setObjBusy(false); }
  };

  // AI-draft the positioning (audience / alternative / edge) from offer + message.
  const draftPositioning = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setPosBusy(true);
    try {
      const reply = await callAI(conn, POSITIONING_SYSTEM, buildPositioningPrompt(offer, msg, groundingCtx), 500);
      const p = parsePositioning(reply);
      if (!p) { toast("The model didn't return usable positioning — try again.", "error"); return; }
      setSaved(false);
      setOffer((o) => ({ ...o, audience: p.audience || o.audience, alternative: p.alternative || o.alternative, edge: p.edge || o.edge }));
      setPositioningDraftPending(true);
      toast("Drafted your positioning — sharpen it in your own words.");
    } catch (e) { toast(e instanceof Error ? e.message : "Draft failed — check your AI connection.", "error"); }
    finally { setPosBusy(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/business/offer", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(offer) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast((d as { error?: string }).error || "Could not save.", "error"); setSaving(false); return; }
      setOffer((o) => ({ ...o, updatedAt: (d as OfferData).updatedAt })); setSaved(true); setSaving(false);
      // Saving is an explicit "I've reviewed this" action, whatever's in the
      // form right now — clear both draft-pending banners.
      setOfferDraftPending(false); setPositioningDraftPending(false);
      toast("Offer saved.");
    } catch { toast("Network error — please try again.", "error"); setSaving(false); }
  };

  if (state === "loading") return <Shell><div className="card sk" /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load your offer" onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">PSYCHOLOGY · POSITIONING &amp; OFFER</div>
          <h1>Make an offer they can&rsquo;t ignore</h1>
          <p className="sub">A named offer with a specific promise, a stacked value, framed price, a guarantee and the objections answered up front. This is the <b>what</b> you sell — <a href="/business">the break-even math</a> lives in Numbers.</p>
        </div>
        <div className={`score s-${tone}`} role="img" aria-label={health.started ? `Offer strength ${health.score} out of 100` : "Offer not started yet"}>
          <div className="score-n">{health.started ? health.score : "—"}</div>
          <div className="score-l">{health.started ? "Offer strength" : "Not started"}</div>
        </div>
      </div>

      <RecentExperiments />

      {/* Guided build tracker — shows every part of an offer, what's done, and
          jumps you to whatever's still empty. */}
      <div className="build-steps" aria-label="Offer build progress">
        <div className="bs-top">
          <span className="bs-title">Build it part by part</span>
          <span className="bs-count">{stepsDone === steps.length ? "All parts filled — polish & save" : `${stepsDone} of ${steps.length} parts filled in`}</span>
        </div>
        <div className="bs-bar" role="progressbar" aria-valuenow={stepsDone} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Offer completeness">
          <span style={{ width: `${Math.round((stepsDone / steps.length) * 100)}%` }} />
        </div>
        <div className="bs-chips">
          {steps.map((s) => (
            <a key={s.key} href={s.href} className={`bs-chip${s.done ? " done" : ""}`} aria-label={`${s.label} — ${s.done ? "done" : "not started"}, go to section`}>
              <span className="bs-mark" aria-hidden="true">{s.done ? "✓" : ""}</span>{s.label}
            </a>
          ))}
        </div>
      </div>

      <AIStatus />

      <WorkedExample id="offer" onUse={(ex) => {
        const p = ex.prefill as Partial<OfferData> | undefined;
        if (p) setOffer((o) => ({ ...o, ...p }));
      }} />

      {/* AI draft — one grounding indicator here covers all three "Draft/Suggest
          with AI" buttons on this page (offer, positioning, objections): they
          all pull the same Brand Brain voice and Business-OS strategy brief
          into their prompts. */}
      <div className="card aidraft">
        <div className="card-h"><MarketingIcon name="spark" size={15} /> Draft an offer from your Message <span className="hint">Optional — we fill every field, you refine</span></div>
        <div style={{ marginBottom: 11 }}><GroundingChips brand={hasBrand(brand)} strategy={strategy?.has ?? false} /></div>
        <button className="btn primary" disabled={aiBusy} onClick={() => void draftWithAI()}>{aiBusy ? "Drafting…" : "Draft with AI"}</button>
      </div>

      {offerDraftPending && (
        <div className="draft-pending"><b>AI draft</b> Not yet reviewed — read it over and put it in your own words, then save.</div>
      )}

      <div className="card" id="offer-core">
        <div className="card-h">The core <span className="hint">Name it, then promise one specific result they walk away with</span></div>
        <label className="fld"><span>Offer name <em>a confident, specific name</em></span>
          <input value={offer.name} onChange={(e) => set("name", e.target.value)} placeholder="The Funnel Fix Sprint" />
        </label>
        <label className="fld"><span>The promise <Explain term="Promise" /> <em>the outcome they walk away with</em></span>
          <textarea rows={2} value={offer.promise} onChange={(e) => set("promise", e.target.value)} placeholder="A funnel that turns cold traffic into booked calls in 14 days" />
        </label>
      </div>

      {/* Positioning */}
      <WorkedExample id="positioning" />
      {positioningDraftPending && (
        <div className="draft-pending"><b>AI draft</b> Not yet reviewed — sharpen it in your own words, then save.</div>
      )}
      <div className="card" id="offer-positioning">
        <div className="card-h">Positioning <Explain term="Positioning" /> <span className="hint">Who it&rsquo;s for, and why you over the alternative</span>
          <span className={`pos-score s-${!positioning.started ? "none" : positioning.score >= 80 ? "good" : positioning.score >= 50 ? "warn" : "bad"}`}>{positioning.started ? positioning.score : "Not started"}</span>
          <button type="button" className="mini-ai" disabled={posBusy} onClick={() => void draftPositioning()}><MarketingIcon name="spark" size={12} /> {posBusy ? "Thinking…" : "Draft with AI"}</button>
        </div>
        <label className="fld"><span>Who it&rsquo;s for <em>the specific buyer</em></span>
          <input value={offer.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Coaches doing $5–20k/mo who want more booked calls" />
        </label>
        <div className="grid2">
          <label className="fld"><span>The alternative <em>what they&rsquo;d otherwise do</em></span>
            <input value={offer.alternative} onChange={(e) => set("alternative", e.target.value)} placeholder="hiring an agency on retainer" />
          </label>
          <label className="fld"><span>Your edge <em>why you beat it</em></span>
            <input value={offer.edge} onChange={(e) => set("edge", e.target.value)} placeholder="we score & simulate the funnel before you spend" />
          </label>
        </div>
        {positioningLine && (
          <div className="pos-line"><span className="pos-line-tag">Your positioning</span><p>{positioningLine}</p></div>
        )}
      </div>

      <div className="card" id="offer-includes">
        <div className="card-h">What&rsquo;s included <Explain term="Deliverables" /> <span className="hint">The value stack — aim for 3+</span></div>
        {offer.deliverables.length === 0 && (
          <div className="empty">No deliverables yet — list everything they get so the value stacks up and the price feels small next to it.</div>
        )}
        {offer.deliverables.map((d, i) => (
          <div className="row" key={i}>
            <input value={d} onChange={(e) => setDeliv(i, e.target.value)} placeholder={`Deliverable ${i + 1}`} aria-label={`Deliverable ${i + 1}`} />
            <button className="row-x" onClick={() => rmDeliv(i)} aria-label="Remove">✕</button>
          </div>
        ))}
        <button className="btn" onClick={addDeliv}>+ Add deliverable</button>
      </div>

      <div className="card" id="offer-price">
        <div className="card-h">Price &amp; framing <span className="hint">Set the price, anchor it to a bigger number, then reverse the risk</span></div>
        <div className="grid2">
          <label className="fld"><span>Price</span>
            <input value={offer.price} onChange={(e) => set("price", e.target.value)} placeholder="$2,000" />
          </label>
          <label className="fld"><span>Anchor <Explain term="Price anchor" /> <em>what it&rsquo;s worth / would cost otherwise</em></span>
            <input value={offer.priceAnchor} onChange={(e) => set("priceAnchor", e.target.value)} placeholder="Agencies charge $8k+ for the same build" />
          </label>
        </div>
        <label className="fld"><span>Guarantee <Explain term="Guarantee" /> <em>reverse the risk</em></span>
          <textarea rows={2} value={offer.guarantee} onChange={(e) => set("guarantee", e.target.value)} placeholder="Booked calls in 30 days or your money back" />
        </label>
      </div>

      <WorkedExample id="objections" />
      <div className="card" id="offer-objections">
        <div className="card-h">Objections, answered <Explain term="Objection" /> <span className="hint">Beat the top 2–3 before they&rsquo;re asked</span>
          <button type="button" className="mini-ai" style={{ marginLeft: "auto" }} disabled={objBusy} onClick={() => void suggestObjections()}><MarketingIcon name="spark" size={12} /> {objBusy ? "Thinking…" : "Suggest with AI"}</button>
        </div>
        {offer.objections.length === 0 && (
          <div className="empty">No objections listed — name the doubts that stop the sale (&ldquo;too expensive&rdquo;, &ldquo;no time&rdquo;) and dissolve each one here.</div>
        )}
        {offer.objections.map((o, i) => (
          <div className="obj" key={i}>
            <div className="obj-top"><input className="obj-q" value={o.q} onChange={(e) => setObj(i, "q", e.target.value)} placeholder="“I've tried funnels before…”" aria-label={`Objection ${i + 1}`} /><button className="row-x" onClick={() => rmObj(i)} aria-label="Remove objection">✕</button></div>
            <textarea className="obj-a" rows={2} value={o.a} onChange={(e) => setObj(i, "a", e.target.value)} placeholder="Your answer that dissolves it" aria-label={`Answer to objection ${i + 1}`} />
          </div>
        ))}
        <button className="btn" onClick={addObj}>+ Add objection</button>
      </div>

      {/* Coaching findings */}
      <div className="card">
        <div className="card-h">Make it stronger <span className="hint">Live coaching as you type — clear the red flags first</span></div>
        {health.findings.length === 0 ? (
          <div className="empty">{health.started ? "Looking sharp — nothing flagged right now." : "Start filling in the parts above and specific coaching notes will show up here."}</div>
        ) : (
          <ul className="findings">
            {health.findings.map((f) => (
              <li className={`finding sev-${f.severity}`} key={f.id}><span className="fd-dot" /><span className="fd-area">{f.area}</span><span className="fd-msg">{f.message}</span></li>
            ))}
          </ul>
        )}
      </div>

      {/* Turn the offer into sales-page copy for your own platform */}
      <ExportPanel
        title="Turn this into a sales page"
        subtitle="You wrote the offer here — copy each block (or the whole page) into WordPress, GoHighLevel, Shopify and the rest."
        assets={offerAssets({
          name: offer.name,
          promise: offer.promise,
          deliverables: offer.deliverables,
          price: offer.price,
          priceAnchor: offer.priceAnchor,
          guarantee: offer.guarantee,
          objections: offer.objections,
          positioning: positioningLine,
        })}
      />

      <div className="savebar">
        {saved && <div className="ok">Saved.</div>}
        <button className="btn primary" style={{ marginLeft: "auto" }} disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save offer"}</button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="offer-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.offer-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-border-strong:#cbd5e1;
  --ds-danger-soft:#fef2f2;
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  scroll-behavior:smooth;
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .offer-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-danger-soft:#3a1414;--ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.offer-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:25px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:66ch;line-height:1.55;}
.sub b{color:var(--text);font-weight:700;} .sub a{color:var(--ds-brand-hover);}
.score{flex:0 0 auto;text-align:center;border:2px solid;border-radius:14px;padding:10px 18px;}
.score.s-good{border-color:var(--ds-success);color:var(--ds-success);background:var(--ds-success-soft);}
.score.s-warn{border-color:var(--ds-warning);color:var(--ds-warning);background:var(--ds-warning-soft);}
.score.s-bad{border-color:var(--ds-danger);color:var(--ds-danger);background:var(--ds-danger-soft);}
/* Not started is neutral, not a problem — red is reserved for an actual issue. */
.score.s-none{border-color:var(--ds-border-default,#dde3eb);color:var(--ds-text-tertiary,#64748b);background:var(--ds-bg-subtle,#f1f4f9);}
.score-n{font-size:28px;font-weight:700;line-height:1;letter-spacing:-1px;}
.score-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px;opacity:.85;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;scroll-margin-top:16px;}
.card.sk{height:220px;}
.card-h{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.aidraft .card-h svg{color:var(--ds-brand);}
.mini-ai{display:inline-flex;align-items:center;gap:4px;background:var(--ds-brand-soft);color:var(--ds-brand);border:1px solid transparent;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,filter .15s ease;}
.mini-ai:hover{filter:brightness(.98);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);border-color:var(--ds-brand);}
.mini-ai:active{transform:translateY(0);box-shadow:none;}
.mini-ai:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.mini-ai:disabled{opacity:.6;cursor:default;transform:none;box-shadow:none;}
.mini-ai svg{color:var(--ds-brand);}
.hint{font-size:11.5px;font-weight:500;color:var(--ds-text-tertiary);}
/* Informational — this is real content sitting in the form, not yet reviewed;
   it's not a problem, so it stays blue, not amber/red. */
.draft-pending{display:flex;align-items:center;gap:9px;background:var(--ds-info-soft);border:1px solid var(--ds-info-soft);border-left:3px solid var(--ds-info);color:var(--ds-info);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;margin:-2px 0 14px;}
.draft-pending b{flex:0 0 auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:var(--ds-info);color:var(--ds-surface);border-radius:6px;padding:2px 7px;}
.fld{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;font-size:12.5px;font-weight:500;color:var(--muted);}
.fld:last-child{margin-bottom:0;}
.fld em{font-weight:500;color:var(--ds-text-tertiary);font-style:normal;}
.fld input,.fld textarea,.row input,.obj input,.obj textarea{font-family:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;width:100%;resize:vertical;line-height:1.5;transition:border-color .15s var(--ds-ease,ease),box-shadow .15s var(--ds-ease,ease);}
.fld input::placeholder,.row input::placeholder,.obj input::placeholder,.obj textarea::placeholder,.fld textarea::placeholder{color:var(--ds-text-disabled);}
.fld input:hover,.fld textarea:hover,.row input:hover,.obj input:hover,.obj textarea:hover{border-color:var(--ds-brand);}
.fld input:focus,.fld textarea:focus,.row input:focus,.obj input:focus,.obj textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}
@media(max-width:560px){.grid2{grid-template-columns:1fr;}}
.pos-score{font-size:12px;font-weight:700;border-radius:20px;padding:2px 9px;line-height:1.4;}
.pos-score.s-good{background:var(--ds-success-soft);color:var(--ds-success);}
.pos-score.s-warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.pos-score.s-bad{background:var(--ds-danger-soft);color:var(--ds-danger);}
.pos-score.s-none{background:var(--ds-bg-subtle,#f1f4f9);color:var(--ds-text-tertiary,#64748b);}
.card-h .pos-score{margin-left:auto;}
.pos-line{margin-top:6px;background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-radius:10px;padding:11px 13px;}
.pos-line-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand);}
.pos-line p{margin:5px 0 0;font-size:14.5px;font-weight:500;line-height:1.5;color:var(--text);}
.row{display:flex;gap:8px;align-items:center;margin-bottom:8px;}
.obj{border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:10px;background:var(--ds-surface-subtle);}
.obj-top{display:flex;gap:8px;align-items:center;margin-bottom:7px;}
.obj-q{font-weight:500;}
.row-x{flex:0 0 auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--ds-text-tertiary);cursor:pointer;font-size:12px;transition:color .15s ease,border-color .15s ease,background .15s ease;}
.row-x:hover{color:var(--ds-danger);border-color:var(--ds-danger);background:var(--ds-danger-soft);}
.row-x:focus-visible{outline:2px solid var(--ds-danger);outline-offset:2px;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;}
.btn:hover{background:var(--ds-surface-subtle);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);}
.btn:disabled{opacity:.6;cursor:default;}
.findings{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;}
.finding{display:flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.45;flex-wrap:wrap;}
.fd-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--ds-text-tertiary);}
.finding.sev-good .fd-dot{background:var(--ds-success);}
.finding.sev-warn .fd-dot{background:var(--ds-warning);}
.finding.sev-fix .fd-dot{background:var(--ds-danger);}
.fd-area{font-weight:700;color:var(--text);flex:0 0 auto;}
.fd-msg{color:var(--muted);flex:1;min-width:140px;}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.lock{font-size:34px;}
.savebar{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;box-shadow:0 -4px 16px -6px rgba(15,23,42,.12);display:flex;align-items:center;gap:12px;}
.savebar .ok{color:var(--ds-success);font-size:12.5px;font-weight:500;}
/* Soft brand accent so the AI helper reads as an optional shortcut, not a step. */
.aidraft{border-left:3px solid var(--ds-brand);background:linear-gradient(100deg,var(--ds-brand-soft),var(--surface) 32%);}
/* Guided build tracker */
.build-steps{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:13px 15px 15px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;scroll-margin-top:16px;}
.bs-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px;flex-wrap:wrap;}
.bs-title{font-size:13px;font-weight:700;color:var(--text);}
.bs-count{font-size:11.5px;font-weight:600;color:var(--ds-brand-active);}
.bs-bar{height:6px;border-radius:999px;background:var(--ds-bg-subtle);overflow:hidden;margin-bottom:11px;}
.bs-bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--ds-brand),var(--ds-success));transition:width .45s var(--ds-ease,ease);}
.bs-chips{display:flex;flex-wrap:wrap;gap:6px;}
.bs-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;text-decoration:none;padding:4px 10px 4px 5px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface);color:var(--muted);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease,color .15s ease;}
.bs-chip:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);border-color:var(--ds-brand);color:var(--text);}
.bs-chip:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.bs-chip.done{background:var(--ds-brand-soft);border-color:transparent;color:var(--ds-brand-active);}
.bs-mark{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;font-size:9px;font-weight:800;flex:0 0 auto;background:var(--ds-bg-subtle);color:transparent;border:1px solid var(--border-strong);}
.bs-chip.done .bs-mark{background:var(--ds-brand);color:var(--ds-brand-contrast);border-color:var(--ds-brand);}
/* Friendly empty states */
.empty{font-size:12.5px;line-height:1.55;color:var(--ds-text-tertiary);background:var(--ds-bg-subtle);border:1px dashed var(--border-strong);border-radius:10px;padding:11px 13px;margin-bottom:10px;}
@media (prefers-reduced-motion: reduce){.offer-root{scroll-behavior:auto;}.offer-root *{transition:none!important;animation:none!important;}}
`;
