"use client";
/**
 * Clipboard helper that never lies. `navigator.clipboard` only exists on
 * secure origins (https / localhost) — on plain HTTP (e.g. a LAN-IP staging
 * box) `navigator.clipboard?.writeText(x)` short-circuits to `await undefined`,
 * which RESOLVES, so naive callers show "Copied ✓" while nothing was copied.
 *
 * copyText() tries the async API first, falls back to the legacy
 * textarea + execCommand path (which still works on insecure origins), and
 * returns whether the copy actually happened so callers can show honest
 * feedback.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* permission denied or transient failure — try the legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
