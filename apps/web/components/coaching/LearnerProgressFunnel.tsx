"use client";

/**
 * LearnerProgressFunnel — Visualizes how many learners are at each stage.
 *
 * Displays:
 * - Funnel showing learner counts at each stage
 * - Drop-off visualization (where learners are stuck)
 * - Conversion rates between stages
 * - Color gradient: red (bottleneck), amber (caution), green (healthy)
 * - Interactive: click stage to see learner list
 * - Coach-specific view showing their cohort distribution
 */

import { useMemo, useState } from "react";
import type { ProgressStageCounts } from "../../lib/coaching/workflow-visualization";
import {
  calculateConversionRates,
  identifyDropoffStage,
  PROGRESS_STAGE_COLORS,
} from "../../lib/coaching/workflow-visualization";

export interface LearnerProgressFunnelProps {
  stageCounts: ProgressStageCounts;
  onStageClick?: (stage: string) => void;
  cohortName?: string;
}

type FunnelStage = keyof ProgressStageCounts;

const STAGE_LABELS: Record<FunnelStage, string> = {
  started: "Started",
  "in-progress": "In Progress",
  completed: "Completed",
  "awaiting-review": "Awaiting Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STAGE_DESCRIPTIONS: Record<FunnelStage, string> = {
  started: "Enrolled but not yet started",
  "in-progress": "Currently working on lessons",
  completed: "All lessons completed",
  "awaiting-review": "Submitted for coach review",
  approved: "Coach approved and moved on",
  rejected: "Needs revision and resubmission",
};

/**
 * SVG Funnel visualization
 */
function FunnelVisualization({
  stageCounts,
  conversionRates,
  dropoffStage,
  onStageClick,
}: {
  stageCounts: ProgressStageCounts;
  conversionRates: Record<string, number>;
  dropoffStage: string | null;
  onStageClick?: (stage: string) => void;
}) {
  const stages: FunnelStage[] = [
    "started",
    "in-progress",
    "completed",
    "awaiting-review",
    "approved",
  ];

  const totalLearners = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const maxWidth = 400;
  const stagePadding = 12;

  return (
    <svg
      viewBox="0 0 600 500"
      className="funnel-svg"
      role="img"
      aria-label="Learner progress funnel"
    >
      {stages.map((stage, idx) => {
        const count = stageCounts[stage];
        const percentage = totalLearners > 0 ? (count / totalLearners) * 100 : 0;
        const width = (percentage / 100) * maxWidth;
        const x = (600 - width) / 2;
        const y = 40 + idx * 80;
        const color = PROGRESS_STAGE_COLORS[stage];
        const isBottleneck = stage === dropoffStage;

        // Calculate conversion rate to next stage
        const conversionKey = `${stage}To${stages[idx + 1]?.charAt(0).toUpperCase()}${stages[idx + 1]?.slice(1).replace("-", "")}`;
        const conversionRate = conversionRates[conversionKey] || 0;

        return (
          <g key={stage} onClick={() => onStageClick?.(stage)} style={{ cursor: "pointer" }}>
            {/* Funnel segment */}
            <polygon
              points={`${x},${y} ${x + width},${y} ${x + width + stagePadding},${y + 50} ${x - stagePadding},${y + 50}`}
              fill={color}
              fillOpacity={isBottleneck ? 0.8 : 0.6}
              stroke={color}
              strokeWidth="2"
              className="funnel-segment"
            />

            {/* Hover overlay */}
            <polygon
              points={`${x},${y} ${x + width},${y} ${x + width + stagePadding},${y + 50} ${x - stagePadding},${y + 50}`}
              fill="white"
              fillOpacity="0"
              className="funnel-segment-hover"
            />

            {/* Stage label and count */}
            <text
              x={300}
              y={y + 22}
              textAnchor="middle"
              className="funnel-label"
              fill="white"
              fontSize="14"
              fontWeight="600"
            >
              {STAGE_LABELS[stage]}
            </text>

            <text
              x={300}
              y={y + 40}
              textAnchor="middle"
              className="funnel-count"
              fill="white"
              fontSize="18"
              fontWeight="700"
            >
              {count}
            </text>

            <text
              x={300}
              y={y + 55}
              textAnchor="middle"
              className="funnel-percentage"
              fill="rgba(255, 255, 255, 0.8)"
              fontSize="12"
            >
              {percentage.toFixed(1)}%
            </text>

            {/* Bottleneck indicator */}
            {isBottleneck && (
              <>
                <circle
                  cx={x - 20}
                  cy={y + 25}
                  r="8"
                  fill="var(--ds-danger)"
                  className="bottleneck-indicator"
                />
                <text
                  x={x - 20}
                  y={y + 25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="700"
                  className="bottleneck-icon"
                >
                  !
                </text>
              </>
            )}

            {/* Conversion rate (to next stage) */}
            {idx < stages.length - 1 && (
              <text
                x={300}
                y={y + 70}
                textAnchor="middle"
                className="conversion-rate"
                fill="var(--ds-text-secondary)"
                fontSize="11"
              >
                ↓ {conversionRate.toFixed(0)}% conversion
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <text x="20" y="470" fontSize="12" fill="var(--ds-text-tertiary)">
        Click any segment to view learners in that stage
      </text>
    </svg>
  );
}

/**
 * Main component: Learner Progress Funnel
 */
export function LearnerProgressFunnel({
  stageCounts,
  onStageClick,
  cohortName,
}: LearnerProgressFunnelProps) {
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);

  const totalLearners = useMemo(
    () => Object.values(stageCounts).reduce((a, b) => a + b, 0),
    [stageCounts]
  );

  const conversionRates = useMemo(
    () => calculateConversionRates(stageCounts),
    [stageCounts]
  );

  const dropoffStage = useMemo(
    () => identifyDropoffStage(stageCounts),
    [stageCounts]
  );

  const handleStageClick = (stage: string) => {
    setSelectedStage(stage as FunnelStage);
    onStageClick?.(stage);
  };

  const handleRejectClick = () => {
    setSelectedStage("rejected");
    onStageClick?.("rejected");
  };

  return (
    <div className="learner-progress-funnel ds-scope">
      {/* Header */}
      <div className="funnel-header">
        <div>
          <h3 className="funnel-title">
            Learner Progress Funnel
            {cohortName && ` — ${cohortName}`}
          </h3>
          <p className="funnel-subtitle">
            Total learners: <strong>{totalLearners}</strong>
          </p>
        </div>
        {dropoffStage && (
          <div className="funnel-bottleneck-alert">
            <strong>Bottleneck:</strong> {STAGE_LABELS[dropoffStage]}
            <br />
            {stageCounts[dropoffStage]} learners stuck
          </div>
        )}
      </div>

      {/* Funnel visualization */}
      <div className="funnel-visualization-container">
        <FunnelVisualization
          stageCounts={stageCounts}
          conversionRates={{ ...conversionRates }}
          dropoffStage={dropoffStage}
          onStageClick={handleStageClick}
        />
      </div>

      {/* Rejected learners card */}
      {stageCounts.rejected > 0 && (
        <div
          className="rejected-learners-card"
          onClick={handleRejectClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleRejectClick();
          }}
        >
          <div className="rejected-icon">
            <span className="rejected-badge">{stageCounts.rejected}</span>
          </div>
          <div className="rejected-content">
            <h4>Learners Needing Revision</h4>
            <p>{stageCounts.rejected} submission(s) rejected and waiting for resubmission</p>
          </div>
          <div className="rejected-arrow">→</div>
        </div>
      )}

      {/* Stage details */}
      {selectedStage && (
        <div className="funnel-stage-details">
          <h4 className="stage-details-title">{STAGE_LABELS[selectedStage]}</h4>
          <p className="stage-details-description">
            {STAGE_DESCRIPTIONS[selectedStage]}
          </p>
          <div className="stage-details-stats">
            <div className="stat">
              <span className="stat-label">Learners</span>
              <span className="stat-value">{stageCounts[selectedStage]}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Percentage</span>
              <span className="stat-value">
                {totalLearners > 0
                  ? ((stageCounts[selectedStage] / totalLearners) * 100).toFixed(1)
                  : "0"}
                %
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Conversion metrics */}
      <div className="funnel-metrics">
        <h4 className="metrics-title">Conversion Rates</h4>
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Started → In Progress</span>
            <span className="metric-value">
              {conversionRates.startedToInProgress.toFixed(0)}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">In Progress → Completed</span>
            <span className="metric-value">
              {conversionRates.inProgressToCompleted.toFixed(0)}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Completed → Awaiting Review</span>
            <span className="metric-value">
              {conversionRates.completedToAwaitingReview.toFixed(0)}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Awaiting Review → Approved</span>
            <span className="metric-value">
              {conversionRates.awaitingReviewToApproved.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .learner-progress-funnel {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-5);
          padding: var(--ds-space-6);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
        }

        .funnel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-4);
        }

        .funnel-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .funnel-subtitle {
          margin: var(--ds-space-2) 0 0 0;
          font-size: 14px;
          color: var(--ds-text-secondary);
        }

        .funnel-bottleneck-alert {
          padding: var(--ds-space-3) var(--ds-space-4);
          background: var(--ds-danger-soft);
          color: var(--ds-danger);
          border-radius: var(--ds-radius-md);
          font-size: 13px;
          line-height: 1.5;
        }

        .funnel-visualization-container {
          overflow-x: auto;
          margin: var(--ds-space-4) 0;
        }

        .funnel-svg {
          width: 100%;
          height: auto;
          min-height: 400px;
        }

        .funnel-segment {
          transition: fill-opacity 160ms var(--ds-ease);
          cursor: pointer;
        }

        .funnel-segment-hover:hover + .funnel-label,
        .funnel-segment-hover:hover ~ .funnel-count,
        .funnel-segment-hover:hover ~ .funnel-percentage {
          opacity: 0.8;
        }

        .funnel-segment:hover {
          fill-opacity: 0.9;
        }

        .funnel-label,
        .funnel-count,
        .funnel-percentage,
        .conversion-rate {
          font-family: var(--ds-font);
          pointer-events: none;
        }

        .bottleneck-indicator {
          animation: funnel-pulse 2s ease-in-out infinite;
        }

        @keyframes funnel-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .rejected-learners-card {
          display: flex;
          align-items: center;
          gap: var(--ds-space-4);
          padding: var(--ds-space-4);
          background: var(--ds-danger-soft);
          border: 1px solid var(--ds-danger);
          border-radius: var(--ds-radius-md);
          cursor: pointer;
          transition: all 160ms var(--ds-ease);
        }

        .rejected-learners-card:hover {
          background: color-mix(in srgb, var(--ds-danger-soft) 80%, var(--ds-danger) 20%);
        }

        .rejected-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: var(--ds-danger);
          color: white;
          border-radius: var(--ds-radius-md);
          font-weight: 600;
          font-size: 20px;
          flex-shrink: 0;
        }

        .rejected-badge {
          font-size: 20px;
        }

        .rejected-content {
          flex: 1;
        }

        .rejected-content h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .rejected-content p {
          margin: var(--ds-space-1) 0 0 0;
          font-size: 13px;
          color: var(--ds-text-secondary);
        }

        .rejected-arrow {
          font-size: 20px;
          color: var(--ds-text-secondary);
          font-weight: 300;
        }

        .funnel-stage-details {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          border-left: 4px solid var(--ds-info);
        }

        .stage-details-title {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .stage-details-description {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 13px;
          color: var(--ds-text-secondary);
        }

        .stage-details-stats {
          display: flex;
          gap: var(--ds-space-4);
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-1);
        }

        .stat-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--ds-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .funnel-metrics {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
        }

        .metrics-title {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--ds-space-3);
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
          padding: var(--ds-space-3);
          background: var(--ds-surface);
          border-radius: var(--ds-radius-md);
          border: 1px solid var(--ds-border-subtle);
        }

        .metric-label {
          font-size: 12px;
          color: var(--ds-text-tertiary);
          font-weight: 500;
        }

        .metric-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--ds-info);
        }

        @media (max-width: 768px) {
          .learner-progress-funnel {
            padding: var(--ds-space-4);
          }

          .funnel-header {
            flex-direction: column;
          }

          .funnel-svg {
            min-height: 500px;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
