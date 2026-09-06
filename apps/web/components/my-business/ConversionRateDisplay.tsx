/**
 * Conversion Rate Display — Multi-stage funnel metrics
 */
"use client";

import React, { useMemo } from "react";
import { Sparkline, ProgressBar } from "@/lib/visualization/sparkline";
import {
  calculateConversionRate,
  findBottleneck,
  getStatusColor,
  type SparklinePoint,
} from "@/lib/visualization/metrics-utils";

interface ConversionStage {
  id: string;
  name: string;
  input: number;
  output: number;
  target?: number;
  trendData?: SparklinePoint[];
}

interface ConversionRateDisplayProps {
  stages: ConversionStage[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export const ConversionRateDisplay = React.memo(
  ({ stages, title, subtitle, isLoading }: ConversionRateDisplayProps) => {
    const bottleneck = useMemo(() => findBottleneck(stages), [stages]);

    // Calculate overall conversion (first input to last output)
    const overallConversion = useMemo(() => {
      if (stages.length === 0) return 0;
      return calculateConversionRate(stages[0]!.input, stages[stages.length - 1]!.output);
    }, [stages]);

    return (
      <div className="w-full">
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-6 sm:mb-8">
            {title && <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}

        {isLoading && (
          <div className="space-y-6 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
                <div className="h-2 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="space-y-6">
            {/* Overall Conversion Summary */}
            <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Overall Conversion</h3>
                  <p className="text-4xl font-bold text-gray-900">{overallConversion.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stages[0]?.name} → {stages[stages.length - 1]?.name}
                  </p>
                </div>

                {/* Funnel visualization */}
                <div className="w-full sm:w-32 h-20 flex flex-col justify-end">
                  {stages.map((stage, i) => {
                    const width = ((stage.output / stages[0]!.input) * 100).toFixed(0);
                    return (
                      <div
                        key={stage.id}
                        className="bg-gradient-to-r from-blue-400 to-cyan-400 rounded-sm transition-all"
                        style={{
                          width: `${width}%`,
                          height: `${20}px`,
                          marginBottom: i < stages.length - 1 ? "2px" : "0",
                          opacity: 1 - i * 0.15,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottleneck Alert */}
            {bottleneck && bottleneck.rate < 50 && (
              <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-red-600 flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-900">Bottleneck Identified</h4>
                    <p className="text-xs text-red-700 mt-1">
                      <strong>{bottleneck.stage}</strong> is your biggest constraint ({bottleneck.rate.toFixed(1)}%
                      conversion). Improving this stage could lift overall conversion by up to{" "}
                      {bottleneck.impact.toFixed(0)} leads.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stage-by-stage breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Stage Performance</h3>

              {stages.map((stage, index) => {
                const conversionRate = calculateConversionRate(stage.input, stage.output);
                const isBottleneck = bottleneck?.stage === stage.id;
                const targetRate = stage.target ? calculateConversionRate(stage.input, stage.target) : undefined;
                const targetMetForStage =
                  targetRate !== undefined
                    ? conversionRate >= targetRate
                      ? "healthy"
                      : conversionRate >= targetRate * 0.7
                        ? "caution"
                        : "at-risk"
                    : "healthy";
                const statusColor = getStatusColor(targetMetForStage);

                return (
                  <div
                    key={stage.id}
                    className={`rounded-lg border p-4 transition-all ${
                      isBottleneck
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Stage header */}
                    <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                            {index + 1}
                          </span>
                          <h4 className="font-medium text-gray-900">{stage.name}</h4>
                          {isBottleneck && (
                            <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                              Bottleneck
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {stage.input.toLocaleString()} → {stage.output.toLocaleString()} (
                          {((stage.output / stage.input) * 100).toFixed(1)}% through)
                        </p>
                      </div>

                      {/* Conversion rate badge */}
                      <div
                        className="px-3 py-1 rounded font-semibold text-sm whitespace-nowrap flex-shrink-0"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                      >
                        {conversionRate.toFixed(1)}%
                      </div>
                    </div>

                    {/* Conversion metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-xs">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-gray-600 mb-1">Input</p>
                        <p className="font-semibold text-gray-900">{stage.input.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-gray-600 mb-1">Output</p>
                        <p className="font-semibold text-gray-900">{stage.output.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-gray-600 mb-1">Dropoff</p>
                        <p className="font-semibold text-gray-900">{(stage.input - stage.output).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <ProgressBar
                      value={stage.output}
                      max={stage.input}
                      status={targetMetForStage}
                      height="sm"
                      animated={true}
                    />

                    {/* Target vs actual */}
                    {stage.target !== undefined && (
                      <div className="mt-3 text-xs flex items-center justify-between text-gray-600">
                        <span>Target: {calculateConversionRate(stage.input, stage.target).toFixed(1)}%</span>
                        <span
                          className={
                            conversionRate >= calculateConversionRate(stage.input, stage.target)
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {conversionRate >= calculateConversionRate(stage.input, stage.target) ? "✓ Met" : "✕ Below"}
                        </span>
                      </div>
                    )}

                    {/* Trend sparkline */}
                    {stage.trendData && stage.trendData.length > 0 && (
                      <div className="mt-3 p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-600 mb-1">7-day trend</p>
                        <Sparkline
                          data={stage.trendData}
                          width={100}
                          height={24}
                          color={statusColor.border}
                          showTrendArrow={false}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Improvement opportunities */}
            {bottleneck && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 sm:p-6">
                <h3 className="font-semibold text-amber-900 mb-3">Improvement Opportunities</h3>
                <div className="space-y-2 text-sm text-amber-800">
                  <p>
                    • Focus on <strong>{bottleneck.stage}</strong> first — it's holding back {bottleneck.impact} leads
                  </p>
                  <p>
                    • Improving {bottleneck.stage} from {bottleneck.rate.toFixed(1)}% to 75% could add{" "}
                    {Math.round(bottleneck.impact * (0.75 - bottleneck.rate / 100))} more conversions
                  </p>
                  <p>• Test micro-conversions (calls-to-action, clarity, social proof) in this stage</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoading && stages.length === 0 && (
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">No conversion data</p>
            <p className="text-xs text-gray-500 mt-1">Track your sales funnel stages to see conversion metrics</p>
          </div>
        )}
      </div>
    );
  }
);

ConversionRateDisplay.displayName = "ConversionRateDisplay";

/**
 * Example usage
 */
export function ConversionRateDisplayExample() {
  const exampleStages: ConversionStage[] = [
    {
      id: "awareness",
      name: "Awareness",
      input: 5000,
      output: 1500,
      target: 2000,
      trendData: [
        { value: 1200, label: "Day 1" },
        { value: 1250, label: "Day 2" },
        { value: 1350, label: "Day 3" },
        { value: 1450, label: "Day 4" },
        { value: 1480, label: "Day 5" },
        { value: 1500, label: "Day 6" },
        { value: 1500, label: "Day 7" },
      ],
    },
    {
      id: "interest",
      name: "Interest",
      input: 1500,
      output: 600,
      target: 750,
      trendData: [
        { value: 450, label: "Day 1" },
        { value: 480, label: "Day 2" },
        { value: 510, label: "Day 3" },
        { value: 540, label: "Day 4" },
        { value: 570, label: "Day 5" },
        { value: 590, label: "Day 6" },
        { value: 600, label: "Day 7" },
      ],
    },
    {
      id: "consideration",
      name: "Consideration",
      input: 600,
      output: 180,
      target: 300,
      trendData: [
        { value: 120, label: "Day 1" },
        { value: 130, label: "Day 2" },
        { value: 140, label: "Day 3" },
        { value: 150, label: "Day 4" },
        { value: 160, label: "Day 5" },
        { value: 170, label: "Day 6" },
        { value: 180, label: "Day 7" },
      ],
    },
    {
      id: "decision",
      name: "Decision",
      input: 180,
      output: 90,
      target: 120,
      trendData: [
        { value: 60, label: "Day 1" },
        { value: 65, label: "Day 2" },
        { value: 70, label: "Day 3" },
        { value: 75, label: "Day 4" },
        { value: 80, label: "Day 5" },
        { value: 85, label: "Day 6" },
        { value: 90, label: "Day 7" },
      ],
    },
    {
      id: "action",
      name: "Action (Purchase)",
      input: 90,
      output: 45,
      target: 60,
      trendData: [
        { value: 30, label: "Day 1" },
        { value: 32, label: "Day 2" },
        { value: 35, label: "Day 3" },
        { value: 38, label: "Day 4" },
        { value: 40, label: "Day 5" },
        { value: 42, label: "Day 6" },
        { value: 45, label: "Day 7" },
      ],
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <ConversionRateDisplay
        stages={exampleStages}
        title="Sales Funnel Conversion"
        subtitle="Track leads through each stage of your sales process"
      />
    </div>
  );
}
