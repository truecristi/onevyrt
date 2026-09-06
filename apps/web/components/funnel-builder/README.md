# Funnel Builder Components

Professional, high-quality funnel templates, sketches, and interactive builder for ONEVYRT. Designed like ClickFunnels with drag-and-drop, analytics, and professional SVG renderings.

## Components Overview

### 1. FunnelTemplateGallery
Browse and explore 5 proven funnel templates with typical metrics and use cases.

**Features:**
- Gallery view of 5 funnel types (Webinar, Product Launch, High-Ticket, Ecommerce, Membership)
- Typical conversion rates, order values, and customer LTV for each
- Click-through to detailed view with full metrics and visual sketch
- Use case recommendations
- Setup time estimates

**Usage:**
```tsx
import { FunnelTemplateGallery } from "@/components/funnel-builder";

export function MyFunnelPage() {
  return <FunnelTemplateGallery />;
}
```

### 2. FunnelCanvasBuilder
Interactive, drag-and-drop funnel builder for designing and optimizing funnel stages.

**Features:**
- Drag to reorder funnel steps
- Click to edit step metrics (name, type, traffic, conversion rate, revenue)
- Visual traffic bars showing relative throughput
- Performance color-coding (red=needs work, yellow=okay, green=good, blue=excellent)
- Automatic bottleneck detection
- Add/remove steps
- Export/save functionality

**Usage:**
```tsx
import { FunnelCanvasBuilder, type Step } from "@/components/funnel-builder";

export function FunnelEditor() {
  const handleSave = (steps: Step[]) => {
    console.log("Funnel saved:", steps);
    // Save to database
  };

  return <FunnelCanvasBuilder onSave={handleSave} editable={true} />;
}
```

### 3. FunnelAnalytics
Waterfall-style visualization of funnel traffic flow with dropoff analysis.

**Features:**
- Stage-by-stage conversion tracking
- Visual waterfall chart showing traffic attrition
- Dropoff reason annotations
- Revenue tracking per stage
- Automatic optimization suggestions
- Color-coded performance indicators
- Summary metrics (total visitors, conversions, revenue, biggest dropoff)

**Usage:**
```tsx
import { FunnelAnalytics, type FunnelAnalyticsData } from "@/components/funnel-builder";

const data: FunnelAnalyticsData = {
  name: "Q4 Webinar Campaign",
  timeframe: "October - December 2024",
  stages: [
    { name: "Opt-in", visitors: 10000, converting: 6500, dropoff: "Unsubscribed" },
    { name: "Webinar", visitors: 6500, converting: 2730, dropoff: "No-show" },
    // ...
  ],
};

export function FunnelDashboard() {
  return <FunnelAnalytics data={data} showRevenue={true} />;
}
```

### 4. Funnel Sketches
Professional SVG renderings of funnel pages and templates.

**Page Sketches:**
- `OptinPageSketch` - Lead magnet opt-in page
- `SalesPageSketch` - Long-form sales page
- `CheckoutPageSketch` - Payment checkout page
- `UpsellPageSketch` - One-click upsell offer
- `ThankYouPageSketch` - Thank you confirmation

**Funnel Template Sketches:**
- `WebinarFunnelSketch` - Complete webinar funnel flow
- `ProductLaunchFunnelSketch` - Product launch funnel flow

**Usage:**
```tsx
import { OptinPageSketch, WebinarFunnelSketch } from "@/components/funnel-builder";

export function FunnelGallery() {
  return (
    <div>
      <OptinPageSketch />
      <WebinarFunnelSketch />
    </div>
  );
}
```

## Data Types

### Step (Funnel Builder)
```typescript
interface Step {
  id: string;
  type: "optin" | "sales" | "checkout" | "upsell" | "confirmation" | "webinar" | "demo";
  name: string;
  traffic: number;
  conversionRate: number;
  revenue?: number;
  order: number;
}
```

### FunnelTemplate (Gallery)
```typescript
interface FunnelTemplate {
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
```

### FunnelAnalyticsData (Analytics)
```typescript
interface FunnelAnalyticsData {
  name: string;
  stages: FunnelStage[];
  timeframe?: string;
}

interface FunnelStage {
  name: string;
  visitors: number;
  converting: number;
  dropoff?: string;
  dropoffRate?: number;
  revenue?: number;
}
```

## Styling

All components use ONEVYRT design system tokens:
- `--ds-brand` - Primary brand color (#088057)
- `--ds-bg-app` - App background
- `--ds-surface` - Card/surface background
- `--ds-text-primary` - Primary text
- `--ds-border-subtle` - Subtle borders

Components are dark-mode aware and respect `prefers-color-scheme` media queries.

## Accessibility

- ✓ WCAG AA color contrast (4.5:1)
- ✓ Semantic HTML structure
- ✓ Keyboard navigation support
- ✓ Focus indicators for interactive elements
- ✓ Reduced motion support
- ✓ Screen reader friendly labels

## Integration Points

### Add to Resources Nav
Link from `/resources` page navigation to `/resources/funnel-templates`

### Funnel Studio Integration
Import and use in the main funnel studio (`/funnel-studio.tsx`) as a templates sidebar or modal

### Programme Chapter
Consider linking to funnel templates from Chapter 2 (IMPLEMENT) and Chapter 3 (CONTROL) lessons

### Dashboard
Show analytics component on the "My Business" dashboard to track active funnels

## Performance Notes

- All SVG sketches are inline (no external image requests)
- Components use React.memo for heavy lists
- Minimal bundle impact (~15KB gzipped for all components)
- CSS is scoped and doesn't affect global styles
- No external dependencies (uses only React + design system)

## Future Enhancements

- [ ] Template duplication/forking
- [ ] Save custom templates
- [ ] A/B testing framework
- [ ] Email notification on funnel events
- [ ] Conversion tracking webhooks
- [ ] PDF export of funnel visualization
- [ ] Funnel comparison (side-by-side)
- [ ] Real-time collaboration (team editing)
