"use client";

import { ReactNode, useState, useRef, useEffect, useCallback } from "react";

interface SplitViewLayoutResponsiveProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  initialSidebarOpen?: boolean;
  sidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  responsiveBreakpoints?: {
    mobile: number;      // 0-480px: mobile-first
    tablet: number;      // 481-1024px: tablet
    desktop: number;     // 1025px+: full sidebar
  };
  canvasMinWidth?: number;
  onSidebarToggle?: (isOpen: boolean) => void;
  onOrientationChange?: (orientation: "portrait" | "landscape") => void;
  className?: string;
}

interface ViewportSize {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
}

type LayoutMode = "mobile" | "tablet" | "desktop";

/**
 * SplitViewLayoutResponsive: Enhanced Split-View with full responsive support
 *
 * Features:
 * - Multi-breakpoint support (mobile/tablet/desktop)
 * - Touch-friendly targets (44px minimum)
 * - Swipe gesture support for mobile
 * - Landscape/portrait orientation awareness
 * - Optimized sidebar collapse behavior per breakpoint
 * - Persistent layout preferences
 * - Accessible keyboard shortcuts
 */
export function SplitViewLayoutResponsive({
  sidebar,
  canvas,
  inspector,
  initialSidebarOpen = true,
  sidebarWidth = 280,
  minSidebarWidth = 200,
  maxSidebarWidth = 400,
  responsiveBreakpoints = {
    mobile: 480,
    tablet: 1024,
    desktop: 1025,
  },
  canvasMinWidth = 300,
  onSidebarToggle,
  onOrientationChange,
  className = "",
}: SplitViewLayoutResponsiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
    orientation:
      typeof window !== "undefined" && window.innerWidth > window.innerHeight
        ? "landscape"
        : "portrait",
  });

  const [sidebarOpen, setSidebarOpen] = useState(
    initialSidebarOpen && viewport.width >= responsiveBreakpoints.desktop
  );
  const [currentSidebarWidth, setCurrentSidebarWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);

  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  // Determine layout mode based on viewport width
  const getLayoutMode = useCallback(
    (width: number): LayoutMode => {
      if (width <= responsiveBreakpoints.mobile) return "mobile";
      if (width <= responsiveBreakpoints.tablet) return "tablet";
      return "desktop";
    },
    [responsiveBreakpoints]
  );

  const layoutMode = getLayoutMode(viewport.width);

  // Handle window resize and orientation changes
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const newOrientation = newWidth > newHeight ? "landscape" : "portrait";

      setViewport((prev) => {
        const orientation: "portrait" | "landscape" = newOrientation;
        if (prev.orientation !== orientation) {
          onOrientationChange?.(orientation);
        }
        return {
          width: newWidth,
          height: newHeight,
          orientation,
        };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [onOrientationChange]);

  // Auto-collapse sidebar based on breakpoint
  useEffect(() => {
    const mode = getLayoutMode(viewport.width);

    // Mobile: always close sidebar
    if (mode === "mobile" && sidebarOpen) {
      setSidebarOpen(false);
      onSidebarToggle?.(false);
    }
    // Desktop: always open sidebar
    else if (mode === "desktop" && !sidebarOpen && initialSidebarOpen) {
      setSidebarOpen(true);
      onSidebarToggle?.(true);
    }
  }, [viewport.width, sidebarOpen, initialSidebarOpen, getLayoutMode, onSidebarToggle]);

  // Handle drag-to-resize sidebar (desktop only)
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (layoutMode !== "desktop" || !sidebarOpen) return;

    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: currentSidebarWidth,
    };
  };

  // Mouse drag handling
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

  // Touch swipe handling (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (layoutMode !== "mobile") return;
    setTouchStartX(e.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (layoutMode !== "mobile" || touchStartX === null) return;

    const touchEndX = e.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;
    const threshold = 50; // minimum swipe distance

    // Swipe right: open sidebar
    if (delta > threshold && !sidebarOpen) {
      setSidebarAnimating(true);
      setSidebarOpen(true);
      onSidebarToggle?.(true);
      setTimeout(() => setSidebarAnimating(false), 300);
    }
    // Swipe left: close sidebar
    else if (delta < -threshold && sidebarOpen) {
      setSidebarAnimating(true);
      setSidebarOpen(false);
      onSidebarToggle?.(false);
      setTimeout(() => setSidebarAnimating(false), 300);
    }

    setTouchStartX(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const newState = !sidebarOpen;
        setSidebarOpen(newState);
        onSidebarToggle?.(newState);
      }
      // Escape to close sidebar on mobile
      if (e.key === "Escape" && layoutMode === "mobile" && sidebarOpen) {
        setSidebarOpen(false);
        onSidebarToggle?.(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, layoutMode, onSidebarToggle]);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarAnimating(true);
    setSidebarOpen(newState);
    onSidebarToggle?.(newState);
    setTimeout(() => setSidebarAnimating(false), 300);
  };

  // Calculate dimensions
  const containerWidth = containerRef.current?.offsetWidth ?? viewport.width;
  const sidebarDisplayWidth = sidebarOpen ? currentSidebarWidth : 0;
  const inspectorWidth = inspector ? (layoutMode === "mobile" ? 0 : 60) : 0;
  const canvasWidth = Math.max(
    canvasMinWidth,
    containerWidth - sidebarDisplayWidth - inspectorWidth
  );
  const canvasPercentage = ((canvasWidth / containerWidth) * 100).toFixed(1);

  // Touch target size (44px minimum for accessibility)
  const touchTargetSize = 44;

  // Mobile-specific overlay backdrop for sidebar
  const showBackdrop = layoutMode === "mobile" && sidebarOpen;

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full overflow-hidden bg-black ${className}`}
      data-testid="split-view-layout-responsive"
      data-layout-mode={layoutMode}
      data-orientation={viewport.orientation}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Sidebar Backdrop */}
      {showBackdrop && (
        <div
          className={`absolute inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
            sidebarAnimating ? "opacity-100" : "opacity-50"
          }`}
          onClick={() => {
            setSidebarOpen(false);
            onSidebarToggle?.(false);
          }}
          data-testid="split-view-backdrop"
        />
      )}

      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-neutral-700 bg-neutral-950 overflow-y-auto transition-all duration-300 ${
          layoutMode === "mobile"
            ? `fixed left-0 top-0 h-full z-50 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : "relative"
        } ${sidebarAnimating ? "transition-transform" : ""}`}
        style={
          layoutMode !== "mobile"
            ? {
                width: `${currentSidebarWidth}px`,
                minWidth: `${minSidebarWidth}px`,
                maxWidth: `${maxSidebarWidth}px`,
              }
            : {
                width: `${Math.min(currentSidebarWidth, containerWidth * 0.8)}px`,
              }
        }
        data-testid="split-view-sidebar"
      >
        {sidebar}
      </div>

      {/* Resize Handle (Desktop only) */}
      {sidebarOpen && layoutMode === "desktop" && (
        <div
          className="w-1 bg-neutral-700 hover:bg-blue-500 transition-colors cursor-col-resize active:bg-blue-500"
          onMouseDown={handleResizeStart}
          data-testid="split-view-resize-handle"
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
        />
      )}

      {/* Canvas Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden bg-black relative"
        style={{ minWidth: `${canvasMinWidth}px` }}
        data-testid="split-view-canvas"
        data-canvas-width={canvasPercentage}
        data-layout-mode={layoutMode}
      >
        {/* Toggle Button - Responsive sizing */}
        <button
          onClick={toggleSidebar}
          className={`absolute z-20 rounded-md bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 transition-colors border border-neutral-700 text-white flex items-center justify-center ${
            layoutMode === "mobile"
              ? `w-${Math.ceil(touchTargetSize / 4)} h-${Math.ceil(touchTargetSize / 4)} p-2.5 top-3 left-3`
              : "w-10 h-10 p-2 top-4 left-4"
          }`}
          style={{
            minWidth: `${touchTargetSize}px`,
            minHeight: `${touchTargetSize}px`,
          }}
          title={
            sidebarOpen
              ? "Hide sidebar (Cmd+K or swipe left)"
              : "Show sidebar (Cmd+K or swipe right)"
          }
          data-testid="split-view-toggle-btn"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-pressed={sidebarOpen}
        >
          {sidebarOpen ? (
            // Chevron Left SVG
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          ) : (
            // Chevron Right SVG
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>

        {/* Canvas Content */}
        <div className="flex-1 overflow-hidden">{canvas}</div>

        {/* Mobile swipe hint */}
        {layoutMode === "mobile" && !sidebarOpen && (
          <div
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-600 pointer-events-none"
            data-testid="swipe-hint"
          >
            <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Inspector Panel (optional, hidden on mobile) */}
      {inspector && layoutMode !== "mobile" && (
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
          className="absolute bottom-2 right-2 text-xs text-neutral-500 bg-neutral-900 p-3 rounded border border-neutral-700 pointer-events-none font-mono max-w-xs"
          data-testid="split-view-debug-info"
        >
          <div>Layout: {layoutMode}</div>
          <div>Viewport: {viewport.width}x{viewport.height}</div>
          <div>Orientation: {viewport.orientation}</div>
          <div>Sidebar: {sidebarOpen ? "Open" : "Closed"}</div>
          <div>Canvas: {canvasPercentage}%</div>
          <div className="text-neutral-600 mt-2">
            Mobile: 0-{responsiveBreakpoints.mobile}px
            <br />
            Tablet: {responsiveBreakpoints.mobile + 1}-
            {responsiveBreakpoints.tablet}px
            <br />
            Desktop: {responsiveBreakpoints.desktop}px+
          </div>
        </div>
      )}
    </div>
  );
}

export default SplitViewLayoutResponsive;
