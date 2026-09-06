"use client";

/**
 * LessonVisualsRenderer
 *
 * Dynamically renders the appropriate visual component based on lesson ID.
 * Handles lazy loading, error boundaries, and dark mode support.
 *
 * Usage:
 *   <LessonVisualsRenderer lessonId="m-business-definition" data={...} />
 */

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getVisualForLesson, hasVisual } from "../lib/lesson-visuals-map";

// Dynamic imports with loading/error states
const BusinessDefinitionVisuals = dynamic(
  () => import("./programme/BusinessDefinitionVisuals").then(m => ({ default: m.BusinessDefinitionVisuals })),
  {
    loading: () => <div className="lvr-skeleton">Loading visuals...</div>,
    ssr: true,
  }
);

const Phase2LessonVisuals = dynamic(
  () => import("./programme/Phase2LessonVisuals").then(m => ({ default: m.Phase2LessonVisuals })),
  {
    loading: () => <div className="lvr-skeleton">Loading visuals...</div>,
    ssr: true,
  }
);

interface LessonVisualsRendererProps {
  lessonId: string;
  data?: Record<string, unknown>;
  className?: string;
}

export function LessonVisualsRenderer({
  lessonId,
  data,
  className = "",
}: LessonVisualsRendererProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Detect dark mode from HTML data-theme or system preference
  useEffect(() => {
    setIsMounted(true);
    const detectDarkMode = () => {
      const htmlElement = document.documentElement;
      const dataTheme = htmlElement.getAttribute("data-theme");

      if (dataTheme === "dark") {
        setIsDarkMode(true);
      } else if (dataTheme === "light") {
        setIsDarkMode(false);
      } else {
        // Fall back to system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDarkMode(prefersDark);
      }
    };

    detectDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(detectDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => detectDarkMode();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  if (!isMounted) {
    return <div className="lvr-skeleton">Loading...</div>;
  }

  if (!hasVisual(lessonId)) {
    return null;
  }

  const visualConfig = getVisualForLesson(lessonId);
  if (!visualConfig) {
    return null;
  }

  const mergedData = { ...visualConfig.demoData, ...data };

  return (
    <div className={`lvr-root ${className}`} data-theme={isDarkMode ? "dark" : "light"}>
      <style>{CSS}</style>

      <Suspense fallback={<div className="lvr-skeleton">Loading {visualConfig.title}...</div>}>
        {visualConfig.visualType === "business-definition" && (
          <BusinessDefinitionVisuals
            title={visualConfig.title}
            competitors={mergedData.competitors as any}
            yourPosition={mergedData.yourPosition as any}
            ladder={mergedData.ladder as any}
            avatar={mergedData.avatar as any}
          />
        )}

        {visualConfig.visualType === "sales-funnel" && (
          <Phase2LessonVisuals
            title={visualConfig.title}
            funnelStages={mergedData.funnel as any}
            splitTests={mergedData.splitTests as any}
            kpis={mergedData.kpis as any}
            showFunnel={mergedData.showFunnel as any}
            showDashboard={mergedData.showDashboard as any}
            showTeam={mergedData.showTeam as any}
          />
        )}
      </Suspense>
    </div>
  );
}

const CSS = `
.lvr-root {
  --lvr-bg: var(--ds-surface, white);
  --lvr-text: var(--ds-text-primary, #111827);
  --lvr-border: var(--ds-border-subtle, #e5e7eb);
  background: var(--lvr-bg);
  color: var(--lvr-text);
  padding: 24px;
  border-radius: var(--ds-radius-md, 8px);
  margin: 24px 0;
  border: 1px solid var(--lvr-border);
}

.lvr-root[data-theme="dark"] {
  --lvr-bg: var(--ds-surface, #1a1a1a);
  --lvr-text: var(--ds-text-primary, #f5f5f5);
  --lvr-border: var(--ds-border-subtle, #333);
}

.lvr-skeleton {
  background: linear-gradient(
    90deg,
    var(--lvr-bg) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    var(--lvr-bg) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  height: 200px;
  border-radius: 8px;
  margin: 24px 0;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 768px) {
  .lvr-root {
    padding: 16px;
    margin: 16px 0;
  }
}
`;

export default LessonVisualsRenderer;
