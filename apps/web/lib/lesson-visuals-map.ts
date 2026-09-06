/**
 * Lesson Visuals Map
 *
 * Maps lesson IDs to their associated visual components.
 * Enables automatic visual rendering in lesson pages.
 *
 * Usage:
 *   const visual = LESSON_VISUALS_MAP[lessonId];
 *   if (visual) {
 *     return <{visual.component} data={...} />;
 *   }
 */

export type VisualType = "business-definition" | "sales-funnel" | "financial-dashboard";

export interface LessonVisualConfig {
  visualType: VisualType;
  component: string; // Component name for dynamic import
  title: string;
  description: string;
  demoData?: Record<string, unknown>;
}

/**
 * Maps lesson IDs to their visual components
 */
export const LESSON_VISUALS_MAP: Record<string, LessonVisualConfig> = {
  // Chapter 1 (DEFINE) - Business Definition Visuals
  "m-business-definition": {
    visualType: "business-definition",
    component: "BusinessDefinitionVisuals",
    title: "Business Definition Visuals",
    description: "Positioning map, value ladder, and customer avatar",
    demoData: {
      competitors: [
        { name: "Budget Competitor", priceScore: 20, positionScore: 15, size: "sm" },
        { name: "Mid-Market Player", priceScore: 55, positionScore: 50, size: "md" },
        { name: "Premium Leader", priceScore: 85, positionScore: 90, size: "lg" },
      ],
      yourPosition: { priceScore: 60, positionScore: 75 },
      ladder: [
        { stage: "lead", name: "Lead Magnet", description: "Free template/guide", price: "Free" },
        { stage: "frontend", name: "Frontend Offer", description: "Low-ticket entry", price: "$97" },
        { stage: "core", name: "Core Offer", description: "Main product/service", price: "$5k–$25k" },
        { stage: "backend", name: "Backend Offer", description: "High-ticket done-for-you", price: "$50k+" },
        { stage: "upsell", name: "Upsell", description: "Annual premium support", price: "$200/mo" },
      ],
      avatar: {
        name: "Sarah",
        role: "Small Business Owner",
        ageRange: "35–50",
        incomeLevel: "£50k–£120k annual revenue",
        painPoints: [
          "Unclear how to price services",
          "Losing leads in the sales funnel",
          "No systematic way to track metrics",
        ],
        desiredOutcome: "A documented, systemized business model with predictable revenue",
      },
    },
  },

  // Chapter 2 (IMPLEMENT) - Sales Funnel Visuals
  "m-sales-system": {
    visualType: "sales-funnel",
    component: "Phase2LessonVisuals",
    title: "Sales Funnel Visuals",
    description: "Funnel optimization, KPI metrics, and team structure",
    demoData: {
      showFunnel: true,
      showDashboard: true,
      showTeam: false,
      funnel: [
        { name: "Awareness", value: 1000 },
        { name: "Interest", value: 750 },
        { name: "Consideration", value: 500 },
        { name: "Decision", value: 250 },
        { name: "Customer", value: 100 },
      ],
      splitTests: [
        {
          name: "Variant A (Control)",
          conversionRate: 8.5,
          visitors: 1000,
          conversions: 85,
          revenue: 4250,
        },
        {
          name: "Variant B (Test)",
          conversionRate: 12.3,
          visitors: 1000,
          conversions: 123,
          revenue: 6150,
        },
      ],
      kpis: [
        { label: "Revenue", value: "$52,500", unit: "MTD", trend: "up", change: 18 },
        { label: "Conversion Rate", value: "8.5%", trend: "up", change: 2.3 },
        { label: "CAC", value: "$125", trend: "down", change: -12 },
        { label: "LTV", value: "$1,850", trend: "up", change: 25 },
        { label: "ROI", value: "340%", trend: "up", change: 35 },
        { label: "Lead Quality", value: "78%", trend: "neutral", change: 0 },
      ],
    },
  },

  // Chapter 3 (CONTROL) - Financial Dashboard Visuals
  "m-price-unit-economics": {
    visualType: "financial-dashboard",
    component: "KeyMetricsDashboard",
    title: "Financial Dashboard",
    description: "Key financial metrics and unit economics",
    demoData: {
      metrics: [
        { name: "Revenue (MRR)", value: "$52,500", trend: "+18%" },
        { name: "Cost of Goods Sold", value: "$15,750", trend: "-8%" },
        { name: "Gross Margin", value: "70%", trend: "+3%" },
        { name: "CAC", value: "$125", trend: "-12%" },
        { name: "LTV", value: "$1,850", trend: "+25%" },
        { name: "LTV:CAC Ratio", value: "14.8x", trend: "+8%" },
        { name: "Payback Period", value: "16 days", trend: "-4 days" },
        { name: "Operating Expenses", value: "$18,000", trend: "-5%" },
        { name: "Net Profit", value: "$18,750", trend: "+32%" },
      ],
      period: "Last 30 days",
      targets: {
        "Revenue Target": "$55,000",
        "Margin Target": "75%",
        "CAC Target": "$100",
      },
    },
  },

  // Chapter 3 - Business Economics lesson
  "m-business-economics": {
    visualType: "financial-dashboard",
    component: "KeyMetricsDashboard",
    title: "Business Economics Dashboard",
    description: "Comprehensive business economic metrics",
    demoData: {
      metrics: [
        { name: "Total Revenue", value: "$157,500", trend: "+22%" },
        { name: "Variable Costs", value: "$47,250", trend: "-5%" },
        { name: "Fixed Costs", value: "$36,000", trend: "0%" },
        { name: "EBITDA", value: "$74,250", trend: "+31%" },
        { name: "EBITDA Margin", value: "47%", trend: "+4%" },
        { name: "Burn Rate", value: "$0", trend: "0%" },
        { name: "Cash Runway", value: "Unlimited", trend: "positive" },
        { name: "Headcount", value: "3 FTE", trend: "+1" },
        { name: "Revenue per FTE", value: "$52,500", trend: "+10%" },
      ],
      period: "Last quarter",
      targets: {
        "EBITDA Target": "$75,000",
        "Margin Target": "48%",
        "Revenue/FTE": "$60,000",
      },
    },
  },
};

/**
 * Get visual config for a lesson
 */
export function getVisualForLesson(lessonId: string): LessonVisualConfig | null {
  return LESSON_VISUALS_MAP[lessonId] ?? null;
}

/**
 * Check if a lesson has an associated visual
 */
export function hasVisual(lessonId: string): boolean {
  return lessonId in LESSON_VISUALS_MAP;
}

/**
 * Get all lessons that have visuals
 */
export function getLessonsWithVisuals(): string[] {
  return Object.keys(LESSON_VISUALS_MAP);
}
