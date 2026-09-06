"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BrandLogo } from "../BrandLogo";

export function LoginForm({ onAuthed, initialResetToken, initialMode }: { onAuthed: (user: { id: string; email: string }) => void; initialResetToken?: string; initialMode?: "login" | "register" }) {
  // Theme-aware so a dark-mode visitor arriving from the (dark) landing page
  // doesn't get flashed a bright white form. Resolved on the client after
  // mount from the saved preference, else the OS setting; default light.
  const [dark, setDark] = useState(false);
  // Read the single resolved theme the app-wide init script set on <html>.
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  const green = dark ? "#30D158" : "#088057";
  const onGreen = dark ? "#04140b" : "#fff";
  const C = dark
    ? { text: "#F5F5F7", muted: "#98989F", faint: "#8E8E93", ground: "#000000",
        cardBg: "rgba(44,44,48,0.72)", cardBorder: "rgba(255,255,255,0.12)",
        cardShadow: "0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        fieldBg: "rgba(255,255,255,0.06)", fieldBorder: "#48484A",
        msgBg: "rgba(48,209,88,0.14)", msgText: "#30D158", errText: "#FF6961",
        bloomA: "rgba(48,209,88,0.11)", bloomB: "rgba(120,110,255,0.10)" }
    : { text: "#1e2c46", muted: "#586687", faint: "#9aa0a6", ground: "#F2F2F7",
        cardBg: "rgba(255,255,255,0.6)", cardBorder: "rgba(255,255,255,0.6)",
        cardShadow: "0 10px 40px rgba(90,100,170,0.16), inset 0 1px 0 rgba(255,255,255,0.55)",
        fieldBg: "rgba(255,255,255,0.85)", fieldBorder: "#d7dbe6",
        msgBg: "#e6f4ea", msgText: "#188038", errText: "#d93025",
        bloomA: "rgba(10,158,110,0.08)", bloomB: "rgba(106,92,240,0.07)" };
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset" | "2fa">(initialResetToken ? "reset" : initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [twofaCode, setTwofaCode] = useState("");

  const submit = async () => {
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      // A referral code travels as ?ref=CODE on the link a referrer shares;
      // only wired into the register call — logging in has no code to record.
      const ref = mode === "register" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
      const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, ...(ref ? { ref } : {}) }) });
      const data = await r.json() as { id?: string; email?: string; needs2fa?: boolean; pendingToken?: string; error?: string };
      if (!r.ok) { setErr(data.error ?? "Something went wrong."); setBusy(false); return; }
      if (data.needs2fa && data.pendingToken) { setPendingToken(data.pendingToken); setMode("2fa"); setBusy(false); return; }
      if (!data.id || !data.email) { setErr(data.error ?? "Something went wrong."); setBusy(false); return; }
      onAuthed({ id: data.id, email: data.email });
    } catch { setErr("Network error — is the app reachable?"); setBusy(false); }
  };

  const submit2fa = async () => {
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/login-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pendingToken, code: twofaCode }) });
      const data = await r.json() as { id?: string; email?: string; error?: string };
      setBusy(false);
      if (!r.ok || !data.id || !data.email) { setErr(data.error ?? "Incorrect code."); return; }
      onAuthed({ id: data.id, email: data.email });
    } catch { setErr("Network error — is the app reachable?"); setBusy(false); }
  };

  const submitForgot = async () => {
    if (busy) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await r.json() as { ok?: boolean; message?: string; error?: string };
      setBusy(false);
      if (!r.ok) { setErr(data.error ?? "Something went wrong."); return; }
      setMsg(data.message ?? "If that email is registered, a reset link is on its way.");
    } catch { setErr("Network error — is the app reachable?"); setBusy(false); }
  };

  const submitReset = async () => {
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: initialResetToken, password: newPassword }) });
      const data = await r.json() as { ok?: boolean; error?: string };
      setBusy(false);
      if (!r.ok) { setErr(data.error ?? "Something went wrong."); return; }
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* non-fatal */ }
      setMode("login"); setMsg("Password reset — sign in with your new password."); setPassword(""); setNewPassword("");
    } catch { setErr("Network error — is the app reachable?"); setBusy(false); }
  };

  // fontSize 16 (not 13) is deliberate: anything smaller makes iOS Safari
  // auto-zoom the whole page on focus, which then has to be manually
  // zoomed back out — the single most common mobile-form annoyance.
  // minHeight 44 matches the WCAG 2.5.5 touch-target guideline.
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", background: C.fieldBg, border: `1px solid ${C.fieldBorder}`, borderRadius: 10, color: C.text, padding: "11px 13px", fontSize: 16, minHeight: 44, marginTop: 6, outlineColor: green };
  const label: CSSProperties = { fontSize: 13, color: C.muted, fontWeight: 500 };
  const title = mode === "login" ? "Sign in to your workspace" : mode === "register" ? "Create your workspace"
    : mode === "forgot" ? "Reset your password" : mode === "2fa" ? "Enter your 2FA code" : "Choose a new password";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(800px 600px at 20% 0%, ${C.bloomA}, transparent 60%), radial-gradient(700px 560px at 85% 10%, ${C.bloomB}, transparent 55%), ${C.ground}`, fontFamily: "var(--font-roboto), Roboto, Arial, \"Helvetica Neue\", Helvetica, sans-serif", padding: 20 }}>
      <div style={{ width: 360, maxWidth: "100%", background: C.cardBg, backdropFilter: "blur(26px) saturate(175%)", WebkitBackdropFilter: "blur(26px) saturate(175%)", border: `1px solid ${C.cardBorder}`, borderRadius: 21, padding: 28, boxShadow: C.cardShadow }}>
        <div style={{ marginBottom: 6 }}><BrandLogo size={28} color={green} wordmarkColor={C.text} interactive /></div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>{title}</div>

        {msg && <div style={{ color: C.msgText, fontSize: 13, marginBottom: 14, padding: "8px 10px", background: C.msgBg, borderRadius: 6 }}>{msg}</div>}

        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <label style={label}>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void (mode === "forgot" ? submitForgot() : submit()); }} style={field} autoComplete="email" />
          </label>
        )}
        {(mode === "login" || mode === "register") && (<>
          <div style={{ height: 14 }} />
          <label style={label}>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} style={field} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
        </>)}
        {mode === "reset" && (
          <label style={label}>New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submitReset(); }} style={field} autoComplete="new-password" placeholder="At least 8 characters" />
          </label>
        )}
        {mode === "2fa" && (
          <label style={label}>6-digit code (or a backup code)
            <input type="text" inputMode="numeric" value={twofaCode} onChange={(e) => setTwofaCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit2fa(); }} style={field} autoComplete="one-time-code" autoFocus placeholder="000000" />
          </label>
        )}

        {err && <div style={{ color: C.errText, fontSize: 13, marginTop: 12 }}>{err}</div>}

        {mode === "forgot" ? (
          <button onClick={() => void submitForgot()} disabled={busy} style={{ width: "100%", marginTop: 20, background: green, border: "none", borderRadius: 11, color: onGreen, padding: "11px 0", fontSize: 15, fontWeight: 500, minHeight: 44, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : "Send reset link"}
          </button>
        ) : mode === "reset" ? (
          <button onClick={() => void submitReset()} disabled={busy} style={{ width: "100%", marginTop: 20, background: green, border: "none", borderRadius: 11, color: onGreen, padding: "11px 0", fontSize: 15, fontWeight: 500, minHeight: 44, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : "Set new password"}
          </button>
        ) : mode === "2fa" ? (
          <button onClick={() => void submit2fa()} disabled={busy || !twofaCode} style={{ width: "100%", marginTop: 20, background: green, border: "none", borderRadius: 11, color: onGreen, padding: "11px 0", fontSize: 15, fontWeight: 500, minHeight: 44, cursor: busy ? "default" : "pointer", opacity: busy || !twofaCode ? 0.6 : 1 }}>
            {busy ? "…" : "Verify"}
          </button>
        ) : (
          <button onClick={() => void submit()} disabled={busy} style={{ width: "100%", marginTop: 20, background: green, border: "none", borderRadius: 11, color: onGreen, padding: "11px 0", fontSize: 15, fontWeight: 500, minHeight: 44, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        )}

        {mode === "login" && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, textAlign: "center" }}>
            <button onClick={() => { setMode("forgot"); setErr(""); setMsg(""); }} style={{ background: "none", border: "none", color: green, cursor: "pointer", fontSize: 13, padding: 0 }}>Forgot password?</button>
          </div>
        )}

        {(mode === "login" || mode === "register") && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 16, textAlign: "center" }}>
            {mode === "login" ? "No account yet? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); setMsg(""); }} style={{ background: "none", border: "none", color: green, cursor: "pointer", fontSize: 13, padding: 0 }}>
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>
        )}
        {(mode === "forgot" || mode === "reset" || mode === "2fa") && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 16, textAlign: "center" }}>
            <button onClick={() => { setMode("login"); setErr(""); setMsg(""); setTwofaCode(""); setPendingToken(""); }} style={{ background: "none", border: "none", color: green, cursor: "pointer", fontSize: 13, padding: 0 }}>Back to sign in</button>
          </div>
        )}
        <div style={{ fontSize: 11, color: C.faint, marginTop: 20, textAlign: "center" }}>
          <a href="/privacy" style={{ color: C.faint }}>Privacy</a> · <a href="/terms" style={{ color: C.faint }}>Terms</a>
        </div>
      </div>
    </div>
  );
}
