/**
 * StatusIcon — semantic visual indicators for learner progress and states.
 *
 * Renders an icon for lesson/chapter/submission status:
 * - locked: prerequisites not yet met
 * - available: ready to start
 * - inProgress: currently being worked on
 * - completed: finished successfully
 * - awaitingReview: submitted, awaiting coach approval
 * - approved: coach approved, can proceed
 * - rejected: coach sent back for revision
 *
 * Each status has a semantic color defined in the design system.
 *
 * Usage:
 *   <StatusIcon status="completed" />
 *   <StatusIcon status="awaitingReview" size="lg" />
 */
import {
  LockClosedIcon,
  LockOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  CheckBadgeIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { STATUS_ICONS } from "../../lib/icons/icon-registry";
import { IconSizer } from "./IconSizer";
import type { SVGProps } from "react";

type StatusType = keyof typeof STATUS_ICONS;
type IconSize = "xs" | "sm" | "md" | "lg";
type ColorVariant = "inherit" | "primary" | "success" | "warning" | "error" | "muted";

const STATUS_ICON_MAP: Record<StatusType, React.ComponentType<SVGProps<SVGSVGElement>>> = {
  locked: LockClosedIcon,
  available: LockOpenIcon,
  inProgress: ClockIcon,
  completed: CheckCircleIcon,
  awaitingReview: DocumentCheckIcon,
  approved: CheckBadgeIcon,
  rejected: XCircleIcon,
  skipped: LockClosedIcon, // fallback
};

const STATUS_COLOR_MAP: Record<StatusType, ColorVariant> = {
  locked: "muted",
  available: "primary",
  inProgress: "warning",
  completed: "success",
  awaitingReview: "warning",
  approved: "success",
  rejected: "error",
  skipped: "muted",
};

const STATUS_LABELS: Record<StatusType, string> = {
  locked: "Locked — complete prerequisites",
  available: "Available — ready to start",
  inProgress: "In Progress — currently working",
  completed: "Completed",
  awaitingReview: "Awaiting Review — submitted, waiting for coach",
  approved: "Approved",
  rejected: "Rejected — revision needed",
  skipped: "Skipped",
};

interface StatusIconProps extends SVGProps<SVGSVGElement> {
  status: StatusType;
  size?: IconSize;
  className?: string;
}

export function StatusIcon({
  status,
  size = "sm",
  className = "",
  ...rest
}: StatusIconProps) {
  const IconComponent = STATUS_ICON_MAP[status];
  const colorVariant = STATUS_COLOR_MAP[status];
  const label = STATUS_LABELS[status];

  if (!IconComponent) {
    console.warn(`StatusIcon: unknown status "${status}"`);
    return null;
  }

  return (
    <IconSizer
      size={size}
      color={colorVariant}
      label={label}
      className={["status-icon", `status-icon--${status}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <IconComponent width="1em" height="1em" {...rest} />
    </IconSizer>
  );
}

/**
 * StatusBadge — icon + text status indicator.
 * Displays status with label, useful in lists and dashboards.
 */
export function StatusBadge({
  status,
  size = "sm",
  inline = false,
}: {
  status: StatusType;
  size?: IconSize;
  inline?: boolean;
}) {
  const label = STATUS_LABELS[status];

  return (
    <span
      className={`status-badge status-badge--${status}${inline ? " inline" : ""}`}
      style={{
        display: inline ? "inline-flex" : "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: size === "xs" ? "11px" : size === "sm" ? "12px" : "13px",
      }}
    >
      <StatusIcon status={status} size={size} />
      <span>{label}</span>
    </span>
  );
}
