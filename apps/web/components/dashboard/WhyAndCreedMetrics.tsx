"use client";
/**
 * WhyAndCreedMetrics — displays progress metrics connected to the user's
 * Why & Creed, helping them see how their business growth aligns with their
 * stated purpose. Shows:
 *
 * - Progress toward key goals (lessons completed, revenue targets, customer wins)
 * - How current metrics connect to their stated "why"
 * - Visual progress with contextual messaging
 * - Motivational reminders of their purpose in action
 *
 * This bridges the gap between daily metrics and deeper purpose, preventing
 * the metrics-chasing that misses true north.
 */

export interface MetricItem {
  label: string;
  current: number;
  target?: number;
  unit: string;
  icon: string;
  contextToWhy?: string; // e.g., "This connects to your why: helping businesses scale"
}

interface WhyAndCreedMetricsProps {
  why?: string | null;
  creed?: string | null;
  metrics?: MetricItem[];
}

export function WhyAndCreedMetrics({
  why,
  creed,
  metrics = [],
}: WhyAndCreedMetricsProps) {
  const hasContent = (why || creed) && metrics.length > 0;

  if (!hasContent) {
    return null; // Don't render if no data
  }

  const percentComplete = metrics.length > 0
    ? Math.round(
        metrics.reduce((sum, m) => {
          if (!m.target) return sum;
          return sum + Math.min(100, (m.current / m.target) * 100);
        }, 0) / metrics.length
      )
    : 0;

  return (
    <section className="wacm-section">
      <style>{css}</style>

      <div className="wacm-header">
        <h3 className="wacm-title">Your Why in Action</h3>
        <p className="wacm-subtitle">How your daily progress connects to your purpose</p>
      </div>

      {why && (
        <div className="wacm-purpose-banner">
          <div className="wacm-purpose-content">
            <span className="wacm-purpose-icon">🎯</span>
            <div className="wacm-purpose-text">
              <p className="wacm-purpose-label">Your Why</p>
              <p className="wacm-purpose-statement">{why}</p>
            </div>
          </div>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="wacm-progress-container">
          <div className="wacm-progress-bar">
            <div
              className="wacm-progress-fill"
              style={{ width: `${percentComplete}%` }}
              role="progressbar"
              aria-valuenow={percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="wacm-progress-text">
            {percentComplete}% of goals in motion
          </p>
        </div>
      )}

      <div className="wacm-metrics-grid">
        {metrics.map((metric, idx) => {
          const progress = metric.target
            ? Math.min(100, (metric.current / metric.target) * 100)
            : null;
          const isComplete = progress && progress >= 100;

          return (
            <div key={idx} className="wacm-metric-card">
              <div className="wacm-metric-header">
                <span className="wacm-metric-icon">{metric.icon}</span>
                <span className="wacm-metric-label">{metric.label}</span>
              </div>

              <div className="wacm-metric-value">
                <span className="wacm-metric-number">{metric.current}</span>
                {metric.unit && <span className="wacm-metric-unit">{metric.unit}</span>}
              </div>

              {metric.target && (
                <>
                  <div className="wacm-metric-mini-bar">
                    <div
                      className={`wacm-metric-mini-fill ${isComplete ? 'complete' : ''}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="wacm-metric-target">
                    Goal: {metric.target} {metric.unit}
                  </p>
                </>
              )}

              {metric.contextToWhy && (
                <p className="wacm-metric-context">{metric.contextToWhy}</p>
              )}
            </div>
          );
        })}
      </div>

      {creed && (
        <div className="wacm-creed-banner">
          <div className="wacm-creed-content">
            <span className="wacm-creed-icon">⚡</span>
            <div className="wacm-creed-text">
              <p className="wacm-creed-label">Your Principle</p>
              <p className="wacm-creed-statement">{creed}</p>
            </div>
          </div>
          <p className="wacm-creed-note">
            Every decision above should honor this commitment
          </p>
        </div>
      )}
    </section>
  );
}

const css = `
.wacm-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
}

.wacm-header {
  text-align: center;
  margin-bottom: 8px;
}

.wacm-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--ds-text-primary, #111827);
}

@media (prefers-color-scheme: dark) {
  .wacm-title {
    color: rgba(255, 255, 255, 0.95);
  }
}

.wacm-subtitle {
  margin: 6px 0 0 0;
  font-size: 14px;
  color: var(--ds-text-secondary, #475569);
}

@media (prefers-color-scheme: dark) {
  .wacm-subtitle {
    color: rgba(255, 255, 255, 0.6);
  }
}

.wacm-purpose-banner {
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff 0%, #fce7f3 100%);
  border: 2px solid #2563eb;
}

@media (prefers-color-scheme: dark) {
  .wacm-purpose-banner {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
    border-color: #2563eb;
  }
}

.wacm-purpose-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.wacm-purpose-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.wacm-purpose-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.wacm-purpose-label {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #2563eb;
}

@media (prefers-color-scheme: dark) {
  .wacm-purpose-label {
    color: #93c5fd;
  }
}

.wacm-purpose-statement {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ds-text-primary, #111827);
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .wacm-purpose-statement {
    color: rgba(255, 255, 255, 0.95);
  }
}

.wacm-progress-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wacm-progress-bar {
  height: 8px;
  background: var(--ds-bg-subtle, #f1f4f9);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--ds-border-subtle, #e5e7eb);
}

@media (prefers-color-scheme: dark) {
  .wacm-progress-bar {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.wacm-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #a855f7 50%, #ec4899 100%);
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.wacm-progress-text {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text-secondary, #475569);
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .wacm-progress-text {
    color: rgba(255, 255, 255, 0.6);
  }
}

.wacm-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

@media (max-width: 768px) {
  .wacm-metrics-grid {
    grid-template-columns: 1fr;
  }
}

.wacm-metric-card {
  padding: 14px;
  border: 1px solid var(--ds-border-default, #d1d5db);
  border-radius: 8px;
  background: var(--ds-surface, #fff);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-card {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
  }
}

.wacm-metric-card:hover {
  border-color: var(--ds-brand, #088057);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-card:hover {
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  }
}

.wacm-metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wacm-metric-icon {
  font-size: 20px;
  line-height: 1;
}

.wacm-metric-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-text-primary, #111827);
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-label {
    color: rgba(255, 255, 255, 0.95);
  }
}

.wacm-metric-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.wacm-metric-number {
  font-size: 24px;
  font-weight: 800;
  color: #2563eb;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-number {
    color: #93c5fd;
  }
}

.wacm-metric-unit {
  font-size: 12px;
  color: var(--ds-text-secondary, #475569);
  font-weight: 500;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-unit {
    color: rgba(255, 255, 255, 0.6);
  }
}

.wacm-metric-mini-bar {
  height: 4px;
  background: var(--ds-bg-subtle, #f1f4f9);
  border-radius: 2px;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-mini-bar {
    background: rgba(255, 255, 255, 0.1);
  }
}

.wacm-metric-mini-fill {
  height: 100%;
  background: #16a34a;
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.wacm-metric-mini-fill.complete {
  background: #059669;
  box-shadow: 0 0 8px rgba(5, 150, 105, 0.4);
}

.wacm-metric-target {
  margin: 0;
  font-size: 11px;
  color: var(--ds-text-secondary, #475569);
  font-weight: 500;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-target {
    color: rgba(255, 255, 255, 0.6);
  }
}

.wacm-metric-context {
  margin: 0;
  font-size: 12px;
  color: var(--ds-text-secondary, #475569);
  font-style: italic;
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .wacm-metric-context {
    color: rgba(255, 255, 255, 0.6);
  }
}

.wacm-creed-banner {
  padding: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fef3c7 0%, #fee2e2 100%);
  border: 2px solid #d97706;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (prefers-color-scheme: dark) {
  .wacm-creed-banner {
    background: linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
    border-color: #d97706;
  }
}

.wacm-creed-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.wacm-creed-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.wacm-creed-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.wacm-creed-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #d97706;
}

@media (prefers-color-scheme: dark) {
  .wacm-creed-label {
    color: #fbbf24;
  }
}

.wacm-creed-statement {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ds-text-primary, #111827);
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .wacm-creed-statement {
    color: rgba(255, 255, 255, 0.95);
  }
}

.wacm-creed-note {
  margin: 0;
  font-size: 12px;
  color: var(--ds-text-secondary, #475569);
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .wacm-creed-note {
    color: rgba(255, 255, 255, 0.6);
  }
}
`;
