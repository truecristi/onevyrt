/**
 * Weekly Activity Summary — Coach view of learner activity
 */
"use client";

import React, { useMemo } from "react";

interface CoachActivityMetric {
  label: string;
  value: number;
  previousValue?: number;
  icon: "inbox" | "check" | "message" | "alert" | "trending";
  color: "blue" | "green" | "amber" | "red" | "purple";
}

interface AtRiskLearner {
  id: string;
  name: string;
  email: string;
  reason: "no_activity" | "low_quality" | "missed_deadline" | "struggling";
  daysSinceActivity?: number;
  lastQualityScore?: number;
}

interface WeeklyActivitySummaryProps {
  submissionsReceived: number;
  previousSubmissions?: number;
  approvalsIssued: number;
  previousApprovals?: number;
  messagesFrom: number;
  atRiskLearners: AtRiskLearner[];
  cohortSize: number;
  title?: string;
  isLoading?: boolean;
}

const IconComponent = ({ icon, color }: { icon: string; color: string }) => {
  const colorMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
    purple: "text-purple-600",
  };

  const colorClass = colorMap[color as keyof typeof colorMap] || "text-gray-600";

  switch (icon) {
    case "inbox":
      return (
        <svg className={`w-6 h-6 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      );
    case "check":
      return (
        <svg className={`w-6 h-6 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "message":
      return (
        <svg className={`w-6 h-6 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case "alert":
      return (
        <svg className={`w-6 h-6 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4v2m0 0v2m0-6h0m-6 0h0m12 0h0M6 21h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case "trending":
      return (
        <svg className={`w-6 h-6 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    default:
      return null;
  }
};

export const WeeklyActivitySummary = React.memo(
  ({
    submissionsReceived,
    previousSubmissions,
    approvalsIssued,
    previousApprovals,
    messagesFrom,
    atRiskLearners,
    cohortSize,
    title,
    isLoading,
  }: WeeklyActivitySummaryProps) => {
    const metrics = useMemo(() => {
      const metricsList: CoachActivityMetric[] = [
        {
          label: "Submissions Received",
          value: submissionsReceived,
          previousValue: previousSubmissions,
          icon: "inbox",
          color: "blue",
        },
        {
          label: "Approvals Issued",
          value: approvalsIssued,
          previousValue: previousApprovals,
          icon: "check",
          color: "green",
        },
        {
          label: "Coach Messages",
          value: messagesFrom,
          icon: "message",
          color: "purple",
        },
        {
          label: "Learner Engagement",
          value: Math.round(((submissionsReceived + approvalsIssued) / (cohortSize * 2)) * 100),
          icon: "trending",
          color: "amber",
        },
      ];

      return metricsList;
    }, [submissionsReceived, previousSubmissions, approvalsIssued, previousApprovals, messagesFrom, cohortSize]);

    const getTrendColor = (current: number, previous?: number) => {
      if (!previous) return "text-gray-500";
      if (current > previous) return "text-green-600";
      if (current < previous) return "text-red-600";
      return "text-gray-500";
    };

    const getTrendIcon = (current: number, previous?: number) => {
      if (!previous) return "→";
      if (current > previous) return "↑";
      if (current < previous) return "↓";
      return "→";
    };

    const calculateTrendPercent = (current: number, previous?: number) => {
      if (!previous || previous === 0) return 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    if (isLoading) {
      return (
        <div className="w-full space-y-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-6 h-32" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        {/* Header */}
        {title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">This week's coaching activity snapshot</p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border bg-white p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <IconComponent icon={metric.icon} color={metric.color} />

                {metric.previousValue !== undefined && (
                  <div
                    className={`text-sm font-semibold flex items-center gap-1 ${getTrendColor(metric.value, metric.previousValue)}`}
                  >
                    <span>{getTrendIcon(metric.value, metric.previousValue)}</span>
                    <span>{Math.abs(calculateTrendPercent(metric.value, metric.previousValue))}%</span>
                  </div>
                )}
              </div>

              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">{metric.label}</p>
              <p className="text-3xl font-bold text-gray-900">{metric.value}</p>

              {metric.previousValue !== undefined && (
                <p className="text-xs text-gray-500 mt-2">Last week: {metric.previousValue}</p>
              )}
            </div>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Completion rate */}
          <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 p-6">
            <h3 className="text-sm font-semibold text-green-900 mb-3">Cohort Health</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Active Learners</span>
                <span className="text-2xl font-bold text-green-900">
                  {Math.round((submissionsReceived / cohortSize) * 100)}%
                </span>
              </div>
              <p className="text-xs text-green-700">
                {submissionsReceived} of {cohortSize} learners submitted this week
              </p>
            </div>
          </div>

          {/* Approval rate */}
          <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Review Progress</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Approvals</span>
                <span className="text-2xl font-bold text-blue-900">{approvalsIssued}</span>
              </div>
              <p className="text-xs text-blue-700">
                {approvalsIssued} learners advanced this week
              </p>
            </div>
          </div>
        </div>

        {/* At-risk learners section */}
        {atRiskLearners.length > 0 ? (
          <div className="rounded-lg border bg-red-50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-red-900">Learners Needing Attention</h3>
              <span className="ml-auto inline-block px-2 py-1 rounded text-xs font-bold text-red-700 bg-red-100">
                {atRiskLearners.length}
              </span>
            </div>

            <div className="space-y-2">
              {atRiskLearners.map((learner) => (
                <div
                  key={learner.id}
                  className="rounded-lg bg-white p-3 border border-red-200 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{learner.name}</p>
                    <p className="text-xs text-gray-600 truncate">{learner.email}</p>

                    {/* Reason badge */}
                    <div className="mt-1">
                      {learner.reason === "no_activity" && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-amber-700 bg-amber-100">
                          No activity ({learner.daysSinceActivity} days)
                        </span>
                      )}
                      {learner.reason === "low_quality" && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-orange-700 bg-orange-100">
                          Low quality ({learner.lastQualityScore}%)
                        </span>
                      )}
                      {learner.reason === "missed_deadline" && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-red-700 bg-red-100">
                          Missed deadline
                        </span>
                      )}
                      {learner.reason === "struggling" && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-red-700 bg-red-100">
                          Struggling with content
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                    Check in
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-red-700 mt-4">
              💡 Tip: Reach out with encouragement, clarify unclear content, or adjust deadlines as needed.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
            <svg className="w-12 h-12 mx-auto text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-semibold text-green-900">All learners on track</p>
            <p className="text-sm text-green-700 mt-1">No at-risk learners this week</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
              </svg>
              Send Weekly Digest
            </button>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Detailed Report
            </button>
          </div>
        </div>
      </div>
    );
  }
);

WeeklyActivitySummary.displayName = "WeeklyActivitySummary";

/**
 * Example usage
 */
export function WeeklyActivitySummaryExample() {
  const exampleAtRiskLearners: AtRiskLearner[] = [
    {
      id: "learner-1",
      name: "John Smith",
      email: "john.smith@example.com",
      reason: "no_activity",
      daysSinceActivity: 12,
    },
    {
      id: "learner-2",
      name: "Emma Davis",
      email: "emma.davis@example.com",
      reason: "low_quality",
      lastQualityScore: 42,
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <WeeklyActivitySummary
        submissionsReceived={24}
        previousSubmissions={18}
        approvalsIssued={16}
        previousApprovals={12}
        messagesFrom={8}
        atRiskLearners={exampleAtRiskLearners}
        cohortSize={30}
        title="Weekly Activity Summary"
      />
    </div>
  );
}
