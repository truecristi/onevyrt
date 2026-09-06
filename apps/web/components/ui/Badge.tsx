/**
 * ONEVYRT Design System v2 — Badge Component
 * CSS Patch 5: Enhanced badge styling with variants, sizes, and interactive states
 *
 * Features:
 * - Multiple size variants (sm, md/default, lg, compact)
 * - Status variants (success, warning, danger/error, info, brand)
 * - Chapter-specific badges (define, implement, control, improve, finish)
 * - Role badges (owner, manager, editor, viewer)
 * - Interactive mode with hover/click feedback
 * - Status dot indicator support
 * - Keyboard accessible and theme-aware
 */

import type { ReactNode } from "react";

type BadgeSize = "sm" | "md" | "lg" | "compact";
type BadgeStatus = "neutral" | "brand" | "success" | "warning" | "danger" | "error" | "info";
type BadgeChapter = "start" | "define" | "implement" | "control" | "improve" | "finish";
type BadgeRole = "owner" | "manager" | "editor" | "viewer";

export interface BadgeProps {
  /** Size variant */
  size?: BadgeSize;
  /** Status/semantic variant */
  status?: BadgeStatus;
  /** Chapter-specific variant */
  chapter?: BadgeChapter;
  /** Role-specific variant */
  role?: BadgeRole;
  /** Show status indicator dot */
  dot?: boolean;
  /** Position of dot (default: left) */
  dotPosition?: "left" | "right";
  /** Make badge interactive/clickable */
  interactive?: boolean;
  /** Click handler for interactive badge */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Badge content */
  children: ReactNode;
  /** Aria label for accessibility */
  "aria-label"?: string;
}

/**
 * Badge component — compact, color-coded label for status, roles, and milestones
 *
 * @example
 * // Status badge
 * <Badge status="success">Approved</Badge>
 *
 * // Chapter progress
 * <Badge chapter="define">DEFINE</Badge>
 *
 * // User role
 * <Badge role="manager">Manager</Badge>
 *
 * // Interactive
 * <Badge interactive onClick={() => alert('clicked')}>Click me</Badge>
 *
 * // With indicator
 * <Badge status="success" dot>Active</Badge>
 */
export function Badge({
  size = "md",
  status = "neutral",
  chapter,
  role,
  dot = false,
  dotPosition = "left",
  interactive = false,
  onClick,
  className = "",
  children,
  "aria-label": ariaLabel,
}: BadgeProps) {
  // Build class list
  const classes = [
    "ds-badge",
    size !== "md" ? `ds-badge--${size}` : "",
    chapter ? `ds-badge--chapter-${chapter}` : `ds-badge--${status}`,
    role ? `ds-badge--role-${role}` : "",
    interactive ? "ds-badge--interactive" : "",
    dot ? "ds-badge--with-dot" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {dot && dotPosition === "left" && <span className="ds-dot" aria-hidden />}
      {children}
      {dot && dotPosition === "right" && <span className="ds-dot" aria-hidden />}
    </>
  );

  if (interactive) {
    return (
      <button
        className={classes}
        onClick={onClick}
        type="button"
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} aria-label={ariaLabel}>
      {content}
    </span>
  );
}

/**
 * Status-only badge helper — returns appropriate Badge for a status state
 *
 * @example
 * <StatusBadge status="approved" />  // "Approved" with success styling
 * <StatusBadge status="rejected" />  // "Rejected" with danger styling
 */
export function StatusBadge({
  status,
  dot = true,
  className = "",
}: {
  status:
    | "awaiting"
    | "approved"
    | "changes-requested"
    | "rejected"
    | "in-progress"
    | "not-started"
    | "complete"
    | "submitted";
  dot?: boolean;
  className?: string;
}) {
  const statusMap: Record<
    typeof status,
    { label: string; badgeStatus: BadgeStatus }
  > = {
    awaiting: { label: "Awaiting Review", badgeStatus: "warning" },
    approved: { label: "Approved", badgeStatus: "success" },
    "changes-requested": { label: "Changes Requested", badgeStatus: "warning" },
    rejected: { label: "Rejected", badgeStatus: "danger" },
    "in-progress": { label: "In Progress", badgeStatus: "info" },
    "not-started": { label: "Not Started", badgeStatus: "neutral" },
    complete: { label: "Complete", badgeStatus: "success" },
    submitted: { label: "Submitted", badgeStatus: "info" },
  };

  const { label, badgeStatus } = statusMap[status];

  return (
    <Badge status={badgeStatus} dot={dot} className={className}>
      {label}
    </Badge>
  );
}

/**
 * Chapter badge — shows programme stage with distinctive colour
 *
 * @example
 * <ChapterBadge chapter="define" />  // "DEFINE" with blue styling
 * <ChapterBadge chapter="improve" /> // "IMPROVE" with red styling
 */
export function ChapterBadge({
  chapter,
  dot = false,
  className = "",
}: {
  chapter: BadgeChapter;
  dot?: boolean;
  className?: string;
}) {
  const chapterMap: Record<BadgeChapter, string> = {
    start: "START",
    define: "DEFINE",
    implement: "IMPLEMENT",
    control: "CONTROL",
    improve: "IMPROVE",
    finish: "FINISH",
  };

  return (
    <Badge
      chapter={chapter}
      size="sm"
      dot={dot}
      className={className}
    >
      {chapterMap[chapter]}
    </Badge>
  );
}

/**
 * Role badge — shows user's workspace permission level
 *
 * @example
 * <RoleBadge role="owner" />     // "Owner" with gold styling
 * <RoleBadge role="editor" />    // "Editor" with green styling
 * <RoleBadge role="viewer" />    // "Viewer" with grey styling
 */
export function RoleBadge({
  role,
  className = "",
}: {
  role: BadgeRole;
  className?: string;
}) {
  const roleMap: Record<BadgeRole, string> = {
    owner: "Owner",
    manager: "Manager",
    editor: "Editor",
    viewer: "Viewer",
  };

  return (
    <Badge role={role} size="sm" className={className}>
      {roleMap[role]}
    </Badge>
  );
}
