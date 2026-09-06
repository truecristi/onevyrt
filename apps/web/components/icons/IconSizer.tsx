/**
 * IconSizer — utility component for consistent icon sizing across ONEVYRT.
 *
 * Icons scale through a standardized size scale:
 * - xs: 16px (tight UI, inline labels)
 * - sm: 20px (default, most UI elements)
 * - md: 24px (prominent, navigation icons)
 * - lg: 32px (large, hero/featured areas)
 *
 * Usage:
 *   <IconSizer size="md">
 *     <ChapterIcon chapter="define" />
 *   </IconSizer>
 *
 * Or for styled icon buttons with hover states, use IconButton instead.
 */
import type { ReactNode, HTMLAttributes } from "react";

type IconSize = "xs" | "sm" | "md" | "lg";
type ColorVariant = "inherit" | "primary" | "success" | "warning" | "error" | "muted";

const SIZE_PX: Record<IconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
};

const COLOR_MAP: Record<ColorVariant, string> = {
  inherit: "currentColor",
  primary: "var(--ds-brand-solid, #0891b2)",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  muted: "var(--ds-text-muted, #64748b)",
};

interface IconSizerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: IconSize;
  color?: ColorVariant;
  children: ReactNode;
  /** Optional accessible label/title for the icon */
  label?: string;
}

export function IconSizer({
  size = "sm",
  color = "inherit",
  label,
  className = "",
  children,
  ...rest
}: IconSizerProps) {
  const px = SIZE_PX[size];
  return (
    <span
      className={["icon-sizer", `icon-sizer--${size}`, className].filter(Boolean).join(" ")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${px}px`,
        height: `${px}px`,
        flexShrink: 0,
        color: COLOR_MAP[color],
        ...(rest.style || {}),
      }}
      title={label}
      {...rest}
    >
      {children}
    </span>
  );
}
