/**
 * Sparkline — Compact trend visualization for metrics
 */
"use client";

import React, { useMemo } from "react";
import { generateSparklinePath, calculateSparklineStats, type SparklinePoint } from "./metrics-utils";

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
  showTrendArrow?: boolean;
  className?: string;
}

export const Sparkline = React.memo(
  ({
    data,
    width = 100,
    height = 40,
    color = "#16a34a",
    showTrendArrow = false,
    className = "",
  }: SparklineProps) => {
    const { trend } = useMemo(() => calculateSparklineStats(data), [data]);

    const pathData = useMemo(() => generateSparklinePath(data, width, height), [data, width, height]);

    if (!pathData) {
      return (
        <div className={`w-full h-full bg-gray-100 rounded flex items-center justify-center ${className}`}>
          <span className="text-xs text-gray-500">No data</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
          <defs>
            <linearGradient id={`spark-gradient-${Date.now()}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          <path
            d={`${pathData} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
            fill={`url(#spark-gradient-${Date.now()})`}
          />

          {/* Line */}
          <path d={pathData} stroke={color} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />

          {/* End point dot */}
          <circle cx={width - 2} cy={height / 2} r="1.5" fill={color} />
        </svg>

        {showTrendArrow && (
          <div
            className={`flex-shrink-0 text-xs font-semibold ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500"}`}
            aria-label={`Trend: ${trend}`}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "neutral" && "→"}
          </div>
        )}
      </div>
    );
  }
);

Sparkline.displayName = "Sparkline";

/**
 * Gauge — SVG gauge visualization for metrics (0-100)
 */
interface GaugeProps {
  value: number; // 0-100
  target?: number; // Target marker position (0-100)
  size?: "sm" | "md" | "lg";
  color?: string;
  targetColor?: string;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const Gauge = React.memo(
  ({
    value,
    target,
    size = "md",
    color = "#16a34a",
    targetColor = "#d97706",
    showLabel = true,
    label,
    className = "",
  }: GaugeProps) => {
    const sizeMap = { sm: 80, md: 120, lg: 160 };
    const dimensions = sizeMap[size];
    const radius = dimensions / 2 - 8;
    const circumference = 2 * Math.PI * radius;

    // Clamp value between 0 and 100
    const clampedValue = Math.max(0, Math.min(100, value));
    const clampedTarget = target !== undefined ? Math.max(0, Math.min(100, target)) : undefined;

    // Calculate stroke-dashoffset (reverse for clockwise)
    const offset = circumference - (clampedValue / 100) * circumference;
    const targetOffset = clampedTarget !== undefined ? circumference - (clampedTarget / 100) * circumference : undefined;

    return (
      <div className={`flex flex-col items-center ${className}`}>
        <svg width={dimensions} height={dimensions} viewBox={`0 0 ${dimensions} ${dimensions}`}>
          {/* Background circle */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-gray-200"
            opacity="0.3"
          />

          {/* Target marker */}
          {clampedTarget !== undefined && (
            <circle
              cx={dimensions / 2}
              cy={dimensions / 2}
              r={radius}
              fill="none"
              stroke={targetColor}
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={targetOffset}
              strokeLinecap="round"
              opacity="0.5"
              className="transition-all duration-500"
            />
          )}

          {/* Value circle */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${dimensions / 2} ${dimensions / 2})`}
            className="transition-all duration-500"
          />

          {/* Center text */}
          <text
            x={dimensions / 2}
            y={dimensions / 2}
            textAnchor="middle"
            dy="0.3em"
            className="font-bold"
            fontSize={size === "sm" ? "16" : size === "md" ? "24" : "32"}
            fill="currentColor"
          >
            {Math.round(clampedValue)}
          </text>

          {/* Unit indicator */}
          <text
            x={dimensions / 2}
            y={dimensions / 2 + (size === "sm" ? 14 : size === "md" ? 20 : 28)}
            textAnchor="middle"
            dy="0.3em"
            className="text-gray-500"
            fontSize={size === "sm" ? "10" : "12"}
            fill="currentColor"
          >
            %
          </text>
        </svg>

        {showLabel && label && <p className="mt-2 text-xs font-medium text-gray-600">{label}</p>}
      </div>
    );
  }
);

Gauge.displayName = "Gauge";

/**
 * ProgressBar — Gradient progress bar with status coloring
 */
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  status?: "healthy" | "caution" | "at-risk";
  height?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const statusColorMap = {
  healthy: "bg-gradient-to-r from-green-500 to-green-600",
  caution: "bg-gradient-to-r from-amber-500 to-amber-600",
  "at-risk": "bg-gradient-to-r from-red-500 to-red-600",
};

const heightMap = {
  xs: "h-1",
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export const ProgressBar = React.memo(
  ({
    value,
    max = 100,
    status = "healthy",
    height = "md",
    showLabel = false,
    animated = true,
    className = "",
  }: ProgressBarProps) => {
    const percentage = Math.max(0, Math.min(100, (value / max) * 100));

    return (
      <div className={className}>
        <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightMap[height]}`}>
          <div
            className={`${statusColorMap[status]} ${animated ? "transition-all duration-500" : ""} ${heightMap[height]} rounded-full`}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={Math.round(percentage)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {showLabel && <p className="mt-1 text-xs text-gray-600">{Math.round(percentage)}%</p>}
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";
