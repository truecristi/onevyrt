/**
 * Revenue Breakdown — Visual hierarchy of revenue sources and segments
 */
"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/visualization/metrics-utils";

interface RevenueSegment {
  id: string;
  name: string;
  revenue: number;
  previousRevenue?: number;
  profitMargin?: number;
  customers?: number;
  isExpanded?: boolean;
}

interface RevenueBreakdownProps {
  segments: RevenueSegment[];
  currencyCode?: string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  onSegmentClick?: (segmentId: string) => void;
}

export const RevenueBreakdown = React.memo(
  ({
    segments,
    title,
    subtitle,
    isLoading,
    onSegmentClick,
  }: RevenueBreakdownProps) => {
    const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

    // Calculate totals and percentages
    const { total, sortedSegments, highest } = useMemo(() => {
      const totalRevenue = segments.reduce((sum, s) => sum + s.revenue, 0);
      const sorted = [...segments].sort((a, b) => b.revenue - a.revenue);
      const maxRevenue = sorted[0]?.revenue || 0;

      return {
        total: totalRevenue,
        sortedSegments: sorted,
        highest: maxRevenue,
      };
    }, [segments]);

    const handleSegmentClick = (segmentId: string) => {
      setExpandedSegment(expandedSegment === segmentId ? null : segmentId);
      onSegmentClick?.(segmentId);
    };

    if (isLoading) {
      return (
        <div className="w-full space-y-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
              <div className="h-2 bg-gray-200 rounded w-full" />
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

        {/* Total summary card */}
        <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 p-6 mb-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</p>
            <p className="text-sm text-gray-600">
              {segments.length} {segments.length === 1 ? "segment" : "segments"}
            </p>
          </div>
        </div>

        {/* Segments list */}
        {sortedSegments.length > 0 ? (
          <div className="space-y-3">
            {sortedSegments.map((segment, index) => {
              const percentage = total > 0 ? (segment.revenue / total) * 100 : 0;
              const barWidth = highest > 0 ? (segment.revenue / highest) * 100 : 0;
              const growthRate =
                segment.previousRevenue && segment.previousRevenue > 0
                  ? ((segment.revenue - segment.previousRevenue) / segment.previousRevenue) * 100
                  : 0;
              const isExpanded = expandedSegment === segment.id;
              const profitAmount = segment.profitMargin
                ? (segment.revenue * segment.profitMargin) / 100
                : undefined;

              return (
                <button
                  key={segment.id}
                  onClick={() => handleSegmentClick(segment.id)}
                  className={`w-full rounded-lg border transition-all p-4 sm:p-5 text-left ${
                    isExpanded
                      ? "border-green-300 bg-green-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Rank badge */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-sm">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">{segment.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatPercent(percentage)} of total
                        </p>
                      </div>
                    </div>

                    {/* Revenue value */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-lg text-gray-900">{formatCurrency(segment.revenue)}</p>
                      {growthRate !== 0 && (
                        <p
                          className={`text-xs mt-1 font-semibold ${
                            growthRate > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {growthRate > 0 ? "↑" : "↓"} {Math.abs(growthRate).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Horizontal bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Details row (hidden by default) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-white rounded p-3">
                          <p className="text-xs text-gray-600 mb-1">Revenue %</p>
                          <p className="font-bold text-gray-900">{percentage.toFixed(1)}%</p>
                        </div>

                        {segment.customers !== undefined && (
                          <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-600 mb-1">Customers</p>
                            <p className="font-bold text-gray-900">{segment.customers}</p>
                          </div>
                        )}

                        {profitAmount !== undefined && (
                          <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-600 mb-1">Gross Profit</p>
                            <p className="font-bold text-gray-900">{formatCurrency(profitAmount)}</p>
                          </div>
                        )}
                      </div>

                      {/* Profit margin info */}
                      {segment.profitMargin !== undefined && (
                        <div className="bg-white rounded p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Profit Margin</span>
                            <span className="text-sm font-bold text-gray-900">
                              {segment.profitMargin.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                              style={{ width: `${Math.min(segment.profitMargin, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Average revenue per customer */}
                      {segment.customers && segment.customers > 0 && (
                        <div className="bg-blue-50 rounded p-3 border border-blue-200">
                          <p className="text-xs text-blue-700">
                            <strong>ARPU:</strong> {formatCurrency(segment.revenue / segment.customers)}
                          </p>
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
        ) : (
          /* Empty state */
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">No revenue data</p>
            <p className="text-xs text-gray-500 mt-1">Add revenue sources and segments to see breakdown</p>
          </div>
        )}

        {/* Insights section */}
        {sortedSegments.length > 1 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Insights</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                • <strong>{sortedSegments[0]!.name}</strong> drives {((sortedSegments[0]!.revenue / total) * 100).toFixed(1)}%
                of revenue — this is your primary focus
              </p>
              {sortedSegments.length > 1 && (
                <p>
                  • <strong>{sortedSegments[1]!.name}</strong> is your second revenue pillar at{" "}
                  {((sortedSegments[1]!.revenue / total) * 100).toFixed(1)}%
                </p>
              )}
              {sortedSegments.length > 2 && (
                <p>
                  • {sortedSegments.length - 2} smaller {sortedSegments.length - 2 === 1 ? "segment" : "segments"} combine for{" "}
                  {(
                    ((sortedSegments
                      .slice(2)
                      .reduce((sum, s) => sum + s.revenue, 0) / total) *
                      100)
                  ).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

RevenueBreakdown.displayName = "RevenueBreakdown";

/**
 * Example usage
 */
export function RevenueBreakdownExample() {
  const exampleSegments: RevenueSegment[] = [
    {
      id: "consulting",
      name: "Consulting Services",
      revenue: 85000,
      previousRevenue: 75000,
      profitMargin: 68,
      customers: 12,
    },
    {
      id: "productSales",
      name: "Product Sales",
      revenue: 42000,
      previousRevenue: 38000,
      profitMargin: 55,
      customers: 340,
    },
    {
      id: "recurring",
      name: "Recurring Revenue (SaaS)",
      revenue: 18000,
      previousRevenue: 15000,
      profitMargin: 82,
      customers: 45,
    },
    {
      id: "workshops",
      name: "Training & Workshops",
      revenue: 11000,
      previousRevenue: 12000,
      profitMargin: 75,
      customers: 25,
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <RevenueBreakdown
        segments={exampleSegments}
        title="Revenue by Source"
        subtitle="Understand your revenue mix and profitability"
      />
    </div>
  );
}
