"use client";

import { useCallback, useEffect, useState } from "react";

interface PrivacySettingsData {
  doNotTrack: boolean;
  trackingConsent: boolean;
  analyticsEnabled: boolean;
  marketingEmails: boolean;
  productEmails: boolean;
  gdprAcknowledged: boolean;
  dataRetentionDays: number;
}

export function PrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/privacy");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(
    async (newSettings: Partial<PrivacySettingsData>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/analytics/privacy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings),
        });

        if (!res.ok) throw new Error("Failed to save settings");

        setSettings((prev) =>
          prev ? { ...prev, ...newSettings } : (newSettings as PrivacySettingsData)
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleDeleteData = useCallback(async () => {
    if (!confirm("Are you sure? This will permanently delete all your analytics data.")) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/analytics/privacy", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete data");

      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Loading privacy settings...</div>;
  }

  if (!settings) {
    return <div className="p-4 text-center text-red-600">Failed to load privacy settings</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Privacy Settings</h1>
        <p className="text-gray-600">
          Control how your data is collected, used, and retained.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          Settings saved successfully
        </div>
      )}

      {settings.doNotTrack && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
          Do Not Track is enabled in your browser. Analytics tracking is disabled.
        </div>
      )}

      {/* Analytics Settings */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Analytics Tracking</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Analytics</p>
            <p className="text-sm text-gray-600">
              Allow us to collect data about how you use ONEVYRT to improve the product
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.analyticsEnabled}
            onChange={(e) => handleSave({ analyticsEnabled: e.target.checked })}
            disabled={saving || settings.doNotTrack}
            className="w-5 h-5"
          />
        </div>

        <div className="border-t pt-4">
          <p className="font-medium mb-2">Data Retention</p>
          <select
            value={settings.dataRetentionDays}
            onChange={(e) => handleSave({ dataRetentionDays: parseInt(e.target.value) })}
            disabled={saving}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
          </select>
          <p className="text-sm text-gray-600 mt-2">
            Analytics data will be automatically deleted after this period
          </p>
        </div>
      </div>

      {/* Email Preferences */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Email Preferences</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Product Updates</p>
            <p className="text-sm text-gray-600">
              Receive emails about new features, improvements, and product updates
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.productEmails}
            onChange={(e) => handleSave({ productEmails: e.target.checked })}
            disabled={saving}
            className="w-5 h-5"
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Marketing</p>
              <p className="text-sm text-gray-600">
                Receive promotional emails and special offers
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.marketingEmails}
              onChange={(e) => handleSave({ marketingEmails: e.target.checked })}
              disabled={saving}
              className="w-5 h-5"
            />
          </div>
        </div>
      </div>

      {/* Consent Settings */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Consent</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Tracking Consent</p>
            <p className="text-sm text-gray-600">
              I consent to the collection and use of my data as described in the privacy policy
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.trackingConsent}
            onChange={(e) => handleSave({ trackingConsent: e.target.checked })}
            disabled={saving}
            className="w-5 h-5"
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">GDPR Acknowledged</p>
              <p className="text-sm text-gray-600">
                I acknowledge that I have read and understood the GDPR privacy notice
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.gdprAcknowledged}
              onChange={(e) => handleSave({ gdprAcknowledged: e.target.checked })}
              disabled={saving}
              className="w-5 h-5"
            />
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="border border-red-200 bg-red-50 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-900">Data Management</h2>

        <div>
          <p className="text-sm text-red-800 mb-4">
            Right to erasure (GDPR): Permanently delete all your analytics data. This action cannot
            be undone.
          </p>
          <button
            onClick={handleDeleteData}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Deleting..." : "Delete All Analytics Data"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4 bg-gray-50">
        <h2 className="text-lg font-semibold">About Analytics</h2>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            We use analytics to understand how you use ONEVYRT and to improve your experience. Your
            privacy is important to us.
          </p>
          <p>
            <strong>What we collect:</strong> Page views, user actions, errors, and performance
            metrics
          </p>
          <p>
            <strong>What we don't collect:</strong> Personally identifiable information (PII) by
            default, sensitive form data
          </p>
          <p>
            <strong>How long we keep it:</strong> Based on your data retention preference (default 90
            days)
          </p>
          <p>
            Learn more in our <a href="/privacy" className="text-blue-600 hover:underline">privacy
              policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
