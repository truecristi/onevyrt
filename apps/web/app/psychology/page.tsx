"use client";
/**
 * Psychology — pillar 1, the foundation of the business: how you sell and
 * present. This hub gathers the four areas that decide whether anyone buys,
 * routing into the real tools where they exist. It is deliberately the most
 * prominent pillar (see the 3-pillar restructure).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MarketingIcon, type MarketingIconName } from "../../components/MarketingIcons";
import { composeOneLiner, type MessageInput } from "../../lib/studio/message-copy";
import { EMPTY_OFFER, type OfferData } from "../../lib/studio/offer-coach";
import { persuasionScore, type PersuasionParts } from "../../lib/studio/persuasion-score";
import PillarFlow from "../../components/PillarFlow";
import Explain from "../../components/Explain";

const PRESENTATION_KEY = "ov-presentation-checked";

// Where each part of the persuasion score is worked on, so the hub can point
// the owner straight at the weakest one.
const PART_TARGET: Record<keyof PersuasionParts, { href: string; label: string }> = {
  message: { href: "/business/message", label: "write your Message" },
  offer: { href: "/psychology/offer", label: "sharpen your Offer" },
  presentation: { href: "/psychology/presentation", label: "check your Presentation" },
};

interface Area {
  key: string;
  icon: MarketingIconName;
  title: string;
  blurb: string;
  points: string[];
  href?: string;
  cta?: string;
  badge?: string;
  soon?: boolean;
  /** Marks the natural first stop, so a lost owner knows where to begin. */
  start?: boolean;
}

const AREAS: Area[] = [
  {
    key: "golden",
    icon: "compass",
    title: "The Golden Example",
    blurb: "The McDonald's move, applied to you.",
    points: ["A cheap “driving product” that gets people in the door", "Then the real profit on the back end", "See exactly what you'd do — ladder, USP (your one-line edge), sales angle & ad"],
    href: "/psychology/golden",
    cta: "Show me what I'd do →",
    badge: "AI",
    start: true,
  },
  {
    key: "business-intelligence",
    icon: "insights",
    title: "Business Intelligence",
    blurb: "Know your business before you build the machine.",
    points: ["Define the business — who you serve, what breaks through, where it's headed", "Work the 7 Systems and set your Freedom Plan (Money Machine)", "Goals, assumptions, experiments and a live Business Readiness Score"],
    href: "/psychology/business-intelligence",
    cta: "Open Business Intelligence →",
  },
  {
    key: "positioning",
    icon: "message",
    title: "Positioning & Offer",
    blurb: "Get the thing you're selling right.",
    points: ["Guided offer builder + live strength score", "Price framing, guarantee & objection map", "Or start with your Message one-liner"],
    href: "/psychology/offer",
    cta: "Build your offer →",
    badge: "AI",
  },
  {
    key: "copy",
    icon: "campaigns",
    title: "Copy & Creative",
    blurb: "Every asset, written to sell.",
    points: ["“Sell it better” AI — score & rewrite any copy", "Hook, clarity, emotion & CTA scoring", "Funnel copy, emails, ads & landing pages"],
    href: "/psychology/sell-better",
    cta: "Sell it better with AI →",
    badge: "AI",
  },
  {
    key: "outreach",
    icon: "leads",
    title: "First Message",
    blurb: "Reach out without freezing.",
    points: ["Short, human cold DMs / emails that get a reply", "Grounded in your offer — never salesy", "For when you don't have an audience yet"],
    href: "/psychology/outreach",
    cta: "Write your first message →",
    badge: "AI",
  },
  {
    key: "content",
    icon: "campaigns",
    title: "Content Angles",
    blurb: "Never wonder what to post.",
    points: ["Scroll-stopping post ideas from your offer", "Hooks + what to say, for posts / reels / threads", "The 1-to-many way to get found"],
    href: "/psychology/content",
    cta: "Get post ideas →",
    badge: "AI",
  },
  {
    key: "swipe",
    icon: "book",
    title: "Swipe Library",
    blurb: "Never start from a blank page.",
    points: ["Proven headlines & story frameworks", "Offer structures & ad angles", "Adapt any of them to your Message"],
    href: "/psychology/swipe",
    cta: "Open the Swipe Library →",
  },
  {
    key: "presentation",
    icon: "studio",
    title: "Presentation",
    blurb: "How it looks when you show it.",
    points: ["Presentation & trust readiness score", "Hero, single CTA, proof, guarantee, mobile", "Then build the visuals in Brand"],
    href: "/psychology/presentation",
    cta: "Check your presentation →",
  },
  {
    key: "kit",
    icon: "compass",
    title: "Sales Kit",
    blurb: "Everything you wrote, ready to ship.",
    points: ["Your message + whole offer as copy blocks", "A full assembled sales page to paste", "Drop it into WordPress, GoHighLevel, Shopify…"],
    href: "/psychology/kit",
    cta: "Open your Sales Kit →",
  },
];

export default function PsychologyHub() {
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [presentationChecked, setPresentationChecked] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [rm, ro] = await Promise.all([
        fetch("/api/business/message", { credentials: "include" }),
        fetch("/api/business/offer", { credentials: "include" }),
      ]);
      if (rm.ok) setMsg((await rm.json()) as MessageInput);
      if (ro.ok) { const o = (await ro.json()) as OfferData; setOffer({ ...EMPTY_OFFER, ...o }); }
    } catch { /* non-critical — the score just reads lower */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Presentation readiness now lives in the workspace (with a localStorage
  // cache); read the server first so the score matches across devices, and fall
  // back to the cache when offline.
  useEffect(() => {
    let live = true;
    const fromCache = (): string[] => { try { const raw = localStorage.getItem(PRESENTATION_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []; } catch { return []; } };
    (async () => {
      try {
        const r = await fetch("/api/business/presentation", { credentials: "include" });
        if (live && r.ok) { const arr = (await r.json())?.checked; setPresentationChecked(Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === "string") : []); return; }
      } catch { /* fall through to cache */ }
      if (live) setPresentationChecked(fromCache());
    })();
    return () => { live = false; };
  }, []);

  const oneLiner = useMemo(() => composeOneLiner(msg?.oneLiner), [msg]);

  // A real, honest persuasion read: Message + Offer + Presentation rolled up.
  const persuasion = useMemo(
    () => persuasionScore({ message: msg, offer, presentationChecked }),
    [msg, offer, presentationChecked],
  );
  const score = persuasion.score;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">PSYCHOLOGY · PILLAR 1</div>
          <h1>Say it so they buy</h1>
          <p className="sub">Your business runs on three layers, and this is the one that comes first: <b>how you sell and present</b>. Get this right and the numbers and the machine have something worth scaling.</p>
        </div>
        <div className="score">
          <div className="score-n" aria-label={score ? `${score} out of 100` : "No persuasion score yet"}>{score || "—"}</div>
          <div className="score-l">{score ? persuasion.stage : "Persuasion"}<Explain term="Persuasion score" /></div>
        </div>
      </div>

      {oneLiner ? (
        <div className="oneliner">
          <div className="ol-tag"><MarketingIcon name="spark" size={12} /> Your one-liner</div>
          <p className="ol-text">“{oneLiner}”</p>
        </div>
      ) : (
        <a className="oneliner-empty" href="/business/message">
          <div className="ol-tag">Your one-liner</div>
          <p className="oe-text">No one-liner yet — write the single sentence that says <b>what you do</b> and <b>who it&apos;s for</b>. It&apos;s the spine everything else here hangs on. <span className="oe-go">Write it →</span></p>
        </a>
      )}

      <div className="breakdown">
        <div className="bd-intro">
          <span className="bd-intro-eyebrow">Your persuasion readiness</span>
          <span className="bd-intro-text">Three things decide whether people buy — your <b>Message</b>, your <b>Offer</b>, and how you <b>Present</b> it. Tap any bar to work on that piece.</span>
        </div>
        <div className="bd-bars">
          {(Object.keys(PART_TARGET) as (keyof PersuasionParts)[]).map((k) => {
            const v = persuasion.parts[k];
            const tone = v >= 80 ? "good" : v >= 40 ? "warn" : "low";
            return (
              <a className="bd-bar" data-tone={tone} href={PART_TARGET[k].href} key={k} aria-label={`${k}: ${v} out of 100 — ${PART_TARGET[k].label}`}>
                <div className="bd-top"><span className="bd-name">{k}</span><span className="bd-n">{v}</span></div>
                <div className="bd-track"><span className={`bd-fill ${tone}`} style={{ width: `${v}%` }} /></div>
              </a>
            );
          })}
        </div>
        {score < 100 && (
          <a className="bd-next" href={PART_TARGET[persuasion.weakest].href}>
            <MarketingIcon name="spark" size={14} /> {score === 0 ? "Start here" : "Biggest win right now"} — {PART_TARGET[persuasion.weakest].label} <span className="bd-next-arrow" aria-hidden>→</span>
          </a>
        )}
      </div>

      <div className="areas-head">
        <div className="areas-eyebrow">The toolkit</div>
        <h2 className="areas-title">Everything you need to sell it well</h2>
        <p className="areas-sub">Work these in any order — each one opens a real tool. New here? Begin with <b>The Golden Example</b> to see your whole plan, then sharpen your <b>Offer</b>.</p>
      </div>

      <div className="areas">
        {AREAS.map((a) => (
          <AreaCard key={a.key} area={a} />
        ))}
      </div>

      <PillarFlow current="psychology" />
    </Shell>
  );
}

function AreaCard({ area }: { area: Area }) {
  const label = area.cta ? area.cta.replace(/\s*→\s*$/, "") : "";
  const inner = (
    <>
      {area.start && <span className="ac-start"><MarketingIcon name="spark" size={11} /> Start here</span>}
      <div className="ac-head">
        <span className="ac-ic"><MarketingIcon name={area.icon} size={20} /></span>
        <div className="ac-titles">
          <div className="ac-title">{area.title}{area.badge && <span className="ac-badge" title="AI-assisted">{area.badge}</span>}</div>
          <div className="ac-blurb">{area.blurb}</div>
        </div>
        {area.soon && <span className="ac-soon">Coming soon</span>}
      </div>
      <ul className="ac-points">
        {area.points.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      {area.cta && <div className="ac-cta"><span>{label}</span><span className="ac-cta-arrow" aria-hidden>→</span></div>}
    </>
  );
  if (area.href) return <a className="ac" href={area.href}>{inner}</a>;
  return <div className="ac ac-soon-card">{inner}</div>;
}

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-border-strong:#cbd5e1;
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:1000px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.hub-root *{box-sizing:border-box;}

/* ---- header ---- */
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:28px;font-weight:700;margin:3px 0 6px;letter-spacing:-.6px;}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow::before{content:"";width:16px;height:2px;border-radius:2px;background:var(--ds-brand);}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:68ch;line-height:1.55;}
.sub b{color:var(--text);font-weight:700;}
.score{flex:0 0 auto;text-align:center;background:linear-gradient(160deg,var(--ds-brand-soft),var(--surface));border:1px solid var(--border-strong);border-radius:16px;padding:14px 22px;box-shadow:var(--ds-shadow-xs);min-width:104px;}
.score-n{font-size:34px;font-weight:700;color:var(--ds-brand);line-height:1;letter-spacing:-1px;}
@supports ((background-clip:text) or (-webkit-background-clip:text)){
  .score-n{background:linear-gradient(135deg,var(--ds-brand),#0bb87f);-webkit-background-clip:text;background-clip:text;color:transparent;}}
.score-l{font-size:10px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-top:4px;}

/* ---- one-liner ---- */
.oneliner{background:linear-gradient(135deg,var(--ds-brand),#0bb87f);color:#fff;border-radius:var(--ds-radius-xl);padding:18px 22px;box-shadow:0 12px 30px -12px rgba(10,158,110,.45);margin-bottom:20px;}
.ol-tag{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;opacity:.9;margin-bottom:6px;}
.ol-text{font-size:19px;font-weight:500;line-height:1.4;margin:0;letter-spacing:-.2px;}
.oneliner-empty{display:block;text-decoration:none;background:var(--ds-brand-soft);border:1px dashed var(--ds-brand);border-radius:var(--ds-radius-xl);padding:16px 20px;margin-bottom:20px;transition:transform .15s,box-shadow .15s;}
.oneliner-empty:hover{transform:translateY(-1px);box-shadow:0 10px 24px -16px rgba(10,158,110,.5);}
.oneliner-empty:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.oneliner-empty .ol-tag{color:var(--ds-brand-active);opacity:1;}
.oe-text{font-size:13.5px;line-height:1.55;color:var(--ds-text-secondary);margin:0;}
:root[data-theme="dark"] .oe-text{color:var(--ds-text-secondary);}
.oe-text b{color:var(--text);font-weight:700;}
.oe-go{font-weight:700;color:var(--ds-brand-active);white-space:nowrap;}

/* ---- persuasion breakdown ---- */
.breakdown{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;margin-bottom:22px;box-shadow:var(--ds-shadow-xs);}
.bd-intro{display:flex;flex-direction:column;gap:3px;margin-bottom:13px;}
.bd-intro-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--ds-brand);}
.bd-intro-text{font-size:12.5px;line-height:1.5;color:var(--muted);max-width:72ch;}
.bd-intro-text b{color:var(--text);font-weight:700;}
.bd-bars{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
@media(max-width:560px){.bd-bars{grid-template-columns:1fr;}}
.bd-bar{display:block;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-md);padding:11px 13px;text-decoration:none;transition:border-color .15s,transform .15s,box-shadow .15s;}
.bd-bar:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:0 8px 18px -14px rgba(10,158,110,.5);}
.bd-bar:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.bd-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;}
.bd-name{font-size:12px;font-weight:700;color:var(--text);text-transform:capitalize;}
.bd-n{font-size:13px;font-weight:700;color:var(--ds-text-tertiary);}
.bd-bar[data-tone="good"] .bd-n{color:var(--ds-success);}
.bd-bar[data-tone="warn"] .bd-n{color:var(--ds-warning);}
.bd-track{height:6px;background:var(--surface);border:1px solid var(--border);border-radius:99px;overflow:hidden;}
.bd-fill{display:block;height:100%;border-radius:99px;transition:width .6s var(--ds-ease,cubic-bezier(.2,.7,.3,1));}
.bd-fill.good{background:var(--ds-brand);}
.bd-fill.warn{background:var(--ds-warning);}
.bd-fill.low{background:var(--ds-border-strong);}
.bd-next{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:9px 14px;background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-radius:var(--ds-radius-md);font-size:13px;font-weight:700;color:var(--ds-brand-active);text-decoration:none;transition:transform .15s,box-shadow .15s;}
.bd-next:hover{transform:translateY(-1px);box-shadow:0 8px 18px -12px rgba(10,158,110,.5);}
.bd-next:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.bd-next svg{color:var(--ds-brand);flex:0 0 auto;}
.bd-next-arrow{transition:transform .15s;}
.bd-next:hover .bd-next-arrow{transform:translateX(3px);}

/* ---- toolkit section ---- */
.areas-head{margin:2px 0 14px;}
.areas-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--ds-info);}
.areas-eyebrow::before{content:"";width:16px;height:2px;border-radius:2px;background:var(--ds-info);}
.areas-title{font-size:18px;font-weight:700;letter-spacing:-.3px;margin:7px 0 4px;color:var(--text);}
.areas-sub{font-size:13px;line-height:1.55;color:var(--muted);margin:0;max-width:72ch;}
.areas-sub b{color:var(--text);font-weight:700;}
.areas{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:720px){.areas{grid-template-columns:1fr;}}

/* ---- area cards ---- */
.ac{position:relative;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:18px 20px;box-shadow:var(--ds-shadow-xs);text-decoration:none;color:var(--text);transition:border-color .15s,transform .15s,box-shadow .15s;}
.ac::before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 3px 3px 0;background:var(--ds-brand);opacity:0;transition:opacity .15s;}
.ac:hover{border-color:var(--ds-brand);transform:translateY(-2px);box-shadow:0 12px 26px -16px rgba(10,158,110,.45);}
.ac:hover::before{opacity:1;}
.ac:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.ac-soon-card{opacity:.82;}
.ac-start{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-brand-active);background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-radius:20px;padding:3px 9px;margin-bottom:12px;}
.ac-start svg{color:var(--ds-brand);}
.ac-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;}
.ac-ic{width:38px;height:38px;flex:0 0 auto;border-radius:10px;background:var(--ds-brand-soft);color:var(--ds-brand);display:inline-flex;align-items:center;justify-content:center;transition:transform .15s;}
.ac:hover .ac-ic{transform:scale(1.06);}
.ac-titles{flex:1;min-width:0;}
.ac-title{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;}
.ac-badge{font-size:10px;font-weight:700;background:var(--ds-brand);color:#fff;padding:2px 8px;border-radius:20px;letter-spacing:.3px;}
.ac-blurb{font-size:12.5px;color:var(--ds-text-tertiary);margin-top:2px;}
.ac-soon{flex:0 0 auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);background:var(--ds-surface-subtle);border:1px solid var(--border);padding:3px 9px;border-radius:20px;}
.ac-points{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;flex:1;}
.ac-points li{font-size:13px;color:var(--muted);line-height:1.45;}
.ac-points li::marker{color:var(--ds-brand);}
.ac-cta{display:inline-flex;align-items:center;gap:5px;margin-top:14px;font-size:13px;font-weight:700;color:var(--ds-brand);}
.ac-cta-arrow{transition:transform .15s;}
.ac:hover .ac-cta-arrow{transform:translateX(3px);}

@media (prefers-reduced-motion: reduce){
  .hub-root *{transition:none!important;animation:none!important;}
}
`;
