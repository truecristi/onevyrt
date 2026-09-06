/**
 * USAGE EXAMPLE: FunnelBuilderTabs
 *
 * This file demonstrates how to integrate and use the FunnelBuilderTabs component
 * in your application.
 */

'use client';

import { useState } from 'react';
import { FunnelBuilderTabs, FunnelData, TabType, MetricCard, Block, Node } from '@/components/FunnelBuilderTabs';

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_FUNNEL_DATA: FunnelData = {
  id: 'funnel-001',
  name: 'Email Webinar Funnel',
  metrics: [
    {
      id: 'metric-1',
      label: 'Total Visitors',
      value: '2,451',
      unit: 'visits',
      trend: 12.5,
      status: 'up',
    },
    {
      id: 'metric-2',
      label: 'Conversion Rate',
      value: '24.3%',
      unit: 'conversions',
      trend: 8.2,
      status: 'up',
    },
    {
      id: 'metric-3',
      label: 'Avg Time on Page',
      value: '3m 42s',
      unit: 'time',
      trend: -2.1,
      status: 'down',
    },
    {
      id: 'metric-4',
      label: 'Bounce Rate',
      value: '18.5%',
      unit: 'percentage',
      trend: -5.3,
      status: 'down',
    },
    {
      id: 'metric-5',
      label: 'Email Opens',
      value: '891',
      unit: 'opens',
      trend: 15.7,
      status: 'up',
    },
    {
      id: 'metric-6',
      label: 'Click Rate',
      value: '42.1%',
      unit: 'percentage',
      trend: 3.4,
      status: 'up',
    },
  ],
  blocks: [
    {
      id: 'block-1',
      title: 'Welcome Email',
      description: 'Send welcome email to new subscribers',
      type: 'email',
      isDraggable: true,
    },
    {
      id: 'block-2',
      title: 'Wait 2 Days',
      description: 'Delay delivery for 2 days',
      type: 'delay',
      isDraggable: true,
    },
    {
      id: 'block-3',
      title: 'Check if Opened',
      description: 'Conditional: email opened in last 48 hours?',
      type: 'condition',
      isDraggable: true,
    },
    {
      id: 'block-4',
      title: 'Send SMS Reminder',
      description: 'Send SMS if email not opened',
      type: 'sms',
      isDraggable: true,
    },
  ],
  nodes: [
    { id: 'node-1', type: 'entry', label: 'Entry', x: 50, y: 50 },
    { id: 'node-2', type: 'action', label: 'Send Email', x: 200, y: 50 },
    { id: 'node-3', type: 'condition', label: 'Opened?', x: 350, y: 50 },
    { id: 'node-4', type: 'action', label: 'Send SMS', x: 500, y: 50 },
    { id: 'node-5', type: 'exit', label: 'Exit', x: 650, y: 50 },
  ],
  stats: {
    totalVisitors: 2451,
    conversionRate: 24.3,
    avgTimeOnPage: 222, // 3m 42s in seconds
    bounceRate: 18.5,
  },
};

// ============================================================================
// INTEGRATION COMPONENT
// ============================================================================

export function FunnelBuilderDemo() {
  const [activeTab, setActiveTab] = useState<TabType>('CANVAS');
  const [funnelData, setFunnelData] = useState<FunnelData>(SAMPLE_FUNNEL_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Handle tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    console.log(`Tab changed to: ${tab}`);
  };

  // Handle metric selection
  const handleMetricClick = (metric: MetricCard) => {
    setSelectedItem(`metric-${metric.id}`);
    console.log('Metric selected:', metric);
    // Open metric detail dialog, navigate to analytics, etc.
  };

  // Handle block selection
  const handleBlockSelect = (block: Block) => {
    setSelectedItem(`block-${block.id}`);
    console.log('Block selected:', block);
    // Open block configuration modal, show block details, etc.
  };

  // Handle node selection
  const handleNodeSelect = (node: Node) => {
    setSelectedItem(`node-${node.id}`);
    console.log('Node selected:', node);
    // Show node properties panel, enable editing, etc.
  };

  // Handle canvas updates (node movement, connections, etc.)
  const handleCanvasUpdate = (nodes: Node[]) => {
    setFunnelData((prev) => ({
      ...prev,
      nodes,
    }));
    console.log('Canvas updated with nodes:', nodes);
  };

  // Simulate loading state
  const toggleLoading = () => {
    setIsLoading(!isLoading);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {funnelData.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            ID: {funnelData.id}
          </p>
        </div>

        {/* Debug Info */}
        <div className="flex gap-4 items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold">Active Tab:</span> {activeTab}
          </div>
          {selectedItem && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Selected:</span> {selectedItem}
            </div>
          )}
          <button
            onClick={toggleLoading}
            className="ml-auto px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {isLoading ? 'Stop Loading' : 'Simulate Loading'}
          </button>
        </div>

        {/* Main Component */}
        <FunnelBuilderTabs
          funnel={funnelData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onMetricClick={handleMetricClick}
          onBlockSelect={handleBlockSelect}
          onNodeSelect={handleNodeSelect}
          onCanvasUpdate={handleCanvasUpdate}
          isLoading={isLoading}
          readOnly={false}
        />

        {/* Information Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Component Features
            </h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>✓ 3 Tab Navigation (Canvas, Metrics, Blocks)</li>
              <li>✓ 300ms Fade Animation</li>
              <li>✓ Responsive Grid (auto-fit 150px)</li>
              <li>✓ Dark Mode Support</li>
              <li>✓ Mobile Stack Layout</li>
              <li>✓ Loading States</li>
              <li>✓ Draggable Blocks</li>
              <li>✓ Interactive Nodes</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Callbacks Available
            </h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• onTabChange(tab)</li>
              <li>• onMetricClick(metric)</li>
              <li>• onBlockSelect(block)</li>
              <li>• onNodeSelect(node)</li>
              <li>• onCanvasUpdate(nodes)</li>
              <li>• isLoading prop</li>
              <li>• readOnly prop</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FunnelBuilderDemo;

// ============================================================================
// INTEGRATION IN PAGE COMPONENT
// ============================================================================

/*
 * Example: Add to your funnel detail page
 *
 * app/funnel/[id]/page.tsx
 *
 */
export function FunnelDetailPageExample() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FunnelBuilderDemo />
      </div>
    </div>
  );
}

// ============================================================================
// TYPESCRIPT TYPES REFERENCE
// ============================================================================

/*
 * Type Definitions Available:
 *
 * interface FunnelBuilderTabsProps {
 *   funnel: FunnelData;                          // Required: funnel data
 *   activeTab?: TabType;                         // 'CANVAS' | 'METRICS' | 'BLOCKS'
 *   onTabChange?: (tab: TabType) => void;        // Tab change callback
 *   onMetricClick?: (metric: MetricCard) => void; // Metric click callback
 *   onBlockSelect?: (block: Block) => void;      // Block selection callback
 *   onNodeSelect?: (node: Node) => void;         // Node selection callback
 *   onCanvasUpdate?: (nodes: Node[]) => void;    // Canvas update callback
 *   isLoading?: boolean;                         // Loading state
 *   readOnly?: boolean;                          // Read-only mode
 * }
 *
 * interface FunnelData {
 *   id: string;
 *   name: string;
 *   metrics: MetricCard[];
 *   blocks: Block[];
 *   nodes: Node[];
 *   stats?: {
 *     totalVisitors: number;
 *     conversionRate: number;
 *     avgTimeOnPage: number;
 *     bounceRate: number;
 *   };
 * }
 *
 * interface MetricCard {
 *   id: string;
 *   label: string;
 *   value: string | number;
 *   unit?: string;
 *   trend?: number;              // percentage change
 *   status?: 'up' | 'down' | 'neutral';
 * }
 *
 * interface Block {
 *   id: string;
 *   title: string;
 *   description?: string;
 *   icon?: React.ReactNode;
 *   type: 'email' | 'sms' | 'webhook' | 'condition' | 'delay' | 'action';
 *   isDraggable?: boolean;
 * }
 *
 * interface Node {
 *   id: string;
 *   type: 'entry' | 'action' | 'condition' | 'exit';
 *   label: string;
 *   x: number;
 *   y: number;
 *   metadata?: Record<string, unknown>;
 * }
 */
