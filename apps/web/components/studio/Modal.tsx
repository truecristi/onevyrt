"use client";
/**
 * The shared modal shell: the glass overlay, the centered panel, a header with
 * a title and a close button, and a scrollable body. Several studio dialogs
 * (landing audit, funnel audit, what's-new…) reimplemented this same chrome;
 * this is the one copy. Click-outside and the × both close; Escape closes too.
 */
import { useRef, type ReactNode } from "react";
import { useDialogA11y } from "../../lib/use-dialog-a11y";

export function Modal({ title, onClose, children, width = 620 }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  // Trap focus in the panel (not the backdrop), close on Escape, and restore
  // focus to the opener — the shared a11y contract every dialog needs.
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, onClose);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh", background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 94vw)`, maxHeight: "84vh", display: "flex", flexDirection: "column", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--shadow-panel)", backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
