"use client";
/**
 * Execution — pillar 3, the doing: deliver the story and the offer to real
 * people. Groups funnels, leads, audiences and campaigns. Shows a live
 * readiness read (funnel → lead → qualified → booked milestones from the
 * Command Center) so the hub reflects how far the machine actually runs, the
 * way Psychology shows persuasion and Numbers shows viability.
 */
import { useEffect, useMemo, useState } from "react";
import PillarHub from "../../components/PillarHub";
import { executionReadiness, type ExecutionSignals } from "../../lib/studio/execution-readiness";

/** Home tool for each milestone (real routes only) — where "work on this step" leads. */
const stepHref = (key: string): string => (key === "funnel" ? "/business/funnels" : "/business/leads");

export default function ExecutionHub() {
  const [signals, setSignals] = useState<ExecutionSignals | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/command-center", { credentials: "include" });
        if (r.ok) { const d = await r.json(); setSignals(d?.acquisition ?? null); }
      } catch { /* non-critical — the meter just stays quiet */ }
    })();
  }, []);

  const readiness = useMemo(() => (signals ? executionReadiness(signals) : null), [signals]);
  const tone = !readiness ? "" : readiness.score >= 75 ? "good" : readiness.score >= 25 ? "warn" : "none";
  const doneCount = readiness ? readiness.steps.filter((s) => s.done).length : 0;

  return (
    <>
      <style>{CHIP_CSS}</style>
      <PillarHub
        eyebrow="EXECUTION · PILLAR 3"
        title="Make it run"
        sub={<>Your launch console — where the message and the math reach real people. <b>Build the funnel, capture leads, book calls, and send the campaigns.</b></>}
        accent="#b45309"
        accentSoft="#fff3e6"
        headerAside={readiness ? (
          <section
            className={`xr-panel xr-${tone}`}
            aria-label={`Execution readiness: ${readiness.score}% ready — ${readiness.stage}`}
            title="Execution readiness — funnel → lead → qualified → booked"
          >
            <div className="xr-eyebrow"><span className="xr-live" aria-hidden="true" />Launch readiness</div>

            <div className="xr-meter">
              <div className="xr-top">
                <span className="xr-score">{readiness.score}</span>
                <span className="xr-pct">% ready</span>
                <span className="xr-stage">{readiness.stage}</span>
              </div>
              <div
                className="xr-bar"
                role="progressbar"
                aria-valuenow={readiness.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Launch readiness: ${readiness.score} percent`}
              >
                <span className="xr-bar-fill" style={{ ["--xr-pct" as string]: `${readiness.score}%` }} />
              </div>
              <p className="xr-cap">{doneCount} of 4 launch milestones cleared — each one is a real thing that has (or hasn&rsquo;t) happened.</p>
            </div>

            <ol className="xr-steps" aria-label="Launch milestones, in order">
              {readiness.steps.map((s, i) => {
                const isNext = readiness.next?.key === s.key;
                const state = s.done ? "is-done" : isNext ? "is-next" : "";
                return (
                  <li key={s.key}>
                    <a
                      className={`xr-step ${state}`}
                      href={stepHref(s.key)}
                      aria-label={`${s.label} — ${s.done ? "done" : isNext ? "do this next" : "not yet"}`}
                    >
                      <span className="xr-step-ic" aria-hidden="true">{s.done ? "✓" : String(i + 1)}</span>
                      <span className="xr-step-label">{s.label}</span>
                      <span className="xr-step-arrow" aria-hidden="true">&rarr;</span>
                    </a>
                  </li>
                );
              })}
            </ol>

            {readiness.next ? (
              <a className="xr-cta" href={readiness.next.key === "funnel" ? "/business/funnels" : "/business/leads"}>
                Do this next: {readiness.next.label} <span className="xr-cta-arrow" aria-hidden="true">&rarr;</span>
              </a>
            ) : (
              <div className="xr-doneall"><span aria-hidden="true">&#128640;</span> All systems go — you&rsquo;re booking calls.</div>
            )}
          </section>
        ) : undefined}
        nextNudge={readiness?.next ? { label: `Next: ${readiness.next.label}`, href: readiness.next.key === "funnel" ? "/business/funnels" : readiness.next.key === "leads" ? "/business/funnels" : "/business/leads" } : undefined}
        areas={[
          { key: "funnels", icon: "funnels", title: "Funnels", blurb: "Build, publish & qualify — your front door", href: "/business/funnels" },
          { key: "leads", icon: "leads", title: "Leads & booking", blurb: "Every qualified lead and booked call in one inbox", href: "/business/leads" },
          { key: "audiences", icon: "audiences", title: "Audiences", blurb: "Build segments and find your next-best audience", href: "/business/segments" },
          { key: "campaigns", icon: "campaigns", title: "Campaigns", blurb: "Broadcast to a segment by email or SMS", href: "/business/segments" },
          { key: "launch", icon: "rocket", title: "Dashboard & 90-day", blurb: "The guided path from message to momentum", href: "/command-center" },
        ]}
        current="execution"
      />
    </>
  );
}

/* Launch-readiness console (self-scoped `xr-` classes, design-system tokens, theme-aware).
   Tone shifts the accent through the semantic status ramp as the machine comes online:
   info (just getting started) → warning (in motion) → success (booking calls). */
const CHIP_CSS = `
.xr-panel{
  --xr-accent: var(--ds-warning,#b45309);
  --xr-accent-soft: var(--ds-warning-soft,#fff8e7);
  width:290px;max-width:100%;box-sizing:border-box;
  display:flex;flex-direction:column;gap:12px;
  background:var(--ds-surface,#fff);
  border:1px solid var(--ds-border-default,#dde3eb);
  border-radius:var(--ds-radius-lg,14px);
  padding:14px 15px 15px;
  box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));
}
.xr-panel *{box-sizing:border-box;}
.xr-good{--xr-accent:var(--ds-success,#12703a);--xr-accent-soft:var(--ds-success-soft,#ecfdf3);}
.xr-warn{--xr-accent:var(--ds-warning,#b45309);--xr-accent-soft:var(--ds-warning-soft,#fff8e7);}
.xr-none{--xr-accent:var(--ds-info,#2563eb);--xr-accent-soft:var(--ds-info-soft,#eff6ff);}

.xr-eyebrow{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--xr-accent);}
.xr-live{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:var(--xr-accent);box-shadow:0 0 0 3px var(--xr-accent-soft);}
@media (prefers-reduced-motion: no-preference){.xr-live{animation:xr-pulse 2.4s var(--ds-ease,ease) infinite;}}
@keyframes xr-pulse{0%,100%{box-shadow:0 0 0 3px var(--xr-accent-soft);}50%{box-shadow:0 0 0 6px transparent;}}

.xr-meter{display:flex;flex-direction:column;gap:8px;}
.xr-top{display:flex;align-items:baseline;gap:7px;}
.xr-score{font-size:32px;font-weight:800;line-height:1;letter-spacing:-1.4px;color:var(--xr-accent);background-image:linear-gradient(120deg,var(--ds-warning,#b45309),var(--ds-brand,#088057));}
.xr-good .xr-score{background-image:linear-gradient(120deg,var(--ds-brand,#088057),var(--ds-success,#12703a));}
.xr-none .xr-score{background-image:linear-gradient(120deg,var(--ds-info,#2563eb),var(--ds-brand,#088057));}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.xr-score{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.xr-pct{font-size:12px;font-weight:600;color:var(--ds-text-tertiary,#586173);}
.xr-stage{margin-left:auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:var(--xr-accent);background:var(--xr-accent-soft);border:1px solid color-mix(in srgb,var(--xr-accent) 24%, transparent);border-radius:999px;padding:3px 9px;white-space:nowrap;}

.xr-bar{position:relative;height:7px;border-radius:999px;background:var(--ds-bg-subtle,#f1f4f9);overflow:hidden;}
.xr-bar-fill{position:absolute;top:0;left:0;bottom:0;height:100%;width:var(--xr-pct,0%);border-radius:999px;transform-origin:left;background:linear-gradient(90deg,var(--ds-warning,#b45309),var(--ds-brand,#088057));}
.xr-good .xr-bar-fill{background:linear-gradient(90deg,var(--ds-brand,#088057),var(--ds-success,#12703a));}
.xr-none .xr-bar-fill{background:linear-gradient(90deg,var(--ds-info,#2563eb),var(--ds-brand,#088057));}
@media (prefers-reduced-motion: no-preference){.xr-bar-fill{animation:xr-fill .9s var(--ds-ease,cubic-bezier(.2,.7,.3,1)) both;}}
@keyframes xr-fill{from{transform:scaleX(0);}to{transform:scaleX(1);}}

.xr-cap{margin:0;font-size:11px;line-height:1.4;color:var(--ds-text-tertiary,#586173);}

.xr-steps{display:flex;flex-direction:column;gap:3px;list-style:none;margin:0;padding:0;}
.xr-step{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:9px;text-decoration:none;color:var(--ds-text-secondary,#475569);border:1px solid transparent;transition:background .15s var(--ds-ease,ease),border-color .15s,transform .15s,box-shadow .15s;}
.xr-step:hover{background:var(--ds-surface-subtle,#fafbfc);border-color:var(--ds-border-subtle,#e8ecf2);transform:translateX(2px);}
.xr-step:focus-visible{outline:2px solid var(--xr-accent);outline-offset:2px;}
.xr-step-ic{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;border:1.5px solid var(--ds-border-strong,#cbd5e1);color:var(--ds-text-tertiary,#586173);background:var(--ds-surface,#fff);}
.xr-step-label{font-size:12.5px;font-weight:600;min-width:0;}
.xr-step-arrow{margin-left:auto;font-weight:800;color:var(--xr-accent);opacity:0;transform:translateX(-3px);transition:opacity .15s,transform .15s;}
.xr-step:hover .xr-step-arrow{opacity:1;transform:none;}
.xr-step.is-done{color:var(--ds-text-primary,#111827);}
.xr-step.is-done .xr-step-ic{background:var(--ds-success,#12703a);border-color:var(--ds-success,#12703a);color:var(--ds-brand-contrast,#fff);}
.xr-step.is-next{background:var(--xr-accent-soft);border-color:color-mix(in srgb,var(--xr-accent) 30%, transparent);color:var(--ds-text-primary,#111827);}
.xr-step.is-next .xr-step-ic{background:var(--xr-accent);border-color:var(--xr-accent);color:var(--ds-brand-contrast,#fff);}
.xr-step.is-next .xr-step-label{font-weight:700;}
.xr-step.is-next .xr-step-arrow{opacity:1;transform:none;}

.xr-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 12px;border-radius:var(--ds-radius-md,11px);font-size:12.5px;font-weight:700;text-decoration:none;color:var(--ds-brand-contrast,#fff);background:var(--xr-accent);border:1px solid var(--xr-accent);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(15,23,42,.12);transition:transform .15s var(--ds-ease,ease),box-shadow .15s,filter .15s;}
.xr-cta:hover{transform:translateY(-1px);box-shadow:0 6px 16px -8px color-mix(in srgb,var(--xr-accent) 60%, transparent);filter:brightness(1.03);}
.xr-cta:active{transform:translateY(0);}
.xr-cta:focus-visible{outline:2px solid var(--xr-accent);outline-offset:2px;}
.xr-cta-arrow{transition:transform .15s;}
.xr-cta:hover .xr-cta-arrow{transform:translateX(2px);}

.xr-doneall{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:var(--ds-radius-md,11px);font-size:12.5px;font-weight:700;color:var(--ds-success,#12703a);background:var(--ds-success-soft,#ecfdf3);border:1px solid color-mix(in srgb,var(--ds-success,#12703a) 30%, transparent);}

@media (prefers-reduced-motion: reduce){.xr-panel,.xr-panel *{transition:none!important;animation:none!important;}}
`;
