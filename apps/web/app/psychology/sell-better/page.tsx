"use client";
/**
 * "Sell it better" — the standalone persuasion tool in the Psychology pillar.
 * Paste any asset, get it scored and rewritten. The SellBetter component is
 * reusable, so the same panel can sit next to specific asset editors later.
 */
import { useState } from "react";
import SellBetter from "../../../components/SellBetter";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";

/** The four levers the SellBetter tool grades every rewrite on, spelled out in
 *  plain language so a "Hook 6/10" means something the moment it appears. Each
 *  gets its own theme-aware accent (all from design-system tokens). */
const LEVERS: { cls: string; name: string; tag: string; body: string }[] = [
  { cls: "c-hook", name: "Hook", tag: "Attention", body: "The opening words. Do they stop the scroll and make someone want the next line?" },
  { cls: "c-clar", name: "Clarity", tag: "Understood", body: "Plain and instant. Could a distracted stranger get it in a single read?" },
  { cls: "c-emo", name: "Emotion", tag: "Felt", body: "The feeling underneath. Does it touch a real want, fear or frustration?" },
  { cls: "c-cta", name: "Call to action", tag: "Next step", body: "The ask. Is the next move obvious, easy and worth taking right now?" },
];

export default function SellBetterPage() {
  const [prefill, setPrefill] = useState("");
  const [prefillNonce, setPrefillNonce] = useState(0);
  return (
    <div className="sbp-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div>
          <div className="eyebrow"><span className="eb-spark" aria-hidden>✦</span> PSYCHOLOGY · SELL IT BETTER</div>
          <h1>Make any copy <span className="sbp-grad">sell harder</span></h1>
          <p className="sub">Paste a headline, an email, a landing section — anything. You&rsquo;ll get it <b>scored</b> on hook, clarity, emotion and call-to-action, plus a rewrite in your own voice, grounded in your Message.</p>
        </div>
        <a href="/psychology" className="btn ghost">← Psychology</a>
      </div>

      <AIStatus />

      <WorkedExample id="sell-better" useLabel="Try this example" onUse={(ex) => {
        const paste = ex.inputs.find((f) => /paste/i.test(f.label))?.value ?? "";
        if (paste) { setPrefill(paste); setPrefillNonce((n) => n + 1); }
      }} />

      <section className="sbp-rubric" aria-labelledby="sbp-rubric-h">
        <div className="sbp-rubric-head">
          <div className="eyebrow eb2">The scorecard</div>
          <h2 id="sbp-rubric-h">The four levers of a line that sells</h2>
          <p className="sbp-rubric-sub">Every rewrite is graded out of 10 on each lever below. Your lowest score is usually your fastest win — fix that one first.</p>
        </div>
        <div className="sbp-cards">
          {LEVERS.map((l) => (
            <div className={`sbp-card ${l.cls}`} key={l.name}>
              <div className="sbp-card-top">
                <span className="sbp-name">{l.name}</span>
                <span className="sbp-tag">{l.tag}</span>
              </div>
              <p className="sbp-card-body">{l.body}</p>
            </div>
          ))}
        </div>
      </section>

      <SellBetter kind="headline" prefill={prefill} prefillNonce={prefillNonce} />

      <div className="foot" role="note">
        <span className="foot-tag">Tip</span>
        <p className="foot-p">Fill in your <a href="/business/message">Message</a> first — the rewrite stays truer to your voice when it has your story to work from.</p>
      </div>
    </div>
  );
}

const CSS = `
.sbp-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-border-strong:#cbd5e1;
  --ds-danger-soft:#fef2f2;
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .sbp-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-danger-soft:#3a1414;--ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.sbp-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eb-spark{color:var(--ds-brand);font-size:12px;line-height:1;}
/* A quiet brand→info gradient on the one phrase that carries the promise. Falls
   back to solid brand where background-clip:text isn't supported. */
.sbp-grad{background-image:linear-gradient(92deg,var(--ds-brand),var(--ds-info));color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.sbp-grad{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}
.sub b{color:var(--text);font-weight:700;}
/* Back button reads as liftable on hover (colours stay from the shared .btn). */
.sbp-root .hub-header a.btn{transition:transform .15s var(--ds-ease,ease),background .15s,border-color .15s,color .15s,box-shadow .15s;}
.sbp-root .hub-header a.btn:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}

/* Scorecard — teaches the four levers the tool grades so the numbers land as
   something learnable. Informational, not clickable, so it gets no hover lift. */
.sbp-rubric{margin:2px 0 16px;}
.sbp-rubric-head{margin-bottom:11px;}
.eb2{color:var(--ds-text-tertiary);}
.sbp-rubric h2{font-size:16px;font-weight:700;letter-spacing:-.3px;margin:5px 0 4px;color:var(--text);}
.sbp-rubric-sub{font-size:13px;color:var(--muted);line-height:1.5;margin:0;max-width:64ch;}
.sbp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.sbp-card{--c:var(--ds-brand);background:color-mix(in srgb,var(--c) 5%,var(--ds-surface));border:1px solid var(--ds-border-subtle);border-left:3px solid var(--c);border-radius:var(--ds-radius-md,11px);padding:11px 13px;}
.sbp-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;}
.sbp-name{font-size:13.5px;font-weight:700;color:var(--c);letter-spacing:-.2px;}
.sbp-tag{flex:0 0 auto;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);border-radius:99px;padding:2px 7px;}
.sbp-card-body{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0;}
.c-hook{--c:var(--ds-warning);}
.c-clar{--c:var(--ds-info);}
.c-emo{--c:var(--ds-danger);}
.c-cta{--c:var(--ds-success);}
@media (max-width:560px){.sbp-cards{grid-template-columns:1fr;}}

/* Footer tip — a warm brand-tinted note instead of a stray line of small text. */
.foot{display:flex;align-items:flex-start;gap:10px;margin:16px 2px 0;background:var(--ds-brand-soft);border:1px solid color-mix(in srgb,var(--ds-brand) 22%,transparent);border-radius:var(--ds-radius-md,11px);padding:10px 13px;}
.foot-tag{flex:0 0 auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:var(--ds-brand-solid);border-radius:6px;padding:3px 8px;margin-top:1px;}
.foot-p{font-size:12.5px;color:var(--ds-text-secondary);line-height:1.5;margin:0;}
.foot-p a{color:var(--ds-brand-hover);font-weight:600;text-decoration:underline;text-underline-offset:2px;transition:color .15s;}
.foot-p a:hover{color:var(--ds-brand);}

@media (prefers-reduced-motion: reduce){.sbp-root *{transition:none!important;animation:none!important;}}
`;
