"use client";

/**
 * CohortProgressVisualization — Visual dashboard of cohort learner progress.
 *
 * Displays:
 * - Each learner as a card with progress indicator
 * - 4-chapter progression per learner
 * - Status badges: on-track (green), at-risk (red), completed (cyan)
 * - Heatmap showing cohort distribution
 * - Overview stats: on-time %, completion %, at-risk count
 * - Quick action buttons
 */

import { useMemo, useState } from "react";
import type { CohortLearnerStatus } from "../../lib/coaching/workflow-visualization";
import {
  calculateDaysInChapter,
} from "../../lib/coaching/workflow-visualization";
import { Badge } from "../ui/Card";
import { Button } from "../ui/Button";

export interface CohortProgressVisualizationProps {
  cohortId: string;
  coachName: string;
  learnerStatuses: CohortLearnerStatus[];
  onTrackCount: number;
  atRiskCount: number;
  completedCount: number;
  averageChapterCompletion: number;
  onTimeCompletionRate: number;
  onContactAtRisk?: (learnerId: string) => void;
  onViewDetails?: (learnerId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  completed: "Completed",
  inactive: "Inactive",
};

/**
 * Chapter progress bar for a learner
 */
function ChapterProgressBar({
  completedChapters,
  currentChapter,
}: {
  completedChapters: number;
  currentChapter: number;
}) {
  const chapters = [1, 2, 3, 4];

  return (
    <div className="chapter-progress-bar">
      {chapters.map((ch) => {
        let status: "completed" | "current" | "pending" = "pending";
        if (ch < currentChapter) status = "completed";
        else if (ch === currentChapter) status = "current";

        return (
          <div
            key={ch}
            className={`chapter-dot chapter-${status}`}
            title={`Chapter ${ch}: ${status}`}
          >
            {ch}
          </div>
        );
      })}
      <span className="chapter-label">
        {completedChapters}/4
      </span>
    </div>
  );
}

/**
 * Learner card component
 */
function LearnerCard({
  learner,
  onContact,
  onViewDetails,
}: {
  learner: CohortLearnerStatus;
  onContact?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}) {
  const daysInChapter = calculateDaysInChapter(
    learner.lastActivityDate || new Date()
  );

  return (
    <div className="learner-card ds-scope">
      <div className="learner-card-header">
        <div>
          <h4 className="learner-name">{learner.learnerName}</h4>
          <p className="learner-email">{learner.email}</p>
        </div>
        <Badge
          tone={
            learner.status === "on-track"
              ? "success"
              : learner.status === "at-risk"
                ? "danger"
                : learner.status === "completed"
                  ? "info"
                  : "neutral"
          }
        >
          {STATUS_LABELS[learner.status]}
        </Badge>
      </div>

      {/* Chapter progress */}
      <div className="learner-progress">
        <ChapterProgressBar
          completedChapters={learner.completedChapters}
          currentChapter={learner.currentChapter}
        />
      </div>

      {/* Activity info */}
      <div className="learner-info">
        <div className="info-item">
          <span className="info-label">Current Chapter</span>
          <span className="info-value">{learner.currentChapter}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Days in Chapter</span>
          <span className="info-value">{learner.daysInCurrentChapter}</span>
        </div>
        {learner.pendingReviewSubmissions > 0 && (
          <div className="info-item pending">
            <span className="info-label">Pending Reviews</span>
            <span className="info-value">{learner.pendingReviewSubmissions}</span>
          </div>
        )}
      </div>

      {/* Risk indicator */}
      {learner.isAtRisk && (
        <div className="risk-alert">
          <span className="risk-icon">⚠</span>
          <p>
            {daysInChapter > 21
              ? "Stuck on this chapter for too long"
              : "No activity for over 2 weeks"}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="learner-actions">
        {learner.isAtRisk && onContact && (
          <Button
            onClick={() => onContact(learner.learnerId)}
            className="action-button contact"
          >
            Contact
          </Button>
        )}
        {onViewDetails && (
          <Button
            onClick={() => onViewDetails(learner.learnerId)}
            className="action-button details"
          >
            View Details
          </Button>
        )}
      </div>

      <style jsx>{`
        .learner-card {
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
          transition: all 160ms var(--ds-ease);
        }

        .learner-card:hover {
          border-color: var(--ds-border-strong);
          box-shadow: var(--ds-shadow-sm);
        }

        .learner-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-3);
        }

        .learner-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .learner-email {
          margin: var(--ds-space-1) 0 0 0;
          font-size: 12px;
          color: var(--ds-text-tertiary);
        }

        .learner-progress {
          margin-top: var(--ds-space-2);
        }

        .chapter-progress-bar {
          display: flex;
          align-items: center;
          gap: var(--ds-space-2);
        }

        .chapter-dot {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 600;
          color: white;
          transition: all 160ms var(--ds-ease);
        }

        .chapter-completed {
          background: var(--ds-success);
        }

        .chapter-current {
          background: var(--ds-info);
          box-shadow: 0 0 0 2px var(--ds-info-soft);
          animation: chapter-pulse 2s ease-in-out infinite;
        }

        .chapter-pending {
          background: var(--ds-text-disabled);
        }

        @keyframes chapter-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .chapter-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--ds-text-tertiary);
          margin-left: auto;
        }

        .learner-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: var(--ds-space-2);
          padding: var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-1);
        }

        .info-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--ds-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .info-item.pending .info-value {
          color: var(--ds-warning);
        }

        .risk-alert {
          padding: var(--ds-space-3);
          background: var(--ds-danger-soft);
          border-left: 3px solid var(--ds-danger);
          border-radius: var(--ds-radius-md);
          display: flex;
          gap: var(--ds-space-2);
        }

        .risk-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .risk-alert p {
          margin: 0;
          font-size: 13px;
          color: var(--ds-danger);
          line-height: 1.4;
        }

        .learner-actions {
          display: flex;
          gap: var(--ds-space-2);
          padding-top: var(--ds-space-3);
          border-top: 1px solid var(--ds-border-subtle);
        }

        .action-button {
          flex: 1;
          font-size: 12px;
        }

        .action-button.contact {
          background: var(--ds-danger);
          color: white;
        }

        .action-button.details {
          background: var(--ds-info);
          color: white;
        }
      `}</style>
    </div>
  );
}

/**
 * Main component: Cohort Progress Visualization
 */
export function CohortProgressVisualization({
  cohortId,
  coachName,
  learnerStatuses,
  onTrackCount,
  atRiskCount,
  completedCount,
  averageChapterCompletion,
  onTimeCompletionRate,
  onContactAtRisk,
  onViewDetails,
}: CohortProgressVisualizationProps) {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const totalLearners = learnerStatuses.length;

  const filteredLearners = useMemo(
    () =>
      filterStatus
        ? learnerStatuses.filter((l) => l.status === filterStatus)
        : learnerStatuses,
    [learnerStatuses, filterStatus]
  );

  return (
    <div className="cohort-progress-visualization ds-scope">
      {/* Header */}
      <div className="cohort-header">
        <div>
          <h2 className="cohort-title">Cohort Progress Dashboard</h2>
          <p className="cohort-coach">Coach: {coachName}</p>
        </div>
        <div className="cohort-id-badge">ID: {cohortId}</div>
      </div>

      {/* Overview stats */}
      <div className="cohort-stats">
        <div className="stat-card">
          <div className="stat-value">{totalLearners}</div>
          <div className="stat-label">Total Learners</div>
        </div>

        <div className="stat-card on-track">
          <div className="stat-value">{onTrackCount}</div>
          <div className="stat-label">On Track</div>
          <div className="stat-percentage">
            {totalLearners > 0
              ? ((onTrackCount / totalLearners) * 100).toFixed(0)
              : "0"}
            %
          </div>
        </div>

        <div className="stat-card at-risk">
          <div className="stat-value">{atRiskCount}</div>
          <div className="stat-label">At Risk</div>
          <div className="stat-percentage">
            {totalLearners > 0
              ? ((atRiskCount / totalLearners) * 100).toFixed(0)
              : "0"}
            %
          </div>
        </div>

        <div className="stat-card completed">
          <div className="stat-value">{completedCount}</div>
          <div className="stat-label">Completed</div>
          <div className="stat-percentage">
            {totalLearners > 0
              ? ((completedCount / totalLearners) * 100).toFixed(0)
              : "0"}
            %
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {averageChapterCompletion.toFixed(1)}
          </div>
          <div className="stat-label">Avg Chapters</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{onTimeCompletionRate.toFixed(0)}%</div>
          <div className="stat-label">On-Time Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="cohort-filters">
        <button
          className={`filter-button ${filterStatus === null ? "active" : ""}`}
          onClick={() => setFilterStatus(null)}
        >
          All Learners ({totalLearners})
        </button>
        <button
          className={`filter-button on-track ${
            filterStatus === "on-track" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("on-track")}
        >
          On Track ({onTrackCount})
        </button>
        <button
          className={`filter-button at-risk ${
            filterStatus === "at-risk" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("at-risk")}
        >
          At Risk ({atRiskCount})
        </button>
        <button
          className={`filter-button completed ${
            filterStatus === "completed" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("completed")}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Learner cards grid */}
      <div className="learner-cards-grid">
        {filteredLearners.length === 0 ? (
          <div className="empty-state">
            <p>No learners in this category</p>
          </div>
        ) : (
          filteredLearners.map((learner) => (
            <LearnerCard
              key={learner.learnerId}
              learner={learner}
              onContact={onContactAtRisk}
              onViewDetails={onViewDetails}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .cohort-progress-visualization {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-5);
          padding: var(--ds-space-6);
          background: var(--ds-bg-app);
        }

        .cohort-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-4);
        }

        .cohort-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .cohort-coach {
          margin: var(--ds-space-2) 0 0 0;
          font-size: 14px;
          color: var(--ds-text-secondary);
        }

        .cohort-id-badge {
          padding: var(--ds-space-2) var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-md);
          font-size: 12px;
          color: var(--ds-text-tertiary);
          font-weight: 500;
        }

        .cohort-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--ds-space-4);
        }

        .stat-card {
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
          text-align: center;
          transition: all 160ms var(--ds-ease);
        }

        .stat-card:hover {
          border-color: var(--ds-border-strong);
          box-shadow: var(--ds-shadow-sm);
        }

        .stat-card.on-track {
          border-left: 3px solid var(--ds-success);
        }

        .stat-card.at-risk {
          border-left: 3px solid var(--ds-danger);
        }

        .stat-card.completed {
          border-left: 3px solid var(--ds-info);
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--ds-text-primary);
        }

        .stat-label {
          font-size: 12px;
          color: var(--ds-text-secondary);
          font-weight: 500;
        }

        .stat-percentage {
          font-size: 13px;
          color: var(--ds-text-tertiary);
        }

        .cohort-filters {
          display: flex;
          gap: var(--ds-space-3);
          flex-wrap: wrap;
        }

        .filter-button {
          padding: var(--ds-space-2) var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-md);
          font-size: 13px;
          font-weight: 500;
          color: var(--ds-text-secondary);
          cursor: pointer;
          transition: all 160ms var(--ds-ease);
        }

        .filter-button:hover {
          border-color: var(--ds-border-strong);
          background: var(--ds-bg-subtle);
        }

        .filter-button.active {
          background: var(--ds-info);
          color: white;
          border-color: var(--ds-info);
        }

        .filter-button.on-track.active {
          background: var(--ds-success);
          border-color: var(--ds-success);
        }

        .filter-button.at-risk.active {
          background: var(--ds-danger);
          border-color: var(--ds-danger);
        }

        .filter-button.completed.active {
          background: var(--ds-info);
          border-color: var(--ds-info);
        }

        .learner-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--ds-space-4);
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: var(--ds-space-8);
          text-align: center;
          color: var(--ds-text-tertiary);
        }

        @media (max-width: 768px) {
          .cohort-progress-visualization {
            padding: var(--ds-space-4);
          }

          .cohort-stats {
            grid-template-columns: 1fr;
          }

          .learner-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
