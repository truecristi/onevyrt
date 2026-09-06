'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon as BarChart3,
  PaperAirplaneIcon as Send,
  Cog6ToothIcon as Settings,
  ArrowDownTrayIcon as Download,
  ClockIcon as Clock,
  ExclamationCircleIcon as AlertCircle,
  CheckCircleIcon as CheckCircle,
  EyeIcon as Eye,
  EnvelopeIcon as Mail,
  BoltIcon as Zap,
} from '@heroicons/react/24/outline';

interface Workspace {
  id: string;
  name: string;
  owner_email: string;
  owner_name?: string;
}

interface StalledCohort {
  workspace_id: string;
  workspace_name: string;
  owner_email: string;
  days_inactive: number;
  member_count: number;
  enrollment_stage: string;
  last_activity_at: string;
}

interface CampaignMetrics {
  total_emails_sent: number;
  open_rate: number;
  click_rate: number;
  unsubscribe_rate: number;
  avg_engagement_score: number;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  admin_email: string;
  action: string;
  workspace_id?: string;
  workspace_name?: string;
  details: string;
  status: 'success' | 'failure';
}

interface WorkspaceReminders {
  workspace_id: string;
  workspace_name: string;
  reminders_enabled: boolean;
  email_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  last_sent_at?: string;
  next_send_at?: string;
}

interface ScheduledDigest {
  id: string;
  workspace_id: string;
  workspace_name: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
  recipient_count: number;
}

export function WhyAndCreedCampaignManager() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'stalled' | 'email' | 'schedule' | 'settings' | 'analytics' | 'audit'
  >('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [stalledCohorts, setStalledCohorts] = useState<StalledCohort[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [reminderSettings, setReminderSettings] = useState<WorkspaceReminders[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [scheduledDigests, setScheduledDigests] = useState<ScheduledDigest[]>([]);

  // UI state
  const [testEmailWorkspaceId, setTestEmailWorkspaceId] = useState('');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [auditLogPage, setAuditLogPage] = useState(1);

  // Fetch data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [stalledRes, workspacesRes, settingsRes, metricsRes, auditRes, digestsRes] =
        await Promise.all([
          fetch('/api/admin/campaigns/stalled-cohorts'),
          fetch('/api/admin/campaigns/workspaces'),
          fetch('/api/admin/campaigns/reminder-settings'),
          fetch('/api/admin/campaigns/metrics'),
          fetch('/api/admin/campaigns/audit-log?limit=50&page=1'),
          fetch('/api/admin/campaigns/scheduled-digests'),
        ]);

      if (!stalledRes.ok || !workspacesRes.ok || !settingsRes.ok) {
        throw new Error('Failed to load campaign data');
      }

      const [
        stalledData,
        workspacesData,
        settingsData,
        metricsData,
        auditData,
        digestsData,
      ] = await Promise.all([
        stalledRes.json(),
        workspacesRes.json(),
        settingsRes.json(),
        metricsRes.json(),
        auditRes.json(),
        digestsRes.json(),
      ]);

      setStalledCohorts(stalledData.cohorts || []);
      setWorkspaces(workspacesData.workspaces || []);
      setReminderSettings(settingsData.settings || []);
      setMetrics(metricsData);
      setAuditLog(auditData.entries || []);
      setScheduledDigests(digestsData.digests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailWorkspaceId || !testEmailRecipient) {
      setError('Please select a workspace and enter a test email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/campaigns/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: testEmailWorkspaceId,
          recipient: testEmailRecipient,
        }),
      });

      if (!res.ok) throw new Error('Failed to send test email');

      await res.json();
      setSuccess(`Test email sent to ${testEmailRecipient}`);
      setTestEmailWorkspaceId('');
      setTestEmailRecipient('');

      setTimeout(() => loadAllData(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setLoading(false);
    }
  };

  const scheduleDigest = async () => {
    if (!selectedWorkspaceId || !scheduleDate) {
      setError('Please select a workspace and date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/campaigns/schedule-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: selectedWorkspaceId,
          scheduled_for: `${scheduleDate}T${scheduleTime}:00Z`,
        }),
      });

      if (!res.ok) throw new Error('Failed to schedule digest');

      setSuccess('Digest scheduled successfully');
      setSelectedWorkspaceId('');
      setScheduleDate('');
      setScheduleTime('09:00');

      setTimeout(() => loadAllData(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule digest');
    } finally {
      setLoading(false);
    }
  };

  const toggleReminders = async (
    workspaceId: string,
    currentState: boolean,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/campaigns/toggle-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          enabled: !currentState,
        }),
      });

      if (!res.ok) throw new Error('Failed to update reminders');

      setSuccess(
        `Reminders ${!currentState ? 'enabled' : 'disabled'} for workspace`,
      );
      setTimeout(() => loadAllData(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reminders');
    } finally {
      setLoading(false);
    }
  };

  const updateEmailFrequency = async (
    workspaceId: string,
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/campaigns/update-frequency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          frequency,
        }),
      });

      if (!res.ok) throw new Error('Failed to update frequency');

      setSuccess(`Email frequency updated to ${frequency}`);
      setTimeout(() => loadAllData(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update frequency');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/campaigns/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to export data');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `why-creed-campaigns-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Campaign data exported successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const clearNotification = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-8 h-8 text-amber-500" />
              Why & Creed Campaign Manager
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Manage motivation campaigns, stalled cohorts, and engagement analytics
            </p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={clearNotification}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-200">{success}</p>
          </div>
          <button
            onClick={clearNotification}
            className="ml-auto text-green-600 dark:text-green-400 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'stalled', label: 'Stalled Cohorts', icon: AlertCircle },
          { id: 'email', label: 'Send Email', icon: Mail },
          { id: 'schedule', label: 'Schedule Digests', icon: Clock },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'audit', label: 'Audit Log', icon: Eye },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id as typeof activeTab);
              setAuditLogPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === id
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        {loading && activeTab !== 'audit' && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && !loading && (
          <OverviewTab
            stalledCohorts={stalledCohorts}
            metrics={metrics}
            scheduledDigests={scheduledDigests}
          />
        )}

        {/* Stalled Cohorts Tab */}
        {activeTab === 'stalled' && !loading && (
          <StalledCohortsTab cohorts={stalledCohorts} />
        )}

        {/* Send Email Tab */}
        {activeTab === 'email' && (
          <SendEmailTab
            workspaces={workspaces}
            testEmailWorkspaceId={testEmailWorkspaceId}
            setTestEmailWorkspaceId={setTestEmailWorkspaceId}
            testEmailRecipient={testEmailRecipient}
            setTestEmailRecipient={setTestEmailRecipient}
            onSendTest={sendTestEmail}
            loading={loading}
          />
        )}

        {/* Schedule Digests Tab */}
        {activeTab === 'schedule' && (
          <ScheduleDigestsTab
            workspaces={workspaces}
            scheduledDigests={scheduledDigests}
            selectedWorkspaceId={selectedWorkspaceId}
            setSelectedWorkspaceId={setSelectedWorkspaceId}
            scheduleDate={scheduleDate}
            setScheduleDate={setScheduleDate}
            scheduleTime={scheduleTime}
            setScheduleTime={setScheduleTime}
            onSchedule={scheduleDigest}
            loading={loading}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && !loading && (
          <SettingsTab
            reminderSettings={reminderSettings}
            onToggleReminders={toggleReminders}
            onUpdateFrequency={updateEmailFrequency}
            loading={loading}
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && !loading && (
          <AnalyticsTab metrics={metrics} />
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <AuditLogTab
            entries={auditLog}
            page={auditLogPage}
            onPageChange={setAuditLogPage}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

// Sub-components
function OverviewTab({
  stalledCohorts,
  metrics,
  scheduledDigests,
}: {
  stalledCohorts: StalledCohort[];
  metrics: CampaignMetrics | null;
  scheduledDigests: ScheduledDigest[];
}) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {metrics && (
          <>
            <MetricCard
              title="Emails Sent"
              value={metrics.total_emails_sent.toLocaleString()}
              color="blue"
            />
            <MetricCard
              title="Open Rate"
              value={`${metrics.open_rate.toFixed(1)}%`}
              color="green"
            />
            <MetricCard
              title="Click Rate"
              value={`${metrics.click_rate.toFixed(1)}%`}
              color="purple"
            />
            <MetricCard
              title="Unsubscribe"
              value={`${metrics.unsubscribe_rate.toFixed(1)}%`}
              color="red"
            />
            <MetricCard
              title="Engagement Score"
              value={metrics.avg_engagement_score.toFixed(2)}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Stalled Cohorts</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stalledCohorts.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stalledCohorts.reduce((sum, c) => sum + c.member_count, 0)} total members
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Scheduled Digests</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {scheduledDigests.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {scheduledDigests.filter(d => d.status === 'pending').length} pending
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Avg Inactivity</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stalledCohorts.length > 0
              ? Math.round(
                  stalledCohorts.reduce((sum, c) => sum + c.days_inactive, 0) /
                    stalledCohorts.length,
                )
              : 0}
            d
          </p>
          <p className="text-xs text-slate-500 mt-1">days since last activity</p>
        </div>
      </div>

      {/* Recent Activity */}
      {stalledCohorts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Top Stalled Cohorts
          </h3>
          <div className="space-y-2">
            {stalledCohorts.slice(0, 5).map((cohort, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {cohort.workspace_name}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {cohort.member_count} members • {cohort.days_inactive} days inactive
                  </p>
                </div>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium rounded">
                  {cohort.enrollment_stage}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'red' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`${colors[color]} p-4 rounded-lg`}>
      <p className="text-xs font-medium mb-1 opacity-75">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function StalledCohortsTab({ cohorts }: { cohorts: StalledCohort[] }) {
  const [sortBy, setSortBy] = useState<'days' | 'members' | 'name'>('days');

  const sorted = [...cohorts].sort((a, b) => {
    if (sortBy === 'days') return b.days_inactive - a.days_inactive;
    if (sortBy === 'members') return b.member_count - a.member_count;
    return a.workspace_name.localeCompare(b.workspace_name);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['days', 'members', 'name'] as const).map(sort => (
          <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              sortBy === sort
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white'
            }`}
          >
            Sort by {sort === 'days' ? 'Inactivity' : sort === 'members' ? 'Members' : 'Name'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Workspace
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Owner
              </th>
              <th className="text-right py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Members
              </th>
              <th className="text-right py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Days Inactive
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Stage
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Last Activity
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cohort, idx) => (
              <tr
                key={idx}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">
                  {cohort.workspace_name}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {cohort.owner_email}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                  {cohort.member_count}
                </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      cohort.days_inactive > 30
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {cohort.days_inactive}d
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded">
                    {cohort.enrollment_stage}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                  {new Date(cohort.last_activity_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cohorts.length === 0 && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          No stalled cohorts found.
        </div>
      )}
    </div>
  );
}

function SendEmailTab({
  workspaces,
  testEmailWorkspaceId,
  setTestEmailWorkspaceId,
  testEmailRecipient,
  setTestEmailRecipient,
  onSendTest,
  loading,
}: {
  workspaces: Workspace[];
  testEmailWorkspaceId: string;
  setTestEmailWorkspaceId: (id: string) => void;
  testEmailRecipient: string;
  setTestEmailRecipient: (email: string) => void;
  onSendTest: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Send Test Email
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Test the motivation campaign email before sending to your entire user base.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
            Select Workspace
          </label>
          <select
            value={testEmailWorkspaceId}
            onChange={e => setTestEmailWorkspaceId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="">-- Choose a workspace --</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.owner_email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
            Test Email Address
          </label>
          <input
            type="email"
            value={testEmailRecipient}
            onChange={e => setTestEmailRecipient(e.target.value)}
            placeholder="admin@example.com"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <button
          onClick={onSendTest}
          disabled={loading || !testEmailWorkspaceId || !testEmailRecipient}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          <Send className="w-4 h-4" />
          Send Test Email
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          The test email will include the workspace's Why & Creed content along with recent engagement
          metrics.
        </p>
      </div>
    </div>
  );
}

function ScheduleDigestsTab({
  workspaces,
  scheduledDigests,
  selectedWorkspaceId,
  setSelectedWorkspaceId,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  onSchedule,
  loading,
}: {
  workspaces: Workspace[];
  scheduledDigests: ScheduledDigest[];
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: (id: string) => void;
  scheduleDate: string;
  setScheduleDate: (date: string) => void;
  scheduleTime: string;
  setScheduleTime: (time: string) => void;
  onSchedule: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Form */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Schedule New Digest
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Workspace
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={e => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">-- Choose a workspace --</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Date
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Time (UTC)
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={onSchedule}
              disabled={loading || !selectedWorkspaceId || !scheduleDate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Schedule Digest
            </button>
          </div>
        </div>

        {/* Scheduled List */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Upcoming Digests
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scheduledDigests.length > 0 ? (
              scheduledDigests.map(digest => (
                <div
                  key={digest.id}
                  className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {digest.workspace_name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(digest.scheduled_for).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {digest.recipient_count} recipients
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                        digest.status === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                          : digest.status === 'sent'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      }`}
                    >
                      {digest.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No scheduled digests.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({
  reminderSettings,
  onToggleReminders,
  onUpdateFrequency,
  loading,
}: {
  reminderSettings: WorkspaceReminders[];
  onToggleReminders: (workspaceId: string, currentState: boolean) => Promise<void>;
  onUpdateFrequency: (
    workspaceId: string,
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  ) => Promise<void>;
  loading: boolean;
}) {
  const [expandedWorkspace, setExpandedWorkspace] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        Workspace Reminder Settings
      </h3>

      <div className="space-y-2">
        {reminderSettings.map(settings => (
          <div
            key={settings.workspace_id}
            className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedWorkspace(
                  expandedWorkspace === settings.workspace_id
                    ? null
                    : settings.workspace_id,
                )
              }
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">
                  {settings.workspace_name}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {settings.reminders_enabled ? '✓ Enabled' : '✗ Disabled'} •{' '}
                  {settings.email_frequency}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${
                  settings.reminders_enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                }`}
              >
                {settings.reminders_enabled ? 'Active' : 'Inactive'}
              </span>
            </button>

            {expandedWorkspace === settings.workspace_id && (
              <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/50 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900 dark:text-white block mb-2">
                    Email Frequency
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['daily', 'weekly', 'biweekly', 'monthly'].map(freq => (
                      <button
                        key={freq}
                        onClick={() =>
                          onUpdateFrequency(
                            settings.workspace_id,
                            freq as 'daily' | 'weekly' | 'biweekly' | 'monthly',
                          )
                        }
                        disabled={loading}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          settings.email_frequency === freq
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-500'
                        }`}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {settings.last_sent_at && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Last sent: {new Date(settings.last_sent_at).toLocaleString()}
                    </p>
                    {settings.next_send_at && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Next scheduled: {new Date(settings.next_send_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => onToggleReminders(settings.workspace_id, settings.reminders_enabled)}
                  disabled={loading}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    settings.reminders_enabled
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {settings.reminders_enabled ? 'Disable Reminders' : 'Enable Reminders'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab({ metrics }: { metrics: CampaignMetrics | null }) {
  if (!metrics) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Performance */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Email Performance
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Emails Sent</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.total_emails_sent.toLocaleString()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Open Rate</p>
                <div className="mt-2 bg-white dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(metrics.open_rate, 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                  {metrics.open_rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Click Rate</p>
                <div className="mt-2 bg-white dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(metrics.click_rate, 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                  {metrics.click_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Engagement Health
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Engagement Score
              </p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.avg_engagement_score.toFixed(2)}/10
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Unsubscribe Rate</p>
              <div className="mt-2 bg-white dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${Math.min(metrics.unsubscribe_rate, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                {metrics.unsubscribe_rate.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
          Optimization Tips
        </p>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
          <li>Target open rate improvement through subject line A/B testing</li>
          <li>
            Segment audiences by engagement level for personalized messaging
          </li>
          <li>Monitor unsubscribe trends and adjust frequency if needed</li>
          <li>Use engagement score to identify and re-engage inactive users</li>
        </ul>
      </div>
    </div>
  );
}

function AuditLogTab({
  entries,
  loading,
}: {
  entries: AuditLogEntry[];
  page: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const actions = [...new Set(entries.map(e => e.action))];
  const filtered =
    selectedAction === null ? entries : entries.filter(e => e.action === selectedAction);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedAction(null)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            selectedAction === null
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white'
          }`}
        >
          All Actions
        </button>
        {actions.map(action => (
          <button
            key={action}
            onClick={() => setSelectedAction(action)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedAction === action
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white'
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Timestamp
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Admin
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Action
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Workspace
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Details
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => (
              <tr
                key={entry.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-slate-900 dark:text-white">{entry.admin_email}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded">
                    {entry.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-900 dark:text-white">
                  {entry.workspace_name || '-'}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                  {entry.details}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      entry.status === 'success'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {entry.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          No audit log entries found.
        </div>
      )}
    </div>
  );
}
