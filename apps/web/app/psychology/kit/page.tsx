"use client";
/**
 * Sales Kit — the payoff of the authoring layer. Everything the owner has
 * written (their one-liner and story, plus the whole offer: positioning,
 * promise, value stack, price framing, guarantee, objections, and a full
 * assembled sales page) gathered on ONE page, each block ready to copy into
 * WordPress / GoHighLevel / Shopify and the rest. "Author here, implement in
 * your own stack" — made real.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import ExportPanel from "../../../components/ExportPanel";
import { messageAssets, offerAssets, goldenAssets, type ExportAsset } from "../../../lib/studio/platform-export";
import { composeOneLiner, type MessageInput } from "../../../lib/studio/message-copy";
import { composePositioning, EMPTY_OFFER, type OfferData } from "../../../lib/studio/offer-coach";
import type { GoldenExample } from "../../../lib/studio/golden-example";

export default function SalesKitPage() {
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [golden, setGolden] = useState<GoldenExample | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const [rm, ro, rg] = await Promise.all([
        fetch("/api/business/message", { credentials: "include" }),
        fetch("/api/business/offer", { credentials: "include" }),
        fetch("/api/business/golden-example", { credentials: "include" }),
      ]);
      if (rm.ok) setMsg((await rm.json()) as MessageInput);
      if (ro.ok) setOffer({ ...EMPTY_OFFER, ...((await ro.json()) as OfferData) });
      if (rg.ok) { const g = await rg.json(); if (g && Array.isArray(g.ladder) && g.ladder.length) setGolden(g as GoldenExample); }
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Assemble the copy blocks AND a per-source count, from one pass, so the
  // readiness summary and the panel stay in perfect sync. The deduped `assets`
  // list is identical to before; `counts` is purely additive.
  const { assets, counts } = useMemo(() => {
    const golden0 = goldenAssets(golden);
    const oneLiner = composeOneLiner(msg?.oneLiner);
    const message0 = messageAssets({ oneLiner, wants: msg?.wants, success: msg?.success, plan: msg?.plan });
    const offer0: ExportAsset[] = offer
      ? offerAssets({
          name: offer.name, promise: offer.promise, deliverables: offer.deliverables,
          price: offer.price, priceAnchor: offer.priceAnchor, guarantee: offer.guarantee,
          objections: offer.objections, positioning: composePositioning(offer),
        })
      : [];
    const merged = [...golden0, ...message0, ...offer0];
    // De-dupe by identical (label+value) so a hero that appears from both
    // sources shows once.
    const seen = new Set<string>();
    const deduped = merged.filter((a) => { const k = `${a.label}::${a.value}`; if (seen.has(k)) return false; seen.add(k); return true; });
    return { assets: deduped, counts: { message: message0.length, offer: offer0.length, golden: golden0.length } };
  }, [msg, offer, golden]);

  const hasSalesPage = assets.some((a) => a.key === "salespage");

  return (
    <div className="kit-root">
      <style>{CSS}</style>
      <div className="kit-head">
        <div className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />PSYCHOLOGY · SALES KIT</div>
        <h1>Everything you&rsquo;ve written, ready to ship</h1>
        <p className="sub">You author it in OneVYRT; you implement it in the tools you already run. This gathers your message and your whole offer into copy blocks — grab any one, or the full sales page, and paste it into your site, funnel or email.</p>
      </div>

      {state !== "error" && assets.length === 0 && (
        <section className="kit-flow-wrap" aria-label="How the Sales Kit works">
          <p className="kit-flow-lead">Author once in OneVYRT, then ship the copy into whatever tools you already run — no rebuilding, just paste.</p>
          <ol className="kit-flow">
            <li className="kit-flow-step">
              <span className="kit-flow-num brand" aria-hidden="true">1</span>
              <div className="kit-flow-body">
                <div className="kit-flow-t">Author it</div>
                <div className="kit-flow-d">Write your message and offer inside OneVYRT.</div>
              </div>
            </li>
            <li className="kit-flow-step">
              <span className="kit-flow-num info" aria-hidden="true">2</span>
              <div className="kit-flow-body">
                <div className="kit-flow-t">Copy a block</div>
                <div className="kit-flow-d">Grab any piece — or the whole sales page.</div>
              </div>
            </li>
            <li className="kit-flow-step">
              <span className="kit-flow-num ok" aria-hidden="true">3</span>
              <div className="kit-flow-body">
                <div className="kit-flow-t">Ship it</div>
                <div className="kit-flow-d">Paste it into your site, funnel or email.</div>
              </div>
            </li>
          </ol>
        </section>
      )}

      {state === "loading" ? (
        <>
          <div className="kit-loading-cap" role="status">Assembling your kit&hellip;</div>
          <div className="kit-skel" aria-hidden="true">
            <div className="kit-skel-bar" />
            <div className="kit-skel-row" />
            <div className="kit-skel-row" />
            <div className="kit-skel-row w70" />
          </div>
        </>
      ) : state === "error" ? (
        <div className="kit-empty kit-error" role="alert">
          <div className="kit-empty-icon kit-error-icon" aria-hidden="true">!</div>
          <h2 className="kit-empty-h">Couldn&rsquo;t load your Sales Kit</h2>
          <p>That&rsquo;s usually a dropped connection — nothing you wrote was lost. Give it another try in a moment.</p>
          <div className="kit-links">
            <a href="/psychology/kit" onClick={(e) => { e.preventDefault(); setState("loading"); void load(); }}>
              <span className="kit-link-t">Try again</span>
              <span className="kit-link-d">Reload your copy blocks</span>
              <span className="kit-link-go" aria-hidden="true">&#8635;</span>
            </a>
          </div>
        </div>
      ) : assets.length === 0 ? (
        <div className="kit-empty">
          <div className="kit-empty-icon" aria-hidden="true">&#9998;</div>
          <h2 className="kit-empty-h">Your kit is empty &mdash; for now</h2>
          <p>Write your message and offer, and OneVYRT assembles every paste-ready block right here: headline, promise, value stack, price framing, guarantee &mdash; even a full sales page.</p>
          <div className="kit-links">
            <a href="/business/message">
              <span className="kit-link-t">Write your Message</span>
              <span className="kit-link-d">One-liner, what they want, your plan</span>
              <span className="kit-link-go" aria-hidden="true">&rarr;</span>
            </a>
            <a href="/psychology/offer">
              <span className="kit-link-t">Build your Offer</span>
              <span className="kit-link-d">Promise, value stack, price, guarantee</span>
              <span className="kit-link-go" aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="kit-status" role="group" aria-label="Your Sales Kit is ready">
            <div className="kit-status-main">
              <div className="kit-count">
                <span className="kit-count-num">{assets.length}</span>
                <span className="kit-count-unit">{assets.length === 1 ? "block" : "blocks"} ready to paste</span>
              </div>
              <p className="kit-count-d">Your kit is assembled &mdash; grab any block, or the full sales page, below and drop it straight into your stack.</p>
            </div>
            <div className="kit-status-side">
              {hasSalesPage && (
                <span className="kit-pill kit-pill-ok"><span className="kit-dot" aria-hidden="true" />Full sales page ready</span>
              )}
              <div className="kit-sources">
                <span className="kit-sources-label">In your kit</span>
                <div className="kit-chips">
                  {counts.message > 0 && <span className="kit-chip info">Message&nbsp;&middot;&nbsp;{counts.message}</span>}
                  {counts.offer > 0 && <span className="kit-chip brand">Offer&nbsp;&middot;&nbsp;{counts.offer}</span>}
                  {counts.golden > 0 && <span className="kit-chip ok">Strategy&nbsp;&middot;&nbsp;{counts.golden}</span>}
                </div>
              </div>
            </div>
          </div>
          <ExportPanel
            title="Your Sales Kit"
            subtitle="Every block below is copy you wrote — paste each into WordPress, GoHighLevel, Shopify and the rest."
            assets={assets}
          />
        </>
      )}

      <p className="kit-foot">Missing something? Sharpen it in <a href="/business/message">Message</a> or <a href="/psychology/offer">Offer</a> and it updates here.</p>
    </div>
  );
}

const CSS = `
.kit-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .kit-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.kit-root *{box-sizing:border-box;}
.kit-head{margin-bottom:18px;}
.kit-head h1{font-size:27px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow-dot{width:7px;height:7px;border-radius:50%;background:var(--ds-brand);box-shadow:0 0 0 3px var(--ds-brand-soft);}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:68ch;line-height:1.55;}

/* How it works — a slim orientation strip shown before the kit exists. */
.kit-flow-wrap{margin-bottom:18px;}
.kit-flow-lead{margin:0 0 10px;font-size:13px;color:var(--muted);line-height:1.5;max-width:64ch;}
.kit-flow{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.kit-flow-step{display:flex;align-items:flex-start;gap:10px;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:11px;padding:11px 12px;}
.kit-flow-num{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:800;}
.kit-flow-num.brand{background:var(--ds-brand-soft);color:var(--ds-brand);}
.kit-flow-num.info{background:var(--ds-info-soft);color:var(--ds-info);}
.kit-flow-num.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.kit-flow-body{min-width:0;}
.kit-flow-t{font-size:12.5px;font-weight:700;color:var(--text);}
.kit-flow-d{font-size:11.5px;color:var(--muted);line-height:1.45;margin-top:1px;}
@media(max-width:560px){.kit-flow{grid-template-columns:1fr;}}

/* Readiness card — the "finished toolkit" moment. */
.kit-status{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--ds-brand);border-radius:var(--ds-radius-lg);box-shadow:var(--ds-shadow-xs);padding:18px 20px;margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 26px;animation:kitrise .5s var(--ds-ease,ease) both;}
.kit-status::before{content:"";position:absolute;inset:0 auto 0 0;width:190px;background:radial-gradient(130px 130px at 0% 45%,var(--ds-brand-soft),transparent 70%);opacity:.75;pointer-events:none;}
.kit-status-main,.kit-status-side{position:relative;z-index:1;}
.kit-status-main{min-width:220px;flex:1 1 240px;}
.kit-count{display:flex;align-items:baseline;gap:9px;line-height:1;flex-wrap:wrap;}
.kit-count-num{font-size:44px;font-weight:800;letter-spacing:-1.6px;color:var(--ds-brand);background-image:linear-gradient(135deg,var(--ds-brand),#5b9bff);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.kit-count-num{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.kit-count-unit{font-size:14.5px;font-weight:700;color:var(--text);}
.kit-count-d{margin:8px 0 0;font-size:12.5px;color:var(--muted);line-height:1.5;max-width:42ch;}
.kit-status-side{display:flex;flex-direction:column;align-items:flex-start;gap:10px;}
.kit-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;}
.kit-pill-ok{background:var(--ds-success-soft);color:var(--ds-success);}
.kit-dot{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;}
.kit-sources{display:flex;flex-direction:column;gap:6px;}
.kit-sources-label{font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--ds-text-tertiary);}
.kit-chips{display:flex;flex-wrap:wrap;gap:6px;}
.kit-chip{display:inline-flex;align-items:center;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;}
.kit-chip.brand{background:var(--ds-brand-soft);color:var(--ds-brand);}
.kit-chip.info{background:var(--ds-info-soft);color:var(--ds-info);}
.kit-chip.ok{background:var(--ds-success-soft);color:var(--ds-success);}
@keyframes kitrise{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}

/* Loading */
.kit-loading-cap{font-size:12.5px;color:var(--ds-text-tertiary);margin:0 2px 8px;font-weight:600;}
.kit-skel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:18px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;gap:12px;}
.kit-skel-bar,.kit-skel-row{border-radius:8px;background:linear-gradient(90deg,var(--ds-bg-subtle),var(--surface),var(--ds-bg-subtle));background-size:200% 100%;animation:ksh 1.3s ease infinite;}
.kit-skel-bar{height:16px;width:42%;}
.kit-skel-row{height:46px;}
.kit-skel-row.w70{width:70%;}
@keyframes ksh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}

/* Empty + error */
.kit-empty{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:26px 22px;box-shadow:var(--ds-shadow-xs);}
.kit-error{border-left:4px solid var(--ds-danger);}
.kit-empty-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;line-height:1;background:var(--ds-brand-soft);color:var(--ds-brand);margin-bottom:12px;}
.kit-error-icon{background:var(--ds-danger-soft);color:var(--ds-danger);font-weight:800;}
.kit-empty-h{font-size:16.5px;font-weight:700;margin:0 0 6px;color:var(--text);letter-spacing:-.2px;}
.kit-empty p{margin:0 0 16px;color:var(--muted);font-size:13.5px;line-height:1.55;max-width:58ch;}
.kit-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;}
.kit-links a{position:relative;display:flex;flex-direction:column;gap:2px;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:11px;padding:12px 34px 12px 14px;text-decoration:none;transition:transform .15s var(--ds-ease,ease),box-shadow .15s var(--ds-ease,ease),border-color .15s var(--ds-ease,ease);}
.kit-links a:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);border-color:var(--ds-brand);}
.kit-links a:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.kit-link-t{font-size:13.5px;font-weight:700;color:var(--ds-brand);}
.kit-link-d{font-size:12px;color:var(--muted);}
.kit-link-go{position:absolute;top:50%;right:14px;transform:translateY(-50%);color:var(--ds-brand);font-weight:700;font-size:15px;transition:transform .15s var(--ds-ease,ease);}
.kit-links a:hover .kit-link-go{transform:translateY(-50%) translateX(3px);}

/* Footer */
.kit-foot{font-size:12.5px;color:var(--ds-text-tertiary);margin:14px 2px 0;}
.kit-foot a{color:var(--ds-brand-hover);font-weight:600;text-decoration:none;transition:color .15s var(--ds-ease,ease);}
.kit-foot a:hover{color:var(--ds-brand);text-decoration:underline;}
.kit-foot a:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:3px;}

@media (prefers-reduced-motion: reduce){ .kit-root *{transition:none!important;animation:none!important;} }
`;
