"use client";
/**
 * TrafficFlow — Shows different traffic sources and how they flow through
 * the funnel, highlighting drop-off points and conversion at each stage.
 */
import { useState } from "react";

interface TrafficSource {
  id: string;
  name: string;
  icon: string;
  monthly: number;
  color: string;
  description: string;
}

interface StageMetrics {
  name: string;
  visitors: number;
  conversionRate: number;
  avgTimeSpent: string;
}

const TRAFFIC_SOURCES: TrafficSource[] = [
  {
    id: "paid",
    name: "Paid Ads",
    icon: "📢",
    monthly: 4500,
    color: "#3b82f6",
    description: "Google Ads, LinkedIn, Facebook — highly targeted",
  },
  {
    id: "organic",
    name: "Organic Search",
    icon: "🔍",
    monthly: 2800,
    color: "#10b981",
    description: "SEO traffic from Google and other search engines",
  },
  {
    id: "referral",
    name: "Referrals",
    icon: "🤝",
    monthly: 1200,
    color: "#f59e0b",
    description: "Partner sites, word-of-mouth, press mentions",
  },
  {
    id: "direct",
    name: "Direct",
    icon: "🔗",
    monthly: 800,
    color: "#8b5cf6",
    description: "Bookmarks, email signatures, returning visitors",
  },
];

const STAGE_METRICS: StageMetrics[] = [
  { name: "Awareness", visitors: 10000, conversionRate: 0.05, avgTimeSpent: "30 sec" },
  { name: "Consideration", visitors: 500, conversionRate: 0.2, avgTimeSpent: "5 min" },
  { name: "Decision", visitors: 100, conversionRate: 0.5, avgTimeSpent: "3 min" },
  { name: "Retention", visitors: 50, conversionRate: 0.8, avgTimeSpent: "ongoing" },
];

export function TrafficFlow() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const getTrafficAtStage = (source: TrafficSource, stageIndex: number): number => {
    let traffic = source.monthly;
    for (let i = 0; i < stageIndex; i++) {
      traffic = Math.round(traffic * STAGE_METRICS[i]!.conversionRate);
    }
    return traffic;
  };

  return (
    <div className="traffic-flow">
      {/* Traffic Sources Overview */}
      <div className="traffic-sources-section">
        <h3>Where Traffic Comes From</h3>
        <div className="traffic-sources-grid">
          {TRAFFIC_SOURCES.map((source) => (
            <div
              key={source.id}
              className={`traffic-source-card ${selectedSource === source.id ? "active" : ""}`}
              onClick={() => setSelectedSource(selectedSource === source.id ? null : source.id)}
            >
              <div className="source-icon">{source.icon}</div>
              <div className="source-info">
                <h4>{source.name}</h4>
                <p className="source-monthly">
                  <strong>{source.monthly.toLocaleString()}</strong> visitors/month
                </p>
                <p className="source-description">{source.description}</p>
              </div>
              <div
                className="source-color-indicator"
                style={{ backgroundColor: source.color }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="flow-visualization">
        <h3>How Traffic Flows Through Stages</h3>
        <div className="flow-stages">
          {STAGE_METRICS.map((stage, stageIndex) => (
            <div key={stage.name} className="flow-stage">
              <div className="stage-header">
                <h4>{stage.name}</h4>
                <div className="stage-metric">
                  <div className="metric-value">
                    {stageIndex === 0 ? "10K" : stage.visitors.toLocaleString()}
                  </div>
                  <div className="metric-label">visitors</div>
                </div>
              </div>

              <div className="stage-bars">
                {TRAFFIC_SOURCES.map((source) => {
                  const traffic = getTrafficAtStage(source, stageIndex);
                  const percentage = (traffic / stage.visitors) * 100;
                  return (
                    <div
                      key={`${source.id}-${stageIndex}`}
                      className="traffic-bar-container"
                    >
                      <div
                        className={`traffic-bar ${selectedSource === source.id ? "highlighted" : ""}`}
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: source.color,
                          height: "32px",
                        }}
                        title={`${source.name}: ${traffic} visitors`}
                      >
                        {percentage > 15 && (
                          <span className="bar-label">{Math.round(traffic)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="stage-footer">
                <div>Conversion Rate: <strong>{(stage.conversionRate * 100).toFixed(1)}%</strong></div>
                <div>Avg Time: <strong>{stage.avgTimeSpent}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="flow-insights">
        <h3>Key Insights About Traffic Flow</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-number">1</div>
            <h4>More Traffic Doesn't Always Mean More Sales</h4>
            <p>
              You might get 10,000 visitors but only 50 conversions (0.5%). Instead of chasing
              more traffic, optimize conversion at each stage.
            </p>
          </div>

          <div className="insight-card">
            <div className="insight-number">2</div>
            <h4>Different Sources Convert Differently</h4>
            <p>
              Paid ads bring high-quality traffic (often 5-10% conversion to consideration).
              Organic is cheaper but may have lower conversion until you refine positioning.
            </p>
          </div>

          <div className="insight-card">
            <div className="insight-number">3</div>
            <h4>Each Stage Has a Leak</h4>
            <p>
              You lose 95% in awareness, 80% in consideration, 50% in decision. Your biggest
              opportunity is often the biggest leak, not the traffic level.
            </p>
          </div>

          <div className="insight-card">
            <div className="insight-number">4</div>
            <h4>Retention Compounds Everything</h4>
            <p>
              50 customers is only the start. If 40 stay (80% retention), you have recurring
              revenue and referral momentum instead of 50 one-time sales.
            </p>
          </div>
        </div>
      </div>

      {/* What Causes Drop-offs */}
      <div className="dropoff-causes">
        <h3>Why Traffic Drops Off at Each Stage</h3>
        <div className="causes-grid">
          <div className="cause-card">
            <h4>Awareness → Consideration</h4>
            <p className="cause-rate">Typical drop: 95%</p>
            <ul>
              <li>Unclear value proposition</li>
              <li>Poor landing page design</li>
              <li>Slow page load</li>
              <li>Wrong audience targeted</li>
            </ul>
          </div>

          <div className="cause-card">
            <h4>Consideration → Decision</h4>
            <p className="cause-rate">Typical drop: 80%</p>
            <ul>
              <li>Lots of competitor options</li>
              <li>Insufficient trust signals</li>
              <li>No social proof or reviews</li>
              <li>Unclear pricing or features</li>
            </ul>
          </div>

          <div className="cause-card">
            <h4>Decision → Retention</h4>
            <p className="cause-rate">Typical drop: 50%</p>
            <ul>
              <li>Unexpected costs at checkout</li>
              <li>Too many form fields</li>
              <li>Forced account creation</li>
              <li>Complex checkout process</li>
            </ul>
          </div>

          <div className="cause-card">
            <h4>Retention (Churn)</h4>
            <p className="cause-rate">Typical drop: 20-30%</p>
            <ul>
              <li>Poor onboarding experience</li>
              <li>Unmet expectations</li>
              <li>No ongoing engagement</li>
              <li>Better alternatives appear</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .traffic-flow {
          width: 100%;
        }

        .traffic-sources-section {
          margin-bottom: var(--ds-space-8);
        }

        .traffic-sources-section h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 var(--ds-space-4) 0;
          color: var(--ds-text-primary);
        }

        .traffic-sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: var(--ds-space-4);
        }

        .traffic-source-card {
          position: relative;
          background: var(--ds-surface);
          border: 2px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-4);
          cursor: pointer;
          transition: all var(--ds-dur-hover);
        }

        .traffic-source-card:hover {
          border-color: var(--ds-border-default);
          box-shadow: var(--ds-shadow-md);
          transform: translateY(-2px);
        }

        .traffic-source-card.active {
          border-color: var(--ds-brand);
          background: var(--ds-brand-soft);
          box-shadow: var(--ds-shadow-md);
        }

        .source-icon {
          font-size: 2rem;
          margin-bottom: var(--ds-space-3);
        }

        .source-info {
          flex: 1;
        }

        .source-info h4 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .source-monthly {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
        }

        .source-description {
          margin: 0;
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          line-height: 1.4;
        }

        .source-color-indicator {
          position: absolute;
          top: 0;
          right: 0;
          width: 4px;
          height: 100%;
          border-radius: 0 var(--ds-radius-lg) var(--ds-radius-lg) 0;
        }

        .flow-visualization {
          background: var(--ds-surface-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          margin-bottom: var(--ds-space-8);
        }

        .flow-visualization h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 var(--ds-space-6) 0;
          color: var(--ds-text-primary);
        }

        .flow-stages {
          display: flex;
          gap: var(--ds-space-4);
          overflow-x: auto;
          padding-bottom: var(--ds-space-4);
        }

        .flow-stage {
          flex: 0 0 calc(25% - 12px);
          min-width: 200px;
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
        }

        .stage-header {
          margin-bottom: var(--ds-space-4);
        }

        .stage-header h4 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .stage-metric {
          text-align: center;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ds-brand);
        }

        .metric-label {
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          margin-top: 2px;
        }

        .stage-bars {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: var(--ds-space-4);
        }

        .traffic-bar-container {
          position: relative;
        }

        .traffic-bar {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          border-radius: 4px;
          transition: all var(--ds-dur-hover);
          position: relative;
          min-height: 24px;
        }

        .traffic-bar:hover {
          filter: brightness(1.1);
        }

        .traffic-bar.highlighted {
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
        }

        .bar-label {
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          padding-left: 4px;
          white-space: nowrap;
        }

        .stage-footer {
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .flow-insights {
          margin-bottom: var(--ds-space-8);
        }

        .flow-insights h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 var(--ds-space-4) 0;
          color: var(--ds-text-primary);
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--ds-space-4);
        }

        .insight-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-4);
          position: relative;
          padding-left: 60px;
        }

        .insight-number {
          position: absolute;
          left: 0;
          top: 0;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--ds-brand-soft) 0%, #e7f6f0 100%);
          border-radius: 0 var(--ds-radius-lg) var(--ds-radius-lg) 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ds-brand);
        }

        .insight-card h4 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .insight-card p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.6;
        }

        .dropoff-causes {
          margin-top: var(--ds-space-8);
        }

        .dropoff-causes h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 var(--ds-space-4) 0;
          color: var(--ds-text-primary);
        }

        .causes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: var(--ds-space-4);
        }

        .cause-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-4);
        }

        .cause-card h4 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .cause-rate {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 0.9rem;
          color: var(--ds-danger);
          font-weight: 600;
        }

        .cause-card ul {
          margin: 0;
          padding-left: var(--ds-space-4);
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.6;
        }

        .cause-card li {
          margin-bottom: 6px;
        }

        @media (max-width: 768px) {
          .traffic-sources-grid {
            grid-template-columns: 1fr;
          }

          .flow-stages {
            gap: var(--ds-space-2);
          }

          .flow-stage {
            flex: 0 0 calc(50% - 4px);
            min-width: 160px;
          }

          .insights-grid {
            grid-template-columns: 1fr;
          }

          .causes-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
