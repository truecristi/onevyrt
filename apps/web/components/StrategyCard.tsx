"use client";
/**
 * StrategyCard — a compact, at-a-glance view of the founder's saved Golden
 * Example (the loss-leader / value-ladder strategy). Keeps the one spine that
 * drives every asset visible on the home dashboard and hubs, so the strategy
 * never gets buried. Self-scoped ("sc-" prefix), theme-aware, read-only; the
 * card links through to the Golden Example page to refine or regenerate.
 */
import type { GoldenExample } from "../lib/studio/golden-example";

export default function StrategyCard({ example }: { example: GoldenExample }) {
  const rungs = example.ladder.filter((r) => (r.name || r.stage));
  if (rungs.length === 0) return null;

  return (
    <a className="sc-root" href="/psychology/golden">
      <style>{CSS}</style>
      <div className="sc-head">
        <span className="sc-k">Your strategy</span>
        <span className="sc-go">Refine →</span>
      </div>
      <div className="sc-ladder">
        {rungs.map((r, i) => (
          <span className="sc-rung" key={i}>
            <span className="sc-rung-name">{r.name || r.stage}</span>
            {r.price && <span className="sc-rung-price">{r.price}</span>}
            {i < rungs.length - 1 && <span className="sc-arrow" aria-hidden>→</span>}
          </span>
        ))}
      </div>
      {example.usp && <div className="sc-usp">“{example.usp}”</div>}
    </a>
  );
}

const CSS = `
.sc-root{--sc-brand:var(--ds-brand);--sc-brand-hover:var(--ds-brand-hover);--sc-brand-soft:var(--ds-brand-soft);
  --sc-surface:var(--ds-surface);--sc-text:var(--ds-text-primary);--sc-muted:var(--ds-text-secondary);--sc-dim:var(--ds-text-tertiary);--sc-border:var(--ds-border-subtle);
  display:block;text-decoration:none;background:var(--sc-surface);border:1px solid var(--sc-border);border-radius:12px;padding:14px 16px;margin-bottom:18px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s;
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.sc-root:hover{border-color:var(--sc-brand);}
.sc-root *{box-sizing:border-box;}
.sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;}
.sc-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--sc-dim);}
.sc-go{font-size:12px;font-weight:700;color:var(--sc-brand);}
.sc-ladder{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.sc-rung{display:inline-flex;align-items:center;gap:7px;}
.sc-rung-name{font-size:13.5px;font-weight:700;color:var(--sc-text);}
.sc-rung-price{font-size:11.5px;font-weight:700;color:var(--sc-brand-hover);background:var(--sc-brand-soft);border-radius:6px;padding:1px 7px;}
.sc-arrow{color:var(--sc-dim);font-size:13px;margin:0 2px;}
.sc-usp{font-size:13px;color:var(--sc-muted);line-height:1.5;margin-top:10px;font-style:italic;}
`;
