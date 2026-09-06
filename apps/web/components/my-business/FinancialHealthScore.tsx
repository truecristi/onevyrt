/**
 * Financial Health Score — Overall business health indicator
 */
"use client";

import React, { useMemo } from "react";
import { Gauge } from "@/lib/visualization/sparkline";
import { formatCurrency, calculateHealthScore } from "@/lib/visualization/metrics-utils";

interface HealthScoreComponent {
  label: string;
  value: number;
  target: number;
  weight: number;
  color: string;
}

interface FinancialHealthScoreProps {
  revenue: number;
  revenueTarget: number;
  profit: number;
  profitTarget: number;
  conversionRate: number;
  conversionTarget: number;
  growthRate: number;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export const FinancialHealthScore = React.memo(
  ({
    revenue,
    revenueTarget,
    profit,
    profitTarget,
    conversionRate,
    conversionTarget,
    growthRate,
    title,
    subtitle,
    isLoading,
  }: FinancialHealthScoreProps) => {
    const { score, components, scoreColor, scoreLevel } = useMemo(() => {
      const calculatedScore = calculateHealthScore(
        revenue,
        revenueTarget,
        profit,
        profitTarget,
        conversionRate,
        conversionTarget,
        growthRate
      );

      const revenueScore = Math.min((revenue / revenueTarget) * 100, 100);
      const profitScore = Math.min((profit / profitTarget) * 100, 100);
      const conversionScore = Math.min((conversionRate / conversionTarget) * 100, 100);
      const growthScore = Math.min(Math.max(growthRate * 10, 0), 100);

      const comps: HealthScoreComponent[] = [
        {
          label: "Revenue Performance",
          value: revenueScore,
          target: 100,
          weight: 0.3,
          color: "#16a34a",
        },
        {
          label: "Profit Margin",
          value: profitScore,
          target: 100,
          weight: 0.25,
          color: "#d97706",
        },
        {
          label: "Conversion Rate",
          value: conversionScore,
          target: 100,
          weight: 0.25,
          color: "#2563eb",
        },
        {
          label: "Growth Trajectory",
          value: growthScore,
          target: 100,
          weight: 0.2,
          color: "#dc2626",
        },
      ];

      let color = "#16a34a"; // Green
      let level = "Excellent";

      if (calculatedScore < 40) {
        color = "#dc2626"; // Red
        level = "Critical";
      } else if (calculatedScore < 60) {
        color = "#d97706"; // Amber
        level = "At Risk";
      } else if (calculatedScore < 80) {
        color = "#f59e0b"; // Orange
        level = "Developing";
      } else if (calculatedScore < 90) {
        color = "#84cc16"; // Lime
        level = "Strong";
      }

      return {
        score: calculatedScore,
        components: comps,
        scoreColor: color,
        scoreLevel: level,
      };
    }, [revenue, revenueTarget, profit, profitTarget, conversionRate, conversionTarget, growthRate]);

    if (isLoading) {
      return (
        <div className="w-full">
          {(title || subtitle) && (
            <div className="mb-6 sm:mb-8">
              {title && <div className="h-6 bg-gray-200 rounded w-48 mb-2" />}
              {subtitle && <div className="h-4 bg-gray-200 rounded w-96" />}
            </div>
          )}
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-200 rounded" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
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

        {/* Main score card */}
        <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-gray-50 p-6 sm:p-8 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-center">
            {/* Gauge */}
            <div className="flex justify-center sm:justify-start">
              <div className="relative">
                <Gauge
                  value={score}
                  target={80}
                  size="lg"
                  color={scoreColor}
                  targetColor="#d97706"
                  showLabel={false}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Health Score</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Score info */}
            <div>
              <p className="text-sm text-gray-600 uppercase tracking-wider mb-2">Overall Assessment</p>
              <h3 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: scoreColor }}>
                {scoreLevel}
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Current Score</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(score)}/100</p>
                </div>

                {/* Status zones */}
                <div className="pt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-gray-700">
                      <strong>Critical:</strong> 0–40
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-gray-700">
                      <strong>At Risk:</strong> 40–60
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-gray-700">
                      <strong>Developing:</strong> 60–80
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-700">
                      <strong>Strong:</strong> 80+
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Component scores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {components.map((component) => {
            const percentage = Math.min(component.value, 100);
            let componentStatus = "at-risk";
            if (percentage >= 90) componentStatus = "healthy";
            else if (percentage >= 70) componentStatus = "caution";

            return (
              <div key={component.label} className="rounded-lg border bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                      {component.label}
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{Math.round(percentage)}%</p>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: component.color }}
                  >
                    {componentStatus === "healthy" && "✓"}
                    {componentStatus === "caution" && "!"}
                    {componentStatus === "at-risk" && "✕"}
                  </div>
                </div>

                {/* Small progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: component.color,
                    }}
                  />
                </div>

                {/* Target info */}
                <p className="text-xs text-gray-500 mt-2">Target: {component.target}%</p>
              </div>
            );
          })}
        </div>

        {/* Detailed metrics */}
        <div className="rounded-lg border bg-white p-6 sm:p-8">
          <h3 className="font-semibold text-gray-900 mb-4">Key Metrics Breakdown</h3>

          <div className="space-y-4">
            {/* Revenue */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Revenue</p>
                <span className="text-xs font-semibold text-gray-600">
                  {((revenue / revenueTarget) * 100).toFixed(0)}% of target
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Actual</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(revenue)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Target</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(revenueTarget)}</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ width: `${Math.min((revenue / revenueTarget) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Profit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Profit Margin</p>
                <span className="text-xs font-semibold text-gray-600">
                  {((profit / profitTarget) * 100).toFixed(0)}% of target
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Actual</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(profit)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Target</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(profitTarget)}</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${Math.min((profit / profitTarget) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Conversion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Conversion Rate</p>
                <span className="text-xs font-semibold text-gray-600">
                  {((conversionRate / conversionTarget) * 100).toFixed(0)}% of target
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Actual</p>
                  <p className="font-semibold text-gray-900">{conversionRate.toFixed(2)}%</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-gray-600">Target</p>
                  <p className="font-semibold text-gray-900">{conversionTarget.toFixed(2)}%</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  style={{ width: `${Math.min((conversionRate / conversionTarget) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Growth */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Growth Rate (YoY)</p>
                <span
                  className={`text-xs font-semibold ${
                    growthRate > 0.1 ? "text-green-600" : growthRate < -0.1 ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  {growthRate > 0 ? "+" : ""}{(growthRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-gray-50 p-2 rounded text-xs mb-2">
                <p className="text-gray-700">
                  Your business is growing at <strong>{Math.abs(growthRate * 100).toFixed(1)}%</strong> per year
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-pink-500"
                  style={{ width: `${Math.min(Math.max(growthRate * 10, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 sm:p-5">
          <h3 className="font-semibold text-blue-900 mb-3">Recommendations</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            {score < 60 && (
              <>
                <li>• Focus on revenue growth — this is your immediate priority</li>
                <li>• Review your pricing model and customer acquisition costs</li>
              </>
            )}
            {score >= 60 && score < 80 && (
              <>
                <li>• Your revenue is healthy — now focus on profit margins</li>
                <li>• Look for ways to reduce costs and increase pricing</li>
              </>
            )}
            {score >= 80 && (
              <>
                <li>• You're in strong financial health — focus on scaling</li>
                <li>• Consider investing in team, product, or new markets</li>
              </>
            )}
            <li>• Track these metrics weekly and adjust your strategy accordingly</li>
          </ul>
        </div>
      </div>
    );
  }
);

FinancialHealthScore.displayName = "FinancialHealthScore";

/**
 * Example usage
 */
export function FinancialHealthScoreExample() {
  return (
    <div className="p-8 bg-gray-50">
      <FinancialHealthScore
        revenue={156000}
        revenueTarget={200000}
        profit={42000}
        profitTarget={60000}
        conversionRate={2.8}
        conversionTarget={4.0}
        growthRate={0.25}
        title="Financial Health Assessment"
        subtitle="Overall business health score and component breakdown"
      />
    </div>
  );
}
