/**
 * Illustration Component
 *
 * Reusable SVG illustration component for visual storytelling throughout ONEVYRT.
 * Supports responsive scaling, dark mode variants, and multiple illustration types.
 *
 * Usage:
 *   <Illustration name="chapter-journey" variant="full" responsive={true} />
 *   <Illustration name="programme-complete" variant="compact" />
 *   <Illustration name="bottleneck-funnel" />
 */

import React, { CSSProperties } from "react";

type IllustrationName =
  | "chapter-journey"
  | "programme-complete"
  | "bottleneck-funnel"
  | "business-snapshot"
  | "empty-state-projects"
  | "empty-state-coaching"
  | "empty-state-growth-plan";

type Variant = "full" | "compact";

interface IllustrationProps {
  /** The illustration name (maps to SVG file) */
  name: IllustrationName;
  /** Display variant: full (100% width) or compact (smaller) */
  variant?: Variant;
  /** Whether to scale responsively */
  responsive?: boolean;
  /** Optional CSS classes */
  className?: string;
  /** Optional alt text for accessibility */
  alt?: string;
  /** Optional container styles */
  style?: CSSProperties;
}

/**
 * Map illustration names to SVG paths and metadata
 */
const ILLUSTRATIONS: Record<
  IllustrationName,
  {
    path: string;
    defaultWidth: number;
    defaultHeight: number;
    alt: string;
    description: string;
  }
> = {
  "chapter-journey": {
    path: "/illustrations/chapter-journey.svg",
    defaultWidth: 1200,
    defaultHeight: 300,
    alt: "Programme journey showing chapters Start → Define → Implement → Control → Improve → Finish",
    description: "Visual flowchart of the ONEVYRT programme progression",
  },
  "programme-complete": {
    path: "/illustrations/programme-complete.svg",
    defaultWidth: 400,
    defaultHeight: 400,
    alt: "Trophy with confetti celebrating programme completion",
    description: "Celebration illustration for finished learners",
  },
  "bottleneck-funnel": {
    path: "/illustrations/bottleneck-funnel.svg",
    defaultWidth: 500,
    defaultHeight: 600,
    alt: "Funnel diagram showing where the business bottleneck occurs",
    description: "Funnel visualization for identifying constraints",
  },
  "business-snapshot": {
    path: "/illustrations/business-snapshot.svg",
    defaultWidth: 600,
    defaultHeight: 400,
    alt: "Dashboard showing Customer, Strategy, Numbers, and Improvement Plan",
    description: "Overview of business dimensions",
  },
  "empty-state-projects": {
    path: "/illustrations/empty-state-projects.svg",
    defaultWidth: 300,
    defaultHeight: 300,
    alt: "Briefcase illustration for empty projects state",
    description: "Prompt to create a new project",
  },
  "empty-state-coaching": {
    path: "/illustrations/empty-state-coaching.svg",
    defaultWidth: 300,
    defaultHeight: 300,
    alt: "Mentor illustration for empty coaching state",
    description: "Prompt for coaching programme",
  },
  "empty-state-growth-plan": {
    path: "/illustrations/empty-state-growth-plan.svg",
    defaultWidth: 300,
    defaultHeight: 300,
    alt: "Growing chart illustration for empty growth plan",
    description: "Prompt to build growth plan",
  },
};

/**
 * Calculate responsive dimensions based on variant
 */
function getResponsiveDimensions(
  _meta: (typeof ILLUSTRATIONS)[IllustrationName],
  variant: Variant
): { width: string; height: string; maxWidth: string } {
  if (variant === "compact") {
    return {
      width: "100%",
      height: "auto",
      maxWidth: "300px",
    };
  }

  // Full variant - responsive
  return {
    width: "100%",
    height: "auto",
    maxWidth: "100%",
  };
}

/**
 * Illustration Component
 *
 * Renders an SVG illustration from the public/illustrations directory.
 * - Supports responsive sizing and variants
 * - Accessible with proper alt text
 * - Dark mode compatible (SVGs use semantic colors)
 */
export function Illustration({
  name,
  variant = "full",
  responsive = true,
  className = "",
  alt,
  style,
}: IllustrationProps): React.ReactElement {
  const meta = ILLUSTRATIONS[name];

  if (!meta) {
    console.warn(`Unknown illustration: ${name}`);
    return <div className={`illustration illustration--error ${className}`}>Illustration not found</div>;
  }

  const dims = responsive ? getResponsiveDimensions(meta, variant) : { width: "100%", height: "auto", maxWidth: "none" };
  const altText = alt || meta.alt;

  // Container classes based on variant
  const containerClasses = [
    "illustration",
    `illustration--${name}`,
    `illustration--${variant}`,
    responsive && "illustration--responsive",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: dims.width,
    maxWidth: dims.maxWidth,
    ...style,
  };

  return (
    <div className={containerClasses} style={containerStyle}>
      <img
        src={meta.path}
        alt={altText}
        title={meta.description}
        style={{
          width: dims.width,
          height: dims.height,
          maxWidth: dims.maxWidth,
          display: "block",
        }}
        loading="lazy"
      />
    </div>
  );
}

/**
 * Preload critical illustrations for better performance
 */
export function preloadIllustrations(names: IllustrationName[]): void {
  if (typeof document === "undefined") return;

  names.forEach((name) => {
    const meta = ILLUSTRATIONS[name];
    if (!meta) return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = meta.path;
    document.head.appendChild(link);
  });
}

/**
 * Inline illustration styles for consistency
 */
export const illustrationStyles = `
.illustration {
  display: flex;
  align-items: center;
  justify-content: center;
}

.illustration img {
  display: block;
  object-fit: contain;
}

.illustration--responsive {
  width: 100%;
}

.illustration--compact {
  max-width: 300px;
}

.illustration--error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background: var(--ds-bg-subtle, #f1f4f9);
  border-radius: 8px;
  color: var(--ds-text-tertiary, #94a3b8);
  font-size: 14px;
}
`;
