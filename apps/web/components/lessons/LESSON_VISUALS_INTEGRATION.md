# Lesson Visuals Integration Guide

Complete guide to adding rich visual examples, tables, diagrams, and sketches to lesson content in ONEVYRT.

---

## What's Available

### 1. **LessonWithVisuals Component**
Pre-built lesson templates with content, tables, and visuals for:
- **Chapter 1 (DEFINE)** — Business Definition, Positioning, Value Ladder, Customer Avatar
- **Chapter 2 (IMPLEMENT)** — Sales Funnel, Conversion Rates, Traffic Channels
- **Chapter 3 (CONTROL)** — Financial Metrics, KPIs, Benchmarks

### 2. **VisualReferencesLibrary Component**
Modular visual components to build custom lessons:
- `FunnelDiagram` — Sales funnel with drop-off rates
- `CustomerJourneyMap` — Timeline of customer touchpoints
- `RevenueBreakdownChart` — Pie chart of revenue distribution
- `ValueLadderVisualization` — Pricing tier pyramid
- `PositioningMatrixSketch` — 2x2 positioning matrix
- `ProcessFlowDiagram` — Step-by-step workflows
- `ComparisonTable` — Side-by-side comparisons

### 3. **BusinessDefinitionVisuals Component**
Interactive 3-in-1 visual for lesson data:
- Positioning Map (scatter plot)
- Value Ladder (5-tier pyramid)
- Customer Avatar (demographics + pain points)

---

## Quick Start: Using Pre-Built Lessons

```tsx
import { LessonWithVisuals } from "@/components/lessons/LessonWithVisuals";

export default function Chapter1Page() {
  return <LessonWithVisuals chapterId={1} lessonId="business-definition" />;
}
```

**Supported Lessons:**
- `LessonWithVisuals chapterId={1} lessonId="business-definition"`
- `LessonWithVisuals chapterId={2} lessonId="sales-funnel"`
- `LessonWithVisuals chapterId={3} lessonId="financial-metrics"`

---

## Building Custom Lessons: Visual Components

### Example 1: Sales Funnel with Data

```tsx
import { FunnelDiagram } from "@/components/lessons/VisualReferencesLibrary";

export function MyFunnelLesson() {
  const myFunnel = [
    { name: "Website Visitors", count: 5000, color: "#3b82f6" },
    { name: "Email Subscribers", count: 500, color: "#10b981" },
    { name: "Qualified Leads", count: 100, color: "#f59e0b" },
    { name: "Paying Customers", count: 10, color: "#ef4444" },
  ];

  return (
    <div>
      <h1>My Sales Funnel</h1>
      <FunnelDiagram stages={myFunnel} title="Your Custom Funnel" />
    </div>
  );
}
```

### Example 2: Customer Journey Timeline

```tsx
import { CustomerJourneyMap } from "@/components/lessons/VisualReferencesLibrary";

export function JourneyLesson() {
  return (
    <div>
      <h2>How Customers Experience Your Business</h2>
      <CustomerJourneyMap title="The Customer Path to Purchase" />
    </div>
  );
}
```

### Example 3: Revenue Breakdown Pie Chart

```tsx
import { RevenueBreakdownChart } from "@/components/lessons/VisualReferencesLibrary";

export function RevenueLesson() {
  const myRevenue = [
    { label: "Free Products", percent: 5, color: "#94a3b8" },
    { label: "Low-Cost Products ($50)", percent: 20, color: "#3b82f6" },
    { label: "Main Service ($2k)", percent: 60, color: "#10b981" },
    { label: "Premium Service ($10k)", percent: 15, color: "#8b5cf6" },
  ];

  return (
    <RevenueBreakdownChart segments={myRevenue} />
  );
}
```

### Example 4: Value Ladder

```tsx
import { ValueLadderVisualization } from "@/components/lessons/VisualReferencesLibrary";

export function LadderLesson() {
  return (
    <div>
      <h2>Your Value Ladder</h2>
      <ValueLadderVisualization />
      <p>Each step is 3-5x more expensive than the previous one.</p>
    </div>
  );
}
```

### Example 5: Positioning Matrix (Where You Fit)

```tsx
import { PositioningMatrixSketch } from "@/components/lessons/VisualReferencesLibrary";

export function PositioningLesson() {
  return (
    <div>
      <h2>Find Your Position</h2>
      <PositioningMatrixSketch />
      <p>Choose one position and own it. Premium Specialist is most profitable.</p>
    </div>
  );
}
```

### Example 6: Process Flow Diagram

```tsx
import { ProcessFlowDiagram } from "@/components/lessons/VisualReferencesLibrary";

export function SalesProcessLesson() {
  const steps = [
    "Lead Magnet",
    "Email Nurture",
    "Sales Call",
    "Proposal",
    "Close",
    "Onboard",
  ];

  return (
    <div>
      <h2>Sales Process</h2>
      <ProcessFlowDiagram steps={steps} title="From Prospect to Customer" />
    </div>
  );
}
```

### Example 7: Comparison Table

```tsx
import { ComparisonTable } from "@/components/lessons/VisualReferencesLibrary";

export function ChannelComparison() {
  return (
    <ComparisonTable
      title="Marketing Channels Comparison"
      headers={["Google Ads", "Social Ads", "Email"]}
      rows={[
        {
          label: "Cost per Click",
          values: ["$0.50-$3", "$0.10-$1", "$0.001"],
        },
        {
          label: "Conversion Rate",
          values: ["2-5%", "1-3%", "5-10%"],
        },
        {
          label: "Time to Results",
          values: ["Immediate", "Immediate", "Days"],
        },
        {
          label: "Best For",
          values: ["High-intent", "Awareness", "Retention"],
        },
      ]}
    />
  );
}
```

---

## Creating a Full Lesson: Step-by-Step Example

```tsx
"use client";

import { LessonWithVisuals } from "@/components/lessons/LessonWithVisuals";
import {
  FunnelDiagram,
  ValueLadderVisualization,
  ProcessFlowDiagram,
} from "@/components/lessons/VisualReferencesLibrary";

export default function Chapter2SalesFunnelLesson() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8 px-4">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">
          Build Your Sales Funnel
        </h1>
        <p className="text-lg text-slate-600 mt-2">
          Turn visitors into customers systematically
        </p>
      </div>

      {/* Learning Objectives */}
      <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded">
        <h2 className="font-bold text-green-900 mb-3">What You'll Learn</h2>
        <ul className="space-y-2 text-green-900">
          <li>✓ The 5 stages of a sales funnel</li>
          <li>✓ Typical conversion rates (and how to improve)</li>
          <li>✓ Which traffic channels work best for your business</li>
        </ul>
      </div>

      {/* Section 1: Funnel Overview */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">The 5-Stage Funnel</h2>
        <p className="text-slate-700">
          Every sales funnel has the same basic stages:
        </p>
        <ProcessFlowDiagram
          steps={[
            "Awareness",
            "Interest",
            "Consideration",
            "Purchase",
            "Loyalty",
          ]}
          title="Sales Funnel Stages"
        />
      </div>

      {/* Section 2: Visual Funnel */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">
          Typical Funnel Numbers
        </h2>
        <FunnelDiagram
          stages={[
            { name: "Ad Viewers", count: 50000, color: "#3b82f6" },
            { name: "Website Visitors", count: 5000, color: "#10b981" },
            { name: "Email Subscribers", count: 500, color: "#f59e0b" },
            { name: "Customers", count: 50, color: "#ef4444" },
          ]}
          title="Your Path to Sales"
        />
      </div>

      {/* Section 3: Value Ladder */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">
          Layer Your Offerings
        </h2>
        <ValueLadderVisualization />
      </div>

      {/* Section 4: Interactive Element */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded">
        <h3 className="font-bold text-amber-900 mb-3">Your Turn: Sketch Your Funnel</h3>
        <p className="text-amber-900 mb-3">
          Based on what you learned, sketch or describe your sales funnel:
        </p>
        <div className="bg-white border-2 border-dashed border-amber-300 rounded p-8 min-h-48 text-slate-400 text-center">
          Draw your funnel here or describe the flow
        </div>
      </div>

      {/* Section 5: Next Steps */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
        <h3 className="font-bold text-blue-900 mb-3">Action Items</h3>
        <ul className="space-y-2 text-blue-900">
          <li>□ Map your current customer journey</li>
          <li>□ Identify where you're losing people</li>
          <li>□ Pick ONE stage to improve this month</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Tables & Data Presentation

### Standard Table Format

```tsx
<div className="overflow-x-auto">
  <table className="w-full border-collapse border border-slate-300">
    <thead className="bg-blue-100">
      <tr>
        <th className="border border-slate-300 p-3 text-left font-bold">
          Column 1
        </th>
        <th className="border border-slate-300 p-3 text-left font-bold">
          Column 2
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="hover:bg-blue-50">
        <td className="border border-slate-300 p-3">Data</td>
        <td className="border border-slate-300 p-3">Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Highlight Important Rows

```tsx
<tr className="bg-green-50">
  <td className="border border-slate-300 p-3 font-bold">Important Row</td>
  <td className="border border-slate-300 p-3">Important Data</td>
</tr>
```

---

## Design Tokens & Styling

All components use ONEVYRT design tokens:

| Token | Value | Use |
|-------|-------|-----|
| `--ds-brand` | #088057 (green) | Primary buttons, CTAs |
| `--ds-chapter-define` | #2563eb (blue) | Chapter 1 styling |
| `--ds-chapter-implement` | #16a34a (green) | Chapter 2 styling |
| `--ds-chapter-control` | #d97706 (amber) | Chapter 3 styling |
| `--ds-chapter-improve` | #dc2626 (red) | Chapter 4 styling |
| `--ds-chapter-finish` | #06b6d4 (cyan) | Chapter 5 styling |

### Apply Chapter Colors to Sections

```tsx
<div className="bg-blue-50 border-l-4 border-blue-500 p-6">
  {/* Chapter 1 (DEFINE) content */}
</div>

<div className="bg-green-50 border-l-4 border-green-500 p-6">
  {/* Chapter 2 (IMPLEMENT) content */}
</div>

<div className="bg-amber-50 border-l-4 border-amber-500 p-6">
  {/* Chapter 3 (CONTROL) content */}
</div>
```

---

## Best Practices

### 1. **Lead with the Visual**
Visual learners need the diagram BEFORE the explanation.

```tsx
// ✓ GOOD
<FunnelDiagram ... />
<p>As you can see in the diagram above, ...</p>

// ✗ AVOID
<p>The funnel has these stages...</p>
<FunnelDiagram ... />
```

### 2. **Provide Real Examples**
Use actual business examples, not generic ones.

```tsx
// ✓ GOOD
{ name: "Small Coaching Business", ... }

// ✗ AVOID
{ name: "Business Type A", ... }
```

### 3. **Make It Interactive**
Include input fields, checkboxes, or drawing areas.

```tsx
<input placeholder="What's your current revenue?" />
<div className="border-2 border-dashed">Draw your funnel here</div>
```

### 4. **Color Code by Chapter**
Use chapter colors consistently throughout.

```tsx
// Chapter 1 = Blue
// Chapter 2 = Green
// Chapter 3 = Amber
```

### 5. **Include Reflection Questions**
Embed action items at the end of each section.

```tsx
<div className="bg-blue-50 p-6">
  <h3>Reflection Questions</h3>
  <ul>
    <li>1. What...</li>
    <li>2. How...</li>
  </ul>
</div>
```

---

## Responsive Design

All visual components are mobile-responsive:
- **Desktop (1024px+)**: Full-width visuals, side-by-side layouts
- **Tablet (768px)**: Adjusted widths, stacked when needed
- **Mobile (375px)**: Single-column, full-width, touch-friendly

No additional styling needed—components handle this automatically.

---

## Accessibility

All components include:
- ✓ Semantic HTML (`<table>`, `<caption>`, `<th>`)
- ✓ Color contrast (WCAG AA+)
- ✓ Alt text for SVGs
- ✓ Keyboard navigation support
- ✓ Readable font sizes

---

## Performance Notes

- All visuals are **inline SVG** (no external images)
- Components use `useMemo` to avoid unnecessary re-renders
- Bundle size impact: ~15KB for all components combined

---

## File Reference

- **Main Lessons:** `LessonWithVisuals.tsx`
- **Visual Library:** `VisualReferencesLibrary.tsx`
- **Integration:** This file
- **Examples:** See component files

---

## Extending: Adding New Lesson Types

To add a new lesson (e.g., Chapter 4):

```tsx
// In LessonWithVisuals.tsx
{chapterId === 4 && lessonId === "growth-plan" && (
  <ImproveChapterLesson />
)}

// Create the component
function ImproveChapterLesson() {
  return (
    <div className="space-y-12">
      {/* Your lesson structure */}
      <FunnelDiagram ... />
      <ProcessFlowDiagram ... />
      {/* etc. */}
    </div>
  );
}
```

---

## Questions?

- Refer to the component prop interfaces in the source files
- Check example usage in `LessonWithVisuals.tsx`
- Inspect the design tokens in `app/design-system.css`
