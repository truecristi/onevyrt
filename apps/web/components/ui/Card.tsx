/**
 * ONEVYRT Design System v1 — Card / Panel / Badge / Field primitives.
 * Token-driven (see app/design-system.css). Cards use a border by default;
 * elevation (`raised`) only where it means something. Reduce "card inside a
 * card" — a border that doesn't aid comprehension shouldn't exist.
 */
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ raised = false, className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return <div className={["ds-card", raised ? "ds-card--raised" : "", className].filter(Boolean).join(" ")} {...rest}>{children}</div>;
}

export function Panel({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["ds-panel", className].filter(Boolean).join(" ")} {...rest}>{children}</div>;
}

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
export function Badge({ tone = "neutral", dot = false, className = "", children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  const cls = ["ds-badge", tone !== "neutral" ? `ds-badge--${tone}` : "", className].filter(Boolean).join(" ");
  return <span className={cls}>{dot && <span className="ds-dot" />}{children}</span>;
}

export function Field({ label, help, htmlFor, children }: { label?: string; help?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="ds-field">
      {label && <label className="ds-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && <span className="ds-help">{help}</span>}
    </div>
  );
}
