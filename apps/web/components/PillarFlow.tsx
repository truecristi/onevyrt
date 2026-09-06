"use client";
/**
 * PillarFlow — the one consistent "where am I, where next" control that sits at
 * the foot of every pillar hub (Psychology → Numbers → Execution). It shows the
 * three pillars as an ordered stepper with the current one marked, and a big
 * Back / Next button at each end so a visitor can always move forward or back
 * through the journey without hunting for the top tabs. Home brackets the start,
 * Community the finish, mirroring the primary nav.
 *
 * Self-scoped ("pf-" prefix), theme-aware, and shared so the flow reads the same
 * on every hub. Pure presentational — just the current pillar in, links out.
 */
import { MarketingIcon, type MarketingIconName } from "./MarketingIcons";

export type PillarKey = "psychology" | "numbers" | "execution";

interface Step { key: PillarKey; label: string; href: string; icon: MarketingIconName; sub: string; }

const STEPS: Step[] = [
  { key: "psychology", label: "Psychology", href: "/psychology", icon: "message", sub: "How you sell" },
  { key: "numbers", label: "Numbers", href: "/numbers", icon: "insights", sub: "Does it work" },
  { key: "execution", label: "Execution", href: "/execution", icon: "rocket", sub: "Make it run" },
];

// What sits just before the first pillar and just after the last, so Back/Next
// never dead-end — they hand off to Home and Community the way the top nav does.
const HOME = { label: "Home", href: "/", icon: "home" as MarketingIconName };
const COMMUNITY = { label: "Community", href: "/community", icon: "community" as MarketingIconName };

export default function PillarFlow({ current }: { current: PillarKey }) {
  const i = STEPS.findIndex((s) => s.key === current);
  const prevStep = i > 0 ? STEPS[i - 1] : undefined;
  const nextStep = i < STEPS.length - 1 ? STEPS[i + 1] : undefined;
  const prev = prevStep ? { label: prevStep.label, href: prevStep.href, icon: prevStep.icon } : HOME;
  const next = nextStep ? { label: nextStep.label, href: nextStep.href, icon: nextStep.icon } : COMMUNITY;

  return (
    <nav className="pf-root" aria-label="Move between sections">
      <style>{CSS}</style>
      <a className="pf-btn pf-prev" href={prev.href} aria-label={`Back to ${prev.label}`}>
        <span className="pf-arrow">←</span>
        <span className="pf-btn-txt"><span className="pf-btn-kicker">Back</span><span className="pf-btn-label">{prev.label}</span></span>
      </a>

      <ol className="pf-steps">
        {STEPS.map((s, n) => {
          const state = s.key === current ? "here" : n < i ? "done" : "todo";
          return (
            <li key={s.key} className={`pf-step pf-${state}`}>
              <a className="pf-step-link" href={s.href} aria-current={state === "here" ? "page" : undefined}>
                <span className="pf-num"><MarketingIcon name={s.icon} size={15} /></span>
                <span className="pf-step-txt"><span className="pf-step-label">{s.label}</span><span className="pf-step-sub">{s.sub}</span></span>
              </a>
            </li>
          );
        })}
      </ol>

      <a className="pf-btn pf-next" href={next.href} aria-label={`Next: ${next.label}`}>
        <span className="pf-btn-txt pf-r"><span className="pf-btn-kicker">Next</span><span className="pf-btn-label">{next.label}</span></span>
        <span className="pf-arrow">→</span>
      </a>
    </nav>
  );
}

const CSS = `
.pf-root{
  display:flex;align-items:stretch;gap:12px;flex-wrap:wrap;margin-top:26px;padding-top:20px;border-top:1px solid var(--ds-border-default);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.pf-root *{box-sizing:border-box;}
.pf-btn{display:inline-flex;align-items:center;gap:10px;flex:0 0 auto;text-decoration:none;color:var(--ds-text-primary);
  background:var(--ds-surface);border:1px solid var(--ds-border-default);border-radius:12px;padding:10px 16px;min-height:52px;
  transition:border-color .15s,transform .15s,box-shadow .15s;}
.pf-btn:hover{border-color:var(--ds-brand);box-shadow:0 8px 20px -14px color-mix(in srgb, var(--ds-brand) 60%, transparent);}
.pf-prev:hover{transform:translateX(-2px);}
.pf-next:hover{transform:translateX(2px);}
.pf-arrow{font-size:18px;font-weight:700;color:var(--ds-brand);}
.pf-btn-txt{display:flex;flex-direction:column;line-height:1.15;}
.pf-btn-txt.pf-r{text-align:right;}
.pf-btn-kicker{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.pf-btn-label{font-size:14px;font-weight:700;}
/* Next is the primary move — give it the accent fill. */
.pf-next{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(15,23,42,.12);}
.pf-next .pf-arrow{color:#fff;}
.pf-next .pf-btn-kicker{color:rgba(255,255,255,.85);}
.pf-next:hover{filter:brightness(1.04);border-color:var(--ds-brand);}

.pf-steps{flex:1 1 auto;display:flex;align-items:stretch;justify-content:center;gap:6px;list-style:none;margin:0;padding:0;min-width:min(100%,260px);}
.pf-step{flex:1 1 0;min-width:0;}
.pf-step-link{display:flex;align-items:center;gap:9px;height:100%;padding:8px 12px;border-radius:12px;text-decoration:none;
  border:1px solid transparent;color:var(--ds-text-tertiary);transition:background .15s,border-color .15s,color .15s;}
.pf-step-link:hover{background:var(--ds-surface-subtle);color:var(--ds-text-primary);}
.pf-num{width:28px;height:28px;flex:0 0 auto;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;
  background:var(--ds-surface-subtle);color:var(--ds-text-tertiary);border:1px solid var(--ds-border-default);}
.pf-step-txt{display:flex;flex-direction:column;line-height:1.15;min-width:0;}
.pf-step-label{font-size:13.5px;font-weight:700;white-space:nowrap;}
.pf-step-sub{font-size:10.5px;color:var(--ds-text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* The pillar you're on: filled marker + accent border, so "you are here" reads at a glance. */
.pf-here .pf-step-link{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-text-primary);}
.pf-here .pf-num{background:var(--ds-brand);color:#fff;border-color:var(--ds-brand);}
.pf-here .pf-step-label{color:var(--ds-brand);}
/* Completed pillars get a subtle done tint. */
.pf-done .pf-num{color:var(--ds-brand);border-color:var(--ds-brand);}
@media(max-width:760px){
  .pf-steps{order:-1;flex-basis:100%;}
  .pf-btn{flex:1 1 0;justify-content:center;}
  .pf-step-sub{display:none;}
}
`;
