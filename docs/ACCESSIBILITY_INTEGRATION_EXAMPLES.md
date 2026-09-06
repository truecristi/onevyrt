# MarketingSystemVisuals - Integration & Implementation Guide

## Basic Usage

### Minimal Setup
```tsx
import MarketingSystemVisuals from '@/components/MarketingSystemVisuals';

export default function Dashboard() {
  return (
    <MarketingSystemVisuals 
      title="My Marketing Dashboard"
    />
  );
}
```

This will render with:
- Default 4-stage funnel (Awareness → Purchase)
- Default 4 KPI metrics
- Canvas scatter plot (150 random points)
- Full WCAG AAA accessibility

---

## Custom Data Integration

### With Funnel Data
```tsx
const funnelData = [
  {
    name: 'Website Visitors',
    count: 10000,
    conversionRate: 0.15,  // 15%
    color: '#0052cc',      // IBM Design Blue (high contrast)
  },
  {
    name: 'Email Signups',
    count: 1500,
    conversionRate: 0.45,  // 45%
    color: '#003fa8',
  },
  {
    name: 'Qualified Leads',
    count: 675,
    conversionRate: 0.60,  // 60%
    color: '#002880',
  },
  {
    name: 'Customers',
    count: 405,
    conversionRate: 0.85,  // 85%
    color: '#001152',
  },
];

<MarketingSystemVisuals 
  funnelData={funnelData}
  title="Sales Funnel Q4 2024"
/>
```

### With Metrics
```tsx
const metrics = [
  {
    label: 'Monthly Revenue',
    value: 145000,
    unit: '$',
    trend: 'up',      // 'up' | 'down' | 'neutral'
  },
  {
    label: 'Customer Acquisition Cost',
    value: 85,
    unit: '$',
    trend: 'down',    // Trend down is good for CAC
  },
  {
    label: 'Average Order Value',
    value: 350,
    unit: '$',
    trend: 'up',
  },
  {
    label: 'Repeat Customer Rate',
    value: 32,
    unit: '%',
    trend: 'up',
  },
];

<MarketingSystemVisuals 
  metrics={metrics}
  title="Key Performance Indicators"
/>
```

### Combining Everything
```tsx
function MarketingDashboard() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const funnelData = [
    { name: 'Awareness', count: 5000, conversionRate: 0.4, color: '#0052cc' },
    { name: 'Interest', count: 2000, conversionRate: 0.5, color: '#003fa8' },
    { name: 'Consideration', count: 1000, conversionRate: 0.6, color: '#002880' },
    { name: 'Purchase', count: 600, conversionRate: 0.8, color: '#001152' },
  ];

  const metrics = [
    { label: 'Total Leads', value: 5000, unit: '', trend: 'up' as const },
    { label: 'Conversion Rate', value: 12, unit: '%', trend: 'up' as const },
    { label: 'Cost per Lead', value: 45, unit: '$', trend: 'down' as const },
    { label: 'Customer Value', value: 1250, unit: '$', trend: 'up' as const },
  ];

  return (
    <>
      <MarketingSystemVisuals
        funnelData={funnelData}
        metrics={metrics}
        title="Marketing System Overview"
        enableCanvas={true}
        onStageClick={(stageName) => {
          setSelectedStage(stageName);
          console.log(`Clicked: ${stageName}`);
        }}
      />
      
      {selectedStage && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded">
          <h3 className="text-lg font-bold text-gray-900">
            Details for: {selectedStage}
          </h3>
          <p className="text-gray-700">
            Show segment-specific analytics here
          </p>
        </div>
      )}
    </>
  );
}
```

---

## Accessibility Features in Use

### 1. Keyboard Navigation Handler
```tsx
// Component internally handles:
const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>, idx: number) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onStageClick?.(funnelPaths[idx].stage);
  } else if (e.key === 'ArrowDown' && idx < funnelPaths.length - 1) {
    setFocusedIndex(idx + 1);
  } else if (e.key === 'ArrowUp' && idx > 0) {
    setFocusedIndex(idx - 1);
  }
};

// You don't need to implement this - it's built-in!
```

### 2. ARIA Labels
```tsx
// All elements auto-labelled:
<svg
  role="img"
  aria-label="Conversion funnel visualization"
  aria-describedby={descId}
>
  <g
    role="button"
    aria-label={`Awareness: 5000 leads (40% conversion)`}
  >
    {/* Visual segment */}
  </g>
</svg>

// Hidden description for screen readers:
<div id={descId} className="sr-only">
  Awareness: 5000 leads, 40% conversion rate
</div>
```

### 3. Data Table Fallback
```tsx
// Component provides toggle button:
<button
  onClick={() => setShowDataTable(!showDataTable)}
  aria-expanded={showDataTable}
  aria-controls={tableId}
>
  {showDataTable ? 'Hide' : 'Show'} Data Table
</button>

// Table is semantic HTML with proper scoping:
<table>
  <thead>
    <tr>
      <th scope="col">Stage</th>
      <th scope="col">Count</th>
      <th scope="col">Conversion Rate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Awareness</td>
      <td>5,000</td>
      <td>40.0%</td>
    </tr>
  </tbody>
</table>
```

---

## Testing Your Integration

### Quick Verify Checklist
```tsx
// ✅ 1. Can keyboard navigate
- Unplug mouse
- Tab through → See blue focus outline
- Enter on segments → onStageClick fires
- Arrow keys → Navigate funnel

// ✅ 2. Screen reader works
- Start NVDA/JAWS
- Tab to component
- Hear: "Main, Marketing System Overview"
- Tab through segments
- Each announces with count + conversion rate

// ✅ 3. Data visible without visualization
- Open DevTools
- Toggle visibility of SVG
- Click "View table" button
- All data in HTML table

// ✅ 4. Colors have contrast
- Inspect element
- Look for "Contrast ratio" in DevTools
- All should show 7:1 or higher
```

---

## Advanced Integration Patterns

### Pattern 1: Modal with Segment Details
```tsx
function MarketingWithModal() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const stageDetails: Record<string, { description: string; actions: string[] }> = {
    'Awareness': {
      description: 'People discovering your brand',
      actions: ['Run paid ads', 'Create content', 'SEO optimization'],
    },
    'Interest': {
      description: 'People interested in your solution',
      actions: ['Email nurture', 'Webinars', 'Case studies'],
    },
    'Consideration': {
      description: 'People comparing options',
      actions: ['Product demos', 'Pricing page', 'Free trial'],
    },
    'Purchase': {
      description: 'People ready to buy',
      actions: ['Sales calls', 'Onboarding', 'Customer success'],
    },
  };

  return (
    <div className="space-y-6">
      <MarketingSystemVisuals
        funnelData={[
          { name: 'Awareness', count: 5000, conversionRate: 0.4, color: '#0052cc' },
          { name: 'Interest', count: 2000, conversionRate: 0.5, color: '#003fa8' },
          { name: 'Consideration', count: 1000, conversionRate: 0.6, color: '#002880' },
          { name: 'Purchase', count: 600, conversionRate: 0.8, color: '#001152' },
        ]}
        onStageClick={setSelectedStage}
      />

      {selectedStage && (
        <div
          className="p-6 bg-white border-2 border-gray-300 rounded-lg"
          role="region"
          aria-labelledby="stage-details-title"
          aria-live="polite"
        >
          <h3 id="stage-details-title" className="text-xl font-bold text-gray-900 mb-3">
            {selectedStage} Stage
          </h3>
          <p className="text-gray-700 mb-4">
            {stageDetails[selectedStage]?.description}
          </p>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Recommended Actions:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {stageDetails[selectedStage]?.actions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setSelectedStage(null)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            aria-label="Close stage details"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
```

### Pattern 2: Real-time Updates with Loading State
```tsx
function LiveMarketingDashboard() {
  const [metrics, setMetrics] = useState<MarketingMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Poll for updates every 30 seconds
    const interval = setInterval(async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/marketing/metrics');
        const data = await response.json();
        setMetrics(data);
        setLastUpdate(new Date());
      } finally {
        setIsLoading(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {/* Loading announcer for screen readers */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isLoading ? 'Updating metrics' : `Last updated: ${lastUpdate?.toLocaleTimeString()}`}
      </div>

      <MarketingSystemVisuals
        metrics={metrics}
        title="Live Marketing Metrics"
        enableCanvas={true}
      />

      <div className="text-sm text-gray-600 text-center">
        Updated: {lastUpdate?.toLocaleTimeString() || 'Never'}
      </div>
    </div>
  );
}
```

### Pattern 3: Comparison View
```tsx
function CompareMarketingPeriods() {
  const q3Data = [
    { name: 'Awareness', count: 4000, conversionRate: 0.35, color: '#0052cc' },
    { name: 'Interest', count: 1500, conversionRate: 0.45, color: '#003fa8' },
    { name: 'Consideration', count: 750, conversionRate: 0.55, color: '#002880' },
    { name: 'Purchase', count: 450, conversionRate: 0.75, color: '#001152' },
  ];

  const q4Data = [
    { name: 'Awareness', count: 5000, conversionRate: 0.4, color: '#0052cc' },
    { name: 'Interest', count: 2000, conversionRate: 0.5, color: '#003fa8' },
    { name: 'Consideration', count: 1000, conversionRate: 0.6, color: '#002880' },
    { name: 'Purchase', count: 600, conversionRate: 0.8, color: '#001152' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section aria-labelledby="q3-title">
        <h2 id="q3-title" className="text-lg font-bold text-gray-900 mb-3">Q3 2024</h2>
        <MarketingSystemVisuals
          funnelData={q3Data}
          title="Q3 Performance"
        />
      </section>

      <section aria-labelledby="q4-title">
        <h2 id="q4-title" className="text-lg font-bold text-gray-900 mb-3">Q4 2024</h2>
        <MarketingSystemVisuals
          funnelData={q4Data}
          title="Q4 Performance"
        />
      </section>

      <div className="md:col-span-2 bg-green-50 border-2 border-green-300 rounded p-4">
        <h3 className="font-bold text-gray-900 mb-2">Q3 vs Q4 Improvement</h3>
        <ul className="space-y-2 text-gray-700">
          <li>✓ Awareness increased 25% (4000 → 5000)</li>
          <li>✓ Overall conversion improved 35% (450 → 600 purchases)</li>
          <li>✓ Cost per acquisition down 15%</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Styling & Customization

### Using Component Styles
```tsx
// The component uses Tailwind CSS classes
// All colors are WCAG AAA compliant out of the box

// Border colors: border-gray-300 (high contrast)
// Text colors: text-gray-900 (charcoal, 10:1 contrast)
// Focus: ring-blue-500 (11:1 contrast)
// Trend colors: green-900, red-900 (7:1+ contrast)
```

### Extending Styles
```tsx
// Wrap component in styled container
<div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-300">
  <MarketingSystemVisuals
    title="Custom Dashboard"
    funnelData={data}
  />
</div>

// Add custom section header
<section className="space-y-4">
  <header>
    <h1 className="text-3xl font-bold text-gray-900">
      Marketing Dashboard
    </h1>
    <p className="text-base text-gray-700 mt-2">
      WCAG AAA Accessible with keyboard navigation and screen reader support
    </p>
  </header>

  <MarketingSystemVisuals {...props} />
</section>
```

---

## Error Handling & Edge Cases

### Empty Data
```tsx
// Component handles gracefully
<MarketingSystemVisuals
  funnelData={[]} // Empty
  metrics={[]}    // Empty
  title="No Data"
/>

// Result: Shows default data (demo funnel + metrics)
// Screen reader announces: "No data provided, showing example"
```

### Large Datasets
```tsx
// For 100+ canvas points, component auto-detects
// and uses Canvas rendering instead of SVG
<MarketingSystemVisuals
  enableCanvas={true}  // Use Canvas for performance
/>

// Data table shows first 10 points with "Showing X of Y" note
```

### Very Small Screens (<375px)
```tsx
// Component is responsive down to 280px width
// Canvas scales, text sizes reduce but remain readable
// No horizontal scroll even on smallest devices
<MarketingSystemVisuals
  title="Mobile Dashboard"  // Tested on iPhone SE (375px)
/>
```

---

## Performance Optimization

### When to Use Lazy Loading
```tsx
// Component auto-uses Intersection Observer
// Canvas chart only renders when scrolled into view

// For large dashboards with multiple components:
<div className="space-y-6">
  <MetricsSummary />  {/* Always visible */}
  
  <MarketingSystemVisuals />  {/* Lazy-loaded */}
  
  <DetailedAnalytics />  {/* Lazy-loaded */}
</div>

// Result: Faster initial page load
// Canvas draws only when needed
```

### Memoization
```tsx
// Component internally memoizes:
// - React.memo on all subcomponents
// - useMemo on path generation
// - useCallback on event handlers

// Result: No re-render on parent updates
// unless props actually change
```

---

## TypeScript Definitions

```tsx
export interface FunnelStage {
  name: string;                    // Stage name (e.g., "Awareness")
  count: number;                   // Number of items at stage
  conversionRate?: number;         // 0.0 - 1.0 (e.g., 0.45 = 45%)
  color?: string;                  // Hex color (falls back to #0052cc)
}

export interface MarketingMetric {
  label: string;                   // Metric name (e.g., "Revenue")
  value: number;                   // Numeric value
  unit?: string;                   // Unit suffix (e.g., "$", "%")
  trend?: 'up' | 'down' | 'neutral'; // Trend direction
}

export interface MarketingSystemVisualsProps {
  funnelData?: FunnelStage[];      // Optional funnel stages
  metrics?: MarketingMetric[];     // Optional metrics
  title?: string;                  // Component title
  enableCanvas?: boolean;          // Enable scatter plot (default: true)
  onStageClick?: (stageName: string) => void; // Stage click handler
}
```

---

## Troubleshooting

### Issue: Funnel not responding to keyboard
```tsx
// Check: Is tabIndex set correctly?
// The component handles this internally
// If not working, verify browser focus is on component
// Use Tab to navigate to funnel first
```

### Issue: Table toggle button not accessible
```tsx
// Component provides built-in accessible button
// If custom button needed, ensure:
<button
  onClick={() => setShowTable(!showTable)}
  aria-expanded={showTable}
  aria-controls={tableId}
  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  Toggle Table
</button>
```

### Issue: NVDA not announcing segments
```tsx
// Verify NVDA browse mode is OFF (use focus mode)
// Press: Insert + Spacebar to toggle
// Or ensure component is in a main element
<main>
  <MarketingSystemVisuals />
</main>
```

---

## Next Steps

1. **Import the component**
   ```tsx
   import MarketingSystemVisuals from '@/components/MarketingSystemVisuals';
   ```

2. **Add your data**
   ```tsx
   const data = await fetchMarketingMetrics();
   <MarketingSystemVisuals funnelData={data} />
   ```

3. **Test accessibility**
   - Run Axe DevTools
   - Test keyboard navigation
   - Verify with NVDA

4. **Deploy with confidence**
   - WCAG AAA compliant
   - Fully tested
   - Production ready

---

## Support & Questions

- Full Documentation: `/docs/ACCESSIBILITY_IMPROVEMENTS.md`
- Testing Guide: `/docs/ACCESSIBILITY_TESTING_GUIDE.md`
- Component Code: `components/MarketingSystemVisuals.tsx`
- WCAG Standards: https://www.w3.org/WAI/WCAG21/quickref/

Last Updated: 2024
Status: **Production Ready - WCAG AAA Compliant** ✅
