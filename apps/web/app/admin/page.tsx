"use client";

import { useCallback, useEffect, useState } from "react";
import { alertDialog, confirmDialog } from "../../components/Modal";

interface UserRow { id: string; email: string; createdAt: string; disabled?: boolean; }
interface ProjectRow { id: string; name: string; updatedAt: string; }
type Plan = "free" | "pro" | "business" | "performance";
interface MemberRow { userId: string; email: string; role: string; }
interface WorkspaceRow { id: string; name: string; ownerId: string; ownerEmail: string; plan: Plan; members: MemberRow[]; memberCount: number; createdAt: string; projectCount: number; projects: ProjectRow[]; }
interface StripeEventRow { id: string; type: string; receivedAt: string; amountTotal?: number; currency?: string; }
interface Stripe { configured: boolean; count: number; lastReceivedAt: string | null; completedCount: number; completedAmountTotal: number; recentEvents: StripeEventRow[]; }
interface Lockout { email: string; fails: number; lockedUntil: number; remainingMs: number; }
interface Storage { revisions: number; backups: number; comments: number; activeResetTokens: number; }
interface AuditEntry { id: string; at: string; actorEmail: string; action: string; targetType?: string; targetLabel?: string; detail?: string; }
interface ClientErrorEntry { id: string; at: string; message: string; url?: string; digest?: string; stack?: string; }
interface DailyCount { date: string; count: number; }
interface EventCount { name: string; count: number; }
interface Analytics { signupsByDay: DailyCount[]; activeUsersByDay: DailyCount[]; eventCounts: EventCount[]; windowDays: number; }
interface ProgrammeOffer { id: "self_paced" | "cohort" | "premium_1to1"; name: string; priceLabel: string; description: string; active: boolean; }
interface Overview {
  admin: { email: string };
  totals: { users: number; workspaces: number; projects: number };
  users: UserRow[];
  workspaces: WorkspaceRow[];
  settings: { publicOrigin: string };
  stripe: Stripe;
  lockouts: Lockout[];
  storage: Storage;
  audit: AuditEntry[];
  analytics: Analytics;
  clientErrors: ClientErrorEntry[];
}

interface ProjectDetail {
  name: string; currency: string; archived: boolean; updatedAt: string;
  nodes: { id: string; kind: string; label: string }[]; edgeCount: number;
  hasDefinition: boolean; hasNotes: boolean; riskCount: number;
  checklist: { total: number; done: number } | null;
}

const PLANS: Plan[] = ["free", "pro", "business", "performance"];
const fmtRemaining = (ms: number) => { const m = Math.ceil(ms / 60000); return m <= 0 ? "—" : `${m} min`; };
const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleString() : "—");
const fmtMoney = (minor: number) => `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ACTION_LABEL: Record<string, string> = {
  "user.deactivate": "Deactivated user", "user.reactivate": "Reactivated user", "user.purge": "Permanently deleted user",
  "user.impersonate_start": "Started impersonating", "user.impersonate_stop": "Stopped impersonating",
  "login.unlock": "Unlocked login", "workspace.delete": "Deleted workspace", "workspace.reassign_owner": "Reassigned owner",
  "workspace.remove_member": "Removed member", "workspace.set_plan": "Changed plan",
};

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [originDraft, setOriginDraft] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [offers, setOffers] = useState<ProgrammeOffer[]>([]);
  const [offersMsg, setOffersMsg] = useState("");
  const [savingOfferId, setSavingOfferId] = useState<string | null>(null);
  const loadOffers = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/programme-offers", { credentials: "include" });
      const d = await r.json() as { offers?: ProgrammeOffer[] };
      if (r.ok && d.offers) setOffers(d.offers);
    } catch { /* best effort */ }
  }, []);
  useEffect(() => { void loadOffers(); }, [loadOffers]);
  const patchOffer = useCallback((id: string, patch: Partial<ProgrammeOffer>) => {
    setOffers((cur) => cur.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);
  const saveOffer = useCallback(async (offer: ProgrammeOffer) => {
    setSavingOfferId(offer.id); setOffersMsg("");
    try {
      const r = await fetch("/api/admin/programme-offers", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(offer) });
      const d = await r.json() as { offer?: ProgrammeOffer; error?: string };
      if (!r.ok || !d.offer) { setOffersMsg(d.error ?? "Could not save."); setSavingOfferId(null); return; }
      setOffers((cur) => cur.map((o) => (o.id === offer.id ? d.offer! : o)));
      setOffersMsg("Saved ✓");
    } catch { setOffersMsg("Network error."); }
    setSavingOfferId(null);
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/admin/overview", { credentials: "include" });
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as Overview;
      setData(d);
      setOriginDraft(d.settings.publicOrigin);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [unlocking, setUnlocking] = useState<string | null>(null);
  const unlock = useCallback(async (email: string) => {
    setUnlocking(email);
    try {
      const r = await fetch("/api/admin/lockouts", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ email }) });
      if (r.ok) {
        const d = await r.json() as { lockouts: Lockout[] };
        setData((prev) => (prev ? { ...prev, lockouts: d.lockouts } : prev));
      }
    } catch { /* leave the row as-is; a refresh will reconcile */ }
    finally { setUnlocking(null); }
  }, []);

  // Soft delete: deactivating blocks login and kills existing sessions but
  // leaves everything the account owns untouched, so reactivating restores
  // it exactly.
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const setUserStatus = useCallback(async (id: string, disabled: boolean) => {
    setStatusBusy(id);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}/status`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ disabled }) });
      const d = await r.json() as { user?: UserRow; error?: string };
      if (r.ok && d.user) {
        setData((prev) => (prev ? { ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, disabled: d.user!.disabled } : u)) } : prev));
      } else if (d.error) {
        void alertDialog({ title: "Couldn't update account", message: d.error });
      }
    } catch { void alertDialog({ title: "Couldn't update account", message: "Could not update the account." }); }
    finally { setStatusBusy(null); }
  }, []);

  // Permanent delete. Irreversible — requires typing the account's email
  // back, not just an OK/Cancel click, since there's no undo once this runs.
  const [purging, setPurging] = useState<string | null>(null);
  const purgeUser = useCallback(async (u: UserRow) => {
    const ok = await confirmDialog({ title: "Permanently delete account", danger: true, confirmLabel: "Delete account", requireType: u.email,
      message: `This permanently deletes ${u.email} and cannot be undone. If they own a shared workspace, this will fail until you reassign it first.` });
    if (!ok) return;
    setPurging(u.id);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE", credentials: "include" });
      const d = await r.json() as { error?: string };
      if (r.ok) { setData((prev) => (prev ? { ...prev, users: prev.users.filter((x) => x.id !== u.id) } : prev)); }
      else void alertDialog({ title: "Couldn't delete account", message: d.error ?? "Could not delete the account." });
    } catch { void alertDialog({ title: "Couldn't delete account", message: "Could not delete the account." }); }
    finally { setPurging(null); }
  }, []);

  const [impersonating, setImpersonating] = useState<string | null>(null);
  const impersonate = useCallback(async (u: UserRow) => {
    const ok = await confirmDialog({ title: "Sign in as this user?", confirmLabel: "Sign in",
      message: `Sign in as ${u.email}? This replaces your current session — use "Return to admin" (shown once impersonating) to come back.` });
    if (!ok) return;
    setImpersonating(u.id);
    try {
      const r = await fetch(`/api/admin/impersonate/${encodeURIComponent(u.id)}`, { method: "POST", credentials: "include" });
      const d = await r.json() as { error?: string };
      if (r.ok) window.location.href = "/";
      else { void alertDialog({ title: "Couldn't impersonate", message: d.error ?? "Could not impersonate that account." }); setImpersonating(null); }
    } catch { void alertDialog({ title: "Couldn't impersonate", message: "Could not impersonate that account." }); setImpersonating(null); }
  }, []);

  const [wsBusyId, setWsBusyId] = useState<string | null>(null);
  const deleteWorkspace = useCallback(async (w: WorkspaceRow) => {
    const ok = await confirmDialog({ title: "Permanently delete workspace", danger: true, confirmLabel: "Delete workspace", requireType: w.name,
      message: `This permanently deletes "${w.name}" and all ${w.projectCount} project(s) in it. This cannot be undone.` });
    if (!ok) return;
    setWsBusyId(w.id);
    try {
      const r = await fetch(`/api/admin/workspaces/${encodeURIComponent(w.id)}`, { method: "DELETE", credentials: "include" });
      const d = await r.json() as { error?: string };
      if (r.ok) setData((prev) => (prev ? { ...prev, workspaces: prev.workspaces.filter((x) => x.id !== w.id) } : prev));
      else void alertDialog({ title: "Couldn't delete workspace", message: d.error ?? "Could not delete the workspace." });
    } catch { void alertDialog({ title: "Couldn't delete workspace", message: "Could not delete the workspace." }); }
    finally { setWsBusyId(null); }
  }, []);

  const reassignOwner = useCallback(async (w: WorkspaceRow, newOwnerId: string) => {
    if (!newOwnerId || newOwnerId === w.ownerId) return;
    setWsBusyId(w.id);
    try {
      const r = await fetch(`/api/admin/workspaces/${encodeURIComponent(w.id)}/owner`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ newOwnerId }) });
      if (r.ok) await load();
      else { const d = await r.json() as { error?: string }; void alertDialog({ title: "Couldn't reassign ownership", message: d.error ?? "Could not reassign ownership." }); }
    } catch { void alertDialog({ title: "Couldn't reassign ownership", message: "Could not reassign ownership." }); }
    finally { setWsBusyId(null); }
  }, [load]);

  const removeMember = useCallback(async (w: WorkspaceRow, m: MemberRow) => {
    const ok = await confirmDialog({ title: "Remove member", danger: true, confirmLabel: "Remove", message: `Remove ${m.email} from "${w.name}"?` });
    if (!ok) return;
    setWsBusyId(w.id);
    try {
      const r = await fetch(`/api/admin/workspaces/${encodeURIComponent(w.id)}/members/${encodeURIComponent(m.userId)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) await load();
      else { const d = await r.json() as { error?: string }; void alertDialog({ title: "Couldn't remove member", message: d.error ?? "Could not remove that member." }); }
    } catch { void alertDialog({ title: "Couldn't remove member", message: "Could not remove that member." }); }
    finally { setWsBusyId(null); }
  }, [load]);

  const setPlan = useCallback(async (w: WorkspaceRow, plan: Plan) => {
    setWsBusyId(w.id);
    try {
      const r = await fetch(`/api/admin/workspaces/${encodeURIComponent(w.id)}/plan`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ plan }) });
      if (r.ok) setData((prev) => (prev ? { ...prev, workspaces: prev.workspaces.map((x) => (x.id === w.id ? { ...x, plan } : x)) } : prev));
      else { const d = await r.json() as { error?: string }; void alertDialog({ title: "Couldn't set plan", message: d.error ?? "Could not set the plan." }); }
    } catch { void alertDialog({ title: "Couldn't set plan", message: "Could not set the plan." }); }
    finally { setWsBusyId(null); }
  }, []);

  const [openProject, setOpenProject] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<Record<string, ProjectDetail | "loading" | "error">>({});
  const toggleProject = useCallback(async (wsId: string, p: ProjectRow) => {
    const key = `${wsId}/${p.id}`;
    if (openProject === key) { setOpenProject(null); return; }
    setOpenProject(key);
    if (projectDetail[key]) return;
    setProjectDetail((prev) => ({ ...prev, [key]: "loading" }));
    try {
      const r = await fetch(`/api/admin/projects/${encodeURIComponent(wsId)}/${encodeURIComponent(p.id)}`, { credentials: "include" });
      if (!r.ok) { setProjectDetail((prev) => ({ ...prev, [key]: "error" })); return; }
      const detail = await r.json() as ProjectDetail;
      setProjectDetail((prev) => ({ ...prev, [key]: detail }));
    } catch { setProjectDetail((prev) => ({ ...prev, [key]: "error" })); }
  }, [openProject, projectDetail]);

  const saveSettings = useCallback(async () => {
    setSavingSettings(true); setSettingsMsg("");
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ publicOrigin: originDraft }) });
      const d = await r.json();
      if (!r.ok) { setSettingsMsg(d.error ?? "Could not save."); return; }
      setSettingsMsg("Saved ✓");
      setOriginDraft(d.publicOrigin);
    } catch { setSettingsMsg("Network error."); }
    finally { setSavingSettings(false); }
  }, [originDraft]);

  return (
    <div className="admin-root">
      <style>{CSS}</style>
      <header className="admin-header">
        <div>
          <div className="eyebrow">ONEVYRT · INSTANCE ADMIN</div>
          <h1>Admin backend</h1>
        </div>
        <div className="header-right">
          {data && <span className="admin-email">Signed in as {data.admin.email}</span>}
          <a href="/admin/learners" className="btn">Learners</a>
          <a href="/admin/curriculum" className="btn">Curriculum editor</a>
          <a href="/" className="btn">← Back to app</a>
          <button className="btn" onClick={() => void load()}>Refresh</button>
        </div>
      </header>

      {state === "loading" && <p className="muted pad">Loading…</p>}
      {state === "error" && <p className="muted pad">Something went wrong loading the admin overview. <button className="link" onClick={() => void load()}>Try again</button></p>}
      {state === "forbidden" && (
        <div className="card notice">
          <h2>Not authorized</h2>
          <p className="muted">This page is only available to instance admins. Your account email must be listed in the <code>ADMIN_EMAILS</code> environment variable on the server.</p>
          <p className="muted">If you just added your email there, restart the dev server and <button className="link" onClick={() => void load()}>reload</button>. You may also need to <a className="link" href="/">sign in</a> first.</p>
        </div>
      )}

      {state === "ok" && data && (
        <>
          <section className="stat-row">
            <div className="stat"><div className="stat-num">{data.totals.users}</div><div className="stat-label">Users</div></div>
            <div className="stat"><div className="stat-num">{data.totals.workspaces}</div><div className="stat-label">Workspaces</div></div>
            <div className="stat"><div className="stat-num">{data.totals.projects}</div><div className="stat-label">Projects</div></div>
            <div className="stat"><div className="stat-num">{data.stripe.completedCount}</div><div className="stat-label">Paid checkouts</div></div>
          </section>

          <section className="card">
            <h2>Users <span className="count">{data.users.length}</span></h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Email</th><th>Created</th><th>Status</th><th className="mono">ID</th><th></th></tr></thead>
                <tbody>
                  {data.users.map((u) => {
                    const isSelf = u.email === data.admin.email;
                    return (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td className="muted">{fmtDate(u.createdAt)}</td>
                        <td className={u.disabled ? "" : "muted"}>{u.disabled ? "Deactivated" : "Active"}</td>
                        <td className="mono muted">{u.id}</td>
                        <td>
                          {isSelf ? (
                            <span className="muted small">you</span>
                          ) : (
                            <div className="row-actions">
                              <button className="btn" onClick={() => void setUserStatus(u.id, !u.disabled)} disabled={statusBusy === u.id}>
                                {statusBusy === u.id ? "Working…" : u.disabled ? "Reactivate" : "Deactivate"}
                              </button>
                              <button className="btn" onClick={() => void impersonate(u)} disabled={u.disabled || impersonating === u.id} title={u.disabled ? "Reactivate first" : "Sign in as this user"}>
                                {impersonating === u.id ? "Signing in…" : "Impersonate"}
                              </button>
                              <button className="btn danger" onClick={() => void purgeUser(u)} disabled={purging === u.id}>
                                {purging === u.id ? "Deleting…" : "Delete permanently"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {data.users.length === 0 && <tr><td colSpan={5} className="muted">No users yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Workspaces &amp; projects <span className="count">{data.workspaces.length}</span></h2>
            {data.workspaces.map((w) => (
              <div key={w.id} className="ws">
                <div className="ws-head">
                  <div>
                    <span className="ws-name">{w.name}</span>
                    <span className="muted"> · {w.ownerEmail}</span>
                    <span className={`plan-chip plan-${w.plan}`}>{w.plan}</span>
                  </div>
                  <div className="muted small">{w.memberCount} member{w.memberCount === 1 ? "" : "s"} · {w.projectCount} project{w.projectCount === 1 ? "" : "s"} · {fmtDate(w.createdAt)}</div>
                </div>

                <div className="ws-controls">
                  <label className="inline-field">
                    <span className="muted small">Plan</span>
                    <select value={w.plan} disabled={wsBusyId === w.id} onChange={(e) => void setPlan(w, e.target.value as Plan)}>
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  {w.members.length > 1 && (
                    <label className="inline-field">
                      <span className="muted small">Reassign owner to</span>
                      <select value="" disabled={wsBusyId === w.id} onChange={(e) => void reassignOwner(w, e.target.value)}>
                        <option value="">choose…</option>
                        {w.members.filter((m) => m.userId !== w.ownerId).map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
                      </select>
                    </label>
                  )}
                  <button className="btn danger" onClick={() => void deleteWorkspace(w)} disabled={wsBusyId === w.id}>
                    {wsBusyId === w.id ? "Working…" : "Delete workspace"}
                  </button>
                </div>

                {w.members.length > 0 && (
                  <div className="member-chips">
                    {w.members.map((m) => (
                      <span key={m.userId} className="member-chip">
                        {m.email} <span className="muted small">({m.role})</span>
                        {m.userId !== w.ownerId && <button className="chip-x" title={`Remove ${m.email}`} onClick={() => void removeMember(w, m)}>✕</button>}
                      </span>
                    ))}
                  </div>
                )}

                {w.projects.length > 0 && (
                  <ul className="proj-list">
                    {w.projects.map((p) => {
                      const key = `${w.id}/${p.id}`;
                      const detail = projectDetail[key];
                      return (
                        <li key={p.id} className="proj-item">
                          <button className="proj-row" onClick={() => void toggleProject(w.id, p)}>
                            <span>{openProject === key ? "▾" : "▸"} {p.name}</span>
                            <span className="muted small">updated {fmtDate(p.updatedAt)}</span>
                          </button>
                          {openProject === key && (
                            <div className="proj-detail">
                              {detail === "loading" || detail === undefined ? <span className="muted small">Loading…</span>
                                : detail === "error" ? <span className="muted small">Could not load this project.</span>
                                : (
                                  <>
                                    <div className="kv-grid">
                                      <div className="kv"><div className="kv-label">Currency</div><div>{detail.currency}</div></div>
                                      <div className="kv"><div className="kv-label">Nodes</div><div>{detail.nodes.length}</div></div>
                                      <div className="kv"><div className="kv-label">Edges</div><div>{detail.edgeCount}</div></div>
                                      <div className="kv"><div className="kv-label">Archived</div><div>{detail.archived ? "Yes" : "No"}</div></div>
                                      <div className="kv"><div className="kv-label">Business definition</div><div>{detail.hasDefinition ? "Started" : "Empty"}</div></div>
                                      <div className="kv"><div className="kv-label">Notes</div><div>{detail.hasNotes ? "Yes" : "No"}</div></div>
                                      <div className="kv"><div className="kv-label">Risk flags</div><div>{detail.riskCount}</div></div>
                                      {detail.checklist && <div className="kv"><div className="kv-label">Checklist</div><div>{detail.checklist.done}/{detail.checklist.total}</div></div>}
                                    </div>
                                    {detail.nodes.length > 0 && (
                                      <div className="node-chips">
                                        {detail.nodes.map((n) => <span key={n.id} className="node-chip">{n.kind}: {n.label}</span>)}
                                      </div>
                                    )}
                                  </>
                                )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
            {data.workspaces.length === 0 && <p className="muted">No workspaces yet.</p>}
          </section>

          <section className="card">
            <h2>Billing (Stripe)</h2>
            {!data.stripe.configured && <p className="muted">Stripe webhook is not configured on this server (no <code>STRIPE_WEBHOOK_SECRET</code>). No billing events are being recorded.</p>}
            <div className="kv-grid">
              <div className="kv"><div className="kv-label">Configured</div><div>{data.stripe.configured ? "Yes" : "No"}</div></div>
              <div className="kv"><div className="kv-label">Events recorded</div><div>{data.stripe.count}</div></div>
              <div className="kv"><div className="kv-label">Completed checkouts</div><div>{data.stripe.completedCount}</div></div>
              <div className="kv"><div className="kv-label">Total collected</div><div>{fmtMoney(data.stripe.completedAmountTotal)}</div></div>
              <div className="kv"><div className="kv-label">Last event</div><div>{data.stripe.lastReceivedAt ? fmtDate(data.stripe.lastReceivedAt) : "—"}</div></div>
            </div>
            {data.stripe.recentEvents.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead><tr><th>Type</th><th>Received</th><th>Amount</th></tr></thead>
                  <tbody>
                    {data.stripe.recentEvents.map((e) => (
                      <tr key={e.id}>
                        <td>{e.type}</td>
                        <td className="muted">{fmtDate(e.receivedAt)}</td>
                        <td>{e.amountTotal != null ? `${fmtMoney(e.amountTotal)} ${(e.currency ?? "usd").toUpperCase()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Analytics <span className="count">last {data.analytics.windowDays}d</span></h2>
            <p className="muted small">App usage, not customer-funnel tracking (that's per-project, in the Tracking panel). "Active" means triggered at least one tracked event that day — a proxy, not a precise session count.</p>
            <div className="kv-grid" style={{ marginTop: 10 }}>
              <div className="kv"><div className="kv-label">Signups ({data.analytics.windowDays}d)</div><div>{data.analytics.signupsByDay.reduce((n, d) => n + d.count, 0)}</div></div>
              <div className="kv"><div className="kv-label">Peak daily active</div><div>{Math.max(0, ...data.analytics.activeUsersByDay.map((d) => d.count))}</div></div>
            </div>
            {data.analytics.eventCounts.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead><tr><th>Event</th><th>Count</th></tr></thead>
                  <tbody>
                    {data.analytics.eventCounts.map((e) => (
                      <tr key={e.name}><td>{e.name}</td><td>{e.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.analytics.eventCounts.length === 0 && <p className="muted">No events recorded in this window yet.</p>}
          </section>

          <section className="card">
            <h2>Login security</h2>
            {data.lockouts.length === 0 ? (
              <p className="muted">No accounts are locked out or carrying failed-login counters right now.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Email</th><th>Failed attempts</th><th>Locked for</th><th></th></tr></thead>
                  <tbody>
                    {data.lockouts.map((l) => (
                      <tr key={l.email}>
                        <td>{l.email}</td>
                        <td>{l.fails}</td>
                        <td className={l.remainingMs > 0 ? "" : "muted"}>{l.remainingMs > 0 ? fmtRemaining(l.remainingMs) : "not locked"}</td>
                        <td><button className="btn" onClick={() => void unlock(l.email)} disabled={unlocking === l.email}>{unlocking === l.email ? "Clearing…" : "Unlock"}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Storage footprint</h2>
            <div className="kv-grid">
              <div className="kv"><div className="kv-label">Saved revisions</div><div>{data.storage.revisions}</div></div>
              <div className="kv"><div className="kv-label">Backups</div><div>{data.storage.backups}</div></div>
              <div className="kv"><div className="kv-label">Comment threads</div><div>{data.storage.comments}</div></div>
              <div className="kv"><div className="kv-label">Active reset tokens</div><div>{data.storage.activeResetTokens}</div></div>
            </div>
          </section>

          <section className="card">
            <h2>Audit log <span className="count">{data.audit.length}</span></h2>
            {data.audit.length === 0 ? (
              <p className="muted">No admin actions recorded yet — this fills in as deactivate/purge/reassign/impersonate etc. get used.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td className="muted small">{fmtDate(a.at)}</td>
                        <td>{a.actorEmail}</td>
                        <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                        <td className="muted">{a.targetLabel ?? "—"}</td>
                        <td className="muted small">{a.detail ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Client errors <span className="count">{data.clientErrors.length}</span></h2>
            {data.clientErrors.length === 0 ? (
              <p className="muted">No client-side render crashes recorded — the error boundaries report here when a page throws in someone&apos;s browser.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>When</th><th>Message</th><th>Where</th></tr></thead>
                  <tbody>
                    {data.clientErrors.map((e) => (
                      <tr key={e.id}>
                        <td className="muted small">{fmtDate(e.at)}</td>
                        <td title={e.stack ?? ""}>{e.message}</td>
                        <td className="muted small">{e.url ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Programme offers</h2>
            <span className="muted small">The three commercial ways to buy the programme. Set your own pricing text and description, and toggle each live — no prices are hard-coded.</span>
            {offersMsg && <div className="small" style={{ color: offersMsg.includes("✓") ? "var(--ds-success)" : "var(--ds-danger)", marginTop: 6 }}>{offersMsg}</div>}
            {offers.map((offer, i) => (
              <div key={offer.id} style={{ borderTop: i > 0 ? "1px solid var(--ds-border-subtle)" : undefined, paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 8 }}>
                <label className="field">
                  <span className="kv-label">{offer.name}</span>
                  <div className="field-row">
                    <input value={offer.name} onChange={(e) => patchOffer(offer.id, { name: e.target.value })} placeholder="Offer name" />
                    <input value={offer.priceLabel} onChange={(e) => patchOffer(offer.id, { priceLabel: e.target.value })} placeholder="Price label, e.g. $497 one-time" />
                  </div>
                  <div className="field-row">
                    <input value={offer.description} onChange={(e) => patchOffer(offer.id, { description: e.target.value })} placeholder="Description" style={{ flex: 1 }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={offer.active} onChange={(e) => patchOffer(offer.id, { active: e.target.checked })} />
                      Active
                    </label>
                    <button className="btn primary" onClick={() => void saveOffer(offer)} disabled={savingOfferId === offer.id}>{savingOfferId === offer.id ? "Saving…" : "Save"}</button>
                  </div>
                </label>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Instance settings</h2>
            <label className="field">
              <span className="kv-label">Public tracking origin</span>
              <span className="muted small">The origin real funnel pages send tracking events to, e.g. https://track.yourdomain.com. Leave blank to use the studio&apos;s own origin.</span>
              <div className="field-row">
                <input value={originDraft} onChange={(e) => setOriginDraft(e.target.value)} placeholder="https://track.example.com" />
                <button className="btn primary" onClick={() => void saveSettings()} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save"}</button>
              </div>
              {settingsMsg && <span className="small" style={{ color: settingsMsg.includes("✓") ? "var(--ds-success)" : "var(--ds-danger)" }}>{settingsMsg}</span>}
            </label>
          </section>
        </>
      )}
    </div>
  );
}

const CSS = `
.admin-root{max-width:1080px;margin:0 auto;padding:28px 20px 80px;color:var(--ds-text-primary);font-family:var(--ds-font);}
.admin-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;}
.admin-header h1{font-size:24px;font-weight:700;margin:2px 0 0;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);}
.header-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.admin-email{font-size:12px;color:var(--ds-text-tertiary);}
.btn{display:inline-flex;align-items:center;background:var(--ds-surface);border:1px solid var(--ds-border-default);color:var(--ds-text-primary);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;text-decoration:none;}
.btn:hover{border-color:var(--ds-border-strong);}
.btn:disabled{opacity:.6;cursor:default;}
.btn.primary{background:var(--ds-brand-solid);border-color:var(--ds-brand-solid);color:var(--ds-brand-contrast);font-weight:500;}
.btn.primary:disabled{opacity:.6;cursor:default;}
.btn.danger{background:var(--ds-surface);border-color:color-mix(in srgb, var(--ds-danger) 45%, transparent);color:var(--ds-danger);}
.btn.danger:hover{background:var(--ds-danger-soft);border-color:var(--ds-danger);}
.link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font:inherit;text-decoration:underline;}
.pad{padding:12px 2px;}
.muted{color:var(--ds-text-tertiary);}
.small{font-size:12px;}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}
.row-actions{display:flex;gap:6px;flex-wrap:wrap;}
.stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;}
.stat{flex:1 1 140px;background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:12px;padding:14px 16px;}
.stat-num{font-size:26px;font-weight:700;}
.stat-label{font-size:12px;color:var(--ds-text-tertiary);letter-spacing:.4px;}
.card{background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:12px;padding:18px 20px;margin-bottom:18px;}
.card h2{font-size:16px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;gap:8px;}
.count{font-size:12px;font-weight:500;color:var(--ds-text-secondary);background:var(--ds-bg-subtle);border-radius:999px;padding:2px 8px;}
.notice{border-color:color-mix(in srgb, var(--ds-warning) 45%, transparent);background:var(--ds-warning-soft);}
.notice h2{margin-bottom:6px;}
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;font-weight:500;color:var(--ds-text-tertiary);padding:6px 10px;border-bottom:1px solid var(--ds-border-subtle);font-size:12px;}
td{padding:7px 10px;border-bottom:1px solid var(--ds-border-subtle);}
.ws{border:1px solid var(--ds-border-subtle);border-radius:10px;padding:12px 14px;margin-bottom:10px;}
.ws-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;}
.ws-name{font-weight:500;}
.plan-chip{margin-left:8px;font-size:10px;letter-spacing:.4px;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--ds-bg-subtle);color:var(--ds-text-secondary);}
.plan-pro{background:var(--ds-info-soft);color:var(--ds-info);}
.plan-business{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.plan-performance{background:var(--ds-warning-soft);color:var(--ds-warning);}
.ws-controls{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin:10px 0;}
.inline-field{display:flex;flex-direction:column;gap:3px;font-size:12px;}
.inline-field select{border:1px solid var(--ds-border-default);border-radius:6px;padding:5px 7px;font-size:13px;background:var(--ds-surface);color:var(--ds-text-primary);}
.member-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px;}
.member-chip{display:inline-flex;align-items:center;gap:5px;background:var(--ds-surface-subtle);border:1px solid var(--ds-border-subtle);border-radius:999px;padding:3px 6px 3px 10px;font-size:12px;}
.chip-x{background:none;border:none;color:var(--ds-text-disabled);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:999px;}
.chip-x:hover{color:var(--ds-danger);background:var(--ds-danger-soft);}
.proj-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:2px;}
.proj-item{border-top:1px solid var(--ds-border-subtle);}
.proj-row{width:100%;display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:6px 2px;background:none;border:none;cursor:pointer;text-align:left;color:inherit;}
.proj-row:hover{color:var(--ds-brand);}
.proj-detail{padding:6px 2px 12px 18px;}
.node-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.node-chip{font-size:11px;background:var(--ds-bg-subtle);border-radius:6px;padding:3px 7px;color:var(--ds-text-secondary);}
.kv-grid{display:flex;flex-wrap:wrap;gap:10px;}
.kv{flex:1 1 160px;border:1px solid var(--ds-border-subtle);border-radius:8px;padding:8px 10px;}
.kv-label{font-size:11px;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:500;}
.field{display:flex;flex-direction:column;gap:4px;}
.field-row{display:flex;gap:8px;margin-top:4px;}
.field-row input{flex:1;min-width:0;border:1px solid var(--ds-border-default);border-radius:8px;padding:8px 11px;font-size:13px;background:var(--ds-surface);color:var(--ds-text-primary);}
code{background:var(--ds-bg-subtle);border-radius:4px;padding:1px 5px;font-size:12px;}
`;
