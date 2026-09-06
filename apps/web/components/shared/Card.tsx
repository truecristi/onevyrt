"use client";

import React, { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  title?: string;
  footer?: ReactNode;
  variant?: "default" | "glass" | "surface";
}

/**
 * Reusable card component with consistent layout.
 * Supports multiple visual variants for different contexts.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className,
      style,
      onClick,
      title,
      footer,
      variant = "default",
    },
    ref
  ) => {
    const getVariantStyle = (): CSSProperties => {
      switch (variant) {
        case "glass":
          return {
            background: "var(--glass-bg)",
            backdropFilter: "blur(26px) saturate(1.7)",
            border: "1px solid var(--glass-border)",
          };
        case "surface":
          return {
            background: "var(--surface2)",
            border: "1px solid var(--border)",
          };
        default:
          return {
            background: "var(--surface)",
            border: "1px solid var(--border)",
          };
      }
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={className}
        style={{
          borderRadius: 8,
          padding: 16,
          ...getVariantStyle(),
          cursor: onClick ? "pointer" : "default",
          ...style,
        }}
      >
        {title && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 12,
              letterSpacing: 0.6,
              color: "var(--muted)",
            }}
          >
            {title}
          </div>
        )}
        <div>{children}</div>
        {footer && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border3)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";
