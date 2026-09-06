"use client";
/**
 * DropoffAnalysis — Shows common funnel leaks, their causes, and solutions
 * with actionable recommendations for each stage.
 */
import { useState } from "react";

interface FunnelLeak {
  id: string;
  stage: string;
  stageName: string;
  stageColor: string;
  leak: string;
  impact: string;
  causes: string[];
  solutions: string[];
  priority: "high" | "medium" | "low";
}

const FUNNEL_LEAKS: FunnelLeak[] = [
  {
    id: "awareness-1",
    stage: "awareness",
    stageName: "Awareness",
    stageColor: "#3b82f6",
    leak: "Not enough traffic reaching funnel",
    impact: "You lose 99%+ of potential customers who never hear about you",
    causes: [
      "Low marketing budget or no paid ads",
      "Poor SEO — you're not ranking for keywords people search",
      "Wrong audience targeting in ads",
      "Weak value proposition in ads/headlines",
    ],
    solutions: [
      "Audit SEO: What keywords are your customers searching? Focus on high-intent, low-competition terms",
      "Run small paid tests: Start with $500/month to test different audiences and messages",
      "Improve ad copy: Test different headlines and CTAs to see what resonates",
      "Partner marketing: Can competitors refer to you? Can influencers mention you?",
    ],
    priority: "high",
  },
  {
    id: "awareness-2",
    stage: "awareness",
    stageName: "Awareness",
    stageColor: "#3b82f6",
    leak: "High bounce rate on landing page",
    impact: "People click your ad but leave immediately without reading",
    causes: [
      "Landing page doesn't match the ad message",
      "Poor design or unclear value proposition in first 3 seconds",
      "Page is slow to load",
      "Mobile experience is broken",
    ],
    solutions: [
      "Audit landing page: Does it clearly answer 'why should I care?' in the first 5 seconds?",
      "Speed test: Use Google PageSpeed Insights and fix critical issues",
      "Mobile-first design: Most traffic is mobile — test on your phone",
      "A/B test headline: Small changes often have big impact on bounce rate",
    ],
    priority: "high",
  },
  {
    id: "consideration-1",
    stage: "consideration",
    stageName: "Consideration",
    stageColor: "#f59e0b",
    leak: "High bounce rate on content pages",
    impact: "People visit but don't stay long enough to understand your value",
    causes: [
      "Content is unclear or doesn't match what they searched for",
      "Too much text, not enough skimmable structure",
      "No clear next step (CTA) on the page",
      "Trust signals missing (testimonials, social proof, certifications)",
    ],
    solutions: [
      "Rewrite for clarity: Use short paragraphs, bullets, and bold key phrases",
      "Add trust elements: Testimonials, case studies, company credentials",
      "Clear CTAs: 'Book a discovery call' or 'Download guide' should stand out",
      "Answer their questions: FAQ section addressing common objections",
    ],
    priority: "high",
  },
  {
    id: "consideration-2",
    stage: "consideration",
    stageName: "Consideration",
    stageColor: "#f59e0b",
    leak: "Booked calls that don't show up",
    impact: "50% of booked calls are no-shows; you waste time and money",
    causes: [
      "No reminder emails or SMS before the call",
      "Call is too far in the future (scheduled 2+ weeks out)",
      "They weren't truly qualified when they booked",
      "Time zone confusion or unclear meeting details",
    ],
    solutions: [
      "Send reminders: Auto-send 24h and 1h before call with Zoom link",
      "Qualify better: Ask qualifying questions before they book",
      "Shorten booking window: Limit to 7 days out maximum",
      "Send confirmation SMS: Improves show rates by 20-30%",
    ],
    priority: "medium",
  },
  {
    id: "decision-1",
    stage: "decision",
    stageName: "Decision",
    stageColor: "#10b981",
    leak: "Cart abandonment",
    impact: "People ready to buy leave at checkout; you lose 70% of sales",
    causes: [
      "Unexpected shipping or tax costs revealed at checkout",
      "Forced account creation before purchase",
      "Too many form fields asking for unnecessary info",
      "Security concerns (no trust badges, unclear return policy)",
    ],
    solutions: [
      "Show all costs upfront: Display shipping, tax, and total on landing page",
      "Guest checkout: Let people buy without creating account",
      "Minimize form fields: Only ask for what you absolutely need",
      "Add security badges: Trust marks, SSL certificate, clear return policy",
    ],
    priority: "high",
  },
  {
    id: "decision-2",
    stage: "decision",
    stageName: "Decision",
    stageColor: "#10b981",
    leak: "Pricing objections",
    impact: "Price is cited as reason for not buying; you can't sell to budget-conscious customers",
    causes: [
      "Price is too high compared to alternatives",
      "Value isn't clear (why is it worth this much?)",
      "No payment plan options (all upfront is scary)",
      "No justification for price (missing ROI explanation)",
    ],
    solutions: [
      "Justify price: Show ROI — 'This investment returns 3x in 6 months'",
      "Offer payment plans: Monthly payments feel less painful than lump sum",
      "Competitive analysis: If you're more expensive, show why you're worth it",
      "Create lower-price tier: Starter option might convert price-sensitive customers",
    ],
    priority: "medium",
  },
  {
    id: "retention-1",
    stage: "retention",
    stageName: "Retention",
    stageColor: "#8b5cf6",
    leak: "High churn in first 30 days",
    impact: "New customers leave quickly; you don't retain the revenue you worked hard to get",
    causes: [
      "Poor onboarding — they don't know how to use your product",
      "Unmet expectations — product doesn't deliver what was promised",
      "No early wins — they don't see results quickly",
      "Silence — no engagement from your team after purchase",
    ],
    solutions: [
      "Onboarding sequence: Email series explaining how to get started (day 1, 3, 7)",
      "Quick win template: Help them achieve one small success in first week",
      "Welcome call: Personal introduction from your team, set expectations",
      "Weekly engagement: Check-ins, success metrics, progress updates",
    ],
    priority: "high",
  },
  {
    id: "retention-2",
    stage: "retention",
    stageName: "Retention",
    stageColor: "#8b5cf6",
    leak: "Low NPS and referrals",
    impact: "Customers stay but don't become advocates; you miss organic growth",
    causes: [
      "Great but not remarkable — they're satisfied but not excited",
      "No incentive to refer — you don't ask or offer referral rewards",
      "Hard to refer — no easy sharing mechanism",
      "Results not visible — they don't see metrics proving your value",
    ],
    solutions: [
      "Measure results: Dashboard showing their improvement and ROI",
      "Referral program: Offer discount or reward for successful referrals",
      "Case study: Turn their success into a case study you can share",
      "Community: Create space for customers to connect and celebrate wins",
    ],
    priority: "medium",
  },
];

export function DropoffAnalysis() {
  const [selectedLeak, setSelectedLeak] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const leaksByStage = {
    awareness: FUNNEL_LEAKS.filter((l) => l.stage === "awareness"),
    consideration: FUNNEL_LEAKS.filter((l) => l.stage === "consideration"),
    decision: FUNNEL_LEAKS.filter((l) => l.stage === "decision"),
    retention: FUNNEL_LEAKS.filter((l) => l.stage === "retention"),
  };

  const stages = [
    { id: "awareness", name: "Awareness", color: "#3b82f6", icon: "👁️" },
    { id: "consideration", name: "Consideration", color: "#f59e0b", icon: "🤔" },
    { id: "decision", name: "Decision", color: "#10b981", icon: "✅" },
    { id: "retention", name: "Retention", color: "#8b5cf6", icon: "🔄" },
  ];

  return (
    <div className="dropoff-analysis">
      <div className="analysis-intro">
        <p>
          Most businesses lose customers for the same reasons. Here are the most common funnel leaks
          we see and proven solutions to fix them.
        </p>
      </div>

      <div className="stages-list">
        {stages.map((stage) => {
          const leaks = leaksByStage[stage.id as keyof typeof leaksByStage];
          const isExpanded = expandedStage === stage.id;

          return (
            <div key={stage.id} className="stage-section">
              <div
                className={`stage-header ${isExpanded ? "expanded" : ""}`}
                onClick={() =>
                  setExpandedStage(isExpanded ? null : stage.id)
                }
                style={{ borderLeftColor: stage.color }}
              >
                <div className="stage-header-content">
                  <span className="stage-icon">{stage.icon}</span>
                  <div>
                    <h3>{stage.name}</h3>
                    <p className="leak-count">
                      {leaks.length} common {leaks.length === 1 ? "leak" : "leaks"}
                    </p>
                  </div>
                </div>
                <div className="stage-expand-icon">
                  {isExpanded ? "−" : "+"}
                </div>
              </div>

              {isExpanded && (
                <div className="leaks-list">
                  {leaks.map((leak) => {
                    const isSelected = selectedLeak === leak.id;
                    return (
                      <div
                        key={leak.id}
                        className={`leak-item ${isSelected ? "selected" : ""}`}
                        onClick={() =>
                          setSelectedLeak(isSelected ? null : leak.id)
                        }
                      >
                        <div className="leak-header">
                          <div className="leak-priority" style={{ backgroundColor: stage.color }}>
                            {leak.priority === "high" && "⚠️ High Priority"}
                            {leak.priority === "medium" && "ℹ️ Medium"}
                            {leak.priority === "low" && "✓ Low"}
                          </div>
                          <h4>{leak.leak}</h4>
                          <div className="leak-toggle">
                            {isSelected ? "−" : "+"}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="leak-details">
                            <div className="leak-impact">
                              <strong>Impact:</strong> {leak.impact}
                            </div>

                            <div className="leak-section">
                              <h5>Why This Happens</h5>
                              <ul className="leak-list">
                                {leak.causes.map((cause, i) => (
                                  <li key={i}>{cause}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="leak-section">
                              <h5>How to Fix It</h5>
                              <ul className="solution-list">
                                {leak.solutions.map((solution, i) => (
                                  <li key={i}>
                                    <span className="solution-number">{i + 1}</span>
                                    <span>{solution}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="dropoff-quick-checklist">
        <h3>Quick Funnel Audit Checklist</h3>
        <div className="checklist-grid">
          <div className="checklist-section">
            <h4>Awareness Stage</h4>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Getting consistent traffic (ads or organic)</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Landing page loads in under 3 seconds</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Bounce rate is under 50%</span>
            </label>
          </div>

          <div className="checklist-section">
            <h4>Consideration Stage</h4>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Call booking page has social proof</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Sending reminder emails/SMS before calls</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Show rate on calls is 80%+</span>
            </label>
          </div>

          <div className="checklist-section">
            <h4>Decision Stage</h4>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>All pricing visible before checkout</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Guest checkout available (no forced signup)</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Checkout takes less than 3 minutes</span>
            </label>
          </div>

          <div className="checklist-section">
            <h4>Retention Stage</h4>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Onboarding email sequence in place</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>Measuring customer results/ROI</span>
            </label>
            <label className="checklist-item">
              <input type="checkbox" />
              <span>30-day retention rate 80%+</span>
            </label>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dropoff-analysis {
          width: 100%;
        }

        .analysis-intro {
          background: var(--ds-surface-subtle);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
          margin-bottom: var(--ds-space-6);
          border-left: 4px solid var(--ds-brand);
        }

        .analysis-intro p {
          margin: 0;
          font-size: 1rem;
          color: var(--ds-text-secondary);
          line-height: 1.7;
        }

        .stages-list {
          display: flex;
          flex-direction: column;
          gap: var(--ds-space-4);
          margin-bottom: var(--ds-space-8);
        }

        .stage-section {
          border-radius: var(--ds-radius-lg);
          overflow: hidden;
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          box-shadow: var(--ds-shadow-sm);
        }

        .stage-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--ds-space-4) var(--ds-space-6);
          cursor: pointer;
          border-left: 4px solid;
          transition: all var(--ds-dur-hover);
          user-select: none;
          background: var(--ds-surface);
        }

        .stage-header:hover {
          background: var(--ds-surface-subtle);
        }

        .stage-header.expanded {
          background: var(--ds-surface-subtle);
        }

        .stage-header-content {
          display: flex;
          align-items: center;
          gap: var(--ds-space-4);
          flex: 1;
        }

        .stage-icon {
          font-size: 1.5rem;
        }

        .stage-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .leak-count {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: var(--ds-text-tertiary);
        }

        .stage-expand-icon {
          font-size: 1.5rem;
          font-weight: 300;
          color: var(--ds-text-tertiary);
          transition: transform var(--ds-dur-hover);
        }

        .stage-header.expanded .stage-expand-icon {
          transform: rotate(180deg);
        }

        .leaks-list {
          display: flex;
          flex-direction: column;
          background: var(--ds-surface-subtle);
          border-top: 1px solid var(--ds-border-subtle);
        }

        .leak-item {
          border-bottom: 1px solid var(--ds-border-subtle);
          padding: var(--ds-space-4) var(--ds-space-6);
          cursor: pointer;
          transition: background var(--ds-dur-hover);
        }

        .leak-item:last-child {
          border-bottom: none;
        }

        .leak-item:hover {
          background: var(--ds-surface);
        }

        .leak-item.selected {
          background: var(--ds-surface);
        }

        .leak-header {
          display: flex;
          align-items: center;
          gap: var(--ds-space-3);
          cursor: pointer;
          user-select: none;
        }

        .leak-priority {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
          white-space: nowrap;
        }

        .leak-header h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ds-text-primary);
          flex: 1;
        }

        .leak-toggle {
          font-size: 1.2rem;
          font-weight: 300;
          color: var(--ds-text-tertiary);
          transition: transform var(--ds-dur-hover);
        }

        .leak-item.selected .leak-toggle {
          transform: rotate(180deg);
        }

        .leak-details {
          margin-top: var(--ds-space-4);
          padding-top: var(--ds-space-4);
          border-top: 1px solid var(--ds-border-subtle);
        }

        .leak-impact {
          font-size: 0.95rem;
          color: var(--ds-text-secondary);
          margin-bottom: var(--ds-space-4);
          padding: var(--ds-space-3);
          background: var(--ds-bg-subtle);
          border-radius: var(--ds-radius-xs);
          border-left: 3px solid var(--ds-danger);
        }

        .leak-section {
          margin-bottom: var(--ds-space-4);
        }

        .leak-section:last-child {
          margin-bottom: 0;
        }

        .leak-section h5 {
          margin: 0 0 var(--ds-space-2) 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .leak-list,
        .solution-list {
          margin: 0;
          padding-left: var(--ds-space-6);
          list-style: none;
        }

        .leak-list li,
        .solution-list li {
          margin-bottom: 8px;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
          line-height: 1.5;
          list-style: disc;
          margin-left: 0;
        }

        .leak-list li::marker,
        .solution-list li::marker {
          color: var(--ds-border-default);
        }

        .solution-list li {
          display: flex;
          gap: var(--ds-space-3);
          list-style: none;
          padding-left: 0;
          margin-left: 0;
        }

        .solution-number {
          flex: 0 0 20px;
          width: 20px;
          height: 20px;
          background: var(--ds-brand-soft);
          color: var(--ds-brand);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .dropoff-quick-checklist {
          background: var(--ds-brand-soft);
          border: 2px solid var(--ds-brand);
          border-radius: var(--ds-radius-lg);
          padding: var(--ds-space-6);
        }

        .dropoff-quick-checklist h3 {
          margin: 0 0 var(--ds-space-4) 0;
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--ds-space-4);
        }

        .checklist-section h4 {
          margin: 0 0 var(--ds-space-3) 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: var(--ds-space-3);
          margin-bottom: var(--ds-space-2);
          cursor: pointer;
          user-select: none;
          font-size: 0.9rem;
          color: var(--ds-text-secondary);
        }

        .checklist-item input[type="checkbox"] {
          cursor: pointer;
          accent-color: var(--ds-brand);
        }

        @media (max-width: 768px) {
          .stage-header {
            padding: var(--ds-space-3) var(--ds-space-4);
          }

          .leak-item {
            padding: var(--ds-space-3) var(--ds-space-4);
          }

          .stage-icon {
            font-size: 1.2rem;
          }

          .stage-header h3 {
            font-size: 1rem;
          }

          .checklist-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
