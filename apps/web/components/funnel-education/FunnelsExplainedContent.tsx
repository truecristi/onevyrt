"use client";
/**
 * Funnel Education Hub — page content. Extracted into its own Client
 * Component because it uses `<style jsx>` (styled-jsx), which only works in a
 * Client Component — the parent `page.tsx` stays a Server Component and just
 * renders this. styled-jsx's scoping rewrites classnames on elements within
 * the same component function that declares `<style jsx>`, so the styled
 * markup and the `<style jsx>` block must live together here, not split
 * across a server parent and a client child.
 */
import { FunnelVisualizer } from "./FunnelVisualizer";
import { TrafficFlow } from "./TrafficFlow";
import { DropoffAnalysis } from "./DropoffAnalysis";
import { FunnelCalculator } from "./FunnelCalculator";
import { BestPractices } from "./BestPractices";

export function FunnelsExplainedContent() {
  return (
    <div className="funnel-education-page">
      {/* Hero Section */}
      <div className="funnel-hero">
        <div className="funnel-hero-content">
          <h1>How Sales Funnels Work</h1>
          <p className="funnel-hero-subtitle">
            Understand traffic flow, conversion stages, and where your business loses customers
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="funnel-nav">
        <a href="#what-is-funnel" className="funnel-nav-link">What is a Funnel?</a>
        <a href="#stages" className="funnel-nav-link">Funnel Stages</a>
        <a href="#traffic-flow" className="funnel-nav-link">Traffic Flow</a>
        <a href="#dropoffs" className="funnel-nav-link">Where You Drop Off</a>
        <a href="#calculator" className="funnel-nav-link">Calculate Yours</a>
        <a href="#best-practices" className="funnel-nav-link">Best Practices</a>
      </nav>

      {/* What is a Funnel */}
      <section id="what-is-funnel" className="funnel-section">
        <div className="funnel-section-content">
          <h2>What is a Sales Funnel?</h2>
          <p>
            A sales funnel is the journey your customer takes from first hearing about you to becoming
            a loyal, repeat customer. Think of it like a physical funnel: wide at the top (lots of people
            entering) and narrower at the bottom (fewer people who actually purchase).
          </p>
          <p>
            Every person who interacts with your business starts at the top of your funnel. As they
            move through each stage, some continue forward, but many drop off. Your job is to understand
            where people leave and why.
          </p>

          <div className="funnel-cards-grid">
            <div className="funnel-card">
              <div className="funnel-card-icon">📊</div>
              <h3>Why Funnels Matter</h3>
              <p>Most businesses don't know where they lose customers. Understanding your funnel reveals your biggest opportunity for growth.</p>
            </div>
            <div className="funnel-card">
              <div className="funnel-card-icon">🔄</div>
              <h3>Conversion is the Goal</h3>
              <p>Each stage converts a percentage of people to the next. Small improvements at each stage compound into massive growth.</p>
            </div>
            <div className="funnel-card">
              <div className="funnel-card-icon">💰</div>
              <h3>Revenue Growth Happens Here</h3>
              <p>You don't need more traffic. You need fewer leaks. Fixing your funnel is cheaper than acquiring new customers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Funnel Stages */}
      <section id="stages" className="funnel-section">
        <div className="funnel-section-content">
          <h2>The Four Stages of a Funnel</h2>
          <FunnelVisualizer />
        </div>
      </section>

      {/* Traffic Flow */}
      <section id="traffic-flow" className="funnel-section">
        <div className="funnel-section-content">
          <h2>How Traffic Flows Through Your Funnel</h2>
          <TrafficFlow />
        </div>
      </section>

      {/* Dropoff Analysis */}
      <section id="dropoffs" className="funnel-section">
        <div className="funnel-section-content">
          <h2>Where Businesses Typically Drop Off</h2>
          <DropoffAnalysis />
        </div>
      </section>

      {/* ONEVYRT Funnel Example */}
      <section className="funnel-section funnel-section-accent">
        <div className="funnel-section-content">
          <h2>How ONEVYRT's Funnel Works</h2>
          <p className="funnel-section-intro">
            Here's a real example of a four-stage funnel in action:
          </p>

          <div className="onevyrt-funnel-example">
            <div className="onevyrt-stage awareness">
              <div className="stage-badge">Stage 1</div>
              <h3>Awareness</h3>
              <p className="stage-label">Discovery & Marketing</p>
              <div className="stage-details">
                <p><strong>How you reach them:</strong> Blog posts, LinkedIn ads, referrals, organic search</p>
                <p><strong>Your goal:</strong> Get in front of the right business owners</p>
                <p><strong>Metrics:</strong> Impressions, clicks, visitors</p>
                <p><strong>Typical drop-off:</strong> 95% of people scrolling don't read further</p>
              </div>
            </div>

            <div className="onevyrt-stage consideration">
              <div className="stage-badge">Stage 2</div>
              <h3>Consideration</h3>
              <p className="stage-label">Learning & Evaluation</p>
              <div className="stage-details">
                <p><strong>How they evaluate you:</strong> Free trial access, discovery call, demo video</p>
                <p><strong>Your goal:</strong> Build trust and show how you're different</p>
                <p><strong>Metrics:</strong> Sign-ups, email opens, call bookings</p>
                <p><strong>Typical drop-off:</strong> 75% book a call but don't show up</p>
              </div>
            </div>

            <div className="onevyrt-stage decision">
              <div className="stage-badge">Stage 3</div>
              <h3>Decision</h3>
              <p className="stage-label">Purchase & Enrollment</p>
              <div className="stage-details">
                <p><strong>How they commit:</strong> Sign contract, make first payment, enroll in programme</p>
                <p><strong>Your goal:</strong> Remove friction and make the offer irresistible</p>
                <p><strong>Metrics:</strong> Conversions, average deal size, close rate</p>
                <p><strong>Typical drop-off:</strong> 50% see pricing and abandon</p>
              </div>
            </div>

            <div className="onevyrt-stage retention">
              <div className="stage-badge">Stage 4</div>
              <h3>Retention</h3>
              <p className="stage-label">Delivery & Growth</p>
              <div className="stage-details">
                <p><strong>How you keep them:</strong> Complete chapters, coach guidance, visible results</p>
                <p><strong>Your goal:</strong> Deliver on your promise and build a advocate</p>
                <p><strong>Metrics:</strong> Completion rate, NPS, repeat purchases, referrals</p>
                <p><strong>Typical drop-off:</strong> 30% churn if onboarding isn't excellent</p>
              </div>
            </div>
          </div>

          <div className="onevyrt-funnel-math">
            <h3>The Math of ONEVYRT's Funnel</h3>
            <div className="funnel-math-row">
              <div className="math-stat">
                <div className="math-number">10,000</div>
                <div className="math-label">People see ONEVYRT (Awareness)</div>
              </div>
              <div className="math-arrow">→</div>
              <div className="math-stat">
                <div className="math-number">500</div>
                <div className="math-label">Join free trial (5%)</div>
              </div>
              <div className="math-arrow">→</div>
              <div className="math-stat">
                <div className="math-number">100</div>
                <div className="math-label">Book a call (20%)</div>
              </div>
            </div>
            <div className="funnel-math-row">
              <div className="math-stat">
                <div className="math-number">50</div>
                <div className="math-label">Enroll in programme (50%)</div>
              </div>
              <div className="math-arrow">→</div>
              <div className="math-stat">
                <div className="math-number">40</div>
                <div className="math-label">Complete the journey (80%)</div>
              </div>
              <div className="math-arrow">→</div>
              <div className="math-stat">
                <div className="math-number">20</div>
                <div className="math-label">Refer others (50% advocacy)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className="funnel-section">
        <div className="funnel-section-content">
          <h2>Calculate Your Funnel</h2>
          <p className="funnel-section-intro">
            Enter your numbers to find your biggest leak and biggest opportunity:
          </p>
          <FunnelCalculator />
        </div>
      </section>

      {/* Best Practices */}
      <section id="best-practices" className="funnel-section">
        <div className="funnel-section-content">
          <BestPractices />
        </div>
      </section>

      {/* CTA Section */}
      <section className="funnel-section funnel-cta-section">
        <div className="funnel-section-content">
          <h2>Ready to Fix Your Funnel?</h2>
          <p>
            The ONEVYRT Programme walks you through finding your biggest constraint,
            improving conversion at each stage, and building a 90-day plan to scale.
          </p>
          <div className="funnel-cta-buttons">
            <a href="/auth?mode=signup" className="funnel-btn funnel-btn-primary">
              Start Free
            </a>
            <a href="/community" className="funnel-btn funnel-btn-secondary">
              See Examples
            </a>
          </div>
        </div>
      </section>

      <style jsx>{`
        .funnel-education-page {
          width: 100%;
          background: var(--ds-bg-app);
          color: var(--ds-text-primary);
          font-family: var(--ds-font);
        }

        .funnel-hero {
          background: linear-gradient(135deg, #088057 0%, #077049 100%);
          color: white;
          padding: 80px var(--ds-space-6) 60px;
          text-align: center;
        }

        .funnel-hero-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .funnel-hero h1 {
          font-size: 3rem;
          font-weight: 700;
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }

        .funnel-hero-subtitle {
          font-size: 1.25rem;
          font-weight: 400;
          margin: 0;
          opacity: 0.95;
          line-height: 1.6;
        }

        .funnel-nav {
          display: flex;
          gap: var(--ds-space-4);
          padding: var(--ds-space-6);
          overflow-x: auto;
          background: var(--ds-surface);
          border-bottom: 1px solid var(--ds-border-subtle);
          justify-content: center;
          flex-wrap: wrap;
        }

        .funnel-nav-link {
          padding: var(--ds-space-2) var(--ds-space-4);
          text-decoration: none;
          color: var(--ds-text-secondary);
          font-weight: 500;
          font-size: 0.95rem;
          transition: color var(--ds-dur-hover);
          white-space: nowrap;
        }

        .funnel-nav-link:hover {
          color: var(--ds-brand);
        }

        .funnel-section {
          padding: 60px var(--ds-space-6);
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .funnel-section:last-child {
          border-bottom: none;
        }

        .funnel-section-accent {
          background: linear-gradient(180deg, var(--ds-brand-soft) 0%, var(--ds-bg-app) 100%);
        }

        .funnel-section-content {
          max-width: 1000px;
          margin: 0 auto;
        }

        .funnel-section h2 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 24px 0;
          color: var(--ds-text-primary);
        }

        .funnel-section-intro {
          font-size: 1.1rem;
          color: var(--ds-text-secondary);
          line-height: 1.6;
          margin: 0 0 32px 0;
        }

        .funnel-section p {
          font-size: 1rem;
          color: var(--ds-text-secondary);
          line-height: 1.7;
          margin: 0 0 16px 0;
        }

        .funnel-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--ds-space-6);
          margin: 40px 0;
        }

        .funnel-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          text-align: center;
          transition: all var(--ds-dur-hover);
          box-shadow: var(--ds-shadow-sm);
        }

        .funnel-card:hover {
          border-color: var(--ds-border-default);
          box-shadow: var(--ds-shadow-md);
          transform: translateY(-2px);
        }

        .funnel-card-icon {
          font-size: 2.5rem;
          margin-bottom: var(--ds-space-4);
        }

        .funnel-card h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: var(--ds-text-primary);
        }

        .funnel-card p {
          margin: 0;
          font-size: 0.95rem;
          color: var(--ds-text-secondary);
        }

        .onevyrt-funnel-example {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--ds-space-6);
          margin: 40px 0;
        }

        .onevyrt-stage {
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          color: white;
          position: relative;
          overflow: hidden;
        }

        .onevyrt-stage::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.1;
          z-index: 0;
        }

        .onevyrt-stage > * {
          position: relative;
          z-index: 1;
        }

        .onevyrt-stage.awareness {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .onevyrt-stage.consideration {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .onevyrt-stage.decision {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .onevyrt-stage.retention {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }

        .stage-badge {
          display: inline-block;
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: var(--ds-space-3);
        }

        .onevyrt-stage h3 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .stage-label {
          font-size: 0.95rem;
          opacity: 0.9;
          margin: 0 0 16px 0;
          font-weight: 500;
        }

        .stage-details {
          font-size: 0.9rem;
          opacity: 0.95;
          line-height: 1.6;
        }

        .stage-details p {
          margin: 12px 0;
          color: inherit;
          font-size: 0.9rem;
        }

        .stage-details strong {
          font-weight: 600;
          display: inline-block;
          margin-bottom: 4px;
        }

        .onevyrt-funnel-math {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          margin: 40px 0;
        }

        .onevyrt-funnel-math h3 {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0 0 24px 0;
          color: var(--ds-text-primary);
        }

        .funnel-math-row {
          display: flex;
          gap: var(--ds-space-4);
          align-items: center;
          margin-bottom: var(--ds-space-6);
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .funnel-math-row:last-child {
          margin-bottom: 0;
        }

        .math-stat {
          flex: 0 0 auto;
          background: linear-gradient(135deg, var(--ds-brand-soft) 0%, #e7f6f0 100%);
          border-radius: var(--ds-radius-md);
          padding: var(--ds-space-4);
          text-align: center;
          min-width: 140px;
          border: 1px solid var(--ds-border-subtle);
        }

        .math-number {
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--ds-brand);
          line-height: 1;
          margin-bottom: 4px;
        }

        .math-label {
          font-size: 0.8rem;
          color: var(--ds-text-secondary);
          font-weight: 500;
        }

        .math-arrow {
          flex: 0 0 auto;
          font-size: 1.5rem;
          color: var(--ds-border-default);
          font-weight: 300;
        }

        .funnel-cta-section {
          text-align: center;
          background: linear-gradient(180deg, var(--ds-brand-soft) 0%, var(--ds-bg-app) 100%);
        }

        .funnel-cta-section p {
          font-size: 1.1rem;
          color: var(--ds-text-secondary);
          max-width: 600px;
          margin: 0 auto 32px;
          line-height: 1.7;
        }

        .funnel-cta-buttons {
          display: flex;
          gap: var(--ds-space-4);
          justify-content: center;
          flex-wrap: wrap;
        }

        .funnel-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 32px;
          border-radius: var(--ds-radius-md);
          font-weight: 600;
          font-size: 1rem;
          text-decoration: none;
          transition: all var(--ds-dur-hover);
          cursor: pointer;
          border: none;
        }

        .funnel-btn-primary {
          background: var(--ds-brand);
          color: white;
        }

        .funnel-btn-primary:hover {
          background: var(--ds-brand-hover);
          transform: translateY(-2px);
          box-shadow: var(--ds-shadow-md);
        }

        .funnel-btn-secondary {
          background: var(--ds-surface);
          color: var(--ds-brand);
          border: 2px solid var(--ds-brand);
        }

        .funnel-btn-secondary:hover {
          background: var(--ds-brand-soft);
          transform: translateY(-2px);
          box-shadow: var(--ds-shadow-md);
        }

        @media (max-width: 768px) {
          .funnel-hero h1 {
            font-size: 2rem;
          }

          .funnel-hero-subtitle {
            font-size: 1rem;
          }

          .funnel-section {
            padding: 40px var(--ds-space-4);
          }

          .funnel-section h2 {
            font-size: 1.5rem;
          }

          .funnel-nav {
            gap: var(--ds-space-2);
          }

          .math-stat {
            min-width: 120px;
            padding: var(--ds-space-3);
          }

          .math-number {
            font-size: 1.3rem;
          }

          .math-label {
            font-size: 0.75rem;
          }
        }

        @media (prefers-color-scheme: dark) {
          .funnel-education-page {
            color: #e2e8f0;
          }

          .onevyrt-funnel-example {
            gap: var(--ds-space-4);
          }
        }
      `}</style>
    </div>
  );
}
