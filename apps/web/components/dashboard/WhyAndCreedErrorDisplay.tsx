"use client";

import { useState, useEffect } from "react";
import { ChevronRightIcon, HeartIcon as HeartHandshakeIcon } from "@heroicons/react/24/outline";
import type { WhyAndCreedData } from "./WhyAndCreedSection";

interface WhyAndCreedErrorDisplayProps {
  /**
   * Optional why/creed data to display.
   * If not provided, the component will attempt to fetch it
   */
  data?: WhyAndCreedData | null;
  workspaceId?: string;

  /**
   * Optional callback when user clicks "Refocus on Why" CTA
   * Default: navigates to command-center
   */
  onRefocus?: () => void;

  /**
   * Optional callback when user closes the component
   */
  onClose?: () => void;

  /**
   * Size variant for different contexts (modal vs embedded)
   * @default "compact"
   */
  variant?: "compact" | "standard" | "minimal";

  /**
   * Whether to show the close button
   * @default true
   */
  showClose?: boolean;
}

/**
 * WhyAndCreedErrorDisplay
 *
 * Shows a user's "Why" and "Creed" on error pages and fallback modals to
 * remind them of their purpose during friction moments.
 *
 * Features:
 * - Compact, non-intrusive design
 * - Emotional support during failures
 * - Subtle animations (pulse, soft glow)
 * - Dark mode support
 * - CTA to refocus on why (default: navigate to command-center)
 * - Graceful degradation when why/creed is not available
 *
 * Usage:
 * ```tsx
 * // In an error boundary or error page:
 * <WhyAndCreedErrorDisplay
 *   workspaceId={workspaceId}
 *   variant="compact"
 *   onRefocus={() => router.push('/command-center')}
 * />
 *
 * // With pre-fetched data:
 * <WhyAndCreedErrorDisplay
 *   data={whyCreedData}
 *   variant="standard"
 *   onClose={() => setShowError(false)}
 * />
 * ```
 */
export function WhyAndCreedErrorDisplay({
  data: initialData,
  workspaceId,
  onRefocus,
  onClose,
  variant = "compact",
  showClose = true,
}: WhyAndCreedErrorDisplayProps) {
  const [data, setData] = useState<WhyAndCreedData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData && !!workspaceId);
  const [, setHasError] = useState(false);

  // Fetch why/creed data if not provided
  useEffect(() => {
    if (!isLoading || !workspaceId) return;

    const fetchWhyAndCreed = async () => {
      try {
        const response = await fetch(
          `/api/workspace/${workspaceId}/why-creed`,
          {
            credentials: "include",
          }
        );

        if (response.ok) {
          const fetched = await response.json();
          setData(fetched);
        }
      } catch (error) {
        console.error("Failed to fetch why/creed for error display:", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWhyAndCreed();
  }, [isLoading, workspaceId]);

  // If no data and can't/won't load it, render nothing
  if (!data && !isLoading) {
    return null;
  }

  // Render based on variant
  if (variant === "minimal") {
    return (
      <MinimalErrorDisplay
        data={data}
        isLoading={isLoading}
        onRefocus={onRefocus}
      />
    );
  }

  if (variant === "standard") {
    return (
      <StandardErrorDisplay
        data={data}
        isLoading={isLoading}
        onRefocus={onRefocus}
        onClose={onClose}
        showClose={showClose}
      />
    );
  }

  // Default: compact
  return (
    <CompactErrorDisplay
      data={data}
      isLoading={isLoading}
      onRefocus={onRefocus}
    />
  );
}

/**
 * CompactErrorDisplay - Lightweight version for modal footers or inline display
 */
function CompactErrorDisplay({
  data,
  isLoading,
  onRefocus,
}: {
  data: WhyAndCreedData | null;
  isLoading: boolean;
  onRefocus?: () => void;
}) {
  const handleRefocus = () => {
    if (onRefocus) {
      onRefocus();
    } else {
      window.location.href = "/command-center";
    }
  };

  if (!data && !isLoading) return null;

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
        <HeartHandshakeIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Remember your Why</span>
      </div>

      {isLoading ? (
        <div className="space-y-1 animate-pulse">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
        </div>
      ) : data?.why ? (
        <div className="space-y-1.5 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
            {data.why}
          </p>
          {data.creed && (
            <p className="text-xs text-slate-600 dark:text-slate-300 italic">
              "{data.creed}"
            </p>
          )}
        </div>
      ) : null}

      <button
        onClick={handleRefocus}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <span>Refocus on Why</span>
        <ChevronRightIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * StandardErrorDisplay - Full display for dedicated error modals
 */
function StandardErrorDisplay({
  data,
  isLoading,
  onRefocus,
  onClose,
  showClose,
}: {
  data: WhyAndCreedData | null;
  isLoading: boolean;
  onRefocus?: () => void;
  onClose?: () => void;
  showClose: boolean;
}) {
  const handleRefocus = () => {
    if (onRefocus) {
      onRefocus();
    } else {
      window.location.href = "/command-center";
    }
  };

  if (!data && !isLoading) return null;

  return (
    <div className="group relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/40 dark:via-purple-950/40 dark:to-pink-950/40 rounded-xl p-6 border border-blue-200/60 dark:border-blue-800/40 shadow-lg overflow-hidden">
      {/* Subtle animated background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/5 to-purple-400/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 dark:bg-blue-600/20 rounded-lg">
              <HeartHandshakeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Remember Your Purpose
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Let's refocus on what matters
              </p>
            </div>
          </div>

          {showClose && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3 mt-3" />
          </div>
        ) : data?.why ? (
          <div className="space-y-3">
            {/* Why */}
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1.5">
                🎯 Your Why
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                {data.why}
              </p>
            </div>

            {/* Creed - if available */}
            {data.creed && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1.5">
                  ⚡ Your Creed
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "{data.creed}"
                </p>
              </div>
            )}

            {/* Energy indicator */}
            <div className="flex items-center gap-2 pt-1 opacity-60">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-600/50 dark:bg-blue-400/50 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                You've got this
              </span>
            </div>
          </div>
        ) : null}

        {/* CTA */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleRefocus}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-md active:scale-95"
          >
            <span>Refocus on Your Why</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * MinimalErrorDisplay - Tiny inline display for error toasts or notifications
 */
function MinimalErrorDisplay({
  data,
  isLoading,
  onRefocus,
}: {
  data: WhyAndCreedData | null;
  isLoading: boolean;
  onRefocus?: () => void;
}) {
  const handleRefocus = () => {
    if (onRefocus) {
      onRefocus();
    } else {
      window.location.href = "/command-center";
    }
  };

  if (!data && !isLoading) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {isLoading ? (
        <>
          <HeartHandshakeIcon className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">Loading your why...</span>
        </>
      ) : data?.why ? (
        <>
          <HeartHandshakeIcon className="w-4 h-4 flex-shrink-0" />
          <button
            onClick={handleRefocus}
            className="text-sm font-medium hover:underline"
            title={data.why}
          >
            Remember your purpose
          </button>
        </>
      ) : null}
    </div>
  );
}
