"use client";
/**
 * Accessibility plumbing shared by every modal/overlay: Escape to close, a
 * focus trap so Tab cycles within the dialog instead of escaping to the page
 * behind it, and focus RETURN — when the dialog closes, focus goes back to
 * whatever opened it, so keyboard and screen-reader users aren't dumped at the
 * top of the document. Pair with role="dialog" aria-modal="true" on the same
 * container so assistive tech announces it as a dialog.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useDialogA11y(ref, onClose);
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */
import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogA11y(containerRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog on open (first focusable, else the container).
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = focusables()[0];
    if (first) first.focus();
    else { container.setAttribute("tabindex", "-1"); container.focus(); }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) { e.preventDefault(); return; }
      const firstEl = els[0]!;
      const lastEl = els[els.length - 1]!;
      const active = document.activeElement;
      // Wrap around at both ends so focus never leaves the dialog.
      if (e.shiftKey && (active === firstEl || !container.contains(active))) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && (active === lastEl || !container.contains(active))) { e.preventDefault(); firstEl.focus(); }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Restore focus to the opener if it's still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [containerRef, onClose]);
}
