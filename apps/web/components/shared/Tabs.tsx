"use client";

import React, { CSSProperties, ReactNode } from "react";

interface TabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: ReactNode;
    icon?: ReactNode;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: "default" | "compact";
}

/**
 * Accessible tabs component with ARIA roles, keyboard navigation (Arrow keys),
 * and consistent styling. Implements WAI-ARIA tablist pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, activeTab, onTabChange, variant = "default" }, ref) => {
    const isCompact = variant === "compact";

    const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex: number | null = null;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        e.preventDefault();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        e.preventDefault();
      } else if (e.key === "Home") {
        nextIndex = 0;
        e.preventDefault();
      } else if (e.key === "End") {
        nextIndex = tabs.length - 1;
        e.preventDefault();
      }

      if (nextIndex !== null) {
        onTabChange(tabs[nextIndex]!.id);
        // Focus the new tab (handled by DOM update)
        setTimeout(() => {
          const tabButton = document.querySelector<HTMLButtonElement>(
            `[role="tab"][data-tab-id="${tabs[nextIndex!]!.id}"]`
          );
          tabButton?.focus();
        }, 0);
      }
    };

    const tabButtonStyle: CSSProperties = {
      background: "transparent",
      border: "none",
      borderBottom: "2px solid transparent",
      padding: isCompact ? "6px 12px" : "12px 16px",
      fontSize: isCompact ? 12 : 13,
      fontWeight: 600,
      cursor: "pointer",
      color: "var(--muted)",
      transition: "all .12s",
      letterSpacing: 0.4,
      whiteSpace: "nowrap",
    };

    return (
      <div ref={ref}>
        <div
          role="tablist"
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border3)",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              data-tab-id={tab.id}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                ...tabButtonStyle,
                color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
                borderBottomColor:
                  activeTab === tab.id ? "var(--accent)" : "transparent",
              }}
            >
              {tab.icon && (
                <span
                  style={{ marginRight: 6, display: "inline-block" }}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          style={{ padding: isCompact ? 12 : 16 }}
        >
          {tabs.find((t) => t.id === activeTab)?.content}
        </div>
      </div>
    );
  }
);

Tabs.displayName = "Tabs";
