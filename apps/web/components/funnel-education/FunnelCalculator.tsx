"use client";
/**
 * FunnelCalculator — Interactive tool to calculate conversion rates
 * and identify the biggest leak in the funnel.
 */
import { useState } from "react";

interface FunnelMetrics {
  awareness: number;
  consideration: number;
  decision: number;
  retention: number;
}

export function FunnelCalculator() {
  const [metrics, setMetrics] = useState<FunnelMetrics>({
    awareness: 10000,
    consideration: 500,
    decision: 100,
    retention: 50,
  });

  const [, setEdited] = useState<Partial<FunnelMetrics>>({});

  const updateMetric = (stage: keyof FunnelMetrics, value: number) => {
    const numValue = Math.max(0, value);
    setMetrics((prev) => ({ ...prev, [stage]: numValue }));
    setEdited((prev) => ({ ...prev, [stage]: true }));
  };

  const conversionRates = {
    awareness_to_consideration: metrics.awareness > 0 ? (metrics.consideration / metrics.awareness) * 100 : 0,
    consideration_to_decision: metrics.consideration > 0 ? (metrics.decision / metrics.consideration) * 100 : 0,
    decision_to_retention: metrics.decision > 0 ? (metrics.retention / metrics.decision) * 100 : 0,
    overall: metrics.awareness > 0 ? (metrics.retention / metrics.awareness) * 100 : 0,
  };

  const leaks = {
    awareness: metrics.awareness - metrics.consideration,
    consideration: metrics.consideration - metrics.decision,
    decision: metrics.decision - metrics.retention,
  };

  const leakRates = {
    awareness: metrics.awareness > 0 ? ((leaks.awareness / metrics.awareness) * 100).toFixed(1) : "0",
    consideration: metrics.consideration > 0 ? ((leaks.consideration / metrics.consideration) * 100).toFixed(1) : "0",
    decision: metrics.decision > 0 ? ((leaks.decision / metrics.decision) * 100).toFixed(1) : "0",
  };

  const biggestLeak = Math.max(leaks.awareness, leaks.consideration, leaks.decision);
  const getBiggestLeakStage = () => {
    if (biggestLeak === leaks.awareness) return "awareness";
    if (biggestLeak === leaks.consideration) return "consideration";
    if (biggestLeak === leaks.decision) return "decision";
    return null;
  };

  const biggestLeakStage = getBiggestLeakStage();

  const recommendations: Record<string, string> = {
    awareness:
      "Fix your marketing and landing page. Improve headline clarity, page speed, and ad targeting. A small improvement here compounds through all stages.",
    consideration:
      "Build trust faster. Add testimonials, social proof, and case studies. Improve content relevance. Make booking a call obvious.",
    decision:
      "Remove friction at checkout. Show all costs upfront. Offer payment plans. Make the decision a no-brainer by reducing objections.",
  };

  const improvementScenario = {
    current: metrics.retention,
    awareness_improvement: Math.round((metrics.awareness * (parseFloat(leakRates.awareness) - 5) * metrics.consideration) / 100 / 100),
    consideration_improvement: Math.round((metrics.awareness * (conversionRates.awareness_to_consideration / 100) * (parseFloat(leakRates.consideration) - 10) * metrics.decision) / 100 / 100),
    decision_improvement: Math.round((metrics.awareness * (conversionRates.awareness_to_consideration / 100) * (conversionRates.consideration_to_decision / 100) * (parseFloat(leakRates.decision) - 10)) / 100 / 100),
  };

  const improvementImpact = {
    awareness: Math.max(0, improvementScenario.current + improvementScenario.awareness_improvement),
    consideration: Math.max(0, improvementScenario.current + improvementScenario.consideration_improvement),
    decision: Math.max(0, improvementScenario.current + improvementScenario.decision_improvement),
  };

  return (
    <div className="funnel-calculator">
      {/* Input Section */}
      <div className="calculator-inputs">
        <h3>Your Funnel Numbers</h3>
        <p className="calculator-intro">
          Enter how many people are at each stage of your funnel to find your biggest leak:
        </p>

        <div className="inputs-grid">
          <div className="input-group">
            <label htmlFor="awareness">
              <span className="input-label-icon">👁️</span>
              <span>Awareness</span>
            </label>
            <input
              id="awareness"
              type="number"
              value={metrics.awareness}
              onChange={(e) => updateMetric("awareness", parseInt(e.target.value) || 0)}
              placeholder="How many people see your ads/content?"
            />
            <p className="input-help">People who discover you</p>
          </div>

          <div className="input-group">
            <label htmlFor="consideration">
              <span className="input-label-icon">🤔</span>
              <span>Consideration</span>
            </label>
            <input
              id="consideration"
              type="number"
              value={metrics.consideration}
              onChange={(e) => updateMetric("consideration", parseInt(e.target.value) || 0)}
              placeholder="How many visit your landing page?"
            />
            <p className="input-help">People who engage with your offer</p>
          </div>

          <div className="input-group">
            <label htmlFor="decision">
              <span className="input-label-icon">✅</span>
              <span>Decision</span>
            </label>
            <input
              id="decision"
              type="number"
              value={metrics.decision}
              onChange={(e) => updateMetric("decision", parseInt(e.target.value) || 0)}
              placeholder="How many actually purchase/signup?"
            />
            <p className="input-help">People who convert to customers</p>
          </div>

          <div className="input-group">
            <label htmlFor="retention">
              <span className="input-label-icon">🔄</span>
              <span>Retention</span>
            </label>
            <input
              id="retention"
              type="number"
              value={metrics.retention}
              onChange={(e) => updateMetric("retention", parseInt(e.target.value) || 0)}
              placeholder="How many are still customers 30+ days later?"
            />
            <p className="input-help">People who stay and repeat purchase</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="calculator-results">
        <h3>Your Funnel Analysis</h3>

        {/* Conversion Rates */}
        <div className="results-section">
          <h4>Conversion Rates</h4>
          <div className="rates-grid">
            <div className="rate-card">
              <div className="rate-number awareness">{conversionRates.awareness_to_consideration.toFixed(1)}%</div>
              <div className="rate-label">Awareness → Consideration</div>
              <div className="rate-interpretation">
                {conversionRates.awareness_to_consideration > 5 ? "✓ Good" : "⚠️ Below average"}
              </div>
            </div>

            <div className="rate-card">
              <div className="rate-number consideration">{conversionRates.consideration_to_decision.toFixed(1)}%</div>
              <div className="rate-label">Consideration → Decision</div>
              <div className="rate-interpretation">
                {conversionRates.consideration_to_decision > 20 ? "✓ Good" : "⚠️ Below average"}
              </div>
            </div>

            <div className="rate-card">
              <div className="rate-number decision">{conversionRates.decision_to_retention.toFixed(1)}%</div>
              <div className="rate-label">Decision → Retention</div>
              <div className="rate-interpretation">
                {conversionRates.decision_to_retention > 50 ? "✓ Good" : "⚠️ Below average"}
              </div>
            </div>

            <div className="rate-card highlighted">
              <div className="rate-number overall">{conversionRates.overall.toFixed(2)}%</div>
              <div className="rate-label">Overall Conversion</div>
              <div className="rate-interpretation">
                {conversionRates.overall > 0.5 ? "Solid funnel" : "Room for improvement"}
              </div>
            </div>
          </div>
        </div>

        {/* Drop-off Analysis */}
        <div className="results-section dropoff-section">
          <h4>Where You Lose Customers</h4>
          <div className="dropoff-bars">
            <div className="dropoff-bar-container">
              <div className="dropoff-bar-label">
                <span>Awareness Stage</span>
                <span className="dropoff-count">{leaks.awareness.toLocaleString()} lose ({leakRates.awareness}%)</span>
              </div>
              <div className="dropoff-bar-wrapper">
                <div className="dropoff-bar" style={{ width: Math.min(100, parseFloat(leakRates.awareness)) + "%" }} />
              </div>
            </div>

            <div className="dropoff-bar-container">
              <div className="dropoff-bar-label">
                <span>Consideration Stage</span>
                <span className="dropoff-count">{leaks.consideration.toLocaleString()} lose ({leakRates.consideration}%)</span>
              </div>
              <div className="dropoff-bar-wrapper">
                <div className="dropoff-bar" style={{ width: Math.min(100, parseFloat(leakRates.consideration)) + "%" }} />
              </div>
            </div>

            <div className="dropoff-bar-container">
              <div className="dropoff-bar-label">
                <span>Decision Stage</span>
                <span className="dropoff-count">{leaks.decision.toLocaleString()} lose ({leakRates.decision}%)</span>
              </div>
              <div className="dropoff-bar-wrapper">
                <div className="dropoff-bar" style={{ width: Math.min(100, parseFloat(leakRates.decision)) + "%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Biggest Leak Alert */}
        {biggestLeakStage && (
          <div className="biggest-leak-alert">
            <div className="alert-icon">⚡</div>
            <div className="alert-content">
              <h4>Biggest Leak: {biggestLeakStage.charAt(0).toUpperCase() + biggestLeakStage.slice(1)} Stage</h4>
              <p>You're losing {biggestLeak.toLocaleString()} people at this stage.</p>
              <p className="alert-recommendation">{recommendations[biggestLeakStage]}</p>
            </div>
          </div>
        )}

        {/* Improvement Scenarios */}
        <div className="results-section improvement-section">
          <h4>What If You Improved Each Stage?</h4>
          <p className="improvement-intro">
            Here's the impact of a 5-10% improvement at each stage:
          </p>

          <div className="improvement-cards">
            <div className="improvement-card">
              <div className="improvement-title">Improve Awareness (5% better)</div>
              <div className="improvement-from">Current: {metrics.retention}</div>
              <div className="improvement-to">Would reach: ~{improvementImpact.awareness}</div>
              <div className="improvement-gain">
                +{improvementImpact.awareness - metrics.retention} more customers
              </div>
            </div>

            <div className="improvement-card">
              <div className="improvement-title">Improve Consideration (10% better)</div>
              <div className="improvement-from">Current: {metrics.retention}</div>
              <div className="improvement-to">Would reach: ~{improvementImpact.consideration}</div>
              <div className="improvement-gain">
                +{improvementImpact.consideration - metrics.retention} more customers
              </div>
            </div>

            <div className="improvement-card highlight">
              <div className="improvement-title">Improve Decision (10% better)</div>
              <div className="improvement-from">Current: {metrics.retention}</div>
              <div className="improvement-to">Would reach: ~{improvementImpact.decision}</div>
              <div className="improvement-gain highlight-gain">
                +{improvementImpact.decision - metrics.retention} more customers ⭐
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .funnel-calculator {
          width: 100%;
        }

        .calculator-inputs {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          margin-bottom: var(--ds-space-6);
        }

        .calculator-inputs h3 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .calculator-intro {
          margin: 0 0 var(--ds-space-6) 0;
          font-size: 1rem;
          color: var(--ds-text-secondary);
          line-height: 1.6;
        }

        .inputs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--ds-space-6);
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
        }

        .input-group label {
          display: flex;
          align-items: center;
          gap: var(--ds-space-2);
          font-weight: 600;
          color: var(--ds-text-primary);
          font-size: 0.95rem;
        }

        .input-label-icon {
          font-size: 1.2rem;
        }

        .input-group input {
          padding: 10px var(--ds-space-3);
          border: 2px solid var(--ds-border-default);
          border-radius: var(--ds-radius-sm);
          font-size: 1rem;
          font-family: var(--ds-font);
          transition: border-color var(--ds-dur-hover);
        }

        .input-group input:focus {
          outline: none;
          border-color: var(--ds-brand);
          box-shadow: var(--ds-ring);
        }

        .input-help {
          margin: 0;
          font-size: 0.8rem;
          color: var(--ds-text-tertiary);
          font-weight: 400;
        }

        .calculator-results {
          background: linear-gradient(180deg, var(--ds-surface) 0%, var(--ds-surface-subtle) 100%);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
        }

        .calculator-results h3 {
          margin: 0 0 var(--ds-space-6) 0;
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .results-section {
          margin-bottom: var(--ds-space-6);
          padding-bottom: var(--ds-space-6);
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .results-section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .results-section h4 {
          margin: 0 0 var(--ds-space-4) 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .rates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: var(--ds-space-4);
        }

        .rate-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
          text-align: center;
          transition: all var(--ds-dur-hover);
        }

        .rate-card:hover {
          border-color: var(--ds-border-default);
          box-shadow: var(--ds-shadow-sm);
          transform: translateY(-2px);
        }

        .rate-card.highlighted {
          background: var(--ds-brand-soft);
          border-color: var(--ds-brand);
        }

        .rate-number {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: var(--ds-space-2);
          line-height: 1;
        }

        .rate-number.awareness {
          color: #3b82f6;
        }

        .rate-number.consideration {
          color: #f59e0b;
        }

        .rate-number.decision {
          color: #10b981;
        }

        .rate-number.overall {
          color: var(--ds-brand);
        }

        .rate-label {
          font-size: 0.8rem;
          color: var(--ds-text-secondary);
          font-weight: 500;
          margin-bottom: var(--ds-space-2);
          line-height: 1.3;
        }

        .rate-interpretation {
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          font-weight: 500;
        }

        .dropoff-section {
          margin-bottom: var(--ds-space-6);
        }

        .dropoff-bars {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-4);
        }

        .dropoff-bar-container {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-2);
        }

        .dropoff-bar-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          color: var(--ds-text-primary);
          font-weight: 500;
        }

        .dropoff-count {
          color: var(--ds-danger);
          font-weight: 600;
        }

        .dropoff-bar-wrapper {
          background: var(--ds-bg-subtle);
          border-radius: 4px;
          overflow: hidden;
          height: 24px;
        }

        .dropoff-bar {
          background: linear-gradient(90deg, #c81e1e 0%, #e53e3e 100%);
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
          min-width: 4px;
        }

        .biggest-leak-alert {
          background: linear-gradient(135deg, #fff1f1 0%, #ffe2e2 100%);
          border: 2px solid #c81e1e;
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
          display: flex;
          gap: var(--ds-space-3);
          margin-bottom: var(--ds-space-6);
        }

        .alert-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .alert-content {
          flex: 1;
        }

        .alert-content h4 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 1rem;
          font-weight: 600;
          color: #c81e1e;
        }

        .alert-content p {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.5;
        }

        .alert-content p:last-child {
          margin-bottom: 0;
        }

        .alert-recommendation {
          background: rgba(200, 30, 30, 0.05);
          padding: var(--ds-space-2) var(--ds-space-3);
          border-radius: 4px;
          color: var(--ds-text-primary);
          font-weight: 500;
        }

        .improvement-intro {
          margin: 0 0 var(--ds-space-4) 0;
          font-size: 0.95rem;
          color: var(--ds-text-secondary);
        }

        .improvement-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: var(--ds-space-4);
        }

        .improvement-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-left: 3px solid var(--ds-brand);
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
        }

        .improvement-card.highlight {
          border-left-color: #10b981;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
        }

        .improvement-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ds-text-primary);
          margin-bottom: var(--ds-space-2);
        }

        .improvement-from {
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
          margin-bottom: 4px;
        }

        .improvement-to {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--ds-text-primary);
          margin-bottom: var(--ds-space-2);
        }

        .improvement-gain {
          font-size: 1rem;
          font-weight: 600;
          color: var(--ds-brand);
        }

        .improvement-gain.highlight-gain {
          color: #10b981;
        }

        @media (max-width: 768px) {
          .calculator-inputs,
          .calculator-results {
            padding: var(--ds-space-4);
          }

          .inputs-grid {
            grid-template-columns: 1fr;
            gap: var(--ds-space-4);
          }

          .rates-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dropoff-bar-label {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .improvement-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
