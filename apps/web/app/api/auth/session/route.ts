import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, logout } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

/**
 * Phase 8 security review finding: this mutates session state (destroys
 * the current session) but had no CSRF check, unlike every other
 * cookie-authenticated mutation in this codebase (Section 11's "verify on
 * every cookie-authenticated mutation"). A cross-site request could
 * otherwise force-logout a signed-in user - low severity on its own (it
 * destroys a session rather than reading or changing business data), but
 * still a real gap against this repo's own stated policy, and a known
 * stepping stone for login-CSRF attacks. Fixed to match every other
 * mutating route.
 */
export async function DELETE(request: NextRequest) {
  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  await logout();
  return NextResponse.json({ ok: true });
}
