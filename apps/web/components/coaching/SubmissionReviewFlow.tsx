"use client";

/**
 * SubmissionReviewFlow — Visual representation of review workflow.
 *
 * Displays:
 * - Evidence/work sample display area
 * - Coach feedback input → submission
 * - Approval/rejection decision flow
 * - Suggested feedback templates
 * - Integration with existing review interface
 */

import { useState } from "react";
import { Field, Badge } from "../ui/Card";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";

export interface SubmissionReviewFlowProps {
  submissionId: string;
  learnerName: string;
  chapter: number;
  submittedAt: Date;
  evidenceUrl?: string;
  evidencePreview?: string;
  onApprove?: (feedback: string) => Promise<void>;
  onReject?: (feedback: string) => Promise<void>;
  onRequestChanges?: (feedback: string) => Promise<void>;
  isProcessing?: boolean;
}

const FEEDBACK_TEMPLATES = [
  {
    title: "Excellent Work",
    text: "Great job on this submission! Your work demonstrates clear understanding and meets all the requirements. I'm approving this chapter.",
  },
  {
    title: "Good Progress",
    text: "You're on the right track! I'd like to see a bit more detail on [specific area]. Please revise and resubmit.",
  },
  {
    title: "Needs Revision",
    text: "This is a good start, but there are a few areas that need more work before approval. Please address the following feedback.",
  },
  {
    title: "Specific Feedback",
    text: "I noticed [specific observation]. Can you clarify or expand on [particular section]?",
  },
];

/**
 * Template selection component
 */
function FeedbackTemplateSelector({
  onSelect,
}: {
  onSelect: (text: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        className="template-toggle"
        onClick={() => setIsOpen(true)}
        title="Insert feedback template"
      >
        Use template
      </button>
    );
  }

  return (
    <div className="template-selector">
      <div className="template-header">
        <h4>Feedback Templates</h4>
        <button onClick={() => setIsOpen(false)} className="template-close">
          ×
        </button>
      </div>
      <div className="template-list">
        {FEEDBACK_TEMPLATES.map((template, idx) => (
          <button
            key={idx}
            className="template-item"
            onClick={() => {
              onSelect(template.text);
              setIsOpen(false);
            }}
          >
            <strong>{template.title}</strong>
            <p>{template.text.substring(0, 80)}...</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Evidence preview component
 */
function EvidencePreview({
  evidenceUrl,
  evidencePreview,
}: {
  evidenceUrl?: string;
  evidencePreview?: string;
}) {
  if (!evidenceUrl && !evidencePreview) {
    return (
      <div className="evidence-empty">
        <p>No evidence attached</p>
      </div>
    );
  }

  return (
    <div className="evidence-preview">
      {evidencePreview && (
        <div className="evidence-content">
          <p>{evidencePreview}</p>
        </div>
      )}
      {evidenceUrl && (
        <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="evidence-link">
          View Full Submission →
        </a>
      )}
    </div>
  );
}

/**
 * Main component: Submission Review Flow
 */
export function SubmissionReviewFlow({
  learnerName,
  chapter,
  submittedAt,
  evidenceUrl,
  evidencePreview,
  onApprove,
  onReject,
  onRequestChanges,
  isProcessing = false,
}: SubmissionReviewFlowProps) {
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | "changes" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleFeedbackTemplate = (text: string) => {
    setFeedback(text);
  };

  const handleSubmit = async (action: "approve" | "reject" | "changes") => {
    if (!feedback.trim()) {
      setError("Please provide feedback");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setDecision(action);

    try {
      if (action === "approve" && onApprove) {
        await onApprove(feedback);
      } else if (action === "reject" && onReject) {
        await onReject(feedback);
      } else if (action === "changes" && onRequestChanges) {
        await onRequestChanges(feedback);
      }

      setFeedback("");
      setDecision(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="submission-review-flow ds-scope">
      {/* Header */}
      <div className="review-header">
        <div>
          <h3 className="review-title">Review Submission</h3>
          <p className="review-subtitle">
            Chapter {chapter} • {learnerName}
          </p>
          <p className="review-meta">
            Submitted {submittedAt.toLocaleDateString()} at{" "}
            {submittedAt.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge tone="info">Awaiting Review</Badge>
      </div>

      {/* Evidence section */}
      <div className="review-section">
        <h4 className="section-title">Submission Evidence</h4>
        <EvidencePreview evidenceUrl={evidenceUrl} evidencePreview={evidencePreview} />
      </div>

      {/* Review workflow */}
      <div className="review-workflow">
        <div className="workflow-step">
          <div className="workflow-step-number">1</div>
          <div className="workflow-step-content">
            <h4>Read & Review</h4>
            <p>Review the submission above and prepare your feedback</p>
          </div>
        </div>

        <div className="workflow-arrow">↓</div>

        <div className="workflow-step">
          <div className="workflow-step-number">2</div>
          <div className="workflow-step-content">
            <h4>Provide Feedback</h4>
            <p>Give specific, actionable feedback</p>
          </div>
        </div>

        <div className="workflow-arrow">↓</div>

        <div className="workflow-step">
          <div className="workflow-step-number">3</div>
          <div className="workflow-step-content">
            <h4>Make Decision</h4>
            <p>Approve, request changes, or reject</p>
          </div>
        </div>
      </div>

      {/* Feedback input */}
      <div className="review-section">
        <div className="feedback-input-header">
          <h4 className="section-title">Your Feedback</h4>
          <FeedbackTemplateSelector onSelect={handleFeedbackTemplate} />
        </div>

        <Field label="Feedback" htmlFor="feedback-input">
          <textarea
            id="feedback-input"
            className="feedback-textarea"
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setError("");
            }}
            placeholder="Share specific, constructive feedback with the learner..."
            rows={5}
            disabled={isSubmitting || isProcessing}
          />
        </Field>

        {error && <Notice icon="warning" title={error} />}
      </div>

      {/* Decision buttons */}
      <div className="review-decisions">
        <div className="decision-group reject">
          <h4 className="decision-title">Reject Submission</h4>
          <p className="decision-description">
            This doesn't meet the requirements yet
          </p>
          <Button
            onClick={() => handleSubmit("reject")}
            disabled={!feedback.trim() || isSubmitting || isProcessing}
            className="decision-button reject-button"
          >
            {isSubmitting && decision === "reject" ? "Submitting..." : "Reject"}
          </Button>
        </div>

        <div className="decision-group changes">
          <h4 className="decision-title">Request Changes</h4>
          <p className="decision-description">
            Good progress, but needs revision
          </p>
          <Button
            onClick={() => handleSubmit("changes")}
            disabled={!feedback.trim() || isSubmitting || isProcessing}
            className="decision-button changes-button"
          >
            {isSubmitting && decision === "changes"
              ? "Submitting..."
              : "Request Changes"}
          </Button>
        </div>

        <div className="decision-group approve">
          <h4 className="decision-title">Approve Submission</h4>
          <p className="decision-description">
            Meets all requirements
          </p>
          <Button
            onClick={() => handleSubmit("approve")}
            disabled={!feedback.trim() || isSubmitting || isProcessing}
            className="decision-button approve-button"
          >
            {isSubmitting && decision === "approve"
              ? "Approving..."
              : "Approve"}
          </Button>
        </div>
      </div>

      <style jsx>{`
        .submission-review-flow {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-5);
          padding: var(--ds-space-6);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-4);
          padding-bottom: var(--ds-space-4);
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .review-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .review-subtitle {
          margin: var(--ds-space-2) 0 0 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--ds-text-secondary);
        }

        .review-meta {
          margin: var(--ds-space-1) 0 0 0;
          font-size: 13px;
          color: var(--ds-text-tertiary);
        }

        .review-section {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .section-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .evidence-empty,
        .evidence-preview {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          border: 1px dashed var(--ds-border-default);
        }

        .evidence-empty {
          text-align: center;
          color: var(--ds-text-tertiary);
          font-size: 13px;
        }

        .evidence-content {
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border-radius: var(--ds-radius-md);
          font-size: 13px;
          line-height: 1.6;
          color: var(--ds-text-secondary);
        }

        .evidence-content p {
          margin: 0;
        }

        .evidence-link {
          display: inline-block;
          margin-top: var(--ds-space-3);
          color: var(--ds-info);
          text-decoration: none;
          font-weight: 500;
          font-size: 13px;
        }

        .evidence-link:hover {
          text-decoration: underline;
        }

        .review-workflow {
          padding: var(--ds-space-4);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .workflow-step {
          display: flex;
          gap: var(--ds-space-4);
          align-items: flex-start;
        }

        .workflow-step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--ds-info);
          color: white;
          border-radius: 50%;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
        }

        .workflow-step-content h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .workflow-step-content p {
          margin: var(--ds-space-1) 0 0 0;
          font-size: 12px;
          color: var(--ds-text-secondary);
        }

        .workflow-arrow {
          text-align: center;
          color: var(--ds-border-default);
          font-size: 16px;
          font-weight: 300;
          line-height: 1;
        }

        .feedback-input-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--ds-space-4);
        }

        .template-toggle {
          padding: var(--ds-space-2) var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-md);
          font-size: 12px;
          font-weight: 500;
          color: var(--ds-text-secondary);
          cursor: pointer;
          transition: all 160ms var(--ds-ease);
        }

        .template-toggle:hover {
          background: var(--ds-border-subtle);
        }

        .template-selector {
          position: relative;
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-3);
          margin-top: var(--ds-space-2);
        }

        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--ds-space-3);
          padding-bottom: var(--ds-space-3);
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .template-header h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .template-close {
          background: none;
          border: none;
          font-size: 20px;
          color: var(--ds-text-secondary);
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .template-list {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
        }

        .template-item {
          padding: var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-md);
          text-align: left;
          cursor: pointer;
          transition: all 160ms var(--ds-ease);
        }

        .template-item:hover {
          background: var(--ds-border-subtle);
        }

        .template-item strong {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--ds-text-primary);
          margin-bottom: var(--ds-space-1);
        }

        .template-item p {
          margin: 0;
          font-size: 12px;
          color: var(--ds-text-secondary);
        }

        .feedback-textarea {
          width: 100%;
          padding: var(--ds-space-3);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-md);
          font-family: var(--ds-font);
          font-size: 13px;
          line-height: 1.6;
          color: var(--ds-text-primary);
          resize: vertical;
        }

        .feedback-textarea:focus {
          outline: none;
          border-color: var(--ds-info);
          box-shadow: var(--ds-ring);
        }

        .feedback-textarea:disabled {
          background: var(--ds-bg-subtle);
          color: var(--ds-text-disabled);
        }

        .review-decisions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--ds-space-4);
          padding-top: var(--ds-space-4);
          border-top: 1px solid var(--ds-border-subtle);
        }

        .decision-group {
          padding: var(--ds-space-4);
          border-radius: var(--ds-radius-md);
          border: 1px solid var(--ds-border-subtle);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .decision-group.reject {
          border-color: var(--ds-danger);
          background: var(--ds-danger-soft);
        }

        .decision-group.changes {
          border-color: var(--ds-warning);
          background: var(--ds-warning-soft);
        }

        .decision-group.approve {
          border-color: var(--ds-success);
          background: var(--ds-success-soft);
        }

        .decision-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .decision-description {
          margin: 0;
          font-size: 12px;
          color: var(--ds-text-secondary);
        }

        .decision-button {
          width: 100%;
          font-size: 13px;
          font-weight: 600;
        }

        .reject-button {
          background: var(--ds-danger);
          color: white;
        }

        .reject-button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--ds-danger) 90%, black 10%);
        }

        .changes-button {
          background: var(--ds-warning);
          color: white;
        }

        .changes-button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--ds-warning) 90%, black 10%);
        }

        .approve-button {
          background: var(--ds-success);
          color: white;
        }

        .approve-button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--ds-success) 90%, black 10%);
        }

        @media (max-width: 768px) {
          .submission-review-flow {
            padding: var(--ds-space-4);
          }

          .review-header {
            flex-direction: column;
          }

          .review-decisions {
            grid-template-columns: 1fr;
          }

          .workflow-step {
            gap: var(--ds-space-3);
          }
        }
      `}</style>
    </div>
  );
}
