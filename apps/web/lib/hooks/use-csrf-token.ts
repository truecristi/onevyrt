/**
 * React hook to access the CSRF token in client-side code.
 *
 * The cookie and the header need DIFFERENT values — see
 * components/SecurityInitializer.tsx's header comment for the full
 * raw-cookie / signed-header design and the bug this replaced (this hook
 * used to hand back the raw cookie value as `headerValue` too, which
 * validateCsrf() can never accept — it requires the header to carry a
 * validly-signed `token.signature` pair). The signed value is only ever
 * available via the meta tag SecurityInitializer renders server-side (the
 * signing secret never reaches the client), so `headerValue` is read from
 * there, not from the cookie.
 *
 * Usage:
 *   const { headerValue } = useCSRFToken();
 *   const response = await fetch("/api/foo", {
 *     method: "POST",
 *     headers: {
 *       "x-csrf-token": headerValue ?? "",
 *       "content-type": "application/json",
 *     },
 *     body: JSON.stringify(data),
 *   });
 */

"use client";

import { useMemo } from "react";
import { CSRF_COOKIE } from "../middleware/csrf";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name && value !== undefined) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

function readSignedTokenFromMeta(): string | null {
  if (typeof document === "undefined") return null;
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? null;
}

export interface UseCSRFTokenResult {
  /** The raw CSRF token from the cookie (informational — the browser already
   *  sends this automatically as a cookie; requests don't need to read it). */
  token: string | null;
  /** The signed token to send in the x-csrf-token header. */
  headerValue: string | null;
  /** Whether both the cookie and the signed meta tag were found. */
  isReady: boolean;
}

export function useCSRFToken(): UseCSRFTokenResult {
  const result = useMemo<UseCSRFTokenResult>(() => {
    const token = readCookie(CSRF_COOKIE);
    const headerValue = readSignedTokenFromMeta();

    if (!token || !headerValue) {
      return { token: null, headerValue: null, isReady: false };
    }

    return { token, headerValue, isReady: true };
  }, []);

  return result;
}
