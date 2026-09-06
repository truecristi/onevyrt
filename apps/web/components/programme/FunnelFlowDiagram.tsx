"use client";
/**
 * FunnelFlowDiagram — Professional ClickFunnels-style funnel visualization
 * showing traffic flow, conversion stages, drop-off, and performance metrics.
 */
import { useState, useMemo } from "react";
import {
  FunnelStage,
  calculateConversionRate,
  calculateDropOffPercent,
  getPerformanceColor,
  generateFunnelMetrics,
} from "@/lib/funnel/calculations";
import { createTrapezoidPath } from "@/lib/funnel/svg-diagrams";

interface FunnelFlowDiagramProps {
  stages: FunnelStage[];
  title?: string;
  showMetrics?: boolean;
  showDropOff?: boolean;
  interactive?: boolean;
  height?: number;
}

export function FunnelFlowDiagram({
  stages,
  title = "Funnel Overview",
  showMetrics = true,
  showDropOff = true,
  interactive = true,
  height = 500,
}: FunnelFlowDiagramProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  const metrics = useMemo(() => generateFunnelMetrics(stages), [stages]);

  // Calculate trapezoid positions
  const stageHeight = height / stages.length;
  const padding = 40;
  const svgWidth = 800;
  const innerWidth = svgWidth - padding * 2;

  const stagePositions = stages.map((stage, index) => {
    const y = padding + index * stageHeight;
    const maxVisitors = metrics.totalVisitors || 1;
    const widthPercent = (stage.visitors / maxVisitors) * 100;
    const topWidth = (innerWidth * widthPercent) / 100;

    // Calculate next stage width
    const nextIndex = index + 1;
    const nextStage = stages[nextIndex];
    const nextWidthPercent = nextStage ? (nextStage.visitors / maxVisitors) * 100 : 0;
    const bottomWidth = nextStage ? (innerWidth * nextWidthPercent) / 100 : 0;

    const centerX = svgWidth / 2;
    const topX = centerX - topWidth / 2;
    const bottomX = centerX - bottomWidth / 2;

    return {
      stage,
      y,
      topX,
      topWidth,
      bottomX,
      bottomWidth,
      conversions: stage.conversions || 0,
      conversionRate: calculateConversionRate(stage.visitors, stage.conversions || 0),
      dropOffPercent: calculateDropOffPercent(stage.visitors, stage.conversions || 0),
    };
  });

  return (
    <div className="funnel-flow-diagram w-full">
      {title && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
            {title}
          </h3>
        </div>
      )}

      <div className="relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm" style={{
        backgroundColor: "var(--ds-surface)",
        borderColor: "var(--ds-border-subtle)",
      }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${height + padding}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradients for each stage */}
            {stagePositions.map((pos, i) => (
              <linearGradient
                key={`grad-${i}`}
                id={`funnel-grad-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={getPerformanceColor(pos.conversionRate)}
                  stopOpacity="0.8"
                />
                <stop
                  offset="100%"
                  stopColor={getPerformanceColor(pos.conversionRate)}
                  stopOpacity="0.3"
                />
              </linearGradient>
            ))}
          </defs>

          {/* Funnel segments */}
          {stagePositions.map((pos, index) => {
            const isHovered = hoveredStage === pos.stage.id;
            const opacity = hoveredStage ? (isHovered ? 1 : 0.5) : 1;

            return (
              <g
                key={pos.stage.id}
                onMouseEnter={() => interactive && setHoveredStage(pos.stage.id)}
                onMouseLeave={() => interactive && setHoveredStage(null)}
                style={{ cursor: interactive ? "pointer" : "default" }}
                className="funnel-segment-group"
              >
                {/* Main trapezoid */}
                <path
                  d={createTrapezoidPath(
                    pos.topX,
                    pos.topWidth,
                    pos.bottomX,
                    pos.bottomWidth,
                    pos.y,
                    stageHeight - 2
                  )}
                  fill={`url(#funnel-grad-${index})`}
                  stroke={getPerformanceColor(pos.conversionRate)}
                  strokeWidth="2"
                  opacity={opacity}
                  style={{ transition: "opacity 0.2s ease" }}
                />

                {/* Stage name */}
                <text
                  x={svgWidth / 2}
                  y={pos.y + stageHeight / 2 - 10}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="600"
                  fill="var(--ds-text-primary)"
                  opacity={opacity}
                  style={{ transition: "opacity 0.2s ease", pointerEvents: "none" }}
                >
                  {pos.stage.name}
                </text>

                {/* Visitor count */}
                <text
                  x={svgWidth / 2}
                  y={pos.y + stageHeight / 2 + 10}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="500"
                  fill="#666"
                  opacity={opacity}
                  style={{ transition: "opacity 0.2s ease", pointerEvents: "none" }}
                >
                  {pos.stage.visitors.toLocaleString()} visitors
                </text>
              </g>
            );
          })}

          {/* Conversion rates on the right */}
          {showMetrics &&
            stagePositions.map((pos, index) => (
              <g key={`metrics-${index}`} className="stage-metrics">
                <text
                  x={svgWidth - 25}
                  y={pos.y + stageHeight / 2 - 8}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="600"
                  fill={getPerformanceColor(pos.conversionRate)}
                >
                  {pos.conversionRate.toFixed(1)}%
                </text>
                <text
                  x={svgWidth - 25}
                  y={pos.y + stageHeight / 2 + 8}
                  textAnchor="end"
                  fontSize="10"
                  fill="#999"
                >
                  convert
                </text>
              </g>
            ))}

          {/* Drop-off indicators */}
          {showDropOff &&
            stagePositions.slice(0, -1).map((pos, index) => (
              <g key={`dropoff-${index}`} className="dropoff-indicator">
                <text
                  x={20}
                  y={pos.y + stageHeight + 15}
                  fontSize="11"
                  fontWeight="600"
                  fill={pos.dropOffPercent > 80 ? "#dc2626" : pos.dropOffPercent > 50 ? "#d97706" : "#16a34a"}
                >
                  {pos.dropOffPercent.toFixed(0)}% drop-off
                </text>
              </g>
            ))}
        </svg>
      </div>

      {/* Summary metrics */}
      {showMetrics && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--ds-surface-subtle)",
              borderColor: "var(--ds-border-subtle)",
            }}
          >
            <p className="text-sm text-gray-600" style={{ color: "var(--ds-text-tertiary)" }}>
              Total Visitors
            </p>
            <p className="text-2xl font-bold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
              {metrics.totalVisitors.toLocaleString()}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--ds-surface-subtle)",
              borderColor: "var(--ds-border-subtle)",
            }}
          >
            <p className="text-sm text-gray-600" style={{ color: "var(--ds-text-tertiary)" }}>
              Total Conversions
            </p>
            <p className="text-2xl font-bold text-gray-900" style={{ color: "var(--ds-text-primary)" }}>
              {metrics.totalConversions.toLocaleString()}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--ds-surface-subtle)",
              borderColor: "var(--ds-border-subtle)",
            }}
          >
            <p className="text-sm text-gray-600" style={{ color: "var(--ds-text-tertiary)" }}>
              Overall Conversion
            </p>
            <p className="text-2xl font-bold" style={{ color: getPerformanceColor(metrics.overallConversionRate) }}>
              {metrics.overallConversionRate.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .funnel-flow-diagram {
          width: 100%;
        }

        .funnel-segment-group {
          transition: all 0.2s ease;
        }

        .funnel-segment-group:hover {
          filter: brightness(1.05);
        }

        @media (max-width: 768px) {
          :global(.funnel-flow-diagram svg) {
            max-height: 400px;
          }
        }
      `}</style>
    </div>
  );
}
