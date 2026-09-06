"use client";
/**
 * Studio shell — the LIGHT entry rendered at `/`, `/studio` and `/app`.
 *
 * It owns only the auth gate: it fetches the current user and shows the
 * marketing/sign-in surface (LandingPage / LoginForm — both light) to a
 * signed-out visitor. The heavy canvas (React Flow, jsPDF, ProgramCentre and
 * every studio panel) lives in ./funnel-studio and is loaded ON DEMAND via
 * next/dynamic only once a signed-in user actually needs it — so a signed-out
 * first load no longer downloads the whole studio just to render a sign-in box.
 *
 * This file must not statically import anything heavy; that's the whole point.
 */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LandingPage } from "../components/studio/LandingPage";
import { LoginForm } from "../components/studio/LoginForm";
import { THEME_CSS } from "../lib/studio/theme-css";

function LoadingScreen() {
  return (
    <div data-theme="light" className="gb-fill-min" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--canvas)", color: "var(--dim)", fontFamily: "var(--font-roboto), Roboto, Arial, \"Helvetica Neue\", Helvetica, sans-serif" }}>
      <style>{THEME_CSS}</style>
      {"Loading…"}
    </div>
  );
}

// The heavy studio, code-split into its own chunk. ssr:false because the studio
// is client-only anyway (localStorage, canvas, live fetches), so there's no
// server render to lose — only a chunk to defer until it's needed.
const StudioCanvas = dynamic(() => import("./funnel-studio").then((m) => m.StudioCanvas), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function StudioShell() {
  const [me, setMe] = useState<{ id: string; email: string; avatarUrl?: string; impersonatedBy?: string; superAdmin?: boolean } | null | undefined>(undefined);
  const [showLanding, setShowLanding] = useState(true);
  const [loginInitialMode, setLoginInitialMode] = useState<"login" | "register">("login");
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: { id?: string; email?: string; avatarUrl?: string; impersonatedBy?: string; superAdmin?: boolean } | null) => { if (live) setMe(u && u.id && u.email ? { id: u.id, email: u.email, avatarUrl: u.avatarUrl, impersonatedBy: u.impersonatedBy, superAdmin: u.superAdmin } : null); })
      .catch(() => { if (live) setMe(null); });
    return () => { live = false; };
  }, []);
  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* clear locally anyway */ }
    setMe(null);
  }, []);
  const onEmailChanged = useCallback((email: string) => setMe((m) => (m ? { ...m, email } : m)), []);
  const onAvatarChanged = useCallback((avatarUrl: string | undefined) => setMe((m) => (m ? { ...m, avatarUrl } : m)), []);
  const stopImpersonating = useCallback(async () => {
    try { await fetch("/api/auth/stop-impersonating", { method: "POST" }); } catch { /* fall through to reload regardless */ }
    window.location.href = "/admin";
  }, []);

  if (me === undefined) return <LoadingScreen />;
  if (me === null) {
    let resetToken: string | undefined;
    try { resetToken = new URLSearchParams(window.location.search).get("resetToken") ?? undefined; } catch { /* SSR-safe */ }
    // A password-reset link is a deep link into a specific flow, not a
    // first-time visit — always skip straight past the marketing page for it.
    if (showLanding && !resetToken) {
      return <LandingPage
        onGetStarted={() => { setLoginInitialMode("register"); setShowLanding(false); }}
        onSignIn={() => { setLoginInitialMode("login"); setShowLanding(false); }} />;
    }
    // On auth, route to the canonical home (/command-center) rather than the
    // Studio's own home view — so a brand-new registrant lands on the ONE Home
    // the redirect logic promises. A full navigation lets middleware + AppNav
    // mount cleanly. Existing users reach the Studio explicitly from there.
    return <LoginForm onAuthed={() => { window.location.assign("/command-center"); }} initialResetToken={resetToken} initialMode={loginInitialMode} />;
  }
  return <StudioCanvas user={me} onLogout={logout} onEmailChanged={onEmailChanged} onAvatarChanged={onAvatarChanged} impersonatedBy={me.impersonatedBy} onStopImpersonating={stopImpersonating} />;
}
