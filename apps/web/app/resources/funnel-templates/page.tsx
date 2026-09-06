/**
 * Funnel Templates & Builder Hub
 * Professional funnel templates, sketches, analytics, and interactive builder
 * for designing and optimizing business funnels.
 */

import type { Metadata } from "next";
import { FunnelTemplateGallery } from "../../../components/funnel-builder/FunnelTemplateGallery";
import { FunnelAnalytics } from "../../../components/funnel-builder/FunnelAnalytics";
import { FunnelCanvasBuilder } from "../../../components/funnel-builder/FunnelCanvasBuilder";
import { OptinPageSketch, SalesPageSketch, CheckoutPageSketch, UpsellPageSketch, ThankYouPageSketch } from "../../../components/funnel-builder/FunnelSketches";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Professional Funnel Templates — ONEVYRT",
  description: "Battle-tested funnel templates, interactive builder, and analytics. Design high-converting funnels like ClickFunnels.",
};

export default function FunnelTemplatesPage() {
  return (
    <div className="funnel-templates-page">
      <style>{`
        .funnel-templates-page {
          background: var(--ds-bg-app);
          min-height: 100vh;
        }

        .page-hero {
          background: linear-gradient(135deg, var(--ds-brand) 0%, #0a9e6e 100%);
          color: white;
          padding: 80px 20px;
          text-align: center;
        }

        .hero-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-content h1 {
          font-size: 48px;
          font-weight: 700;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .hero-content p {
          font-size: 18px;
          margin: 0 0 32px 0;
          opacity: 0.95;
          line-height: 1.6;
        }

        .hero-cta {
          display: inline-flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .page-section {
          padding: 80px 20px;
        }

        .section-header {
          max-width: 900px;
          margin: 0 auto 60px;
          text-align: center;
        }

        .section-header h2 {
          font-size: 36px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 16px 0;
        }

        .section-header p {
          font-size: 16px;
          color: var(--ds-text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        .funnel-page-gallery {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 60px;
        }

        .page-sketch-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .page-sketch-card:hover {
          border-color: var(--ds-brand);
          box-shadow: 0 8px 24px rgba(8, 128, 87, 0.12);
          transform: translateY(-4px);
        }

        .page-sketch-preview {
          height: 200px;
          background: var(--ds-bg-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--ds-border-subtle);
          overflow: hidden;
        }

        .page-sketch-preview svg {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .page-sketch-info {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .page-sketch-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0;
        }

        .page-sketch-desc {
          font-size: 12px;
          color: var(--ds-text-secondary);
          margin: 0;
          flex: 1;
          line-height: 1.5;
        }

        .page-sketch-cta {
          display: inline-block;
          padding: 8px 12px;
          background: var(--ds-brand-soft);
          border: 1px solid var(--ds-brand);
          border-radius: 4px;
          color: var(--ds-brand);
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .page-sketch-cta:hover {
          background: var(--ds-brand);
          color: white;
        }

        .optimization-guide {
          max-width: 1200px;
          margin: 0 auto;
        }

        .guide-item {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 32px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: center;
        }

        .guide-item:nth-child(even) {
          grid-template-columns: 1fr 1fr;
        }

        .guide-item:nth-child(even) .guide-content {
          order: 2;
        }

        .guide-item:nth-child(even) .guide-visual {
          order: 1;
        }

        .guide-visual {
          background: var(--ds-bg-subtle);
          border-radius: 8px;
          padding: 24px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .guide-visual svg {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .guide-content h3 {
          font-size: 20px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 12px 0;
        }

        .guide-content p {
          font-size: 14px;
          color: var(--ds-text-secondary);
          margin: 0 0 16px 0;
          line-height: 1.6;
        }

        .improvement-highlights {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .improvement-highlights li {
          font-size: 13px;
          color: var(--ds-text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--ds-bg-subtle);
          border-radius: 4px;
          padding-left: 12px;
        }

        .improvement-highlights li:before {
          content: "✓";
          color: var(--ds-brand);
          font-weight: 700;
          font-size: 14px;
        }

        .expected-results {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .result-metric {
          padding: 12px;
          background: var(--ds-brand-soft);
          border: 1px solid var(--ds-brand);
          border-radius: 4px;
          text-align: center;
        }

        .result-label {
          font-size: 11px;
          color: var(--ds-brand);
          font-weight: 600;
          text-transform: uppercase;
        }

        .result-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--ds-brand);
          margin-top: 4px;
        }

        .quick-start {
          max-width: 1200px;
          margin: 0 auto;
          background: linear-gradient(135deg, var(--ds-brand-soft) 0%, #e7f6f0 100%);
          border: 2px solid var(--ds-brand);
          border-radius: 8px;
          padding: 40px;
        }

        .quick-start h3 {
          font-size: 20px;
          font-weight: 700;
          color: var(--ds-brand);
          margin: 0 0 24px 0;
        }

        .quick-start-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .quick-start-step {
          background: white;
          padding: 20px;
          border-radius: 6px;
          border-left: 4px solid var(--ds-brand);
        }

        .quick-start-step-number {
          display: inline-block;
          width: 32px;
          height: 32px;
          background: var(--ds-brand);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .quick-start-step-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 8px 0;
        }

        .quick-start-step-desc {
          font-size: 12px;
          color: var(--ds-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .hero-content h1 {
            font-size: 32px;
          }

          .hero-content p {
            font-size: 16px;
          }

          .guide-item {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .guide-item:nth-child(even) {
            grid-template-columns: 1fr;
          }

          .guide-item:nth-child(even) .guide-content {
            order: 1;
          }

          .guide-item:nth-child(even) .guide-visual {
            order: 2;
          }

          .funnel-page-gallery {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
        }
      `}</style>

      {/* Hero Section */}
      <div className="page-hero">
        <div className="hero-content">
          <h1>Professional Funnel Templates & Builder</h1>
          <p>
            Design, analyze, and optimize high-converting sales funnels. Choose from proven templates or build your own with our interactive canvas.
          </p>
          <div className="hero-cta">
            <a href="#templates" className="page-sketch-cta">
              Browse Templates
            </a>
            <a href="#builder" className="page-sketch-cta" style={{ background: "white", color: "var(--ds-brand)", border: "1px solid white" }}>
              Use Builder
            </a>
          </div>
        </div>
      </div>

      {/* Template Gallery */}
      <div id="templates" className="page-section">
        <FunnelTemplateGallery />
      </div>

      {/* Funnel Page Sketches */}
      <div className="page-section" style={{ background: "var(--ds-surface)" }}>
        <div className="section-header">
          <h2>Professional Funnel Page Templates</h2>
          <p>
            High-converting page designs. Use these as a starting point for your funnel pages.
          </p>
        </div>

        <div className="funnel-page-gallery">
          <div className="page-sketch-card">
            <div className="page-sketch-preview">
              <OptinPageSketch />
            </div>
            <div className="page-sketch-info">
              <h3 className="page-sketch-title">Opt-in Page</h3>
              <p className="page-sketch-desc">
                Lead magnet capture page with minimal friction and trust signals.
              </p>
              <button className="page-sketch-cta">Use Template</button>
            </div>
          </div>

          <div className="page-sketch-card">
            <div className="page-sketch-preview">
              <SalesPageSketch />
            </div>
            <div className="page-sketch-info">
              <h3 className="page-sketch-title">Sales Page</h3>
              <p className="page-sketch-desc">
                Long-form layout with pain, solution, proof, and strong CTA.
              </p>
              <button className="page-sketch-cta">Use Template</button>
            </div>
          </div>

          <div className="page-sketch-card">
            <div className="page-sketch-preview">
              <CheckoutPageSketch />
            </div>
            <div className="page-sketch-info">
              <h3 className="page-sketch-title">Checkout Page</h3>
              <p className="page-sketch-desc">
                Streamlined payment page with security badges and guarantees.
              </p>
              <button className="page-sketch-cta">Use Template</button>
            </div>
          </div>

          <div className="page-sketch-card">
            <div className="page-sketch-preview">
              <UpsellPageSketch />
            </div>
            <div className="page-sketch-info">
              <h3 className="page-sketch-title">Upsell Page</h3>
              <p className="page-sketch-desc">
                One-click offer with scarcity and compelling value prop.
              </p>
              <button className="page-sketch-cta">Use Template</button>
            </div>
          </div>

          <div className="page-sketch-card">
            <div className="page-sketch-preview">
              <ThankYouPageSketch />
            </div>
            <div className="page-sketch-info">
              <h3 className="page-sketch-title">Thank You Page</h3>
              <p className="page-sketch-desc">
                Confirmation and next steps with engagement hooks.
              </p>
              <button className="page-sketch-cta">Use Template</button>
            </div>
          </div>
        </div>
      </div>

      {/* Optimization Guide */}
      <div className="page-section">
        <div className="section-header">
          <h2>Funnel Optimization Strategies</h2>
          <p>
            See how small improvements at each stage compound into massive conversion gains.
          </p>
        </div>

        <div className="optimization-guide">
          {/* Opt-in Page Optimization */}
          <div className="guide-item">
            <div className="guide-visual">
              <OptinPageSketch />
            </div>
            <div className="guide-content">
              <h3>Optimize Your Opt-in Page</h3>
              <p>
                Your opt-in page is the gateway to your funnel. Even small improvements here
                have massive downstream impact.
              </p>
              <ul className="improvement-highlights">
                <li>Add social proof (testimonials, customer count)</li>
                <li>Reduce form fields to 3 or fewer</li>
                <li>Add urgency messaging ("Only 10 spots left")</li>
                <li>Create a compelling value proposition</li>
                <li>Use contrasting CTA button colors</li>
              </ul>
              <div className="expected-results">
                <div className="result-metric">
                  <div className="result-label">Avg Lift</div>
                  <div className="result-value">+22%</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Time to Test</div>
                  <div className="result-value">3 days</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Difficulty</div>
                  <div className="result-value">Easy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Page Optimization */}
          <div className="guide-item">
            <div className="guide-content">
              <h3>Improve Sales Page Conversions</h3>
              <p>
                Your sales page convinces people to buy. Optimize these elements to dramatically
                increase conversion rates.
              </p>
              <ul className="improvement-highlights">
                <li>Lead with the biggest benefit in the headline</li>
                <li>Add case studies and results (before/after)</li>
                <li>Include scarcity elements (limited time, limited spots)</li>
                <li>Add money-back guarantee prominently</li>
                <li>Test multiple CTA button copy variations</li>
              </ul>
              <div className="expected-results">
                <div className="result-metric">
                  <div className="result-label">Avg Lift</div>
                  <div className="result-value">+35%</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Time to Test</div>
                  <div className="result-value">5 days</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Difficulty</div>
                  <div className="result-value">Medium</div>
                </div>
              </div>
            </div>
            <div className="guide-visual">
              <SalesPageSketch />
            </div>
          </div>

          {/* Checkout Optimization */}
          <div className="guide-item">
            <div className="guide-visual">
              <CheckoutPageSketch />
            </div>
            <div className="guide-content">
              <h3>Reduce Checkout Friction</h3>
              <p>
                Cart abandonment is the #1 conversion killer. Minimize friction and maximize
                trust to capture lost revenue.
              </p>
              <ul className="improvement-highlights">
                <li>Remove unnecessary form fields</li>
                <li>Show security badges and certifications</li>
                <li>Add exit-intent offers to prevent abandonment</li>
                <li>Enable guest checkout (no account required)</li>
                <li>Show multiple payment options</li>
              </ul>
              <div className="expected-results">
                <div className="result-metric">
                  <div className="result-label">Avg Lift</div>
                  <div className="result-value">+18%</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Time to Test</div>
                  <div className="result-value">2 days</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Difficulty</div>
                  <div className="result-value">Easy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upsell Optimization */}
          <div className="guide-item">
            <div className="guide-content">
              <h3>Maximize Upsell Revenue</h3>
              <p>
                Upsells happen immediately after purchase when customers are most receptive.
                Make your offer irresistible.
              </p>
              <ul className="improvement-highlights">
                <li>Offer a complementary (not competing) product</li>
                <li>Use one-click purchase for instant activation</li>
                <li>Add special bundle pricing (show savings)</li>
                <li>Highlight the unique benefit of the upsell</li>
                <li>Make "No thanks" button less prominent</li>
              </ul>
              <div className="expected-results">
                <div className="result-metric">
                  <div className="result-label">Avg Lift</div>
                  <div className="result-value">+42%</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Time to Test</div>
                  <div className="result-value">3 days</div>
                </div>
                <div className="result-metric">
                  <div className="result-label">Difficulty</div>
                  <div className="result-value">Medium</div>
                </div>
              </div>
            </div>
            <div className="guide-visual">
              <UpsellPageSketch />
            </div>
          </div>
        </div>
      </div>

      {/* Funnel Analytics Section */}
      <div className="page-section" style={{ background: "var(--ds-surface)" }}>
        <FunnelAnalytics showRevenue={true} />
      </div>

      {/* Interactive Builder */}
      <div id="builder" className="page-section">
        <FunnelCanvasBuilder editable={true} />
      </div>

      {/* Quick Start Guide */}
      <div className="page-section">
        <div className="section-header">
          <h2>Quick Start: Build Your Funnel in 3 Steps</h2>
        </div>

        <div className="quick-start">
          <h3>How to Use These Templates</h3>
          <div className="quick-start-steps">
            <div className="quick-start-step">
              <div className="quick-start-step-number">1</div>
              <h4 className="quick-start-step-title">Choose a Template</h4>
              <p className="quick-start-step-desc">
                Pick from 5 proven funnel architectures based on your business type and goals.
              </p>
            </div>
            <div className="quick-start-step">
              <div className="quick-start-step-number">2</div>
              <h4 className="quick-start-step-title">Customize Pages</h4>
              <p className="quick-start-step-desc">
                Use professional page sketches as your starting point. Adapt copy, messaging, and offers to your audience.
              </p>
            </div>
            <div className="quick-start-step">
              <div className="quick-start-step-number">3</div>
              <h4 className="quick-start-step-title">Test & Optimize</h4>
              <p className="quick-start-step-desc">
                Use the analytics builder to identify bottlenecks. A/B test improvements and track conversion gains.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
