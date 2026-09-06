"use client";
/**
 * BrandLogo — the ONE ONEVYRT app logo, used everywhere (app header, top nav,
 * landing, login) so the brand reads the same on every surface. It's the
 * original arrow-in-circle mark (an upward "growth" arrow), rebuilt as a crisp
 * SVG in the app's green so it scales cleanly and matches the theme.
 *
 * Pass `interactive` to make it clearly clickable — a pointer cursor, a gentle
 * hover lift, and a soft idle float so it reads as a button (usually a link
 * home). Pass `wordmark={false}` for an icon-only badge.
 */
import { useState, type CSSProperties } from "react";

const GREEN = "#0a9e6e";

export function BrandMark({
  size = 28, color = GREEN, interactive = false, title = "ONEVYRT",
}: { size?: number; color?: string; interactive?: boolean; title?: string }) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = { flexShrink: 0, display: "block" };
  if (interactive) {
    style.cursor = "pointer";
    style.transition = "transform .18s cubic-bezier(.2,.7,.3,1), filter .18s";
    style.transform = hover ? "translateY(-2px) scale(1.07)" : "none";
    style.filter = hover ? "brightness(1.1) drop-shadow(0 3px 8px rgba(10,158,110,.45))" : "none";
    style.animation = hover ? "none" : "ovyrtFloat 2.6s ease-in-out infinite";
  }
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label={title}
      style={style}
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
    >
      {interactive && <style>{"@keyframes ovyrtFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}"}</style>}
      <circle cx="32" cy="32" r="31" fill={color} />
      {/* Upward "growth" arrow — asymmetric legs, matching the original mark. */}
      <path d="M17 42 L29 23 Q30.6 20.5 32.2 23 L48 48" stroke="#ffffff" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function BrandLogo({
  size = 28, wordmark = true, text = "ONEVYRT", color = GREEN, wordmarkColor, gap = 9, interactive = false, style,
}: {
  size?: number; wordmark?: boolean; text?: string; color?: string;
  wordmarkColor?: string; gap?: number; interactive?: boolean; style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, ...(interactive ? { cursor: "pointer" } : {}), ...style }}>
      <BrandMark size={size} color={color} interactive={interactive} />
      {wordmark && (
        <span style={{ fontWeight: 700, letterSpacing: 0.5, fontSize: Math.round(size * 0.58), color: wordmarkColor ?? "inherit", whiteSpace: "nowrap", lineHeight: 1 }}>
          {text}
        </span>
      )}
    </span>
  );
}
