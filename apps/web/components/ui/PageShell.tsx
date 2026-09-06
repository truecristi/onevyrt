/**
 * ONEVYRT Design System v1 — PageShell.
 * The standard page frame: full-height tokened background + a centered content
 * column + an optional header row (eyebrow / title / subtitle on the left,
 * actions on the right). Feature pages currently hand-roll this with an
 * inline-styled `<div style={{ minHeight, background, maxWidth, margin, padding }}>`
 * wrapper that drifts page to page; use this instead so the frame is one thing.
 *
 * Token-driven (see app/design-system.css .ds-page*). Width defaults to the
 * design-system page width; override per-page with `maxWidth` when a screen
 * genuinely needs to be wider or narrower.
 */
import type { HTMLAttributes, ReactNode, CSSProperties } from "react";

export interface PageShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Small uppercase kicker above the title. */
  eyebrow?: ReactNode;
  /** Page title (rendered as an h1). Omit for a bare frame. */
  title?: ReactNode;
  /** One-line description under the title. */
  subtitle?: ReactNode;
  /** Right-aligned header controls (buttons, toggles). */
  actions?: ReactNode;
  /** Content column width; number → px. Defaults to the DS page width. */
  maxWidth?: number | string;
  children?: ReactNode;
}

export function PageShell({ eyebrow, title, subtitle, actions, maxWidth, className = "", children, ...rest }: PageShellProps) {
  const innerStyle = maxWidth != null
    ? ({ "--ds-page-w": typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth } as CSSProperties)
    : undefined;
  const hasHead = eyebrow != null || title != null || subtitle != null || actions != null;
  return (
    <div className={["ds-page", className].filter(Boolean).join(" ")} {...rest}>
      <div className="ds-page__inner" style={innerStyle}>
        {hasHead && (
          <header className="ds-page__head">
            <div className="ds-page__heading">
              {eyebrow != null && <span className="ds-eyebrow">{eyebrow}</span>}
              {title != null && <h1 className="ds-title">{title}</h1>}
              {subtitle != null && <p className="ds-page__sub">{subtitle}</p>}
            </div>
            {actions != null && <div className="ds-page__actions">{actions}</div>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
