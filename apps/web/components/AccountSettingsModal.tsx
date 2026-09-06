"use client";

import { useState, useEffect, useRef } from "react";
import { currencyCodes, CURRENCIES, formatMoney } from "@onevyrt/engine";
import { ACCENT, barGhost, barPrimary } from "../lib/studio-ui";
import { useDialogA11y } from "../lib/use-dialog-a11y";
import { loadUiMode, saveUiMode, applyUiMode, type UiMode } from "../lib/ui-mode";
import { loadThemeMode, saveThemeMode, applyThemeMode, type ThemeMode } from "../lib/theme-mode";
import { copyText } from "../lib/clipboard";

const ACCOUNT_TABS: { id: "profile" | "security" | "workspace" | "referrals" | "preferences"; label: string }[] = [
  { id: "profile", label: "Profile" }, { id: "security", label: "Security" },
  { id: "workspace", label: "Workspace" }, { id: "referrals", label: "Referrals" }, { id: "preferences", label: "Preferences" },
];
const TIMEZONE_OPTIONS = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Madrid", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
interface UserPrefs { currency: string; timezone: string; dateFormat: string }
const DEFAULT_PREFS: UserPrefs = { currency: "USD", timezone: "UTC", dateFormat: "YYYY-MM-DD" };
function loadPrefs(email: string): UserPrefs {
  try { const raw = localStorage.getItem(`gearbox:prefs:${email}`); return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS; }
  catch { return DEFAULT_PREFS; }
}

/** Resizes/crops to a square JPEG before it ever leaves the browser — the
 *  server only accepts small images (see MAX_AVATAR_DATA_URL_LENGTH in
 *  lib/auth.ts), and resizing client-side means a full-res phone photo
 *  never has to round-trip over the network first just to get rejected. */
function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
    img.src = url;
  });
}

// Account Settings: Profile/Workspace are read-only reflections of data the
// app already has; Security is the one tab wired to a real endpoint (your
// own password, changed via your own authenticated session — not a new
// account, not someone else's credentials). Preferences are local-only
// (no per-user prefs endpoint exists yet), so they live in localStorage.
export function AccountSettingsModal({ user, tab, setTab, activeWs, onClose, onRenamed, onAvatarChanged, onDeleted }: {
  user: { id: string; email: string; avatarUrl?: string }; tab: "profile" | "security" | "workspace" | "referrals" | "preferences";
  setTab: (t: "profile" | "security" | "workspace" | "referrals" | "preferences") => void;
  activeWs: { id: string; name: string; ownerId: string; members: { userId: string; role: string }[] } | null;
  onClose: () => void;
  onRenamed: (wsId: string, name: string) => void;
  onEmailChanged: (email: string) => void;
  onAvatarChanged: (avatarUrl: string | undefined) => void;
  onDeleted: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const deleteAccount = async () => {
    if (deleteBusy || !deletePassword) return;
    setDeleteBusy(true); setDeleteErr("");
    try {
      const r = await fetch("/api/auth/delete-account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
      const data = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) { setDeleteErr(data.error ?? "Could not delete account."); setDeleteBusy(false); return; }
      onDeleted();
    } catch { setDeleteErr("Network error."); setDeleteBusy(false); }
  };
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const onAvatarFileSelected = async (file: File) => {
    if (avatarBusy) return;
    setAvatarBusy(true); setAvatarMsg("");
    try {
      const dataUrl = await resizeImageToDataUrl(file, 128);
      const r = await fetch("/api/auth/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      const data = await r.json() as { avatarUrl?: string; error?: string };
      if (!r.ok || !data.avatarUrl) setAvatarMsg(data.error ?? "Could not upload photo.");
      else onAvatarChanged(data.avatarUrl);
    } catch { setAvatarMsg("Could not process that image."); }
    setAvatarBusy(false);
  };
  const removeAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true); setAvatarMsg("");
    // Only clear the photo in the UI once the server confirms — otherwise a
    // failed delete still dropped the avatar locally, then it returned on reload.
    try {
      const r = await fetch("/api/auth/avatar", { method: "DELETE" });
      if (r.ok) onAvatarChanged(undefined);
      else setAvatarMsg("Could not remove photo.");
    } catch { setAvatarMsg("Could not remove photo."); }
    setAvatarBusy(false);
  };
  const [referralData, setReferralData] = useState<{ code: string; referrals: { id: string; workspaceName: string; status: string; createdAt: string; qualifiedAt?: string }[]; activeCount: number; discountAmountCents: number; discountCurrency: string | null } | null>(null);
  const [referralCopyMsg, setReferralCopyMsg] = useState("");
  useEffect(() => {
    if (tab !== "referrals" || !activeWs) return;
    fetch(`/api/referrals?ws=${encodeURIComponent(activeWs.id)}`)
      .then((r) => r.json()).then((d: typeof referralData) => { if (d) setReferralData(d); }).catch(() => {});
  }, [tab, activeWs]);
  const referralLink = referralData && typeof window !== "undefined" ? `${window.location.origin}/?ref=${referralData.code}` : "";
  const copyReferralLink = () => {
    if (!referralLink) return;
    void copyText(referralLink).then((ok) => setReferralCopyMsg(ok ? "Copied ✓" : "Could not copy — select and copy manually."));
  };
  const REFERRAL_STATUS_COPY: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending — not yet a paying client", color: "var(--dim)" },
    active: { label: "Active — 30% of what they pay is credited to you", color: "#16a34a" },
    inactive: { label: "Inactive — no longer counted", color: "var(--dim)" },
  };

  const isOwner = !!activeWs && activeWs.ownerId === user.id;
  const myWsRole = activeWs?.members.find((m) => m.userId === user.id)?.role ?? null;
  const canRenameWs = isOwner || myWsRole === "manager";

  // Email/notification preferences (lib/email-preferences.ts) — unlike the
  // display prefs above (currency/timezone/theme, saved to localStorage),
  // these are real, server-side, per-workspace settings that gate whether
  // lib/jobs.ts's scheduled notifications actually get sent.
  const [emailPrefs, setEmailPrefs] = useState<{ reminderEmails: boolean; weeklyDigest: boolean; inAppNotifications: boolean; decisionMoments: boolean } | null>(null);
  const [emailPrefsBusy, setEmailPrefsBusy] = useState(false);
  const canEditEmailPrefs = isOwner || myWsRole === "manager";
  useEffect(() => {
    if (tab !== "preferences" || !activeWs) return;
    fetch(`/api/workspace/${encodeURIComponent(activeWs.id)}/email-preferences`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setEmailPrefs(d); }).catch(() => {});
  }, [tab, activeWs]);
  const toggleEmailPref = (key: "reminderEmails" | "weeklyDigest" | "inAppNotifications" | "decisionMoments") => {
    if (!activeWs || !emailPrefs || !canEditEmailPrefs || emailPrefsBusy) return;
    const next = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(next); // optimistic — matches savePrefs's pattern below
    setEmailPrefsBusy(true);
    fetch(`/api/workspace/${encodeURIComponent(activeWs.id)}/email-preferences`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setEmailPrefs(d); })
      .catch(() => setEmailPrefs(emailPrefs)) // revert on failure
      .finally(() => setEmailPrefsBusy(false));
  };
  const [emailDraft, setEmailDraft] = useState(user.email);
  useEffect(() => { setEmailDraft(user.email); }, [user.email]);
  const [emailPw, setEmailPw] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const submitChangeEmail = async () => {
    if (emailBusy) return;
    setEmailBusy(true); setEmailMsg(""); setEmailErr(false);
    try {
      const r = await fetch("/api/auth/change-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: emailPw, newEmail: emailDraft }) });
      const data = await r.json() as { pending?: boolean; message?: string; error?: string };
      if (!r.ok || !data.pending) { setEmailErr(true); setEmailMsg(data.error ?? "Failed to request email change."); }
      else { setEmailErr(false); setEmailMsg(data.message ?? "Check your new inbox to confirm the change."); setEmailPw(""); }
    } catch { setEmailErr(true); setEmailMsg("Network error — is the app reachable?"); }
    setEmailBusy(false);
  };
  const [wsNameDraft, setWsNameDraft] = useState(activeWs?.name ?? "");
  useEffect(() => { setWsNameDraft(activeWs?.name ?? ""); }, [activeWs?.id, activeWs?.name]);
  const [wsMsg, setWsMsg] = useState("");
  const [wsErr, setWsErr] = useState(false);
  const [wsBusy, setWsBusy] = useState(false);
  const submitRenameWs = async () => {
    if (!activeWs || wsBusy) return;
    setWsBusy(true); setWsMsg(""); setWsErr(false);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(activeWs.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: wsNameDraft }) });
      const data = await r.json() as { name?: string; error?: string };
      if (!r.ok || !data.name) { setWsErr(true); setWsMsg(data.error ?? "Failed to rename workspace."); }
      else { setWsErr(false); setWsMsg("Workspace renamed ✓"); onRenamed(activeWs.id, data.name); }
    } catch { setWsErr(true); setWsMsg("Network error — is the app reachable?"); }
    setWsBusy(false);
  };
  interface SessionRow { id: string; createdAt: string; lastSeenAt: string; userAgent?: string }
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsMsg, setSessionsMsg] = useState("");
  const [sessionsErr, setSessionsErr] = useState(false);
  const refreshSessions = async () => {
    try {
      const r = await fetch("/api/auth/sessions");
      if (!r.ok) return;
      const data = await r.json() as { sessions: SessionRow[]; currentId: string | null };
      setSessions(data.sessions);
      setCurrentSessionId(data.currentId);
    } catch { /* best effort */ }
  };
  useEffect(() => { if (tab === "security") void refreshSessions(); }, [tab]);
  const revokeOneSession = async (id: string) => {
    try {
      const r = await fetch(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) { const data = await r.json().catch(() => null) as { error?: string } | null; setSessionsErr(true); setSessionsMsg(data?.error ?? "Could not revoke that session."); return; }
      setSessionsErr(false); setSessionsMsg("");
      await refreshSessions();
    } catch { setSessionsErr(true); setSessionsMsg("Network error — could not revoke that session."); }
  };
  const logOutElsewhere = async () => {
    try {
      const r = await fetch("/api/auth/sessions", { method: "DELETE" });
      const data = await r.json().catch(() => null) as { revoked?: number; error?: string } | null;
      if (!r.ok) { setSessionsErr(true); setSessionsMsg(data?.error ?? "Could not sign out other sessions."); return; }
      setSessionsErr(false); setSessionsMsg(`Signed out of ${data?.revoked ?? 0} other session${data?.revoked === 1 ? "" : "s"}.`);
      await refreshSessions();
    } catch { setSessionsErr(true); setSessionsMsg("Network error — could not sign out other sessions."); }
  };
  const [twofaEnabled, setTwofaEnabled] = useState<boolean | null>(null);
  const [twofaStep, setTwofaStep] = useState<"idle" | "setup-password" | "confirm" | "backup-codes" | "disable-password">("idle");
  const [twofaPassword, setTwofaPassword] = useState("");
  const [twofaSetupData, setTwofaSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [twofaConfirmCode, setTwofaConfirmCode] = useState("");
  const [twofaBackupCodes, setTwofaBackupCodes] = useState<string[] | null>(null);
  const [twofaMsg, setTwofaMsg] = useState("");
  const [twofaErr, setTwofaErr] = useState(false);
  const [twofaBusy, setTwofaBusy] = useState(false);
  const refresh2fa = async () => {
    try { const r = await fetch("/api/auth/2fa"); if (r.ok) setTwofaEnabled((await r.json() as { enabled: boolean }).enabled); }
    catch { /* best effort */ }
  };
  useEffect(() => { if (tab === "security") void refresh2fa(); }, [tab]);
  const start2faSetup = async () => {
    if (twofaBusy) return;
    setTwofaBusy(true); setTwofaErr(false); setTwofaMsg("");
    try {
      const r = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: twofaPassword }) });
      const data = await r.json() as { secret?: string; qrDataUrl?: string; error?: string };
      if (!r.ok || !data.secret) { setTwofaErr(true); setTwofaMsg(data.error ?? "Could not start setup."); }
      else { setTwofaSetupData({ secret: data.secret, qrDataUrl: data.qrDataUrl ?? "" }); setTwofaStep("confirm"); setTwofaPassword(""); }
    } catch { setTwofaErr(true); setTwofaMsg("Network error — is the app reachable?"); }
    setTwofaBusy(false);
  };
  const confirm2faSetup = async () => {
    if (twofaBusy) return;
    setTwofaBusy(true); setTwofaErr(false); setTwofaMsg("");
    try {
      const r = await fetch("/api/auth/2fa/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: twofaConfirmCode }) });
      const data = await r.json() as { backupCodes?: string[]; error?: string };
      if (!r.ok || !data.backupCodes) { setTwofaErr(true); setTwofaMsg(data.error ?? "Could not confirm code."); }
      else { setTwofaBackupCodes(data.backupCodes); setTwofaStep("backup-codes"); setTwofaConfirmCode(""); setTwofaEnabled(true); }
    } catch { setTwofaErr(true); setTwofaMsg("Network error — is the app reachable?"); }
    setTwofaBusy(false);
  };
  const finish2faSetup = () => { setTwofaStep("idle"); setTwofaSetupData(null); setTwofaBackupCodes(null); setTwofaMsg(""); };
  const disable2fa = async () => {
    if (twofaBusy) return;
    setTwofaBusy(true); setTwofaErr(false); setTwofaMsg("");
    try {
      const r = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: twofaPassword }) });
      const data = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) { setTwofaErr(true); setTwofaMsg(data.error ?? "Could not disable 2FA."); }
      else { setTwofaEnabled(false); setTwofaStep("idle"); setTwofaPassword(""); setTwofaMsg("Two-factor authentication disabled."); }
    } catch { setTwofaErr(true); setTwofaMsg("Network error — is the app reachable?"); }
    setTwofaBusy(false);
  };
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(() => loadPrefs(user.email));
  // Experience level (Guided/Pro) lives here now, not as a persistent toggle in
  // the Studio working surface (audit Phase 2: "move Guided/Pro to preferences —
  // a persistent toggle suggests the interface may change unpredictably while
  // working"). Changing it applies immediately app-wide via <html data-uimode>.
  const [uiMode, setUiModeState] = useState<UiMode>("guided");
  useEffect(() => { setUiModeState(loadUiMode()); }, []);
  const setUiMode = (m: UiMode) => { setUiModeState(m); saveUiMode(m); applyUiMode(m); };

  // Dark mode theme preference — applied immediately to <html data-theme>.
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  useEffect(() => { setThemeModeState(loadThemeMode()); }, []);
  const setThemeMode = (m: ThemeMode) => { setThemeModeState(m); saveThemeMode(m); applyThemeMode(m); };
  const savePrefs = (next: UserPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(`gearbox:prefs:${user.email}`, JSON.stringify(next)); } catch { /* best effort */ }
  };
  const submitChangePw = async () => {
    if (pwBusy) return;
    setPwErr(false); setPwMsg("");
    if (newPw !== confirmPw) { setPwErr(true); setPwMsg("New passwords don't match."); return; }
    setPwBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      const data = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) { setPwErr(true); setPwMsg(data.error ?? "Failed to change password."); }
      else { setPwErr(false); setPwMsg("Password changed ✓"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    } catch { setPwErr(true); setPwMsg("Network error — is the app reachable?"); }
    setPwBusy(false);
  };
  const inputStyle = { width: "100%", boxSizing: "border-box" as const, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13, marginTop: 3 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Account settings" onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Account settings</div>
          <button onClick={onClose} style={barGhost}>Close</button>
        </div>
        <div role="tablist" aria-label="Account settings sections" style={{ display: "flex", gap: 6, padding: "12px 22px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          {ACCOUNT_TABS.map((t, i) => (
            <button key={t.id} role="tab" id={`acct-tab-${t.id}`} aria-controls="acct-tabpanel"
              aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const n = (i + dir + ACCOUNT_TABS.length) % ACCOUNT_TABS.length;
                setTab(ACCOUNT_TABS[n]!.id);
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
              }}
              onClick={() => setTab(t.id)}
              style={{ ...barGhost, background: tab === t.id ? "var(--accent-soft)" : "transparent", color: tab === t.id ? ACCENT : "var(--muted)", borderColor: tab === t.id ? ACCENT : "var(--border3)" }}>{t.label}</button>
          ))}
        </div>
        <div id="acct-tabpanel" role="tabpanel" aria-labelledby={`acct-tab-${tab}`} style={{ padding: 22 }}>
          {tab === "profile" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: 999, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" width={56} height={56} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : user.email.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <label style={{ ...barGhost, display: "inline-block", cursor: avatarBusy ? "default" : "pointer", opacity: avatarBusy ? 0.6 : 1 }}>
                    {avatarBusy ? "Uploading…" : "Change photo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarBusy} style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAvatarFileSelected(f); e.target.value = ""; }} />
                  </label>
                  {user.avatarUrl && (
                    <button onClick={() => void removeAvatar()} disabled={avatarBusy} style={{ ...barGhost, marginLeft: 6, color: "#e11d48", borderColor: "transparent" }}>Remove</button>
                  )}
                  {avatarMsg && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>{avatarMsg}</div>}
                </div>
              </div>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Email</span>
                <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Current password (to confirm)</span>
                <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} style={inputStyle} />
              </label>
              <button onClick={() => void submitChangeEmail()} disabled={emailBusy || !emailPw || emailDraft.trim().toLowerCase() === user.email.toLowerCase()}
                style={{ ...barPrimary, opacity: emailBusy || !emailPw || emailDraft.trim().toLowerCase() === user.email.toLowerCase() ? 0.6 : 1 }}>
                {emailBusy ? "Changing…" : "Change email"}
              </button>
              {emailMsg && <div style={{ fontSize: 12, marginTop: 8, color: emailErr ? "#dc2626" : "#16a34a" }}>{emailMsg}</div>}
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 16 }}>No confirmation link is sent — this changes your login email immediately.</div>
            </>
          )}
          {tab === "security" && (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Current password</span>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>New password</span>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirm new password</span>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={inputStyle} />
              </label>
              <button onClick={() => void submitChangePw()} disabled={pwBusy || !currentPw || !newPw} style={{ ...barPrimary, opacity: pwBusy || !currentPw || !newPw ? 0.6 : 1 }}>
                {pwBusy ? "Changing…" : "Change password"}
              </button>
              {pwMsg && <div style={{ fontSize: 12, marginTop: 8, color: pwErr ? "#dc2626" : "#16a34a" }}>{pwMsg}</div>}

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Active sessions</span>
                  {sessions.length > 1 && (
                    <button onClick={() => void logOutElsewhere()} style={{ ...barGhost, fontSize: 11, padding: "3px 8px" }}>Log out everywhere else</button>
                  )}
                </div>
                {sessions.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>No sessions found.</div>
                ) : (
                  sessions.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, borderRadius: 8, background: "var(--surface2)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {s.userAgent ? s.userAgent.slice(0, 60) : "Unknown device"}
                          {s.id === currentSessionId && <span style={{ color: ACCENT, fontWeight: 700 }}> · This device</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--dim)" }}>Last active {new Date(s.lastSeenAt).toLocaleString()} · Signed in {new Date(s.createdAt).toLocaleDateString()}</div>
                      </div>
                      {s.id !== currentSessionId && (
                        <button onClick={() => void revokeOneSession(s.id)} style={{ ...barGhost, fontSize: 11, padding: "2px 7px", color: "#e11d48", borderColor: "transparent", flexShrink: 0 }}>Revoke</button>
                      )}
                    </div>
                  ))
                )}
                {sessionsMsg && <div style={{ fontSize: 12, marginTop: 8, color: sessionsErr ? "#dc2626" : "#16a34a" }}>{sessionsMsg}</div>}
              </div>

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Two-factor authentication</div>
                {twofaEnabled === null ? (
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>Loading…</div>
                ) : twofaStep === "idle" && twofaEnabled ? (
                  <>
                    <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 10 }}>✓ Enabled — your account requires a code at sign-in.</div>
                    <button onClick={() => { setTwofaStep("disable-password"); setTwofaErr(false); setTwofaMsg(""); }} style={{ ...barGhost, fontSize: 12, color: "#e11d48", borderColor: "transparent" }}>Disable 2FA</button>
                  </>
                ) : twofaStep === "idle" && !twofaEnabled ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Not enabled. Adds a 6-digit code (from an authenticator app) to sign-in, on top of your password.</div>
                    <button onClick={() => { setTwofaStep("setup-password"); setTwofaErr(false); setTwofaMsg(""); }} style={barPrimary}>Enable 2FA</button>
                  </>
                ) : twofaStep === "setup-password" ? (
                  <>
                    <label style={{ display: "block", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirm your password to continue</span>
                      <input type="password" value={twofaPassword} onChange={(e) => setTwofaPassword(e.target.value)} style={inputStyle} />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void start2faSetup()} disabled={twofaBusy || !twofaPassword} style={{ ...barPrimary, opacity: twofaBusy || !twofaPassword ? 0.6 : 1 }}>{twofaBusy ? "…" : "Continue"}</button>
                      <button onClick={() => { setTwofaStep("idle"); setTwofaPassword(""); }} style={barGhost}>Cancel</button>
                    </div>
                  </>
                ) : twofaStep === "confirm" && twofaSetupData ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Scan this with Google Authenticator, Authy, or any TOTP app — then enter the 6-digit code it shows.</div>
                    {twofaSetupData.qrDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={twofaSetupData.qrDataUrl} alt="2FA QR code" width={160} height={160} style={{ display: "block", marginBottom: 10, borderRadius: 8, border: "1px solid var(--border3)" }} />
                    )}
                    <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10 }}>Can't scan? Enter this manually: <code style={{ userSelect: "all", background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>{twofaSetupData.secret}</code></div>
                    <label style={{ display: "block", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>6-digit code</span>
                      <input type="text" inputMode="numeric" value={twofaConfirmCode} onChange={(e) => setTwofaConfirmCode(e.target.value)} style={inputStyle} placeholder="000000" />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void confirm2faSetup()} disabled={twofaBusy || !twofaConfirmCode} style={{ ...barPrimary, opacity: twofaBusy || !twofaConfirmCode ? 0.6 : 1 }}>{twofaBusy ? "…" : "Confirm"}</button>
                      <button onClick={finish2faSetup} style={barGhost}>Cancel</button>
                    </div>
                  </>
                ) : twofaStep === "backup-codes" && twofaBackupCodes ? (
                  <>
                    <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 8 }}>✓ 2FA is enabled. Save these backup codes somewhere safe — each works once, if you ever lose access to your authenticator app.</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: "var(--surface2)", borderRadius: 8, padding: 12, marginBottom: 10, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
                      {twofaBackupCodes.map((c) => <div key={c}>{c}</div>)}
                    </div>
                    <button onClick={finish2faSetup} style={barPrimary}>I've saved these codes</button>
                  </>
                ) : twofaStep === "disable-password" ? (
                  <>
                    <label style={{ display: "block", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirm your password to disable 2FA</span>
                      <input type="password" value={twofaPassword} onChange={(e) => setTwofaPassword(e.target.value)} style={inputStyle} />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void disable2fa()} disabled={twofaBusy || !twofaPassword} style={{ ...barPrimary, background: "#e11d48", opacity: twofaBusy || !twofaPassword ? 0.6 : 1 }}>{twofaBusy ? "…" : "Disable 2FA"}</button>
                      <button onClick={() => { setTwofaStep("idle"); setTwofaPassword(""); }} style={barGhost}>Cancel</button>
                    </div>
                  </>
                ) : null}
                {twofaMsg && <div style={{ fontSize: 12, marginTop: 8, color: twofaErr ? "#dc2626" : "#16a34a" }}>{twofaMsg}</div>}
              </div>

              <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, letterSpacing: 0.6, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>YOUR DATA</div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Download everything tied to your account — your workspaces, projects and progress — as a single JSON file.</div>
                <a href="/api/account/export" style={{ ...barGhost, fontSize: 12, textDecoration: "none", display: "inline-block" }}>Download my data</a>
              </div>

              <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, letterSpacing: 0.6, color: "#e11d48", fontWeight: 700, marginBottom: 8 }}>DANGER ZONE</div>
                {deleteStep === "idle" ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Permanently deletes your account and any workspace you solely own. This can't be undone.</div>
                    <button onClick={() => { setDeleteStep("confirm"); setDeleteErr(""); }} style={{ ...barGhost, fontSize: 12, color: "#e11d48", borderColor: "transparent" }}>Delete my account</button>
                  </>
                ) : (
                  <>
                    <label style={{ display: "block", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirm your password to permanently delete your account</span>
                      <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} style={inputStyle} autoFocus />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void deleteAccount()} disabled={deleteBusy || !deletePassword} style={{ ...barPrimary, background: "#e11d48", opacity: deleteBusy || !deletePassword ? 0.6 : 1 }}>{deleteBusy ? "…" : "Permanently delete"}</button>
                      <button onClick={() => { setDeleteStep("idle"); setDeletePassword(""); setDeleteErr(""); }} style={barGhost}>Cancel</button>
                    </div>
                    {deleteErr && <div style={{ fontSize: 12, marginTop: 8, color: "#dc2626" }}>{deleteErr}</div>}
                  </>
                )}
              </div>
            </>
          )}
          {tab === "workspace" && (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Workspace name</span>
                {canRenameWs ? (
                  <input value={wsNameDraft} onChange={(e) => setWsNameDraft(e.target.value)} style={inputStyle} />
                ) : (
                  <input value={activeWs?.name ?? ""} disabled style={{ ...inputStyle, opacity: 0.7, cursor: "not-allowed" }} />
                )}
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Your role</span>
                <input value={activeWs ? (activeWs.ownerId === user.id ? "owner" : (activeWs.members.find((m) => m.userId === user.id)?.role ?? "member")) : ""} disabled style={{ ...inputStyle, opacity: 0.7, cursor: "not-allowed" }} />
              </label>
              {canRenameWs ? (
                <>
                  <button onClick={() => void submitRenameWs()} disabled={wsBusy || !wsNameDraft.trim() || wsNameDraft.trim() === activeWs?.name}
                    style={{ ...barPrimary, opacity: wsBusy || !wsNameDraft.trim() || wsNameDraft.trim() === activeWs?.name ? 0.6 : 1 }}>
                    {wsBusy ? "Saving…" : "Rename workspace"}
                  </button>
                  {wsMsg && <div style={{ fontSize: 12, marginTop: 8, color: wsErr ? "#dc2626" : "#16a34a" }}>{wsMsg}</div>}
                </>
              ) : (
                <div style={{ fontSize: 11, color: "var(--dim)" }}>Only the workspace owner or a manager can rename it.</div>
              )}
            </>
          )}
          {tab === "referrals" && (
            <>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Share your link. For every referral that becomes a paying client, you get 30% of what THEY pay credited off your own subscription, for as long as they stay — referrals stack.
              </p>
              {!activeWs || !referralData ? (
                <div style={{ fontSize: 12, color: "var(--dim)" }}>Loading…</div>
              ) : (
                <>
                  <label style={{ display: "block", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Your referral link</span>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <input value={referralLink} readOnly style={{ ...inputStyle, marginTop: 0, flex: 1 }} onFocus={(e) => e.target.select()} />
                      <button onClick={copyReferralLink} style={barGhost}>Copy</button>
                    </div>
                    {referralCopyMsg && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>{referralCopyMsg}</div>}
                  </label>

                  <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>ACTIVE REFERRALS</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{referralData.activeCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>YOUR DISCOUNT</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>
                        {referralData.discountAmountCents > 0
                          ? `${formatMoney(referralData.discountAmountCents, (referralData.discountCurrency ?? "usd").toUpperCase())}/mo off`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Your referrals</div>
                  {referralData.referrals.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--dim)" }}>No referrals yet — share your link above to start earning.</div>
                  ) : (
                    referralData.referrals.map((r) => {
                      const copy = REFERRAL_STATUS_COPY[r.status] ?? { label: r.status, color: "var(--dim)" };
                      return (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                          <span>{r.workspaceName}</span>
                          <span style={{ color: copy.color, fontWeight: 500 }}>{copy.label}</span>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </>
          )}
          {tab === "preferences" && (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Default currency</span>
                <select value={prefs.currency} onChange={(e) => savePrefs({ ...prefs, currency: e.target.value })} style={inputStyle}>
                  {currencyCodes().map((code) => <option key={code} value={code}>{code} — {CURRENCIES[code]!.name}</option>)}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Timezone</span>
                <select value={prefs.timezone} onChange={(e) => savePrefs({ ...prefs, timezone: e.target.value })} style={inputStyle}>
                  {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Date format</span>
                <select value={prefs.dateFormat} onChange={(e) => savePrefs({ ...prefs, dateFormat: e.target.value })} style={inputStyle}>
                  {DATE_FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <div style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Experience level</span>
                <div role="radiogroup" aria-label="Experience level" style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {([["guided", "Guided", "Simpler — fewer tools, more hints for getting started."], ["pro", "Pro", "Reveals every tool and advanced control."]] as const).map(([val, label, hint]) => (
                    <button key={val} type="button" role="radio" aria-checked={uiMode === val} onClick={() => setUiMode(val)} title={hint}
                      style={{ flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: uiMode === val ? "var(--accent-soft)" : "transparent",
                        border: `1px solid ${uiMode === val ? ACCENT : "var(--border3)"}`, color: "var(--text)" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: uiMode === val ? ACCENT : "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2 }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "block", marginBottom: 12, marginTop: 16 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Appearance</span>
                <div role="radiogroup" aria-label="Theme appearance" style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {([["light", "Light", "Clean, bright interface."], ["dark", "Dark", "Easy on the eyes in low light."]] as const).map(([val, label, hint]) => (
                    <button key={val} type="button" role="radio" aria-checked={themeMode === val} onClick={() => setThemeMode(val as ThemeMode)} title={hint}
                      style={{ flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: themeMode === val ? "var(--accent-soft)" : "transparent",
                        border: `1px solid ${themeMode === val ? ACCENT : "var(--border3)"}`, color: "var(--text)" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: themeMode === val ? ACCENT : "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2 }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>Saved on this device — a synced, per-account version isn't built yet.</div>

              <div style={{ display: "block", marginTop: 20, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Notifications</span>
                {!activeWs || !emailPrefs ? (
                  <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 6 }}>Loading…</div>
                ) : (
                  <>
                    {([
                      ["reminderEmails", "Reminder emails", "Cohort sessions, staying-on-track nudges, and periodic reflection prompts."],
                      ["weeklyDigest", "Weekly digest", "A weekly summary — sent to coaches about their learners."],
                      ["inAppNotifications", "In-app notifications", "The bell icon's notification list."],
                      ["decisionMoments", "Decision moments", "The reflection prompt shown before a payment or milestone."],
                    ] as const).map(([key, label, hint]) => (
                      <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, cursor: canEditEmailPrefs ? "pointer" : "default", opacity: canEditEmailPrefs ? 1 : 0.6 }}>
                        <input type="checkbox" checked={emailPrefs[key]} disabled={!canEditEmailPrefs || emailPrefsBusy} onChange={() => toggleEmailPref(key)} style={{ marginTop: 2 }} />
                        <span>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                          <div style={{ fontSize: 11.5, color: "var(--dim)" }}>{hint}</div>
                        </span>
                      </label>
                    ))}
                    {!canEditEmailPrefs && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 8 }}>Only this workspace's owner or a manager can change notification settings.</div>}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
