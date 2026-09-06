/**
 * BusinessDefinitionVisuals.demo.tsx
 *
 * Demo and usage examples for the BusinessDefinitionVisuals component.
 * Shows various configurations and how to integrate into lesson content.
 */

import { BusinessDefinitionVisuals, type CustomerAvatar, type LadderRung, type CompetitorPosition } from "./BusinessDefinitionVisuals";

/**
 * Example 1: Default/Demo Mode
 * Uses built-in demo data for all three visuals
 */
export function Example_DefaultDemo() {
  return (
    <BusinessDefinitionVisuals
      title="Business Definition Lesson — Phase 1"
    />
  );
}

/**
 * Example 2: SaaS Positioning with Custom Data
 * Shows a software product company with premium positioning
 */
export function Example_SaaSProduct() {
  const competitors: CompetitorPosition[] = [
    { name: "Zapier", priceScore: 70, positionScore: 80, size: "lg" },
    { name: "Make", priceScore: 50, positionScore: 55, size: "md" },
    { name: "Integromat", priceScore: 30, positionScore: 35, size: "sm" },
  ];

  const ladder: LadderRung[] = [
    { stage: "lead", name: "Free Plan", description: "Up to 5 tasks/mo", price: "Free" },
    { stage: "frontend", name: "Starter", description: "100 tasks/month", price: "$20/mo" },
    { stage: "core", name: "Professional", description: "Unlimited tasks + API", price: "$99/mo" },
    { stage: "backend", name: "Enterprise", description: "Custom integrations", price: "$500+/mo" },
    { stage: "upsell", name: "Support Add-on", description: "24/7 priority support", price: "+$199/mo" },
  ];

  const avatar: CustomerAvatar = {
    name: "Marcus",
    role: "Operations Director",
    ageRange: "30–45",
    incomeLevel: "$80k–$150k salary",
    painPoints: [
      "Manual data entry between tools wastes 10+ hrs/week",
      "Errors in workflow handoffs cause customer delays",
      "No single source of truth for process metrics",
    ],
    desiredOutcome: "Seamless automation that frees the team for strategic work",
  };

  return (
    <BusinessDefinitionVisuals
      competitors={competitors}
      yourPosition={{ priceScore: 65, positionScore: 75 }}
      ladder={ladder}
      avatar={avatar}
      title="SaaS Product Positioning Example"
    />
  );
}

/**
 * Example 3: Local Service Business (Coach/Consultant)
 * Typical positioning for B2B services (high-touch, premium)
 */
export function Example_CoachingBusiness() {
  const competitors: CompetitorPosition[] = [
    { name: "Group Programs", priceScore: 25, positionScore: 30, size: "sm" },
    { name: "Mid-Tier Coaches", priceScore: 50, positionScore: 60, size: "md" },
    { name: "Elite Coaching", priceScore: 95, positionScore: 95, size: "lg" },
  ];

  const ladder: LadderRung[] = [
    { stage: "lead", name: "Free Training", description: "Lead Magnet webinar", price: "Free" },
    { stage: "frontend", name: "Foundations", description: "Group workshop series", price: "$297" },
    { stage: "core", name: "Done-With-You", description: "12-week 1-on-1 coaching", price: "$3,000" },
    { stage: "backend", name: "Done-For-You", description: "Full business implementation", price: "$15k–$50k" },
    { stage: "upsell", name: "Mastermind", description: "Annual peer group access", price: "$1,500/yr" },
  ];

  const avatar: CustomerAvatar = {
    name: "Jennifer",
    role: "Boutique Agency Owner",
    ageRange: "35–52",
    incomeLevel: "$200k–$500k annual revenue",
    painPoints: [
      "Overwhelmed by business growth without systems",
      "Struggling to scale team without quality loss",
      "Unsure how to price and package services effectively",
    ],
    desiredOutcome: "A documented, delegable business system that runs without me",
  };

  return (
    <BusinessDefinitionVisuals
      competitors={competitors}
      yourPosition={{ priceScore: 72, positionScore: 80 }}
      ladder={ladder}
      avatar={avatar}
      title="Coaching Business Positioning"
    />
  );
}

/**
 * Example 4: E-commerce / Physical Product
 * Typical positioning for D2C brand
 */
export function Example_EcommerceBrand() {
  const competitors: CompetitorPosition[] = [
    { name: "Mass Market", priceScore: 15, positionScore: 20, size: "lg" },
    { name: "Mid-Market", priceScore: 50, positionScore: 50, size: "md" },
    { name: "Luxury/Niche", priceScore: 90, positionScore: 85, size: "md" },
  ];

  const ladder: LadderRung[] = [
    { stage: "lead", name: "Quiz", description: "Free personalization quiz", price: "Free" },
    { stage: "frontend", name: "Starter Bundle", description: "3-piece intro set", price: "$49" },
    { stage: "core", name: "Full System", description: "Complete 12-piece bundle", price: "$199" },
    { stage: "backend", name: "VIP Membership", description: "Exclusive new drops + concierge", price: "$499/yr" },
    { stage: "upsell", name: "Gift Concierge", description: "Corporate gifting service", price: "Custom" },
  ];

  const avatar: CustomerAvatar = {
    name: "Sophie",
    role: "Marketing Manager (Personal)",
    ageRange: "28–40",
    incomeLevel: "$60k–$120k salary",
    painPoints: [
      "Wants quality but confused by options and marketing",
      "Sustainability matters but budget is tight",
      "Wants to feel special, not mass-market",
    ],
    desiredOutcome: "Premium quality that feels personalized and aligns with my values",
  };

  return (
    <BusinessDefinitionVisuals
      competitors={competitors}
      yourPosition={{ priceScore: 68, positionScore: 72 }}
      ladder={ladder}
      avatar={avatar}
      title="Direct-to-Consumer Brand Positioning"
    />
  );
}

/**
 * Example 5: Using in Lesson Content
 * Shows how to embed the component in a lesson with surrounding context
 */
export function Example_LessonIntegration() {
  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
      <section>
        <h1 style={{ fontSize: "32px", marginBottom: "16px" }}>
          Lesson 1: Define Your Business
        </h1>
        <p style={{ fontSize: "16px", color: "#475569", marginBottom: "32px", lineHeight: "1.6" }}>
          Every successful business starts with crystal clarity on three things:
        </p>

        <ul style={{ fontSize: "16px", lineHeight: "1.8", marginBottom: "32px", paddingLeft: "20px" }}>
          <li><strong>Your Positioning:</strong> Where you sit relative to competitors (price vs. premium)</li>
          <li><strong>Your Value Ladder:</strong> The journey from free to your highest-ticket offer</li>
          <li><strong>Your Customer:</strong> The one person you serve best (avatar + pain points)</li>
        </ul>

        <p style={{ fontSize: "16px", color: "#475569", marginBottom: "32px", lineHeight: "1.6" }}>
          Below, you'll see three visual tools to help you think through these. If you've already done this work,
          customize the examples. If not, the defaults show you what a well-defined business looks like.
        </p>
      </section>

      {/* Main visuals component */}
      <BusinessDefinitionVisuals
        title="Your Business Definition"
      />

      {/* Follow-up reflection section */}
      <section style={{ marginTop: "48px", padding: "24px", background: "#eff6ff", borderRadius: "12px" }}>
        <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Reflection Questions</h2>
        <ol style={{ fontSize: "15px", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>Where do you sit on the Positioning Map? How intentional is that choice?</li>
          <li>Does your Value Ladder feel complete? Are you missing a rung?</li>
          <li>Can you describe your Customer Avatar in 30 seconds? If not, dig deeper.</li>
        </ol>
      </section>
    </div>
  );
}

/**
 * Example 6: Minimal/Headless Mode
 * Use only selected visuals
 */
export function Example_PositioningOnly() {
  return (
    <div style={{ maxWidth: "600px" }}>
      <h2 style={{ marginBottom: "20px" }}>Positioning Map</h2>
      <BusinessDefinitionVisuals
        ladder={[]} // Empty ladder — won't render
        avatar={undefined} // No avatar — won't render
        title="Where do you sit?"
      />
    </div>
  );
}

/**
 * Exported for testing/documentation
 */
export const DEMO_EXPORTS = {
  Example_DefaultDemo,
  Example_SaaSProduct,
  Example_CoachingBusiness,
  Example_EcommerceBrand,
  Example_LessonIntegration,
  Example_PositioningOnly,
};
