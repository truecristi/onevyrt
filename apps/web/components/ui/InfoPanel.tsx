/**
 * ONEVYRT Info Panel — Hover-activated information panels with smooth animations.
 *
 * Features:
 * - Information reveal on hover (smooth fade/slide)
 * - Contextual tips and explanations
 * - Clickable to keep visible on mobile
 * - Close button with smooth exit animation
 * - Positioned intelligently (doesn't overflow viewport)
 * - Dark mode aware backgrounds
 * - Accessibility: keyboard accessible, ARIA labels
 *
 * Usage:
 *   <InfoPanel
 *     trigger={<button>Help</button>}
 *     content="This is helpful information"
 *     position="right"
 *   />
 */

import { useState, useRef, useEffect } from "react";
import { getChapterColor } from "@/lib/colors/chapter-tokens";

export type PanelPosition = "top" | "bottom" | "left" | "right" | "auto";
export type PanelSize = "sm" | "md" | "lg";

export interface InfoPanelProps {
  /** Trigger element (button, icon, etc.) */
  trigger: React.ReactNode;

  /** Content to display (text or ReactNode) */
  content: React.ReactNode;

  /** Position relative to trigger */
  position?: PanelPosition;

  /** Panel size */
  size?: PanelSize;

  /** Background color (chapter-based) */
  chapter?: string;

  /** Custom color */
  color?: string;

  /** Show close button */
  showClose?: boolean;

  /** Panel stays open after blur (mobile) */
  persistent?: boolean;

  /** Icon for the info panel */
  icon?: string;

  /** Title text */
  title?: string;

  /** CSS className for trigger */
  triggerClassName?: string;

  /** CSS className for panel */
  panelClassName?: string;
}

export function InfoPanel({
  trigger,
  content,
  position = "auto",
  size = "md",
  chapter,
  color,
  showClose = true,
  persistent = false,
  icon = "ℹ",
  title,
  triggerClassName = "",
  panelClassName = "",
}: InfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const panelColor = color || (chapter ? getChapterColor(chapter) : "#2563eb");

  // Calculate position to avoid overflow
  useEffect(() => {
    if (!isOpen || position !== "auto" || !triggerRef.current || !panelRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();

    // Simple positioning logic (can be enhanced)
    if (triggerRect.top > panelRect.height + 20) {
      setActualPosition("top");
    } else if (window.innerHeight - triggerRect.bottom > panelRect.height + 20) {
      setActualPosition("bottom");
    } else if (triggerRect.left > panelRect.width + 20) {
      setActualPosition("left");
    } else {
      setActualPosition("right");
    }
  }, [isOpen, position]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const sizeClasses = {
    sm: "max-w-xs text-sm",
    md: "max-w-sm text-base",
    lg: "max-w-md text-lg",
  };

  const positionClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
    auto: actualPosition === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : actualPosition === "bottom"
        ? "top-full mt-2 left-1/2 -translate-x-1/2"
        : actualPosition === "left"
          ? "right-full mr-2 top-1/2 -translate-y-1/2"
          : "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const getArrowPosition = () => {
    const base = "absolute w-2 h-2 transform rotate-45 bg-ds-surface border-ds-border-default";
    const arrowPositions = {
      top: `${base} bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b`,
      bottom: `${base} top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t`,
      left: `${base} right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-b border-r`,
      right: `${base} left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-t border-l`,
    };
    const resolvedPosition = actualPosition === "auto" ? "right" : actualPosition;
    return arrowPositions[resolvedPosition] || arrowPositions.right;
  };

  return (
    <div className="relative inline-block">
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => !persistent && setIsOpen(true)}
        onMouseLeave={() => !persistent && isOpen && setIsOpen(false)}
        className={[
          "cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 rounded",
          triggerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        role="button"
        tabIndex={0}
        aria-label="Toggle info panel"
        aria-pressed={isOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsOpen(!isOpen);
          }
        }}
      >
        {trigger}
      </div>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={[
            "absolute z-50 p-4 rounded-lg border border-ds-border-subtle bg-ds-surface shadow-lg",
            sizeClasses[size],
            positionClasses[position],
            "animate-slideUp",
            panelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            backgroundColor: "var(--ds-surface)",
            borderColor: "var(--ds-border-subtle)",
          }}
          role="tooltip"
          aria-hidden={!isOpen}
        >
          {/* Arrow/pointer */}
          <div className={getArrowPosition()} />

          {/* Close button */}
          {showClose && (
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 text-ds-text-tertiary hover:text-ds-text-primary transition-colors"
              aria-label="Close info panel"
            >
              ✕
            </button>
          )}

          {/* Content */}
          <div className={showClose ? "pr-6" : ""}>
            {title && (
              <h3
                className="font-semibold mb-2"
                style={{ color: panelColor }}
              >
                {icon && <span className="mr-2">{icon}</span>}
                {title}
              </h3>
            )}
            <div className="text-ds-text-secondary">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Info Icon — Small info icon that triggers a panel on click/hover.
 */
export function InfoIcon({
  content,
  title,
  position = "right",
  chapter = "define",
}: {
  content: React.ReactNode;
  title?: string;
  position?: PanelPosition;
  chapter?: string;
}) {
  return (
    <InfoPanel
      trigger={
        <div
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold transition-all hover:shadow-md cursor-help"
          style={{
            backgroundColor: getChapterColor(chapter),
          }}
        >
          ?
        </div>
      }
      content={content}
      position={position}
      title={title}
      size="sm"
      chapter={chapter}
      showClose={false}
    />
  );
}

/**
 * Tip Box — Info panel styled as a tip/hint box.
 */
export interface TipBoxProps {
  title?: string;
  content: React.ReactNode;
  type?: "info" | "success" | "warning" | "error";
  icon?: string;
  closeable?: boolean;
  onClose?: () => void;
}

export function TipBox({
  title,
  content,
  type = "info",
  icon,
  closeable = false,
  onClose,
}: TipBoxProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const typeStyles = {
    info: { bg: "#eff6ff", border: "#2563eb", text: "#1e40af", icon: "ℹ" },
    success: { bg: "#dcfce7", border: "#16a34a", text: "#15803d", icon: "✓" },
    warning: { bg: "#fef3c7", border: "#d97706", text: "#b45309", icon: "!" },
    error: { bg: "#fee2e2", border: "#dc2626", text: "#b91c1c", icon: "✕" },
  };

  const style = typeStyles[type];

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  return (
    <div
      className="p-4 rounded-lg border-l-4 animate-slideUp"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div
          className="text-lg mt-0.5"
          style={{ color: style.text }}
        >
          {icon || style.icon}
        </div>
        <div className="flex-1">
          {title && (
            <h3
              className="font-semibold mb-1"
              style={{ color: style.text }}
            >
              {title}
            </h3>
          )}
          <div style={{ color: style.text }}>
            {content}
          </div>
        </div>
        {closeable && (
          <button
            onClick={handleClose}
            className="text-lg transition-colors hover:opacity-70"
            style={{ color: style.text }}
            aria-label="Close tip"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
