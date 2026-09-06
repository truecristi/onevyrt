"use client";

import React, { CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "btn" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/**
 * Reusable button component supporting studio UI variants.
 * Uses predefined styles from lib/studio-ui (barPrimary, barGhost, barBtn).
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", className, style, ...props }, ref) => {
    const getVariantStyle = (): CSSProperties => {
      // These match the studio-ui patterns
      switch (variant) {
        case "primary":
          return {
            background: "var(--accent)",
            color: "#fff",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all .12s",
          };
        case "danger":
          return {
            background: "var(--danger)",
            color: "#fff",
            border: "1px solid var(--danger)",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            borderColor: "var(--ds-danger-soft)",
          };
        case "ghost":
        default:
          return {
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border3)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all .12s",
          };
        case "btn":
          return {
            background: "var(--surface2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all .12s",
          };
      }
    };

    return (
      <button
        ref={ref}
        style={{
          ...getVariantStyle(),
          ...style,
        }}
        className={className}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
