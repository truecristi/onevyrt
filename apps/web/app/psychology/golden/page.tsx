"use client";
/**
 * The Golden Example — a worked demonstration of the loss-leader / value-ladder
 * strategy (the "McDonald's move"), applied to the founder's OWN business.
 * Not a template to fill: it feeds their saved Offer + Message to the AI and
 * shows exactly what they'd do — driving product → core → profit engine — then
 * the USP, sales angle and ad that sell that one story. Reuses the callAI +
 * loadConnection pattern from Content Angles / First Message.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../components/Toast";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { copyText } from "../../../lib/clipboard";
import {
  GOLDEN_SYSTEM, GOLDEN_STRATEGY, GOLDEN_SAMPLES, buildGoldenPrompt, parseGoldenExample, type GoldenExample,
} from "../../../lib/studio/golden-example";
import { EMPTY_OFFER, type OfferData } from "../../../lib/studio/offer-coach";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import type { MessageInput } from "../../../lib/studio/message-copy";

export default function GoldenPage() {
  const toast = useToast();
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [ex, setEx] = useState<GoldenExample | null>(null);

  const load = useCallback(async () => {
    try {
      const [ro, rm, rg] = await Promise.all([
        fetch("/api/business/offer", { credentials: "include" }),
        fetch("/api/business/message", { credentials: "include" }),
        fetch("/api/business/golden-example", { credentials: "include" }),
      ]);
      if (ro.ok) setOffer({ ...EMPTY_OFFER, ...(await ro.json()) });
      if (rm.ok) setMsg((await rm.json()) as MessageInput);
      if (rg.ok) { const g = await rg.json(); if (g && Array.isArray(g.ladder) && g.ladder.length) setEx(g as GoldenExample); }
    } catch { /* grounding + last example are both optional */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []);

  const grounded = !!(offer?.name?.trim() || offer?.promise?.trim() || msg?.oneLiner?.solution?.trim());

  const generate = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setBusy(true);
    try {
      const reply = await callAI(conn, GOLDEN_SYSTEM, buildGoldenPrompt(offer, msg, [hasBrand(brand) && `BRAND:\n${brandBrief(brand)}`, strategy?.has ? strategy.brief : ""].filter(Boolean).join("\n")), 1100);
      const out = parseGoldenExample(reply);
      if (!out) { toast("The model didn't return a usable example — try again.", "error"); return; }
      setEx(out);
      // Best-effort persist so it survives a reload and can feed other tools later.
      void fetch("/api/business/golden-example", {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(out),
      }).catch(() => { /* the example is already on screen; saving is a bonus */ });
    } catch (e) { toast(e instanceof Error ? e.message : "Generate failed — check your AI connection.", "error"); }
    finally { setBusy(false); }
  };

  const copy = async (label: string, text: string) => {
    if (await copyText(text)) toast(`${label} copied.`);
    else toast("Couldn't copy — select the text manually.", "error");
  };

  return (
    <div className="gx-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div>
          <div className="eyebrow">PSYCHOLOGY · THE GOLDEN EXAMPLE</div>
          <h1>{GOLDEN_STRATEGY.title}</h1>
          <p className="sub">{GOLDEN_STRATEGY.line}</p>
        </div>
        <a href="/psychology" className="btn ghost">← Psychology</a>
      </div>

      <div className="gx-explain">
        <div className="gx-explain-t">Why this works</div>
        <ul>{GOLDEN_STRATEGY.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>

      <AIStatus />

      <WorkedExample id="golden" />

      {!grounded && (
        <div className="gx-note">This gets far sharper with your <a href="/business/message">Message</a> and <a href="/psychology/offer">Offer</a> saved — the example is built from what you actually sell.</div>
      )}

      <div className="card gx-cta">
        <p className="gx-lead">See exactly what this strategy looks like for <b>your</b> business — your driving product, your core offer, your profit engine, and the words that sell them.</p>
        <button className="btn primary" disabled={busy} onClick={() => void generate()}>{busy ? "Working it out…" : ex ? "✦ Show me another take" : "✦ Show me what I'd do"}</button>
        <div className="gx-ground"><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        <p className="gx-hint">Takes a few seconds. It reads your saved <a href="/business/message">Message</a> and <a href="/psychology/offer">Offer</a> and shows the play in your own words — nothing is published.</p>
      </div>

      {ex && (
        <section className="gx-mine" aria-label="Your worked example">
          <div className="gx-mine-h">Your worked example</div>
          <p className="gx-mine-sub">Built from what you actually sell. Steal the <i>shape</i>, then tweak the words to fit your voice.</p>
          <ExampleBody example={ex} onCopy={copy} />
        </section>
      )}

      <div className="gx-samples">
        <div className="gx-samples-h">See it in action</div>
        <p className="gx-samples-sub">Famous brands — and a solo coach — running this exact play. Yours will look different; the <i>shape</i> is what to steal. Tap one open.</p>
        {GOLDEN_SAMPLES.map((s) => (
          <details className="gx-sample" key={s.id}>
            <summary className="gx-sample-sum">
              <span className="gx-sample-mark" aria-hidden>✦</span>
              <span className="gx-sample-t">{s.title}</span>
              <span className="gx-sample-st">{s.subtitle}</span>
              <span className="gx-sample-caret" aria-hidden>▾</span>
            </summary>
            <div className="gx-sample-body">
              <ExampleBody example={s.example} />
              {s.adapt && <div className="gx-adapt"><span className="gx-adapt-k">Your turn</span>{s.adapt}</div>}
            </div>
          </details>
        ))}
      </div>

      <p className="gx-foot">This is a worked example, not a rule. Steal the <i>shape</i> — a cheap way in, then real profit on the back end — and make it yours.</p>
    </div>
  );
}

/** Colour + plain-English role of a rung by its position in the ladder, so the
 *  example reads left-to-right as a story: an easy way in (blue), the core offer
 *  (brand green), then where the profit lives (gold). Robust to a 2–4 rung
 *  ladder and to whatever free-text stage label the AI returns. */
function rungTone(i: number, n: number): "gx-rung--in" | "gx-rung--core" | "gx-rung--profit" {
  if (n <= 1) return "gx-rung--core";
  if (i === 0) return "gx-rung--in";
  if (i === n - 1) return "gx-rung--profit";
  return "gx-rung--core";
}
function rungMeaning(i: number, n: number): string {
  if (n <= 1) return "the offer";
  if (i === 0) return "the easy way in";
  if (i === n - 1) return "where the profit lives";
  return "the main sale";
}

/** Renders one worked example — insight, ladder, USP / sales angle / ad, first
 *  step. When onCopy is given, each asset gets a Copy button (the generated
 *  result); without it the assets are read-only (the reference samples). */
function ExampleBody({ example: ex, onCopy }: { example: GoldenExample; onCopy?: (label: string, text: string) => void }) {
  const n = ex.ladder.length;
  return (
    <div className="gx-out">
      {ex.insight && (
        <div className="gx-insight"><span className="gx-insight-k">The key move</span>{ex.insight}</div>
      )}

      <ol className="gx-ladder">
        {ex.ladder.map((r, i) => (
          <li className={`gx-rung ${rungTone(i, n)}`} key={i}>
            <div className="gx-rung-n" aria-hidden>{i + 1}</div>
            <div className="gx-rung-body">
              <div className="gx-rung-top">
                <span className="gx-stagewrap">
                  <span className="gx-stage">{r.stage || `Rung ${i + 1}`}</span>
                  <span className="gx-mean">{rungMeaning(i, n)}</span>
                </span>
                {r.price && <span className="gx-price">{r.price}</span>}
              </div>
              <div className="gx-name">{r.name}</div>
              {r.role && <div className="gx-role">{r.role}</div>}
            </div>
          </li>
        ))}
      </ol>

      <div className="gx-assets">
        {ex.usp && <AssetRow label="USP — the one line" body={ex.usp} onCopy={onCopy && (() => onCopy("USP", ex.usp))} />}
        {ex.salesAngle && <AssetRow label="Sales-page angle" body={ex.salesAngle} onCopy={onCopy && (() => onCopy("Sales angle", ex.salesAngle))} />}
        {ex.ad && <AssetRow label="A short ad" body={ex.ad} onCopy={onCopy && (() => onCopy("Ad", ex.ad))} />}
      </div>

      {ex.firstStep && (
        <div className="gx-first"><span className="gx-first-k">Do this first</span>{ex.firstStep}</div>
      )}
    </div>
  );
}

function AssetRow({ label, body, onCopy }: { label: string; body: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  // Optimistic "Copied" acknowledgement so the click feels answered; the parent's
  // toast remains the source of truth on the rare copy failure.
  const handleCopy = () => {
    if (!onCopy) return;
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="gx-asset">
      <div className="gx-asset-top">
        <span className="gx-asset-l">{label}</span>
        {onCopy && (
          <button className={`gx-copy${copied ? " ok" : ""}`} onClick={handleCopy} aria-label={`Copy ${label}`}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>
      <div className="gx-asset-b">{body}</div>
    </div>
  );
}

const CSS = `
.gx-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  /* the ladder motif: an easy way in (blue) -> the core offer (green) -> profit (gold) */
  --ladder:linear-gradient(90deg,var(--ds-info),var(--ds-brand),var(--ds-warning));
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.gx-root *{box-sizing:border-box;}

.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.hub-header h1{font-size:26px;font-weight:700;margin:4px 0 6px;letter-spacing:-.5px;line-height:1.15;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}

.btn{font:inherit;font-size:13px;font-weight:700;border-radius:9px;padding:9px 15px;cursor:pointer;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);text-decoration:none;display:inline-block;}
.btn.ghost{background:transparent;}
.btn.ghost:hover{background:var(--ds-bg-subtle);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:disabled{opacity:.6;cursor:default;}

/* Why this works — brand-tinted, with a hairline ladder-gradient cap and check bullets. */
.gx-explain{position:relative;overflow:hidden;background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-color:color-mix(in srgb,var(--ds-brand) 42%,transparent);border-radius:14px;padding:16px 17px 15px;margin-bottom:16px;}
.gx-explain::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--ladder);}
.gx-explain-t{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand-hover);margin-bottom:9px;}
.gx-explain ul{margin:0;padding:0;list-style:none;display:grid;gap:6px;}
.gx-explain li{position:relative;padding-left:23px;font-size:13.5px;color:var(--muted);line-height:1.6;}
.gx-explain li::before{content:"✓";position:absolute;left:1px;top:0;color:var(--ds-brand);font-weight:800;}

/* Grounding nudge — informational, so it wears the info-blue tint. */
.gx-note{background:var(--ds-info-soft);border:1px solid var(--ds-info);border-color:color-mix(in srgb,var(--ds-info) 34%,transparent);border-radius:11px;padding:11px 14px;font-size:13px;line-height:1.55;color:var(--muted);margin-bottom:14px;}
.gx-note a{color:var(--ds-info);font-weight:600;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;}
.gx-note a:hover{opacity:.82;}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg,14px);padding:16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.gx-cta{position:relative;overflow:hidden;}
.gx-cta::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--ladder);}
.gx-lead{font-size:13.5px;color:var(--muted);line-height:1.55;margin:2px 0 12px;}
.gx-ground{margin:10px 0 0;}
.gx-hint{font-size:12px;color:var(--ds-text-tertiary);line-height:1.5;margin:11px 0 0;}
.gx-hint a{color:var(--ds-brand);font-weight:600;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;}
.gx-hint a:hover{color:var(--ds-brand-hover);}

.gx-mine{margin-bottom:14px;}
.gx-mine-h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;letter-spacing:.2px;color:var(--text);margin:4px 2px 3px;}
.gx-mine-h::before{content:"✦";color:var(--ds-brand);font-size:13px;}
.gx-mine-sub{font-size:13px;color:var(--muted);line-height:1.5;margin:0 2px 12px;}

.gx-out{display:flex;flex-direction:column;gap:14px;}
.gx-insight{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:11px;padding:12px 15px;font-size:14.5px;font-weight:500;line-height:1.55;color:var(--text);box-shadow:var(--ds-shadow-xs);}
.gx-insight-k{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-brand);margin-bottom:5px;}

/* The value ladder — a real ordered list; each rung is coloured by its role. */
.gx-ladder{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0;position:relative;}
.gx-rung{display:flex;gap:13px;align-items:stretch;padding:2px 0;}
.gx-rung--in{--rung:var(--ds-info);--rung-soft:var(--ds-info-soft);}
.gx-rung--core{--rung:var(--ds-brand);--rung-soft:var(--ds-brand-soft);}
.gx-rung--profit{--rung:var(--ds-warning);--rung-soft:var(--ds-warning-soft);}
.gx-rung-n{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--rung-soft);color:var(--rung);border:2px solid var(--rung);font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:12px;position:relative;z-index:1;}
.gx-rung:not(:last-child) .gx-rung-n::after{content:"";position:absolute;top:30px;left:50%;transform:translateX(-50%);width:2px;height:calc(100% + 4px);background:var(--rung);background:color-mix(in srgb,var(--rung) 55%,transparent);z-index:0;}
.gx-rung-body{flex:1;min-width:0;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--rung);border-radius:11px;padding:11px 14px;margin:6px 0;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s ease,border-color .15s ease;}
.gx-rung-body:hover{box-shadow:var(--ds-shadow-sm);}
.gx-rung-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.gx-stagewrap{display:inline-flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0;}
.gx-stage{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--rung);}
.gx-mean{font-size:11.5px;font-weight:600;color:var(--ds-text-tertiary);}
.gx-price{font-size:13px;font-weight:700;color:var(--rung);background:var(--rung-soft);border:1px solid var(--rung);border-color:color-mix(in srgb,var(--rung) 32%,transparent);border-radius:999px;padding:2px 10px;white-space:nowrap;}
.gx-name{font-size:15.5px;font-weight:700;line-height:1.35;margin-top:4px;color:var(--text);}
.gx-role{font-size:13px;color:var(--muted);line-height:1.55;margin-top:4px;}

.gx-assets{display:flex;flex-direction:column;gap:9px;}
.gx-asset{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:12px 14px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s ease,border-color .15s ease;}
.gx-asset:hover{border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);}
.gx-asset-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;}
.gx-asset-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand);}
.gx-copy{display:inline-flex;align-items:center;gap:5px;background:var(--ds-brand-solid);color:#fff;border:1px solid var(--ds-brand-solid);border-radius:8px;padding:5px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s ease,transform .12s ease,box-shadow .15s ease,color .15s ease,border-color .15s ease;}
.gx-copy:hover{background:var(--ds-brand-solid-hover);border-color:var(--ds-brand-solid-hover);transform:translateY(-1px);box-shadow:0 3px 9px -3px color-mix(in srgb,var(--ds-brand) 55%,transparent);}
.gx-copy:active{transform:translateY(0);}
.gx-copy:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.gx-copy.ok{background:var(--ds-success-soft);border-color:var(--ds-success);color:var(--ds-success);transform:none;box-shadow:none;}
.gx-asset-b{font-size:14px;color:var(--text);line-height:1.55;white-space:pre-wrap;}

.gx-first{background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-color:color-mix(in srgb,var(--ds-brand) 42%,transparent);border-radius:11px;padding:12px 15px;font-size:14px;font-weight:500;line-height:1.55;color:var(--text);}
.gx-first-k{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-brand-hover);margin-bottom:5px;}

.gx-samples{margin-top:24px;}
.gx-samples-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin:0 2px 4px;}
.gx-samples-sub{font-size:13px;color:var(--muted);line-height:1.5;margin:0 2px 12px;}
.gx-sample{background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:10px;box-shadow:var(--ds-shadow-xs);overflow:hidden;transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease;}
.gx-sample:hover{border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);transform:translateY(-1px);}
.gx-sample[open]{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-sm);transform:none;}
.gx-sample-sum{display:flex;align-items:center;gap:10px;padding:13px 15px;cursor:pointer;list-style:none;flex-wrap:wrap;}
.gx-sample-sum::-webkit-details-marker{display:none;}
.gx-sample-sum:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ds-brand);}
.gx-sample-mark{flex:0 0 auto;color:var(--ds-warning);font-size:13px;line-height:1;}
.gx-sample-t{font-size:15px;font-weight:700;color:var(--text);}
.gx-sample-st{flex:1;min-width:160px;font-size:12.5px;color:var(--muted);line-height:1.4;}
.gx-sample-caret{flex:0 0 auto;color:var(--ds-text-tertiary);font-size:12px;transition:transform .2s;}
.gx-sample[open] .gx-sample-caret{transform:rotate(180deg);}
.gx-sample-body{padding:0 15px 15px;}
.gx-adapt{margin-top:12px;background:var(--ds-info-soft);border:1px dashed var(--ds-info);border-color:color-mix(in srgb,var(--ds-info) 40%,transparent);border-radius:11px;padding:12px 15px;font-size:13.5px;line-height:1.6;color:var(--text);}
.gx-adapt-k{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-info);margin-bottom:4px;}

.gx-foot{font-size:12.5px;color:var(--ds-text-tertiary);margin:16px 2px 0;line-height:1.55;}

@media (prefers-reduced-motion: reduce){ .gx-root *{transition:none!important;animation:none!important;} }
`;
