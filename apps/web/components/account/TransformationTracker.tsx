"use client";
/**
 * Transformation Tracker — Before/after comparison visualization
 *
 * Shows key metrics tracked throughout the journey:
 * - Revenue, Profit, Customers, Team, Stage
 * - Before → After comparison
 * - Percentage improvement in green
 * - Visual arrows showing direction
 * - 3-month forward projection
 * - Shareable summary card
 * - Mobile responsive
 */

import React, { useMemo } from "react";
import { CHAPTER_COLORS } from "@/lib/colors/chapter-tokens";

interface MetricData {
  id: string;
  label: string;
  icon: string;
  startValue: number | string;
  currentValue: number | string;
  unit: string;
  isNumeric: boolean;
  format?: "currency" | "percent" | "number" | "text";
  projectedValue?: number | string;
}

interface TransformationTrackerProps {
  metrics: MetricData[];
  journeyStartDate?: string;
  readinessScoreStart?: number;
  readinessScoreCurrent?: number;
  onExport?: () => void;
  onShare?: () => void;
}

interface MetricComparison {
  metric: MetricData;
  improvement: number | null;
  direction: "up" | "down" | "neutral";
  formattedStart: string;
  formattedCurrent: string;
  formattedProjected?: string;
}

const formatValue = (value: number | string, format?: string): string => {
  if (typeof value === "string") return value;

  switch (format) {
    case "currency":
      return `$${(value / 1000).toFixed(1)}k`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toLocaleString();
    default:
      return value.toString();
  }
};

const calculateImprovement = (start: number | string, current: number | string): number | null => {
  if (typeof start !== "number" || typeof current !== "number") return null;
  if (start === 0) return null;
  return ((current - start) / start) * 100;
};

export const TransformationTracker = React.memo(function TransformationTracker({
  metrics,
  journeyStartDate,
  readinessScoreStart,
  readinessScoreCurrent,
  onExport,
  onShare,
}: TransformationTrackerProps) {
  const comparisons = useMemo<MetricComparison[]>(() => {
    return metrics.map((metric) => {
      const improvement = metric.isNumeric ? calculateImprovement(metric.startValue, metric.currentValue) : null;
      const direction: "up" | "down" | "neutral" = improvement ? (improvement > 0 ? "up" : improvement < 0 ? "down" : "neutral") : "neutral";

      return {
        metric,
        improvement,
        direction,
        formattedStart: formatValue(metric.startValue, metric.format),
        formattedCurrent: formatValue(metric.currentValue, metric.format),
        formattedProjected: metric.projectedValue ? formatValue(metric.projectedValue, metric.format) : undefined,
      };
    });
  }, [metrics]);

  const readinessImprovement = useMemo(() => {
    if (!readinessScoreStart || !readinessScoreCurrent) return null;
    return readinessScoreCurrent - readinessScoreStart;
  }, [readinessScoreStart, readinessScoreCurrent]);

  const journeyDuration = useMemo(() => {
    if (!journeyStartDate) return null;
    const start = new Date(journeyStartDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    if (months > 0) return `${months}m`;
    if (weeks > 0) return `${weeks}w`;
    return `${days}d`;
  }, [journeyStartDate]);

  return (
    <div className="tt-root">
      <style>{`
        .tt-root {
          font-family: system-ui, -apple-system, sans-serif;
          color: var(--color-text, #000);
        }

        .tt-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          background: var(--color-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--color-border, #e5e7eb);
        }

        .tt-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tt-title {
          font-size: 1.75rem;
          font-weight: 800;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .tt-title-icon {
          font-size: 2rem;
        }

        .tt-subtitle {
          font-size: 0.95rem;
          color: var(--color-text-muted, #666);
          margin: 0;
        }

        .tt-journey-info {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          padding: 1rem;
          background: linear-gradient(135deg, ${CHAPTER_COLORS.define}08, ${CHAPTER_COLORS.finish}08);
          border-radius: 8px;
          border-left: 4px solid ${CHAPTER_COLORS.define};
        }

        .tt-journey-stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .tt-journey-stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
          color: ${CHAPTER_COLORS.define};
        }

        .tt-journey-stat-label {
          font-size: 0.85rem;
          color: var(--color-text-muted, #666);
          margin: 0;
        }

        .tt-readiness-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, ${CHAPTER_COLORS.define}10, ${CHAPTER_COLORS.implement}10);
          border: 2px solid var(--color-border, #e5e7eb);
          border-radius: 8px;
          border-left: 4px solid ${CHAPTER_COLORS.define};
        }

        .tt-readiness-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tt-readiness-scores {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1.5rem;
        }

        .tt-readiness-score {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          text-align: center;
        }

        .tt-readiness-label {
          font-size: 0.8rem;
          color: var(--color-text-muted, #666);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .tt-readiness-value {
          font-size: 2.5rem;
          font-weight: 900;
          margin: 0;
          color: var(--score-color);
        }

        .tt-readiness-arrow {
          font-size: 1.5rem;
          color: ${CHAPTER_COLORS.implement};
        }

        .tt-readiness-improvement {
          font-size: 1.1rem;
          font-weight: 700;
          color: ${CHAPTER_COLORS.implement};
          text-align: center;
        }

        .tt-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
        }

        .tt-metric-card {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.5rem;
          background: var(--color-bg, #fff);
          border: 2px solid var(--color-border, #e5e7eb);
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .tt-metric-card:hover {
          border-color: var(--metric-color);
          box-shadow: 0 4px 12px var(--metric-color)15;
          transform: translateY(-2px);
        }

        .tt-metric-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .tt-metric-icon {
          font-size: 1.75rem;
          flex-shrink: 0;
        }

        .tt-metric-label {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0;
          flex: 1;
        }

        .tt-metric-direction {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .tt-metric-comparison {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .tt-metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--color-bg-secondary, #f9fafb);
          border-radius: 6px;
        }

        .tt-metric-row.before {
          border-left: 3px solid #94a3b8;
        }

        .tt-metric-row.after {
          border-left: 3px solid var(--metric-color);
        }

        .tt-metric-row.projected {
          border-left: 3px solid #8b5cf6;
        }

        .tt-metric-row-label {
          font-size: 0.8rem;
          color: var(--color-text-muted, #666);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
          min-width: 60px;
        }

        .tt-metric-row-value {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0;
          text-align: right;
          flex: 1;
        }

        .tt-metric-improvement {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          background: var(--metric-color)20;
          color: var(--metric-color);
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 700;
          width: fit-content;
          margin-top: 0.5rem;
        }

        .tt-metric-improvement.positive {
          color: ${CHAPTER_COLORS.implement};
          background: ${CHAPTER_COLORS.implement}20;
        }

        .tt-metric-improvement.negative {
          color: ${CHAPTER_COLORS.improve};
          background: ${CHAPTER_COLORS.improve}20;
        }

        .tt-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border, #e5e7eb);
          margin-top: 1.5rem;
        }

        .tt-action-button {
          padding: 0.75rem 1.5rem;
          border: 2px solid var(--button-color);
          background: transparent;
          color: var(--button-color);
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tt-action-button:hover {
          background: var(--button-color);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--button-color)30;
        }

        .tt-action-button.primary {
          --button-color: ${CHAPTER_COLORS.define};
        }

        .tt-action-button.secondary {
          --button-color: ${CHAPTER_COLORS.finish};
        }

        @media (prefers-reduced-motion: reduce) {
          .tt-metric-card,
          .tt-action-button {
            transition: none;
            transform: none;
          }
        }

        @media (max-width: 768px) {
          .tt-container {
            padding: 1.5rem;
            gap: 1.5rem;
          }

          .tt-title {
            font-size: 1.5rem;
          }

          .tt-metrics-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .tt-metric-card {
            padding: 1rem;
            gap: 1rem;
          }

          .tt-readiness-scores {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .tt-journey-info {
            gap: 1rem;
          }

          .tt-actions {
            gap: 0.75rem;
          }

          .tt-action-button {
            flex: 1;
            justify-content: center;
            padding: 0.6rem 1rem;
          }
        }

        @media (max-width: 480px) {
          .tt-container {
            padding: 1rem;
            gap: 1rem;
          }

          .tt-title {
            font-size: 1.25rem;
          }

          .tt-title-icon {
            font-size: 1.5rem;
          }

          .tt-metric-card {
            padding: 0.75rem;
            gap: 0.75rem;
          }

          .tt-metric-row {
            flex-direction: column;
            align-items: flex-start;
            padding: 0.5rem;
            gap: 0.5rem;
          }

          .tt-metric-row-value {
            width: 100%;
            text-align: left;
          }

          .tt-actions {
            flex-direction: column;
            gap: 0.5rem;
          }

          .tt-action-button {
            width: 100%;
            padding: 0.5rem;
            font-size: 0.85rem;
          }
        }
      `}</style>

      <div className="tt-container">
        <div className="tt-header">
          <h1 className="tt-title">
            <span className="tt-title-icon">🚀</span>
            Your Transformation
          </h1>
          <p className="tt-subtitle">See how far you've come on your journey</p>
        </div>

        {/* Journey info */}
        {journeyStartDate && (
          <div className="tt-journey-info">
            <div className="tt-journey-stat">
              <p className="tt-journey-stat-value">{journeyDuration}</p>
              <p className="tt-journey-stat-label">Time in Programme</p>
            </div>
            <div className="tt-journey-stat">
              <p className="tt-journey-stat-value">
                {new Date(journeyStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <p className="tt-journey-stat-label">Journey Started</p>
            </div>
          </div>
        )}

        {/* Readiness score comparison */}
        {readinessScoreStart !== undefined && readinessScoreCurrent !== undefined && (
          <div className="tt-readiness-section">
            <h2 className="tt-readiness-title">📊 Readiness Score Evolution</h2>
            <div className="tt-readiness-scores">
              <div className="tt-readiness-score">
                <p className="tt-readiness-label">Day 1</p>
                <p className="tt-readiness-value" style={{ "--score-color": CHAPTER_COLORS.start } as any}>
                  {readinessScoreStart}
                </p>
              </div>

              <div className="tt-readiness-score">
                <p className="tt-readiness-label" style={{ marginBottom: "1rem" }} />
                <p className="tt-readiness-arrow">→</p>
              </div>

              <div className="tt-readiness-score">
                <p className="tt-readiness-label">Today</p>
                <p className="tt-readiness-value" style={{ "--score-color": CHAPTER_COLORS.implement } as any}>
                  {readinessScoreCurrent}
                </p>
              </div>
            </div>

            {readinessImprovement !== null && (
              <div className="tt-readiness-improvement">
                {readinessImprovement > 0 ? "+" : ""}
                {readinessImprovement} points improvement
              </div>
            )}
          </div>
        )}

        {/* Metrics comparison grid */}
        <div className="tt-metrics-grid">
          {comparisons.map((comp) => (
            <div
              key={comp.metric.id}
              className="tt-metric-card"
              style={
                {
                  "--metric-color": comp.direction === "up" ? CHAPTER_COLORS.implement : comp.direction === "down" ? CHAPTER_COLORS.improve : "#94a3b8",
                } as any
              }
            >
              <div className="tt-metric-header">
                <span className="tt-metric-icon">{comp.metric.icon}</span>
                <h3 className="tt-metric-label">{comp.metric.label}</h3>
                {comp.direction !== "neutral" && (
                  <span className="tt-metric-direction">
                    {comp.direction === "up" ? "📈" : "📉"}
                  </span>
                )}
              </div>

              <div className="tt-metric-comparison">
                <div className="tt-metric-row before">
                  <p className="tt-metric-row-label">Before</p>
                  <p className="tt-metric-row-value">{comp.formattedStart}</p>
                </div>

                <div className="tt-metric-row after">
                  <p className="tt-metric-row-label">After</p>
                  <p className="tt-metric-row-value">{comp.formattedCurrent}</p>
                </div>

                {comp.formattedProjected && (
                  <div className="tt-metric-row projected">
                    <p className="tt-metric-row-label">3-mo. Proj.</p>
                    <p className="tt-metric-row-value">{comp.formattedProjected}</p>
                  </div>
                )}

                {comp.improvement !== null && (
                  <div
                    className={`tt-metric-improvement ${comp.direction === "up" ? "positive" : comp.direction === "down" ? "negative" : ""}`}
                  >
                    <span>{comp.direction === "up" ? "✓ " : comp.direction === "down" ? "⚠ " : "→ "}</span>
                    <span>
                      {comp.direction === "up" ? "+" : ""}
                      {comp.improvement.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="tt-actions">
          <button
            className="tt-action-button primary"
            onClick={() => onExport?.()}
            title="Download your transformation report"
          >
            📥 Download Report
          </button>
          <button
            className="tt-action-button secondary"
            onClick={() => onShare?.()}
            title="Share your progress"
          >
            🔗 Share Progress
          </button>
        </div>
      </div>
    </div>
  );
});

TransformationTracker.displayName = "TransformationTracker";
