"use client";

/**
 * ApprovalWorkflowDiagram — Visual timeline showing submission → review → approval/rejection cycle.
 *
 * Displays:
 * - Stage indicators: Submitted → Under Review → Approved/Rejected → Complete
 * - Color-coded stages (blue, amber, green, red)
 * - Timeline with dates/timestamps
 * - Coach feedback in context
 * - Animated state transitions
 */

import { useMemo } from "react";
import type { ApprovalStage } from "../../lib/coaching/workflow-visualization";
import {
  APPROVAL_STAGE_COLORS,
  formatWorkflowDate,
  formatRelativeTime,
} from "../../lib/coaching/workflow-visualization";

interface WorkflowEvent {
  id: string;
  stage: ApprovalStage;
  timestamp: Date;
  feedback?: string;
  reviewer?: string;
}

export interface ApprovalWorkflowDiagramProps {
  submissionId: string;
  learnerName: string;
  chapter: number;
  events: WorkflowEvent[];
  currentStage: ApprovalStage;
  isReviewable: boolean;
}

const STAGE_LABELS: Record<ApprovalStage, string> = {
  submitted: "Submitted",
  reviewing: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  resubmitted: "Resubmitted",
};

const STAGE_DESCRIPTIONS: Record<ApprovalStage, string> = {
  submitted: "Awaiting coach review",
  reviewing: "Coach is reviewing",
  approved: "Coach approved progress",
  rejected: "Needs revision",
  resubmitted: "Resubmitted for review",
};

/**
 * SVG Timeline visualization of approval workflow.
 */
function TimelineVisualization({ events, currentStage }: { events: WorkflowEvent[]; currentStage: ApprovalStage }) {
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()), [events]);

  if (sortedEvents.length === 0) {
    return (
      <div className="approval-timeline-empty">
        <p>No events yet</p>
      </div>
    );
  }

  const svgHeight = Math.max(200, sortedEvents.length * 80 + 40);

  return (
    <svg
      viewBox={`0 0 600 ${svgHeight}`}
      className="approval-timeline-svg"
      role="img"
      aria-label="Approval workflow timeline"
    >
      {/* Vertical line connecting all events */}
      <line
        x1="60"
        y1="30"
        x2="60"
        y2={svgHeight - 30}
        stroke="var(--ds-border-default)"
        strokeWidth="2"
      />

      {/* Events */}
      {sortedEvents.map((event, idx) => {
        const y = 40 + idx * (svgHeight / (sortedEvents.length + 1));
        const color = APPROVAL_STAGE_COLORS[event.stage];
        const isCurrent = event.stage === currentStage;

        return (
          <g key={event.id}>
            {/* Connecting dot */}
            <circle
              cx="60"
              cy={y}
              r={isCurrent ? "10" : "6"}
              fill={color}
              className={isCurrent ? "approval-event-dot--active" : ""}
            />

            {/* Event content box */}
            <rect
              x="100"
              y={y - 30}
              width="480"
              height="60"
              rx="6"
              fill="var(--ds-surface)"
              stroke={color}
              strokeWidth="1"
            />

            {/* Stage label */}
            <text
              x="110"
              y={y - 10}
              className="approval-event-label"
              fill={color}
              fontSize="14"
              fontWeight="600"
            >
              {STAGE_LABELS[event.stage]}
            </text>

            {/* Timestamp */}
            <text
              x="110"
              y={y + 10}
              className="approval-event-time"
              fill="var(--ds-text-secondary)"
              fontSize="12"
            >
              {formatWorkflowDate(event.timestamp)} at{" "}
              {event.timestamp.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>

            {/* Reviewer info */}
            {event.reviewer && (
              <text
                x="110"
                y={y + 25}
                className="approval-event-reviewer"
                fill="var(--ds-text-tertiary)"
                fontSize="11"
              >
                by {event.reviewer}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Main component: Approval Workflow Diagram
 */
export function ApprovalWorkflowDiagram({
  submissionId,
  learnerName,
  chapter,
  events,
  currentStage,
  isReviewable,
}: ApprovalWorkflowDiagramProps) {
  const latestEvent = useMemo(
    () => [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0],
    [events]
  );

  return (
    <div className="approval-workflow-diagram ds-scope">
      {/* Header */}
      <div className="approval-workflow-header">
        <div>
          <h3 className="approval-workflow-title">
            Chapter {chapter} — {learnerName}
          </h3>
          <p className="approval-workflow-subtitle">Submission ID: {submissionId}</p>
        </div>
        <div className="approval-workflow-status">
          <span
            className="approval-status-badge"
            style={{
              backgroundColor: APPROVAL_STAGE_COLORS[currentStage],
              color: "white",
            }}
          >
            {STAGE_LABELS[currentStage]}
          </span>
          {latestEvent && (
            <span className="approval-status-time">
              {formatRelativeTime(latestEvent.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Current stage description */}
      <div className="approval-stage-description">
        <p>{STAGE_DESCRIPTIONS[currentStage]}</p>
        {!isReviewable && (
          <p className="approval-stage-note">
            This submission has already been reviewed. To submit again, a new submission must be created.
          </p>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="approval-timeline-container">
        <TimelineVisualization events={events} currentStage={currentStage} />
      </div>

      {/* Feedback section */}
      {latestEvent?.feedback && (
        <div className="approval-feedback-section">
          <h4 className="approval-feedback-title">Latest Feedback</h4>
          <div className="approval-feedback-box">
            <p>{latestEvent.feedback}</p>
            {latestEvent.reviewer && (
              <p className="approval-feedback-from">
                — {latestEvent.reviewer}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Event details */}
      <div className="approval-events-list">
        <h4 className="approval-events-title">Event History</h4>
        {events.length === 0 ? (
          <p className="approval-events-empty">No events recorded yet.</p>
        ) : (
          <ul className="approval-events-items">
            {[...events]
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map((event) => (
                <li key={event.id} className="approval-event-item">
                  <span
                    className="approval-event-color"
                    style={{ backgroundColor: APPROVAL_STAGE_COLORS[event.stage] }}
                  />
                  <div className="approval-event-details">
                    <strong>{STAGE_LABELS[event.stage]}</strong>
                    <span className="approval-event-when">
                      {formatWorkflowDate(event.timestamp)}
                    </span>
                    {event.reviewer && (
                      <span className="approval-event-by">by {event.reviewer}</span>
                    )}
                    {event.feedback && (
                      <p className="approval-event-feedback">{event.feedback}</p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .approval-workflow-diagram {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-5);
          padding: var(--ds-space-6);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
        }

        .approval-workflow-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-4);
        }

        .approval-workflow-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .approval-workflow-subtitle {
          margin: var(--ds-space-2) 0 0 0;
          font-size: 13px;
          color: var(--ds-text-tertiary);
        }

        .approval-workflow-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--ds-space-2);
        }

        .approval-status-badge {
          padding: var(--ds-space-2) var(--ds-space-4);
          border-radius: var(--ds-radius-md);
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
        }

        .approval-status-time {
          font-size: 12px;
          color: var(--ds-text-tertiary);
        }

        .approval-stage-description {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          border-left: 3px solid var(--ds-brand);
        }

        .approval-stage-description p {
          margin: 0;
          font-size: 14px;
          color: var(--ds-text-secondary);
        }

        .approval-stage-description p + p {
          margin-top: var(--ds-space-2);
          font-size: 12px;
          color: var(--ds-warning);
          font-weight: 500;
        }

        .approval-stage-note {
          margin-top: var(--ds-space-2) !important;
          color: var(--ds-warning) !important;
        }

        .approval-timeline-container {
          overflow-x: auto;
          margin: var(--ds-space-4) 0;
        }

        .approval-timeline-svg {
          width: 100%;
          height: auto;
          min-height: 200px;
        }

        .approval-event-dot--active {
          animation: approval-pulse 2s ease-in-out infinite;
        }

        @keyframes approval-pulse {
          0%,
          100% {
            opacity: 1;
            r: 10;
          }
          50% {
            opacity: 0.7;
            r: 14;
          }
        }

        .approval-event-label {
          font-family: var(--ds-font);
        }

        .approval-event-time {
          font-family: var(--ds-font);
        }

        .approval-event-reviewer {
          font-family: var(--ds-font);
        }

        .approval-timeline-empty {
          padding: var(--ds-space-6);
          text-align: center;
          color: var(--ds-text-tertiary);
          font-size: 14px;
        }

        .approval-feedback-section {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
        }

        .approval-feedback-title {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .approval-feedback-box {
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border-left: 3px solid var(--ds-info);
          border-radius: var(--ds-radius-md);
          font-size: 14px;
          line-height: 1.5;
        }

        .approval-feedback-box p {
          margin: 0;
        }

        .approval-feedback-box p + p {
          margin-top: var(--ds-space-2);
        }

        .approval-feedback-from {
          font-style: italic;
          color: var(--ds-text-secondary);
          font-size: 13px;
        }

        .approval-events-list {
          margin-top: var(--ds-space-4);
        }

        .approval-events-title {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .approval-events-empty {
          padding: var(--ds-space-4);
          color: var(--ds-text-tertiary);
          font-size: 13px;
          text-align: center;
        }

        .approval-events-items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .approval-event-item {
          display: flex;
          gap: var(--ds-space-4);
          padding: var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          font-size: 13px;
        }

        .approval-event-color {
          display: inline-block;
          width: 3px;
          height: 100%;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .approval-event-details {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-1);
          width: 100%;
        }

        .approval-event-details strong {
          color: var(--ds-text-primary);
          font-size: 14px;
        }

        .approval-event-when {
          color: var(--ds-text-tertiary);
          font-size: 12px;
        }

        .approval-event-by {
          color: var(--ds-text-secondary);
          font-size: 12px;
        }

        .approval-event-feedback {
          margin-top: var(--ds-space-2);
          padding-top: var(--ds-space-2);
          border-top: 1px solid var(--ds-border-subtle);
          color: var(--ds-text-secondary);
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .approval-workflow-header {
            flex-direction: column;
          }

          .approval-workflow-status {
            align-items: flex-start;
          }

          .approval-timeline-svg {
            min-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}
