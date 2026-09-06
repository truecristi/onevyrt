"use client";
/**
 * Numbers — pillar 2, the reality check: is the business viable, and where does
 * money leak? Groups the plan, economics, funnel math and insights tools. Shows
 * a live viability read (from the saved offer's price + the saved economics) so
 * the hub reflects whether the model actually works, the way Psychology shows a
 * live persuasion score.
 */
import { useEffect, useMemo, useState } from "react";
import PillarHub from "../../components/PillarHub";
import { parseOfferPrice, type OfferData } from "../../lib/studio/offer-coach";
import { economicsViability, type EconomicsData } from "../../lib/studio/economics";
import { currencySymbol } from "../../lib/studio/currency";
import Explain from "../../components/Explain";

type CardState = "empty" | "need-price" | "need-costs" | "bad" | "warn" | "ok" | "good";

// The programme-wide Readiness Score (goals + assumptions + experiments,
// computed in @onevyrt/engine) — a separate concern from this pillar's own
// viability read, so it's typed and fetched independently. Mirrors the shape
// ProgrammeJourney reads off the same endpoint.
type ReadinessLabel = "no_data" | "fragile" | "developing" | "strong";
interface ReadinessBaselineData { score: number; capturedAt: string }
interface ReadinessSnapshot { readinessScore: number | null; readinessLabel: ReadinessLabel; readinessBaseline?: ReadinessBaselineData | null }

export default function NumbersHub() {
  const [price, setPrice] = useState(0);
  const [econ, setEcon] = useState<EconomicsData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ro, re] = await Promise.all([
          fetch("/api/business/offer", { credentials: "include" }),
          fetch("/api/business/economics", { credentials: "include" }),
        ]);
        if (ro.ok) { const o = (await ro.json()) as OfferData; setPrice(parseOfferPrice(o?.price)); }
        if (re.ok) setEcon((await re.json()) as EconomicsData);
      } catch { /* non-critical — the meter just stays quiet */ }
    })();
  }, []);

  // Readiness is a distinct through-line meter (the programme's, not this
  // pillar's), fetched separately so a slow/failed enrollment call never
  // blocks or blanks the money card above.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/programme/enrollment", { credentials: "include" });
        if (r.ok) {
          const d = (await r.json()) as { snapshot?: ReadinessSnapshot };
          if (d?.snapshot) setReadiness(d.snapshot);
        }
      } catch { /* non-critical — the readiness card just stays quiet */ }
    })();
  }, []);

  // A partial state — e.g. a price set but economics never saved — must not
  // read as a computed verdict. economicsViability happily treats an untouched
  // (all-zero) economics record as "0 cost to deliver", which scores 100/
  // "Strong margins" on nothing but a default; and treats a real economics
  // record with no price yet as "not viable", when the honest state is just
  // "no price yet". getEconomics only stamps updatedAt once something's
  // actually been saved, so that's the structural signal for "real", the same
  // way BreakEvenCard tells a genuine save from an untouched default.
  const econReal = typeof econ?.updatedAt === "string";
  const priceSet = price > 0;
  const complete = priceSet && econReal;
  const anything = priceSet || econReal;
  const v = useMemo(() => (econ ? economicsViability(econ, price) : null), [econ, price]);

  // One honest state for the money card. Mirrors the viability read but keeps
  // the "no data yet" and "one input missing" cases separate from a verdict, so
  // the header never scores something you haven't filled in.
  const state: CardState =
    !anything ? "empty"
    : !complete ? (priceSet ? "need-costs" : "need-price")
    : !v!.viable ? "bad"
    : v!.score >= 60 ? "good"
    : v!.score >= 40 ? "ok"
    : "warn";
  const isViable = state === "good" || state === "ok" || state === "warn";

  const symbol = currencySymbol(econ?.currency ?? "USD");
  const contribPerUnit = v ? Math.round(v.contributionPerUnit) : 0;
  const be = v?.breakEvenUnits ?? null;

  // Plain-language, reassuring copy per state — the point of this pillar is to
  // make the money picture feel clear, not scary, so every read ends in a
  // concrete, fixable next move.
  const TONE: Record<CardState, string> = {
    empty: "nv-t-empty", "need-price": "nv-t-none", "need-costs": "nv-t-none",
    bad: "nv-t-bad", warn: "nv-t-warn", ok: "nv-t-ok", good: "nv-t-good",
  };
  const PILL: Record<CardState, string> = {
    empty: "No numbers yet", "need-price": "Set your price", "need-costs": "Add your costs",
    bad: "Not viable", warn: v?.stage ?? "Thin margins", ok: v?.stage ?? "Healthy", good: v?.stage ?? "Strong margins",
  };
  const READ: Record<CardState, string> = {
    empty: "Set your price, then your delivery cost, to see if each sale pays off.",
    "need-price": "Add your price so we can check that each sale actually profits.",
    "need-costs": "Add what it costs to deliver one sale to finish the check.",
    bad: "Each sale loses money right now — raise the price or cut the cost to fix it.",
    warn: "It works, but the margin is thin. A small price or cost change moves it a lot.",
    ok: "It works — each sale profits and chips away at your fixed costs.",
    good: "Healthy — each sale pays well toward your costs, then straight profit.",
  };
  const CTA: Record<CardState, string> = {
    empty: "Set your price", "need-price": "Open break-even", "need-costs": "Open break-even",
    bad: "Fix the numbers", warn: "See the breakdown", ok: "See the breakdown", good: "See the breakdown",
  };

  const scoreText = isViable ? String(v!.score) : "—";
  const cardHref = state === "empty" ? "/psychology/offer" : "/numbers/break-even";
  const aria =
    isViable ? `Viability ${v!.score} out of 100, ${v!.stage}. ${state === "warn" ? "Margins are thin." : "Each sale is profitable."} Opens break-even.`
    : state === "bad" ? "Viability: not viable. Each sale currently loses money. Opens break-even to fix the economics."
    : state === "empty" ? "Money check: no numbers yet. Set your price to begin."
    : state === "need-price" ? "Money check: set your price to calculate viability. Opens break-even."
    : "Money check: add your delivery cost to calculate viability. Opens break-even.";

  // Readiness card derivations. A baseline is only worth showing once it
  // diverges from the current score — otherwise "Start 40 → now 40" would
  // just repeat itself. Mirrors ProgrammeJourney's readinessStat delta check.
  const rScore = readiness?.readinessScore ?? null;
  const rLabel: ReadinessLabel = readiness?.readinessLabel ?? "no_data";
  const rBaseline = readiness?.readinessBaseline ?? null;
  const rHasBaselineDelta = rScore != null && typeof rBaseline?.score === "number" && rBaseline?.score !== rScore;
  const READINESS_TONE: Record<ReadinessLabel, string> = {
    no_data: "rd-t-none", fragile: "rd-t-bad", developing: "rd-t-warn", strong: "rd-t-good",
  };
  const READINESS_TEXT: Record<ReadinessLabel, string> = {
    no_data: "Not started", fragile: "Fragile", developing: "Developing", strong: "Strong",
  };
  const readinessAria = rScore == null
    ? "Business Readiness: not started. Log goals, assumptions and experiments to build your score."
    : `Business Readiness ${rScore} out of 100, ${READINESS_TEXT[rLabel]}.${rHasBaselineDelta && rBaseline ? ` Started at ${rBaseline.score}.` : ""}`;

  return (
    <>
      <style>{HUB_STYLES}</style>
      <div className="rd-wrap">
        <div className={`rd-card ${READINESS_TONE[rLabel]}`} role="group" aria-label={readinessAria}>
          <span className="rd-top">
            <span className="rd-eye">Business Readiness</span>
            <span className="rd-pill">{READINESS_TEXT[rLabel]}</span>
          </span>
          {rScore == null ? (
            <>
              <span className="rd-empty">Not started — log goals, assumptions and experiments to build your score.</span>
              <a className="rd-cta" href="/studio?panel=bi">Open Business Intelligence <span aria-hidden="true">→</span></a>
            </>
          ) : (
            <span className="rd-body">
              <span className="rd-scorerow">
                <span className="rd-score">{rScore}</span>
                <span className="rd-unit">/ 100</span>
              </span>
              {rHasBaselineDelta && rBaseline && (
                <span className="rd-delta">Start {rBaseline.score} <span aria-hidden="true">→</span> now {rScore}</span>
              )}
            </span>
          )}
        </div>
      </div>
      <PillarHub
        eyebrow="NUMBERS · PILLAR 2"
        title="Know if it works"
        sub={<>The math behind the story. <b>Is it viable<Explain term="Viability" />, and where does the money leak?</b> Psychology decides what you say — the numbers tell you whether it&rsquo;s paying off.</>}
        accent="var(--nv-accent,#4f46e5)"
        accentSoft="var(--nv-accent-soft,#eef2ff)"
        headerAside={
          <a className={`nv-card ${TONE[state]}`} href={cardHref} aria-label={aria} title={READ[state]}>
            <span className="nv-top">
              <span className="nv-eye">Viability</span>
              <span className="nv-pill">{PILL[state]}</span>
            </span>
            <span className="nv-scorerow">
              <span className="nv-score">{scoreText}</span>
              {isViable && <span className="nv-unit">/ 100</span>}
            </span>
            {isViable && (
              <span className="nv-meter" aria-hidden="true">
                <span className="nv-meter-fill" style={{ width: `${Math.max(4, v!.score)}%` }} />
              </span>
            )}
            <span className="nv-read">{READ[state]}</span>
            {isViable && (
              <span className="nv-stat">
                <b>{symbol}{contribPerUnit.toLocaleString()}</b> kept per sale
                {be && be > 0 ? <> · break-even <b>{be.toLocaleString()}</b></> : null}
              </span>
            )}
            <span className="nv-cta">{CTA[state]} <span className="nv-arrow" aria-hidden="true">→</span></span>
          </a>
        }
        nextNudge={
          anything && !complete ? { label: !priceSet ? "Set your price so we can check viability" : "Add your costs to see if it's viable", href: !priceSet ? "/psychology/offer" : "/numbers/break-even" }
          : complete && v && !v.viable ? { label: "Fix the economics — each sale needs to make money", href: "/numbers/break-even" }
          : complete && v && v.viable && v.score < 40 ? { label: "Improve your margins — the numbers are thin", href: "/numbers/break-even" }
          : undefined
        }
        areas={[
          { key: "plan", icon: "plan", title: "Plan & Reality Map", blurb: "Your drivers, the one constraint, and the first thing to fix", href: "/business" },
          { key: "breakeven", icon: "bolt", title: "Break-even & economics", blurb: "How many you must sell — seeded from your offer's price", href: "/numbers/break-even" },
          { key: "funnelmath", icon: "funnels", title: "Funnel math & health", blurb: "Score your funnel and simulate the flow before you spend on traffic", href: "/business/funnels" },
          { key: "insights", icon: "insights", title: "Insights", blurb: "Leads, qualified %, book rate, cost / qualified — where money leaks", href: "/command-center/insights" },
        ]}
        current="numbers"
      />
    </>
  );
}

const HUB_STYLES = `
/* Per-pillar accent as local, theme-aware tokens. Numbers keeps its indigo
   identity but lightens on dark so the eyebrow/borders clear AA on navy, and
   the soft panel becomes a translucent tint instead of a near-white block. The
   var() fallbacks reproduce the original light-mode values exactly, so the
   worst case is the prior appearance. */
:root{--nv-accent:#4f46e5;--nv-accent-soft:#eef2ff;}
:root[data-theme="dark"]{--nv-accent:#a5b4fc;--nv-accent-soft:rgba(129,140,248,.16);}

/* Money card — the live viability read in the header. Semantic status tokens
   so a healthy model reads green, a thin one amber, a losing one red, and an
   unfinished one stays a calm neutral: clear, never garish, and correct in
   both themes. */
.nv-card{
  --nv-tone:var(--ds-border-strong,#cbd5e1);--nv-tone-soft:var(--ds-bg-subtle,#f1f4f9);
  display:block;width:214px;max-width:100%;text-decoration:none;color:var(--ds-text-primary,#111827);
  background:var(--ds-surface,#fff);border:1px solid var(--ds-border-default,#dde3eb);
  border-left:4px solid var(--nv-tone);border-radius:16px;padding:12px 14px 13px;
  box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));
  transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease;}
.nv-card:hover{transform:translateY(-1px);border-color:var(--nv-tone);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04));}
.nv-card:focus-visible{outline:2px solid var(--nv-tone);outline-offset:2px;}
.nv-card:active{transform:translateY(0);}

.nv-t-good{--nv-tone:var(--ds-success,#12703a);--nv-tone-soft:var(--ds-success-soft,#ecfdf3);}
.nv-t-ok{--nv-tone:var(--nv-accent,#4f46e5);--nv-tone-soft:var(--nv-accent-soft,#eef2ff);}
.nv-t-warn{--nv-tone:var(--ds-warning,#b45309);--nv-tone-soft:var(--ds-warning-soft,#fff8e7);}
.nv-t-bad{--nv-tone:var(--ds-danger,#c81e1e);--nv-tone-soft:var(--ds-danger-soft,#fff1f1);}
.nv-t-none{--nv-tone:var(--ds-text-tertiary,#586173);--nv-tone-soft:var(--ds-bg-subtle,#f1f4f9);}
.nv-t-empty{--nv-tone:var(--nv-accent,#4f46e5);--nv-tone-soft:var(--nv-accent-soft,#eef2ff);}

.nv-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;}
.nv-eye{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ds-text-tertiary,#586173);}
.nv-pill{font-size:9.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--nv-tone);
  background:var(--nv-tone-soft);border-radius:999px;padding:3px 8px;white-space:nowrap;}
.nv-scorerow{display:flex;align-items:baseline;gap:4px;line-height:1;}
.nv-score{font-size:34px;font-weight:800;letter-spacing:-1.5px;color:var(--nv-tone);}
.nv-unit{font-size:11px;font-weight:700;color:var(--ds-text-tertiary,#586173);}
.nv-meter{display:block;height:6px;border-radius:999px;background:var(--ds-bg-subtle,#f1f4f9);overflow:hidden;margin:9px 0 2px;}
.nv-meter-fill{display:block;height:100%;border-radius:999px;transform-origin:left center;
  background:linear-gradient(90deg,color-mix(in srgb,var(--nv-tone) 60%,transparent),var(--nv-tone));
  animation:nvFill .7s cubic-bezier(.2,.7,.3,1) both;}
.nv-read{display:block;font-size:11.5px;line-height:1.45;color:var(--ds-text-secondary,#475569);margin-top:8px;}
.nv-stat{display:block;font-size:11px;font-weight:600;color:var(--ds-text-secondary,#475569);margin-top:7px;}
.nv-stat b{color:var(--ds-text-primary,#111827);font-weight:800;}
.nv-cta{display:inline-flex;align-items:center;gap:5px;margin-top:9px;font-size:11.5px;font-weight:700;color:var(--nv-tone);}
.nv-arrow{transition:transform .15s ease;}
.nv-card:hover .nv-arrow{transform:translateX(2px);}

@keyframes nvFill{from{transform:scaleX(0);}to{transform:scaleX(1);}}
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important;}}

/* Readiness card — the programme's through-line meter (goals + assumptions +
   experiments), surfaced at the top of every pillar hub it's added to. Same
   card shell and semantic-tone convention as .nv-card just above, so the two
   read as one family, but laid out full-width above the pillar header rather
   than tucked into it. */
.rd-wrap{max-width:1000px;margin:0 auto;padding:18px 18px 0;}
.rd-card{
  --rd-tone:var(--ds-text-tertiary,#586173);--rd-tone-soft:var(--ds-bg-subtle,#f1f4f9);
  display:flex;width:fit-content;min-width:280px;max-width:100%;align-items:center;gap:14px;flex-wrap:wrap;color:var(--ds-text-primary,#111827);
  background:var(--ds-surface,#fff);border:1px solid var(--ds-border-default,#dde3eb);
  border-left:4px solid var(--rd-tone);border-radius:16px;padding:12px 16px 13px;
  box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));}

.rd-t-good{--rd-tone:var(--ds-success,#12703a);--rd-tone-soft:var(--ds-success-soft,#ecfdf3);}
.rd-t-warn{--rd-tone:var(--ds-warning,#b45309);--rd-tone-soft:var(--ds-warning-soft,#fff8e7);}
.rd-t-bad{--rd-tone:var(--ds-danger,#c81e1e);--rd-tone-soft:var(--ds-danger-soft,#fff1f1);}
.rd-t-none{--rd-tone:var(--ds-text-tertiary,#586173);--rd-tone-soft:var(--ds-bg-subtle,#f1f4f9);}

.rd-top{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
.rd-eye{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ds-text-tertiary,#586173);white-space:nowrap;}
.rd-pill{font-size:9.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--rd-tone);
  background:var(--rd-tone-soft);border-radius:999px;padding:3px 8px;white-space:nowrap;}
.rd-body{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.rd-scorerow{display:flex;align-items:baseline;gap:4px;line-height:1;}
.rd-score{font-size:24px;font-weight:800;letter-spacing:-1px;color:var(--rd-tone);}
.rd-unit{font-size:11px;font-weight:700;color:var(--ds-text-tertiary,#586173);}
.rd-delta{font-size:11.5px;font-weight:600;color:var(--ds-text-secondary,#475569);}
.rd-empty{font-size:12px;line-height:1.5;color:var(--ds-text-tertiary,#586173);}
.rd-cta{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--nv-accent,#4f46e5);text-decoration:none;white-space:nowrap;}
.rd-cta:hover{text-decoration:underline;}
@media(max-width:520px){.rd-card{padding:12px 14px 13px;}}
`;
