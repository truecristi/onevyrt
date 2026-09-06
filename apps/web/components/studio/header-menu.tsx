"use client";
/**
 * Header dropdown-menu primitives (HeaderMenu + MenuItem/Divider/Label),
 * extracted from funnel-studio.tsx. Presentational, glass-styled, with a
 * click-outside close. Imported back by funnel-studio.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ACCENT, barBtn, GLASS_PANEL_CLASS } from "../../lib/studio-ui";

export function HeaderMenu({ label, title, children, badge, align = "left" }: { label: ReactNode; title?: string; children: ReactNode; badge?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && e.target instanceof globalThis.Node && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} title={title} style={{ ...barBtn, border: `1px solid ${open ? ACCENT : "var(--border2)"}`, color: open ? ACCENT : barBtn.color }}>
        {label}{badge ? <span style={{ color: "#dc2626" }}> •</span> : null}
      </button>
      {open && (
        <div className={GLASS_PANEL_CLASS}
          style={{ position: "absolute", top: "calc(100% + 6px)", ...(align === "right" ? { right: 0 } : { left: 0 }), minWidth: 240, maxWidth: "min(280px, calc(100vw - 24px))", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 14, boxShadow: "var(--shadow-panel)", padding: 6, zIndex: 70, display: "flex", flexDirection: "column", gap: 1 }}>
          {children}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ onClick, children, disabled, danger, title }: { onClick: () => void; children: ReactNode; disabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 13,
        color: disabled ? "var(--dim)" : danger ? "#dc2626" : "var(--text)", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--accent-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {children}
    </button>
  );
}
export function MenuDivider() { return <div style={{ height: 1, background: "var(--border2)", margin: "4px 2px" }} />; }
export function MenuLabel({ children }: { children: ReactNode }) { return <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, padding: "6px 10px 2px" }}>{children}</div>; }
