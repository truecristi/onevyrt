/**
 * Phase2LessonVisuals.demo.tsx — Storybook/demo showcase
 *
 * Demonstrates different configurations and data scenarios for Phase 2 visuals:
 * 1. All visuals with demo data (default)
 * 2. Funnel optimization focus (SaaS vs e-commerce funnels)
 * 3. Dashboard focus (KPI monitoring scenario)
 * 4. Team structure focus (org chart and responsibilities)
 * 5. Custom data scenario (real business metrics)
 */

import {
  Phase2LessonVisuals,
  FunnelStage,
  SplitTestVariant,
  KPIMetric,
  TeamRole,
  TeamConnection,
} from "./Phase2LessonVisuals";

export const Phase2Demos = () => {
  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-2">Phase 2 Lesson Visuals - Demo</h1>
        <p className="text-gray-600">
          Showcase of funnel optimization, dashboard KPIs, and team structure visuals
        </p>
      </div>

      {/* Demo 1: All Visuals (Default) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Demo 1: All Visuals (Default)</h2>
          <p className="text-sm text-gray-600">
            Shows all three visuals with demo data - typical lesson flow
          </p>
        </div>
        <Phase2LessonVisuals title="IMPLEMENT: Working Business System" />
      </section>

      {/* Demo 2: SaaS Funnel Deep Dive */}
      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Demo 2: SaaS Funnel Deep Dive</h2>
          <p className="text-sm text-gray-600">
            Focused on funnel optimization for a B2B SaaS business
          </p>
        </div>
        <Phase2LessonVisuals
          title="Optimizing Your Software-as-Service Funnel"
          funnelStages={SAAS_FUNNEL}
          splitTests={SAAS_SPLIT_TESTS}
          showDashboard={false}
          showTeam={false}
        />
      </section>

      {/* Demo 3: E-commerce Funnel Deep Dive */}
      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Demo 3: E-commerce Funnel Deep Dive</h2>
          <p className="text-sm text-gray-600">
            Focused on funnel optimization for an e-commerce business
          </p>
        </div>
        <Phase2LessonVisuals
          title="Optimizing Your E-Commerce Conversion Funnel"
          funnelStages={ECOMMERCE_FUNNEL}
          splitTests={ECOMMERCE_SPLIT_TESTS}
          showDashboard={false}
          showTeam={false}
        />
      </section>

      {/* Demo 4: KPI Dashboard Focus */}
      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Demo 4: KPI Dashboard Focus</h2>
          <p className="text-sm text-gray-600">
            Focused on dashboard metrics - what to measure and track
          </p>
        </div>
        <Phase2LessonVisuals
          title="Monitoring Key Performance Indicators (KPIs)"
          kpis={COACHING_KPI_METRICS}
          showFunnel={false}
          showTeam={false}
        />
      </section>

      {/* Demo 5: Team Structure Focus */}
      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Demo 5: Team Structure Focus</h2>
          <p className="text-sm text-gray-600">
            Focused on org chart and role responsibilities for delegation
          </p>
        </div>
        <Phase2LessonVisuals
          title="Building Your First Team & Delegation Matrix"
          teamRoles={GROWING_BUSINESS_TEAM}
          teamConnections={GROWING_TEAM_CONNECTIONS}
          showFunnel={false}
          showDashboard={false}
        />
      </section>

      {/* Demo 6: Custom Scenario - Coaching Startup */}
      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Demo 6: Custom Scenario - Coaching Startup</h2>
          <p className="text-sm text-gray-600">
            Real-world example: coaching business metrics, funnel, and team
          </p>
        </div>
        <Phase2LessonVisuals
          title="Growth Dashboard: Coaching Business Metrics"
          funnelStages={COACHING_FUNNEL}
          splitTests={COACHING_SPLIT_TESTS}
          kpis={COACHING_KPI_METRICS}
          teamRoles={COACHING_TEAM}
          teamConnections={COACHING_TEAM_CONNECTIONS}
        />
      </section>
    </div>
  );
};

/**
 * ============================================================================
 * DEMO DATA SETS
 * ============================================================================
 */

/* ---- SaaS Funnel Scenario ---- */

const SAAS_FUNNEL: FunnelStage[] = [
  { name: "Website Visitors", value: 25000, percentage: 100 },
  { name: "Free Trial Signups", value: 1500, percentage: 6 },
  { name: "Active Users (Day 7)", value: 750, percentage: 3 },
  { name: "Paid Conversions", value: 225, percentage: 0.9 },
  { name: "Active Customers (90d)", value: 165, percentage: 0.66 },
];

const SAAS_SPLIT_TESTS: SplitTestVariant[] = [
  {
    name: "Control (Current CTA)",
    conversionRate: 5.8,
    visitors: 12500,
    conversions: 725,
    revenue: 21750,
  },
  {
    name: "Variant (Value-Focused CTA)",
    conversionRate: 8.2,
    visitors: 12500,
    conversions: 1025,
    revenue: 30750,
  },
];

/* ---- E-Commerce Funnel Scenario ---- */

const ECOMMERCE_FUNNEL: FunnelStage[] = [
  { name: "Store Visitors", value: 50000, percentage: 100 },
  { name: "Product Views", value: 15000, percentage: 30 },
  { name: "Cart Adds", value: 3000, percentage: 6 },
  { name: "Checkout Starts", value: 1800, percentage: 3.6 },
  { name: "Completed Orders", value: 900, percentage: 1.8 },
];

const ECOMMERCE_SPLIT_TESTS: SplitTestVariant[] = [
  {
    name: "Standard Checkout",
    conversionRate: 1.6,
    visitors: 25000,
    conversions: 400,
    revenue: 12000,
  },
  {
    name: "One-Click Checkout",
    conversionRate: 2.4,
    visitors: 25000,
    conversions: 600,
    revenue: 18000,
  },
];

/* ---- Coaching Business Scenario ---- */

const COACHING_FUNNEL: FunnelStage[] = [
  { name: "Website Visitors", value: 8000, percentage: 100 },
  { name: "Download Free Guide", value: 640, percentage: 8 },
  { name: "Book Discovery Call", value: 160, percentage: 2 },
  { name: "Attend Discovery Call", value: 96, percentage: 1.2 },
  { name: "Enroll in Program", value: 48, percentage: 0.6 },
];

const COACHING_SPLIT_TESTS: SplitTestVariant[] = [
  {
    name: "Landing Page A (Feature-Focus)",
    conversionRate: 1.8,
    visitors: 4000,
    conversions: 72,
    revenue: 36000,
  },
  {
    name: "Landing Page B (Results-Focus)",
    conversionRate: 2.8,
    visitors: 4000,
    conversions: 112,
    revenue: 56000,
  },
];

const COACHING_KPI_METRICS: KPIMetric[] = [
  { label: "Monthly Revenue", value: "$92,000", trend: "up", change: 22 },
  { label: "Cost per Lead", value: "$128", trend: "down", change: -15 },
  { label: "Discovery Call Rate", value: "25%", trend: "up", change: 8 },
  { label: "Program Enrollment", value: "28%", trend: "neutral", change: 0 },
  { label: "Client LTV", value: "$4,500", trend: "up", change: 18 },
  { label: "NPS Score", value: "72", trend: "up", change: 12 },
];

const COACHING_TEAM: TeamRole[] = [
  {
    id: "founder",
    title: "Founder / Lead Coach",
    person: "Dr. Sarah Chen",
    responsibilities: [
      "Program strategy & curriculum",
      "Client coaching sessions",
      "Business development",
    ],
    level: "senior",
  },
  {
    id: "ops",
    title: "Operations Manager",
    person: "Michael Rodriguez",
    responsibilities: [
      "Client onboarding",
      "Scheduling & logistics",
      "Process optimization",
    ],
    level: "mid",
  },
  {
    id: "marketing",
    title: "Marketing Coordinator",
    person: "Jessica Park",
    responsibilities: [
      "Content creation",
      "Email campaigns",
      "Social media management",
    ],
    level: "junior",
  },
  {
    id: "support",
    title: "Student Success Lead",
    person: "Alex Thompson",
    responsibilities: [
      "Student support & Q&A",
      "Community management",
      "Feedback collection",
    ],
    level: "mid",
  },
];

const COACHING_TEAM_CONNECTIONS: TeamConnection[] = [
  { from: "ops", to: "founder" },
  { from: "marketing", to: "ops" },
  { from: "support", to: "founder" },
];

/* ---- Growing Business Team Scenario (5+ people) ---- */

const GROWING_BUSINESS_TEAM: TeamRole[] = [
  {
    id: "ceo",
    title: "CEO / Founder",
    person: "Sarah",
    responsibilities: [
      "Overall strategy",
      "Key accounts",
      "Team leadership",
    ],
    level: "senior",
  },
  {
    id: "ops",
    title: "Head of Operations",
    person: "James",
    responsibilities: [
      "Operations management",
      "Process improvement",
      "Team coordination",
    ],
    level: "mid",
  },
  {
    id: "sales",
    title: "Sales Manager",
    person: "Marcus",
    responsibilities: [
      "Lead qualification",
      "Sales strategy",
      "Pipeline management",
    ],
    level: "mid",
  },
  {
    id: "sales-rep",
    title: "Sales Representative",
    person: "Emma",
    responsibilities: [
      "Cold outreach",
      "Deal closing",
      "Customer relations",
    ],
    level: "junior",
  },
  {
    id: "marketing",
    title: "Marketing Specialist",
    person: "David",
    responsibilities: [
      "Lead generation",
      "Campaign management",
      "Analytics & reporting",
    ],
    level: "junior",
  },
  {
    id: "support",
    title: "Customer Support",
    person: "Rachel",
    responsibilities: [
      "Customer success",
      "Issue resolution",
      "Retention strategy",
    ],
    level: "junior",
  },
];

const GROWING_TEAM_CONNECTIONS: TeamConnection[] = [
  { from: "ops", to: "ceo" },
  { from: "sales", to: "ceo" },
  { from: "sales-rep", to: "sales" },
  { from: "marketing", to: "ops" },
  { from: "support", to: "ops" },
];

export default Phase2Demos;
