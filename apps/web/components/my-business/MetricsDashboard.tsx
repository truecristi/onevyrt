/**
 * Business Metrics Dashboard — displays key performance indicators
 */
"use client";

import React, { useState } from "react";
import { Sparkline, ProgressBar } from "@/lib/visualization/sparkline";
import {
  calculateTrend,
  formatNumber,
  formatPercent,
  getStatusColor,
  type MetricTrend,
  type SparklinePoint,
} from "@/lib/visualization/metrics-utils";

interface MetricCardData {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit?: string;
  benchmark?: number;
  target?: number;
  previousValue?: number;
  trendData?: SparklinePoint[];
  health: "healthy" | "caution" | "at-risk";
  onClick?: () => void;
}

interface MetricsDashboardProps {
  metrics: MetricCardData[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

interface MetricCardProps {
  metric: MetricCardData;
  trend?: MetricTrend;
}

const MetricCard = React.memo(({ metric, trend }: MetricCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const statusColor = getStatusColor(metric.health);

  return (
    <button
      onClick={metric.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative overflow-hidden rounded-lg border bg-white p-4 sm:p-6 transition-all duration-200 ${
        metric.onClick
          ? "cursor-pointer hover:shadow-lg hover:border-gray-300"
          : "cursor-default hover:shadow-md"
      }`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: statusColor.border,
      }}
    >
      {/* Background accent */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundColor: statusColor.bg, zIndex: -1 }}
      />

      {/* Top row: label and status badge */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wider">{metric.label}</h3>
        </div>
        <div
          className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
        >
          {metric.health === "healthy" && "✓ Healthy"}
          {metric.health === "caution" && "! Caution"}
          {metric.health === "at-risk" && "✕ At Risk"}
        </div>
      </div>

      {/* Main value */}
      <div className="mb-4">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metric.formattedValue}</p>
        {metric.unit && <p className="text-xs text-gray-500 mt-1">{metric.unit}</p>}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span
            className={`inline-flex items-center font-semibold ${
              trend.direction === "up"
                ? "text-green-600"
                : trend.direction === "down"
                  ? "text-red-600"
                  : "text-gray-500"
            }`}
          >
            {trend.direction === "up" && "↑"}
            {trend.direction === "down" && "↓"}
            {trend.direction === "neutral" && "→"}
            {trend.percentChange.toFixed(1)}%
          </span>
          <span className="text-gray-500">vs previous</span>
        </div>
      )}

      {/* Benchmark comparison */}
      {metric.benchmark !== undefined && (
        <div className="mb-4 flex items-center justify-between text-xs text-gray-600">
          <span>Industry avg:</span>
          <span className="font-medium text-gray-900">{formatNumber(metric.benchmark, 0)}</span>
        </div>
      )}

      {/* Sparkline chart */}
      {metric.trendData && metric.trendData.length > 0 && (
        <div className="mb-3 bg-gray-50 rounded p-2">
          <Sparkline
            data={metric.trendData}
            width={100}
            height={30}
            color={statusColor.border}
            showTrendArrow={false}
          />
        </div>
      )}

      {/* Target progress */}
      {metric.target !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-gray-600">Target:</span>
            <span className="font-medium text-gray-900">
              {formatPercent((metric.value / metric.target) * 100, 0)}
            </span>
          </div>
          <ProgressBar
            value={metric.value}
            max={metric.target}
            status={metric.health}
            height="sm"
            animated={true}
          />
        </div>
      )}

      {/* Hover indicator */}
      {metric.onClick && isHovered && (
        <div className="absolute top-2 right-2 text-gray-400 group-hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  );
});

MetricCard.displayName = "MetricCard";

export const MetricsDashboard = React.memo(
  ({ metrics, title, subtitle, isLoading }: MetricsDashboardProps) => {
    return (
      <div className="w-full">
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-6 sm:mb-8">
            {title && <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-4 sm:p-6 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-24 mb-4" />
                <div className="h-8 bg-gray-200 rounded w-32 mb-4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Metrics grid */}
        {!isLoading && metrics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {metrics.map((metric) => {
              const trend =
                metric.previousValue !== undefined
                  ? calculateTrend(metric.value, metric.previousValue)
                  : undefined;

              return <MetricCard key={metric.id} metric={metric} trend={trend} />;
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && metrics.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 sm:p-12 text-center">
            <div className="text-gray-500 mb-2">
              <svg
                className="w-12 h-12 mx-auto text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No metrics available</p>
            <p className="text-xs text-gray-500 mt-1">Complete your business profile to see metrics</p>
          </div>
        )}
      </div>
    );
  }
);

MetricsDashboard.displayName = "MetricsDashboard";

/**
 * Example usage
 */
export function MetricsDashboardExample() {
  const exampleMetrics: MetricCardData[] = [
    {
      id: "revenue",
      label: "Annual Revenue",
      value: 156000,
      formattedValue: "$156k",
      unit: "TTM",
      benchmark: 120000,
      target: 200000,
      previousValue: 140000,
      health: "caution",
      trendData: [
        { value: 120000, label: "Jan" },
        { value: 125000, label: "Feb" },
        { value: 128000, label: "Mar" },
        { value: 135000, label: "Apr" },
        { value: 140000, label: "May" },
        { value: 145000, label: "Jun" },
        { value: 152000, label: "Jul" },
        { value: 156000, label: "Aug" },
      ],
    },
    {
      id: "profit",
      label: "Net Profit",
      value: 42000,
      formattedValue: "$42k",
      unit: "TTM",
      benchmark: 36000,
      target: 60000,
      previousValue: 38000,
      health: "caution",
      trendData: [
        { value: 30000, label: "Jan" },
        { value: 32000, label: "Feb" },
        { value: 33000, label: "Mar" },
        { value: 35000, label: "Apr" },
        { value: 37000, label: "May" },
        { value: 38000, label: "Jun" },
        { value: 40000, label: "Jul" },
        { value: 42000, label: "Aug" },
      ],
    },
    {
      id: "customers",
      label: "Active Customers",
      value: 245,
      formattedValue: "245",
      benchmark: 180,
      target: 300,
      previousValue: 220,
      health: "healthy",
      trendData: [
        { value: 180, label: "Jan" },
        { value: 190, label: "Feb" },
        { value: 200, label: "Mar" },
        { value: 210, label: "Apr" },
        { value: 215, label: "May" },
        { value: 225, label: "Jun" },
        { value: 230, label: "Jul" },
        { value: 245, label: "Aug" },
      ],
    },
    {
      id: "team",
      label: "Team Size",
      value: 8,
      formattedValue: "8",
      unit: "headcount",
      benchmark: 7,
      target: 10,
      previousValue: 7,
      health: "healthy",
      trendData: [
        { value: 5, label: "Jan" },
        { value: 5, label: "Feb" },
        { value: 5, label: "Mar" },
        { value: 6, label: "Apr" },
        { value: 6, label: "May" },
        { value: 7, label: "Jun" },
        { value: 7, label: "Jul" },
        { value: 8, label: "Aug" },
      ],
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <MetricsDashboard
        metrics={exampleMetrics}
        title="Business Metrics"
        subtitle="Key performance indicators for your business"
      />
    </div>
  );
}
