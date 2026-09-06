/**
 * FunnelBuilderShared.tsx
 *
 * Shared utilities, hooks, and reusable components for all funnel builder approaches.
 * Provides:
 * - MetricsPanel: Displays and manages funnel metrics visualization
 * - BlocksLibrary: Reusable drawer for funnel building blocks
 * - SimplifiedFunnelNode: Lightweight node with hover data display
 * - useMetricsState: State management for metrics (visibility, sorting, filtering)
 * - useSidebarState: State management for drawer/panel visibility and content
 * - Tailwind utilities and class constants
 *
 * These utilities are designed to be framework-agnostic and unit-testable.
 */

"use client";

import React, { useState, useCallback, useMemo, createContext, useContext } from "react";

// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

/**
 * Represents a single funnel metric
 */
export interface FunnelMetric {
  id: string;
  label: string;
  value: number;
  unit?: string;
  change?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  color?: string; // Tailwind color class prefix (e.g., "text-blue", "text-green")
}

/**
 * Metrics state structure
 */
export interface MetricsState {
  visible: string[]; // metric IDs that are visible
  sortBy: "label" | "value" | "custom";
  filterText: string;
  expandedGroups: string[];
}

/**
 * Sidebar/drawer state structure
 */
export interface SidebarState {
  isOpen: boolean;
  activeTab?: string;
  content?: "blocks" | "properties" | "preview" | "settings";
  position?: "left" | "right";
  width?: number;
  collapsed?: boolean;
}

/**
 * Funnel building block definition
 */
export interface FunnelBlock {
  id: string;
  type: "page" | "form" | "email" | "sms" | "delay" | "webhook" | "custom";
  label: string;
  description?: string;
  icon?: string;
  category: "entry" | "engagement" | "conversion" | "exit" | "automation";
  config?: Record<string, any>;
  meta?: {
    previewImage?: string;
    complexity?: "simple" | "medium" | "advanced";
  };
}

/**
 * Simplified funnel node structure
 */
export interface SimpleFunnelNode {
  id: string;
  type: string;
  label: string;
  metrics?: {
    entryCount?: number;
    exitCount?: number;
    conversionRate?: number;
    timeSpent?: number;
  };
  position?: { x: number; y: number };
  connections?: string[]; // node IDs this connects to
}

// ============================================================================
// TAILWIND UTILITY CONSTANTS
// ============================================================================

/**
 * Reusable Tailwind class constants for consistent styling across approaches
 */
export const TAILWIND_UTILS = {
  // Layout
  flexCenter: "flex items-center justify-center",
  flexBetween: "flex items-center justify-between",
  flexCol: "flex flex-col",
  flexColCenter: "flex flex-col items-center justify-center",
  gridCols: {
    auto: "grid grid-cols-auto gap-4",
    2: "grid grid-cols-2 gap-4",
    3: "grid grid-cols-3 gap-4",
    4: "grid grid-cols-4 gap-4",
  },

  // Spacing
  container: "container mx-auto px-4",
  cardPadding: "p-4 sm:p-6",
  sectionGap: "space-y-6",
  itemGap: "space-y-3",

  // Typography
  headingLarge: "text-2xl font-bold text-gray-900 dark:text-white",
  headingMedium: "text-xl font-semibold text-gray-800 dark:text-gray-100",
  headingSmall: "text-lg font-semibold text-gray-700 dark:text-gray-200",
  bodyText: "text-base text-gray-600 dark:text-gray-400",
  bodySmall: "text-sm text-gray-500 dark:text-gray-500",
  label: "text-sm font-medium text-gray-700 dark:text-gray-300",

  // Cards & Containers
  card: "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow",
  cardInset: "rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3",
  panel: "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg",
  drawer: "fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300",

  // Buttons
  btnPrimary: "px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary: "px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors",
  btnTertiary: "px-4 py-2 rounded-lg text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors",
  btnSmall: "px-3 py-1 text-sm",
  btnIcon: "p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",

  // States
  interactive: "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
  disabled: "opacity-50 cursor-not-allowed",
  selected: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",

  // Borders & Dividers
  divider: "border-t border-gray-200 dark:border-gray-700",
  borderLight: "border border-gray-100 dark:border-gray-800",

  // Colors - Metrics
  metricGood: "text-green-600 dark:text-green-400",
  metricWarning: "text-yellow-600 dark:text-yellow-400",
  metricBad: "text-red-600 dark:text-red-400",
  metricNeutral: "text-gray-600 dark:text-gray-400",
} as const;

// ============================================================================
// HOOKS: useMetricsState
// ============================================================================

/**
 * Hook for managing metrics visibility, sorting, and filtering
 *
 * Features:
 * - Toggle metric visibility
 * - Sort metrics by different criteria
 * - Filter metrics by text search
 * - Manage expanded metric groups
 * - Persist state to localStorage (optional)
 *
 * @param initialMetrics Array of metrics to manage
 * @param persistKey Optional localStorage key for persistence
 * @returns Metrics state and action methods
 *
 * @example
 * const { state, toggleMetric, setSortBy, setFilterText, getVisibleMetrics } = useMetricsState(metrics);
 */
export function useMetricsState(
  initialMetrics: FunnelMetric[],
  persistKey?: string
) {
  const [state, setState] = useState<MetricsState>(() => {
    if (persistKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(persistKey);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.warn("Failed to parse metrics state from localStorage", e);
        }
      }
    }
    return {
      visible: initialMetrics.map((m) => m.id),
      sortBy: "custom",
      filterText: "",
      expandedGroups: [],
    };
  });

  // Persist state to localStorage when it changes
  const setState_ = useCallback(
    (newState: MetricsState | ((prev: MetricsState) => MetricsState)) => {
      const updated =
        typeof newState === "function" ? newState(state) : newState;
      setState(updated);
      if (persistKey && typeof window !== "undefined") {
        localStorage.setItem(persistKey, JSON.stringify(updated));
      }
    },
    [state, persistKey]
  );

  /**
   * Toggle visibility of a metric
   */
  const toggleMetric = useCallback(
    (metricId: string) => {
      setState_((prev) => ({
        ...prev,
        visible: prev.visible.includes(metricId)
          ? prev.visible.filter((id) => id !== metricId)
          : [...prev.visible, metricId],
      }));
    },
    [setState_]
  );

  /**
   * Set sort order
   */
  const setSortBy = useCallback(
    (sortBy: MetricsState["sortBy"]) => {
      setState_((prev) => ({ ...prev, sortBy }));
    },
    [setState_]
  );

  /**
   * Set filter text
   */
  const setFilterText = useCallback(
    (filterText: string) => {
      setState_((prev) => ({ ...prev, filterText }));
    },
    [setState_]
  );

  /**
   * Toggle group expansion
   */
  const toggleGroup = useCallback(
    (groupId: string) => {
      setState_((prev) => ({
        ...prev,
        expandedGroups: prev.expandedGroups.includes(groupId)
          ? prev.expandedGroups.filter((id) => id !== groupId)
          : [...prev.expandedGroups, groupId],
      }));
    },
    [setState_]
  );

  /**
   * Get visible and filtered metrics, sorted according to current state
   */
  const getVisibleMetrics = useCallback((): FunnelMetric[] => {
    let filtered = initialMetrics.filter((m) => state.visible.includes(m.id));

    // Apply text filter
    if (state.filterText) {
      const searchLower = state.filterText.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.label.toLowerCase().includes(searchLower) ||
          m.id.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sorted = [...filtered];
    if (state.sortBy === "label") {
      sorted.sort((a, b) => a.label.localeCompare(b.label));
    } else if (state.sortBy === "value") {
      sorted.sort((a, b) => b.value - a.value);
    }

    return sorted;
  }, [initialMetrics, state.visible, state.filterText, state.sortBy]);

  /**
   * Reset all metrics to visible state
   */
  const resetVisibility = useCallback(() => {
    setState_((prev) => ({
      ...prev,
      visible: initialMetrics.map((m) => m.id),
    }));
  }, [setState_, initialMetrics]);

  /**
   * Show only specified metrics
   */
  const setVisible = useCallback(
    (metricIds: string[]) => {
      setState_((prev) => ({
        ...prev,
        visible: metricIds,
      }));
    },
    [setState_]
  );

  return {
    state,
    toggleMetric,
    setSortBy,
    setFilterText,
    toggleGroup,
    getVisibleMetrics,
    resetVisibility,
    setVisible,
  };
}

// ============================================================================
// HOOKS: useSidebarState
// ============================================================================

/**
 * Hook for managing sidebar/drawer visibility, content, and positioning
 *
 * Features:
 * - Open/close sidebar with animation
 * - Switch between content tabs
 * - Customize width and position
 * - Collapse/expand sidebar
 * - Persist state to localStorage (optional)
 *
 * @param persistKey Optional localStorage key for persistence
 * @returns Sidebar state and action methods
 *
 * @example
 * const { isOpen, open, close, setContent, toggleCollapse } = useSidebarState("funnel-sidebar");
 */
export function useSidebarState(persistKey?: string) {
  const [state, setState] = useState<SidebarState>(() => {
    if (persistKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(persistKey);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.warn("Failed to parse sidebar state from localStorage", e);
        }
      }
    }
    return {
      isOpen: false,
      activeTab: "blocks",
      content: "blocks",
      position: "right",
      width: 384, // w-96 = 384px
      collapsed: false,
    };
  });

  // Persist state to localStorage when it changes
  const setState_ = useCallback(
    (newState: SidebarState | ((prev: SidebarState) => SidebarState)) => {
      const updated =
        typeof newState === "function" ? newState(state) : newState;
      setState(updated);
      if (persistKey && typeof window !== "undefined") {
        localStorage.setItem(persistKey, JSON.stringify(updated));
      }
    },
    [state, persistKey]
  );

  /**
   * Open sidebar
   */
  const open = useCallback(() => {
    setState_((prev) => ({ ...prev, isOpen: true }));
  }, [setState_]);

  /**
   * Close sidebar
   */
  const close = useCallback(() => {
    setState_((prev) => ({ ...prev, isOpen: false }));
  }, [setState_]);

  /**
   * Toggle sidebar open/close
   */
  const toggle = useCallback(() => {
    setState_((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, [setState_]);

  /**
   * Set active content type
   */
  const setContent = useCallback(
    (
      content: SidebarState["content"],
      tab?: string
    ) => {
      setState_((prev) => ({
        ...prev,
        content,
        activeTab: tab || prev.activeTab,
      }));
    },
    [setState_]
  );

  /**
   * Set active tab within content
   */
  const setActiveTab = useCallback(
    (tab: string) => {
      setState_((prev) => ({ ...prev, activeTab: tab }));
    },
    [setState_]
  );

  /**
   * Toggle collapse/expand
   */
  const toggleCollapse = useCallback(() => {
    setState_((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, [setState_]);

  /**
   * Set sidebar width
   */
  const setWidth = useCallback(
    (width: number) => {
      setState_((prev) => ({ ...prev, width }));
    },
    [setState_]
  );

  /**
   * Set sidebar position (left or right)
   */
  const setPosition = useCallback(
    (position: "left" | "right") => {
      setState_((prev) => ({ ...prev, position }));
    },
    [setState_]
  );

  return {
    state,
    open,
    close,
    toggle,
    setContent,
    setActiveTab,
    toggleCollapse,
    setWidth,
    setPosition,
  };
}

// ============================================================================
// COMPONENTS: MetricsPanel
// ============================================================================

interface MetricsPanelProps {
  metrics: FunnelMetric[];
  state?: MetricsState;
  onToggleMetric?: (metricId: string) => void;
  onSortChange?: (sortBy: MetricsState["sortBy"]) => void;
  onFilterChange?: (filter: string) => void;
  visibleMetrics?: FunnelMetric[];
  maxHeight?: string;
  showSearch?: boolean;
  showSort?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * MetricsPanel Component
 *
 * Reusable panel that displays funnel metrics with:
 * - Visibility toggles for each metric
 * - Search/filter capabilities
 * - Sort options
 * - Visual indicators (colors, change direction)
 * - Responsive layout (compact/expanded)
 *
 * @example
 * <MetricsPanel
 *   metrics={funnelMetrics}
 *   visibleMetrics={filteredMetrics}
 *   onToggleMetric={toggleMetric}
 *   showSearch
 *   showSort
 * />
 */
export function MetricsPanel({
  metrics,
  onToggleMetric,
  onSortChange,
  onFilterChange,
  visibleMetrics,
  maxHeight = "max-h-96",
  showSearch = true,
  showSort = true,
  compact = false,
  className = "",
}: MetricsPanelProps) {
  const [localFilter, setLocalFilter] = useState("");

  const displayMetrics = visibleMetrics || metrics;

  return (
    <div
      className={`${TAILWIND_UTILS.panel} ${className}`}
      data-testid="metrics-panel"
    >
      {/* Header */}
      <div className={`${TAILWIND_UTILS.flexBetween} border-b border-gray-200 dark:border-gray-700 p-4`}>
        <h3 className={TAILWIND_UTILS.headingSmall}>Funnel Metrics</h3>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {displayMetrics.length} / {metrics.length}
        </span>
      </div>

      {/* Toolbar */}
      {(showSearch || showSort) && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-3 space-y-2">
          {showSearch && (
            <input
              type="text"
              placeholder="Search metrics..."
              value={localFilter}
              onChange={(e) => {
                setLocalFilter(e.target.value);
                onFilterChange?.(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="metrics-filter-input"
            />
          )}

          {showSort && (
            <div className="flex gap-2">
              <select
                onChange={(e) =>
                  onSortChange?.(
                    e.target.value as MetricsState["sortBy"]
                  )
                }
                className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="metrics-sort-select"
              >
                <option value="custom">Default</option>
                <option value="label">By Label</option>
                <option value="value">By Value</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Metrics List */}
      <div
        className={`overflow-y-auto ${maxHeight}`}
        data-testid="metrics-list"
      >
        {displayMetrics.length === 0 ? (
          <div className={`${TAILWIND_UTILS.flexColCenter} py-8 text-gray-500`}>
            <p className="text-sm">No metrics to display</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {displayMetrics.map((metric) => (
              <div
                key={metric.id}
                className={`${compact ? "p-2" : "p-3"} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
                data-testid={`metric-${metric.id}`}
              >
                <div className={TAILWIND_UTILS.flexBetween}>
                  {/* Checkbox + Label */}
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => onToggleMetric?.(metric.id)}
                      className="rounded border-gray-300 cursor-pointer"
                      data-testid={`metric-toggle-${metric.id}`}
                    />
                    <div>
                      <div
                        className={`font-medium text-gray-900 dark:text-white ${
                          compact ? "text-sm" : ""
                        }`}
                      >
                        {metric.label}
                      </div>
                      {metric.change && !compact && (
                        <div
                          className={`text-xs mt-1 ${
                            metric.change.direction === "up"
                              ? TAILWIND_UTILS.metricGood
                              : metric.change.direction === "down"
                                ? TAILWIND_UTILS.metricBad
                                : TAILWIND_UTILS.metricNeutral
                          }`}
                        >
                          {metric.change.direction === "up" ? "↑" : "↓"}{" "}
                          {Math.abs(metric.change.value)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        metric.color || "text-gray-900 dark:text-white"
                      } ${compact ? "text-sm" : ""}`}
                    >
                      {metric.value.toLocaleString()}
                      {metric.unit && (
                        <span className="ml-1 font-normal text-xs text-gray-500">
                          {metric.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTS: BlocksLibrary
// ============================================================================

interface BlocksLibraryProps {
  blocks: FunnelBlock[];
  onSelectBlock?: (block: FunnelBlock) => void;
  onPreviewBlock?: (block: FunnelBlock) => void;
  groupByCategory?: boolean;
  searchable?: boolean;
  maxHeight?: string;
  className?: string;
}

/**
 * BlocksLibrary Component
 *
 * Reusable drawer/panel for displaying available funnel building blocks.
 * Features:
 * - Optional grouping by category
 * - Search/filter functionality
 * - Block selection callbacks
 * - Block preview capability
 * - Responsive grid layout
 *
 * @example
 * <BlocksLibrary
 *   blocks={availableBlocks}
 *   onSelectBlock={handleBlockSelection}
 *   groupByCategory
 *   searchable
 * />
 */
export function BlocksLibrary({
  blocks,
  onSelectBlock,
  onPreviewBlock,
  groupByCategory = true,
  searchable = true,
  maxHeight = "max-h-96",
  className = "",
}: BlocksLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    groupByCategory ? Array.from(new Set(blocks.map((b) => b.category))) : []
  );

  // Filter blocks by search term
  const filteredBlocks = useMemo(
    () =>
      blocks.filter(
        (b) =>
          b.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (b.description?.toLowerCase().includes(searchTerm.toLowerCase()) ??
            false)
      ),
    [blocks, searchTerm]
  );

  // Group blocks by category if enabled
  const groupedBlocks = useMemo(() => {
    if (!groupByCategory) return { all: filteredBlocks };

    const groups: Record<string, FunnelBlock[]> = {};
    filteredBlocks.forEach((block) => {
      if (!groups[block.category]) groups[block.category] = [];
      groups[block.category]!.push(block);
    });
    return groups;
  }, [filteredBlocks, groupByCategory]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div
      className={`${TAILWIND_UTILS.panel} ${className}`}
      data-testid="blocks-library"
    >
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h3 className={TAILWIND_UTILS.headingSmall}>Funnel Blocks</h3>
      </div>

      {/* Search */}
      {searchable && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-3">
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="blocks-search-input"
          />
        </div>
      )}

      {/* Blocks List */}
      <div className={`overflow-y-auto ${maxHeight}`} data-testid="blocks-list">
        {filteredBlocks.length === 0 ? (
          <div className={`${TAILWIND_UTILS.flexColCenter} py-8 text-gray-500`}>
            <p className="text-sm">No blocks found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Object.entries(groupedBlocks).map(([category, categoryBlocks]) => (
              <div key={category} data-testid={`block-category-${category}`}>
                {groupByCategory && (
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full ${TAILWIND_UTILS.flexBetween} px-4 py-3 font-medium text-sm uppercase tracking-wide text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
                    data-testid={`category-toggle-${category}`}
                  >
                    <span>{category}</span>
                    <span
                      className={`transform transition-transform ${
                        expandedCategories.includes(category)
                          ? "rotate-180"
                          : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>
                )}

                {(!groupByCategory ||
                  expandedCategories.includes(category)) && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {categoryBlocks.map((block) => (
                      <div
                        key={block.id}
                        className={`${TAILWIND_UTILS.interactive} p-4 cursor-pointer`}
                        onClick={() => onSelectBlock?.(block)}
                        data-testid={`block-${block.id}`}
                      >
                        <div
                          className={`${TAILWIND_UTILS.flexBetween} mb-2`}
                        >
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {block.label}
                          </h4>
                          {block.meta?.complexity && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {block.meta.complexity}
                            </span>
                          )}
                        </div>

                        {block.description && (
                          <p className={TAILWIND_UTILS.bodySmall}>
                            {block.description}
                          </p>
                        )}

                        {onPreviewBlock && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewBlock(block);
                            }}
                            className={`${TAILWIND_UTILS.btnTertiary} text-xs mt-2`}
                            data-testid={`preview-block-${block.id}`}
                          >
                            Preview
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTS: SimplifiedFunnelNode
// ============================================================================

interface SimplifiedFunnelNodeProps {
  node: SimpleFunnelNode;
  onClick?: (node: SimpleFunnelNode) => void;
  onHover?: (node: SimpleFunnelNode) => void;
  selected?: boolean;
  compact?: boolean;
  showMetrics?: boolean;
  className?: string;
}

/**
 * SimplifiedFunnelNode Component
 *
 * Lightweight node representation that displays:
 * - Node label and type
 * - Optional metrics on hover (entry, exit, conversion rate)
 * - Click handling for selection
 * - Visual feedback for selected state
 * - Compact or expanded display mode
 *
 * Designed for use in flow charts, canvas views, and node-based builders.
 *
 * @example
 * <SimplifiedFunnelNode
 *   node={funnelNode}
 *   selected={selectedNodeId === node.id}
 *   onClick={handleNodeClick}
 *   showMetrics
 * />
 */
export function SimplifiedFunnelNode({
  node,
  onClick,
  onHover,
  selected = false,
  compact = false,
  showMetrics = true,
  className = "",
}: SimplifiedFunnelNodeProps) {
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    onHover?.(node);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <div
      onClick={() => onClick?.(node)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        ${TAILWIND_UTILS.card}
        ${selected ? TAILWIND_UTILS.selected : ""}
        ${TAILWIND_UTILS.interactive}
        transition-all duration-200
        ${compact ? "p-2" : "p-4"}
        min-w-[160px]
        ${className}
      `}
      data-testid={`node-${node.id}`}
      role="button"
      tabIndex={0}
      aria-selected={selected}
    >
      {/* Node Header */}
      <div className="mb-2">
        <span
          className={`inline-block px-2 py-1 text-xs rounded-full ${
            isHovering || selected
              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          } transition-colors`}
          data-testid={`node-type-${node.type}`}
        >
          {node.type}
        </span>
      </div>

      {/* Node Label */}
      <h4
        className={`font-semibold text-gray-900 dark:text-white ${
          compact ? "text-sm" : ""
        }`}
        data-testid={`node-label-${node.id}`}
      >
        {node.label}
      </h4>

      {/* Metrics on Hover */}
      {showMetrics && isHovering && node.metrics && (
        <div
          className={`mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1 text-xs`}
          data-testid={`node-metrics-${node.id}`}
        >
          {node.metrics.entryCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Entry:</span>
              <span className="font-medium">
                {node.metrics.entryCount.toLocaleString()}
              </span>
            </div>
          )}

          {node.metrics.exitCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Exit:</span>
              <span className="font-medium">
                {node.metrics.exitCount.toLocaleString()}
              </span>
            </div>
          )}

          {node.metrics.conversionRate !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Conv:</span>
              <span className={`font-medium ${TAILWIND_UTILS.metricGood}`}>
                {node.metrics.conversionRate.toFixed(1)}%
              </span>
            </div>
          )}

          {node.metrics.timeSpent !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Time:</span>
              <span className="font-medium">
                {node.metrics.timeSpent.toFixed(0)}s
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONTEXT & PROVIDER (Optional, for global state)
// ============================================================================

interface FunnelBuilderContextType {
  metrics: FunnelMetric[];
  blocks: FunnelBlock[];
  selectedNodeId?: string;
  setSelectedNodeId: (id: string) => void;
}

const FunnelBuilderContext = createContext<FunnelBuilderContextType | null>(
  null
);

/**
 * Provider component for global funnel builder state
 * Allows child components to access metrics, blocks, and selection state
 */
export function FunnelBuilderProvider({
  children,
  metrics,
  blocks,
}: {
  children: React.ReactNode;
  metrics: FunnelMetric[];
  blocks: FunnelBlock[];
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  return (
    <FunnelBuilderContext.Provider
      value={{ metrics, blocks, selectedNodeId, setSelectedNodeId }}
    >
      {children}
    </FunnelBuilderContext.Provider>
  );
}

/**
 * Hook to access funnel builder context
 */
export function useFunnelBuilderContext() {
  const context = useContext(FunnelBuilderContext);
  if (!context) {
    throw new Error(
      "useFunnelBuilderContext must be used within FunnelBuilderProvider"
    );
  }
  return context;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate funnel conversion rate between two metrics
 */
export function calculateConversion(
  entryCount: number,
  exitCount: number
): number {
  if (entryCount === 0) return 0;
  return (exitCount / entryCount) * 100;
}

/**
 * Format metric value with proper unit/abbreviation
 */
export function formatMetricValue(
  value: number,
  unit?: string,
  decimals = 0
): string {
  const formatted =
    value > 1000
      ? (value / 1000).toFixed(decimals) + "K"
      : value.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Generate mock metrics for testing/demo purposes
 */
export function generateMockMetrics(count = 5): FunnelMetric[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `metric-${i}`,
    label: ["Visits", "Leads", "Conversions", "Revenue", "CAC"][i] || `Metric ${i}`,
    value: Math.floor(Math.random() * 10000),
    unit: ["", "", "", "$", "$"][i],
    color: ["text-blue-600", "text-purple-600", "text-green-600", "text-emerald-600", "text-red-600"][i],
    change: {
      value: Math.floor(Math.random() * 30),
      direction: Math.random() > 0.5 ? "up" : "down" as const,
    },
  }));
}

/**
 * Generate mock blocks for testing/demo purposes
 */
export function generateMockBlocks(): FunnelBlock[] {
  return [
    {
      id: "landing-page",
      type: "page",
      label: "Landing Page",
      description: "Capture visitor attention and collect leads",
      category: "entry",
      meta: { complexity: "simple" },
    },
    {
      id: "opt-in-form",
      type: "form",
      label: "Opt-In Form",
      description: "Email capture with lead scoring",
      category: "engagement",
      meta: { complexity: "simple" },
    },
    {
      id: "welcome-email",
      type: "email",
      label: "Welcome Email",
      description: "Automated welcome sequence",
      category: "engagement",
      meta: { complexity: "medium" },
    },
    {
      id: "delay-step",
      type: "delay",
      label: "Wait Period",
      description: "Pause before next step",
      category: "automation",
      meta: { complexity: "simple" },
    },
    {
      id: "conversion-page",
      type: "page",
      label: "Sales Page",
      description: "High-converting sales presentation",
      category: "conversion",
      meta: { complexity: "advanced" },
    },
    {
      id: "webhook",
      type: "webhook",
      label: "Webhook Action",
      description: "Send data to external systems",
      category: "automation",
      meta: { complexity: "advanced" },
    },
  ];
}

// ============================================================================
// EXPORTS
// ============================================================================
//
// FunnelMetric, MetricsState, SidebarState, FunnelBlock, and SimpleFunnelNode
// are already exported from their `export interface` declarations above.
