"use client";
/**
 * LearnerPurposeCard — displays a learner's "Why" and "Creed" in the
 * coach's detail view, helping coaches understand the learner's deeper
 * purpose and business commitment so they can provide more personalized
 * and meaningful feedback.
 *
 * Shows:
 * - 🎯 Their Why (transformation they want to create)
 * - ⚡ Their Creed (non-negotiable business principle)
 *
 * If not set, shows a prompt explaining why this matters for coaching.
 */

interface LearnerPurposeCardProps {
  why?: string | null;
  creed?: string | null;
}

export function LearnerPurposeCard({ why, creed }: LearnerPurposeCardProps) {
  const isEmpty = !why && !creed;

  if (isEmpty) {
    return (
      <section className="lpc-section">
        <h3 className="lpc-title">Purpose & Commitment</h3>
        <div className="lpc-empty">
          <p className="lpc-empty-text">
            This learner hasn't defined their Why & Creed yet. Once they do, you'll see their purpose and business commitment here — helping you provide more meaningful, aligned feedback.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="lpc-section">
      <h3 className="lpc-title">Purpose & Commitment</h3>

      {why && (
        <div className="lpc-card lpc-why">
          <div className="lpc-header">
            <span className="lpc-icon">🎯</span>
            <span className="lpc-label">Their Why</span>
          </div>
          <p className="lpc-content">{why}</p>
          <p className="lpc-note">The transformation they want to create</p>
        </div>
      )}

      {creed && (
        <div className="lpc-card lpc-creed">
          <div className="lpc-header">
            <span className="lpc-icon">⚡</span>
            <span className="lpc-label">Their Creed</span>
          </div>
          <p className="lpc-content">{creed}</p>
          <p className="lpc-note">Their non-negotiable business principle</p>
        </div>
      )}

      <p className="lpc-coaching-tip">
        💡 <strong>Coaching tip:</strong> Reference their Why & Creed when providing feedback. Help them see how their progress connects to their deeper purpose.
      </p>
    </section>
  );
}

const css = `
.lpc-section {
  padding: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.lpc-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
}

.lpc-card {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.lpc-why {
  border-left: 3px solid #2563eb;
  background: #eff6ff;
}

.lpc-creed {
  border-left: 3px solid #d97706;
  background: #fef3c7;
}

@media (prefers-color-scheme: dark) {
  .lpc-section {
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  .lpc-title {
    color: rgba(255, 255, 255, 0.6);
  }

  .lpc-card {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
  }

  .lpc-why {
    background: rgba(37, 99, 235, 0.1);
  }

  .lpc-creed {
    background: rgba(217, 119, 6, 0.1);
  }
}

.lpc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.lpc-icon {
  font-size: 16px;
  line-height: 1;
}

.lpc-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(0, 0, 0, 0.7);
}

@media (prefers-color-scheme: dark) {
  .lpc-label {
    color: rgba(255, 255, 255, 0.7);
  }
}

.lpc-content {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.9);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .lpc-content {
    color: rgba(255, 255, 255, 0.9);
  }
}

.lpc-note {
  margin: 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .lpc-note {
    color: rgba(255, 255, 255, 0.5);
  }
}

.lpc-empty {
  padding: 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .lpc-empty {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.lpc-empty-text {
  margin: 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .lpc-empty-text {
    color: rgba(255, 255, 255, 0.6);
  }
}

.lpc-coaching-tip {
  margin: 12px 0 0 0;
  padding: 10px;
  background: rgba(37, 99, 235, 0.05);
  border-left: 2px solid #2563eb;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .lpc-coaching-tip {
    background: rgba(37, 99, 235, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
}
`;

// Export the CSS for use in the parent component
export const LearnerPurposeCardStyles = css;
