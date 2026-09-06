/**
 * ONEVYRT Design System v1 — Notice.
 * The shared full-area gate/error panel (sign-in required, no access, not
 * enabled, couldn't load). Every Business OS and Campaign Studio page had its
 * own near-identical local `Notice` with an emoji icon; this replaces all of
 * them with one component built on EmptyState (audit Phase 3: shared components;
 * §21: no UI emoji).
 *
 * Back-compatible with the old call sites: `icon` still accepts the emoji they
 * pass (🔑/🔒/⚠️/🚀/✨…), mapped to the line-icon set; an explicit MarketingIcon
 * name works too.
 */
import { EmptyState } from "./EmptyState";
import type { MarketingIconName } from "../MarketingIcons";

const EMOJI_TO_ICON: Record<string, MarketingIconName> = {
  "🔑": "lock", "🔒": "lock", "🔓": "lock", "⚠️": "warning", "⚠": "warning",
  "🚀": "rocket", "✨": "card", "📡": "signal", "💬": "message",
};

const ICON_NAMES = new Set<MarketingIconName>([
  "home", "plan", "studio", "funnels", "campaigns", "leads", "audiences", "insights",
  "community", "rocket", "sun", "moon", "check", "spark", "compass", "tree", "bolt",
  "refresh", "book", "message", "calendar", "trophy", "search", "gear", "card", "link",
  "pen", "save", "cloud", "trash", "signal", "hash", "wave", "warning", "lock",
]);

export function Notice({ icon, title, body, href, cta, onRetry }: {
  icon?: string;
  title: string;
  body?: string;
  href?: string;
  cta?: string;
  onRetry?: () => void;
}) {
  const name: MarketingIconName = icon
    ? (EMOJI_TO_ICON[icon] ?? (ICON_NAMES.has(icon as MarketingIconName) ? (icon as MarketingIconName) : "warning"))
    : "warning";
  const action = href && cta
    ? <a className="btn primary" href={href}>{cta}</a>
    : onRetry
      ? <button className="btn" onClick={onRetry}>Try again</button>
      : undefined;
  return <EmptyState icon={name} title={title} description={body} action={action} />;
}
