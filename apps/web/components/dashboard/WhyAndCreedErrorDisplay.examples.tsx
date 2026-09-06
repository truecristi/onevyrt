/**
 * WhyAndCreedErrorDisplay Examples
 *
 * Visual reference and interactive examples for all three variants
 * of the WhyAndCreedErrorDisplay component.
 *
 * Usage:
 * import { WhyAndCreedErrorDisplayShowcase } from "@/components/dashboard/WhyAndCreedErrorDisplay.examples";
 * export default () => <WhyAndCreedErrorDisplayShowcase />;
 */

import { useState } from "react";
import { WhyAndCreedErrorDisplay } from "./WhyAndCreedErrorDisplay";
import type { WhyAndCreedData } from "./WhyAndCreedSection";

// Example data
const EXAMPLE_DATA: WhyAndCreedData = {
  workspaceId: "example-ws-123",
  why: "I want to help entrepreneurs build sustainable businesses that create impact and freedom for their families.",
  creed: "We prioritize real growth over quick wins, always put customer success first, and build with integrity.",
};

/**
 * CompactVariantExample
 *
 * Shows compact variant for modal footers and inline displays
 */
export function CompactVariantExample() {
  const [refocusCount, setRefocusCount] = useState(0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Compact Variant (Default)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Lightweight version for modal footers, error cards, sidebars (~100px tall)
        </p>
      </div>

      <div className="max-w-md bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 mb-4">
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-4">
            API Error
          </p>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-900 dark:text-red-100 font-medium">
              Failed to save your changes
            </p>
            <p className="text-xs text-red-800 dark:text-red-200 mt-1">
              The server encountered an error. Please try again.
            </p>
          </div>

          {/* Compact variant here */}
          <WhyAndCreedErrorDisplay
            data={EXAMPLE_DATA}
            variant="compact"
            onRefocus={() => setRefocusCount(c => c + 1)}
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Refocus clicks: {refocusCount}
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Use in:</strong> Modal footers, error card sidebars, embedded error displays,
          form submission errors
        </p>
      </div>
    </div>
  );
}

/**
 * StandardVariantExample
 *
 * Shows standard variant for dedicated error modals/pages
 */
export function StandardVariantExample() {
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Standard Variant
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Full-featured version for dedicated error modals (~200px tall)
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md space-y-4 shadow-2xl">
            {/* Error header */}
            <div className="space-y-2 p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Something Went Wrong
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We couldn't process your request. Don't worry—let's refocus on what matters.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 px-6">
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                Retry
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
              >
                Dismiss
              </button>
            </div>

            {/* Why & Creed reminder (standard variant) */}
            <div className="px-6 pb-6">
              <WhyAndCreedErrorDisplay
                data={EXAMPLE_DATA}
                variant="standard"
                onRefocus={() => console.log("Refocusing...")}
                onClose={() => setShowModal(false)}
                showClose={true}
              />
            </div>
          </div>
        </div>
      )}

      {!showModal && (
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Show Modal
        </button>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Use in:</strong> Dedicated error modals, full error pages, error boundaries,
          critical failure states
        </p>
      </div>
    </div>
  );
}

/**
 * MinimalVariantExample
 *
 * Shows minimal variant for toasts/notifications
 */
export function MinimalVariantExample() {
  const [showToast, setShowToast] = useState(true);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Minimal Variant
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Inline version for toasts and notifications (~40px tall)
        </p>
      </div>

      <div className="relative min-h-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-6">
        <div className="space-y-3">
          {/* Error message */}
          <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Upload failed
              </p>
              <p className="text-xs text-red-800 dark:text-red-200">
                File size exceeds limit (max 10MB)
              </p>
            </div>
          </div>

          {/* Why & Creed reminder (minimal variant) */}
          {showToast && (
            <WhyAndCreedErrorDisplay
              data={EXAMPLE_DATA}
              variant="minimal"
              onClose={() => setShowToast(false)}
            />
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Use in:</strong> Toast notifications, error banners, inline error messages,
          quick feedback during operations
        </p>
      </div>
    </div>
  );
}

/**
 * LoadingStateExample
 *
 * Shows loading state when why/creed is being fetched
 */
export function LoadingStateExample() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Loading State
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Component fetching why/creed data (when workspaceId provided without data prop)
        </p>
      </div>

      <div className="space-y-3">
        {/* Compact loading */}
        <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Compact Variant Loading
          </p>
          <WhyAndCreedErrorDisplay
            workspaceId="nonexistent-ws"
            variant="compact"
          />
        </div>

        {/* Standard loading */}
        <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Standard Variant Loading
          </p>
          <WhyAndCreedErrorDisplay
            workspaceId="nonexistent-ws"
            variant="standard"
          />
        </div>

        {/* Minimal loading */}
        <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Minimal Variant Loading
          </p>
          <WhyAndCreedErrorDisplay
            workspaceId="nonexistent-ws"
            variant="minimal"
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          All variants show subtle pulse animation while loading. Note: These examples won't
          actually fetch (invalid workspace ID), so you'll see the loading state indefinitely.
        </p>
      </div>
    </div>
  );
}

/**
 * EmptyStateExample
 *
 * Shows behavior when user hasn't set why/creed yet
 */
export function EmptyStateExample() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Empty State
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Component when user hasn't set their why/creed yet (graceful degradation)
        </p>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            All variants return null (no render)
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded text-center text-sm text-slate-600 dark:text-slate-400">
            <code>&lt;WhyAndCreedErrorDisplay data={"{empty}"} /&gt;</code>
            <p className="mt-2 text-xs">Renders: nothing (no visual output)</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-900 dark:text-amber-100">
          <strong>Design decision:</strong> Component gracefully hides when no why/creed is set,
          rather than showing an empty state. This prevents adding extra UI to error pages. If you
          want to prompt users to set their why/creed, add that CTA in the error message itself.
        </p>
      </div>
    </div>
  );
}

/**
 * DarkModeExample
 *
 * Shows component in both light and dark modes side-by-side
 */
export function DarkModeExample() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Dark Mode Support
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Component automatically adapts to light/dark mode via CSS
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Light mode */}
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-900">Light Mode</p>
          </div>
          <div className="p-4">
            <WhyAndCreedErrorDisplay
              data={EXAMPLE_DATA}
              variant="compact"
            />
          </div>
        </div>

        {/* Dark mode */}
        <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-sm">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
            <p className="text-xs font-semibold text-white">Dark Mode</p>
          </div>
          <div className="p-4 dark:block hidden">
            <WhyAndCreedErrorDisplay
              data={EXAMPLE_DATA}
              variant="compact"
            />
          </div>
          <div className="p-4 bg-slate-800 text-slate-300 text-xs">
            (Dark mode preview — would render correctly with dark: class enabled)
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * WhyAndCreedErrorDisplayShowcase
 *
 * Master component showing all variants and examples together
 */
export function WhyAndCreedErrorDisplayShowcase() {
  const [activeTab, setActiveTab] = useState<
    "compact" | "standard" | "minimal" | "loading" | "empty" | "dark"
  >("compact");

  const tabs = [
    { id: "compact", label: "Compact" },
    { id: "standard", label: "Standard" },
    { id: "minimal", label: "Minimal" },
    { id: "loading", label: "Loading State" },
    { id: "empty", label: "Empty State" },
    { id: "dark", label: "Dark Mode" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          WhyAndCreedErrorDisplay Examples
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Visual reference for all component variants and states
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "compact" && <CompactVariantExample />}
        {activeTab === "standard" && <StandardVariantExample />}
        {activeTab === "minimal" && <MinimalVariantExample />}
        {activeTab === "loading" && <LoadingStateExample />}
        {activeTab === "empty" && <EmptyStateExample />}
        {activeTab === "dark" && <DarkModeExample />}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong>Documentation:</strong> See{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            docs/WHY_CREED_ERROR_INTEGRATION.md
          </code>{" "}
          for detailed integration guide and usage patterns.
        </p>
      </div>
    </div>
  );
}
