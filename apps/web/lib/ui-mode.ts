/**
 * Experience level — "Guided" (beginner) vs "Pro" (advanced). A pure beginner
 * should not be overwhelmed by every advanced tool at once; a power user should
 * not be slowed by hand-holding. This is one shared preference that drives
 * progressive disclosure across the app via a single `data-uimode` attribute on
 * the document root, so elements opt in with a class instead of prop-threading:
 *
 *   <p className="gb-guided-only">…helpful hint…</p>   (hidden in Pro)
 *   <button className="gb-pro-only">…advanced tool…</button>  (hidden in Guided)
 *
 * The matching CSS lives in lib/studio/theme-css.ts. Default is "guided" so a
 * first-time user gets the gentler experience until they choose otherwise.
 */
export type UiMode = "guided" | "pro";

const KEY = "gearbox:ui-mode";

export function loadUiMode(): UiMode {
  if (typeof window === "undefined") return "guided";
  try {
    return localStorage.getItem(KEY) === "pro" ? "pro" : "guided";
  } catch {
    return "guided";
  }
}

export function saveUiMode(mode: UiMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode etc. — non-fatal */
  }
}

/** Reflect the mode onto <html data-uimode="…"> so the CSS rules apply
 *  document-wide (studio, landing, writer — every screen). */
export function applyUiMode(mode: UiMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-uimode", mode);
}
