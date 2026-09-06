"use client";
/**
 * "What's new" modal — reads the changelog (/api/changelog) and shows the
 * recent releases. Self-contained and additive: opened from the command
 * palette, closed on backdrop click or Esc. The API is ETagged, so re-opening
 * is cheap.
 */
import { useEffect, useRef, useState } from "react";
import { useDialogA11y } from "../../lib/use-dialog-a11y";
import type { ChangelogEntry, ChangeTag } from "../../lib/changelog";

const TAG_STYLE: Record<ChangeTag, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "var(--good-border)", bg: "var(--accent-soft)" },
  improved: { label: "Improved", color: "#1f6feb", bg: "rgba(31,111,235,0.14)" },
  fixed: { label: "Fixed", color: "var(--muted)", bg: "var(--chip)" },
};

export function WhatsNew({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((d: { entries: ChangelogEntry[] }) => { if (live) setEntries(d.entries ?? []); })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);

  // Focus trap on the panel + Escape + focus-restore (was Escape-only).
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, onClose);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "center",
        alignItems: "flex-start", paddingTop: "10vh", background: "rgba(0,0,0,0.32)",
        backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      }}
    >
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 92vw)", maxHeight: "76vh", display: "flex", flexDirection: "column",
          background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 16,
          boxShadow: "var(--shadow-panel)", backdropFilter: "blur(26px) saturate(1.7)",
          WebkitBackdropFilter: "blur(26px) saturate(1.7)", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 15 }}>What&apos;s new</strong>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 16px 18px" }}>
          {err && <p style={{ color: "var(--muted)", fontSize: 13 }}>Couldn&apos;t load updates right now.</p>}
          {!entries && !err && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}
          {entries?.map((e) => {
            const t = TAG_STYLE[e.tag];
            return (
              <section key={`${e.date}-${e.title}`} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-soft, rgba(128,128,128,0.12))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: t.color, background: t.bg, padding: "2px 7px", borderRadius: 6 }}>{t.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--dim)", marginLeft: "auto" }}>{e.date}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                  {e.items.map((it, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>{it}</li>)}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
