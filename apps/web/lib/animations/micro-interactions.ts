/**
 * ONEVYRT Micro-Interactions — Reusable animation utilities and CSS keyframes.
 *
 * Provides a suite of smooth, performant animations for interactive UI:
 * - Bounce, fade, slide, scale, rotate, color transitions
 * - Stagger animations for lists
 * - Respects prefers-reduced-motion for accessibility
 *
 * Usage:
 *   import { fadeIn, slideUp } from '@/lib/animations/micro-interactions';
 *   <div className={fadeIn}>Content</div>
 */

/**
 * Check if the user prefers reduced motion.
 * Used to conditionally apply animations or use instant transitions.
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Get the animation duration, respecting prefers-reduced-motion.
 * Returns 0ms if user prefers reduced motion, otherwise the provided duration.
 */
export const getDuration = (ms: number): number => {
  return prefersReducedMotion() ? 0 : ms;
};

/**
 * Get the animation delay, respecting prefers-reduced-motion.
 */
export const getDelay = (ms: number): number => {
  return prefersReducedMotion() ? 0 : ms;
};

// ============================================================================
// CSS ANIMATIONS — Exported as string classes for inline use
// ============================================================================

/**
 * Fade in — smooth opacity transition from 0 to 1.
 * Duration: 200ms, ease-in-out.
 */
export const fadeIn = "animate-fadeIn";

/**
 * Fade out — smooth opacity transition from 1 to 0.
 */
export const fadeOut = "animate-fadeOut";

/**
 * Slide up — translate from bottom to origin.
 * Common for entrance animations (modals, dropdowns).
 */
export const slideUp = "animate-slideUp";

/**
 * Slide down — translate from top to origin.
 */
export const slideDown = "animate-slideDown";

/**
 * Slide left — translate from right to origin.
 */
export const slideLeft = "animate-slideLeft";

/**
 * Slide right — translate from left to origin.
 */
export const slideRight = "animate-slideRight";

/**
 * Bounce — gentle bounce keyframe (elastic spring).
 */
export const bounce = "animate-bounce";

/**
 * Scale in — grow from 0.95 to 1 with fade.
 * Nice for button clicks and card entries.
 */
export const scaleIn = "animate-scaleIn";

/**
 * Scale out — shrink from 1 to 0.95 with fade.
 */
export const scaleOut = "animate-scaleOut";

/**
 * Pulse — gentle opacity pulse for loading states.
 */
export const pulse = "animate-pulse";

/**
 * Spin — continuous rotation, useful for loading spinners.
 */
export const spin = "animate-spin";

/**
 * Shake — horizontal vibration for error states.
 */
export const shake = "animate-shake";

/**
 * Heartbeat — brief scale pulse, useful for "awaiting" states.
 */
export const heartbeat = "animate-heartbeat";

// ============================================================================
// ANIMATION CLASSES — Tailwind-compatible keyframes
// ============================================================================

/**
 * Generate CSS keyframes for custom animations.
 * This is injected into the global stylesheet via app/design-system.css.
 *
 * Keyframes included:
 * - @keyframes fadeIn
 * - @keyframes fadeOut
 * - @keyframes slideUp
 * - @keyframes slideDown
 * - @keyframes slideLeft
 * - @keyframes slideRight
 * - @keyframes scaleIn
 * - @keyframes scaleOut
 * - @keyframes shake
 * - @keyframes heartbeat
 * - @keyframes flip
 * - @keyframes confetti
 *
 * All animations respect prefers-reduced-motion via media query.
 */
export const ANIMATION_KEYFRAMES = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(1rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    transform: translateY(-1rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideLeft {
  from {
    transform: translateX(1rem);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideRight {
  from {
    transform: translateX(-1rem);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes scaleOut {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.95);
    opacity: 0;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.15);
  }
  28% {
    transform: scale(1);
  }
}

@keyframes flip {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(360deg);
  }
}

@keyframes confetti {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

// ============================================================================
// TAILWIND ANIMATION CONFIG — For next.config.ts
// ============================================================================

/**
 * Tailwind animation theme configuration.
 * Add to extend.animation in tailwind.config.ts:
 *
 * extend: {
 *   animation: TAILWIND_ANIMATION_CONFIG,
 *   keyframes: TAILWIND_KEYFRAMES_CONFIG,
 * }
 */
export const TAILWIND_ANIMATION_CONFIG = {
  fadeIn: "fadeIn 200ms ease-in-out",
  fadeOut: "fadeOut 200ms ease-in-out",
  slideUp: "slideUp 300ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  slideDown: "slideDown 300ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  slideLeft: "slideLeft 300ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  slideRight: "slideRight 300ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  scaleIn: "scaleIn 200ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  scaleOut: "scaleOut 200ms cubic-bezier(0.2, 0.7, 0.3, 1)",
  shake: "shake 400ms cubic-bezier(0.36, 0, 0.66, 1)",
  heartbeat: "heartbeat 1200ms ease-in-out infinite",
  flip: "flip 600ms ease-in-out",
  confetti: "confetti 3s ease-out forwards",
};

export const TAILWIND_KEYFRAMES_CONFIG = {
  fadeIn: "{ from: { opacity: '0' }, to: { opacity: '1' } }",
  fadeOut: "{ from: { opacity: '1' }, to: { opacity: '0' } }",
  slideUp: "{ from: { transform: 'translateY(1rem)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } }",
  slideDown: "{ from: { transform: 'translateY(-1rem)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } }",
  slideLeft: "{ from: { transform: 'translateX(1rem)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } }",
  slideRight: "{ from: { transform: 'translateX(-1rem)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } }",
  scaleIn: "{ from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } }",
  scaleOut: "{ from: { transform: 'scale(1)', opacity: '1' }, to: { transform: 'scale(0.95)', opacity: '0' } }",
  shake: "{ '0%, 100%': { transform: 'translateX(0)' }, '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' }, '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' } }",
  heartbeat: "{ '0%, 100%': { transform: 'scale(1)' }, '14%': { transform: 'scale(1.15)' }, '28%': { transform: 'scale(1)' } }",
  flip: "{ from: { transform: 'rotateY(0deg)' }, to: { transform: 'rotateY(360deg)' } }",
  confetti: "{ from: { transform: 'translateY(0) rotate(0deg)', opacity: '1' }, to: { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' } }",
};

// ============================================================================
// INLINE STYLE HELPERS — For dynamic animations (React state-driven)
// ============================================================================

/**
 * Create a fade-in transition style object.
 *
 * @param durationMs Duration in milliseconds (default 200)
 * @param delayMs Delay before animation starts (default 0)
 * @returns CSS-in-JS style object
 */
export const fadeInStyle = (durationMs = 200, delayMs = 0): React.CSSProperties => ({
  animation: prefersReducedMotion()
    ? "none"
    : `fadeIn ${getDuration(durationMs)}ms ease-in-out ${getDelay(delayMs)}ms forwards`,
  opacity: 0,
});

/**
 * Create a slide-up transition style object.
 *
 * @param durationMs Duration in milliseconds (default 300)
 * @param delayMs Delay before animation starts (default 0)
 * @returns CSS-in-JS style object
 */
export const slideUpStyle = (durationMs = 300, delayMs = 0): React.CSSProperties => ({
  animation: prefersReducedMotion()
    ? "none"
    : `slideUp ${getDuration(durationMs)}ms cubic-bezier(0.2, 0.7, 0.3, 1) ${getDelay(delayMs)}ms forwards`,
  opacity: 0,
  transform: "translateY(1rem)",
});

/**
 * Create a scale-in transition style object.
 *
 * @param durationMs Duration in milliseconds (default 200)
 * @param delayMs Delay before animation starts (default 0)
 * @returns CSS-in-JS style object
 */
export const scaleInStyle = (durationMs = 200, delayMs = 0): React.CSSProperties => ({
  animation: prefersReducedMotion()
    ? "none"
    : `scaleIn ${getDuration(durationMs)}ms cubic-bezier(0.2, 0.7, 0.3, 1) ${getDelay(delayMs)}ms forwards`,
  opacity: 0,
  transform: "scale(0.95)",
});

/**
 * Create a staggered animation delay for list items.
 * Useful for animating lists where each item has a sequential delay.
 *
 * @param index Index of the item in the list
 * @param delayPerItem Delay per item in milliseconds (default 50)
 * @returns Delay in milliseconds
 */
export const staggerDelay = (index: number, delayPerItem = 50): number => {
  return getDelay(index * delayPerItem);
};

/**
 * Create a height transition object for collapsible elements.
 * Smoothly animates from 0 to full height.
 *
 * @param isOpen Whether the element is open
 * @param durationMs Duration in milliseconds (default 300)
 * @returns CSS-in-JS style object
 */
export const heightTransitionStyle = (isOpen: boolean, durationMs = 300): React.CSSProperties => ({
  overflow: "hidden",
  transition: prefersReducedMotion()
    ? "none"
    : `max-height ${getDuration(durationMs)}ms ease-in-out`,
  maxHeight: isOpen ? "1000px" : "0px",
});

/**
 * Create a smooth color transition style.
 *
 * @param _fromColor Starting color (unused — kept for API/documentation symmetry with toColor)
 * @param toColor Ending color
 * @param durationMs Duration in milliseconds (default 200)
 * @returns CSS-in-JS style object
 */
export const colorTransitionStyle = (
  _fromColor: string,
  toColor: string,
  durationMs = 200
): React.CSSProperties => ({
  backgroundColor: toColor,
  transition: prefersReducedMotion()
    ? "none"
    : `background-color ${getDuration(durationMs)}ms ease-in-out`,
});
