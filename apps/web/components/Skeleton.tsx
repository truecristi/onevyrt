"use client";
/**
 * Skeleton loaders — content-shaped placeholders that show a page's structure
 * while its data loads, instead of a bare centred spinner. Self-contained and
 * theme-aware (light/dark) so they drop into any surface regardless of that
 * page's own tokens; each variant renders the shared shimmer <style> once, so a
 * loading branch that uses a single variant injects the CSS a single time.
 */
import type { CSSProperties, ReactNode } from "react";

/** One shimmer bar. width/height accept any CSS length; radius in px. */
export function SkeletonBar({ w = "100%", h = 12, r = 7, style }: { w?: string | number; h?: string | number; r?: number; style?: CSSProperties }) {
  return <span className="sk-bar" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** A list of row placeholders — for the Leads inbox, Funnels list, etc. */
export function SkeletonList({ rows = 5, title = true }: { rows?: number; title?: boolean }) {
  return (
    <Frame>
      {title && <SkeletonBar w="42%" h={22} r={8} style={{ marginBottom: 18 }} />}
      <div className="sk-rows">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="sk-row" key={i}>
            <div className="sk-row-main">
              <SkeletonBar w={`${55 + ((i * 7) % 30)}%`} h={14} />
              <SkeletonBar w={`${30 + ((i * 11) % 25)}%`} h={11} style={{ marginTop: 8 }} />
            </div>
            <SkeletonBar w={64} h={26} r={8} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** A grid of card placeholders — for galleries (Community, Campaigns templates). */
export function SkeletonCards({ count = 6, minWidth = 240, title = true }: { count?: number; minWidth?: number; title?: boolean }) {
  return (
    <Frame>
      {title && <SkeletonBar w="38%" h={22} r={8} style={{ marginBottom: 18 }} />}
      <div className="sk-grid" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${minWidth}px,1fr))` }}>
        {Array.from({ length: count }).map((_, i) => (
          <div className="sk-card" key={i}>
            <SkeletonBar w="40%" h={10} r={5} />
            <SkeletonBar w="85%" h={15} style={{ marginTop: 10 }} />
            <SkeletonBar w="100%" h={11} style={{ marginTop: 10 }} />
            <SkeletonBar w="70%" h={11} style={{ marginTop: 6 }} />
            <SkeletonBar w={90} h={28} r={8} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** A row of stat-tile placeholders — for dashboards (Command Center, Insights). */
export function SkeletonStats({ n = 4, minWidth = 150 }: { n?: number; minWidth?: number }) {
  return (
    <Frame>
      <SkeletonBar w="48%" h={24} r={8} style={{ marginBottom: 16 }} />
      <div className="sk-grid" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${minWidth}px,1fr))` }}>
        {Array.from({ length: n }).map((_, i) => (
          <div className="sk-card" key={i}>
            <SkeletonBar w="55%" h={24} r={7} />
            <SkeletonBar w="70%" h={11} style={{ marginTop: 10 }} />
            <SkeletonBar w="45%" h={10} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="sk-root" aria-busy="true" aria-live="polite"><style>{SK_CSS}</style><span className="sk-a11y">Loading…</span>{children}</div>;
}

const SK_CSS = `
.sk-root{--sk-base:#e9edf3;--sk-hi:#f4f7fb;--sk-card:#ffffff;--sk-border:#e8ecf2;}
.sk-a11y{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
.sk-bar{display:block;background:linear-gradient(90deg,var(--sk-base) 25%,var(--sk-hi) 37%,var(--sk-base) 63%);background-size:400% 100%;animation:sk-shimmer 1.4s ease infinite;}
.sk-rows{display:flex;flex-direction:column;gap:8px;}
.sk-row{display:flex;align-items:center;gap:12px;background:var(--sk-card);border:1px solid var(--sk-border);border-radius:12px;padding:15px;}
.sk-row-main{flex:1;min-width:0;}
.sk-grid{display:grid;gap:10px;}
.sk-card{background:var(--sk-card);border:1px solid var(--sk-border);border-radius:12px;padding:14px;}
@keyframes sk-shimmer{0%{background-position:100% 50%;}100%{background-position:0 50%;}}
@media(prefers-reduced-motion:reduce){.sk-bar{animation-duration:2.6s;}}
:root[data-theme="dark"] .sk-root{--sk-base:#20242e;--sk-hi:#2b313d;--sk-card:#151820;--sk-border:#242833;}
`;
