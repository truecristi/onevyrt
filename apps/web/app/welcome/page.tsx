"use client";

/**
 * Pre-auth marketing landing — the one surface where the full MacBook-Pro
 * register belongs: a cinematic dark hero stage, one dominant oversized
 * headline, one primary action, then a small number of high-contrast sections
 * that each make a single point. Everything leans on the shared design system
 * (app/design-system.css): .ds-hero-title / .ds-display-title / .ds-lead /
 * .ds-metric / .ds-gradient-text / .ds-reveal, plus the token palette.
 *
 * Restraint is the brief: no gradient on every card, one filled button per
 * action group, generous vertical space. The working app (dense, information-
 * rich) is deliberately NOT styled like this — this page sells, the app works.
 */
import { useEffect, useRef } from "react";

export default function WelcomePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll-reveal via IntersectionObserver. Failsafe: if IO is unavailable, or
  // reduced-motion is on, reveal everything immediately so content is never
  // left hidden behind opacity:0.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".ds-reveal, .ds-reveal-group"));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ovw" ref={rootRef}>
      <style>{CSS}</style>

      {/* Compact translucent nav — secondary to the product. */}
      <header className="ovw-nav">
        <div className="ovw-nav__inner">
          <span className="ovw-wordmark"><span className="ovw-wordmark__dot" aria-hidden />ONEVYRT</span>
          <nav className="ovw-nav__links" aria-label="Primary">
            <a href="#pillars" className="ovw-nav__link">The journey</a>
            <a href="#numbers" className="ovw-nav__link">Why it works</a>
            <a href="/" className="ds-btn ds-btn--primary ds-btn--sm">Open the app</a>
          </nav>
        </div>
      </header>

      {/* Hero — cinematic dark stage, one dominant message, one action. */}
      <section className="ovw-hero">
        <div className="ovw-hero__content ovw-anim">
          <p className="ds-eyebrow ovw-hero__eyebrow"><span className="ovw-eyebrow-dot" aria-hidden />The business operating system</p>
          <h1 className="ds-hero-title ovw-hero__title">
            Build the business,<br /><span className="ds-gradient-text">not just the funnel.</span>
          </h1>
          <p className="ds-lead ovw-hero__lead">
            One guided journey through your business — 20 modules, each teaching you something, then opening the real tool to do it. Calm, precise, and built to make the next move obvious.
          </p>
          <div className="ovw-hero__actions">
            <a href="/" className="ds-btn ds-btn--primary ds-btn--lg">Try it free</a>
            <a href="#pillars" className="ovw-textlink">See how it works <span className="ovw-textlink__arrow" aria-hidden>›</span></a>
          </div>
          <p className="ovw-hero__trust"><span className="ovw-tick" aria-hidden>✓</span> Free to start — get your Readiness Score in the first module</p>
        </div>

        {/* Abstract product stage — a premium glass panel with soft rim light and
            a grounding shadow, standing in for a rendered product shot. The
            figure is deliberately a placeholder, not a concrete number, so this
            marketing mock never reads as a real dashboard metric. */}
        <div className="ovw-stage ovw-anim ovw-anim--delay">
          <div className="ovw-panel" role="img" aria-label="Illustrative preview of the product dashboard">
            <div className="ovw-panel__bar"><span /><span /><span /></div>
            <div className="ovw-panel__body">
              <div className="ovw-panel__row"><span className="ovw-panel__k">Monthly profit</span><span className="ovw-panel__v ds-gradient-text" aria-hidden>£ ——</span></div>
              <div className="ovw-panel__bars" aria-hidden>
                {[38, 62, 47, 81, 69, 92].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
              </div>
              <div className="ovw-panel__pills" aria-hidden>
                <span>Reality</span><span>Drivers</span><span>Funnel</span><span>Launch</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The journey — one wide card + two supporting, not equal boxes. */}
      <section id="pillars" className="ovw-section">
        <div className="ovw-section__head ds-reveal">
          <p className="ds-eyebrow">The guided journey</p>
          <h2 className="ds-display-title">Twenty modules. One locked path.</h2>
          <p className="ovw-section__sub">Start, four chapters (DEFINE, IMPLEMENT, CONTROL, IMPROVE), Finish — in that order. Each module teaches you one thing, then hands you the real tool to act on it.</p>
        </div>
        <div className="ovw-bento ds-reveal-group">
          <article className="ovw-card ovw-card--wide ovw-card--psych">
            <div className="ovw-card__head">
              <span className="ovw-card__step" aria-hidden>01</span>
              <p className="ds-eyebrow ovw-card__eyebrow">The arc</p>
            </div>
            <h3 className="ovw-card__title">From uncertainty to freedom — in six stages.</h3>
            <p className="ovw-card__copy">Chapter 1 defines your business and its psychology. Chapter 2 implements it. Chapter 3 controls your numbers. Chapter 4 identifies bottlenecks and builds a growth plan. Finish closes the loop against your Start baseline.</p>
            <p className="ovw-card__note">Twenty modules, in one locked order — each one teaches you, then opens the real tool to use.</p>
          </article>
          <article className="ovw-card ovw-card--num">
            <div className="ovw-card__head">
              <span className="ovw-card__step" aria-hidden>02</span>
              <p className="ds-eyebrow ovw-card__eyebrow">Start</p>
            </div>
            <h3 className="ovw-card__title">See exactly where you stand.</h3>
            <p className="ovw-card__copy">An honest baseline of your business today — plus your starting Readiness Score.</p>
            <p className="ovw-card__note">It&rsquo;s usually low. That&rsquo;s the point — this is your before.</p>
          </article>
          <article className="ovw-card ovw-card--exec">
            <div className="ovw-card__head">
              <span className="ovw-card__step" aria-hidden>03</span>
              <p className="ds-eyebrow ovw-card__eyebrow">Finish</p>
            </div>
            <h3 className="ovw-card__title">Prove your transformation.</h3>
            <p className="ovw-card__copy">Re-check your Readiness Score against your Start baseline — the gap is your transformation.</p>
            <p className="ovw-card__note">Self-paced, or with a coach approving each step — your call.</p>
          </article>
        </div>
      </section>

      {/* Metrics — a couple of landmark figures, not a spec table. */}
      <section id="numbers" className="ovw-section ovw-section--dark">
        <div className="ovw-section__head ds-reveal">
          <p className="ds-eyebrow">Why it works</p>
          <h2 className="ds-display-title">Less noise. One clear next move.</h2>
          <p className="ovw-section__sub">Most tools hand you ten dashboards and a shrug. OneVYRT surfaces the single highest-value thing to do — every time you open it.</p>
        </div>
        <div className="ovw-metrics ds-reveal-group">
          <div className="ds-metric ovw-metric ovw-metric--brand"><span className="ovw-metric__tick" aria-hidden /><span className="ds-metric__value ds-gradient-text">20</span><span className="ds-metric__unit">modules</span><p className="ds-metric__label">Start to Finish, in one locked order — nothing else competing for attention</p></div>
          <div className="ds-metric ovw-metric ovw-metric--info"><span className="ovw-metric__tick" aria-hidden /><span className="ds-metric__value">1</span><span className="ds-metric__unit">next action</span><p className="ds-metric__label">the command centre always names the single most valuable thing to do</p></div>
          <div className="ds-metric ovw-metric ovw-metric--warn"><span className="ovw-metric__tick" aria-hidden /><span className="ds-metric__value">0</span><span className="ds-metric__unit">rebuilds</span><p className="ds-metric__label">author once, then export or hand off to the platform you already use</p></div>
        </div>
      </section>

      {/* Final action. */}
      <section className="ovw-final ds-reveal">
        <h2 className="ds-display-title ovw-final__title">Start with your baseline.</h2>
        <p className="ds-lead ovw-final__lead">Open OneVYRT and take the first module — a short assessment that gives you your Readiness Score.</p>
        <a href="/" className="ds-btn ds-btn--primary ds-btn--lg">Try it free</a>
        <p className="ovw-final__note"><span className="ovw-tick ovw-tick--light" aria-hidden>✓</span> Free to start · No credit card needed</p>
        <p className="ovw-foot">© OneVYRT. Built for the work that pays.</p>
      </section>
    </div>
  );
}

const CSS = `
.ovw{
  --ovw-ink:#f5f5f7; --ovw-dim:#a1a1a6;
  /* Accents for the intentionally always-dark stages (hero + metrics band).
     Those grounds stay near-black in BOTH app themes, so these are fixed bright
     tones (mirroring the dark-theme status tokens) that read on dark either way.
     Everywhere the surface flips with the theme we use the adaptive --ds-* tokens. */
  --ovw-dk-green:#34d399; --ovw-dk-blue:#60a5fa; --ovw-dk-amber:#fbbf24;
  background:var(--ds-bg-app); color:var(--ds-text-primary); overflow-x:hidden;
}

/* Page-scoped button polish — adds a hover lift + keeps the design-system press
   feel, WITHOUT editing the shared .ds-btn. */
.ovw .ds-btn{ transition:background var(--ds-dur-hover) var(--ds-ease), border-color var(--ds-dur-hover) var(--ds-ease), color var(--ds-dur-hover) var(--ds-ease), transform .14s var(--ds-ease), box-shadow var(--ds-dur-hover) var(--ds-ease); }
.ovw .ds-btn:hover{ transform:translateY(-1px); }
.ovw .ds-btn:active{ transform:translateY(.5px) scale(.99); }

/* Nav */
.ovw-nav{ position:sticky; top:0; z-index:50; height:52px; background:color-mix(in srgb, var(--ds-bg-app) 82%, transparent); border-bottom:1px solid var(--ds-border-subtle); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); }
.ovw-nav__inner{ height:100%; width:min(100% - 40px, 1040px); margin-inline:auto; display:flex; align-items:center; justify-content:space-between; }
.ovw-wordmark{ display:inline-flex; align-items:center; gap:8px; font-weight:700; letter-spacing:.14em; font-size:14px; }
.ovw-wordmark__dot{ width:8px; height:8px; border-radius:50%; background:var(--ds-brand); box-shadow:0 0 0 3px color-mix(in srgb, var(--ds-brand) 20%, transparent); }
.ovw-nav__links{ display:flex; align-items:center; gap:22px; }
.ovw-nav__link{ position:relative; font-size:14px; color:var(--ds-text-secondary); text-decoration:none; transition:color var(--ds-dur-hover) var(--ds-ease); }
.ovw-nav__link::after{ content:""; position:absolute; left:0; right:0; bottom:-5px; height:2px; border-radius:2px; background:var(--ds-brand); transform:scaleX(0); transform-origin:left; transition:transform var(--ds-dur-hover) var(--ds-ease); }
.ovw-nav__link:hover{ color:var(--ds-text-primary); }
.ovw-nav__link:hover::after, .ovw-nav__link:focus-visible::after{ transform:scaleX(1); }
@media (max-width:640px){ .ovw-nav__link{ display:none; } }

/* Hero */
.ovw-hero{ position:relative; isolation:isolate; padding:clamp(72px,10vw,140px) clamp(20px,5vw,72px) clamp(60px,8vw,120px); display:grid; place-items:center; text-align:center; color:var(--ovw-ink);
  background:radial-gradient(circle at 50% 42%, #24242a 0%, #0c0c0e 42%, #000 78%); }
.ovw-hero__content{ width:min(100%, 1000px); }
.ovw-hero__eyebrow{ display:inline-flex; align-items:center; gap:9px; color:#b8b8bd; margin-bottom:18px; }
.ovw-eyebrow-dot{ width:7px; height:7px; border-radius:50%; background:var(--ovw-dk-green); box-shadow:0 0 12px color-mix(in srgb, var(--ovw-dk-green) 70%, transparent); }
.ovw-hero__title{ margin-inline:auto; max-width:14ch; color:var(--ovw-ink); }
.ovw-hero__lead{ margin:28px auto 0; color:var(--ovw-dim); max-width:52ch; }
.ovw-hero__actions{ margin-top:34px; display:flex; justify-content:center; align-items:center; gap:22px; flex-wrap:wrap; }
.ovw-hero__trust{ margin:20px 0 0; display:inline-flex; align-items:center; gap:9px; font-size:13.5px; color:var(--ovw-dim); }
.ovw-tick{ display:inline-flex; align-items:center; justify-content:center; flex:none; width:19px; height:19px; border-radius:50%; font-size:11px; font-weight:800; line-height:1; color:var(--ovw-dk-green); background:color-mix(in srgb, var(--ovw-dk-green) 20%, transparent); }
.ovw-tick--light{ color:var(--ds-success); background:color-mix(in srgb, var(--ds-success) 16%, transparent); }
.ovw-textlink{ display:inline-flex; align-items:center; gap:5px; color:#2997ff; text-decoration:none; font-size:1.05rem; }
.ovw-textlink:hover{ text-decoration:underline; }
.ovw-textlink__arrow{ display:inline-block; transition:transform var(--ds-dur-hover) var(--ds-ease); }
.ovw-textlink:hover .ovw-textlink__arrow{ transform:translateX(3px); }

/* Product stage */
.ovw-stage{ position:relative; margin-top:clamp(44px,7vw,96px); width:min(760px, 100%); }
.ovw-stage::before{ content:""; position:absolute; inset:8% 6%; z-index:-1; background:radial-gradient(ellipse, rgba(93,113,255,.28), transparent 68%); filter:blur(70px); }
.ovw-stage::after{ content:""; position:absolute; left:12%; right:12%; bottom:-6%; height:16%; z-index:-1; border-radius:50%; background:rgba(0,0,0,.7); filter:blur(34px); }
.ovw-panel{ border-radius:var(--ds-radius-2xl); overflow:hidden; background:rgba(24,24,27,.72); border:1px solid rgba(255,255,255,.13); box-shadow:0 40px 90px rgba(0,0,0,.5), inset 0 1px rgba(255,255,255,.08); backdrop-filter:blur(24px) saturate(135%); -webkit-backdrop-filter:blur(24px) saturate(135%); transition:transform .3s var(--ds-ease), box-shadow .3s var(--ds-ease); }
.ovw-stage:hover .ovw-panel, .ovw-stage:focus-within .ovw-panel{ transform:translateY(-4px); box-shadow:0 54px 112px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.10); }
.ovw-panel__bar{ display:flex; gap:7px; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,.08); }
.ovw-panel__bar span{ width:11px; height:11px; border-radius:50%; background:rgba(255,255,255,.22); }
.ovw-panel__body{ padding:clamp(20px,3vw,34px); text-align:left; color:var(--ovw-ink); }
.ovw-panel__row{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.ovw-panel__k{ font-size:13px; color:var(--ovw-dim); }
.ovw-panel__v{ font-size:clamp(1.8rem,4vw,2.8rem); font-weight:700; letter-spacing:-.04em; }
.ovw-panel__bars{ margin-top:22px; display:flex; align-items:flex-end; gap:10px; height:120px; }
.ovw-panel__bars i{ flex:1; border-radius:6px 6px 3px 3px; background:linear-gradient(180deg, rgba(150,124,255,.9), rgba(10,158,110,.75)); transform-origin:bottom; animation:ovw-bar .8s var(--ds-ease) both; }
.ovw-panel__bars i:nth-child(1){ animation-delay:.30s; } .ovw-panel__bars i:nth-child(2){ animation-delay:.38s; } .ovw-panel__bars i:nth-child(3){ animation-delay:.46s; } .ovw-panel__bars i:nth-child(4){ animation-delay:.54s; } .ovw-panel__bars i:nth-child(5){ animation-delay:.62s; } .ovw-panel__bars i:nth-child(6){ animation-delay:.70s; }
.ovw-panel__bars i:last-child{ background:linear-gradient(180deg, var(--ovw-dk-green), color-mix(in srgb, var(--ovw-dk-green) 45%, transparent)); box-shadow:0 0 22px color-mix(in srgb, var(--ovw-dk-green) 40%, transparent); }
.ovw-panel__pills{ margin-top:20px; display:flex; gap:8px; flex-wrap:wrap; }
.ovw-panel__pills span{ font-size:12px; color:var(--ovw-dim); padding:5px 11px; border-radius:999px; border:1px solid rgba(255,255,255,.14); }
.ovw-panel__pills span:first-child{ color:#e9fff5; background:color-mix(in srgb, var(--ovw-dk-green) 26%, transparent); border-color:color-mix(in srgb, var(--ovw-dk-green) 55%, transparent); }

/* Sections */
.ovw-section{ padding:clamp(72px,11vw,160px) clamp(20px,5vw,72px); width:min(100%, 1200px); margin-inline:auto; }
.ovw-section--dark{ background:#0b0b0d; color:var(--ovw-ink); width:100%; max-width:none; }
.ovw-section--dark .ovw-metrics, .ovw-section--dark .ovw-section__head{ width:min(100%, 1200px); margin-inline:auto; }
.ovw-section__head{ margin-bottom:clamp(36px,5vw,64px); }
.ovw-section__head .ds-display-title{ margin-top:12px; max-width:18ch; }
/* Coloured eyebrows: adaptive success-green on theme surfaces, fixed bright
   green on the always-dark metrics band (both AA in the theme they appear in). */
.ovw-section:not(.ovw-section--dark) .ovw-section__head > .ds-eyebrow{ color:var(--ds-success); }
.ovw-section--dark .ovw-section__head > .ds-eyebrow{ color:var(--ovw-dk-green); }
.ovw-section__sub{ margin:16px 0 0; max-width:54ch; font-size:15.5px; line-height:1.55; color:var(--ds-text-secondary); }
.ovw-section--dark .ovw-section__sub{ color:var(--ovw-dim); }

/* Bento */
.ovw-bento{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:20px; }
.ovw-card{ position:relative; --ovw-accent:var(--ds-success); border-radius:var(--ds-radius-2xl); padding:clamp(26px,3.5vw,44px); background:var(--ds-surface); border:1px solid var(--ds-border-subtle); box-shadow:var(--ds-shadow-sm); min-height:220px; display:flex; flex-direction:column; transition:transform .18s var(--ds-ease), box-shadow .18s var(--ds-ease), border-color .18s var(--ds-ease); }
.ovw-card:hover{ transform:translateY(-3px); box-shadow:var(--ds-shadow-md); border-color:color-mix(in srgb, var(--ovw-accent) 45%, var(--ds-border-subtle)); }
.ovw-card--wide{ grid-column:1 / -1; background:linear-gradient(140deg, var(--ds-brand-soft), var(--ds-surface) 70%); }
.ovw-card--psych{ --ovw-accent:var(--ds-success); }
.ovw-card--num{ --ovw-accent:var(--ds-info); background:linear-gradient(155deg, color-mix(in srgb, var(--ds-info) 6%, var(--ds-surface)), var(--ds-surface) 62%); }
.ovw-card--exec{ --ovw-accent:var(--ds-warning); background:linear-gradient(155deg, color-mix(in srgb, var(--ds-warning) 7%, var(--ds-surface)), var(--ds-surface) 62%); }
.ovw-card__head{ display:flex; align-items:center; gap:11px; margin-bottom:16px; }
.ovw-card__step{ display:inline-flex; align-items:center; justify-content:center; min-width:30px; height:24px; padding:0 9px; border-radius:999px; font-size:12.5px; font-weight:700; letter-spacing:.02em; color:var(--ovw-accent); background:color-mix(in srgb, var(--ovw-accent) 13%, transparent); border:1px solid color-mix(in srgb, var(--ovw-accent) 32%, transparent); }
.ovw-card__eyebrow{ margin:0; color:var(--ovw-accent); }
.ovw-card__title{ margin:0 0 10px; font-size:clamp(1.35rem,2.2vw,2rem); font-weight:500; letter-spacing:-.02em; line-height:1.1; }
.ovw-card__copy{ margin:0; color:var(--ds-text-secondary); font-size:15px; line-height:1.5; max-width:48ch; }
.ovw-card__note{ margin:auto 0 0; padding-top:18px; font-size:13.5px; line-height:1.45; color:var(--ds-text-tertiary); max-width:46ch; }
.ovw-card__note::before{ content:"→"; margin-right:8px; color:var(--ovw-accent); font-weight:600; }
@media (max-width:720px){ .ovw-bento{ grid-template-columns:1fr; } }

/* Metrics */
.ovw-metrics{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:clamp(24px,4vw,56px); }
.ovw-metric__tick{ display:block; width:36px; height:3px; margin-bottom:8px; border-radius:3px; background:var(--ovw-dk-green); }
.ovw-metric--info .ovw-metric__tick{ background:var(--ovw-dk-blue); }
.ovw-metric--warn .ovw-metric__tick{ background:var(--ovw-dk-amber); }
.ovw-section--dark .ds-metric__unit, .ovw-section--dark .ds-metric__label{ color:var(--ovw-dim); }
@media (max-width:720px){ .ovw-metrics{ grid-template-columns:1fr; } }

/* Final */
.ovw-final{ padding:clamp(80px,12vw,180px) clamp(20px,5vw,72px); text-align:center; display:flex; flex-direction:column; align-items:center; gap:22px; }
.ovw-final__lead{ margin:0; text-align:center; }
.ovw-final__note{ margin:0; display:inline-flex; align-items:center; gap:9px; font-size:13.5px; color:var(--ds-text-tertiary); }
.ovw-foot{ margin-top:40px; font-size:13px; color:var(--ds-text-tertiary); }

/* Entrance animation for above-the-fold hero (always ends visible). */
.ovw-anim{ animation:ovw-rise .9s cubic-bezier(.22,1,.36,1) both; }
.ovw-anim--delay{ animation-delay:.12s; }
@keyframes ovw-rise{ from{ opacity:0; transform:translateY(30px); } to{ opacity:1; transform:none; } }
@keyframes ovw-bar{ from{ transform:scaleY(0); opacity:.35; } to{ transform:none; opacity:1; } }

/* One switch turns off ALL motion on this page for reduced-motion users
   (hover transitions, entrance rises, and the staggered bar-grow). */
@media (prefers-reduced-motion: reduce){
  .ovw, .ovw *, .ovw *::before, .ovw *::after{ animation:none !important; transition:none !important; }
}
`;
