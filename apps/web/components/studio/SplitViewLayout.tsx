"use client";

import { ReactNode, useState, useRef, useEffect } from "react";

interface SplitViewLayoutProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  initialSidebarOpen?: boolean;
  sidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  responsiveBreakpoint?: number; // px width below which sidebar auto-collapses
  canvasMinWidth?: number; // px minimum width for canvas
  onSidebarToggle?: (isOpen: boolean) => void;
  className?: string;
}

/**
 * SplitViewLayout component for FunnelCanvasBuilder
 *
 * Provides a responsive split-view layout with:
 * - Collapsible sidebar (left panel)
 * - Resizable canvas area (center, takes 70% at default)
 * - Optional inspector panel (right)
 * - Responsive breakpoint handling
 * - Persistent width preferences
 *
 * Layout: [Sidebar: 25%] [Canvas: 70%] [Inspector: 5%]
 */
export function SplitViewLayout({
  sidebar,
  canvas,
  inspector,
  initialSidebarOpen = true,
  sidebarWidth = 280,
  minSidebarWidth = 200,
  maxSidebarWidth = 400,
  responsiveBreakpoint = 1200, // collapse sidebar below 1200px
  canvasMinWidth = 500,
  onSidebarToggle,
  className = "",
}: SplitViewLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [currentSidebarWidth, setCurrentSidebarWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  // Auto-collapse sidebar on responsive breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        if (containerWidth < responsiveBreakpoint && sidebarOpen) {
          setSidebarOpen(false);
          onSidebarToggle?.(false);
        } else if (containerWidth >= responsiveBreakpoint && !sidebarOpen) {
          setSidebarOpen(true);
          onSidebarToggle?.(true);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen, responsiveBreakpoint, onSidebarToggle]);

  // Handle drag-to-resize sidebar
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sidebarOpen) {
      setIsResizing(true);
      resizeStartRef.current = {
        x: e.clientX,
        width: currentSidebarWidth,
      };
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const delta = e.clientX - resizeStartRef.current.x;
      const newWidth = Math.max(
        minSidebarWidth,
        Math.min(maxSidebarWidth, resizeStartRef.current.width + delta)
      );
      setCurrentSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minSidebarWidth, maxSidebarWidth]);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    onSidebarToggle?.(newState);
  };

  // Calculate canvas width (approximately 70% of available space)
  const containerWidth = containerRef.current?.offsetWidth ?? 1000;
  const sidebarDisplayWidth = sidebarOpen ? currentSidebarWidth : 0;
  const inspectorWidth = inspector ? 60 : 0; // small inspector width
  const canvasWidth = Math.max(
    canvasMinWidth,
    containerWidth - sidebarDisplayWidth - inspectorWidth
  );
  const canvasPercentage = ((canvasWidth / containerWidth) * 100).toFixed(1);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full overflow-hidden bg-black ${className}`}
      data-testid="split-view-layout"
    >
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="flex flex-col border-r border-neutral-700 bg-neutral-950 overflow-y-auto transition-all duration-300"
          style={{
            width: `${currentSidebarWidth}px`,
            minWidth: `${minSidebarWidth}px`,
            maxWidth: `${maxSidebarWidth}px`,
          }}
          data-testid="split-view-sidebar"
        >
          {sidebar}
        </div>
      )}

      {/* Resize Handle */}
      {sidebarOpen && (
        <div
          className={`w-1 bg-neutral-700 hover:bg-blue-500 transition-colors cursor-col-resize ${
            isResizing ? "bg-blue-500" : ""
          }`}
          onMouseDown={handleResizeStart}
          data-testid="split-view-resize-handle"
        />
      )}

      {/* Canvas Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden bg-black relative"
        style={{ minWidth: `${canvasMinWidth}px` }}
        data-testid="split-view-canvas"
        data-canvas-width={canvasPercentage}
      >
        {/* Canvas Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute top-4 left-4 z-10 p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors border border-neutral-700 text-white"
          title={sidebarOpen ? "Hide sidebar (Cmd+K)" : "Show sidebar (Cmd+K)"}
          data-testid="split-view-toggle-btn"
        >
          {sidebarOpen ? (
            // Chevron Left SVG
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            // Chevron Right SVG
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {canvas}
      </div>

      {/* Inspector Panel (optional) */}
      {inspector && (
        <div
          className="flex flex-col border-l border-neutral-700 bg-neutral-950 overflow-y-auto"
          style={{ width: `${inspectorWidth}px` }}
          data-testid="split-view-inspector"
        >
          {inspector}
        </div>
      )}

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === "development" && (
        <div
          className="absolute bottom-2 right-2 text-xs text-neutral-500 bg-neutral-900 p-2 rounded border border-neutral-700 pointer-events-none"
          data-testid="split-view-debug-info"
        >
          <div>Sidebar: {sidebarOpen ? "Open" : "Closed"}</div>
          <div>Canvas: {canvasPercentage}%</div>
          <div>Container: {containerWidth}px</div>
        </div>
      )}
    </div>
  );
}

export default SplitViewLayout;
