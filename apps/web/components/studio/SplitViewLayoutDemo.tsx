"use client";

/**
 * Demo/Integration Example: SplitViewLayout with FunnelCanvasBuilder
 *
 * This component demonstrates how to integrate SplitViewLayout into
 * the existing funnel-studio.tsx architecture.
 *
 * Usage:
 * 1. This is a reference implementation
 * 2. Copy patterns to funnel-studio.tsx
 * 3. Adapt to use actual Sidebar/Canvas/Inspector components
 */

import { useState, useEffect } from "react";
import { SplitViewLayout } from "./SplitViewLayout";

interface DemoProps {
  showDebug?: boolean;
}

/**
 * Mock components for demonstration
 */
function DemoSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-neutral-700">
        <h2 className="text-sm font-semibold text-white">Pages</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {["Landing Page", "Sales Page", "Order Form", "Thank You"].map(
          (page) => (
            <button
              key={page}
              className="w-full text-left px-3 py-2 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              {page}
            </button>
          )
        )}
      </div>
      <div className="p-4 border-t border-neutral-700">
        <button className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors">
          + Add Page
        </button>
      </div>
    </div>
  );
}

function DemoCanvas() {
  return (
    <div className="flex items-center justify-center h-full bg-neutral-900">
      <div className="text-center text-neutral-500">
        <div className="text-4xl mb-4">⬛</div>
        <p className="text-sm mb-2">Canvas Area (70% width)</p>
        <p className="text-xs text-neutral-600">React Flow Canvas would render here</p>
        <div className="mt-4 text-xs text-neutral-700 max-w-xs mx-auto">
          <p>• Resize the sidebar by dragging the border</p>
          <p>• Toggle sidebar with button in top-left</p>
          <p>• Responsive breakpoint at 1200px viewport</p>
        </div>
      </div>
    </div>
  );
}

function DemoInspector() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-neutral-700">
        <h3 className="text-xs font-semibold text-white">Inspector</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs text-neutral-500">
        <p>Element properties would show here</p>
      </div>
    </div>
  );
}

/**
 * SplitViewLayoutDemo component
 * Shows how to integrate SplitViewLayout in funnel-studio.tsx
 */
export function SplitViewLayoutDemo({ showDebug = false }: DemoProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    toggleCount: 0,
    lastToggle: new Date().toLocaleTimeString(),
  });

  // Simulates how to persist sidebar preference
  useEffect(() => {
    const stored = localStorage.getItem("demo-funnel-sidebar-open");
    if (stored === "false") {
      setSidebarOpen(false);
    }
  }, []);

  const handleSidebarToggle = (isOpen: boolean) => {
    setSidebarOpen(isOpen);
    localStorage.setItem("demo-funnel-sidebar-open", String(isOpen));

    // Track analytics
    setStats({
      toggleCount: stats.toggleCount + 1,
      lastToggle: new Date().toLocaleTimeString(),
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Top Bar */}
      <div className="h-12 flex items-center px-4 border-b border-neutral-700 bg-neutral-950">
        <h1 className="text-sm font-semibold text-white">
          Funnel Builder - Split View Demo
        </h1>
        {showDebug && (
          <div className="ml-auto text-xs text-neutral-500">
            Toggles: {stats.toggleCount} | Last: {stats.lastToggle}
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
        <SplitViewLayout
          sidebar={<DemoSidebar />}
          canvas={<DemoCanvas />}
          inspector={<DemoInspector />}
          initialSidebarOpen={sidebarOpen}
          sidebarWidth={280}
          minSidebarWidth={200}
          maxSidebarWidth={400}
          responsiveBreakpoint={1200}
          canvasMinWidth={500}
          onSidebarToggle={handleSidebarToggle}
          className="bg-black"
        />
      </div>

      {/* Status Bar */}
      <div className="h-8 flex items-center px-4 border-t border-neutral-700 bg-neutral-950 text-xs text-neutral-500">
        <span>Sidebar: {sidebarOpen ? "Open" : "Closed"}</span>
        <span className="ml-auto">
          Responsive breakpoint: 1200px | Canvas min: 500px
        </span>
      </div>
    </div>
  );
}

/**
 * Integration Pattern for funnel-studio.tsx
 *
 * Replace this:
 * ```
 * return (
 *   <div>
 *     <TopBar />
 *     <div style={{ display: "flex" }}>
 *       <Sidebar />
 *       <Canvas />
 *       <Inspector />
 *     </div>
 *   </div>
 * );
 * ```
 *
 * With this:
 * ```
 * const [sidebarOpen, setSidebarOpen] = useState(true);
 *
 * const handleSidebarToggle = (isOpen: boolean) => {
 *   setSidebarOpen(isOpen);
 *   localStorage.setItem("funnel-sidebar-open", String(isOpen));
 * };
 *
 * return (
 *   <div>
 *     <TopBar />
 *     <SplitViewLayout
 *       sidebar={<Sidebar ... />}
 *       canvas={<ReactFlow ... />}
 *       inspector={<Inspector ... />}
 *       initialSidebarOpen={sidebarOpen}
 *       onSidebarToggle={handleSidebarToggle}
 *     />
 *   </div>
 * );
 * ```
 */

/**
 * Responsive Breakpoint Behavior
 *
 * At different viewport widths:
 *
 * 400px (mobile):
 * ├─ Sidebar: Hidden (responsive breakpoint 1200px)
 * ├─ Canvas: 400px (100%)
 * └─ Inspector: Visible, scrollable
 *
 * 1200px (tablet):
 * ├─ Sidebar: Hidden (at breakpoint)
 * ├─ Canvas: 1140px (95%)
 * └─ Inspector: Visible
 *
 * 1400px (desktop):
 * ├─ Sidebar: 280px (20%)
 * ├─ Resize: 1px
 * ├─ Canvas: 1060px (76%)
 * └─ Inspector: 60px (4%)
 */

export default SplitViewLayoutDemo;
