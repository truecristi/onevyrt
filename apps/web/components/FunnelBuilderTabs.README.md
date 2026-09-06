# FunnelBuilderTabs Component

Production-ready React component for managing funnel design with three interactive tabs: Canvas, Metrics, and Blocks.

## Overview

**FunnelBuilderTabs** is a comprehensive funnel management interface featuring:
- **Canvas Tab**: Full-screen funnel node visualization with connections
- **Metrics Tab**: Responsive grid of KPI cards with trend indicators
- **Blocks Tab**: 2-column grid of reusable automation blocks (email, SMS, webhooks, etc.)

## Features

### Tabs & Navigation
- 3 main tabs with animated underline indicator
- Smooth 300ms fade transition between tab content
- Keyboard-accessible tab switching
- Active tab state management

### Metrics Tab
- Auto-fit responsive grid (minimum 150px, scales with viewport)
- Metric cards with:
  - Label and value display
  - Optional unit text
  - Trend indicators (up/down with percentage)
  - Hover effects and shadows
  - Click callbacks for detail views

### Blocks Tab
- 2-column responsive grid (1 column on mobile, 2 on desktop+)
- Block items with:
  - Icon and title
  - Optional description (line-clamped)
  - Block type badge (email, sms, webhook, condition, delay, action)
  - Draggable support (grab cursor)
  - Color-coded by type
  - Click callbacks for block configuration

### Canvas Tab
- Interactive node visualization
- Colored nodes by type:
  - Green: Entry points
  - Blue: Actions
  - Orange: Conditions
  - Red: Exit points
- Connection lines between nodes (SVG)
- Node selection with visual feedback (ring indicator)
- Absolute positioned nodes with pixel-perfect layout
- Click callbacks for node selection
- Empty state messaging
- Read-only mode support

### Design & Styling
- **Dark Mode**: Full dark theme support via Tailwind CSS
- **Mobile Responsive**: Stacked layouts on small screens
- **Accessibility**: Semantic HTML, focus states, ARIA labels
- **Animations**: Framer Motion for smooth transitions
- **Loading States**: Skeleton loaders for all tab content
- **Visual Hierarchy**: Proper spacing, typography, and color contrast

## Props

```typescript
interface FunnelBuilderTabsProps {
  funnel: FunnelData;                          // Required: funnel data
  activeTab?: TabType;                         // 'CANVAS' | 'METRICS' | 'BLOCKS' (default: 'CANVAS')
  onTabChange?: (tab: TabType) => void;        // Callback when tab changes
  onMetricClick?: (metric: MetricCard) => void; // Callback when metric is clicked
  onBlockSelect?: (block: Block) => void;      // Callback when block is selected
  onNodeSelect?: (node: Node) => void;         // Callback when node is clicked
  onCanvasUpdate?: (nodes: Node[]) => void;    // Callback when canvas is updated
  isLoading?: boolean;                         // Show loading skeleton (default: false)
  readOnly?: boolean;                          // Disable interactions (default: false)
}
```

## Type Definitions

### FunnelData
```typescript
interface FunnelData {
  id: string;
  name: string;
  metrics: MetricCard[];
  blocks: Block[];
  nodes: Node[];
  stats?: {
    totalVisitors: number;
    conversionRate: number;
    avgTimeOnPage: number;
    bounceRate: number;
  };
}
```

### MetricCard
```typescript
interface MetricCard {
  id: string;
  label: string;                              // e.g., "Total Visitors"
  value: string | number;                     // e.g., "2,451"
  unit?: string;                              // e.g., "visits"
  trend?: number;                             // percentage change (positive = up)
  status?: 'up' | 'down' | 'neutral';
}
```

### Block
```typescript
interface Block {
  id: string;
  title: string;                              // e.g., "Welcome Email"
  description?: string;
  icon?: React.ReactNode;                     // Custom icon (defaults to emoji)
  type: 'email' | 'sms' | 'webhook' | 'condition' | 'delay' | 'action';
  isDraggable?: boolean;
}
```

### Node
```typescript
interface Node {
  id: string;
  type: 'entry' | 'action' | 'condition' | 'exit';
  label: string;
  x: number;                                  // X coordinate (pixels)
  y: number;                                  // Y coordinate (pixels)
  metadata?: Record<string, unknown>;
}
```

## Usage

### Basic Integration

```typescript
import { FunnelBuilderTabs, FunnelData } from '@/components/FunnelBuilderTabs';

const funnelData: FunnelData = {
  id: 'funnel-1',
  name: 'Email Marketing Funnel',
  metrics: [
    { id: 'm1', label: 'Visitors', value: '1,200', unit: 'visits', trend: 5.2 },
    // ...
  ],
  blocks: [
    { id: 'b1', title: 'Send Email', type: 'email', isDraggable: true },
    // ...
  ],
  nodes: [
    { id: 'n1', type: 'entry', label: 'Start', x: 50, y: 50 },
    // ...
  ],
};

export default function FunnelPage() {
  const [activeTab, setActiveTab] = useState('CANVAS');

  return (
    <FunnelBuilderTabs
      funnel={funnelData}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onMetricClick={(metric) => console.log('Metric clicked:', metric)}
      onBlockSelect={(block) => console.log('Block selected:', block)}
      onNodeSelect={(node) => console.log('Node selected:', node)}
      isLoading={false}
      readOnly={false}
    />
  );
}
```

### With Event Handlers

```typescript
const handleMetricClick = (metric: MetricCard) => {
  // Open metric detail modal
  // Navigate to analytics page
  // Track user interaction
};

const handleBlockSelect = (block: Block) => {
  // Open block configuration panel
  // Show block properties
  // Enable drag-and-drop
};

const handleNodeSelect = (node: Node) => {
  // Show node properties panel
  // Enable connection drawing
  // Display node metadata
};

const handleCanvasUpdate = (nodes: Node[]) => {
  // Save node positions to database
  // Update funnel layout
};

<FunnelBuilderTabs
  funnel={funnelData}
  onMetricClick={handleMetricClick}
  onBlockSelect={handleBlockSelect}
  onNodeSelect={handleNodeSelect}
  onCanvasUpdate={handleCanvasUpdate}
/>
```

## Styling & Theme

### Tailwind Classes Used
- Color system: `gray-*`, `blue-*`, `green-*`, `red-*`, `orange-*`, `purple-*`, `yellow-*`, `indigo-*`
- Dark mode: `dark:` prefix for all color/background classes
- Responsive: `sm:`, `md:`, `lg:` breakpoints
- Layout: `flex`, `grid`, `absolute`, `relative`
- Animations: `transition-all`, `animate-pulse`, `animate-spin`

### Customization Points

To customize colors, update the color mappings in:
- `getBlockColor()` function (Blocks Tab)
- `getNodeColor()` function (Canvas Tab)
- `getTrendColor()` function (Metrics Tab)

Example:
```typescript
const getBlockColor = (type: string) => {
  const colors = {
    email: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700',
    // ...
  };
  return colors[type] || colors.action;
};
```

## Dependencies

- **react**: ^18.0.0
- **framer-motion**: ^10.0.0+ (for animations)
- **tailwindcss**: ^3.3.0+ (for styling)

Install with:
```bash
npm install framer-motion
```

## Performance Considerations

1. **Memoization**: Consider memoizing props for large datasets:
   ```typescript
   const memoizedFunnel = useMemo(() => funnel, [funnel.id]);
   ```

2. **Lazy Loading**: For canvas with many nodes (>50), consider implementing virtualization:
   ```typescript
   // Use react-window or similar for large node lists
   ```

3. **Animations**: Fade animations are GPU-accelerated via Framer Motion
   - 300ms transition is lightweight
   - No performance impact on modern devices

## Accessibility

- **Semantic HTML**: Proper heading hierarchy, button elements
- **Keyboard Navigation**: Tab order, Enter/Space activation
- **ARIA Labels**: Tab roles, button states
- **Color Contrast**: WCAG AA compliance in light and dark modes
- **Focus States**: Visible focus indicators on all interactive elements

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Known Limitations

1. **Canvas Node Limit**: Optimal for <100 nodes; consider virtualization beyond that
2. **Connection Drawing**: Lines are static; dynamic connection drawing would require additional state
3. **Drag & Drop**: Currently supports `draggable` attribute only; integrate with `react-beautiful-dnd` or `dnd-kit` for full drag-and-drop
4. **SVG Lines**: Not optimized for very large canvases; consider Canvas API for extreme scale

## Future Enhancements

- [ ] Drag-and-drop node positioning
- [ ] Connection line drawing/editing
- [ ] Undo/Redo history
- [ ] Export as image/PDF
- [ ] Collaboration/real-time updates
- [ ] Advanced analytics charts
- [ ] Block library search/filter
- [ ] Keyboard shortcuts

## File Structure

```
components/
  FunnelBuilderTabs.tsx          # Main component
  FunnelBuilderTabs.usage.tsx    # Usage examples & demo
  FunnelBuilderTabs.README.md    # This file
```

## Testing

Example test structure:
```typescript
import { render, screen, userEvent } from '@testing-library/react';
import FunnelBuilderTabs from './FunnelBuilderTabs';

describe('FunnelBuilderTabs', () => {
  it('renders all three tabs', () => {
    render(<FunnelBuilderTabs funnel={mockData} />);
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Blocks')).toBeInTheDocument();
  });

  it('switches tabs on click', async () => {
    render(<FunnelBuilderTabs funnel={mockData} />);
    await userEvent.click(screen.getByText('Metrics'));
    expect(screen.getByText('Total Visitors')).toBeInTheDocument();
  });

  it('calls onTabChange callback', async () => {
    const onTabChange = jest.fn();
    render(<FunnelBuilderTabs funnel={mockData} onTabChange={onTabChange} />);
    await userEvent.click(screen.getByText('Blocks'));
    expect(onTabChange).toHaveBeenCalledWith('BLOCKS');
  });
});
```

## License

MIT (as part of ONEVYRT project)

## Changelog

### v1.0.0 (2025-09-03)
- Initial release
- 3-tab interface (Canvas, Metrics, Blocks)
- Responsive grid layouts
- Dark mode support
- Loading states
- Framer Motion animations
- Full TypeScript support
