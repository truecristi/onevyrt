# ONEVYRT Pending Work Tracker (Enhanced)

**Last Updated:** 2026-09-03  
**Status:** Phase 1 & 2 Completed, Phase 3-5 Pending  
**Branch:** `claude/works-f7cor7`

---

## 📋 Executive Summary

All tasks below are **NOT YET EXECUTED**. This document tracks:
- ✅ What's been completed (design system, prototypes, documentation)
- 🔄 What's ready to implement (code written, awaiting deployment)
- ⏳ What's queued for development (high priority, architectural)

**New in Enhanced Version:**
- Code examples for every task
- Visual flowcharts and decision trees
- Detailed timeline breakdowns
- Task dependencies and blocking relationships
- Success criteria for each phase
- Troubleshooting and common pitfalls

---

## 🗺️ Task Dependency Graph

```
START
  │
  ├─→ Priority 4: Free-Access Mode ✅ READY (0.5-1h)
  │   └─→ Unblocks: Demo/trial usage
  │
  ├─→ Priority 1: Funnel Builder UI ✅ PROTOTYPES READY (4-6h)
  │   ├─ Dependency: None (standalone)
  │   └─→ Unblocks: Better funnel editor UX
  │
  ├─→ Priority 3: UI Beautification 🔄 READY (2-3h impl + 4-6h QA)
  │   ├─ Dependency: Design System (✅ already shipped)
  │   └─→ Enables: Visual polish across all components
  │
  └─→ Priority 2: Lesson Visuals 🔄 PROTOTYPE READY (8-12h Phase 1)
      ├─ Dependency: Design System (✅ already shipped)
      ├─ Dependency: Lesson content (✅ already live)
      └─→ Enables: Engagement improvements

        All Phase 1-4 are INDEPENDENT (can parallelize)
                    ↓
             Phase 5: Testing
             (6-8h, depends on all above)
                    ↓
              PRODUCTION DEPLOYMENT
```

---

## 🚀 Priority 1: Funnel Builder UI Restructuring

### Status: Interactive Prototypes Complete → React Components Pending
**Effort:** 4-6 hours implementation + 2-3 hours testing = **6-9 hours total**  
**Blocking:** No other tasks  
**Blocked By:** None

### What's Done
- ✅ 3 interactive HTML prototypes published as live artifacts
- ✅ Collapsible Panels approach (metrics expand/collapse, drawer sidebar)
- ✅ Tabbed Layout approach (Canvas | Metrics | Blocks tabs)
- ✅ Split-View approach (70/30 canvas + toggleable sidebar)
- ✅ Full dark mode, responsive design, smooth animations on all 3
- ✅ Comparison matrix with pros/cons per approach

### What's NOT Done
- 🔄 Convert prototypes to production React components (Tailwind CSS + TypeScript)
- 🔄 Select preferred UI approach (Collapsible, Tabs, or Split-View)
- 🔄 Integrate into `apps/web/components/studio/FunnelCanvasBuilder.tsx`
- 🔄 Test mobile responsiveness in live app
- 🔄 Wire up state management (metrics visibility, sidebar collapse, etc.)

### Timeline Breakdown

| Phase | Task | Duration | Owner |
|-------|------|----------|-------|
| 1.1 | Select UI approach (review prototypes) | 30 min | Team |
| 1.2 | Generate React components (TypeScript) | 2-3 hours | Dev |
| 1.3 | Integrate into FunnelCanvasBuilder.tsx | 1-2 hours | Dev |
| 1.4 | Wire up state management | 30 min | Dev |
| 1.5 | Mobile responsiveness testing | 1-1.5 hours | QA |
| 1.6 | Browser compatibility testing | 30-45 min | QA |
| **Total** | | **6-9 hours** | |

### Code Examples

#### 1.1: Collapsible Panels Approach (TypeScript)

```typescript
// apps/web/components/studio/FunnelBuilderCollapsible.tsx
import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface PanelState {
  metricsOpen: boolean;
  blocksOpen: boolean;
  propertiesOpen: boolean;
}

export function FunnelBuilderCollapsible() {
  const [panels, setPanels] = useState<PanelState>({
    metricsOpen: true,
    blocksOpen: true,
    propertiesOpen: false,
  });

  const togglePanel = (key: keyof PanelState) => {
    setPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950">
      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Funnel Canvas Component */}
          <FunnelCanvas />
        </div>
      </div>

      {/* Collapsible Sidebar */}
      <div className="w-80 border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
        {/* Metrics Panel */}
        <CollapsiblePanel
          title="Metrics & Stats"
          isOpen={panels.metricsOpen}
          onToggle={() => togglePanel('metricsOpen')}
          icon="metrics"
        >
          <MetricsBar />
        </CollapsiblePanel>

        {/* Blocks Library Panel */}
        <CollapsiblePanel
          title="Blocks Library"
          isOpen={panels.blocksOpen}
          onToggle={() => togglePanel('blocksOpen')}
          icon="blocks"
        >
          <BlocksLibrary />
        </CollapsiblePanel>

        {/* Properties Panel */}
        <CollapsiblePanel
          title="Block Properties"
          isOpen={panels.propertiesOpen}
          onToggle={() => togglePanel('propertiesOpen')}
          icon="settings"
        >
          <BlockProperties />
        </CollapsiblePanel>
      </div>
    </div>
  );
}

// Reusable CollapsiblePanel Component
interface CollapsiblePanelProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  icon?: string;
  children: React.ReactNode;
}

function CollapsiblePanel({
  title,
  isOpen,
  onToggle,
  children,
}: CollapsiblePanelProps) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 
                   hover:bg-slate-50 dark:hover:bg-slate-900 
                   font-semibold text-sm transition-colors"
      >
        <span>{title}</span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900">
          {children}
        </div>
      )}
    </div>
  );
}
```

#### 1.2: Tabbed Layout Approach (TypeScript)

```typescript
// apps/web/components/studio/FunnelBuilderTabbed.tsx
import { useState } from 'react';

type TabKey = 'canvas' | 'metrics' | 'blocks';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'canvas', label: 'Canvas', icon: '📐' },
  { key: 'metrics', label: 'Metrics', icon: '📊' },
  { key: 'blocks', label: 'Blocks', icon: '🧩' },
];

export function FunnelBuilderTabbed() {
  const [activeTab, setActiveTab] = useState<TabKey>('canvas');

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-950">
      {/* Tab Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 px-4 font-medium text-sm transition-all
              ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            <span>{tab.icon} {tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'canvas' && (
          <div className="p-4">
            <FunnelCanvas />
          </div>
        )}
        {activeTab === 'metrics' && (
          <div className="p-4">
            <MetricsBar />
          </div>
        )}
        {activeTab === 'blocks' && (
          <div className="p-4">
            <BlocksLibrary />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 1.3: Split-View Approach (TypeScript)

```typescript
// apps/web/components/studio/FunnelBuilderSplitView.tsx
import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

export function FunnelBuilderSplitView() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen gap-0 bg-white dark:bg-slate-950">
      {/* Main Canvas Area (70%) */}
      <div className="flex-1 overflow-auto border-r border-slate-200 dark:border-slate-800">
        <div className="p-4">
          <FunnelCanvas />
        </div>
      </div>

      {/* Sidebar (30%) - Collapsible */}
      {sidebarOpen && (
        <div className="w-80 border-l border-slate-200 dark:border-slate-800 
                       overflow-y-auto flex flex-col bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto">
            <CollapsiblePanel title="Metrics & Stats" defaultOpen>
              <MetricsBar />
            </CollapsiblePanel>
            <CollapsiblePanel title="Blocks Library" defaultOpen>
              <BlocksLibrary />
            </CollapsiblePanel>
            <CollapsiblePanel title="Properties">
              <BlockProperties />
            </CollapsiblePanel>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed right-0 top-1/2 transform -translate-y-1/2
                   bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-l-lg
                   shadow-lg transition-all z-50"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <ChevronRightIcon className="w-5 h-5" />
        ) : (
          <ChevronLeftIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
```

#### 1.4: Integration into FunnelCanvasBuilder.tsx

```typescript
// apps/web/components/studio/FunnelCanvasBuilder.tsx (updated)
import dynamic from 'next/dynamic';
import { useState } from 'react';

type LayoutApproach = 'collapsible' | 'tabbed' | 'split-view';

// Lazy-load layout components for better bundle size
const CollapsibleLayout = dynamic(() =>
  import('./layouts/CollapsibleLayout').then(m => m.FunnelBuilderCollapsible),
  { ssr: false, loading: () => <div className="p-4">Loading...</div> }
);

const TabbedLayout = dynamic(() =>
  import('./layouts/TabbedLayout').then(m => m.FunnelBuilderTabbed),
  { ssr: false, loading: () => <div className="p-4">Loading...</div> }
);

const SplitViewLayout = dynamic(() =>
  import('./layouts/SplitViewLayout').then(m => m.FunnelBuilderSplitView),
  { ssr: false, loading: () => <div className="p-4">Loading...</div> }
);

export function FunnelCanvasBuilder() {
  // Check localStorage for user's preferred layout
  const [layout, setLayout] = useState<LayoutApproach>(() => {
    if (typeof window === 'undefined') return 'split-view';
    return (localStorage.getItem('funnel-layout') as LayoutApproach) || 'split-view';
  });

  const handleLayoutChange = (newLayout: LayoutApproach) => {
    setLayout(newLayout);
    localStorage.setItem('funnel-layout', newLayout);
  };

  const layoutComponents: Record<LayoutApproach, JSX.Element> = {
    collapsible: <CollapsibleLayout />,
    tabbed: <TabbedLayout />,
    'split-view': <SplitViewLayout />,
  };

  return (
    <div className="relative">
      {/* Layout Selector (dev/admin only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-slate-800 
                       rounded-lg shadow-lg p-3">
          <select
            value={layout}
            onChange={e => handleLayoutChange(e.target.value as LayoutApproach)}
            className="px-3 py-1 text-sm border border-slate-300 
                      dark:border-slate-600 rounded"
          >
            <option value="collapsible">Collapsible</option>
            <option value="tabbed">Tabbed</option>
            <option value="split-view">Split View</option>
          </select>
        </div>
      )}

      {layoutComponents[layout]}
    </div>
  );
}
```

### Success Criteria (Phase 1)

- [ ] React components compile without errors
- [ ] All 3 layout approaches are functional (can add/edit blocks, see metrics)
- [ ] Dark mode works correctly in selected layout
- [ ] Mobile responsiveness: works on 320px-1024px viewports
- [ ] No performance degradation vs. current builder
- [ ] State persists across page reloads (localStorage)
- [ ] Accessibility: keyboard navigation works, ARIA labels correct
- [ ] QA checklist passed (component sampling matrix)

### Files to Modify

```
apps/web/
├── components/
│   ├── studio/
│   │   ├── FunnelCanvasBuilder.tsx                (modify: add layout selector)
│   │   ├── layouts/
│   │   │   ├── CollapsibleLayout.tsx              (new)
│   │   │   ├── TabbedLayout.tsx                   (new)
│   │   │   └── SplitViewLayout.tsx                (new)
│   │   ├── MetricsBar.tsx                         (modify: reusable in new layouts)
│   │   ├── BlocksLibrary.tsx                      (modify: reusable in new layouts)
│   │   └── BlockProperties.tsx                    (new or refactor)
│   └── shared/
│       └── CollapsiblePanel.tsx                   (new: reusable component)
└── styles/
    └── studio.css                                  (new: layout-specific styles)
```

### Next Action

```
1. Review 3 prototypes → select preferred layout (30 min)
2. Generate React components for selected layout (2-3 hours)
3. Integrate into FunnelCanvasBuilder.tsx (1-2 hours)
4. Wire up state management + localStorage (30 min)
5. Test mobile responsiveness (1-1.5 hours)
6. Run QA checklist (30-45 min)
```

---

## 🎨 Priority 2: Lesson Visual Enhancements

### Status: Proof-of-Concept Complete → Scale to All Lessons Pending
**Effort:** 8-12h Phase 1 + 6-8h Phase 2 + 20-30h full scaling = **34-50 hours total**  
**Blocking:** No other tasks  
**Blocked By:** None

### What's Done
- ✅ Marketing System Lesson visuals proof-of-concept
  - Channel Comparison Chart (3 channels with cost-per-visitor bars)
  - Process Flow Diagram (3-stage funnel with decision rules)
  - Decision Framework (2x2 matrix: High/Low Spend × High/Low Visitors)
- ✅ `components/lessons/MarketingSystemVisuals.tsx` created
- ✅ `docs/LESSON-VISUALS-TEMPLATE.md` (reusable template for other lessons)
- ✅ Design system integration (ONEVYRT colors, typography, spacing)

### What's NOT Done
- 🔄 Create visuals for Phase 1 priority lessons (3 lessons: 8-12h)
  - Business Definition (positioning map visualization)
  - Sales Funnel (funnel stage diagram)
  - Financial Dashboard (KPI cards + revenue/cost charts)
- 🔄 Create visuals for Phase 2 lessons (4-6 lessons: 6-8h)
- 🔄 Scale to all 25+ lessons (weeks 3-4: 20-30h)
- 🔄 Export capability (PDF/PNG of visuals for worksheets)
- 🔄 Integrate visuals into lesson content flow

### Timeline Breakdown

| Phase | Task | Duration | Lessons | Owner |
|-------|------|----------|---------|-------|
| 2.1 | Business Definition visuals | 2.5-3 hours | 1 | Dev |
| 2.2 | Sales Funnel visuals | 2.5-3 hours | 1 | Dev |
| 2.3 | Financial Dashboard visuals | 2-3 hours | 1 | Dev |
| 2.4 | Phase 1 integration + testing | 1-2 hours | 3 | QA |
| **Phase 1 Subtotal** | | **8-12 hours** | 3 | |
| 2.5 | Phase 2 lessons (4-6 lessons) | 6-8 hours | 4-6 | Dev |
| 2.6 | Phase 2 integration + testing | 1-2 hours | 4-6 | QA |
| **Phase 2 Subtotal** | | **7-10 hours** | 4-6 | |
| 2.7 | Full scaling (19+ remaining lessons) | 20-30 hours | 19+ | Dev |
| 2.8 | Export capability (PDF/PNG) | 3-5 hours | All | Dev |
| **Total** | | **38-57 hours** | 25+ | |

### Code Examples

#### 2.1: Positioning Map Visualization (Business Definition)

```typescript
// apps/web/components/lessons/BusinessDefinitionVisuals.tsx
import React from 'react';

interface PositioningPoint {
  label: string;
  x: number; // 0-100 (Commodity ↔ Premium)
  y: number; // 0-100 (Generic ↔ Specialized)
  color: string;
}

export function BusinessDefinitionVisuals() {
  const competitorPosition: PositioningPoint[] = [
    { label: 'Your Business', x: 75, y: 72, color: '#2563eb' },
    { label: 'Competitor A', x: 45, y: 50, color: '#d1d5db' },
    { label: 'Competitor B', x: 25, y: 80, color: '#d1d5db' },
    { label: 'Competitor C', x: 60, y: 30, color: '#d1d5db' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
          Positioning Map
        </h3>

        {/* SVG Chart */}
        <svg
          viewBox="0 0 400 350"
          className="w-full max-w-2xl mx-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          <rect width="400" height="350" fill="white" className="dark:fill-slate-900" />

          {/* Grid lines */}
          <line x1="200" y1="20" x2="200" y2="330" stroke="#e5e7eb" strokeWidth="2" />
          <line x1="20" y1="175" x2="380" y2="175" stroke="#e5e7eb" strokeWidth="2" />

          {/* Axis labels */}
          <text x="350" y="345" fontSize="12" fill="#6b7280" textAnchor="end">
            Commodity ← → Premium
          </text>
          <text x="15" y="35" fontSize="12" fill="#6b7280">
            Generic
          </text>
          <text x="15" y="330" fontSize="12" fill="#6b7280">
            Specialized
          </text>

          {/* Quadrant labels */}
          <text x="110" y="95" fontSize="11" fill="#9ca3af" textAnchor="middle">
            Niche Player
          </text>
          <text x="290" y="95" fontSize="11" fill="#9ca3af" textAnchor="middle">
            Premium
          </text>
          <text x="110" y="280" fontSize="11" fill="#9ca3af" textAnchor="middle">
            Generic Commodity
          </text>
          <text x="290" y="280" fontSize="11" fill="#9ca3af" textAnchor="middle">
            Premium Commodity
          </text>

          {/* Data points */}
          {competitorPosition.map((point, idx) => {
            const posX = 20 + (point.x / 100) * 360;
            const posY = 330 - (point.y / 100) * 310;
            const isYourBusiness = point.label === 'Your Business';

            return (
              <g key={idx}>
                {/* Circle */}
                <circle
                  cx={posX}
                  cy={posY}
                  r={isYourBusiness ? 10 : 7}
                  fill={point.color}
                  opacity={isYourBusiness ? 1 : 0.6}
                />
                {/* Label */}
                <text
                  x={posX}
                  y={posY - 15}
                  fontSize="11"
                  fill={isYourBusiness ? '#2563eb' : '#6b7280'}
                  fontWeight={isYourBusiness ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Key Takeaways */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <strong>Your Position:</strong> You're positioned in the premium, specialized quadrant.
          This means higher margins, loyal customers, but smaller addressable market. Focus on
          deepening your niche expertise.
        </p>
      </div>
    </div>
  );
}
```

#### 2.2: Sales Funnel Diagram (Sales Funnel Lesson)

```typescript
// apps/web/components/lessons/SalesFunnelVisuals.tsx
import React from 'react';

interface FunnelStage {
  label: string;
  value: number;
  color: string;
  icon: string;
}

export function SalesFunnelVisuals() {
  const stages: FunnelStage[] = [
    { label: 'Awareness', value: 1000, color: '#60a5fa', icon: '👁️' },
    { label: 'Interest', value: 400, color: '#34d399', icon: '💡' },
    { label: 'Decision', value: 100, color: '#fbbf24', icon: '🤔' },
    { label: 'Purchase', value: 20, color: '#f87171', icon: '🛒' },
  ];

  const conversionRates = stages.map((stage, idx) => {
    if (idx === 0) return null;
    return ((stages[idx].value / stages[idx - 1].value) * 100).toFixed(0);
  });

  return (
    <div className="space-y-6">
      {/* Funnel Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white">
          Sales Funnel Breakdown
        </h3>

        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const width = (stage.value / stages[0].value) * 100;
            const conversionRate = conversionRates[idx];

            return (
              <div key={idx} className="space-y-2">
                {/* Stage Label & Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{stage.icon}</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {stage.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {stage.value.toLocaleString()}
                    </div>
                    {conversionRate && (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {conversionRate}% conversion
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar */}
                <div className="h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full transition-all flex items-center justify-center text-white font-semibold text-sm"
                    style={{
                      width: `${width}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    {width > 15 && `${width.toFixed(0)}%`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion Opportunities */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
        <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
          Optimization Opportunities
        </h4>
        <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
          <li>• Interest → Decision (25% conversion) — improve value proposition</li>
          <li>• Decision → Purchase (20% conversion) — reduce friction in checkout</li>
        </ul>
      </div>
    </div>
  );
}
```

#### 2.3: Financial Dashboard (Financial Dashboard Lesson)

```typescript
// apps/web/components/lessons/FinancialDashboardVisuals.tsx
import React from 'react';

interface KPI {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}

export function FinancialDashboardVisuals() {
  const kpis: KPI[] = [
    { label: 'Monthly Revenue', value: '$45,000', trend: 'up', color: '#10b981' },
    { label: 'Cost of Goods', value: '$18,000', trend: 'down', color: '#ef4444' },
    { label: 'Gross Margin', value: '60%', trend: 'up', color: '#3b82f6' },
    { label: 'Customer Acquisition Cost', value: '$150', trend: 'neutral', color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-lg p-4 border-2"
            style={{ borderColor: kpi.color }}
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
              {kpi.value}
            </p>
            {kpi.trend && (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={`text-sm font-medium ${
                    kpi.trend === 'up'
                      ? 'text-green-600 dark:text-green-400'
                      : kpi.trend === 'down'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {kpi.trend === 'up' ? '+5.2%' : kpi.trend === 'down' ? '-2.1%' : 'No change'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Revenue Breakdown Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-4">
          Revenue Breakdown by Product
        </h4>

        {/* Stacked Bar Chart */}
        <svg viewBox="0 0 400 100" className="w-full max-w-2xl">
          <rect x="20" y="20" width="80" height="30" fill="#3b82f6" rx="4" />
          <text x="60" y="42" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">
            Product A
          </text>
          <text x="60" y="58" fontSize="10" fill="#6b7280" textAnchor="middle">
            $22,500 (50%)
          </text>

          <rect x="110" y="20" width="60" height="30" fill="#10b981" rx="4" />
          <text x="140" y="42" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">
            Product B
          </text>
          <text x="140" y="58" fontSize="10" fill="#6b7280" textAnchor="middle">
            $13,500 (30%)
          </text>

          <rect x="180" y="20" width="40" height="30" fill="#f59e0b" rx="4" />
          <text x="200" y="42" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">
            Other
          </text>
          <text x="200" y="58" fontSize="10" fill="#6b7280" textAnchor="middle">
            $9,000 (20%)
          </text>
        </svg>
      </div>

      {/* Action Items */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Next Steps
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>✓ Track these KPIs weekly</li>
          <li>✓ Set targets for each metric (10% CAC reduction)</li>
          <li>✓ Build this into your review ritual every Friday</li>
        </ul>
      </div>
    </div>
  );
}
```

#### 2.4: Reusable Template & Integration

```typescript
// lib/chapter-4/lesson-2-5-visuals.ts (template for other lessons)
/**
 * Lesson Visual Component Template
 *
 * Each lesson can have a visual component that provides:
 * 1. SVG charts/diagrams (scalable, no images)
 * 2. Interactive elements (on hover reveal details)
 * 3. Dark mode support (CSS custom properties)
 * 4. Export capability (to PDF/PNG via hidden canvas)
 *
 * Usage:
 * import { LessonVisuals } from '@/components/lessons/[LessonName]Visuals';
 *
 * export default function LessonPage() {
 *   return (
 *     <div className="space-y-6">
 *       <LessonContent />
 *       <LessonVisuals />
 *       <ExportButton visualComponent={LessonVisuals} />
 *     </div>
 *   );
 * }
 */

interface VisualsConfig {
  title: string;
  description: string;
  svg: React.ComponentType<any>;
  exportEnabled: boolean;
}

// apps/web/components/lessons/[LessonName]Visuals.tsx structure
export const LessonVisualsTemplate: VisualsConfig = {
  title: '[Lesson Name] Visualization',
  description: 'Interactive diagram showing [key concept]',
  svg: () => (
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      {/* Diagram content */}
    </svg>
  ),
  exportEnabled: true,
};

// Reusable export function
export async function exportVisualAsPDF(
  elementId: string,
  filename: string
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { scale: 2 });
  const image = canvas.toDataURL('image/png');

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.addImage(image, 'PNG', 10, 10, 190, 277);
  doc.save(filename);
}
```

### Success Criteria (Phase 2)

**Phase 1 (Business Definition, Sales Funnel, Financial Dashboard):**
- [ ] 3 visual components created (SVG-based, no bitmap images)
- [ ] All visuals work in light and dark modes
- [ ] All visuals are responsive (mobile to desktop)
- [ ] Each visual has explanatory text/key takeaways
- [ ] Integrated into lesson pages without breaking layout
- [ ] No performance impact (< 50KB added per visual)

**Phase 2 (4-6 additional lessons):**
- [ ] All Phase 2 visuals created following Phase 1 patterns
- [ ] 80%+ consistent styling across all lessons
- [ ] Export to PDF works (1 click to download worksheet)

**Full Scaling (25+ lessons):**
- [ ] All lessons have visual components
- [ ] Template reusability > 80% (minimal per-lesson customization)
- [ ] Performance remains < 2s load time for any lesson page

### Files to Modify/Create

```
apps/web/
├── components/
│   └── lessons/
│       ├── BusinessDefinitionVisuals.tsx         (new)
│       ├── SalesFunnelVisuals.tsx                (new)
│       ├── FinancialDashboardVisuals.tsx         (new)
│       ├── [Additional Phase 2 visuals]          (new, 4-6 files)
│       └── VisualsExportButton.tsx               (new: reusable export)
└── lib/
    └── lessons/
        ├── visuals-template.ts                   (new: template)
        └── visuals-export.ts                     (new: PDF/PNG export)
```

### Next Action

```
1. Pick 1 Phase 1 lesson (Business Definition preferred)
2. Create visual component using 2.1 code example
3. Integrate into /programme/lesson/[id]
4. Test mobile + dark mode
5. Repeat for Sales Funnel + Financial Dashboard
6. Move to Phase 2 (4-6 additional lessons)
7. Full scaling (remaining 19+ lessons)
```

---

## 🎨 Priority 3: UI Component Beautification (CSS Patches)

### Status: 13 Patches Documented → Ready to Apply
**Effort:** 2-3 hours implementation + 4-6 hours QA = **6-9 hours total**  
**Blocking:** No other tasks  
**Blocked By:** None

### What's Done
- ✅ 13 CSS beautification patches fully documented
- ✅ Risk assessment: Very Low (CSS only, no logic changes)
- ✅ QA checklist created (component sampling matrix)
- ✅ Implementation guide ready

### What's NOT Done
- 🔄 Apply patches to codebase
- 🔄 QA testing (160+ components, 2-3 hours)
- 🔄 Screenshot comparisons (before/after)

### Timeline Breakdown

| Phase | Task | Duration | Components | Owner |
|-------|------|----------|------------|-------|
| 3.1 | Patch 1-3: Visual Hierarchy + Shadows | 45 min | 160+ | Dev |
| 3.2 | Patch 4-6: Buttons, Cards, Badges | 45 min | 80+ | Dev |
| 3.3 | Patch 7-10: Inputs, Dropdowns, Modals | 45 min | 60+ | Dev |
| 3.4 | Patch 11-13: Nav, Labels, Dark Mode | 30 min | 40+ | Dev |
| **Implementation Subtotal** | | **2.5-3 hours** | 340+ | |
| 3.5 | QA: Visual checklist sampling | 2-3 hours | 40-50 | QA |
| 3.6 | QA: Browser compatibility | 1-2 hours | 5 browsers | QA |
| 3.7 | Screenshot comparison + review | 1-2 hours | 20+ screens | QA |
| **QA Subtotal** | | **4-7 hours** | | |
| **Total** | | **6.5-10 hours** | | |

### Code Examples

#### 3.1: Visual Hierarchy Refinement

```typescript
// apps/web/app/design-system.css (Patch 1)
/**
 * Visual Hierarchy Refinement
 * Adjusts spacing, sizing, and line-heights for better visual clarity
 */

/* Headings: increase line-height for readability */
h1 {
  font-size: 1.875rem; /* 30px */
  line-height: 2.25rem; /* 36px */ /* ↑ was 1.2 */
  letter-spacing: -0.02em;
}

h2 {
  font-size: 1.5rem; /* 24px */
  line-height: 1.875rem; /* 30px */ /* ↑ was 1.2 */
  letter-spacing: -0.01em;
}

h3 {
  font-size: 1.25rem; /* 20px */
  line-height: 1.75rem; /* 28px */ /* ↑ was 1.2 */
}

/* Body text: optimize line-height for readability */
body {
  line-height: 1.6; /* ↑ was 1.5 */
  letter-spacing: 0;
}

p {
  margin-bottom: 1rem; /* ↑ was 0.75rem */
}

/* Form elements: improved spacing */
label {
  display: block;
  margin-bottom: 0.5rem; /* ↑ was 0.25rem */
  font-weight: 500;
  font-size: 0.875rem;
}

input,
select,
textarea {
  font-size: 1rem; /* prevent zoom on iOS */
  padding: 0.75rem 1rem; /* ↑ was 0.625rem 0.75rem */
}

/* Buttons: consistent sizing */
button {
  padding: 0.75rem 1.25rem; /* ↑ was 0.625rem 1rem */
  font-size: 0.95rem;
  line-height: 1.5;
  border-radius: 0.5rem;
}

button.sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

button.lg {
  padding: 1rem 1.5rem;
  font-size: 1.025rem;
}
```

#### 3.2: Enhanced Shadow System

```typescript
// apps/web/app/design-system.css (Patch 2)
/**
 * Enhanced Shadow System
 * 5 elevation levels for depth perception
 */

:root {
  /* Elevation 1: Subtle baseline (cards, inputs) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);

  /* Elevation 2: Hover state (interactive elements) */
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.12),
    0 2px 4px -1px rgba(0, 0, 0, 0.08);

  /* Elevation 3: Emphasized elements (dropdowns, popovers) */
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.15),
    0 4px 6px -2px rgba(0, 0, 0, 0.1);

  /* Elevation 4: Floating elements (modals, tooltips) */
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.2),
    0 10px 10px -5px rgba(0, 0, 0, 0.12);

  /* Elevation 5: Maximum depth (priority modals, full-screen overlays) */
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  --shadow-elevation-5: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Darker shadows for dark mode */
    --shadow-elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.2),
      0 1px 2px 0 rgba(0, 0, 0, 0.12);
    --shadow-elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.25),
      0 2px 4px -1px rgba(0, 0, 0, 0.15);
    --shadow-elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.3),
      0 4px 6px -2px rgba(0, 0, 0, 0.2);
    --shadow-elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.35),
      0 10px 10px -5px rgba(0, 0, 0, 0.25);
    --shadow-elevation-5: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  }
}

/* Apply shadows to component types */
.card {
  box-shadow: var(--shadow-elevation-1);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: var(--shadow-elevation-2);
}

input:focus,
select:focus,
textarea:focus {
  box-shadow: var(--shadow-elevation-1);
  outline: none;
}

.dropdown-menu {
  box-shadow: var(--shadow-elevation-3);
}

.modal {
  box-shadow: var(--shadow-elevation-4);
}

.modal-fullscreen {
  box-shadow: var(--shadow-elevation-5);
}
```

#### 3.3: Button Feedback (Color + Shadow + Elevation)

```typescript
// apps/web/app/design-system.css (Patch 3)
/**
 * Button Feedback States
 * Hover, active, disabled states with color + shadow + elevation
 */

button {
  position: relative;
  transition: all 0.15s ease;
  border-radius: 0.5rem;
}

/* Primary Button */
.btn-primary {
  background-color: #2563eb;
  color: white;
  box-shadow: var(--shadow-elevation-1);
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8; /* darker blue */
  box-shadow: var(--shadow-elevation-2);
  transform: translateY(-1px); /* lift effect */
}

.btn-primary:active:not(:disabled) {
  background-color: #1e40af; /* even darker */
  box-shadow: var(--shadow-sm);
  transform: translateY(0);
}

.btn-primary:disabled {
  background-color: #cbd5e1; /* slate-300 */
  color: #94a3b8; /* slate-400 */
  cursor: not-allowed;
  opacity: 0.5;
}

/* Secondary Button */
.btn-secondary {
  background-color: transparent;
  color: #2563eb;
  border: 2px solid #2563eb;
  box-shadow: none;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #eff6ff; /* blue-50 */
  box-shadow: var(--shadow-elevation-1);
}

.btn-secondary:active:not(:disabled) {
  background-color: #dbeafe; /* blue-100 */
  box-shadow: none;
}

/* Danger Button */
.btn-danger {
  background-color: #dc2626;
  color: white;
  box-shadow: var(--shadow-elevation-1);
}

.btn-danger:hover:not(:disabled) {
  background-color: #b91c1c; /* darker red */
  box-shadow: var(--shadow-elevation-2);
  transform: translateY(-1px);
}

.btn-danger:active:not(:disabled) {
  background-color: #991b1b; /* even darker */
  box-shadow: var(--shadow-sm);
  transform: translateY(0);
}

/* Icon Button (no background) */
.btn-icon {
  background-color: transparent;
  color: #6b7280;
  padding: 0.5rem;
}

.btn-icon:hover:not(:disabled) {
  background-color: #f3f4f6; /* gray-100 */
  color: #1f2937; /* gray-800 */
  box-shadow: none;
  border-radius: 0.375rem;
}

@media (prefers-color-scheme: dark) {
  .btn-secondary {
    color: #60a5fa; /* blue-400 */
    border-color: #60a5fa;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: rgba(60, 132, 246, 0.1);
  }

  .btn-icon {
    color: #d1d5db; /* gray-300 */
  }

  .btn-icon:hover:not(:disabled) {
    background-color: rgba(31, 41, 55, 0.5);
    color: #f3f4f6; /* gray-100 */
  }
}
```

#### 3.4: Input Field States

```typescript
// apps/web/app/design-system.css (Patch 4)
/**
 * Input Field States
 * Focus ring, error, success, and disabled states
 */

input,
select,
textarea {
  border-radius: 0.375rem;
  border: 1px solid #d1d5db;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  transition: all 0.15s ease;
  background-color: white;
  color: #1f2937;
}

/* Focus State */
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb; /* blue */
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); /* blue glow */
}

/* Error State */
input.error,
select.error,
textarea.error {
  border-color: #dc2626; /* red */
  background-color: #fef2f2; /* red-50 */
}

input.error:focus,
select.error:focus,
textarea.error:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1); /* red glow */
}

/* Success State */
input.success,
select.success,
textarea.success {
  border-color: #16a34a; /* green */
  background-color: #f0fdf4; /* green-50 */
}

input.success:focus,
select.success:focus,
textarea.success:focus {
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1); /* green glow */
}

/* Disabled State */
input:disabled,
select:disabled,
textarea:disabled {
  background-color: #f3f4f6; /* gray-100 */
  color: #9ca3b8; /* gray-400 */
  cursor: not-allowed;
  opacity: 0.6;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  input,
  select,
  textarea {
    background-color: #1f2937; /* gray-800 */
    border-color: #374151; /* gray-700 */
    color: #f3f4f6; /* gray-100 */
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #60a5fa; /* blue-400 */
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }

  input.error,
  select.error,
  textarea.error {
    border-color: #f87171; /* red-400 */
    background-color: rgba(127, 29, 29, 0.3); /* red-900 transparent */
  }

  input:disabled,
  select:disabled,
  textarea:disabled {
    background-color: #111827; /* gray-900 */
    border-color: #374151; /* gray-700 */
    color: #6b7280; /* gray-500 */
  }
}
```

### Success Criteria (Phase 3)

- [ ] All 13 patches applied without breaking existing functionality
- [ ] 160+ components visually verified (using QA checklist)
- [ ] No regression in performance (bundle size, load time)
- [ ] Dark mode works correctly across all patched components
- [ ] Mobile responsiveness maintained on all breakpoints
- [ ] Before/after screenshots captured for 20+ key components
- [ ] Accessibility maintained (WCAG AA contrast ratios)

### QA Checklist (Sample 40-50 Components)

```
Form Components (12 items):
  ☐ Text input (focus, error, disabled)
  ☐ Email input (validation states)
  ☐ Password input (show/hide toggle)
  ☐ Select dropdown (default, open, selected)
  ☐ Checkbox (checked, unchecked, indeterminate)
  ☐ Radio button (selected, unselected)
  ☐ Textarea (single/multi-line, focus, error)
  ☐ File input (hover, selected)
  ☐ Label styling + spacing
  ☐ Floating label (if present)
  ☐ Help text styling
  ☐ Error message styling

Buttons & Controls (10 items):
  ☐ Primary button (default, hover, active, disabled)
  ☐ Secondary button (default, hover, active, disabled)
  ☐ Danger button (default, hover, active, disabled)
  ☐ Button with icon
  ☐ Small button variant
  ☐ Large button variant
  ☐ Icon button (no text)
  ☐ Loading state (spinner)
  ☐ Link styled as button
  ☐ Button group / split buttons

Cards & Containers (8 items):
  ☐ Basic card
  ☐ Card with border
  ☐ Card with hover effect
  ☐ Modal card
  ☐ Panel / section card
  ☐ Navigation card
  ☐ Dashboard card
  ☐ Alert/message box styling

Navigation & Menus (6 items):
  ☐ Top navigation bar
  ☐ Sidebar navigation
  ☐ Breadcrumbs
  ☐ Dropdown menu
  ☐ Submenu (nested)
  ☐ Active state indication

Feedback Elements (8 items):
  ☐ Tooltip (position, timing)
  ☐ Alert/message (success, error, warning, info)
  ☐ Badge (default, colored variants)
  ☐ Progress bar (determinate, indeterminate)
  ☐ Spinner/loading indicator
  ☐ Confirmation dialog
  ☐ Notification toast
  ☐ Skeleton loader

Dark Mode (5 items):
  ☐ Form elements (dark mode)
  ☐ Buttons (dark mode)
  ☐ Cards (dark mode)
  ☐ Text contrast (WCAG AA)
  ☐ Color contrast ratio >= 4.5:1
```

### Files to Modify

```
apps/web/
├── app/
│   └── design-system.css                         (modify: all 13 patches)
├── styles/
│   ├── components/
│   │   ├── buttons.css                           (modify)
│   │   ├── forms.css                             (modify)
│   │   ├── cards.css                             (modify)
│   │   └── navigation.css                        (modify)
│   └── theme.css                                 (modify)
└── components/
    ├── Button.tsx                                (modify: class names)
    ├── Input.tsx                                 (modify: class names)
    ├── Card.tsx                                  (modify: class names)
    └── [40+ other components]                    (modify: as needed)
```

### Next Action

```
1. Review docs/BEAUTIFICATION-PATCHES.md
2. Pick batch (e.g., "Form Components" — 3 patches)
3. Apply CSS changes to design-system.css
4. Test 10-12 form components (input, select, checkbox, etc.)
5. Screenshot before/after
6. Move to next batch (Buttons, Cards, etc.)
7. Full QA on 40-50 components
8. Final sign-off + deploy
```

---

## 🔓 Priority 4: Free-Access Mode Deployment

### Status: Code Ready → Awaiting Deployment
**Effort:** 15-30 minutes = **< 1 hour total**  
**Blocking:** No other tasks  
**Blocked By:** Production database access

### What's Done
- ✅ Database migration: `migrations/1788378476000_add-free-access-mode.js`
- ✅ Admin endpoint: `app/api/admin/enable-free-access/route.ts`
- ✅ Direct control: `app/api/admin/workspaces/[id]/free-access/route.ts`
- ✅ Query helper: Enrollments respect `free_access_mode = true`

### What Free-Access Mode Does
- ✅ Unlocks all lessons and chapters
- ✅ Bypasses all prerequisite gates
- ✅ Auto-approves all submissions
- ✅ Perfect for demo/trial workspaces

### What's NOT Done
- 🔄 Enable for `goldmanadvertising` workspace (awaiting production deployment)
- 🔄 UI toggle in admin dashboard (if desired)
- 🔄 Audit logging (who enabled it, when)

### Code Examples

#### 4.1: Database Migration (Already Done)

```typescript
// apps/web/migrations/1788378476000_add-free-access-mode.js
exports.up = (pgm) => {
  // Add free_access_mode column to workspaces table
  pgm.addColumn('workspaces', {
    free_access_mode: {
      type: 'boolean',
      default: false,
      notNull: true,
    },
  });

  // Add index for performance
  pgm.createIndex('workspaces', ['free_access_mode']);
};

exports.down = (pgm) => {
  pgm.dropColumn('workspaces', 'free_access_mode');
};
```

#### 4.2: Admin Endpoint (Already Done)

```typescript
// apps/web/app/api/admin/workspaces/[id]/free-access/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { withAdvisoryLock } from '@/lib/db';
import { pool } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser(req.headers.get('cookie'));
    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { enabled } = await req.json();

    // Use advisory lock for consistency
    await withAdvisoryLock('workspace:' + params.id, async () => {
      await pool.query(
        'UPDATE workspaces SET free_access_mode = $1 WHERE id = $2',
        [enabled, params.id]
      );
    });

    return NextResponse.json({ success: true, free_access_mode: enabled });
  } catch (error) {
    console.error('Error updating free-access mode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser(req.headers.get('cookie'));
    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const result = await pool.query(
      'SELECT free_access_mode FROM workspaces WHERE id = $1',
      [params.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      free_access_mode: result.rows[0].free_access_mode,
    });
  } catch (error) {
    console.error('Error fetching free-access mode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 4.3: Enrollment Query Helper (Integration)

```typescript
// lib/enrollments.ts (add this to existing file)
import { pool } from '@/lib/db';

/**
 * Check if a workspace has free-access mode enabled
 * If enabled, all lessons and chapters are unlocked, all gates auto-pass
 */
export async function isFreeAccessEnabled(workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT free_access_mode FROM workspaces WHERE id = $1',
    [workspaceId]
  );

  return result.rows[0]?.free_access_mode ?? false;
}

/**
 * Get gate status for a chapter (respecting free-access mode)
 */
export async function getChapterGateStatus(
  workspaceId: string,
  chapterNumber: number
) {
  const freeAccess = await isFreeAccessEnabled(workspaceId);

  if (freeAccess) {
    return {
      locked: false,
      approved: true,
      canSubmit: true,
      reason: 'Free access mode enabled',
    };
  }

  // Normal gate logic continues...
  const result = await pool.query(
    `SELECT approved_at FROM chapter_approvals 
     WHERE workspace_id = $1 AND chapter = $2`,
    [workspaceId, chapterNumber]
  );

  return {
    locked: !result.rows[0],
    approved: !!result.rows[0],
    canSubmit: true,
  };
}
```

#### 4.4: Direct SQL Command (Alternative)

```sql
-- Direct DB access (if you have it)
-- Enable free-access mode for goldmanadvertising workspace

UPDATE workspaces 
SET free_access_mode = true 
WHERE LOWER(name) LIKE '%goldmanadvertising%';

-- Verify
SELECT id, name, free_access_mode FROM workspaces 
WHERE LOWER(name) LIKE '%goldmanadvertising%';

-- Check enrollment status (should show all chapters unlocked)
SELECT 
  w.id,
  w.name,
  w.free_access_mode,
  e.enrollment->>'current_chapter' as current_chapter
FROM workspaces w
LEFT JOIN enrollments e ON w.id = e.workspace_id
WHERE LOWER(w.name) LIKE '%goldmanadvertising%';
```

#### 4.5: Admin Dashboard Toggle (Optional UI)

```typescript
// apps/web/components/admin/WorkspaceSettings.tsx (new section)
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [freeAccessMode, setFreeAccessMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggleFreeAccess = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/free-access`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !freeAccessMode }),
        }
      );

      if (response.ok) {
        setFreeAccessMode(!freeAccessMode);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-semibold mb-4">Access Settings</h3>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Free Access Mode</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Unlock all lessons and auto-approve submissions
          </p>
        </div>

        <button
          onClick={handleToggleFreeAccess}
          disabled={loading}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            freeAccessMode
              ? 'bg-green-500'
              : 'bg-slate-300 dark:bg-slate-600'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              freeAccessMode ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {freeAccessMode && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ Free access is <strong>ENABLED</strong>. This workspace can access all lessons
            without coaching gates.
          </p>
        </div>
      )}
    </div>
  );
}
```

### Success Criteria (Phase 4)

- [ ] Migration runs successfully on production
- [ ] `goldmanadvertising` workspace has `free_access_mode = true`
- [ ] User can access all 4 chapters without coach approval
- [ ] Submissions auto-approve (if present in system)
- [ ] No errors in logs after enabling
- [ ] Admin can toggle on/off without downtime

### Deployment Steps

**Option A: API Endpoint (Recommended)**

```bash
# 1. Get the goldmanadvertising workspace ID
curl -X GET https://onevyrt.masteryresearch.com/api/admin/workspaces \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.workspaces[] | select(.name | contains("goldmanadvertising"))'

# 2. Enable free-access mode
curl -X POST https://onevyrt.masteryresearch.com/api/admin/workspaces/[ID]/free-access \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 3. Verify
curl -X GET https://onevyrt.masteryresearch.com/api/admin/workspaces/[ID]/free-access \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Option B: Direct SQL (If DB Access Available)**

```bash
# 1. Connect to Postgres
psql postgresql://user:pass@fly.io:5432/onevyrt

# 2. Run update
UPDATE workspaces 
SET free_access_mode = true 
WHERE LOWER(name) LIKE '%goldmanadvertising%';

# 3. Verify
SELECT id, name, free_access_mode FROM workspaces 
WHERE LOWER(name) LIKE '%goldmanadvertising%';
```

### Next Action

```
1. Decide: API endpoint or direct SQL?
2. Get workspace ID for goldmanadvertising
3. Run enable command
4. Log in to goldmanadvertising account
5. Verify all chapters accessible (no gates)
6. Test submission flow (if applicable)
7. Done!
```

---

## 🎯 Visual Decision Flowchart

```
START: Which task do you want to do?
│
├─→ Want to improve demo/trial UX?
│   YES: Priority 4 (Free-Access Mode)
│   └─ Effort: <1h | Impact: High | Risk: Low
│   └─ Go to: Section 4 (Deployment Steps)
│
├─→ Want to improve funnel builder?
│   YES: Priority 1 (UI Restructuring)
│   └─ Effort: 6-9h | Impact: High | Risk: Medium
│   └─ Go to: Section 1 (Code Examples 1.1-1.4)
│
├─→ Want to polish visual design?
│   YES: Priority 3 (CSS Beautification)
│   └─ Effort: 6-9h | Impact: Medium | Risk: Very Low
│   └─ Go to: Section 3 (Code Examples 3.1-3.4)
│
└─→ Want to improve lesson engagement?
    YES: Priority 2 (Lesson Visuals)
    └─ Effort: 34-50h total | Impact: Medium-High | Risk: Very Low
    └─ Go to: Section 2 (Code Examples 2.1-2.3)

       Recommended Sequence:
       1. Priority 4 (Quick Win) — <1h
       2. Priority 1 (High Impact) — 6-9h
       3. Priority 3 (Polish) — 6-9h
       4. Priority 2 (Engagement) — 34-50h (phase by phase)
```

---

## 📊 Task Dependency & Timeline Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ TASK DEPENDENCIES & EFFORT ESTIMATES                             │
└─────────────────────────────────────────────────────────────────┘

Priority 4: Free-Access Mode
├─ Effort: 0.5h (deployment only)
├─ Dependencies: None
├─ Blocking: Nothing
├─ Risk: Very Low
└─ Start: Today (quickest win)

Priority 1: Funnel Builder UI
├─ Effort: 6-9h total (4-6h impl + 2-3h QA)
├─ Dependencies: None
├─ Blocking: Nothing
├─ Risk: Medium (UI changes, extensive testing)
└─ Start: After Priority 4 (or parallel)

Priority 3: UI Beautification
├─ Effort: 6-9h total (2-3h impl + 4-6h QA)
├─ Dependencies: Design System (✅ done)
├─ Blocking: Nothing
├─ Risk: Very Low (CSS only)
└─ Start: Anytime (parallel-friendly)

Priority 2: Lesson Visuals
├─ Effort: 34-50h total (can be phased)
│  ├─ Phase 1 (3 lessons): 8-12h
│  ├─ Phase 2 (4-6 lessons): 6-8h
│  └─ Scaling (19+ lessons): 20-30h
├─ Dependencies: Design System (✅ done)
├─ Blocking: Nothing
├─ Risk: Very Low (additive, no breaking changes)
└─ Start: After initial priorities (or parallel per lesson)

Priority 5: Testing & Deployment
├─ Effort: 6-8h (E2E tests, performance, production prep)
├─ Dependencies: All of 1-4 (ready for final integration)
├─ Blocking: Production deployment
├─ Risk: Medium (cross-system testing)
└─ Start: After Priorities 1-3 complete

TOTAL ESTIMATED EFFORT:
  ├─ Quick Path (4 only): 0.5h
  ├─ Core Path (4 + 1 + 3): 12.5-19h
  ├─ Engagement Path (+ 2 Phase 1): 20.5-31h
  ├─ Full Path (all phases): 58-87h
  └─ Team Recommendation: Phase weekly
```

---

## ✅ Success Criteria per Phase

### Phase 1 Complete (Baseline)
- [x] Design System shipped (tokens, colors, icons)
- [x] Interactive prototypes created (3 UI approaches)
- [x] Documentation complete (4 guides, 78KB)

### Phase 2 - Quick Wins (This Week)
**Criteria:**
- [ ] Free-Access Mode deployed (goldmanadvertising live)
- [ ] Funnel Builder UI approach selected
- [ ] Phase 1 Funnel Builder components coded & integrated
- [ ] Phase 1 Lesson Visuals: Business Definition + Sales Funnel + Financial Dashboard done
- [ ] All components tested on mobile + dark mode

**Timeline:** 3-4 days (1-2 team members)

### Phase 3 - Polish & Scale (Next Week)
**Criteria:**
- [ ] Funnel Builder fully integrated + QA passed
- [ ] CSS Beautification patches applied + QA passed (40-50 components sampled)
- [ ] Phase 2 Lesson Visuals (4-6 lessons) complete
- [ ] Before/after screenshots captured for review
- [ ] No performance regression (< 2s page load)

**Timeline:** 4-5 days (1-2 team members)

### Phase 4 - Full Scale (Weeks 3-4)
**Criteria:**
- [ ] All 25+ lessons have visual components
- [ ] Export to PDF working on lesson visuals
- [ ] Full QA pass (all browsers, dark mode, mobile)
- [ ] No open bugs or performance issues
- [ ] Documentation updated with all new components

**Timeline:** 2 weeks (parallel work)

### Phase 5 - Production Deploy (End of Month)
**Criteria:**
- [ ] E2E test coverage complete (auth, funnels, submissions, exports)
- [ ] Performance benchmarks met (LCP < 2.5s, CLS < 0.1)
- [ ] Bundle size audit completed
- [ ] Production deployment checklist passed
- [ ] Monitoring + alerting configured

**Timeline:** 1 week (pre-launch)

---

## 🚨 Troubleshooting & Common Pitfalls

### Priority 1: Funnel Builder UI

**Problem:** TypeScript errors in new layout components

**Solution:**
```typescript
// Ensure all React hooks are properly typed
import { FC, ReactNode, useState } from 'react';

interface Props {
  children: ReactNode;
  isOpen: boolean;
}

export const Panel: FC<Props> = ({ children, isOpen }) => {
  // ...
};
```

**Problem:** Layout breaks on mobile (sidebar too wide)

**Solution:**
```typescript
// apps/web/components/studio/layouts/SplitViewLayout.tsx
export function FunnelBuilderSplitView() {
  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Canvas: Full width on mobile, flex-1 on desktop */}
      <div className="flex-1 lg:border-r">...</div>

      {/* Sidebar: Hidden on mobile, visible on lg+ */}
      <div className="hidden lg:flex w-80 border-l">...</div>

      {/* Mobile toggle button */}
      <div className="lg:hidden fixed bottom-4 right-4">
        {/* Toggle sidebar visibility */}
      </div>
    </div>
  );
}
```

**Problem:** State not persisting after page reload

**Solution:**
```typescript
// Use localStorage to persist layout preference
useEffect(() => {
  const saved = localStorage.getItem('funnel-layout');
  if (saved) setLayout(saved);
}, []);

useEffect(() => {
  localStorage.setItem('funnel-layout', layout);
}, [layout]);
```

---

### Priority 2: Lesson Visuals

**Problem:** SVG not rendering in dark mode

**Solution:**
```typescript
// Use CSS custom properties for colors
const COLORS = {
  dark: {
    text: 'var(--text-primary)', // resolves to #1f2937 light, #f3f4f6 dark
    bg: 'var(--bg-secondary)',
    accent: 'var(--color-blue-500)',
  },
};

<text fill={COLORS.dark.text} />
```

**Problem:** Chart flickers when switching dark mode

**Solution:**
```typescript
// Force re-render on theme change
import { useEffect, useState } from 'react';

export function Visualization() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const listener = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', listener);

    return () =>
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', listener);
  }, []);

  return <SVGChart key={theme} theme={theme} />;
}
```

**Problem:** Export to PDF not working (jsPDF timeout)

**Solution:**
```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportVisualizerAsPDF(
  elementId: string,
  filename: string
) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  // Use higher scale for better quality
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
```

---

### Priority 3: CSS Beautification

**Problem:** Shadow colors not working in dark mode

**Solution:**
```css
/* Define shadows separately for light and dark modes */
:root {
  --shadow-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --shadow-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

/* Or use data attribute */
[data-theme="dark"] {
  --shadow-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3);
}
```

**Problem:** Button hover state not smooth

**Solution:**
```css
button {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

button:hover {
  /* Use transform for GPU acceleration */
  transform: translateY(-1px);
  box-shadow: var(--shadow-elevation-2);
  background-color: /* darker color */;
}
```

**Problem:** Focus ring not visible on all components

**Solution:**
```css
/* Use :focus-visible instead of :focus */
input:focus-visible,
button:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid var(--color-blue-500);
  outline-offset: 2px;
}

/* For dark mode */
@media (prefers-color-scheme: dark) {
  input:focus-visible {
    outline: 2px solid var(--color-blue-400);
  }
}
```

---

### Priority 4: Free-Access Mode

**Problem:** Migration fails because column already exists

**Solution:**
```typescript
// Check if migration has been run
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'workspaces' AND column_name = 'free_access_mode';

// If it exists, the migration already ran (safe to re-deploy)
// If it doesn't, run migration manually
psql postgresql://user@host/db -f migration.sql
```

**Problem:** API endpoint returns 403 Unauthorized

**Solution:**
```typescript
// Ensure user is admin
export async function POST(req: NextRequest) {
  const user = await currentUser(req.headers.get('cookie'));

  // Check admin status in user object
  console.log('User:', { id: user.id, isAdmin: user.isAdmin });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized', debug: { isAdmin: user?.isAdmin } },
      { status: 403 }
    );
  }

  // ... rest of handler
}
```

**Problem:** Free-access mode enabled but chapters still locked

**Solution:**
```typescript
// Check gate logic respects free_access_mode
// lib/enrollment-gates.ts should have:

if (await isFreeAccessEnabled(workspaceId)) {
  // Skip all gate checks
  return { locked: false, approved: true };
}

// If gate logic doesn't check free_access_mode,
// add this check to chapterGates() function
```

---

### General Troubleshooting

**Problem:** Bundle size increases after changes

**Solution:**
```bash
# Analyze bundle
ANALYZE=true pnpm build

# Check for duplicate dependencies
pnpm ls --depth=0

# Remove unused imports
pnpm add -D depcheck
depcheck
```

**Problem:** Performance regression after UI changes

**Solution:**
```bash
# Profile with Lighthouse
lighthouse https://onevyrt.masteryresearch.com --view

# Check Core Web Vitals
# LCP (Largest Contentful Paint) < 2.5s ✓
# FID (First Input Delay) < 100ms ✓
# CLS (Cumulative Layout Shift) < 0.1 ✓

# If regression, check:
# 1. Added unoptimized images (use next/image)
# 2. Added synchronous scripts (make async)
# 3. Added large dependencies (lazy-load)
```

**Problem:** Dark mode not working in new components

**Solution:**
```typescript
// Ensure Tailwind dark mode is configured
// tailwind.config.js
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  // ...
};

// Use dark: prefix in components
<div className="bg-white dark:bg-slate-900">
  {/* Light: white background, Dark: slate-900 */}
</div>

// For custom colors, use CSS variables
<div className="text-[var(--text-primary)]">
  {/* Resolves based on prefers-color-scheme or data-theme */}
</div>
```

---

## 📚 Additional Resources

- `docs/DESIGN-TOKENS.md` — Color palette reference
- `docs/LESSON-VISUALS-TEMPLATE.md` — Reusable template for new lesson visuals
- `docs/BEAUTIFICATION-PATCHES.md` — Detailed CSS patch guide
- `docs/FUNNEL-BUILDER-RESTRUCTURING.md` — UI approach comparison
- `CLAUDE.md` — Project architecture & codebase overview
- `Performance Optimization Strategy` — Bundle size, optimization, monitoring

---

## 🎯 Next Steps (This Week)

**Today:**
- [ ] Review this enhanced tracker
- [ ] Decide priority order (recommended: 4 → 1 → 3 → 2)
- [ ] Assign task owners

**This Week:**
- [ ] Complete Priority 4 (Free-Access Mode deployment: < 1h)
- [ ] Start Priority 1 (Funnel Builder UI: 6-9h)
- [ ] QA Priority 1 (Mobile + dark mode: 2-3h)

**Next Week:**
- [ ] Complete Priority 1 integration testing
- [ ] Start Priority 3 (CSS Beautification: 2-3h)
- [ ] Begin Priority 2 Phase 1 (Lesson Visuals: 8-12h)

**Weeks 3-4:**
- [ ] Complete Priority 2 scaling (all 25+ lessons)
- [ ] Priority 5 testing & deployment

---

**Questions?** Refer to the detailed code examples, timeline breakdowns, and troubleshooting section above. Each priority has actionable steps and proven solutions.

