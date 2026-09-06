"use client";
/**
 * The Studio's slide-in glass panels (Risk, Comments, Checklist, Constraints,
 * Tools, Live tracking, Members…) share one shell. This wrapper gives every one
 * of them the accessibility a focused task surface needs: role="dialog" +
 * aria-modal so assistive tech announces it, a focus trap so Tab cycles inside
 * the panel instead of leaking to the canvas behind it, Escape-to-close, and
 * focus RETURN to whatever opened it when it closes. Previously these panels
 * were plain divs — keyboard and screen-reader users could tab straight out of
 * an "open" panel and lose their place.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { glassPanel, GLASS_PANEL_CLASS } from "../../lib/studio-ui";
import { useDialogA11y } from "../../lib/use-dialog-a11y";

export function GlassDrawer({
  width, label, onClose, children, style,
}: {
  width: number;
  label: string;
  onClose: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label}
      className={GLASS_PANEL_CLASS} style={{ ...glassPanel(width), ...style }}>
      {children}
    </div>
  );
}
