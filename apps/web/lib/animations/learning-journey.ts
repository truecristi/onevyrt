/**
 * Learning Journey Animations — SVG and CSS animations for programme progression
 *
 * Provides smooth, performant animations for:
 * - Stage-to-stage progression transitions
 * - Chapter completion celebrations
 * - Milestone badge reveals
 * - Progress bar updates
 * - Respects prefers-reduced-motion for accessibility
 */

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Generate CSS keyframe animations for journey progression
 */
export function generateJourneyAnimations(): string {
  return `
    @keyframes slideInFromLeft {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInFromRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-4px);
      }
    }

    @keyframes progressFill {
      from {
        width: 0;
      }
    }

    @keyframes checkmark {
      0% {
        stroke-dashoffset: 24;
        opacity: 0;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 1;
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    @keyframes confetti {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(-200px) rotate(360deg);
        opacity: 0;
      }
    }

    @keyframes glow {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `.trim();
}

/**
 * Generate CSS classes for journey visualization animations
 */
export function generateJourneyClasses(): string {
  return `
    .journey-stage {
      animation: slideInFromLeft 0.6s ease-out;
    }

    .journey-stage:nth-child(odd) {
      animation: slideInFromRight 0.6s ease-out;
    }

    .journey-stage-enter {
      animation: fadeIn 0.4s ease-out;
    }

    .journey-current-indicator {
      animation: pulse 2s ease-in-out infinite;
    }

    .journey-progress-bar {
      animation: progressFill 0.8s ease-out;
    }

    .journey-milestone {
      animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .journey-checkpoint-badge {
      animation: bounce 1s ease-in-out infinite;
    }

    .journey-complete-indicator {
      animation: checkmark 0.6s ease-out forwards;
      stroke-dasharray: 24;
    }

    .journey-chapter-unlock {
      animation: glow 2s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .journey-stage,
      .journey-stage:nth-child(odd),
      .journey-stage-enter,
      .journey-current-indicator,
      .journey-progress-bar,
      .journey-milestone,
      .journey-checkpoint-badge,
      .journey-complete-indicator,
      .journey-chapter-unlock {
        animation: none;
      }
    }
  `.trim();
}

/**
 * SVG path animation data for drawing a progression line
 */
export interface PathAnimationData {
  pathLength: number;
  duration: number;
  delay: number;
}

export function calculatePathAnimation(
  pathElement: SVGPathElement | null,
  duration: number = 1.2
): PathAnimationData | null {
  if (!pathElement) return null;

  try {
    const pathLength = pathElement.getTotalLength?.() || 0;
    return {
      pathLength,
      duration,
      delay: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Generate SVG style for animated path drawing
 */
export function generateAnimatedPathStyle(
  id: string,
  pathLength: number,
  duration: number = 1.2
): string {
  return `
    #${id} {
      stroke-dasharray: ${pathLength};
      stroke-dashoffset: ${pathLength};
      animation: drawPath ${duration}s ease-out forwards;
    }

    @keyframes drawPath {
      to {
        stroke-dashoffset: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #${id} {
        animation: none;
        stroke-dashoffset: 0;
      }
    }
  `.trim();
}

/**
 * Staggered animation delays for sequential stage reveals
 */
export function getStaggeredDelay(index: number, baseDelay: number = 0.1): number {
  return index * baseDelay;
}

/**
 * Create celebration animation for chapter completion
 */
export function generateCelebrationStyle(): string {
  return `
    @keyframes float {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(-100px) rotate(360deg);
        opacity: 0;
      }
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .celebration-confetti {
      animation: float 2s ease-out forwards;
      pointer-events: none;
    }

    .celebration-badge {
      animation: spin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @media (prefers-reduced-motion: reduce) {
      .celebration-confetti,
      .celebration-badge {
        animation: none;
      }
    }
  `.trim();
}

/**
 * Smooth scroll behavior for lesson roadmap navigation
 */
export function smoothScrollToElement(element: HTMLElement | null, behavior: ScrollBehavior = "smooth"): void {
  if (!element) return;
  const shouldReduceMotion = prefersReducedMotion();
  element.scrollIntoView({
    behavior: shouldReduceMotion ? "auto" : behavior,
    block: "nearest",
    inline: "nearest",
  });
}

/**
 * Create a transition stylesheet for smooth theme/color changes
 */
export function generateTransitionStyles(): string {
  return `
    .journey-transitionable {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }

    @media (prefers-reduced-motion: reduce) {
      .journey-transitionable {
        transition: none;
      }
    }
  `.trim();
}

/**
 * Calculate animation timing based on journey progress
 */
export function getProgressAnimationTiming(percent: number): {
  duration: number;
  easing: string;
} {
  // Faster animations for small changes, slower for large jumps
  const duration = Math.max(0.4, Math.min(1.2, percent / 100));
  return {
    duration,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", // bouncy easing
  };
}
