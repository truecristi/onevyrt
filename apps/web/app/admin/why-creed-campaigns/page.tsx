'use client';

import { useEffect, useState } from 'react';
import { ExclamationCircleIcon as AlertCircle, ChevronLeftIcon as ChevronLeft, BoltIcon as Zap } from '@heroicons/react/24/outline';
import { WhyAndCreedCampaignManager } from '@/components/admin/WhyAndCreedCampaignManager';

type AdminViewState = 'loading' | 'ok' | 'unauthorized' | 'error';

export default function WhyAndCreedCampaignsAdminPage() {
  const [viewState, setViewState] = useState<AdminViewState>('loading');
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Verify admin access on mount
  useEffect(() => {
    const verifyAdminAccess = async () => {
      try {
        setViewState('loading');
        const response = await fetch('/api/admin/overview', {
          credentials: 'include',
        });

        if (response.status === 401) {
          setViewState('unauthorized');
          return;
        }

        if (response.status === 403) {
          setViewState('unauthorized');
          return;
        }

        if (!response.ok) {
          setViewState('error');
          return;
        }

        const data = await response.json();
        setAdminEmail(data.admin?.email || null);
        setViewState('ok');
      } catch (err) {
        console.error('Failed to verify admin access:', err);
        setViewState('error');
      }
    };

    void verifyAdminAccess();
  }, []);

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (viewState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-md mx-auto pt-20">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-red-200 dark:border-red-800 p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-3">
              Not Authorized
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
              This page is only available to instance admins. Your account email must be listed in the{' '}
              <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm font-mono">
                ADMIN_EMAILS
              </code>{' '}
              environment variable.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 text-center mb-6">
              If you just added your email, restart the server and reload this page.
            </p>
            <div className="flex gap-3">
              <a
                href="/command-center"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to App
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-md mx-auto pt-20">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-yellow-200 dark:border-yellow-800 p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-3">
              Something Went Wrong
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
              We encountered an error loading the admin dashboard. Please try again or contact support.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Reload Page
              </button>
              <a
                href="/command-center"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Admin Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-400"
              title="Back to main admin"
            >
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Campaigns
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Why & Creed Motivation Campaign Manager
              </p>
            </div>
          </div>

          <div className="text-right">
            {adminEmail && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{adminEmail}</span>
              </p>
            )}
            <a
              href="/admin"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Admin Overview
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <WhyAndCreedCampaignManager />
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>Why & Creed Motivation Campaigns · Admin Dashboard</p>
          <p className="mt-1">
            For full admin access controls,{' '}
            <a href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
              return to admin overview
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
