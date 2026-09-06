/**
 * Dark mode theme preference management. Uses localStorage to persist
 * the user's light/dark choice. The no-flash init script in layout.tsx
 * reads this immediately on page load to prevent a flash of the wrong theme.
 *
 * Dark mode is EXPLICIT — applied only when [data-theme="dark"] is set on <html>.
 * Default is "light" for predictable, deterministic behavior on unauthenticated pages.
 */

export type ThemeMode = "light" | "dark";

const KEY = "gb-theme";

/**
 * Load the user's saved theme preference from localStorage.
 * Defaults to "light" if no preference is saved.
 */
export function loadThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Save the user's theme preference to localStorage.
 * Safe to call in any context (handles private mode gracefully).
 */
export function saveThemeMode(theme: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode, storage quota exceeded, etc. — non-fatal */
  }
}

/**
 * Apply the theme to the DOM by setting <html data-theme="light|dark">.
 * Called immediately after loading or when the user toggles the theme.
 * The CSS layer reads this attribute to switch all --ds-* and --gear-* tokens.
 */
export function applyThemeMode(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Toggle between light and dark themes.
 * Saves to localStorage and applies immediately.
 */
export function toggleThemeMode(): ThemeMode {
  const current = loadThemeMode();
  const next = current === "dark" ? "light" : "dark";
  saveThemeMode(next);
  applyThemeMode(next);
  return next;
}

/**
 * Get the current theme from the DOM (what's actually applied).
 * Useful for checking what's visible right now vs what's saved.
 */
export function getCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" ? "dark" : "light";
}
