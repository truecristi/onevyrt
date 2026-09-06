"use client";
/**
 * FunnelHealthPanel — Visual health indicators for funnel stages with
 * benchmark comparison and improvement suggestions.
 */
import { useMemo } from "react";
import {
  FunnelStage,
  calculateFunnelHealthScore,
  getHealthStatus,
  generateImprovementSuggestions,
  generateFunnelMetrics,
} from "@/lib/funnel/calculations";

interface FunnelHealthPanelProps {
  stages: FunnelStage[];
  industryBenchmark?: number; // Overall conversion rate to compare against
  title?: string;
}

export function FunnelHealthPanel({
  stages,
  industryBenchmark = 3.0,
  title = "Funnel Health",
}: FunnelHealthPanelProps) {
  const metrics = useMemo(() => generateFunnelMetrics(stages), [stages]);
  const healthScore = useMemo(() => calculateFunnelHealthScore(stages), [stages]);
  const healthStatus = useMemo(() => getHealthStatus(healthScore), [healthScore]);
  const suggestions = useMemo(() => generateImprovementSuggestions(metrics), [metrics]);

  const isPerforming = metrics.overallConversionRate >= industryBenchmark;

  return (
    <div className="funnel-health-panel w-full space-y-6">
      {title && (
        <h3 className="text-xl font-semibold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
          {title}
        </h3>
      )}

      {/* Main health score */}
      <div
        className="rounded-lg p-6 border"
        style={{
          backgroundColor: "var(--ds-surface)",
          borderColor: "var(--ds-border-subtle)",
        }}
      >
        <div className="flex items-center gap-6">
          {/* Score circle */}
          <div className="flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120" className="text-blue-600">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ds-border-subtle)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={healthStatus.color}
                strokeWidth="8"
                strokeDasharray={`${(healthScore / 100) * 314} 314`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.3s ease" }}
              />
              <text
                x="60"
                y="65"
                textAnchor="middle"
                fontSize="32"
                fontWeight="700"
                fill={healthStatus.color}
              >
                {Math.round(healthScore)}
              </text>
            </svg>
          </div>

          {/* Status info */}
          <div className="flex-1">
            <div className="mb-2">
              <span
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: healthStatus.color + "20",
                  color: healthStatus.color,
                }}
              >
                {healthStatus.emoji} {healthStatus.label}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-3" style={{ color: "var(--ds-text-secondary)" }}>
              Your funnel is performing at {healthScore.toFixed(0)}/100 health.
            </p>

            {/* Benchmark comparison */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Your Conversion</span>
                  <span className="text-xs font-semibold text-blue-600">
                    {metrics.overallConversionRate.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (metrics.overallConversionRate / industryBenchmark) * 100)}%`,
                      backgroundColor: isPerforming ? "#16a34a" : "#d97706",
                    }}
                  />
                </div>
              </div>
              <span className="text-xs font-medium text-gray-600 ml-2" style={{ whiteSpace: "nowrap" }}>
                {isPerforming ? "✓ Above" : "Below"} benchmark ({industryBenchmark}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stage performance breakdown */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
          Stage Performance
        </h4>
        <div className="space-y-2">
          {metrics.stages.map((stage) => {
            const convRate = stage.conversionRate || 0;
            const isBottleneck = stage.id === metrics.bottleneck.stageId;
            const statusColor =
              convRate >= 10
                ? "#0891b2"
                : convRate >= 5
                  ? "#16a34a"
                  : convRate >= 2
                    ? "#d97706"
                    : "#dc2626";

            return (
              <div
                key={stage.id}
                className={`p-3 rounded-lg border ${isBottleneck ? "border-2 bg-orange-50" : "bg-white"}`}
                style={{
                  borderColor: isBottleneck ? "#d97706" : "var(--ds-border-subtle)",
                  backgroundColor: isBottleneck ? "#fef3c7" : "var(--ds-surface)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
                      {stage.name}
                    </span>
                    {isBottleneck && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                        Bottleneck
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold" style={{ color: statusColor }}>
                    {convRate.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, convRate * 10)}%`,
                      backgroundColor: statusColor,
                    }}
                  />
                </div>

                {/* Details */}
                <div className="mt-2 flex justify-between text-xs text-gray-600" style={{ color: "var(--ds-text-tertiary)" }}>
                  <span>{stage.conversions || 0} conversions</span>
                  <span>{stage.visitors} visitors in</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Improvement suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
            Improvement Opportunities
          </h4>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, index) => {
              const bgColor =
                suggestion.priority === "high"
                  ? "#fee2e2"
                  : suggestion.priority === "medium"
                    ? "#fef3c7"
                    : "#e0f2fe";
              const borderColor =
                suggestion.priority === "high"
                  ? "#fecaca"
                  : suggestion.priority === "medium"
                    ? "#fde68a"
                    : "#a5f3fc";
              const icon =
                suggestion.priority === "high" ? "🔴" : suggestion.priority === "medium" ? "🟠" : "🔵";

              return (
                <div
                  key={index}
                  className="p-3 rounded-lg border"
                  style={{ backgroundColor: bgColor, borderColor }}
                >
                  <div className="flex gap-3">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {suggestion.stageName}
                      </p>
                      <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                        {suggestion.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Health tips */}
      <div className="p-4 rounded-lg border bg-blue-50" style={{ borderColor: "#bfdbfe" }}>
        <h4 className="font-semibold text-blue-900 mb-2">Tips for Improving Funnel Health</h4>
        <ul className="space-y-1 text-sm text-blue-800 list-disc list-inside">
          <li>Focus on the bottleneck stage first (biggest lever)</li>
          <li>Test different messages at each stage</li>
          <li>Remove friction from decision and action stages</li>
          <li>Build trust signals in consideration stage</li>
          <li>Track metrics weekly to identify trends</li>
        </ul>
      </div>

      <style jsx>{`
        .funnel-health-panel {
          width: 100%;
        }

        svg circle:first-child {
          stroke: var(--ds-border-subtle);
        }

        @media (max-width: 768px) {
          :global(.funnel-health-panel > div:first-child) {
            flex-direction: column;
            gap: var(--ds-space-4);
          }
        }
      `}</style>
    </div>
  );
}
