"use client";
/**
 * Global ⌘K launcher. Mounted once app-wide (in AppNav): press ⌘K / Ctrl+K
 * anywhere, type, and Enter jumps to any page. A thin wrapper that feeds the
 * app's nav targets into the existing CommandPalette overlay + fuzzy ranker.
 * Also exposes a tiny "⌘K" button for people who don't know the shortcut.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CommandPalette, type PaletteCommand } from "./studio/CommandPalette";
import { NAV_COMMANDS } from "../lib/nav-commands";

export default function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The palette overlay is position:fixed, but AppNav's <nav> sets a
  // backdrop-filter — which makes it the containing block for fixed
  // descendants, pinning the overlay to the ~50px nav strip. Portalling to
  // document.body escapes that so the overlay covers the real viewport.
  useEffect(() => { setMounted(true); }, []);

  // ⌘K / Ctrl+K toggles the palette from anywhere (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("gb-theme", next); } catch { /* private mode */ }
  };

  const commands: PaletteCommand[] = [
    ...NAV_COMMANDS.map((c) => ({
      id: c.id, title: c.title, section: c.section, keywords: c.keywords,
      run: () => router.push(c.href),
    })),
    // — Actions (not just navigation) —
    { id: "act-theme", title: "Toggle light / dark theme", section: "Actions", keywords: ["dark mode", "light mode", "appearance", "night"], run: toggleTheme },
  ];

  const openIt = useCallback(() => setOpen(true), []);

  return (
    <>
      <button type="button" className="gk-btn" aria-label="Open command palette (Ctrl+K)" title="Jump to… (Ctrl K)" onClick={openIt}>
        <span className="gk-k">⌘K</span>
      </button>
      <style>{CSS}</style>
      {open && mounted && createPortal(
        <CommandPalette commands={commands} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

const CSS = `
.gk-btn{display:inline-flex;align-items:center;gap:4px;background:var(--ds-surface-subtle,#f2f4f8);border:1px solid var(--ds-border-default,#dde3eb);color:var(--ds-text-secondary,#475569);border-radius:8px;padding:5px 9px;cursor:pointer;font:inherit;line-height:1;}
.gk-btn:hover{border-color:var(--ds-brand,#0a9e6e);color:var(--ds-text-primary,#111827);}
.gk-k{font-size:11px;font-weight:700;letter-spacing:.3px;}
:root[data-theme="dark"] .gk-btn{background:rgba(148,163,184,.12);border-color:rgba(148,163,184,.2);color:#cbd5e1;}
`;
