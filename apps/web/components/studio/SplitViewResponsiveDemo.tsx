"use client";

/**
 * Responsive Split-View Demo with Breakpoint Testing
 *
 * Demonstrates:
 * 1. All responsive breakpoints (320px, 768px, 1024px, 1200px, 1400px+)
 * 2. Touch interactions and swipe gestures
 * 3. Landscape/portrait orientation handling
 * 4. Touch-friendly 44px minimum targets
 * 5. Mobile overlay sidebar with backdrop
 * 6. Keyboard shortcuts (Cmd+K, Escape)
 */

import { useState, useEffect } from "react";
import { SplitViewLayoutResponsive } from "./SplitViewLayoutResponsive";

interface BreakpointTestResult {
  viewport: string;
  sidebarVisible: boolean;
  layoutMode: "mobile" | "tablet" | "desktop";
  orientation: "portrait" | "landscape";
  passed: boolean;
}

interface DemoState {
  simulatedViewport: { width: number; height: number } | null;
  testResults: BreakpointTestResult[];
  toggleCount: number;
  lastToggle: string;
  lastOrientation: "portrait" | "landscape" | null;
  gestureLog: string[];
}

/**
 * Demo Sidebar Component
 */
function DemoSidebar({ mode }: { mode: "mobile" | "tablet" | "desktop" }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-neutral-700 sticky top-0 bg-neutral-950">
        <h2 className="text-sm font-semibold text-white">Pages</h2>
        <p className="text-xs text-neutral-500 mt-1">Layout: {mode}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {["Landing Page", "Sales Page", "Order Form", "Thank You", "Follow-up"].map(
          (page, idx) => (
            <button
              key={page}
              className="w-full text-left px-3 py-3 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors active:bg-neutral-700 min-h-12"
              data-testid={`sidebar-item-${idx}`}
            >
              {page}
            </button>
          )
        )}
      </div>
      <div className="p-4 border-t border-neutral-700 sticky bottom-0 bg-neutral-950">
        <button
          className="w-full px-3 py-3 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm transition-colors min-h-12"
          data-testid="add-page-btn"
        >
          + Add Page
        </button>
      </div>
    </div>
  );
}

/**
 * Demo Canvas Component
 */
function DemoCanvas({ mode }: { mode: "mobile" | "tablet" | "desktop" }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-neutral-900 p-4">
      <div className="text-center text-neutral-500 max-w-md">
        <div className="text-6xl mb-4">⬛</div>
        <p className="text-lg font-semibold mb-2">Canvas Area</p>
        <p className="text-sm text-neutral-400 mb-6">
          React Flow Canvas renders here | Mode: {mode}
        </p>

        <div className="bg-neutral-800 rounded p-4 text-left text-xs text-neutral-400 space-y-2">
          <div className="font-semibold text-neutral-300">Controls:</div>
          <div>• Desktop: Drag sidebar edge to resize</div>
          <div>• Mobile: Swipe left/right to toggle</div>
          <div>• All: Cmd/Ctrl + K to toggle</div>
          <div>• Mobile: Press Escape to close</div>
          <div className="text-neutral-500 mt-3">
            Touch targets: 44px minimum | Fully accessible
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Demo Inspector Component
 */
function DemoInspector() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-neutral-700 sticky top-0 bg-neutral-950">
        <h3 className="text-xs font-semibold text-white">Inspector</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs text-neutral-500 space-y-3">
        <div>
          <div className="text-neutral-300 font-semibold mb-1">Element</div>
          <div>Selected: Canvas Frame</div>
        </div>
        <div>
          <div className="text-neutral-300 font-semibold mb-1">Properties</div>
          <div>Width: 100%</div>
          <div>Height: auto</div>
          <div>Padding: 24px</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Demo Component with Breakpoint Testing
 */
export function SplitViewResponsiveDemo() {
  const [state, setState] = useState<DemoState>({
    simulatedViewport: null,
    testResults: [],
    toggleCount: 0,
    lastToggle: "",
    lastOrientation: null,
    gestureLog: [],
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [realViewport, setRealViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  });

  // Track real viewport changes
  useEffect(() => {
    const handleResize = () => {
      setRealViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSidebarToggle = (isOpen: boolean) => {
    setSidebarOpen(isOpen);
    setState((prev) => ({
      ...prev,
      toggleCount: prev.toggleCount + 1,
      lastToggle: new Date().toLocaleTimeString(),
    }));
  };

  const handleOrientationChange = (orientation: "portrait" | "landscape") => {
    setState((prev) => ({
      ...prev,
      lastOrientation: orientation,
      gestureLog: [...prev.gestureLog.slice(-4), `Orientation: ${orientation}`],
    }));
  };

  // Predefined breakpoints for testing
  const testBreakpoints = [
    { name: "iPhone SE", width: 375, height: 667, mode: "mobile" as const },
    { name: "iPhone 14 Pro", width: 393, height: 852, mode: "mobile" as const },
    { name: "iPad Mini", width: 768, height: 1024, mode: "tablet" as const },
    { name: "iPad Pro", width: 1024, height: 1366, mode: "desktop" as const },
    { name: "Laptop", width: 1440, height: 900, mode: "desktop" as const },
    { name: "Ultra-wide", width: 1920, height: 1080, mode: "desktop" as const },
  ];

  // Calculate current layout mode
  const getCurrentMode = (width: number): "mobile" | "tablet" | "desktop" => {
    if (width <= 480) return "mobile";
    if (width <= 1024) return "tablet";
    return "desktop";
  };

  const currentWidth = state.simulatedViewport?.width ?? realViewport.width;
  const currentMode = getCurrentMode(currentWidth);

  return (
    <div className="w-full h-screen flex flex-col bg-neutral-950 overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-700 bg-black shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">
            Responsive Split-View Demo
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {currentWidth}x{state.simulatedViewport?.height ?? realViewport.height}px • {currentMode} mode
          </p>
        </div>
        <div className="text-xs text-neutral-400 space-y-1">
          <div>Toggles: {state.toggleCount}</div>
          <div>Last: {state.lastToggle || "none"}</div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex gap-4">
        {/* Split View */}
        <div className="flex-1 overflow-hidden">
          <SplitViewLayoutResponsive
            sidebar={<DemoSidebar mode={currentMode} />}
            canvas={<DemoCanvas mode={currentMode} />}
            inspector={<DemoInspector />}
            initialSidebarOpen={sidebarOpen}
            responsiveBreakpoints={{
              mobile: 480,
              tablet: 1024,
              desktop: 1025,
            }}
            onSidebarToggle={handleSidebarToggle}
            onOrientationChange={handleOrientationChange}
          />
        </div>

        {/* Breakpoint Tester (Desktop view only) */}
        {currentMode === "desktop" && (
          <div className="w-80 border-l border-neutral-700 bg-neutral-900 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-700 bg-black shrink-0">
              <h2 className="text-sm font-semibold text-white">Breakpoint Tester</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-300">Test Viewports:</p>
                {testBreakpoints.map((bp) => (
                  <button
                    key={bp.name}
                    onClick={() => {
                      // Simulate viewport change
                      setState((prev) => ({
                        ...prev,
                        simulatedViewport: { width: bp.width, height: bp.height },
                        gestureLog: [
                          ...prev.gestureLog.slice(-4),
                          `Test: ${bp.name} (${bp.width}x${bp.height})`,
                        ],
                      }));
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                      state.simulatedViewport?.width === bp.width
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                    data-testid={`test-${bp.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="font-semibold">{bp.name}</div>
                    <div className="text-neutral-500">
                      {bp.width}x{bp.height} • {bp.mode}
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-neutral-700 pt-3">
                <p className="text-xs font-semibold text-neutral-300 mb-2">Gesture Log:</p>
                <div className="bg-neutral-950 rounded p-2 text-xs text-neutral-400 space-y-1 max-h-32 overflow-y-auto font-mono">
                  {state.gestureLog.length === 0 ? (
                    <div>No gestures yet</div>
                  ) : (
                    state.gestureLog.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-700 pt-3">
                <p className="text-xs font-semibold text-neutral-300 mb-2">Breakpoint Info:</p>
                <div className="bg-neutral-950 rounded p-2 text-xs text-neutral-400 space-y-1">
                  <div>Mobile: 0-480px</div>
                  <div>Tablet: 481-1024px</div>
                  <div>Desktop: 1025px+</div>
                  <div className="text-neutral-500 mt-2">Touch: 44px min</div>
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <div className="px-4 py-3 border-t border-neutral-700 bg-black shrink-0 text-xs text-neutral-500">
              <div>Sidebar: {sidebarOpen ? "Open" : "Closed"}</div>
              {state.lastOrientation && <div>Orient: {state.lastOrientation}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="h-10 flex items-center px-4 border-t border-neutral-700 bg-black text-xs text-neutral-500 shrink-0">
        <span>Responsive: {currentMode} | Touch targets: 44px</span>
        <span className="ml-auto">
          Keyboard: Cmd+K to toggle • Escape to close (mobile)
        </span>
      </div>
    </div>
  );
}

export default SplitViewResponsiveDemo;
