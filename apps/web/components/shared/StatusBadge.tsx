"use client";

import React, { CSSProperties } from "react";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: "small" | "medium";
}

/**
 * Reusable status badge component.
 */
export const StatusBadge = React.forwardRef<
  HTMLDivElement,
  StatusBadgeProps
>(({ status, label, size = "medium" }, ref) => {
  const getStatusColor = (s: StatusType) => {
    switch (s) {
      case "success":
        return { bg: "#dcfce7", color: "#166534", text: "#16a34a" };
      case "warning":
        return { bg: "#fef3c7", color: "#92400e", text: "#d97706" };
      case "error":
        return { bg: "#fee2e2", color: "#991b1b", text: "#dc2626" };
      case "info":
        return { bg: "#dbeafe", color: "#082f49", text: "#0284c7" };
      case "neutral":
      default:
        return { bg: "#f1f5f9", color: "#334155", text: "#64748b" };
    }
  };

  const colors = getStatusColor(status);
  const isSmall = size === "small";

  return (
    <div
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: isSmall ? "4px 10px" : "6px 12px",
        borderRadius: isSmall ? 4 : 6,
        background: colors.bg,
        color: colors.color,
        fontSize: isSmall ? 11 : 12,
        fontWeight: 600,
        letterSpacing: 0.3,
      } as CSSProperties}
    >
      <span
        style={{
          width: isSmall ? 6 : 8,
          height: isSmall ? 6 : 8,
          borderRadius: "50%",
          background: colors.text,
        }}
      />
      {label}
    </div>
  );
});

StatusBadge.displayName = "StatusBadge";
