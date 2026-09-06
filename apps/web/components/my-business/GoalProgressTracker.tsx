/**
 * Goal Progress Tracker — Track progress toward business goals
 */
"use client";

import React, { useState, useMemo } from "react";
import { ProgressBar } from "@/lib/visualization/sparkline";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/visualization/metrics-utils";

interface Milestone {
  id: string;
  name: string;
  targetDate: string;
  status: "not_started" | "in_progress" | "completed";
}

interface BusinessGoal {
  id: string;
  name: string;
  description?: string;
  category: "revenue" | "customers" | "team" | "profit" | "growth" | "other";
  target: number;
  current: number;
  unit: string;
  timeframe: "quarterly" | "annual" | "36months";
  startDate: string;
  targetDate: string;
  milestones?: Milestone[];
  impactArea?: string;
  isExpanded?: boolean;
}

interface GoalProgressTrackerProps {
  goals: BusinessGoal[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

const categoryColors = {
  revenue: { bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
  customers: { bg: "#dbeafe", text: "#1e40af", border: "#2563eb" },
  team: { bg: "#fce7f3", text: "#831843", border: "#db2777" },
  profit: { bg: "#fef3c7", text: "#92400e", border: "#d97706" },
  growth: { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" },
  other: { bg: "#f3e8ff", text: "#6b21a8", border: "#a855f7" },
};

export const GoalProgressTracker = React.memo(
  ({ goals, title, subtitle, isLoading }: GoalProgressTrackerProps) => {
    const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

    const { goalsByTimeframe, overallProgress } = useMemo(() => {
      const byTimeframe = {
        quarterly: goals.filter((g) => g.timeframe === "quarterly"),
        annual: goals.filter((g) => g.timeframe === "annual"),
        "36months": goals.filter((g) => g.timeframe === "36months"),
      };

      const total = goals.length;
      const completed = goals.filter((g) => (g.current / g.target) * 100 >= 100).length;

      return {
        goalsByTimeframe: byTimeframe,
        overallProgress: total > 0 ? (completed / total) * 100 : 0,
      };
    }, [goals]);

    const handleGoalClick = (goalId: string) => {
      setExpandedGoal(expandedGoal === goalId ? null : goalId);
    };

    if (isLoading) {
      return (
        <div className="w-full space-y-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="w-full">
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-6 sm:mb-8">
            {title && <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}

        {/* Overall progress card */}
        {goals.length > 0 && (
          <div className="rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Overall Progress</p>
                <p className="text-4xl font-bold text-gray-900">{formatPercent(overallProgress, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {goals.filter((g) => (g.current / g.target) * 100 >= 100).length} of {goals.length} goals{" "}
                  {goals.length === 1 ? "completed" : ""}
                </p>
              </div>
              <div className="flex items-end">
                <ProgressBar value={overallProgress} max={100} status="healthy" height="lg" animated={true} />
              </div>
            </div>
          </div>
        )}

        {/* Goals by timeframe */}
        {Object.entries(goalsByTimeframe).map(([timeframe, timeframeGoals]) => {
          if (timeframeGoals.length === 0) return null;

          const timeframeLabels = {
            quarterly: "This Quarter",
            annual: "Annual Goals",
            "36months": "3-Year Vision",
          };

          return (
            <div key={timeframe} className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{timeframeLabels[timeframe as keyof typeof timeframeLabels]}</h3>

              <div className="space-y-3">
                {timeframeGoals.map((goal) => {
                  const percentage = Math.min((goal.current / goal.target) * 100, 100);
                  const isExpanded = expandedGoal === goal.id;
                  const color = categoryColors[goal.category];
                  let status: "healthy" | "caution" | "at-risk" = "at-risk";
                  if (percentage >= 100) status = "healthy";
                  else if (percentage >= 70) status = "caution";

                  // Calculate days remaining
                  const now = new Date();
                  const targetDate = new Date(goal.targetDate);
                  const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysRemaining < 0;

                  return (
                    <button
                      key={goal.id}
                      onClick={() => handleGoalClick(goal.id)}
                      className={`w-full rounded-lg border transition-all p-4 sm:p-5 text-left ${
                        isExpanded
                          ? "border-purple-300 bg-purple-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="flex-shrink-0 w-3 h-3 rounded-full"
                              style={{ backgroundColor: color.border }}
                            />
                            <h3 className="font-semibold text-gray-900 truncate">{goal.name}</h3>
                            {percentage >= 100 && (
                              <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
                                ✓ Complete
                              </span>
                            )}
                          </div>
                          {goal.description && (
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{goal.description}</p>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-lg text-gray-900">{formatPercent(percentage, 0)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isOverdue ? "Overdue" : `${Math.abs(daysRemaining)} days left`}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <ProgressBar value={goal.current} max={goal.target} status={status} height="sm" animated={true} />

                      {/* Details row (hidden by default) */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-purple-200 space-y-4">
                          {/* Metrics grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">Current</p>
                              <p className="font-bold text-gray-900">
                                {goal.unit === "currency"
                                  ? formatCurrency(goal.current as any)
                                  : formatNumber(goal.current as any)}
                              </p>
                            </div>

                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">Target</p>
                              <p className="font-bold text-gray-900">
                                {goal.unit === "currency"
                                  ? formatCurrency(goal.target as any)
                                  : formatNumber(goal.target as any)}
                              </p>
                            </div>

                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">Remaining</p>
                              <p className="font-bold text-gray-900">
                                {goal.unit === "currency"
                                  ? formatCurrency((goal.target - goal.current) as any)
                                  : formatNumber((goal.target - goal.current) as any)}
                              </p>
                            </div>
                          </div>

                          {/* Timeline info */}
                          <div className="bg-blue-50 rounded p-3 border border-blue-200">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-blue-700 font-semibold mb-1">Start Date</p>
                                <p className="text-blue-600">
                                  {new Date(goal.startDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div>
                                <p className="text-blue-700 font-semibold mb-1">Target Date</p>
                                <p
                                  className={isOverdue ? "text-red-600 font-semibold" : "text-blue-600"}
                                >
                                  {new Date(goal.targetDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Milestones */}
                          {goal.milestones && goal.milestones.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Milestones</p>
                              <div className="space-y-2">
                                {goal.milestones.map((milestone) => {
                                  const milestoneComplete =
                                    milestone.status === "completed" ||
                                    new Date(milestone.targetDate) < new Date();
                                  return (
                                    <div
                                      key={milestone.id}
                                      className="flex items-center gap-2 text-xs p-2 bg-white rounded border border-gray-200"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={milestoneComplete}
                                        readOnly
                                        className="w-4 h-4 rounded"
                                      />
                                      <span className={milestoneComplete ? "line-through text-gray-500" : "text-gray-700"}>
                                        {milestone.name}
                                      </span>
                                      <span className="text-gray-500 ml-auto">
                                        {new Date(milestone.targetDate).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Impact area */}
                          {goal.impactArea && (
                            <div className="bg-amber-50 rounded p-3 border border-amber-200">
                              <p className="text-xs font-semibold text-amber-900 mb-1">Impact Area</p>
                              <p className="text-xs text-amber-800">{goal.impactArea}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expand indicator */}
                      {isExpanded && (
                        <div className="absolute top-2 right-2 text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {goals.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 sm:p-12 text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">No goals yet</p>
            <p className="text-xs text-gray-500 mt-1">Set quarterly and annual goals to track business progress</p>
          </div>
        )}
      </div>
    );
  }
);

GoalProgressTracker.displayName = "GoalProgressTracker";

/**
 * Example usage
 */
export function GoalProgressTrackerExample() {
  const exampleGoals: BusinessGoal[] = [
    {
      id: "q1-revenue",
      name: "Q1 Revenue Target",
      description: "Hit $50k revenue in Q1",
      category: "revenue",
      target: 50000,
      current: 38500,
      unit: "currency",
      timeframe: "quarterly",
      startDate: "2025-01-01",
      targetDate: "2025-03-31",
      impactArea: "Top-line growth",
      milestones: [
        {
          id: "m1",
          name: "Onboard 5 new clients",
          targetDate: "2025-02-15",
          status: "completed",
        },
        {
          id: "m2",
          name: "Launch new pricing tier",
          targetDate: "2025-02-01",
          status: "in_progress",
        },
      ],
    },
    {
      id: "annual-customers",
      name: "Reach 500 Customers",
      description: "Grow customer base to 500",
      category: "customers",
      target: 500,
      current: 245,
      unit: "customers",
      timeframe: "annual",
      startDate: "2025-01-01",
      targetDate: "2025-12-31",
      impactArea: "Market penetration",
    },
    {
      id: "3yr-revenue",
      name: "Scale to $2M ARR",
      description: "3-year vision: $2M in annual recurring revenue",
      category: "revenue",
      target: 2000000,
      current: 156000,
      unit: "currency",
      timeframe: "36months",
      startDate: "2025-01-01",
      targetDate: "2027-12-31",
      impactArea: "Business scale",
    },
    {
      id: "annual-profit",
      name: "Improve Profit Margin",
      description: "Increase net profit margin to 40%",
      category: "profit",
      target: 40,
      current: 27,
      unit: "percent",
      timeframe: "annual",
      startDate: "2025-01-01",
      targetDate: "2025-12-31",
      impactArea: "Financial health",
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <GoalProgressTracker
        goals={exampleGoals}
        title="Business Goals"
        subtitle="Track your progress toward quarterly, annual, and long-term business objectives"
      />
    </div>
  );
}
