/**
 * IconButton — reusable button component for icon-based actions.
 *
 * A thin wrapper around the design system's button that assumes icon-only
 * content. Provides semantic accessibility, hover/active states, and color
 * variants suited to icon operations.
 *
 * Use ActionButton for quick action icons, or IconButton for more control
 * over icon choice (e.g., Heroicons, MarketingIcon, custom SVG).
 *
 * Usage:
 *   <IconButton label="Close this panel" onClick={onClose}>
 *     <XMarkIcon width="20" height="20" />
 *   </IconButton>
 *
 *   <IconButton label="Edit item" variant="primary">
 *     <PencilIcon width="20" height="20" />
 *   </IconButton>
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label for the button — required unless title prop is used */
  label: string;
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Icon element (Heroicon, MarketingIcon, or custom SVG) */
  children: ReactNode;
  /** Show a subtle background on hover */
  withBackground?: boolean;
}

export function IconButton({
  label,
  variant = "secondary",
  size = "md",
  withBackground = true,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  const cls = [
    "ds-btn",
    `ds-btn--${variant}`,
    size !== "md" ? `ds-btn--${size}` : "",
    "ds-btn--icon",
    withBackground ? "icon-btn--bg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

/**
 * ContextIconButton — icon button for dropdown/context menus.
 * Typically the "more options" / "⋯" button.
 */
export function ContextIconButton({
  label = "More options",
  onClick,
  children,
  className = "",
}: {
  label?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={[
        "ds-btn",
        "ds-btn--ghost",
        "ds-btn--sm",
        "ds-btn--icon",
        "context-btn",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded="false"
      aria-haspopup="menu"
    >
      {children}
    </button>
  );
}
