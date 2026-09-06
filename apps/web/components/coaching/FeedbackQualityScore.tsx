"use client";

/**
 * FeedbackQualityScore — Coach feedback analytics dashboard.
 *
 * Displays:
 * - Scores: clarity, helpfulness, actionability, timeliness (1-10)
 * - Visual score representation with gauge
 * - Benchmark: comparison to other coaches
 * - Improvement suggestions
 * - Learner satisfaction correlation
 */

import { useMemo } from "react";

export interface FeedbackQualityMetrics {
  coachId: string;
  coachName: string;
  clarity: number;
  helpfulness: number;
  actionability: number;
  timeliness: number;
  averageScore: number;
  learnerSatisfaction?: number;
  comparisonToBenchmark: number;
  improvementSuggestions: string[];
  totalFeedbackGiven: number;
}

/**
 * Visual gauge for displaying a score
 */
function ScoreGauge({ score, max = 10 }: { score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const color =
    score >= 8
      ? "var(--ds-success)"
      : score >= 6
        ? "var(--ds-warning)"
        : "var(--ds-danger)";

  return (
    <div className="score-gauge">
      <div className="gauge-circle">
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--ds-border-subtle)"
            strokeWidth="8"
          />
          {/* Filled circle based on percentage */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${(percentage / 100) * 2 * Math.PI * 54} ${
              2 * Math.PI * 54
            }`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dasharray 400ms ease-out" }}
          />
          {/* Score text */}
          <text
            x="60"
            y="65"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="28"
            fontWeight="700"
            fill={color}
          >
            {score.toFixed(1)}
          </text>
          <text
            x="60"
            y="82"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fill="var(--ds-text-tertiary)"
          >
            / {max}
          </text>
        </svg>
      </div>
    </div>
  );
}

/**
 * Individual metric card
 */
function MetricCard({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  const backgroundColor =
    score >= 8
      ? "var(--ds-success-soft)"
      : score >= 6
        ? "var(--ds-warning-soft)"
        : "var(--ds-danger-soft)";

  const textColor =
    score >= 8
      ? "var(--ds-success)"
      : score >= 6
        ? "var(--ds-warning)"
        : "var(--ds-danger)";

  return (
    <div
      className="metric-card"
      style={{ borderLeftColor: textColor, backgroundColor }}
    >
      <div className="metric-header">
        <h4 className="metric-name">{label}</h4>
        <span className="metric-score" style={{ color: textColor }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <p className="metric-description">{description}</p>
      <div className="metric-bar">
        <div
          className="metric-bar-fill"
          style={{
            width: `${score * 10}%`,
            backgroundColor: textColor,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Benchmark comparison
 */
function BenchmarkComparison({ comparison }: { comparison: number }) {
  const isAbove = comparison > 0;
  const absComparison = Math.abs(comparison);

  return (
    <div className={`benchmark-card ${isAbove ? "above" : "below"}`}>
      <div className="benchmark-header">
        <h4>Comparison to Benchmark</h4>
        <span
          className="benchmark-indicator"
          style={{
            backgroundColor: isAbove ? "var(--ds-success)" : "var(--ds-danger)",
          }}
        >
          {isAbove ? "↑" : "↓"}
        </span>
      </div>

      <div className="benchmark-content">
        <span className="benchmark-value" style={{ color: isAbove ? "var(--ds-success)" : "var(--ds-danger)" }}>
          {isAbove ? "+" : "-"}{absComparison.toFixed(1)} pts
        </span>
        <p className="benchmark-text">
          You're scoring{" "}
          {isAbove
            ? `${absComparison.toFixed(1)} points above`
            : `${absComparison.toFixed(1)} points below`}{" "}
          the coach average
        </p>
      </div>

      {isAbove && (
        <div className="benchmark-note success">
          Great job! Your feedback quality is above average.
        </div>
      )}
      {!isAbove && (
        <div className="benchmark-note warning">
          There's room for improvement. See suggestions below.
        </div>
      )}
    </div>
  );
}

/**
 * Main component: Feedback Quality Score
 */
export function FeedbackQualityScore({
  coachName,
  clarity,
  helpfulness,
  actionability,
  timeliness,
  averageScore,
  learnerSatisfaction,
  comparisonToBenchmark,
  improvementSuggestions,
  totalFeedbackGiven,
}: FeedbackQualityMetrics) {
  const scoreLevel = useMemo(() => {
    if (averageScore >= 8) return "Excellent";
    if (averageScore >= 6) return "Good";
    return "Needs Improvement";
  }, [averageScore]);

  return (
    <div className="feedback-quality-score ds-scope">
      {/* Header */}
      <div className="fqs-header">
        <div>
          <h2 className="fqs-title">Feedback Quality Analytics</h2>
          <p className="fqs-subtitle">{coachName}</p>
        </div>
        <div className="fqs-meta">
          <div className="meta-item">
            <span className="meta-label">Total Feedback Given</span>
            <span className="meta-value">{totalFeedbackGiven}</span>
          </div>
          {learnerSatisfaction !== undefined && (
            <div className="meta-item">
              <span className="meta-label">Learner Satisfaction</span>
              <span className="meta-value">
                {learnerSatisfaction.toFixed(1)}/10
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Overall score */}
      <div className="overall-section">
        <div className="overall-left">
          <ScoreGauge score={averageScore} />
        </div>

        <div className="overall-right">
          <h3 className="overall-level">{scoreLevel}</h3>
          <p className="overall-score">
            Average Score: <strong>{averageScore.toFixed(1)}/10</strong>
          </p>

          <div className="overall-description">
            <p>
              {averageScore >= 8
                ? "Your feedback is consistently clear, helpful, and actionable. Learners appreciate your specific guidance and timely responses."
                : averageScore >= 6
                  ? "Your feedback is generally solid. Focus on being more specific and actionable to maximize learner impact."
                  : "Your feedback needs improvement in clarity and specificity. The suggestions below will help you provide more valuable guidance."}
            </p>
          </div>
        </div>
      </div>

      {/* Individual metrics */}
      <div className="metrics-section">
        <h3 className="section-title">Detailed Scores</h3>
        <div className="metrics-grid">
          <MetricCard
            label="Clarity"
            score={clarity}
            description="How clear and understandable is your feedback?"
          />
          <MetricCard
            label="Helpfulness"
            score={helpfulness}
            description="How useful is your feedback for learner progress?"
          />
          <MetricCard
            label="Actionability"
            score={actionability}
            description="Does it provide clear next steps?"
          />
          <MetricCard
            label="Timeliness"
            score={timeliness}
            description="How quickly do you provide feedback?"
          />
        </div>
      </div>

      {/* Benchmark comparison */}
      <BenchmarkComparison comparison={comparisonToBenchmark} />

      {/* Improvement suggestions */}
      {improvementSuggestions.length > 0 && (
        <div className="suggestions-section">
          <h3 className="section-title">Suggestions for Improvement</h3>
          <div className="suggestions-grid">
            {improvementSuggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-card">
                <span className="suggestion-icon">→</span>
                <p>{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="actions-section">
        <h3 className="section-title">What You Can Do</h3>
        <ul className="actions-list">
          <li>Review past feedback to identify patterns</li>
          <li>Set a target to improve your lowest-scoring metric</li>
          <li>Schedule a coaching peer review with another coach</li>
          <li>Track your progress over time</li>
        </ul>
      </div>

      <style jsx>{`
        .feedback-quality-score {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-5);
          padding: var(--ds-space-6);
          background: var(--ds-bg-app);
        }

        .fqs-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--ds-space-4);
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
        }

        .fqs-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .fqs-subtitle {
          margin: var(--ds-space-2) 0 0 0;
          font-size: 14px;
          color: var(--ds-text-secondary);
        }

        .fqs-meta {
          display: flex;
          gap: var(--ds-space-6);
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-1);
          text-align: right;
        }

        .meta-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--ds-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .meta-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .overall-section {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: var(--ds-space-6);
          align-items: center;
          padding: var(--ds-space-6);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
        }

        .score-gauge {
          display: flex;
          justify-content: center;
        }

        .gauge-circle {
          position: relative;
        }

        .overall-right {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .overall-level {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: var(--ds-text-primary);
        }

        .overall-score {
          margin: 0;
          font-size: 14px;
          color: var(--ds-text-secondary);
        }

        .overall-description {
          padding: var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-md);
          border-left: 3px solid var(--ds-info);
        }

        .overall-description p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ds-text-secondary);
        }

        .metrics-section {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-4);
        }

        .section-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--ds-space-4);
        }

        .metric-card {
          padding: var(--ds-space-4);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          border-left-width: 3px;
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-name {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .metric-score {
          font-size: 14px;
          font-weight: 700;
        }

        .metric-description {
          margin: 0;
          font-size: 12px;
          color: var(--ds-text-secondary);
          line-height: 1.4;
        }

        .metric-bar {
          height: 4px;
          background: var(--ds-border-subtle);
          border-radius: var(--ds-radius-pill);
          overflow: hidden;
        }

        .metric-bar-fill {
          height: 100%;
          border-radius: var(--ds-radius-pill);
          transition: width 400ms ease-out;
        }

        .benchmark-card {
          padding: var(--ds-space-4);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .benchmark-card.above {
          border-color: var(--ds-success);
          background: var(--ds-success-soft);
        }

        .benchmark-card.below {
          border-color: var(--ds-danger);
          background: var(--ds-danger-soft);
        }

        .benchmark-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .benchmark-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .benchmark-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: white;
          font-weight: 700;
          font-size: 14px;
        }

        .benchmark-content {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-1);
        }

        .benchmark-value {
          font-size: 18px;
          font-weight: 700;
        }

        .benchmark-text {
          margin: 0;
          font-size: 13px;
          color: var(--ds-text-secondary);
        }

        .benchmark-note {
          padding: var(--ds-space-3);
          border-radius: var(--ds-radius-md);
          font-size: 12px;
          line-height: 1.5;
        }

        .benchmark-note.success {
          background: color-mix(in srgb, var(--ds-success) 10%, transparent);
          color: var(--ds-success);
          border-left: 2px solid var(--ds-success);
          padding-left: var(--ds-space-3);
        }

        .benchmark-note.warning {
          background: color-mix(in srgb, var(--ds-warning) 10%, transparent);
          color: var(--ds-warning);
          border-left: 2px solid var(--ds-warning);
          padding-left: var(--ds-space-3);
        }

        .suggestions-section {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-4);
        }

        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--ds-space-3);
        }

        .suggestion-card {
          padding: var(--ds-space-4);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-default);
          border-radius: var(--ds-radius-lg);
          border-left: 3px solid var(--ds-warning);
          display: flex;
          gap: var(--ds-space-3);
        }

        .suggestion-icon {
          flex-shrink: 0;
          font-size: 18px;
          color: var(--ds-warning);
        }

        .suggestion-card p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ds-text-secondary);
        }

        .actions-section {
          padding: var(--ds-space-4);
          background: var(--ds-info-soft);
          border: 1px solid var(--ds-info);
          border-radius: var(--ds-radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-3);
        }

        .actions-section .section-title {
          color: var(--ds-info);
          margin-bottom: var(--ds-space-2);
        }

        .actions-list {
          margin: 0;
          padding: 0 0 0 var(--ds-space-5);
          list-style: none;
        }

        .actions-list li {
          margin: var(--ds-space-2) 0;
          font-size: 13px;
          color: var(--ds-text-secondary);
          position: relative;
          padding-left: var(--ds-space-3);
        }

        .actions-list li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: var(--ds-info);
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .feedback-quality-score {
            padding: var(--ds-space-4);
          }

          .fqs-header {
            flex-direction: column;
          }

          .fqs-meta {
            flex-direction: column;
            gap: var(--ds-space-3);
          }

          .meta-item {
            text-align: left;
          }

          .overall-section {
            grid-template-columns: 1fr;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .suggestions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
