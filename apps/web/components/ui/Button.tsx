/**
 * ONEVYRT Design System v1 — Button.
 * Token-driven (see app/design-system.css). Feature code should use this
 * instead of ad-hoc `<button style={{...}}>`. One primary action per section;
 * secondary/ghost for the rest; danger only for destructive.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", iconOnly = false, className = "", children, ...rest }: ButtonProps) {
  const cls = [
    "ds-btn",
    `ds-btn--${variant}`,
    size !== "md" ? `ds-btn--${size}` : "",
    iconOnly ? "ds-btn--icon" : "",
    className,
  ].filter(Boolean).join(" ");
  return <button className={cls} {...rest}>{children}</button>;
}
