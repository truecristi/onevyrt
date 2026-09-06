"use client";
/**
 * ⌘K command palette overlay. A thin shell over the pure ranking engine
 * (lib/studio/command-palette): a search box, a live-filtered list, and
 * keyboard navigation (↑/↓ to move, Enter to run, Esc to close). Each command
 * carries a `run` action the host wires to a real studio operation. Additive —
 * it renders only while open and never touches the canvas except by running
 * the command the user chose.
 *
 * Self-contained styling ("ovcp-" prefix): the palette mounts globally via
 * AppNav, so it must NOT depend on the funnel-studio-only tokens
 * (--glass-bg etc.) that lib/studio/theme-css.ts injects on that one page —
 * on every other page those resolve to nothing and the panel went transparent.
 * It carries its own light/dark palette, keyed off :root[data-theme="dark"]
 * like every other shared component.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCommands, type Command } from "../../lib/studio/command-palette";

export type PaletteCommand = Command & { run: () => void };

export function CommandPalette({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => filterCommands(commands, query, 40) as PaletteCommand[], [commands, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSel(0); }, [query]);
  // Restore focus to whatever opened the palette when it closes (a11y).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, []);
  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (c?: PaletteCommand) => { if (!c) return; onClose(); c.run(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab") {
      // Trap Tab within the panel so focus can't wander to the page behind.
      const f = panelRef.current?.querySelectorAll<HTMLElement>('input,button:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (!f || f.length === 0) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={onClose} className="ovcp-overlay">
      <style>{CSS}</style>
      <div ref={panelRef} className="ovcp-panel" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command…"
          aria-label="Search commands"
          className="ovcp-input"
        />
        <div ref={listRef} className="ovcp-list">
          {results.length === 0 && <div className="ovcp-empty">No matching command.</div>}
          {results.map((c, i) => (
            <button
              key={c.id}
              data-idx={i}
              onClick={() => run(c)}
              onMouseMove={() => setSel(i)}
              className={`ovcp-item${i === sel ? " on" : ""}`}
            >
              <span className="ovcp-item-main">
                <span className="ovcp-item-title">{c.title}</span>
                {c.section && <span className="ovcp-item-section">{c.section}</span>}
              </span>
              {c.shortcut && <kbd className="ovcp-kbd">{c.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ovcp-overlay{
  --ovcp-panel:rgba(255,255,255,0.92);--ovcp-panel-border:#dde3eb;--ovcp-text:#111827;--ovcp-muted:#475569;--ovcp-dim:#64748b;
  --ovcp-row-border:#e8ecf2;--ovcp-hover:rgba(10,158,110,0.12);
  --ovcp-shadow:0 24px 60px -18px rgba(40,54,90,0.28),0 0 0 1px rgba(40,54,90,0.04);
  position:fixed;inset:0;z-index:1000;display:flex;justify-content:center;align-items:flex-start;
  padding-top:12vh;background:rgba(15,23,42,0.36);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .ovcp-overlay{
  --ovcp-panel:rgba(20,27,45,0.94);--ovcp-panel-border:rgba(148,163,184,0.22);--ovcp-text:#f8fafc;--ovcp-muted:#cbd5e1;--ovcp-dim:#94a3b8;
  --ovcp-row-border:rgba(148,163,184,0.12);--ovcp-hover:rgba(63,211,158,0.16);
  --ovcp-shadow:0 24px 60px -16px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06);
  background:rgba(0,0,0,0.5);}
.ovcp-overlay *{box-sizing:border-box;}
.ovcp-panel{width:min(560px,92vw);max-height:68vh;display:flex;flex-direction:column;
  background:var(--ovcp-panel);border:1px solid var(--ovcp-panel-border);border-radius:16px;
  box-shadow:var(--ovcp-shadow);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);overflow:hidden;}
.ovcp-input{border:none;border-bottom:1px solid var(--ovcp-row-border);background:transparent;
  color:var(--ovcp-text);padding:14px 16px;font-size:15px;outline:none;font-family:inherit;}
.ovcp-input::placeholder{color:var(--ovcp-dim);}
.ovcp-list{overflow-y:auto;padding:6px;}
.ovcp-empty{padding:18px 12px;color:var(--ovcp-muted);font-size:13px;}
.ovcp-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  text-align:left;border:none;border-radius:9px;padding:9px 11px;cursor:pointer;
  background:transparent;color:var(--ovcp-text);font-family:inherit;}
.ovcp-item.on{background:var(--ovcp-hover);}
.ovcp-item-main{display:flex;flex-direction:column;gap:1px;min-width:0;}
.ovcp-item-title{font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ovcp-item-section{font-size:11px;color:var(--ovcp-dim);}
.ovcp-kbd{font-size:11px;color:var(--ovcp-muted);font-family:ui-monospace,monospace;}
`;
