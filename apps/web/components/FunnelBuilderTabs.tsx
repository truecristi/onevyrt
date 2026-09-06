'use client';

import React, { useState } from 'react';

/**
 * Type definitions for funnel data and component props
 */

export interface MetricCard {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number; // percentage change
  status?: 'up' | 'down' | 'neutral';
}

export interface Block {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  type: 'email' | 'sms' | 'webhook' | 'condition' | 'delay' | 'action';
  isDraggable?: boolean;
}

export interface Node {
  id: string;
  type: 'entry' | 'action' | 'condition' | 'exit';
  label: string;
  x: number;
  y: number;
  metadata?: Record<string, unknown>;
}

export interface FunnelData {
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

export type TabType = 'CANVAS' | 'METRICS' | 'BLOCKS';

export interface FunnelBuilderTabsProps {
  funnel: FunnelData;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onMetricClick?: (metric: MetricCard) => void;
  onBlockSelect?: (block: Block) => void;
  onNodeSelect?: (node: Node) => void;
  onCanvasUpdate?: (nodes: Node[]) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

/**
 * Metric Card Component
 */
function MetricCardComponent({ metric, onClick }: {
  metric: MetricCard;
  onClick?: () => void;
}) {
  const getTrendColor = () => {
    if (!metric.trend) return 'text-gray-500';
    return metric.trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getTrendIcon = () => {
    if (!metric.trend) return null;
    return metric.trend > 0 ? '↑' : '↓';
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md dark:hover:shadow-xl transition-shadow duration-200 cursor-pointer group"
    >
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
        {metric.label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {metric.value}
          </p>
          {metric.unit && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{metric.unit}</p>
          )}
        </div>
        {metric.trend !== undefined && (
          <div className={`text-sm font-semibold flex items-center gap-1 ${getTrendColor()}`}>
            <span>{getTrendIcon()}</span>
            <span>{Math.abs(metric.trend)}%</span>
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Metrics Tab Content
 */
function MetricsTab({ metrics, onMetricClick, isLoading }: {
  metrics: MetricCard[];
  onMetricClick?: (metric: MetricCard) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:auto-fit gap-4"
         style={{
           gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'
         }}>
      {metrics.map((metric) => (
        <MetricCardComponent
          key={metric.id}
          metric={metric}
          onClick={() => onMetricClick?.(metric)}
        />
      ))}
    </div>
  );
}

/**
 * Block Item Component
 */
function BlockItem({ block, onClick }: {
  block: Block;
  onClick?: () => void;
}) {
  const getBlockColor = (type: string) => {
    const colors: Record<string, string> = {
      email: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
      sms: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
      webhook: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
      condition: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
      delay: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
      action: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700',
    };
    return colors[type] || colors.action;
  };

  const getBlockIcon = (type: string) => {
    const icons: Record<string, string> = {
      email: '✉️',
      sms: '💬',
      webhook: '🔗',
      condition: '⚡',
      delay: '⏱️',
      action: '▶️',
    };
    return icons[type] || '📦';
  };

  return (
    <button
      onClick={onClick}
      draggable={block.isDraggable}
      className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 hover:shadow-md dark:hover:shadow-lg group ${getBlockColor(
        block.type
      )} ${block.isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{block.icon || getBlockIcon(block.type)}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
            {block.title}
          </h4>
          {block.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
              {block.description}
            </p>
          )}
          <span className="inline-block text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 px-2 py-1 bg-gray-200/50 dark:bg-gray-700/50 rounded-full">
            {block.type}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Blocks Tab Content
 */
function BlocksTab({ blocks, onBlockSelect, isLoading }: {
  blocks: Block[];
  onBlockSelect?: (block: Block) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {blocks.map((block) => (
        <BlockItem
          key={block.id}
          block={block}
          onClick={() => onBlockSelect?.(block)}
        />
      ))}
    </div>
  );
}

/**
 * Canvas Tab Content - Simplified node visualization
 */
function CanvasTab({ nodes, onNodeSelect, readOnly, isLoading }: {
  nodes: Node[];
  onNodeSelect?: (node: Node) => void;
  onCanvasUpdate?: (nodes: Node[]) => void;
  readOnly?: boolean;
  isLoading?: boolean;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleNodeClick = (node: Node) => {
    setSelectedNodeId(node.id);
    onNodeSelect?.(node);
  };

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      entry: 'bg-green-500 dark:bg-green-600',
      action: 'bg-blue-500 dark:bg-blue-600',
      condition: 'bg-orange-500 dark:bg-orange-600',
      exit: 'bg-red-500 dark:bg-red-600',
    };
    return colors[type] || colors.action;
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="animate-spin">
          <div className="h-8 w-8 border-4 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
            No nodes yet
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
            {readOnly ? 'This funnel has no nodes' : 'Add nodes to get started'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-96 max-h-96 overflow-auto">
      <div className="relative w-full" style={{ minHeight: '300px' }}>
        {/* Connection lines (simplified) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
          style={{ minHeight: '300px' }}
        >
          {nodes.map((node, idx) => {
            if (idx < nodes.length - 1) {
              const nextNode = nodes[idx + 1]!;
              return (
                <line
                  key={`line-${node.id}`}
                  x1={node.x}
                  y1={node.y + 30}
                  x2={nextNode.x}
                  y2={nextNode.y}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-300 dark:text-gray-600"
                />
              );
            }
            return null;
          })}
        </svg>

        {/* Nodes */}
        <div className="relative">
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node)}
              className={`absolute flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
                selectedNodeId === node.id ? 'z-10' : 'z-0'
              }`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
              }}
              disabled={readOnly}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-sm text-center transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 ${getNodeColor(
                  node.type
                )} ${
                  selectedNodeId === node.id
                    ? 'ring-4 ring-offset-2 dark:ring-offset-gray-900 ring-gray-400'
                    : ''
                }`}
              >
                {node.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Main FunnelBuilderTabs Component
 */
export const FunnelBuilderTabs: React.FC<FunnelBuilderTabsProps> = ({
  funnel,
  activeTab = 'CANVAS',
  onTabChange,
  onMetricClick,
  onBlockSelect,
  onNodeSelect,
  onCanvasUpdate,
  isLoading = false,
  readOnly = false,
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<TabType>(activeTab);

  const handleTabChange = (tab: TabType) => {
    setLocalActiveTab(tab);
    onTabChange?.(tab);
  };

  const tabs: Array<{ id: TabType; label: string }> = [
    { id: 'CANVAS', label: 'Canvas' },
    { id: 'METRICS', label: 'Metrics' },
    { id: 'BLOCKS', label: 'Blocks' },
  ];

  return (
    <div className="w-full flex flex-col bg-white dark:bg-gray-950 rounded-lg shadow-md dark:shadow-xl border border-gray-200 dark:border-gray-800">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 px-4 py-3 font-semibold text-sm uppercase tracking-wider transition-all duration-200 relative ${
              localActiveTab === tab.id
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
            disabled={isLoading}
          >
            {tab.label}
            {localActiveTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-6">
        <div key={localActiveTab} className="animate-fadeIn">
          {localActiveTab === 'CANVAS' && (
            <CanvasTab
              nodes={funnel.nodes}
              onNodeSelect={onNodeSelect}
              onCanvasUpdate={onCanvasUpdate}
              readOnly={readOnly}
              isLoading={isLoading}
            />
          )}

          {localActiveTab === 'METRICS' && (
            <MetricsTab
              metrics={funnel.metrics}
              onMetricClick={onMetricClick}
              isLoading={isLoading}
            />
          )}

          {localActiveTab === 'BLOCKS' && (
            <BlocksTab
              blocks={funnel.blocks}
              onBlockSelect={onBlockSelect}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default FunnelBuilderTabs;
