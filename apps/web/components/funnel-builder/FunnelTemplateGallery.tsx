/**
 * Professional funnel template gallery.
 * Showcases 5 proven funnel types with metrics, use cases, and "use template" actions.
 */
"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import {
  WebinarFunnelSketch,
  ProductLaunchFunnelSketch,
  OptinPageSketch,
} from "./FunnelSketches";

export interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  sketch: React.ReactNode;
  steps: {
    name: string;
    icon: string;
    conversion: number;
  }[];
  typicalMetrics: {
    avgConversionRate: number;
    avgOrderValue: number;
    avgCustomerLTV: number;
  };
  useCases: string[];
  bestFor: string;
  timeToSetup: string;
}

const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: "webinar",
    name: "Webinar Funnel",
    description: "Proven funnel for high-ticket coaching, courses, and consulting services.",
    sketch: <WebinarFunnelSketch />,
    steps: [
      { name: "Opt-in Page", icon: "📝", conversion: 65 },
      { name: "Webinar", icon: "🎥", conversion: 42 },
      { name: "Sales Page", icon: "💼", conversion: 27 },
      { name: "Upsell", icon: "🚀", conversion: 31 },
      { name: "Member Access", icon: "🔐", conversion: 100 },
    ],
    typicalMetrics: {
      avgConversionRate: 0.27,
      avgOrderValue: 4997,
      avgCustomerLTV: 6594,
    },
    useCases: [
      "Coaching programs ($3K-$10K)",
      "Online courses (high-ticket)",
      "Consulting services",
      "Membership programs",
      "Certification courses",
    ],
    bestFor: "Service providers and coaches",
    timeToSetup: "2-3 weeks",
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "High-conversion funnel for SaaS, digital products, and software launches.",
    sketch: <ProductLaunchFunnelSketch />,
    steps: [
      { name: "Lead Gen", icon: "🎁", conversion: 100 },
      { name: "Demo Video", icon: "🎬", conversion: 48 },
      { name: "Application", icon: "📋", conversion: 28 },
      { name: "Close Call", icon: "☎️", conversion: 55 },
      { name: "Upsell", icon: "⭐", conversion: 43 },
    ],
    typicalMetrics: {
      avgConversionRate: 0.43,
      avgOrderValue: 2500,
      avgCustomerLTV: 5200,
    },
    useCases: [
      "SaaS products",
      "Digital software",
      "High-ticket digital products",
      "B2B services",
      "Software-as-a-service",
    ],
    bestFor: "Software and digital product companies",
    timeToSetup: "3-4 weeks",
  },
  {
    id: "high-ticket",
    name: "High-Ticket Sales",
    description: "Premium funnel for $10K+ offers with deep qualification and value stacking.",
    sketch: <ProductLaunchFunnelSketch />,
    steps: [
      { name: "Discovery Call", icon: "🤝", conversion: 100 },
      { name: "Qualification", icon: "✅", conversion: 60 },
      { name: "Presentation", icon: "📊", conversion: 45 },
      { name: "Close", icon: "🎯", conversion: 75 },
      { name: "Value Stacking", icon: "🏆", conversion: 55 },
    ],
    typicalMetrics: {
      avgConversionRate: 0.75,
      avgOrderValue: 15000,
      avgCustomerLTV: 45000,
    },
    useCases: [
      "Enterprise consulting",
      "Agency retainers",
      "Mastermind groups",
      "VIP coaching",
      "Premium implementations",
    ],
    bestFor: "Premium service providers",
    timeToSetup: "1-2 weeks",
  },
  {
    id: "ecommerce",
    name: "Ecommerce Funnel",
    description: "Fast-converting funnel for physical products, dropshipping, and digital goods.",
    sketch: <ProductLaunchFunnelSketch />,
    steps: [
      { name: "Product Page", icon: "🛍️", conversion: 100 },
      { name: "Add to Cart", icon: "🛒", conversion: 18 },
      { name: "Checkout", icon: "💳", conversion: 82 },
      { name: "Order Confirm", icon: "✓", conversion: 100 },
      { name: "Post-Purchase", icon: "📦", conversion: 35 },
    ],
    typicalMetrics: {
      avgConversionRate: 0.05,
      avgOrderValue: 85,
      avgCustomerLTV: 180,
    },
    useCases: [
      "Physical products",
      "Dropshipping",
      "Digital downloads",
      "Bundles and packages",
      "Limited edition offerings",
    ],
    bestFor: "E-commerce and retail",
    timeToSetup: "1 week",
  },
  {
    id: "membership",
    name: "Membership Funnel",
    description: "Recurring revenue funnel for membership sites, communities, and subscription services.",
    sketch: <OptinPageSketch />,
    steps: [
      { name: "Free Content", icon: "📚", conversion: 100 },
      { name: "Opt-in", icon: "📧", conversion: 35 },
      { name: "Sales Page", icon: "💎", conversion: 28 },
      { name: "Payment", icon: "💰", conversion: 100 },
      { name: "Member Portal", icon: "🔑", conversion: 100 },
    ],
    typicalMetrics: {
      avgConversionRate: 0.28,
      avgOrderValue: 297,
      avgCustomerLTV: 2970,
    },
    useCases: [
      "Membership communities",
      "Subscription services",
      "Recurring coaching",
      "Content platforms",
      "Exclusive networks",
    ],
    bestFor: "Community and content creators",
    timeToSetup: "2 weeks",
  },
];

export function FunnelTemplateGallery() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const selected = selectedTemplate
    ? FUNNEL_TEMPLATES.find((t) => t.id === selectedTemplate)
    : null;

  return (
    <div className="funnel-template-gallery">
      <style>{`
        .funnel-template-gallery {
          padding: 40px 20px;
          background: var(--ds-bg-app);
        }

        .gallery-header {
          max-width: 1200px;
          margin: 0 auto 60px;
          text-align: center;
        }

        .gallery-header h2 {
          font-size: 32px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 12px 0;
        }

        .gallery-header p {
          font-size: 16px;
          color: var(--ds-text-secondary);
          margin: 0;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .templates-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 60px;
        }

        .template-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .template-card:hover {
          border-color: var(--ds-brand);
          box-shadow: 0 4px 12px rgba(8, 128, 87, 0.1);
          transform: translateY(-2px);
        }

        .template-card.active {
          border-color: var(--ds-brand);
          background: var(--ds-brand-soft);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .card-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .card-title {
          flex: 1;
        }

        .card-title h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 4px 0;
        }

        .card-title p {
          font-size: 12px;
          color: var(--ds-text-tertiary);
          margin: 0;
        }

        .template-metrics {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: var(--ds-bg-subtle);
          border-radius: 4px;
          font-size: 12px;
        }

        .template-metrics .metric {
          flex: 1;
          text-align: center;
        }

        .template-metrics .metric-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--ds-brand);
        }

        .template-metrics .metric-label {
          color: var(--ds-text-tertiary);
          font-size: 11px;
          margin-top: 2px;
        }

        .template-description {
          font-size: 13px;
          color: var(--ds-text-secondary);
          margin: 0;
        }

        .use-cases-preview {
          font-size: 12px;
          color: var(--ds-text-tertiary);
          line-height: 1.6;
        }

        .use-cases-preview strong {
          display: block;
          color: var(--ds-text-primary);
          font-weight: 600;
          margin-bottom: 4px;
        }

        .card-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
        }

        .card-actions button {
          flex: 1;
        }

        .detail-view {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px;
          background: var(--ds-surface);
          border-radius: 8px;
          border: 1px solid var(--ds-border-subtle);
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 40px;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .detail-icon {
          font-size: 64px;
        }

        .detail-info h2 {
          font-size: 28px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 8px 0;
        }

        .detail-info p {
          font-size: 14px;
          color: var(--ds-text-secondary);
          margin: 0 0 16px 0;
        }

        .detail-meta {
          display: flex;
          gap: 24px;
          font-size: 13px;
        }

        .detail-meta-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-meta-label {
          color: var(--ds-text-tertiary);
          font-weight: 500;
        }

        .detail-meta-value {
          color: var(--ds-text-primary);
          font-weight: 600;
        }

        .detail-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }

        .detail-section h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 16px 0;
        }

        .detail-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-section li {
          font-size: 13px;
          color: var(--ds-text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .detail-section li:before {
          content: "✓";
          color: var(--ds-brand);
          font-weight: 700;
        }

        .detail-sketch {
          margin: 40px 0;
          padding: 40px;
          background: var(--ds-bg-subtle);
          border-radius: 8px;
          overflow-x: auto;
        }

        .detail-sketch svg {
          width: 100%;
          height: auto;
        }

        .detail-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 24px;
        }

        .step-card {
          padding: 16px;
          background: var(--ds-bg-subtle);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 4px;
          text-align: center;
        }

        .step-card .icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .step-card .name {
          font-size: 12px;
          font-weight: 600;
          color: var(--ds-text-primary);
          margin-bottom: 4px;
        }

        .step-card .conversion {
          font-size: 14px;
          font-weight: 700;
          color: var(--ds-brand);
        }

        .detail-cta {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 24px;
          background: var(--ds-bg-subtle);
          border-radius: 8px;
          margin-bottom: 40px;
        }

        .detail-cta-content {
          flex: 1;
        }

        .detail-cta-content h4 {
          font-size: 14px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 4px 0;
        }

        .detail-cta-content p {
          font-size: 12px;
          color: var(--ds-text-secondary);
          margin: 0;
        }

        .close-button {
          margin-top: 40px;
          padding: 12px 24px;
          background: var(--ds-bg-subtle);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: var(--ds-text-primary);
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: var(--ds-border-subtle);
        }

        @media (max-width: 768px) {
          .detail-content {
            grid-template-columns: 1fr;
          }

          .detail-header {
            flex-direction: column;
            gap: 16px;
          }

          .detail-cta {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="gallery-header">
        <h2>Proven Funnel Templates</h2>
        <p>
          Choose from 5 battle-tested funnel architectures. Each template shows
          typical conversions, metrics, and best-use cases.
        </p>
      </div>

      {!selected ? (
        <div className="templates-grid">
          {FUNNEL_TEMPLATES.map((template) => {
            const icon = template.steps[0]?.icon || "📊";
            return (
              <div
                key={template.id}
                className="template-card"
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="card-header">
                  <div className="card-icon">{icon}</div>
                  <div className="card-title">
                    <h3>{template.name}</h3>
                    <p>{template.bestFor}</p>
                  </div>
                </div>

                <p className="template-description">{template.description}</p>

                <div className="template-metrics">
                  <div className="metric">
                    <div className="metric-value">
                      {(template.typicalMetrics.avgConversionRate * 100).toFixed(0)}%
                    </div>
                    <div className="metric-label">Conv. Rate</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">
                      ${(template.typicalMetrics.avgOrderValue / 1000).toFixed(1)}K
                    </div>
                    <div className="metric-label">Order Value</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">
                      ${(template.typicalMetrics.avgCustomerLTV / 1000).toFixed(1)}K
                    </div>
                    <div className="metric-label">Customer LTV</div>
                  </div>
                </div>

                <div className="use-cases-preview">
                  <strong>Best for:</strong>
                  {template.useCases.slice(0, 2).join(" • ")}
                </div>

                <div className="card-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplate(template.id);
                    }}
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="detail-view">
          <div className="detail-header">
            <div className="detail-icon">{selected.steps[0]?.icon || "📊"}</div>
            <div className="detail-info" style={{ flex: 1 }}>
              <h2>{selected.name}</h2>
              <p>{selected.description}</p>
              <div className="detail-meta">
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Setup Time</span>
                  <span className="detail-meta-value">{selected.timeToSetup}</span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Avg Conversion Rate</span>
                  <span className="detail-meta-value">
                    {(selected.typicalMetrics.avgConversionRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Avg Order Value</span>
                  <span className="detail-meta-value">
                    ${selected.typicalMetrics.avgOrderValue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-content">
            <div className="detail-section">
              <h3>Use Cases</h3>
              <ul>
                {selected.useCases.map((useCase, i) => (
                  <li key={i}>{useCase}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Funnel Stages</h3>
              <ul>
                {selected.steps.map((step, i) => (
                  <li key={i}>
                    {step.icon} {step.name} ({step.conversion}%)
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="detail-sketch">{selected.sketch}</div>

          <div className="detail-steps">
            {selected.steps.map((step, i) => (
              <div key={i} className="step-card">
                <div className="icon">{step.icon}</div>
                <div className="name">{step.name}</div>
                <div className="conversion">{step.conversion}%</div>
              </div>
            ))}
          </div>

          <div className="detail-cta">
            <div className="detail-cta-content">
              <h4>Ready to use this template?</h4>
              <p>
                Customize this funnel structure with your content and messaging
              </p>
            </div>
            <Button variant="primary">Use This Template</Button>
          </div>

          <button
            className="close-button"
            onClick={() => setSelectedTemplate(null)}
          >
            ← Back to Templates
          </button>
        </div>
      )}
    </div>
  );
}
