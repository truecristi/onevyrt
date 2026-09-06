/**
 * Funnel Analytics Visualization — waterfall-style chart showing traffic flow,
 * dropoff, and conversion rates across funnel stages with interactive hover.
 */
"use client";

import { useState } from "react";

export interface FunnelStage {
  name: string;
  visitors: number;
  converting: number;
  dropoff?: string;
  dropoffRate?: number;
  revenue?: number;
}

export interface FunnelAnalyticsData {
  name: string;
  stages: FunnelStage[];
  timeframe?: string;
}

interface FunnelAnalyticsProps {
  data?: FunnelAnalyticsData;
  showRevenue?: boolean;
}

// Example data for demonstration
const EXAMPLE_DATA: FunnelAnalyticsData = {
  name: "Q4 Webinar Campaign",
  timeframe: "October - December 2024",
  stages: [
    {
      name: "Email Signup",
      visitors: 10000,
      converting: 6500,
      dropoffRate: 35,
      dropoff: "Unsubscribed/inactive",
    },
    {
      name: "Webinar Opt-in",
      visitors: 6500,
      converting: 2730,
      dropoffRate: 58,
      dropoff: "Didn't register",
      revenue: 0,
    },
    {
      name: "Webinar Attendance",
      visitors: 2730,
      converting: 1638,
      dropoffRate: 40,
      dropoff: "No-show",
      revenue: 0,
    },
    {
      name: "Sales Page",
      visitors: 1638,
      converting: 442,
      dropoffRate: 73,
      dropoff: "Left without purchasing",
      revenue: 0,
    },
    {
      name: "Purchase",
      visitors: 442,
      converting: 442,
      dropoffRate: 0,
      revenue: 2206850,
    },
    {
      name: "Upsell",
      visitors: 442,
      converting: 137,
      dropoffRate: 69,
      dropoff: "Declined upsell",
      revenue: 81789,
    },
  ],
};

function getConversionRate(visitors: number, converting: number): number {
  if (visitors === 0) return 0;
  return (converting / visitors) * 100;
}

export function FunnelAnalytics({ data = EXAMPLE_DATA, showRevenue = true }: FunnelAnalyticsProps) {
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  const maxVisitors = Math.max(...data.stages.map((s) => s.visitors));

  return (
    <div className="funnel-analytics">
      <style>{`
        .funnel-analytics {
          padding: 40px 20px;
          background: var(--ds-bg-app);
        }

        .analytics-header {
          max-width: 1200px;
          margin: 0 auto 40px;
        }

        .analytics-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 8px 0;
        }

        .analytics-subtitle {
          font-size: 13px;
          color: var(--ds-text-tertiary);
          margin: 0;
        }

        .analytics-container {
          max-width: 1200px;
          margin: 0 auto;
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 40px;
        }

        .analytics-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 40px;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .summary-card {
          padding: 16px;
          background: var(--ds-bg-subtle);
          border-radius: 4px;
        }

        .summary-label {
          font-size: 11px;
          color: var(--ds-text-tertiary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--ds-text-primary);
        }

        .summary-change {
          font-size: 12px;
          color: var(--ds-text-secondary);
          margin-top: 4px;
        }

        .waterfall-chart {
          margin: 40px 0;
        }

        .stage-row {
          display: grid;
          grid-template-columns: 120px 1fr 80px 100px 1fr;
          gap: 16px;
          align-items: center;
          padding: 20px;
          background: var(--ds-bg-subtle);
          border-radius: 4px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .stage-row:hover {
          background: var(--ds-bg-app);
          border-color: var(--ds-border-default);
        }

        .stage-row.hovered {
          border-color: var(--ds-brand);
          box-shadow: 0 0 0 2px rgba(8, 128, 87, 0.1);
        }

        .stage-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .stage-bar-container {
          position: relative;
          height: 40px;
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 4px;
          overflow: hidden;
        }

        .stage-bar-fill {
          height: 100%;
          background: var(--ds-brand);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
        }

        .stage-bar-fill.excellent {
          background: var(--ds-brand);
        }

        .stage-bar-fill.good {
          background: #10b981;
        }

        .stage-bar-fill.okay {
          background: #f59e0b;
        }

        .stage-bar-fill.poor {
          background: #ef4444;
        }

        .bar-label {
          font-size: 11px;
          font-weight: 600;
          color: white;
          white-space: nowrap;
        }

        .stage-conversion {
          text-align: right;
        }

        .conversion-rate {
          font-size: 16px;
          font-weight: 700;
          color: var(--ds-text-primary);
        }

        .conversion-subtext {
          font-size: 11px;
          color: var(--ds-text-tertiary);
        }

        .stage-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--ds-text-secondary);
        }

        .metric-label {
          color: var(--ds-text-tertiary);
        }

        .metric-value {
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .dropoff-info {
          margin-top: 20px;
          padding: 16px;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 4px;
          font-size: 12px;
          color: #78350f;
          line-height: 1.6;
          display: none;
        }

        .dropoff-info.visible {
          display: block;
        }

        .dropoff-info strong {
          color: #7c2d12;
          font-weight: 600;
        }

        .optimization-tip {
          padding: 16px;
          background: var(--ds-brand-soft);
          border: 1px solid var(--ds-brand);
          border-radius: 4px;
          font-size: 12px;
          color: var(--ds-brand);
          margin-top: 16px;
          line-height: 1.6;
        }

        .optimization-tip strong {
          color: var(--ds-brand);
          font-weight: 600;
        }

        .legend {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          margin-top: 40px;
          padding-top: 40px;
          border-top: 1px solid var(--ds-border-subtle);
          font-size: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 2px;
        }

        @media (max-width: 768px) {
          .stage-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .stage-bar-container {
            order: 3;
          }

          .stage-conversion {
            text-align: left;
          }

          .stage-metrics {
            grid-column: 1 / -1;
          }
        }
      `}</style>

      <div className="analytics-header">
        <h3 className="analytics-title">{data.name}</h3>
        {data.timeframe && (
          <p className="analytics-subtitle">
            {data.timeframe}
          </p>
        )}
      </div>

      <div className="analytics-container">
        {/* Summary Cards */}
        <div className="analytics-summary">
          <div className="summary-card">
            <div className="summary-label">Total Visitors</div>
            <div className="summary-value">
              {data.stages[0]?.visitors.toLocaleString()}
            </div>
            <div className="summary-change">Entry point</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Total Conversions</div>
            <div className="summary-value">
              {data.stages[data.stages.length - 1]?.converting.toLocaleString()}
            </div>
            <div className="summary-change">
              {(
                (data.stages[data.stages.length - 1]!.converting /
                  data.stages[0]!.visitors) *
                100
              ).toFixed(1)}
              % conversion rate
            </div>
          </div>

          {showRevenue && (
            <div className="summary-card">
              <div className="summary-label">Total Revenue</div>
              <div className="summary-value">
                ${data.stages.reduce((sum, s) => sum + (s.revenue || 0), 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="summary-change">
                ${(
                  data.stages.reduce((sum, s) => sum + (s.revenue || 0), 0) /
                  data.stages[data.stages.length - 1]!.converting
                ).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} per customer
              </div>
            </div>
          )}

          <div className="summary-card">
            <div className="summary-label">Biggest Dropoff</div>
            {(() => {
              let maxDropoff = 0;
              let maxDropoffStage = data.stages[0]!;
              data.stages.forEach((stage) => {
                if (stage.dropoffRate && stage.dropoffRate > maxDropoff) {
                  maxDropoff = stage.dropoffRate;
                  maxDropoffStage = stage;
                }
              });
              return (
                <>
                  <div className="summary-value">{maxDropoff}%</div>
                  <div className="summary-change">{maxDropoffStage.name}</div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Waterfall Chart */}
        <div className="waterfall-chart">
          {data.stages.map((stage, index) => {
            const conversionRate = getConversionRate(stage.visitors, stage.converting);
            const barWidth = (stage.converting / maxVisitors) * 100;

            let barClass = "poor";
            if (conversionRate >= 50) barClass = "excellent";
            else if (conversionRate >= 30) barClass = "good";
            else if (conversionRate >= 15) barClass = "okay";

            return (
              <div
                key={index}
                className={`stage-row ${hoveredStage === index ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredStage(index)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                <div className="stage-name">{stage.name}</div>

                <div className="stage-bar-container">
                  <div
                    className={`stage-bar-fill ${barClass}`}
                    style={{
                      width: `${barWidth}%`,
                      minWidth: barWidth > 0 ? "40px" : "0",
                    }}
                  >
                    {barWidth > 10 && (
                      <span className="bar-label">{stage.converting.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="stage-conversion">
                  <div className="conversion-rate">{conversionRate.toFixed(0)}%</div>
                  <div className="conversion-subtext">
                    from {stage.visitors.toLocaleString()}
                  </div>
                </div>

                <div style={{}}></div>

                <div className="stage-metrics">
                  <div className="metric-row">
                    <span className="metric-label">Converting:</span>
                    <span className="metric-value">{stage.converting.toLocaleString()}</span>
                  </div>
                  {stage.dropoff && (
                    <div className="metric-row">
                      <span className="metric-label">Dropoff:</span>
                      <span className="metric-value" style={{ color: "#ef4444" }}>
                        -{(stage.visitors - stage.converting).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {stage.revenue && (
                    <div className="metric-row">
                      <span className="metric-label">Revenue:</span>
                      <span className="metric-value">
                        ${stage.revenue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {hoveredStage === index && stage.dropoff && (
                  <div className="dropoff-info visible">
                    <strong>Why people drop off:</strong> {stage.dropoff} (
                    {stage.dropoffRate}% of visitors)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Optimization Tips */}
        <div>
          {(() => {
            let bottleneck = data.stages[0]!;
            let maxDropoff = 0;
            data.stages.forEach((stage) => {
              if (stage.dropoffRate && stage.dropoffRate > maxDropoff) {
                maxDropoff = stage.dropoffRate;
                bottleneck = stage;
              }
            });

            const suggestions: Record<string, string> = {
              "Email Signup":
                "Add trust signals, simplify form fields, or test urgency messaging to improve signups.",
              "Webinar Opt-in":
                "Highlight speaker credibility, add testimonials, or shorten the registration form.",
              "Webinar Attendance":
                "Send reminder emails (24h and 1h before), make the join link prominent.",
              "Sales Page":
                "Add social proof, improve value proposition clarity, test different CTA buttons.",
              Purchase:
                "Reduce checkout steps, add payment guarantees, or simplify the payment form.",
              Upsell:
                "Highlight complementary services, use one-click purchase, or offer a limited-time bonus.",
            };

            return (
              <div className="optimization-tip">
                <strong>🎯 Focus Here:</strong> Your biggest opportunity is the {bottleneck.name}{" "}
                stage ({maxDropoff}% dropoff).{" "}
                {suggestions[bottleneck.name] ||
                  "Analyze user behavior and test improvements to this stage."}
              </div>
            );
          })()}
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: "var(--ds-brand)" }}></div>
            <span>Excellent (50%+)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: "#10b981" }}></div>
            <span>Good (30-50%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: "#f59e0b" }}></div>
            <span>Okay (15-30%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: "#ef4444" }}></div>
            <span>Needs Work (&lt;15%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
