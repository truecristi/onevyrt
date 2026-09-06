"use client";
/**
 * BestPractices — Key strategies for optimizing funnel performance
 */
import { useState } from "react";

interface BestPractice {
  id: string;
  title: string;
  description: string;
  icon: string;
  metrics: string;
  tips: string[];
}

const BEST_PRACTICES: BestPractice[] = [
  {
    id: "clarity",
    title: "Clarity at Every Stage",
    description: "Make your value proposition crystal clear. People should instantly understand what you do and why they should care.",
    icon: "🎯",
    metrics: "2-3 second understanding",
    tips: [
      "One clear headline that speaks to their problem",
      "Show the before/after of using your product",
      "Use numbers and specifics, not vague claims",
      "Highlight your unique advantage",
    ],
  },
  {
    id: "friction",
    title: "Remove Friction",
    description: "Every extra click, form field, or unclear instruction costs you conversions. Simplify ruthlessly.",
    icon: "⚡",
    metrics: "3-5% conversion increase per friction removed",
    tips: [
      "One-click signup options",
      "Pre-fill known information",
      "Show progress in multi-step forms",
      "Mobile-first design",
    ],
  },
  {
    id: "trust",
    title: "Build Trust",
    description: "People buy from people and companies they trust. Show proof, credentials, and social proof.",
    icon: "🤝",
    metrics: "40-50% higher conversion with trust signals",
    tips: [
      "Customer testimonials and case studies",
      "Social proof (logos, ratings, counts)",
      "Money-back guarantees",
      "Security badges and certifications",
    ],
  },
  {
    id: "timing",
    title: "Right Message, Right Time",
    description: "Tailor your messaging based on where someone is in their buying journey. Awareness-stage buyers need different content than decision-stage buyers.",
    icon: "⏰",
    metrics: "5x higher engagement with targeted messaging",
    tips: [
      "Educational content for awareness stage",
      "Comparison and ROI content for consideration",
      "Case studies and pricing for decision stage",
      "Onboarding and success content for retention",
    ],
  },
  {
    id: "testing",
    title: "Test Everything",
    description: "The small improvements compound. Test headlines, CTAs, colors, copy, images, and flows.",
    icon: "🧪",
    metrics: "10-20% improvement per tested element",
    tips: [
      "A/B test one element at a time",
      "Run tests for at least 100 conversions",
      "Test the highest-impact elements first",
      "Document what works and why",
    ],
  },
  {
    id: "speed",
    title: "Speed Matters",
    description: "Slow pages lose customers. Every 100ms delay = 1% drop in conversions.",
    icon: "🚀",
    metrics: "1% conversion loss per 100ms delay",
    tips: [
      "Optimize images and videos",
      "Minimize third-party scripts",
      "Use CDN for global delivery",
      "Cache aggressively",
    ],
  },
];

export function BestPractices() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="best-practices-container">
      <div className="best-practices-grid">
        {BEST_PRACTICES.map((practice) => (
          <div
            key={practice.id}
            className="best-practice-card"
            onClick={() =>
              setExpandedId(expandedId === practice.id ? null : practice.id)
            }
          >
            <div className="practice-header">
              <span className="practice-icon">{practice.icon}</span>
              <h3>{practice.title}</h3>
            </div>

            <p className="practice-description">{practice.description}</p>

            <div className="practice-metrics">
              <span className="metrics-label">Impact:</span>
              <span className="metrics-value">{practice.metrics}</span>
            </div>

            {expandedId === practice.id && (
              <div className="practice-tips">
                <div className="tips-label">Key Tips:</div>
                <ul className="tips-list">
                  {practice.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="practice-cta">
              {expandedId === practice.id ? "Hide tips" : "Show tips"}
            </div>
          </div>
        ))}
      </div>

      <div className="practices-summary">
        <h3>The Funnel Optimization Framework</h3>
        <div className="summary-steps">
          <div className="summary-step">
            <div className="step-number">1</div>
            <div className="step-label">Measure</div>
            <div className="step-desc">Know your current conversion rates at each stage</div>
          </div>
          <div className="summary-step">
            <div className="step-number">2</div>
            <div className="step-label">Identify</div>
            <div className="step-desc">Find your biggest leak (lowest conversion rate)</div>
          </div>
          <div className="summary-step">
            <div className="step-number">3</div>
            <div className="step-label">Optimize</div>
            <div className="step-desc">Test small improvements at that stage</div>
          </div>
          <div className="summary-step">
            <div className="step-number">4</div>
            <div className="step-label">Repeat</div>
            <div className="step-desc">Move to the next biggest leak and optimize</div>
          </div>
        </div>
      </div>

      <style>{`
        .best-practices-container {
          width: 100%;
        }

        .best-practices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
        }

        .best-practice-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .best-practice-card:hover {
          border-color: var(--ds-border-default);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .practice-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .practice-icon {
          font-size: 1.8rem;
        }

        .practice-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .practice-description {
          margin: 12px 0;
          font-size: 0.95rem;
          color: var(--ds-text-secondary);
          line-height: 1.6;
        }

        .practice-metrics {
          display: flex;
          gap: 8px;
          margin: 16px 0;
          padding: 12px;
          background: var(--ds-brand-soft);
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .metrics-label {
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .metrics-value {
          color: var(--ds-brand);
          font-weight: 500;
        }

        .practice-tips {
          margin: 16px 0;
          padding-top: 16px;
          border-top: 1px solid var(--ds-border-subtle);
        }

        .tips-label {
          font-weight: 600;
          color: var(--ds-text-primary);
          margin-bottom: 12px;
          display: block;
          font-size: 0.9rem;
        }

        .tips-list {
          margin: 0;
          padding-left: 20px;
          list-style: none;
        }

        .tips-list li {
          margin: 8px 0;
          color: var(--ds-text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
          position: relative;
          padding-left: 12px;
        }

        .tips-list li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: var(--ds-brand);
          font-weight: bold;
        }

        .practice-cta {
          color: var(--ds-brand);
          font-weight: 500;
          font-size: 0.85rem;
          margin-top: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .practices-summary {
          background: var(--ds-brand-soft);
          border: 1px solid var(--ds-brand);
          border-radius: 8px;
          padding: 32px;
          margin-top: 32px;
        }

        .practices-summary h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 24px 0;
          color: var(--ds-text-primary);
        }

        .summary-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .summary-step {
          text-align: center;
        }

        .step-number {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--ds-brand);
          margin-bottom: 8px;
        }

        .step-label {
          font-weight: 600;
          color: var(--ds-text-primary);
          font-size: 1rem;
          display: block;
          margin-bottom: 4px;
        }

        .step-desc {
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .best-practices-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .practices-summary {
            padding: 20px;
          }

          .summary-steps {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}
