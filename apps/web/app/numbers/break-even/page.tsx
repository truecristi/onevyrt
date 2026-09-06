"use client";
/**
 * Break-even — the Numbers-pillar counterpart to the Psychology offer. Reuses
 * the engine-backed BreakEvenCard, seeded with the saved offer's price so the
 * two pillars connect: you priced the offer over in Psychology; here you see
 * how many you must sell to make it work. Provides the studio CSS-var context
 * the card expects, mapped to the design tokens and theme-aware.
 */
import { useCallback, useEffect, useState } from "react";
import { BreakEvenCard } from "../../../components/studio/BreakEvenCard";
import WorkedExample from "../../../components/WorkedExample";
import { parseOfferPrice } from "../../../lib/studio/offer-coach";
import type { OfferData } from "../../../lib/studio/offer-coach";
import { DEFAULT_CURRENCY, normalizeCurrency } from "../../../lib/studio/currency";

export default function BreakEvenPage() {
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [offerName, setOfferName] = useState("");
  // Break-even is the user's OWN business maths, so it must speak their
  // workspace currency — not a hardcoded "$". The economics record carries the
  // chosen currency; read it so this page matches Numbers, funnels and the
  // offer instead of contradicting them.
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);

  const load = useCallback(async () => {
    try {
      const [ro, re] = await Promise.all([
        fetch("/api/business/offer", { credentials: "include" }),
        fetch("/api/business/economics", { credentials: "include" }),
      ]);
      if (ro.ok) {
        const o = (await ro.json()) as OfferData;
        const p = parseOfferPrice(o.price);
        if (p > 0) setPrice(p);
        if (o.name?.trim()) setOfferName(o.name.trim());
      }
      if (re.ok) {
        const e = (await re.json()) as { currency?: string };
        if (e.currency) setCurrency(normalizeCurrency(e.currency));
      }
    } catch { /* seed stays default */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="be-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div className="hub-head-main">
          <div className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />Numbers · Break-even</div>
          <h1>Know if it can pay for itself</h1>
          <p className="sub">See exactly how many sales it takes to cover your costs and start making money. Price is a Psychology call; break-even is the Numbers reality.</p>
          <div className="offer-status">
            {offerName ? (
              <span className="pill pill-brand">
                <span className="pill-dot" aria-hidden="true" />
                Linked to your offer&nbsp;·&nbsp;<b>{offerName}</b>
              </span>
            ) : (
              <span className="pill pill-info">
                <span className="pill-dot" aria-hidden="true" />
                No offer price yet — <a href="/psychology/offer">set your offer</a>&nbsp;and it flows in here
              </span>
            )}
          </div>
        </div>
        <a href="/numbers" className="btn ghost">← Numbers</a>
      </div>

      <section className="concept" aria-labelledby="be-concept-lead">
        <div className="concept-eyebrow">The math, in plain words</div>
        <p id="be-concept-lead" className="concept-lead">
          Every sale nets <b>price minus variable cost</b> — its <b>contribution</b>. Stack up enough
          contribution to cover your <b>fixed costs</b> and you&rsquo;ve broken even. After that, each sale is profit.
        </p>

        <div className="formula" role="img" aria-label="Break-even units equals fixed costs divided by price minus variable cost per unit.">
          <span className="frac">
            <span className="frac-num term term-info">Fixed costs</span>
            <span className="frac-bar" aria-hidden="true" />
            <span className="frac-den">
              <span className="term term-brand">Price</span>
              <span className="op" aria-hidden="true">−</span>
              <span className="term term-warn">Variable cost</span>
            </span>
          </span>
          <span className="op op-eq" aria-hidden="true">=</span>
          <span className="frac-result ds-gradient-text">Units to break even</span>
        </div>

        <ul className="legend">
          <li className="lg lg-brand"><span className="lg-key">Price</span><span className="lg-val">what a customer pays you</span></li>
          <li className="lg lg-warn"><span className="lg-key">Variable cost</span><span className="lg-val">what one sale costs to deliver</span></li>
          <li className="lg lg-info"><span className="lg-key">Fixed costs</span><span className="lg-val">rent, tools, pay — owed no matter what you sell</span></li>
        </ul>
      </section>

      <WorkedExample id="break-even" />

      <div className="be-scope">
        <BreakEvenCard currency={currency} initialPrice={price} persist />
      </div>

      <p className="foot">
        <b>It&rsquo;s a sandbox.</b> Change the price here to test scenarios — it won&rsquo;t touch your saved offer.
        Your costs and goal save to this workspace automatically.
      </p>
    </div>
  );
}

const CSS = `
.be-root{
  /* No local brand override: inherit the real theme-aware design tokens so the
     ONEVYRT green + status colours match every other page and adapt to dark. */
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);
  --border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:660px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.be-root *{box-sizing:border-box;}

/* Header */
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-head-main{min-width:0;flex:1 1 340px;}
.hub-header h1{font-size:25px;font-weight:700;margin:6px 0 7px;letter-spacing:-.5px;line-height:1.15;}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow-dot{width:7px;height:7px;border-radius:50%;background:var(--ds-brand);box-shadow:0 0 0 3px var(--ds-brand-soft);}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:56ch;line-height:1.55;} .sub b{color:var(--text);font-weight:600;}

/* Offer-connection status pill — makes the Psychology → Numbers link visible. */
.offer-status{margin-top:11px;}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;line-height:1.35;border-radius:999px;padding:6px 12px;}
.pill b{font-weight:700;}
.pill-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto;}
.pill-brand{background:var(--ds-brand-soft);color:var(--ds-brand);}
.pill-info{background:var(--ds-info-soft);color:var(--ds-info);}
.pill-info a{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px;}

/* Back button keeps the canonical .btn styling from the design system (hover,
   active and focus-visible all handled there); this only pins its layout. */
.btn{text-decoration:none;}
.btn.ghost{flex:0 0 auto;align-self:flex-start;}

/* Concept explainer — the formula, made visual so the key numbers land. */
.concept{background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--ds-radius-lg,14px);
  padding:16px 16px 15px;margin:0 0 14px;box-shadow:var(--ds-shadow-sm);
  animation:be-rise .5s var(--ds-ease,cubic-bezier(.2,.7,.3,1)) both;}
.concept-eyebrow{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--ds-brand);margin-bottom:7px;}
.concept-lead{font-size:13.5px;line-height:1.6;color:var(--muted);margin:0 0 14px;}
.concept-lead b{color:var(--text);font-weight:600;}

/* Visual break-even formula: Fixed costs ÷ (Price − Variable cost) = units. */
.formula{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px;
  padding:15px 12px;margin:0 0 14px;background:var(--ds-bg-subtle);border-radius:var(--ds-radius-md,11px);}
.term{display:inline-block;font-size:13px;font-weight:600;padding:4px 10px;border-radius:8px;white-space:nowrap;}
.term-brand{background:var(--ds-brand-soft);color:var(--ds-brand);}
.term-info{background:var(--ds-info-soft);color:var(--ds-info);}
.term-warn{background:var(--ds-warning-soft);color:var(--ds-warning);}
.op{font-size:15px;font-weight:600;color:var(--ds-text-tertiary);padding:0 1px;}
.frac{display:inline-flex;flex-direction:column;align-items:center;gap:6px;}
.frac-den{display:inline-flex;align-items:center;gap:7px;}
.frac-bar{width:100%;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--ds-info),var(--ds-brand),var(--ds-warning));opacity:.6;}
.op-eq{font-size:18px;color:var(--ds-text-secondary);}
.frac-result{font-size:15.5px;font-weight:700;letter-spacing:-.2px;}

/* Plain-language legend — decodes the three inputs the card asks for. */
.legend{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;}
.lg{background:var(--ds-surface-subtle);border:1px solid var(--border);border-left-width:3px;border-radius:10px;padding:9px 11px;
  transition:transform .15s var(--ds-ease,ease),box-shadow .15s var(--ds-ease,ease);}
.lg:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.lg-brand{border-left-color:var(--ds-brand);}
.lg-warn{border-left-color:var(--ds-warning);}
.lg-info{border-left-color:var(--ds-info);}
.lg-key{display:block;font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:2px;}
.lg-val{display:block;font-size:12px;color:var(--muted);line-height:1.45;}

/* Foot — a quiet reassurance band with a soft brand accent. */
.foot{font-size:12.5px;color:var(--ds-text-tertiary);margin:14px 2px 0;line-height:1.55;
  border-left:3px solid var(--ds-brand-soft);padding-left:11px;}
.foot b{color:var(--muted);font-weight:700;}

/* Map the studio component's CSS vars onto the design tokens so BreakEvenCard
   renders natively inside the Numbers pillar. */
.be-scope{
  --surface:var(--ds-surface);--surface2:var(--ds-surface-subtle);--text:var(--ds-text-primary);
  --muted:var(--ds-text-secondary);--dim:var(--ds-text-tertiary);
  --border:var(--ds-border-subtle);--border2:var(--ds-border-default);--border3:var(--ds-border-strong);}

@keyframes be-rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion: reduce){ .be-root *{transition:none!important;animation:none!important;} }
`;
