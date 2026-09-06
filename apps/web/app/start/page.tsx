"use client";
/**
 * Start — the guided journey. One dated checklist from "just signed up" to
 * "booking calls", read from the real signals across the app. Pick a pace and
 * every step gets a deadline; come back and whatever slipped is flagged. This
 * is the front door for an owner who wants to be told exactly what to do next.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeJourney, PACE_LABEL, type JourneySignals, type JourneyState, type Pace, type StepStatus } from "../../lib/studio/journey";
import { weeklyPlan } from "../../lib/studio/weekly-plan";
import { loadJourneyInputs } from "../../lib/journey-signals";
import JourneyCelebration from "../../components/JourneyCelebration";
import { Notice } from "../../components/ui/Notice";
import { MarketingIcon } from "../../components/MarketingIcons";

// Plain-language hint per pace, used as a tooltip + accessible label on the
// pace picker — "Pace" is small jargon that's worth one line of explanation.
const PACE_HINT: Record<Pace, string> = {
  relaxed: "more time between steps",
  steady: "the default timeline",
  sprint: "compress deadlines to move faster",
};

export default function StartPage() {
  const [signals, setSignals] = useState<JourneySignals | null>(null);
  const [state, setState] = useState<JourneyState>({});
  const [loaded, setLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [nowISO] = useState(() => new Date().toISOString());

  const save = useCallback((next: JourneyState) => {
    setState(next);
    void fetch("/api/business/journey", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      // loadJourneyInputs() (lib/journey-signals.ts, shared with the home
      // banner) only branches on each endpoint's res.ok and swallows the rest,
      // so a signed-out visit reads as "nothing done yet" rather than "not
      // signed in" — the checklist below then renders fully interactive with
      // every save silently 401ing. Probe the same journey endpoint here, in
      // parallel, purely to read its status, without changing that shared lib.
      const [probe, inputs] = await Promise.all([
        fetch("/api/business/journey", { credentials: "include" }).catch(() => null),
        loadJourneyInputs(),
      ]);
      if (probe && probe.status === 401) { setSignedOut(true); setLoaded(true); return; }
      setState(inputs.state);
      setSignals(inputs.signals);
      setLoaded(true);
    })();
  }, []);

  // Start the clock on first ever visit (no startedAt yet).
  useEffect(() => {
    if (loaded && signals && !state.startedAt) save({ startedAt: nowISO, pace: state.pace ?? "steady" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const journey = useMemo(() => (signals ? computeJourney(signals, state, nowISO) : null), [signals, state, nowISO]);
  const week = useMemo(() => (signals ? weeklyPlan(signals) : null), [signals]);

  const dueLabel = (daysLeft: number, status: StepStatus): string => {
    if (status === "done") return "Done";
    if (status === "optional") return "Optional";
    if (status === "overdue") { const n = Math.abs(daysLeft); return `${n} day${n === 1 ? "" : "s"} past`; }
    if (daysLeft <= 0) return "Due today";
    return `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  };

  if (signedOut) {
    return (
      <div className="jn-root">
        <style>{CSS}</style>
        <Notice icon="🔑" title="Please sign in" body="Sign in to see your plan and pick up where you left off." href="/" cta="Go to sign in" />
      </div>
    );
  }

  return (
    <div className="jn-root">
      <style>{CSS}</style>
      <div className="jn-head">
        <div className="eyebrow">YOUR PLAN · START TO SALES</div>
        <h1>Do these, in order — I&rsquo;ll keep you on track</h1>
        <p className="sub">The whole path from here to your first booked call. Pick a pace and each step gets a target date; come back any time and whatever&rsquo;s slipped is flagged at the top.</p>
      </div>

      <a className="jn-spine" href="/programme">
        <span className="jn-spine-ic" aria-hidden="true"><MarketingIcon name="book" size={16} /></span>
        <span className="jn-spine-text">The full guided journey lives in the Programme — 20 modules from Uncertainty to Freedom.</span>
        <span className="jn-spine-cta">Open the programme →</span>
      </a>

      {!loaded || !journey ? (
        <div className="jn-skel" role="status" aria-live="polite" aria-label="Loading your plan" />
      ) : (
        <>
          <JourneyCelebration journey={journey} />
          <div className="jn-top">
            <div className="jn-prog">
              <div className="jn-prog-top"><span className="jn-prog-n">{journey.progress}%</span><span className="jn-prog-l">{journey.done}/{journey.total} done</span></div>
              <div
                className="jn-bar"
                role="progressbar"
                aria-valuenow={journey.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Plan progress"
                aria-valuetext={`${journey.progress}% complete — ${journey.done} of ${journey.total} steps done`}
              >
                <span style={{ width: `${journey.progress}%` }} />
              </div>
            </div>
            <div className="jn-pace" role="group" aria-label="Choose your pace" title="Changes how many days you get between steps">
              <span className="jn-pace-l">Pace</span>
              {(["relaxed", "steady", "sprint"] as Pace[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`jn-pace-b${journey.pace === p ? " on" : ""}`}
                  aria-pressed={journey.pace === p}
                  aria-label={`${PACE_LABEL[p]} pace — ${PACE_HINT[p]}`}
                  onClick={() => save({ ...state, startedAt: state.startedAt ?? nowISO, pace: p })}
                >
                  {PACE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {journey.finished ? (
            <div className="jn-banner good"><span aria-hidden="true">🎉</span> You&rsquo;ve done the whole setup — you&rsquo;re selling. Keep the leads coming and revisit any step to sharpen it.</div>
          ) : journey.overdueCount > 0 ? (
            <a className="jn-banner warn" href={journey.nextStep?.href ?? "#"}>
              <span aria-hidden="true">👋</span> Welcome back — {journey.overdueCount} step{journey.overdueCount === 1 ? " is" : "s are"} past their date, but you&rsquo;ve got this. Pick up here: <b>{journey.nextStep?.title}</b> →
            </a>
          ) : journey.nextStep ? (
            <a className="jn-banner active" href={journey.nextStep.href}>
              <span aria-hidden="true">👉</span> Do this next: <b>{journey.nextStep.title}</b> — {dueLabel(journey.nextStep.daysLeft, journey.nextStep.status)} →
            </a>
          ) : null}

          {week && (
            <section className="jn-week" aria-labelledby="jn-week-heading">
              <div className="jn-week-head">
                <span className="jn-week-k">This week</span>
                <h2 id="jn-week-heading" className="jn-week-h">{week.headline}</h2>
              </div>
              <p className="jn-week-note">Pulled from your plan below — it updates automatically as you make progress.</p>
              <div className="jn-week-list">
                {week.actions.map((a) => (
                  <a className="jn-week-item" href={a.href} key={a.id}>
                    <div className="jn-week-body">
                      <div className="jn-week-title">{a.title}</div>
                      <div className="jn-week-detail">{a.detail}</div>
                    </div>
                    <span className="jn-week-cta">{a.cta} →</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <h2 className="jn-list-h" id="jn-list-heading">The whole path</h2>
          <p className="jn-list-sub">Nothing to check off by hand — each step marks itself done the moment you finish the real work elsewhere in the app.</p>
          <ol className="jn-list" aria-labelledby="jn-list-heading">
            {journey.steps.map((s, i) => (
              <li className={`jn-step ${s.status}`} key={s.key} aria-current={journey.nextStep && s.key === journey.nextStep.key ? "step" : undefined}>
                <div className="jn-num" aria-hidden="true">{s.done ? "✓" : i + 1}</div>
                <div className="jn-body">
                  <div className="jn-title-row">
                    <span className="jn-title">{s.title}</span>
                    <span className={`jn-due ${s.status}`}>{dueLabel(s.daysLeft, s.status)}</span>
                  </div>
                  <div className="jn-blurb">{s.blurb}</div>
                  {!s.done && <a className={`jn-cta${s.status === "active" || s.status === "overdue" ? " primary" : ""}`} href={s.href}>{s.cta} →</a>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

const CSS = `
.jn-root{
  /* local aliases onto the shared design-system tokens — all theme-aware */
  --ds-radius-lg:12px;
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.jn-root *{box-sizing:border-box;}
.jn-head{margin-bottom:18px;}
.jn-head h1{font-size:26px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}
.jn-spine{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ds-brand-active);background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:10px 14px;margin-bottom:16px;font-size:13px;line-height:1.45;transition:transform .15s,box-shadow .15s;}
.jn-spine:hover{transform:translateY(-1px);box-shadow:0 8px 18px -10px color-mix(in srgb,var(--ds-brand) 40%,transparent);}
.jn-spine-ic{flex:0 0 auto;display:inline-flex;}
.jn-spine-text{flex:1;min-width:0;}
.jn-spine-cta{flex:0 0 auto;font-weight:700;white-space:nowrap;}
.jn-skel{height:340px;border-radius:var(--ds-radius-lg);background:linear-gradient(90deg,var(--ds-surface-subtle),var(--surface),var(--ds-surface-subtle));background-size:200% 100%;animation:jsh 1.3s ease infinite;border:1px solid var(--border);}
@keyframes jsh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.jn-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;}
.jn-prog{flex:1;min-width:200px;}
.jn-prog-top{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;}
.jn-prog-n{font-size:22px;font-weight:700;letter-spacing:-.5px;color:var(--ds-text-primary);background-image:linear-gradient(120deg,var(--ds-brand) 0%,var(--ds-brand-hover) 100%);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){
  .jn-prog-n{color:transparent;-webkit-background-clip:text;background-clip:text;}
}
.jn-prog-l{font-size:12px;font-weight:500;color:var(--ds-text-tertiary);}
.jn-bar{height:8px;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:99px;overflow:hidden;}
.jn-bar span{display:block;height:100%;background:var(--ds-brand);border-radius:99px;transition:width .6s var(--ds-ease,ease);}
.jn-pace{display:flex;align-items:center;gap:6px;}
.jn-pace-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);margin-right:2px;}
.jn-pace-b{background:var(--surface);border:1px solid var(--border-strong);color:var(--muted);border-radius:99px;padding:5px 12px;font-size:12.5px;font-weight:500;cursor:pointer;transition:border-color .15s,color .15s,background .15s,transform .15s,box-shadow .15s;}
.jn-pace-b:hover{border-color:var(--ds-brand);color:var(--text);transform:translateY(-1px);box-shadow:0 4px 10px -6px color-mix(in srgb,var(--ds-brand) 40%,transparent);}
.jn-pace-b:active{transform:translateY(0);}
.jn-pace-b.on{background:var(--ds-brand);border-color:var(--ds-brand);color:var(--ds-brand-contrast);}
.jn-banner{display:block;text-decoration:none;border-radius:12px;padding:12px 15px;margin-bottom:16px;font-size:14px;line-height:1.5;font-weight:500;transition:transform .15s,box-shadow .15s;}
.jn-banner b{font-weight:700;}
a.jn-banner:hover{transform:translateY(-1px);}
.jn-banner.active{background:var(--ds-brand-soft);color:var(--ds-brand-active);border:1px solid var(--ds-brand);}
.jn-banner.active:hover{box-shadow:0 8px 18px -10px color-mix(in srgb,var(--ds-brand) 40%,transparent);}
.jn-banner.warn{background:var(--ds-warning-soft);color:var(--ds-warning);border:1px solid var(--ds-warning);}
.jn-banner.warn:hover{box-shadow:0 8px 18px -10px color-mix(in srgb,var(--ds-warning) 40%,transparent);}
.jn-banner.good{background:var(--ds-success-soft);color:var(--ds-success);border:1px solid var(--ds-success);}
.jn-week{background:var(--surface);border:1px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:18px;box-shadow:0 8px 22px -16px color-mix(in srgb,var(--ds-brand) 50%,transparent);}
.jn-week-head{margin-bottom:6px;}
.jn-week-k{display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ds-brand-contrast);background:var(--ds-brand);border-radius:6px;padding:2px 8px;margin-right:8px;}
.jn-week-h{display:inline;margin:0;font:inherit;font-size:14px;font-weight:700;color:var(--text);}
.jn-week-note{font-size:12px;color:var(--ds-text-tertiary);line-height:1.45;margin:0 0 10px;}
.jn-week-list{display:flex;flex-direction:column;gap:8px;}
.jn-week-item{display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:10px;padding:11px 13px;transition:border-color .15s,transform .15s,box-shadow .15s,background .15s;}
.jn-week-item:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:0 6px 14px -8px color-mix(in srgb,var(--ds-brand) 35%,transparent);background:var(--surface);}
.jn-week-body{min-width:0;}
.jn-week-title{font-size:14px;font-weight:700;color:var(--text);}
.jn-week-detail{font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:2px;}
.jn-week-cta{flex:0 0 auto;font-size:12.5px;font-weight:700;color:var(--ds-brand-active);white-space:nowrap;}
.jn-list-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin:0 2px 4px;}
.jn-list-sub{font-size:12.5px;color:var(--muted);margin:0 2px 12px;line-height:1.5;max-width:60ch;}
.jn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;position:relative;}
.jn-list::before{content:"";position:absolute;left:30px;top:0;bottom:0;width:2px;background:var(--border);z-index:-1;}
.jn-step{display:flex;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s,background .15s,box-shadow .15s;}
.jn-step.active{border-color:var(--ds-brand);border-left-width:3px;background:var(--ds-brand-soft);box-shadow:0 8px 22px -14px color-mix(in srgb,var(--ds-brand) 45%,transparent);}
.jn-step.overdue{border-color:var(--ds-warning);border-left-width:3px;background:var(--ds-warning-soft);box-shadow:0 8px 22px -14px color-mix(in srgb,var(--ds-warning) 45%,transparent);}
.jn-step.done{border-left-width:3px;border-left-color:var(--ds-success);background:var(--ds-success-soft);opacity:.72;}
.jn-step.optional{border-style:dashed;}
.jn-num{flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:var(--ds-surface-subtle);color:var(--muted);border:1px solid var(--border-strong);transition:background .15s,color .15s,border-color .15s;}
.jn-step.done .jn-num{background:var(--ds-success);color:var(--ds-brand-contrast);border-color:var(--ds-success);}
.jn-step.active .jn-num{background:var(--ds-brand-soft);color:var(--ds-brand-active);border-color:var(--ds-brand);}
.jn-body{flex:1;min-width:0;}
.jn-title-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
.jn-title{font-size:15px;font-weight:700;}
.jn-due{flex:0 0 auto;font-size:11px;font-weight:700;color:var(--ds-text-tertiary);white-space:nowrap;border-radius:99px;transition:background .15s,color .15s;}
.jn-due.overdue{color:var(--ds-warning);background:var(--ds-warning-soft);padding:3px 9px;}
.jn-due.active{color:var(--ds-brand-active);background:var(--ds-brand-soft);padding:3px 9px;}
.jn-due.done{color:var(--ds-success);background:var(--ds-success-soft);padding:3px 9px;}
.jn-due.optional{color:var(--ds-text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:.3px;font-size:10px;}
.jn-blurb{font-size:13px;color:var(--muted);line-height:1.5;margin-top:3px;}
.jn-cta{display:inline-block;margin-top:9px;font-size:13px;font-weight:700;color:var(--ds-brand-active);text-decoration:none;border-radius:6px;transition:color .15s,background .15s,transform .15s,box-shadow .15s;}
.jn-cta:hover{color:var(--ds-brand-hover);text-decoration:underline;}
.jn-cta.primary{background:var(--ds-brand);color:var(--ds-brand-contrast);padding:7px 13px;}
.jn-cta.primary:hover{background:var(--ds-brand-hover);text-decoration:none;transform:translateY(-1px);box-shadow:0 6px 14px -6px color-mix(in srgb,var(--ds-brand) 45%,transparent);}
.jn-cta.primary:active{transform:translateY(0);}
.jn-root a:focus-visible,.jn-root button:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:6px;}
@media (prefers-reduced-motion: reduce){
  .jn-root *{transition:none!important;animation:none!important;}
}
`;
