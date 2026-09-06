"use client";
/**
 * PillarHub — the shared layout for the two supporting pillars (Numbers,
 * Execution). Psychology has its own richer hub; these two are grid hubs that
 * gather their tools. Accent color is per-pillar (indigo for Numbers, amber for
 * Execution). Self-scoped styles ("ph-" prefix), theme-aware.
 */
import type { ReactNode } from "react";
import { MarketingIcon, type MarketingIconName } from "./MarketingIcons";
import PillarFlow, { type PillarKey } from "./PillarFlow";

export interface PillarArea {
  key: string;
  icon: MarketingIconName;
  title: string;
  blurb: string;
  href?: string;
  soon?: boolean;
}

export interface PillarHubProps {
  eyebrow: string;
  title: string;
  sub: ReactNode;
  /** Accent hex — themes the header rule, icons and hovers. */
  accent: string;
  accentSoft: string;
  areas: PillarArea[];
  /** Which pillar this is — drives the prev/next flow footer. */
  current: PillarKey;
  /** Optional element shown at the top-right of the header (e.g. a live score). */
  headerAside?: ReactNode;
  /** Optional "do this next" nudge shown under the header. */
  nextNudge?: { label: string; href: string };
}

export default function PillarHub({ eyebrow, title, sub, accent, accentSoft, areas, current, headerAside, nextNudge }: PillarHubProps) {
  return (
    <div className="ph-root" style={{ ["--accent" as string]: accent, ["--accent-soft" as string]: accentSoft }}>
      <style>{CSS}</style>
      <div className="ph-header">
        <div className="ph-header-main">
          <div className="ph-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="ph-sub">{sub}</p>
        </div>
        {headerAside && <div className="ph-header-aside">{headerAside}</div>}
      </div>

      {nextNudge && (
        <a className="ph-next" href={nextNudge.href}><MarketingIcon name="bolt" size={14} /> {nextNudge.label} <span className="ph-next-arrow">→</span></a>
      )}

      <div className="ph-areas">
        {areas.map((a) => {
          const inner = (
            <>
              <div className="ph-head">
                <span className="ph-ic"><MarketingIcon name={a.icon} size={20} /></span>
                <div className="ph-titles">
                  <div className="ph-title">{a.title}</div>
                  <div className="ph-blurb">{a.blurb}</div>
                </div>
                {a.soon && <span className="ph-soon">Coming soon</span>}
                {a.href && !a.soon && <span className="ph-open">Open →</span>}
              </div>
            </>
          );
          return a.href
            ? <a className="ph-card" key={a.key} href={a.href}>{inner}</a>
            : <div className="ph-card ph-card-soon" key={a.key}>{inner}</div>;
        })}
      </div>

      <PillarFlow current={current} />
    </div>
  );
}

const CSS = `
.ph-root{
  max-width:1000px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--ds-text-primary);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.ph-root *{box-sizing:border-box;}
.ph-header{margin-bottom:18px;border-left:3px solid var(--accent);padding-left:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;}
.ph-header-main{flex:1;min-width:min(100%,340px);}
.ph-header-aside{flex:0 0 auto;}
.ph-header h1{font-size:27px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.ph-eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--accent);text-transform:uppercase;}
.ph-sub{color:var(--ds-text-secondary);font-size:14px;margin:0;max-width:68ch;line-height:1.55;}
.ph-sub b{color:var(--ds-text-primary);font-weight:700;}
.ph-next{display:inline-flex;align-items:center;gap:7px;margin-bottom:16px;background:var(--accent-soft);color:var(--accent);border:1px solid color-mix(in srgb, var(--accent) 30%, transparent);border-radius:10px;padding:9px 14px;font-size:13px;font-weight:700;text-decoration:none;transition:transform .15s;}
.ph-next:hover{transform:translateX(2px);}
.ph-next svg{color:var(--accent);}
.ph-next-arrow{font-weight:700;}
.ph-areas{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:720px){.ph-areas{grid-template-columns:1fr;}}
.ph-card{display:block;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:16px 18px;box-shadow:var(--ds-shadow-xs);text-decoration:none;color:var(--ds-text-primary);transition:border-color .15s,transform .15s,box-shadow .15s;}
.ph-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 10px 22px -14px color-mix(in srgb, var(--accent) 55%, transparent);}
.ph-card-soon{opacity:.82;}
.ph-head{display:flex;align-items:center;gap:12px;}
.ph-ic{width:38px;height:38px;flex:0 0 auto;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;}
.ph-titles{flex:1;min-width:0;}
.ph-title{font-size:15.5px;font-weight:700;}
.ph-blurb{font-size:12.5px;color:var(--ds-text-tertiary);margin-top:2px;line-height:1.4;}
.ph-open{flex:0 0 auto;font-size:12.5px;font-weight:700;color:var(--accent);}
.ph-soon{flex:0 0 auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);background:var(--ds-surface-subtle);border:1px solid var(--ds-border-subtle);padding:3px 9px;border-radius:20px;}
`;
