/**
 * Performance Scorecard — Learner performance overview for coaches
 */
"use client";

import React, { useMemo } from "react";
import { Gauge, ProgressBar } from "@/lib/visualization/sparkline";
import { calculateEngagementLevel, formatDuration, formatPercent } from "@/lib/visualization/metrics-utils";

interface LearnerPerformance {
  learnerId: string;
  learnerName: string;
  email: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  averageTimePerLesson: number; // in minutes
  expectedTimePerLesson: number; // in minutes
  submissionQualityScore: number; // 0-100
  submissionsCompleted: number;
  submissionsTotal: number;
  daysActive: number;
  daysSinceLastActivity: number;
  cohortName?: string;
  coachNotes?: string;
}

interface PerformanceScorecardProps {
  learner: LearnerPerformance;
  isLoading?: boolean;
}

export const PerformanceScorecard = React.memo(
  ({ learner, isLoading }: PerformanceScorecardProps) => {
    const { engagementLevel, completionRate, timeEfficiency, healthScore } = useMemo(() => {
      const engagement = calculateEngagementLevel(
        learner.submissionsCompleted,
        learner.submissionsTotal,
        learner.daysActive,
        learner.daysSinceLastActivity
      );

      const completion = (learner.lessonsCompleted / learner.lessonsTotal) * 100;
      const timeEff = learner.averageTimePerLesson > 0
        ? ((learner.expectedTimePerLesson / learner.averageTimePerLesson) * 100)
        : 100;

      // Calculate overall health score
      const engagementScore = engagement === "active" ? 100 : engagement === "moderate" ? 70 : 40;
      const submissionScore = (learner.submissionsCompleted / learner.submissionsTotal) * 100;
      const qualityScore = learner.submissionQualityScore;

      const overall = Math.round(
        (engagementScore * 0.3 + submissionScore * 0.35 + qualityScore * 0.35)
      );

      return {
        engagementLevel: engagement,
        completionRate: completion,
        timeEfficiency: Math.min(timeEff, 150), // Cap at 150%
        healthScore: overall,
      };
    }, [learner]);

    const getEngagementColor = (level: string) => {
      switch (level) {
        case "active":
          return { bg: "#dcfce7", text: "#15803d", border: "#16a34a" };
        case "moderate":
          return { bg: "#fef3c7", text: "#92400e", border: "#d97706" };
        case "at-risk":
          return { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" };
        default:
          return { bg: "#f3f4f6", text: "#374151", border: "#9ca3af" };
      }
    };

    const engagementColor = getEngagementColor(engagementLevel);

    if (isLoading) {
      return (
        <div className="rounded-lg border bg-white p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 truncate">{learner.learnerName}</h2>
            <p className="text-sm text-gray-600 mt-1 break-words">{learner.email}</p>
            {learner.cohortName && <p className="text-xs text-gray-500 mt-1">Cohort: {learner.cohortName}</p>}
          </div>

          {/* Engagement badge */}
          <div
            className="px-4 py-2 rounded-lg font-semibold text-sm text-center whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: engagementColor.bg,
              color: engagementColor.text,
              borderLeft: `4px solid ${engagementColor.border}`,
            }}
          >
            {engagementLevel === "active" && "🟢 Active"}
            {engagementLevel === "moderate" && "🟡 Moderate"}
            {engagementLevel === "at-risk" && "🔴 At Risk"}
          </div>
        </div>

        {/* Main metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Overall Health Score */}
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Health Score</p>
            <Gauge
              value={healthScore}
              target={80}
              size="sm"
              color={healthScore >= 80 ? "#16a34a" : healthScore >= 60 ? "#d97706" : "#dc2626"}
              showLabel={false}
            />
            <p className="text-xs text-gray-500 mt-2">Target: 80</p>
          </div>

          {/* Completion Rate */}
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Lesson Progress</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{Math.round(completionRate)}%</p>
            <div className="text-xs text-gray-600 mb-2">
              {learner.lessonsCompleted} of {learner.lessonsTotal} lessons
            </div>
            <ProgressBar
              value={learner.lessonsCompleted}
              max={learner.lessonsTotal}
              status={completionRate >= 80 ? "healthy" : completionRate >= 50 ? "caution" : "at-risk"}
              height="sm"
            />
          </div>

          {/* Submission Quality */}
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Quality Score</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{learner.submissionQualityScore.toFixed(0)}</p>
            <div className="text-xs text-gray-600 mb-2">out of 100</div>
            <ProgressBar
              value={learner.submissionQualityScore}
              max={100}
              status={learner.submissionQualityScore >= 80 ? "healthy" : learner.submissionQualityScore >= 60 ? "caution" : "at-risk"}
              height="sm"
            />
          </div>

          {/* Time Efficiency */}
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Time Efficiency</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{timeEfficiency.toFixed(0)}%</p>
            <div className="text-xs text-gray-600 mb-2">
              Avg: {formatDuration(learner.averageTimePerLesson)}
            </div>
            <ProgressBar
              value={Math.min(timeEfficiency, 100)}
              max={100}
              status={timeEfficiency >= 80 ? "healthy" : timeEfficiency >= 50 ? "caution" : "at-risk"}
              height="sm"
            />
          </div>
        </div>

        {/* Detailed metrics */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Detailed Metrics</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Submissions */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-medium text-blue-900 mb-3">Submissions</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Completed</span>
                  <span className="font-semibold text-blue-900">
                    {learner.submissionsCompleted} / {learner.submissionsTotal}
                  </span>
                </div>
                <ProgressBar
                  value={learner.submissionsCompleted}
                  max={learner.submissionsTotal}
                  status={
                    (learner.submissionsCompleted / learner.submissionsTotal) * 100 >= 80
                      ? "healthy"
                      : (learner.submissionsCompleted / learner.submissionsTotal) * 100 >= 50
                        ? "caution"
                        : "at-risk"
                  }
                  height="sm"
                />
                <p className="text-xs text-blue-600 mt-2">
                  {formatPercent(
                    (learner.submissionsCompleted / learner.submissionsTotal) * 100
                  )} completion rate
                </p>
              </div>
            </div>

            {/* Activity */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-medium text-green-900 mb-3">Activity</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-green-700">Days Active</span>
                  <span className="font-semibold text-green-900">{learner.daysActive}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-700">Last Activity</span>
                  <span
                    className={`font-semibold ${
                      learner.daysSinceLastActivity <= 7
                        ? "text-green-900"
                        : learner.daysSinceLastActivity <= 14
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {learner.daysSinceLastActivity === 0
                      ? "Today"
                      : learner.daysSinceLastActivity === 1
                        ? "Yesterday"
                        : `${learner.daysSinceLastActivity} days ago`}
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  {learner.daysSinceLastActivity <= 7 ? "✓ Actively engaged" : "⚠ Needs check-in"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Time analysis */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold text-gray-900 mb-4">Time Analysis</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">Expected Time</p>
              <p className="text-2xl font-bold text-purple-900">{formatDuration(learner.expectedTimePerLesson)}</p>
              <p className="text-xs text-purple-700 mt-1">per lesson</p>
            </div>

            <div className="rounded-lg bg-pink-50 p-4">
              <p className="text-xs font-medium text-pink-600 uppercase tracking-wider mb-1">Actual Time</p>
              <p className="text-2xl font-bold text-pink-900">{formatDuration(learner.averageTimePerLesson)}</p>
              <p className="text-xs text-pink-700 mt-1">per lesson (average)</p>
            </div>
          </div>

          {learner.averageTimePerLesson < learner.expectedTimePerLesson && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800">
                <strong>✓ Efficient learner:</strong> Completing lessons{" "}
                {(
                  ((learner.expectedTimePerLesson - learner.averageTimePerLesson) /
                    learner.expectedTimePerLesson) *
                  100
                ).toFixed(0)}
                % faster than expected
              </p>
            </div>
          )}

          {learner.averageTimePerLesson > learner.expectedTimePerLesson * 1.5 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>⚠ Needs support:</strong> Taking significantly longer than expected. Consider pairing with
                peer or providing additional resources.
              </p>
            </div>
          )}
        </div>

        {/* Coach notes */}
        {learner.coachNotes && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-2">Coach Notes</h3>
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">{learner.coachNotes}</div>
          </div>
        )}

        {/* At-risk alert */}
        {engagementLevel === "at-risk" && (
          <div className="mt-6 pt-6 border-t border-red-200 bg-red-50 -mx-6 -mb-8 px-6 py-4 rounded-b-lg">
            <div className="flex gap-3">
              <div className="text-red-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-900">Learner Needs Attention</p>
                <p className="text-sm text-red-800 mt-1">
                  This learner is showing signs of disengagement. Consider reaching out to check in, provide encouragement,
                  or adjust the learning plan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PerformanceScorecard.displayName = "PerformanceScorecard";

/**
 * Example usage
 */
export function PerformanceScorecardExample() {
  const exampleLearner: LearnerPerformance = {
    learnerId: "user-123",
    learnerName: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    lessonsCompleted: 12,
    lessonsTotal: 20,
    averageTimePerLesson: 25,
    expectedTimePerLesson: 30,
    submissionQualityScore: 82,
    submissionsCompleted: 8,
    submissionsTotal: 10,
    daysActive: 42,
    daysSinceLastActivity: 3,
    cohortName: "Q1 2025 Cohort",
    coachNotes:
      "Strong performer, progressing well through the program. Good quality submissions. May benefit from advanced modules.",
  };

  return (
    <div className="p-8 bg-gray-50">
      <PerformanceScorecard learner={exampleLearner} />
    </div>
  );
}
