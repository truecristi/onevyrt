/**
 * ONEVYRT Design System v2 — Label & Field Components
 * CSS Patch 5: Enhanced label styling with required/optional indicators,
 * inline hints, and semantic help text variants
 *
 * Features:
 * - Form labels with required/optional indicators
 * - Contextual help text (info, success, warning, error)
 * - Label + input wrapper field component
 * - Accessibility built-in (htmlFor, aria-describedby)
 * - Theme-aware and consistent with design tokens
 */

import type { ReactNode, HTMLAttributes, LabelHTMLAttributes } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Show required indicator (*) */
  required?: boolean;
  /** Show optional indicator */
  optional?: boolean;
  /** Hint/tooltip text beside the label */
  hint?: ReactNode;
  /** CSS classes */
  className?: string;
  /** Label content */
  children: ReactNode;
}

/**
 * Label component — enhanced form label with optional required/optional indicator
 *
 * @example
 * <Label htmlFor="email" required>Email Address</Label>
 * <Label htmlFor="website" optional>Website</Label>
 * <Label htmlFor="role" hint="Who will use this workspace?">Role</Label>
 */
export function Label({
  required = false,
  optional = false,
  hint,
  className = "",
  children,
  ...rest
}: LabelProps) {
  const classes = [
    "ds-label",
    required ? "ds-label--required" : "",
    optional ? "ds-label--optional" : "",
    hint ? "ds-label--with-hint" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} {...rest}>
      {children}
      {hint && (
        <span
          className="ds-label-hint"
          title={typeof hint === "string" ? hint : undefined}
          aria-label={typeof hint === "string" ? hint : undefined}
        >
          {/* Icon or indicator could go here */}
          {hint}
        </span>
      )}
    </label>
  );
}

export interface HelpTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic variant for colour coding */
  variant?: "default" | "error" | "success" | "warning" | "info";
  /** Accessible error message ID linking */
  id?: string;
  /** Help text content */
  children: ReactNode;
}

/**
 * HelpText component — semantic help/error/success messages below inputs
 *
 * @example
 * <HelpText variant="error">Email is required</HelpText>
 * <HelpText variant="success">Email verified!</HelpText>
 * <HelpText variant="info">We'll never share your email</HelpText>
 */
export function HelpText({
  variant = "default",
  id,
  className = "",
  children,
  ...rest
}: HelpTextProps) {
  const classes = [
    "ds-help",
    variant !== "default" ? `ds-help--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} id={id} {...rest}>
      {children}
    </span>
  );
}

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Label text */
  label?: string;
  /** Help/description text below input */
  help?: ReactNode;
  /** Help text semantic variant */
  helpVariant?: "default" | "error" | "success" | "warning" | "info";
  /** Is field required */
  required?: boolean;
  /** Is field optional */
  optional?: boolean;
  /** Label hint/tooltip */
  labelHint?: ReactNode;
  /** htmlFor attribute for label linking */
  htmlFor?: string;
  /** Aria description for accessibility */
  "aria-describedby"?: string;
  /** Field content (typically an input) */
  children: ReactNode;
}

/**
 * Field component — wrapped label + input + help text with proper spacing
 *
 * @example
 * <Field label="Email" htmlFor="email" required>
 *   <input id="email" type="email" />
 * </Field>
 *
 * <Field
 *   label="Password"
 *   htmlFor="password"
 *   help="At least 12 characters"
 *   required
 * >
 *   <input id="password" type="password" />
 * </Field>
 *
 * <Field
 *   label="Confirm"
 *   htmlFor="confirm"
 *   help="Passwords don't match"
 *   helpVariant="error"
 * >
 *   <input id="confirm" type="password" aria-invalid="true" />
 * </Field>
 */
export function Field({
  label,
  help,
  helpVariant = "default",
  required = false,
  optional = false,
  labelHint,
  htmlFor,
  "aria-describedby": ariaDescribedBy,
  className = "",
  children,
  ...rest
}: FieldProps) {
  const helpId = htmlFor ? `${htmlFor}-help` : undefined;
  const finalAriaDescribedBy = help ? helpId : ariaDescribedBy;

  return (
    <div
      className={["ds-field", className].filter(Boolean).join(" ")}
      {...rest}
      aria-describedby={finalAriaDescribedBy}
    >
      {label && (
        <Label htmlFor={htmlFor} required={required} optional={optional} hint={labelHint}>
          {label}
        </Label>
      )}
      <div className="ds-field__input">{children}</div>
      {help && (
        <HelpText id={helpId} variant={helpVariant}>
          {help}
        </HelpText>
      )}
    </div>
  );
}

export interface LabelBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  /** Icon or dot before text */
  icon?: ReactNode;
  /** Badge content */
  children: ReactNode;
}

/**
 * LabelBadge component — inline badge for tags, statuses, or labels
 * Differs from Badge in that it's text-centric and inline with surrounding text
 *
 * @example
 * <LabelBadge variant="success">Verified</LabelBadge>
 * <LabelBadge variant="info" icon={<DotIcon />}>Active</LabelBadge>
 */
export function LabelBadge({
  variant = "default",
  icon,
  className = "",
  children,
  ...rest
}: LabelBadgeProps) {
  const classes = [
    "ds-label-badge",
    variant !== "default" ? `ds-label-badge--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {icon && <span className="ds-label-badge__icon">{icon}</span>}
      {children}
    </span>
  );
}

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  /** Eyebrow/overline content */
  children: ReactNode;
}

/**
 * Eyebrow component — small uppercase label, typically above headings
 *
 * @example
 * <Eyebrow>Chapter 1</Eyebrow>
 * <h1>Define Your Business</h1>
 */
export function Eyebrow({ className = "", children, ...rest }: EyebrowProps) {
  const classes = ["ds-eyebrow", className].filter(Boolean).join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
