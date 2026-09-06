/**
 * ONEVYRT Design System v1 — EmptyState.
 * One shared "nothing here yet" block so every list/section reads the same:
 * an optional line-icon in a soft disc, a short title, one explaining line, and
 * an optional primary action. Replaces the many hand-rolled empty states that
 * drifted page to page (audit Phase 3: shared EmptyState across migrated routes).
 *
 * Token-driven with safe fallbacks — works whether or not the newer --ds-* text
 * tokens are defined, so it can be dropped onto any page without CSS changes.
 */
import type { ReactNode } from "react";
import { MarketingIcon, type MarketingIconName } from "../MarketingIcons";

export interface EmptyStateProps {
  /** Optional line-icon shown in a soft disc above the title. */
  icon?: MarketingIconName;
  title: ReactNode;
  /** One explaining line under the title. */
  description?: ReactNode;
  /** Optional primary action (a button or link). */
  action?: ReactNode;
  /** Tighter padding for use inside a small card. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact = false, className = "" }: EmptyStateProps) {
  return (
    <div className={["ds-empty", className].filter(Boolean).join(" ")} role="note"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: compact ? "24px 18px" : "44px 24px", color: "var(--ds-text-secondary, var(--muted))" }}>
      {icon && (
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 999, background: "var(--ds-surface-subtle, var(--surface2))", color: "var(--ds-text-secondary, var(--muted))" }}>
          <MarketingIcon name={icon} size={22} />
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ds-text-primary, var(--text))" }}>{title}</div>
      {description && <div style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 420 }}>{description}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
