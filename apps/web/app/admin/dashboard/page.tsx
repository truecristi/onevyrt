"use client";

import { useCallback, useEffect, useState } from "react";
import { alertDialog } from "../../../components/Modal";

type Panel = "overview" | "users" | "workspaces" | "analytics" | "health" | "features" | "bulk-ops";

interface SystemHealth {
  database: { connected: boolean; latencyMs?: number };
  api: { healthy: boolean; errorRate?: number };
  errorLogs: { errorCount: number; lastError?: string };
}

interface FeatureFlag {
  id: string;
  flagName: string;
  enabled: boolean;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  updatedByEmail?: string;
}

interface DashboardData {
  admin: { email: string };
  health: SystemHealth;
  features: FeatureFlag[];
}

export default function AdminDashboard() {
  const [panel, setPanel] = useState<Panel>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [bulkInviteEmails, setBulkInviteEmails] = useState("");
  const [bulkInviteWorkspace, setBulkInviteWorkspace] = useState("");
  const [bulkInviteLoading, setBulkInviteLoading] = useState(false);
  const [bulkResetWorkspace, setBulkResetWorkspace] = useState("");
  const [bulkResetLoading, setBulkResetLoading] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState("");
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
  const [featureFlagName, setFeatureFlagName] = useState("");
  const [featureFlagEnabled, setFeatureFlagEnabled] = useState(false);
  const [featureFlagWorkspace, setFeatureFlagWorkspace] = useState("");
  const [featureFlagLoading, setFeatureFlagLoading] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      // Load overview data
      const r = await fetch("/api/admin/overview", { credentials: "include" });
      if (r.status === 403) {
        setState("forbidden");
        return;
      }
      if (!r.ok) {
        setState("error");
        return;
      }
      const overview = await r.json();

      // Load feature flags
      const flagsRes = await fetch("/api/admin/feature-flags", { credentials: "include" });
      const flagsData = (await flagsRes.json()) as { flags?: FeatureFlag[] };

      // TODO: Load health data from a new /api/admin/health endpoint
      const health: SystemHealth = {
        database: { connected: true },
        api: { healthy: true },
        errorLogs: { errorCount: 0 },
      };

      setData({
        admin: overview.admin,
        health,
        features: flagsData.flags ?? [],
      });
      setState("ok");
    } catch (e) {
      console.error("Failed to load dashboard:", e);
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBulkInvite = useCallback(async () => {
    if (!bulkInviteEmails.trim() || !bulkInviteWorkspace.trim()) {
      void alertDialog({ title: "Missing fields", message: "Enter emails and workspace ID" });
      return;
    }

    setBulkInviteLoading(true);
    try {
      const emails = bulkInviteEmails.split("\n").map((e) => e.trim()).filter(Boolean);
      const r = await fetch("/api/admin/bulk/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId: bulkInviteWorkspace, emails }),
      });

      const result = await r.json();
      if (r.ok) {
        void alertDialog({
          title: "Invitations sent",
          message: `Sent: ${result.sent}, Failed: ${result.failed}`,
        });
        setBulkInviteEmails("");
        setBulkInviteWorkspace("");
      } else {
        void alertDialog({ title: "Error", message: result.error ?? "Failed to send invitations" });
      }
    } catch (e) {
      void alertDialog({ title: "Error", message: "Network error" });
    } finally {
      setBulkInviteLoading(false);
    }
  }, [bulkInviteEmails, bulkInviteWorkspace]);

  const handleBulkReset = useCallback(async () => {
    if (!bulkResetWorkspace.trim()) {
      void alertDialog({ title: "Missing field", message: "Enter workspace ID" });
      return;
    }

    setBulkResetLoading(true);
    try {
      const r = await fetch("/api/admin/bulk/reset-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId: bulkResetWorkspace, resetChapters: true, resetLessons: true }),
      });

      const result = await r.json();
      if (r.ok) {
        void alertDialog({
          title: "Progress reset",
          message: `Reset: ${result.resetCount}, Errors: ${result.errors.length}`,
        });
        setBulkResetWorkspace("");
      } else {
        void alertDialog({ title: "Error", message: result.error ?? "Failed to reset progress" });
      }
    } catch (e) {
      void alertDialog({ title: "Error", message: "Network error" });
    } finally {
      setBulkResetLoading(false);
    }
  }, [bulkResetWorkspace]);

  const handleBulkEmail = useCallback(async () => {
    if (!bulkEmailRecipients.trim() || !bulkEmailSubject.trim() || !bulkEmailBody.trim()) {
      void alertDialog({ title: "Missing fields", message: "Enter recipients, subject, and body" });
      return;
    }

    setBulkEmailLoading(true);
    try {
      const emails = bulkEmailRecipients.split("\n").map((e) => e.trim()).filter(Boolean);
      const r = await fetch("/api/admin/bulk/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientEmails: emails,
          subject: bulkEmailSubject,
          body: bulkEmailBody,
        }),
      });

      const result = await r.json();
      if (r.ok) {
        void alertDialog({
          title: "Emails sent",
          message: `Sent: ${result.sent}, Failed: ${result.failed}`,
        });
        setBulkEmailRecipients("");
        setBulkEmailSubject("");
        setBulkEmailBody("");
      } else {
        void alertDialog({ title: "Error", message: result.error ?? "Failed to send emails" });
      }
    } catch (e) {
      void alertDialog({ title: "Error", message: "Network error" });
    } finally {
      setBulkEmailLoading(false);
    }
  }, [bulkEmailRecipients, bulkEmailSubject, bulkEmailBody]);

  const handleSetFeatureFlag = useCallback(async () => {
    if (!featureFlagName.trim()) {
      void alertDialog({ title: "Missing field", message: "Enter flag name" });
      return;
    }

    setFeatureFlagLoading(true);
    try {
      const r = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flagName: featureFlagName,
          enabled: featureFlagEnabled,
          workspaceId: featureFlagWorkspace || undefined,
        }),
      });

      const result = await r.json();
      if (r.ok) {
        void alertDialog({ title: "Success", message: "Feature flag updated" });
        setFeatureFlagName("");
        setFeatureFlagEnabled(false);
        setFeatureFlagWorkspace("");
        await load();
      } else {
        void alertDialog({ title: "Error", message: result.error ?? "Failed to update flag" });
      }
    } catch (e) {
      void alertDialog({ title: "Error", message: "Network error" });
    } finally {
      setFeatureFlagLoading(false);
    }
  }, [featureFlagName, featureFlagEnabled, featureFlagWorkspace, load]);

  return (
    <div className="admin-dashboard">
      <style>{CSS}</style>
      <header className="admin-header">
        <div>
          <div className="eyebrow">ONEVYRT · ADMIN DASHBOARD</div>
          <h1>Instance Management</h1>
        </div>
        <div className="header-right">
          {data && <span className="admin-email">Signed in as {data.admin.email}</span>}
          <a href="/admin" className="btn">← Admin Panel</a>
          <button className="btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button
          className={`nav-btn ${panel === "overview" ? "active" : ""}`}
          onClick={() => setPanel("overview")}
        >
          Overview
        </button>
        <button
          className={`nav-btn ${panel === "users" ? "active" : ""}`}
          onClick={() => setPanel("users")}
        >
          Users
        </button>
        <button
          className={`nav-btn ${panel === "workspaces" ? "active" : ""}`}
          onClick={() => setPanel("workspaces")}
        >
          Workspaces
        </button>
        <button
          className={`nav-btn ${panel === "analytics" ? "active" : ""}`}
          onClick={() => setPanel("analytics")}
        >
          Analytics
        </button>
        <button
          className={`nav-btn ${panel === "health" ? "active" : ""}`}
          onClick={() => setPanel("health")}
        >
          System Health
        </button>
        <button
          className={`nav-btn ${panel === "features" ? "active" : ""}`}
          onClick={() => setPanel("features")}
        >
          Feature Flags
        </button>
        <button
          className={`nav-btn ${panel === "bulk-ops" ? "active" : ""}`}
          onClick={() => setPanel("bulk-ops")}
        >
          Bulk Operations
        </button>
      </nav>

      <main className="dashboard-content">
        {state === "loading" && <p className="muted">Loading…</p>}
        {state === "error" && (
          <p className="muted">
            Something went wrong.{" "}
            <button className="link" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {state === "forbidden" && (
          <div className="card notice">
            <h2>Not authorized</h2>
            <p className="muted">This page is only available to instance admins.</p>
          </div>
        )}

        {state === "ok" && data && (
          <>
            {panel === "overview" && (
              <section className="card">
                <h2>Quick Stats</h2>
                <p className="muted">Dashboard initialized. Use the tabs above to manage features and perform bulk operations.</p>
              </section>
            )}

            {panel === "users" && (
              <section className="card">
                <h2>User Management</h2>
                <p className="muted">Use the main admin panel (/admin) for detailed user management.</p>
                <a href="/admin" className="btn primary" style={{ marginTop: 12 }}>
                  Go to Admin Panel
                </a>
              </section>
            )}

            {panel === "workspaces" && (
              <section className="card">
                <h2>Workspace Management</h2>
                <p className="muted">Use the main admin panel (/admin) for detailed workspace management.</p>
                <a href="/admin" className="btn primary" style={{ marginTop: 12 }}>
                  Go to Admin Panel
                </a>
              </section>
            )}

            {panel === "analytics" && (
              <section className="card">
                <h2>Usage Analytics</h2>
                <p className="muted">Use the main admin panel (/admin) for detailed analytics and usage statistics.</p>
                <a href="/admin" className="btn primary" style={{ marginTop: 12 }}>
                  Go to Admin Panel
                </a>
              </section>
            )}

            {panel === "health" && (
              <section className="card">
                <h2>System Health</h2>
                <div className="kv-grid">
                  <div className="kv">
                    <div className="kv-label">Database</div>
                    <div>{data.health.database.connected ? "Connected" : "Disconnected"}</div>
                  </div>
                  <div className="kv">
                    <div className="kv-label">API Status</div>
                    <div>{data.health.api.healthy ? "Healthy" : "Unhealthy"}</div>
                  </div>
                  <div className="kv">
                    <div className="kv-label">Error Count</div>
                    <div>{data.health.errorLogs.errorCount}</div>
                  </div>
                </div>
              </section>
            )}

            {panel === "features" && (
              <section className="card">
                <h2>Feature Flags Management</h2>
                <div className="form-section">
                  <h3>Add/Update Feature Flag</h3>
                  <div className="form-field">
                    <label>Flag Name</label>
                    <input
                      type="text"
                      value={featureFlagName}
                      onChange={(e) => setFeatureFlagName(e.target.value)}
                      placeholder="e.g., beta_features"
                    />
                  </div>
                  <div className="form-field">
                    <label>Workspace ID (optional)</label>
                    <input
                      type="text"
                      value={featureFlagWorkspace}
                      onChange={(e) => setFeatureFlagWorkspace(e.target.value)}
                      placeholder="Leave blank for global flag"
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={featureFlagEnabled}
                        onChange={(e) => setFeatureFlagEnabled(e.target.checked)}
                      />
                      Enabled
                    </label>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => void handleSetFeatureFlag()}
                    disabled={featureFlagLoading}
                  >
                    {featureFlagLoading ? "Saving…" : "Save Flag"}
                  </button>
                </div>

                <div style={{ marginTop: 24 }}>
                  <h3>Active Flags</h3>
                  {data.features.length === 0 ? (
                    <p className="muted">No feature flags configured yet.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Flag Name</th>
                            <th>Workspace</th>
                            <th>Enabled</th>
                            <th>Updated At</th>
                            <th>Updated By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.features.map((f) => (
                            <tr key={f.id}>
                              <td>{f.flagName}</td>
                              <td className="muted">{f.workspaceId ?? "Global"}</td>
                              <td>{f.enabled ? "✓" : "—"}</td>
                              <td className="muted small">
                                {new Date(f.updatedAt).toLocaleString()}
                              </td>
                              <td className="muted">{f.updatedByEmail ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {panel === "bulk-ops" && (
              <>
                <section className="card">
                  <h2>Bulk Invite Users</h2>
                  <div className="form-section">
                    <div className="form-field">
                      <label>Workspace ID</label>
                      <input
                        type="text"
                        value={bulkInviteWorkspace}
                        onChange={(e) => setBulkInviteWorkspace(e.target.value)}
                        placeholder="workspace-id"
                      />
                    </div>
                    <div className="form-field">
                      <label>Emails (one per line)</label>
                      <textarea
                        value={bulkInviteEmails}
                        onChange={(e) => setBulkInviteEmails(e.target.value)}
                        placeholder="user1@example.com&#10;user2@example.com"
                        rows={6}
                      />
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => void handleBulkInvite()}
                      disabled={bulkInviteLoading}
                    >
                      {bulkInviteLoading ? "Sending…" : "Send Invitations"}
                    </button>
                  </div>
                </section>

                <section className="card">
                  <h2>Bulk Reset Progress</h2>
                  <div className="form-section">
                    <div className="form-field">
                      <label>Workspace ID</label>
                      <input
                        type="text"
                        value={bulkResetWorkspace}
                        onChange={(e) => setBulkResetWorkspace(e.target.value)}
                        placeholder="workspace-id"
                      />
                    </div>
                    <p className="muted small">
                      This will reset chapters and lessons for all users in the workspace.
                    </p>
                    <button
                      className="btn primary danger"
                      onClick={() => void handleBulkReset()}
                      disabled={bulkResetLoading}
                    >
                      {bulkResetLoading ? "Resetting…" : "Reset Progress"}
                    </button>
                  </div>
                </section>

                <section className="card">
                  <h2>Bulk Send Email</h2>
                  <div className="form-section">
                    <div className="form-field">
                      <label>Recipients (one per line)</label>
                      <textarea
                        value={bulkEmailRecipients}
                        onChange={(e) => setBulkEmailRecipients(e.target.value)}
                        placeholder="user1@example.com&#10;user2@example.com"
                        rows={4}
                      />
                    </div>
                    <div className="form-field">
                      <label>Subject</label>
                      <input
                        type="text"
                        value={bulkEmailSubject}
                        onChange={(e) => setBulkEmailSubject(e.target.value)}
                        placeholder="Email subject"
                      />
                    </div>
                    <div className="form-field">
                      <label>Body</label>
                      <textarea
                        value={bulkEmailBody}
                        onChange={(e) => setBulkEmailBody(e.target.value)}
                        placeholder="Email body"
                        rows={6}
                      />
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => void handleBulkEmail()}
                      disabled={bulkEmailLoading}
                    >
                      {bulkEmailLoading ? "Sending…" : "Send Email"}
                    </button>
                  </div>
                </section>

                <section className="card">
                  <h2>Bulk Data Export</h2>
                  <div className="form-section">
                    <p className="muted">
                      Export data for GDPR compliance or data analysis. Available at{" "}
                      <code>/api/admin/bulk/export</code>
                    </p>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 20px 80px;
  color: var(--ds-text-primary);
  font-family: var(--ds-font);
}

.admin-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}

.admin-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 2px 0 0;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.7px;
  font-weight: 700;
  color: var(--ds-brand);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-email {
  font-size: 12px;
  color: var(--ds-text-tertiary);
}

.btn {
  display: inline-flex;
  align-items: center;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-default);
  color: var(--ds-text-primary);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
}

.btn:hover {
  border-color: var(--ds-border-strong);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn.primary {
  background: var(--ds-brand-solid);
  border-color: var(--ds-brand-solid);
  color: var(--ds-brand-contrast);
  font-weight: 500;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn.primary.danger {
  background: var(--ds-danger-soft);
  border-color: var(--ds-danger);
  color: var(--ds-danger);
}

.dashboard-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--ds-border-subtle);
  padding-bottom: 12px;
}

.nav-btn {
  background: none;
  border: none;
  color: var(--ds-text-secondary);
  padding: 8px 0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  color: var(--ds-text-primary);
}

.nav-btn.active {
  color: var(--ds-brand);
  border-bottom-color: var(--ds-brand);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  border-radius: 12px;
  padding: 18px 20px;
}

.card h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 12px;
}

.card h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ds-text-secondary);
}

.form-field input,
.form-field textarea {
  border: 1px solid var(--ds-border-default);
  border-radius: 8px;
  padding: 8px 11px;
  font-size: 13px;
  background: var(--ds-bg-subtle);
  color: var(--ds-text-primary);
  font-family: inherit;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--ds-brand);
  background: var(--ds-surface);
}

.notice {
  border-color: color-mix(in srgb, var(--ds-warning) 45%, transparent);
  background: var(--ds-warning-soft);
}

.muted {
  color: var(--ds-text-tertiary);
}

.small {
  font-size: 12px;
}

.link {
  background: none;
  border: none;
  color: var(--ds-brand);
  cursor: pointer;
  padding: 0;
  font: inherit;
  text-decoration: underline;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  font-weight: 500;
  color: var(--ds-text-tertiary);
  padding: 6px 10px;
  border-bottom: 1px solid var(--ds-border-subtle);
  font-size: 12px;
}

td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--ds-border-subtle);
}

.kv-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.kv {
  flex: 1 1 160px;
  border: 1px solid var(--ds-border-subtle);
  border-radius: 8px;
  padding: 8px 10px;
}

.kv-label {
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--ds-text-tertiary);
  font-weight: 500;
}

code {
  background: var(--ds-bg-subtle);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12px;
}

textarea {
  resize: vertical;
}
`;
