"use client";
/**
 * Keyboard-shortcuts cheat sheet, opened with "?" (see funnel-studio's global
 * key handler) or the help button. Discoverability for power users, who live
 * on the keyboard. Uses useDialogA11y so it traps focus, closes on Escape, and
 * returns focus to the opener — and is announced as a dialog.
 */
import { useRef } from "react";
import { useDialogA11y } from "../../lib/use-dialog-a11y";

// Uses the platform modifier glyph so Mac users see ⌘ and everyone else Ctrl.
function mod(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) return "⌘";
  return "Ctrl";
}

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  const M = mod();

  const groups: { title: string; items: [string, string][] }[] = [
    {
      title: "Editing",
      items: [
        [`${M} Z`, "Undo"],
        [`${M} ⇧ Z`, "Redo"],
        [`${M} D`, "Duplicate selected block"],
        ["Delete", "Remove selected block(s)"],
        [`${M} ⏎`, "Post a comment"],
      ],
    },
    {
      title: "Canvas",
      items: [
        ["Drag empty space", "Pan the canvas"],
        ["Scroll / pinch", "Zoom in and out"],
        ["Drag from library", "Add a block"],
        ["?", "Show this cheat sheet"],
      ],
    },
    {
      title: "Canvas — keyboard",
      items: [
        ["Tab / ⇧ Tab", "Move focus between blocks"],
        ["↑ ↓ ← →", "Nudge the focused block"],
        ["⇧ + arrows", "Move the focused block faster"],
      ],
    },
  ];

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", background: "var(--glass-bg)", backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)", border: "1px solid var(--glass-border)", borderRadius: 21, padding: 24, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Keyboard shortcuts</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "1px solid var(--border3)", borderRadius: 9, color: "var(--muted)", cursor: "pointer", padding: "3px 9px", fontSize: 13 }}>✕</button>
        </div>
        {groups.map((g) => (
          <div key={g.title} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 8 }}>{g.title.toUpperCase()}</div>
            {g.items.map(([keys, desc]) => (
              <div key={desc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{desc}</span>
                <kbd style={{ fontSize: 12, fontFamily: "var(--font-roboto), monospace", color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 7, padding: "2px 8px", whiteSpace: "nowrap" }}>{keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
