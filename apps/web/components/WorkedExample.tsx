"use client";
/**
 * WorkedExample — a drop-in "here's one done for you" panel for any AI step.
 * Expandable so it never gets in the way, it shows three things a
 * non-technical founder needs before a blank box makes sense: the thinking,
 * exactly what to put in, and what comes out. Self-scoped ("we-" prefix),
 * theme-aware, no dependencies beyond the worked-examples data.
 */
import { useState } from "react";
import { workedExample, type WorkedExample as WE } from "../lib/studio/worked-examples";

export default function WorkedExample({ id, defaultOpen = false, onUse, useLabel = "Use this example" }: {
  id: string;
  defaultOpen?: boolean;
  /** When given, a "Use this example" button appears that hands the example back
   *  so the page can prefill its inputs. */
  onUse?: (ex: WE) => void;
  useLabel?: string;
}) {
  const ex = workedExample(id);
  const [open, setOpen] = useState(defaultOpen);
  if (!ex) return null;

  return (
    <div className={`we-root${open ? " open" : ""}`}>
      <style>{CSS}</style>
      <button className="we-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="we-badge">Example</span>
        <span className="we-title">See {ex.step.toLowerCase()} done — what to write to get a good result</span>
        <span className="we-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="we-body">
          <div className="we-block">
            <div className="we-k">The thinking</div>
            <p className="we-thought">{ex.thought}</p>
          </div>

          <div className="we-block">
            <div className="we-k">What to put in</div>
            <div className="we-fields">
              {ex.inputs.map((f, i) => (
                <div className="we-field" key={i}>
                  <div className="we-flabel">{f.label}</div>
                  <div className="we-fvalue">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="we-block">
            <div className="we-k">What you get</div>
            <div className="we-output">{ex.output}</div>
          </div>

          {ex.next && <div className="we-next">→ {ex.next}</div>}

          {onUse && (
            <button className="we-use" onClick={() => onUse(ex)}>{useLabel}</button>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.we-root{--we-brand:var(--ds-brand);--we-brand-hover:var(--ds-brand-hover);--we-brand-soft:var(--ds-brand-soft);
  --we-surface:#fff;--we-subtle:#fafbfc;--we-text:#111827;--we-muted:#475569;--we-dim:#64748b;--we-border:#e8ecf2;--we-border2:#dde3eb;
  background:var(--we-surface);border:1px solid var(--we-border2);border-radius:12px;margin:0 0 14px;overflow:hidden;
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .we-root{--we-surface:#141b2d;--we-subtle:#182136;--we-text:#f8fafc;--we-muted:#cbd5e1;--we-dim:#94a3b8;
  --we-border:rgba(148,163,184,.14);--we-border2:rgba(148,163,184,.2);--we-brand-soft:#0e2b22;}
.we-root.open{border-color:var(--we-brand);}
.we-root *{box-sizing:border-box;}
.we-head{width:100%;display:flex;align-items:center;gap:10px;background:transparent;border:none;cursor:pointer;padding:12px 14px;text-align:left;color:var(--we-text);}
.we-badge{flex:0 0 auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:var(--we-brand);border-radius:6px;padding:3px 8px;}
.we-title{flex:1;font-size:13.5px;font-weight:700;line-height:1.4;}
.we-caret{flex:0 0 auto;color:var(--we-dim);font-size:12px;transition:transform .2s;}
.we-root.open .we-caret{transform:rotate(180deg);}
.we-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:13px;}
.we-block{}
.we-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--we-brand);margin-bottom:6px;}
.we-thought{font-size:13.5px;color:var(--we-muted);line-height:1.6;margin:0;}
.we-fields{display:flex;flex-direction:column;gap:7px;}
.we-field{background:var(--we-subtle);border:1px solid var(--we-border);border-radius:9px;padding:9px 12px;}
.we-flabel{font-size:11px;font-weight:700;color:var(--we-dim);margin-bottom:2px;}
.we-fvalue{font-size:13.5px;color:var(--we-text);line-height:1.5;}
.we-output{background:var(--we-brand-soft);border:1px solid var(--we-brand);border-radius:10px;padding:11px 13px;font-size:13.5px;color:var(--we-text);line-height:1.6;}
.we-next{font-size:12.5px;color:var(--we-muted);line-height:1.5;font-weight:500;}
.we-use{align-self:flex-start;background:var(--we-brand);color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;}
.we-use:hover{background:var(--we-brand-hover);}
`;
