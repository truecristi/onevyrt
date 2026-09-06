/**
 * ActionIcon — UI control icons for common operations.
 *
 * Renders an icon for user actions:
 * - add: create new item
 * - edit: modify existing item
 * - delete: remove item
 * - download: export/save file
 * - share: distribute/share
 * - print: print to paper
 * - save: persist to storage
 * - close: dismiss/cancel
 * - back: navigate backward
 * - forward: navigate forward
 * - search: find/filter
 * - filter: configure view
 * - more: see additional options
 *
 * Usage:
 *   <ActionIcon action="edit" size="md" />
 *   <ActionIcon action="delete" size="sm" color="error" />
 */
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  PrinterIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/solid";
import { ACTION_ICONS } from "../../lib/icons/icon-registry";
import { IconSizer } from "./IconSizer";
import type { SVGProps } from "react";

type ActionType = keyof typeof ACTION_ICONS;
type IconSize = "xs" | "sm" | "md" | "lg";
type ColorVariant = "inherit" | "primary" | "success" | "warning" | "error" | "muted";

const ACTION_ICON_MAP: Record<ActionType, React.ComponentType<SVGProps<SVGSVGElement>>> = {
  add: PlusIcon,
  edit: PencilIcon,
  delete: TrashIcon,
  download: ArrowDownTrayIcon,
  share: ShareIcon,
  print: PrinterIcon,
  save: CheckIcon,
  close: XMarkIcon,
  back: ArrowLeftIcon,
  forward: ArrowRightIcon,
  search: MagnifyingGlassIcon,
  filter: FunnelIcon,
  more: EllipsisHorizontalIcon,
};

const ACTION_COLOR_MAP: Record<ActionType, ColorVariant> = {
  add: "primary",
  edit: "primary",
  delete: "error",
  download: "primary",
  share: "primary",
  print: "primary",
  save: "success",
  close: "muted",
  back: "inherit",
  forward: "inherit",
  search: "muted",
  filter: "muted",
  more: "muted",
};

const ACTION_LABELS: Record<ActionType, string> = {
  add: "Add new",
  edit: "Edit",
  delete: "Delete",
  download: "Download",
  share: "Share",
  print: "Print",
  save: "Save",
  close: "Close",
  back: "Go back",
  forward: "Go forward",
  search: "Search",
  filter: "Filter",
  more: "More options",
};

interface ActionIconProps extends SVGProps<SVGSVGElement> {
  action: ActionType;
  size?: IconSize;
  color?: ColorVariant;
  className?: string;
}

export function ActionIcon({
  action,
  size = "sm",
  color,
  className = "",
  ...rest
}: ActionIconProps) {
  const IconComponent = ACTION_ICON_MAP[action];
  const defaultColor = ACTION_COLOR_MAP[action];
  const label = ACTION_LABELS[action];

  if (!IconComponent) {
    console.warn(`ActionIcon: unknown action "${action}"`);
    return null;
  }

  return (
    <IconSizer
      size={size}
      color={color || defaultColor}
      label={label}
      className={["action-icon", `action-icon--${action}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <IconComponent width="1em" height="1em" {...rest} />
    </IconSizer>
  );
}

/**
 * ActionButton — standalone icon button with hover/active states.
 * Wraps ActionIcon in a button with design-system styling.
 * Use the Button component for full control, or this for icon-only actions.
 */
export function ActionButton({
  action,
  size = "sm",
  onClick,
  disabled = false,
  className = "",
  ...rest
}: {
  action: ActionType;
  size?: IconSize;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const label = ACTION_LABELS[action];

  return (
    <button
      className={[
        "ds-btn",
        "ds-btn--ghost",
        "action-button",
        `action-button--${action}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      {...rest}
    >
      <ActionIcon action={action} size={size} />
    </button>
  );
}
