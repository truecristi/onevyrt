"use client";
/**
 * Explain — a plain-language "what does this mean?" affordance for any bit of
 * jargon in the app. Pass a glossary term; it renders a small "?" chip (or
 * wraps children with a dotted underline) that pops a short definition on
 * click. Self-scoped ("ex-" prefix), theme-aware, keyboard- and outside-click
 * dismissible. Renders its children plainly (or nothing) when the term is
 * unknown, so it's always safe to drop in.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { lookupTerm } from "../lib/studio/glossary";

export interface ExplainProps {
  /** A glossary term or alias (case/space-insensitive). */
  term: string;
  /** Optional text to wrap; without it, a standalone "?" chip is shown. */
  children?: ReactNode;
}

export default function Explain({ term, children }: ExplainProps) {
  const entry = lookupTerm(term);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Unknown term → don't invent an explanation; just render the children as-is.
  if (!entry) return <>{children ?? null}</>;

  return (
    <span className="ex" ref={rootRef}>
      <style>{CSS}</style>
      {children ? (
        <button type="button" className="ex-inline" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          {children}<span className="ex-mark" aria-hidden>?</span>
        </button>
      ) : (
        <button type="button" className="ex-chip" aria-label={`What does "${entry.term}" mean?`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>?</button>
      )}
      {open && (
        <span className="ex-pop" id={panelId} role="group" aria-labelledby={`${panelId}-term`}>
          <span className="ex-term" id={`${panelId}-term`}>{entry.term}</span>
          <span className="ex-short">{entry.short}</span>
          <span className="ex-plain">{entry.plain}</span>
          {entry.why && <span className="ex-why"><b>Why it matters:</b> {entry.why}</span>}
          <a className="ex-more" href="/glossary">Full glossary →</a>
        </span>
      )}
    </span>
  );
}

const CSS = `
.ex{position:relative;display:inline;}
.ex-inline{font:inherit;color:inherit;background:none;border:none;padding:0;cursor:help;border-bottom:1px dotted currentColor;}
.ex-mark{font-size:.7em;vertical-align:super;margin-left:1px;opacity:.7;font-weight:700;}
.ex-chip{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:4px;border-radius:50%;border:none;cursor:pointer;font-size:10px;font-weight:700;line-height:1;
  background:var(--ds-brand-soft,#e7f6f0);color:var(--ds-brand-active,#066b46);vertical-align:middle;}
.ex-chip:hover{filter:brightness(.96);}
.ex-pop{position:absolute;z-index:60;top:calc(100% + 6px);left:0;display:flex;flex-direction:column;gap:5px;width:min(280px,78vw);text-align:left;
  background:var(--ds-surface,#fff);color:var(--ds-text-primary,#111827);border:1px solid var(--ds-border-default,#dde3eb);border-radius:12px;
  padding:12px 14px;box-shadow:0 12px 30px -10px rgba(15,23,42,.28);font-weight:400;white-space:normal;}
:root[data-theme="dark"] .ex-pop{background:#141b2d;color:#f8fafc;border-color:rgba(148,163,184,.2);}
.ex-term{font-size:13px;font-weight:700;letter-spacing:-.2px;}
.ex-short{font-size:12.5px;font-weight:500;color:var(--ds-brand,#0a9e6e);}
.ex-plain{font-size:12.5px;line-height:1.5;color:var(--ds-text-secondary,#475569);}
:root[data-theme="dark"] .ex-plain{color:#cbd5e1;}
.ex-why{font-size:12px;line-height:1.5;color:var(--ds-text-secondary,#475569);} .ex-why b{color:var(--ds-text-primary,#111827);font-weight:700;}
:root[data-theme="dark"] .ex-why{color:#cbd5e1;} :root[data-theme="dark"] .ex-why b{color:#f8fafc;}
.ex-more{font-size:11.5px;font-weight:700;color:var(--ds-brand,#0a9e6e);text-decoration:none;margin-top:2px;}
`;
