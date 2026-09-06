# Lesson Visuals Template

**Version:** 2.0  
**Last Updated:** 2026-09-03  
**Scope:** Pattern for creating reusable, animated lesson visual components  

---

## Quick Start

**The fastest way to create a new lesson visual in 5 minutes:**

```typescript
// 1. Copy this template
import React from "react";

export interface QuickVisualProps {
  data?: Array<{ id: string; label: string; value: number }>;
  title?: string;
}

// 2. Add demo data
const DEMO_DATA = [
  { id: "1", label: "Stage 1", value: 100 },
  { id: "2", label: "Stage 2", value: 65 },
];

// 3. Build the visual
export function MyNewVisual({ data = DEMO_DATA, title }: QuickVisualProps) {
  return (
    <div className="mnv-root">
      <style>{CSS}</style>
      {title && <h2 className="mnv-heading">{title}</h2>}
      <svg viewBox="0 0 400 200" className="mnv-svg">
        {data.map((item, i) => (
          <g key={i} className="mnv-item" style={{ animationDelay: `${i * 0.1}s` }}>
            <rect y={i * 50} width={item.value * 2} height="40" fill="var(--ds-brand)" opacity="0.8" />
            <text x="10" y={i * 50 + 25} className="mnv-label">{item.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// 4. Add minimal CSS
const CSS = `
.mnv-root { font-family: var(--ds-font); color: var(--ds-text-primary); }
.mnv-heading { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
.mnv-svg { width: 100%; max-width: 400px; margin: 0 auto; display: block; }
.mnv-item { opacity: 0; animation: mnv-fade-in-up 0.6s ease-out forwards; }
.mnv-label { font-size: 12px; fill: var(--ds-text-secondary); }
@keyframes mnv-fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
```

---

## Overview

This template provides a standardized pattern for building lesson visual components in ONEVYRT. Each visual component:

- **Self-contained:** Scoped CSS, SVG-based diagrams, no external dependencies
- **Composable:** Multiple visuals combined in one component with conditional rendering
- **Accessible:** ONEVYRT design tokens, dark mode support, responsive (768px/1024px breakpoints)
- **Animated:** Smooth fade-in animations with staggered delays for visual interest
- **Typed:** Full TypeScript interfaces for all props and data structures

---

## Component Structure

### 1. Imports & Types

```typescript
import React, { useMemo } from "react";

// Interface for each data type
export interface MyDataType {
  id: string;
  name: string;
  value: number;
  // ... other fields
}

// Props interface for the visual
export interface MyVisualsProps {
  data?: MyDataType[];
  title?: string;
  className?: string;
  showVisual1?: boolean;
  showVisual2?: boolean;
}
```

**Key Principles:**
- Each data structure gets its own interface
- Props interface includes optional data arrays with defaults
- Include `showXxx` booleans for conditional rendering
- All props are optional (have sensible defaults)

### 2. Demo Data

```typescript
const DEMO_DATA: MyDataType[] = [
  { id: "1", name: "Item A", value: 100 },
  { id: "2", name: "Item B", value: 150 },
  { id: "3", name: "Item C", value: 75 },
];
```

**Key Principles:**
- Provide realistic demo data for each visual
- Use consistent naming (DEMO_VARIABLE_NAME)
- Support testing and screenshot generation without external data
- Demo data should tell a meaningful story

### 3. Sub-Components

Create internal functions for each visual, keeping the main component clean:

```typescript
function VisualOne({
  data = DEMO_DATA,
}: {
  data: MyDataType[];
}) {
  // SVG-based rendering
  return (
    <div className="xxx-container">
      <h3 className="xxx-visual-title">Visual Name</h3>
      <svg viewBox="0 0 400 300" className="xxx-svg">
        {/* SVG content */}
      </svg>
    </div>
  );
}
```

**Key Principles:**
- One function per visual type
- Accept typed props with defaults
- Return a div containing a title and SVG
- Use scoped class names (e.g., `xxx-` prefix)

### 4. SVG Rendering Guidelines

```typescript
// Use viewBox for scalability
<svg viewBox="0 0 400 300" className="xxx-svg">
  
  {/* Design tokens for colors */}
  <circle cx="200" cy="150" r="50" fill="var(--ds-brand)" />
  
  {/* Looped elements with animations */}
  {data.map((item, i) => (
    <g key={i} className="xxx-item" style={{ animationDelay: `${i * 0.1}s` }}>
      <rect x={i * 50} y="0" width="40" height="200" fill="var(--ds-chapter-define)" opacity="0.2" />
      <text x={i * 50 + 20} y="220" textAnchor="middle" className="xxx-label">
        {item.name}
      </text>
    </g>
  ))}
  
</svg>
```

**Key Principles:**
- Use `viewBox` (not fixed width/height) for responsive scaling
- Reference design tokens via CSS variables (e.g., `var(--ds-brand)`)
- Wrap repeating elements in `<g>` tags with animation classes
- Use `animationDelay` for staggered entry animations
- SVG text should use semantic classes for styling

### 5. Main Component

```typescript
export function MyLessonVisuals({
  data = DEMO_DATA,
  title,
  className = "",
  showVisual1 = true,
  showVisual2 = true,
}: MyVisualsProps) {
  return (
    <div className={["xxx-root", className].filter(Boolean).join(" ")}>
      <style>{CSS}</style>

      {title && <h2 className="xxx-heading">{title}</h2>}

      <div className="xxx-grid">
        {showVisual1 && <VisualOne data={data} />}
        {showVisual2 && <VisualTwo data={data} />}
      </div>
    </div>
  );
}
```

**Key Principles:**
- Inject all CSS via inline `<style>` tag (no external files)
- Support conditional rendering via show flags
- Wrap title in optional render
- Use grid layout for responsive multi-visual layout
- Export default and named export

### 6. CSS (Inline, Scoped)

```typescript
const CSS = `
.xxx-root {
  --xxx-text: var(--ds-text-primary);
  --xxx-text-soft: var(--ds-text-secondary);
  --xxx-border: var(--ds-border-subtle);
  --xxx-bg: var(--ds-surface);
  font-family: var(--ds-font, system-ui, -apple-system, Segoe UI, sans-serif);
  color: var(--xxx-text);
  line-height: 1.5;
}

.xxx-root * {
  box-sizing: border-box;
}

/* Responsive grid: 3 columns → 1 column */
.xxx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
}

@media (max-width: 768px) {
  .xxx-grid {
    grid-template-columns: 1fr;
  }
}

/* Heading */
.xxx-heading {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 28px;
  color: var(--xxx-text);
}

/* Container for each visual */
.xxx-container {
  background: var(--xxx-bg);
  border: 1px solid var(--xxx-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

/* Visual titles */
.xxx-visual-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* SVG sizing */
.xxx-svg {
  width: 100%;
  height: auto;
  max-width: 400px;
  margin: 0 auto;
  display: block;
}

/* Element animation entry */
.xxx-item {
  opacity: 0;
  animation: xxx-fade-in-up 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.xxx-label {
  font-size: 12px;
  fill: var(--xxx-text-soft);
  font-weight: 500;
}

/* Animation keyframes */
@keyframes xxx-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes xxx-fade-in-scale {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
`;
```

**Key Principles:**
- Define local CSS variables from ONEVYRT design tokens
- Prefix all classes with scoped identifier (e.g., `xxx-`)
- Use Tailwind-like naming conventions (text, border, bg, etc.)
- Responsive breakpoints at 1024px and 768px
- Animation definitions at the end
- Cubic-bezier curve: `cubic-bezier(0.23, 1, 0.320, 1)` for smooth easing

---

## Design Token Reference

All lesson visuals use ONEVYRT design tokens via CSS variables:

| Token | Usage | Examples |
|-------|-------|----------|
| `--ds-text-primary` | Main text color | Labels, titles |
| `--ds-text-secondary` | Secondary text | Descriptions, subtitles |
| `--ds-text-tertiary` | Muted text | Hints, captions |
| `--ds-border-subtle` | Border color | Card borders, dividers |
| `--ds-surface` | Card/container background | Visual containers |
| `--ds-bg-subtle` | Subtle background | Nested sections |
| `--ds-brand` | Primary brand color | Highlights, call-outs |
| `--ds-brand-soft` | Soft brand color | Light highlights |
| `--ds-chapter-define` | Phase 1 (Define) color | Positioning, strategy |
| `--ds-chapter-implement` | Phase 2 (Implement) color | Funnels, processes |
| `--ds-chapter-control` | Phase 3 (Control) color | Metrics, dashboards |
| `--ds-chapter-improve` | Phase 4 (Improve) color | Growth, optimization |
| `--ds-success` | Success/positive | Trend up, approved |
| `--ds-warning` | Warning/caution | Trend down, alert |
| `--ds-radius-md` | Border radius | Card corners (8-12px) |
| `--ds-radius-sm` | Border radius | Small elements (4-6px) |
| `--ds-shadow-xs` | Shadow elevation | Card shadows |
| `--ds-font` | Font family | System fonts |

---

## Working Code Examples

### Example 1: Sales Funnel Visualization

Copy-paste ready component for a conversion funnel:

```typescript
import React from "react";

export interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
}

export interface FunnelVisualsProps {
  stages?: FunnelStage[];
  title?: string;
}

const DEMO_FUNNEL: FunnelStage[] = [
  { name: "Website Visitors", value: 10000, percentage: 100 },
  { name: "Email Subscribers", value: 2500, percentage: 25 },
  { name: "Webinar Attendees", value: 750, percentage: 7.5 },
  { name: "Sales Calls", value: 150, percentage: 1.5 },
  { name: "Customers", value: 30, percentage: 0.3 },
];

function FunnelVisual({ stages = DEMO_FUNNEL }: { stages: FunnelStage[] }) {
  const containerWidth = 350;
  const padding = 20;
  const stageHeight = 50;
  
  return (
    <div className="fv-container">
      <h3 className="fv-visual-title">Conversion Funnel</h3>
      <svg viewBox={`0 0 ${containerWidth} ${stages.length * stageHeight + 40}`} className="fv-svg">
        {stages.map((stage, i) => {
          const widthPercent = (stage.percentage / 100) * containerWidth;
          const x = (containerWidth - widthPercent) / 2;
          const y = padding + i * stageHeight;
          
          return (
            <g key={i} className="fv-stage" style={{ animationDelay: `${i * 0.15}s` }}>
              <polygon
                points={`${x},${y} ${x + widthPercent},${y} ${x + widthPercent * 0.9},${y + 35} ${x + widthPercent * 0.1},${y + 35}`}
                fill="var(--ds-chapter-define)"
                opacity="0.15"
                stroke="var(--ds-chapter-define)"
                strokeWidth="2"
              />
              <text x={containerWidth / 2} y={y + 24} className="fv-stage-label" textAnchor="middle">
                {stage.name}
              </text>
              <text x={containerWidth / 2} y={y + 36} className="fv-stage-value" textAnchor="middle">
                {stage.value.toLocaleString()} ({stage.percentage}%)
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FunnelLessonVisuals({ stages = DEMO_FUNNEL, title }: FunnelVisualsProps) {
  return (
    <div className="fv-root">
      <style>{CSS}</style>
      {title && <h2 className="fv-heading">{title}</h2>}
      <FunnelVisual stages={stages} />
    </div>
  );
}

const CSS = `
.fv-root { font-family: var(--ds-font); color: var(--ds-text-primary); }
.fv-heading { font-size: 28px; font-weight: 700; margin-bottom: 28px; }
.fv-container { background: var(--ds-surface); border: 1px solid var(--ds-border-subtle); border-radius: 8px; padding: 20px; }
.fv-visual-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.fv-svg { width: 100%; max-width: 400px; margin: 0 auto; display: block; }
.fv-stage { opacity: 0; animation: fv-fade-in-scale 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
.fv-stage-label { font-size: 13px; fill: var(--ds-text-primary); font-weight: 600; }
.fv-stage-value { font-size: 11px; fill: var(--ds-text-secondary); }
@keyframes fv-fade-in-scale {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
`;
```

**Usage:**
```typescript
// With demo data
<FunnelLessonVisuals title="Your Sales Process" />

// With custom data
const myFunnel: FunnelStage[] = [
  { name: "Prospects", value: 500, percentage: 100 },
  { name: "Qualified Leads", value: 100, percentage: 20 },
  { name: "Customers", value: 10, percentage: 2 },
];
<FunnelLessonVisuals stages={myFunnel} title="Q3 Results" />
```

---

### Example 2: KPI Dashboard Cards

Copy-paste ready component for metric display:

```typescript
import React from "react";

export interface KPIMetric {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  change?: number;
  color?: "brand" | "success" | "warning" | "blue" | "amber";
}

const DEMO_KPIS: KPIMetric[] = [
  { label: "Monthly Revenue", value: "$45,230", trend: "up", change: 12, color: "success" },
  { label: "Customer Count", value: "127", trend: "up", change: 8, color: "brand" },
  { label: "Avg Order Value", value: "$356", trend: "down", change: -3, color: "warning" },
  { label: "Conversion Rate", value: "3.2%", trend: "up", change: 0.5, color: "blue" },
];

function KPIDashboard({ metrics = DEMO_KPIS }: { metrics: KPIMetric[] }) {
  return (
    <div className="kpi-grid">
      {metrics.map((metric, i) => (
        <div
          key={i}
          className={`kpi-card kpi-${metric.color || "brand"}`}
          style={{ animationDelay: `${i * 0.12}s` }}
        >
          <div className="kpi-label">{metric.label}</div>
          <div className="kpi-value">{metric.value}</div>
          {metric.trend && metric.change !== undefined && (
            <div className={`kpi-trend kpi-trend-${metric.trend}`}>
              <span className="kpi-trend-arrow">{metric.trend === "up" ? "↑" : "↓"}</span>
              <span>{Math.abs(metric.change)}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function KPILessonVisuals() {
  return (
    <div className="kpi-root">
      <style>{CSS}</style>
      <h2 className="kpi-heading">Your Business Dashboard</h2>
      <KPIDashboard metrics={DEMO_KPIS} />
    </div>
  );
}

const CSS = `
.kpi-root { font-family: var(--ds-font); }
.kpi-heading { font-size: 28px; font-weight: 700; margin-bottom: 28px; color: var(--ds-text-primary); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.kpi-card {
  background: var(--ds-surface);
  border: 2px solid;
  border-radius: 8px;
  padding: 20px;
  opacity: 0;
  animation: kpi-fade-in-up 0.6s ease-out forwards;
}
.kpi-brand { border-color: var(--ds-brand); }
.kpi-success { border-color: var(--ds-success); }
.kpi-warning { border-color: var(--ds-warning); }
.kpi-blue { border-color: #3b82f6; }
.kpi-label { font-size: 12px; color: var(--ds-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.kpi-value { font-size: 32px; font-weight: 700; color: var(--ds-text-primary); margin-bottom: 8px; }
.kpi-trend { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.kpi-trend-up { color: var(--ds-success); }
.kpi-trend-down { color: var(--ds-warning); }
.kpi-trend-arrow { font-size: 16px; }
@keyframes kpi-fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
```

---

### Example 3: Process Flow Steps

```typescript
import React from "react";

export interface ProcessStep {
  title: string;
  description: string;
  number: number;
}

const DEMO_STEPS: ProcessStep[] = [
  { number: 1, title: "Define Your Offer", description: "Clarify what you sell and to whom" },
  { number: 2, title: "Build the Funnel", description: "Create the customer journey" },
  { number: 3, title: "Run Campaigns", description: "Drive qualified traffic" },
  { number: 4, title: "Measure & Optimize", description: "Track metrics and improve" },
];

export function ProcessFlowVisuals() {
  return (
    <div className="pf-root">
      <style>{CSS}</style>
      <h2 className="pf-heading">Your Growth Process</h2>
      <div className="pf-timeline">
        {DEMO_STEPS.map((step, i) => (
          <div
            key={i}
            className="pf-step"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <div className="pf-step-number">{step.number}</div>
            <div className="pf-step-content">
              <h4 className="pf-step-title">{step.title}</h4>
              <p className="pf-step-desc">{step.description}</p>
            </div>
            {i < DEMO_STEPS.length - 1 && <div className="pf-step-arrow">→</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.pf-root { font-family: var(--ds-font); color: var(--ds-text-primary); }
.pf-heading { font-size: 28px; font-weight: 700; margin-bottom: 28px; }
.pf-timeline { display: flex; flex-direction: column; gap: 20px; }
@media (min-width: 768px) {
  .pf-timeline { flex-direction: row; align-items: flex-start; gap: 0; }
}
.pf-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  opacity: 0;
  animation: pf-fade-in-left 0.6s ease-out forwards;
  flex: 1;
}
.pf-step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ds-brand);
  color: white;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}
.pf-step-content { flex: 1; }
.pf-step-title { font-size: 16px; font-weight: 600; margin: 0 0 6px 0; }
.pf-step-desc { font-size: 13px; color: var(--ds-text-secondary); margin: 0; }
.pf-step-arrow {
  font-size: 24px;
  color: var(--ds-border-subtle);
  margin: 0 -8px;
  display: none;
}
@media (min-width: 768px) {
  .pf-step-arrow { display: block; }
}
@keyframes pf-fade-in-left {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
`;
```

---

### Example 4: Comparison Table/Matrix

```typescript
import React from "react";

interface ComparisonItem {
  label: string;
  before: string;
  after: string;
  icon?: "✓" | "⚡" | "→";
}

const DEMO_COMPARISON: ComparisonItem[] = [
  { label: "Daily Revenue", before: "$0", after: "$500+", icon: "⚡" },
  { label: "Customer Count", before: "5", after: "25", icon: "↑" },
  { label: "Team Size", before: "Just you", after: "Systematized", icon: "✓" },
  { label: "Time to Sale", before: "1-2 weeks", after: "3-5 days", icon: "⚡" },
];

export function ComparisonVisuals() {
  return (
    <div className="comp-root">
      <style>{CSS}</style>
      <h2 className="comp-heading">Before → After Your System</h2>
      <div className="comp-table">
        {DEMO_COMPARISON.map((item, i) => (
          <div key={i} className="comp-row" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="comp-label">{item.label}</div>
            <div className="comp-before">{item.before}</div>
            <div className="comp-arrow">→</div>
            <div className="comp-after">{item.after}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.comp-root { font-family: var(--ds-font); color: var(--ds-text-primary); }
.comp-heading { font-size: 28px; font-weight: 700; margin-bottom: 28px; }
.comp-table { display: flex; flex-direction: column; gap: 12px; }
.comp-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 16px;
  background: var(--ds-surface);
  border-radius: 6px;
  opacity: 0;
  animation: comp-fade-in-up 0.5s ease-out forwards;
}
.comp-label { font-weight: 600; font-size: 14px; }
.comp-before { text-align: center; color: var(--ds-text-secondary); font-size: 13px; }
.comp-arrow { color: var(--ds-success); font-weight: 700; text-align: center; }
.comp-after { text-align: center; color: var(--ds-success); font-weight: 600; font-size: 14px; }
@keyframes comp-fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
```

---

### Example 5: Tree/Hierarchy Diagram

```typescript
import React from "react";

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  level: number;
}

const DEMO_TREE: TreeNode = {
  id: "root",
  label: "Your Business",
  level: 0,
  children: [
    {
      id: "sales",
      label: "Sales",
      level: 1,
      children: [
        { id: "outbound", label: "Outbound", level: 2 },
        { id: "inbound", label: "Inbound", level: 2 },
      ],
    },
    {
      id: "marketing",
      label: "Marketing",
      level: 1,
      children: [
        { id: "content", label: "Content", level: 2 },
        { id: "paid", label: "Paid Ads", level: 2 },
      ],
    },
    {
      id: "ops",
      label: "Operations",
      level: 1,
      children: [
        { id: "delivery", label: "Delivery", level: 2 },
      ],
    },
  ],
};

function renderNode(node: TreeNode, index: number) {
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div
      key={node.id}
      className={`tn-node tn-level-${node.level}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="tn-box">{node.label}</div>
      {hasChildren && (
        <div className="tn-children">
          {node.children!.map((child, i) => renderNode(child, i))}
        </div>
      )}
    </div>
  );
}

export function TreeVisualsComponent() {
  return (
    <div className="tn-root">
      <style>{CSS}</style>
      <h2 className="tn-heading">Organization Structure</h2>
      <div className="tn-container">{renderNode(DEMO_TREE, 0)}</div>
    </div>
  );
}

const CSS = `
.tn-root { font-family: var(--ds-font); color: var(--ds-text-primary); }
.tn-heading { font-size: 28px; font-weight: 700; margin-bottom: 28px; }
.tn-container { display: flex; justify-content: center; padding: 20px; }
.tn-node { display: flex; flex-direction: column; align-items: center; opacity: 0; animation: tn-fade-in-scale 0.5s ease-out forwards; }
.tn-box {
  background: var(--ds-brand);
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  margin-bottom: 16px;
}
.tn-level-1 .tn-box { background: var(--ds-chapter-define); }
.tn-level-2 .tn-box { background: var(--ds-chapter-implement); opacity: 0.8; }
.tn-children {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
  position: relative;
}
.tn-children::before {
  content: "";
  position: absolute;
  top: -16px;
  left: 0;
  right: 0;
  height: 16px;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><line x1="50" y1="0" x2="50" y2="20" stroke="var(--ds-border-subtle)" stroke-width="1"/></svg>') repeat-x;
}
@keyframes tn-fade-in-scale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
`;
```

---

## Common Visual Patterns

### Pattern 1: Funnel/Flow Diagram

```typescript
{stages.map((stage, i) => {
  const width = baseWidth * (stage.percentage / 100);
  const x = (container - width) / 2;
  const y = padding + i * stageHeight;
  
  return (
    <g key={i} className="xxx-stage" style={{ animationDelay: `${i * 0.1}s` }}>
      <path d={`M ${x} ${y} L ${x + width} ${y} L ... Z`} fill={color} opacity="0.15" stroke={color} />
      <text x={centerX} y={labelY}>{stage.name}</text>
    </g>
  );
})}
```

### Pattern 2: Grid of Cards/Metrics

```typescript
<div className="xxx-grid-metrics">
  {metrics.map((metric, i) => (
    <div key={i} className="xxx-metric-card" style={{ animationDelay: `${i * 0.1}s` }}>
      <div className="xxx-metric-label">{metric.label}</div>
      <div className="xxx-metric-value">{metric.value}</div>
      {metric.trend && <div className={`xxx-trend xxx-trend-${metric.trend}`}>...</div>}
    </div>
  ))}
</div>
```

### Pattern 3: Org Chart/Tree

```typescript
<div className="xxx-level">
  {roles.map((role, i) => (
    <div key={role.id} className="xxx-role-card" style={{ animationDelay: `${i * 0.1}s` }}>
      <div className="xxx-role-title">{role.title}</div>
      <div className="xxx-role-person">{role.person}</div>
    </div>
  ))}
</div>
```

### Pattern 4: Line/Trend Chart

```typescript
<svg viewBox="0 0 300 80" className="xxx-trend-chart">
  <defs>
    <linearGradient id="xxx-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="var(--ds-brand)" stopOpacity="0.3" />
      <stop offset="100%" stopColor="var(--ds-brand)" stopOpacity="0" />
    </linearGradient>
  </defs>
  <polyline points="10,70 40,60 70,55 ..." fill="none" stroke="var(--ds-brand)" strokeWidth="2" />
  <polygon points="10,70 40,60 70,55 ... 280,80 10,80" fill="url(#xxx-gradient)" />
</svg>
```

---

## Animation Patterns

### Staggered Entry (Most Common)

```typescript
{items.map((item, i) => (
  <g key={i} className="xxx-item" style={{ animationDelay: `${i * 0.1}s` }}>
    {/* Content */}
  </g>
))}

// CSS
.xxx-item {
  opacity: 0;
  animation: xxx-fade-in-up 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}
```

### Keyframe Directions

- `fade-in-up`: Item slides up while fading in (↑)
- `fade-in-down`: Item slides down while fading in (↓)
- `fade-in-left`: Item slides left while fading in (←)
- `fade-in-scale`: Item grows while fading in (⟳)
- `pulse-ring`: Element pulses outward (✪)

---

## File Organization

When creating a new lesson visual:

```
apps/web/components/programme/
├── Phase1LessonVisuals.tsx          # Existing (Business Definition)
├── Phase1LessonVisuals.demo.tsx     # Optional demo stories
├── Phase1LessonVisuals.integration.tsx  # Optional integration tests
├── Phase2LessonVisuals.tsx          # New (Funnel, Dashboard, Team)
├── Phase2LessonVisuals.demo.tsx     # Optional
├── Phase2LessonVisuals.integration.tsx  # Optional
└── ...
```

**Files Required:**
- `PhasNLessonVisuals.tsx` — Main component (required)

**Files Optional:**
- `PhasNLessonVisuals.demo.tsx` — Storybook/demo stories
- `PhasNLessonVisuals.integration.tsx` — Integration tests
- `PhasNLessonVisuals.README.md` — Usage documentation

---

## Usage Example

### Basic Usage (Demo Data)

```typescript
import { Phase2LessonVisuals } from "@/components/programme/Phase2LessonVisuals";

export default function Page() {
  return <Phase2LessonVisuals title="Sales Funnel & Team" />;
}
```

### With Custom Data

```typescript
import { Phase2LessonVisuals, FunnelStage, KPIMetric } from "@/components/programme/Phase2LessonVisuals";

export default function Page() {
  const funnelStages: FunnelStage[] = [
    { name: "Visitors", value: 5000, percentage: 100 },
    { name: "Leads", value: 600, percentage: 12 },
    { name: "Customers", value: 30, percentage: 0.6 },
  ];

  const kpis: KPIMetric[] = [
    { label: "Revenue", value: "$25,000", trend: "up", change: 15 },
  ];

  return (
    <Phase2LessonVisuals
      title="Q3 Performance"
      funnelStages={funnelStages}
      kpis={kpis}
      showTeam={false}  // Hide team org chart
    />
  );
}
```

### Conditional Rendering

```typescript
<Phase2LessonVisuals
  showFunnel={true}      // Show funnel optimization
  showDashboard={true}   // Show KPI dashboard
  showTeam={false}       // Hide team structure
/>
```

---

## Performance Optimization Tips

### 1. SVG Optimization

**Minimize File Size:**
```typescript
// ❌ Don't: Inline high-precision coordinates
<circle cx="123.456789" cy="456.789123" r="50.123456" />

// ✅ Do: Round coordinates to 1-2 decimals
<circle cx="123.5" cy="456.8" r="50.1" />
```

**Reuse Elements with `<defs>`:**
```typescript
// ❌ Don't: Repeat gradients/patterns
<linearGradient id="grad1">...</linearGradient>
<linearGradient id="grad2">...</linearGradient>

// ✅ Do: Reuse a single gradient
<defs>
  <linearGradient id="xxx-grad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stopColor="var(--ds-brand)" stopOpacity="0.3" />
    <stop offset="100%" stopColor="var(--ds-brand)" stopOpacity="0" />
  </linearGradient>
</defs>
<polygon fill="url(#xxx-grad)" />
<polygon fill="url(#xxx-grad)" />
```

**Use CSS for Styling Over Inline:**
```typescript
// ❌ Don't: Inline styles on each element (larger SVG)
{items.map(item => (
  <rect fill="red" stroke="blue" opacity="0.5" />
))}

// ✅ Do: Use CSS classes
{items.map(item => (
  <rect className="item-rect" />
))}
// .item-rect { fill: var(--ds-brand); stroke: var(--ds-border); opacity: 0.5; }
```

### 2. Component Lazy Loading

**Lazy load heavy visuals:**
```typescript
import dynamic from "next/dynamic";

// Only loads when the component is rendered (not at build time)
const HeavyVisualsComponent = dynamic(
  () => import("./HeavyVisuals"),
  { loading: () => <div>Loading visualization...</div> }
);

export default function Page() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => setShow(true)}>Show Advanced Visuals</button>
      {show && <HeavyVisualsComponent />}
    </>
  );
}
```

### 3. Memoization for Large Datasets

**Use `useMemo` to avoid recalculations:**
```typescript
import React, { useMemo } from "react";

export function DataIntensiveVisual({ data }) {
  // Only recalculate when data changes
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      percentage: (item.value / data.reduce((a, b) => a + b.value, 0)) * 100,
    }));
  }, [data]);

  return (
    <svg>
      {processedData.map(item => (
        <g key={item.id}>
          <rect width={item.percentage * 2} />
        </g>
      ))}
    </svg>
  );
}
```

### 4. CSS Animation Performance

**Use `transform` and `opacity` for animations (GPU-accelerated):**
```typescript
// ❌ Don't: Animate width/height (causes reflows)
@keyframes slow-grow {
  from { width: 0; height: 0; }
  to { width: 100px; height: 100px; }
}

// ✅ Do: Use transform (GPU-accelerated, smooth)
@keyframes fast-grow {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

**Reduce motion for accessibility:**
```typescript
const CSS = `
@media (prefers-reduced-motion: reduce) {
  .xxx-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

/* Or use a faster animation */
@media (prefers-reduced-motion: reduce) {
  .xxx-item {
    animation: xxx-fade-in 0.2s ease-out forwards;
  }
}
`;
```

### 5. Image Optimization (if needed)

**For diagram images, use SVG (scalable, smaller):**
```typescript
// ❌ Don't: Use PNG/JPG for diagrams (blurry on mobile)
<img src="/diagram.png" alt="Process diagram" />

// ✅ Do: Use SVG (crisp, scalable, smaller)
<svg viewBox="0 0 400 300" className="xxx-diagram">
  {/* Your SVG content */}
</svg>
```

---

## Dark Mode Implementation Guide

### 1. Define Dark-Mode CSS Variables

**In your CSS, use ONEVYRT design tokens (they already handle dark mode):**
```typescript
const CSS = `
.xxx-root {
  /* These variables automatically switch in dark mode */
  --xxx-text: var(--ds-text-primary);
  --xxx-text-soft: var(--ds-text-secondary);
  --xxx-bg: var(--ds-surface);
  --xxx-border: var(--ds-border-subtle);
  
  color: var(--xxx-text);
  background: var(--xxx-bg);
}
`;
```

### 2. SVG Color Handling in Dark Mode

**Always use CSS variables for SVG colors:**
```typescript
<svg viewBox="0 0 400 300">
  {/* ✅ Correct: Uses design token */}
  <circle fill="var(--ds-brand)" />
  
  {/* ❌ Wrong: Hardcoded color, won't work in dark mode */}
  <circle fill="#0066FF" />
  
  {/* ✅ Correct: Uses semantic text color */}
  <text fill="var(--ds-text-primary)">Label</text>
</svg>
```

### 3. Testing Dark Mode

**Test your component in both themes:**
```typescript
export function DarkModeDemo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  return (
    <div
      style={{
        display: "flex",
        gap: "40px",
        padding: "40px",
      }}
    >
      {/* Light mode */}
      <div style={{ flex: 1 }}>
        <h3>Light Mode</h3>
        <MyVisualComponent />
      </div>
      
      {/* Dark mode (simulated) */}
      <div
        style={{
          flex: 1,
          background: "#1a1a1a",
          padding: "20px",
          borderRadius: "8px",
          color: "#f0f0f0",
        }}
      >
        <h3>Dark Mode</h3>
        <MyVisualComponent />
      </div>
    </div>
  );
}
```

### 4. Common Dark Mode Pitfalls

**Problem: Low contrast in dark mode**
```typescript
// ❌ Bad: Light text on light background in dark mode
fill="var(--ds-text-secondary)"  // Too subtle in dark

// ✅ Good: Use primary text for important content
fill="var(--ds-text-primary)"  // Better contrast
```

**Problem: Opacity doesn't show changes**
```typescript
// ❌ Bad: Opacity-based styling (hard to see in dark mode)
<rect fill="var(--ds-brand)" opacity="0.1" />

// ✅ Good: Use soft/light color variants
<rect fill="var(--ds-brand-soft)" />  // Built for light backgrounds
```

---

## Accessibility Checklist

### Visual Accessibility

- [ ] **Color Contrast:** Text passes WCAG AA (4.5:1 ratio) on all backgrounds
  - Test: Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
  - Example: Dark text on light backgrounds (always works)
  - Check: `var(--ds-text-primary)` on `var(--ds-surface)` ≥ 4.5:1

- [ ] **Color Not Sole Indicator:** Don't use color alone to convey meaning
  - ❌ Red bar = bad, Green bar = good (colorblind users won't get it)
  - ✅ Red bar with "↓" label, Green bar with "↑" label (accessible)

- [ ] **Focus Indicators:** Interactive elements have visible focus
  - Add focus states for keyboard navigation
  - Use `outline: 2px solid var(--ds-brand);`

- [ ] **Text Sizing:** Labels and values are readable (≥12px base)
  - Headings: 20-28px
  - Labels: 12-14px
  - Descriptions: 13-14px

### Semantic Accessibility

- [ ] **Alt Text for Visuals:** SVG visuals have meaningful descriptions
  ```typescript
  <svg aria-label="Sales funnel showing 10% conversion from leads to customers">
    {/* SVG content */}
  </svg>
  ```

- [ ] **Heading Hierarchy:** Use `<h1>` → `<h2>` → `<h3>` in order
  ```typescript
  // ✅ Correct order
  <h2>Lesson Title</h2>
  <h3>Visual 1 Title</h3>
  <h3>Visual 2 Title</h3>
  
  // ❌ Wrong: Skips h2
  <h1>Lesson</h1>
  <h3>Visual 1</h3>
  ```

- [ ] **Labels for Data:** Numbers and values have clear labels
  ```typescript
  // ✅ Accessible: Label + value clear
  <div className="kpi-card">
    <div className="kpi-label">Revenue</div>
    <div className="kpi-value">$45,230</div>
  </div>
  
  // ❌ Not accessible: Just the number, no context
  <div>$45,230</div>
  ```

### Motion & Animations

- [ ] **Reduced Motion Respected:** Animations honor `prefers-reduced-motion`
  ```typescript
  const CSS = `
  .xxx-item {
    animation: xxx-fade-in-up 0.6s ease-out forwards;
  }
  
  @media (prefers-reduced-motion: reduce) {
    .xxx-item {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
  `;
  ```

- [ ] **No Flashing/Strobing:** Animations don't flash more than 3x/second
  - Avoid blink, flash, or rapid color changes
  - Durations: 0.3s–0.8s for smooth animations

- [ ] **Motion Purpose Clear:** Animations guide attention, not distract
  - Stagger delays: `${i * 0.1}s` to lead the eye
  - Duration: 0.6s for entry animations (enough to see, not distracting)

### Keyboard Navigation

- [ ] **Keyboard Accessible:** All interactive content is accessible via Tab
  - If using buttons: Include `onClick` handler
  - If using SVG: Wrap in a labeled container

- [ ] **Tab Order Logical:** Tab order follows visual flow (left→right, top→bottom)

### Testing Tools

**Accessibility Audits (free):**
- Chrome DevTools: Lighthouse (Accessibility tab)
- axe DevTools: Browser extension for accessibility scanning
- WAVE: Browser extension for visual feedback

**Quick Commands:**
```bash
# In browser console, check color contrast
const el = document.querySelector('.kpi-value');
const style = window.getComputedStyle(el);
console.log(`Color: ${style.color}, Background: ${style.backgroundColor}`);
```

---

## Testing & QA Checklist

When creating a new lesson visual:

- [ ] **TypeScript:** No `any` types; all interfaces typed
- [ ] **Demo Data:** Realistic, meaningful data provided
- [ ] **Dark Mode:** Visual tested in both light and dark themes
- [ ] **Responsive:** Tested at 480px, 768px, 1024px, 1440px breakpoints
- [ ] **Accessibility:** Text is readable (contrast ratio ≥4.5:1)
- [ ] **Animations:** Smooth, not distracting; no janky transitions
- [ ] **Browser:** Tested in Chrome, Firefox, Safari (SVG rendering)
- [ ] **Mobile:** Touch-friendly (if interactive); readable on mobile
- [ ] **Performance:** Component loads in <500ms even with large datasets
- [ ] **Export:** Can be captured/exported as PNG/PDF (no external images)

---

## Common Gotchas

### SVG Text Rendering

❌ **Don't:** Use `<text>` with inline styles
```typescript
<text x="100" y="50" style={{ fill: "red" }}>Label</text>
```

✅ **Do:** Use CSS variables and class names
```typescript
<text x="100" y="50" fill="var(--ds-text-primary)" className="xxx-label">Label</text>
```

### Animation Delays

❌ **Don't:** Set delay in CSS (not per-element)
```css
.xxx-item {
  animation: fade-in-up 0.6s;  /* Same delay for all */
}
```

✅ **Do:** Set delay via inline style on each element
```typescript
<g style={{ animationDelay: `${i * 0.1}s` }} />
```

### Responsive Grid

❌ **Don't:** Use hardcoded column counts
```css
.xxx-grid {
  grid-template-columns: repeat(3, 1fr);  /* Breaks on mobile */
}
```

✅ **Do:** Use auto-fit with minmax
```css
.xxx-grid {
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
}
```

### Dark Mode

❌ **Don't:** Use hardcoded colors
```typescript
<circle fill="#0066FF" />
```

✅ **Do:** Use CSS variables
```typescript
<circle fill="var(--ds-brand)" />
```

---

## Extending the Template

When adding a new visual type to Phase 2 or a future phase:

1. **Define Interfaces** — Data structures for the visual
2. **Add Demo Data** — Realistic examples
3. **Create Sub-Component** — Internal function with SVG
4. **Add CSS** — Scoped styles with animations
5. **Update Main Export** — Include in grid and add show flag
6. **Test** — Dark mode, responsive, accessibility
7. **Document** — Usage examples and data requirements

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-09-03 | Added: Quick Start, 5 working code examples (Funnel, KPI Dashboard, Process Flow, Comparison, Tree), Performance optimization tips, Dark mode guide, Accessibility checklist |
| 1.0 | 2026-09-03 | Initial template based on Phase 1 (BusinessDefinitionVisuals) |

---

## See Also

- `apps/web/components/programme/BusinessDefinitionVisuals.tsx` — Phase 1 reference implementation
- `apps/web/components/programme/Phase2LessonVisuals.tsx` — Phase 2 reference implementation
- `docs/DESIGN-TOKENS.md` — Full design token reference
- `docs/DESIGN-SYSTEM-INTEGRATION.md` — Design system guidelines
