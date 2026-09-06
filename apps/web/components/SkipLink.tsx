/**
 * Accessible skip-to-main-content link. Hidden by default, becomes visible
 * when focused (first Tab press on page). Keyboard users can use this to skip
 * past navigation and jump directly to main content.
 *
 * Usage (add to top of root layout or each page):
 *   <SkipLink href="#main-content" />
 *   <main id="main-content">
 *     ...page content...
 *   </main>
 */

interface SkipLinkProps {
  /** Target ID (e.g., "main-content") */
  href: string;
}

export function SkipLink({ href }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 9999,
        padding: "12px 16px",
        backgroundColor: "var(--ds-brand, #088057)",
        color: "var(--ds-brand-contrast, #ffffff)",
        fontSize: "14px",
        fontWeight: "500",
        textDecoration: "none",
        border: "none",
        outline: "2px solid var(--ds-brand, #088057)",
        outlineOffset: "2px",
      }}
    >
      Skip to main content
    </a>
  );
}

/**
 * CSS helper class for sr-only (screen-reader only text) and focus:not-sr-only.
 * If not already in your global CSS, add this to app/globals.css:
 *
 * .sr-only {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0, 0, 0, 0);
 *   white-space: nowrap;
 *   border-width: 0;
 * }
 *
 * .focus\:not-sr-only:focus {
 *   position: static;
 *   width: auto;
 *   height: auto;
 *   padding: inherit;
 *   margin: inherit;
 *   overflow: visible;
 *   clip: auto;
 *   white-space: normal;
 * }
 */
