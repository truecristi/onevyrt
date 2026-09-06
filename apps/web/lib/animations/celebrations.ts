/**
 * ONEVYRT Celebrations — Confetti, badges, and achievement animations.
 *
 * Provides delightful visual feedback for milestone completions:
 * - Confetti particle system (with configurable limits for performance)
 * - Badge reveal animations
 * - Trophy/achievement animations
 * - Sound effects (optional, disabled by default)
 * - Accessibility: respects prefers-reduced-motion
 *
 * Usage:
 *   import { triggerConfetti, showBadgeAnimation } from '@/lib/animations/celebrations';
 *   <button onClick={() => triggerConfetti()}>Complete!</button>
 */

import { prefersReducedMotion } from "./micro-interactions";

/**
 * Confetti particle configuration.
 */
export interface ConfettiOptions {
  /** Number of particles (default: 50, max: 200 for performance) */
  particleCount?: number;
  /** Duration in milliseconds (default: 3000) */
  duration?: number;
  /** Gravity scale, higher = falls faster (default: 1.0) */
  gravity?: number;
  /** Colors array (default: chapter colors) */
  colors?: string[];
  /** Element to emit from (default: center of screen) */
  origin?: { x: number; y: number };
  /** Spread angle in degrees (default: 45) */
  spread?: number;
  /** Maximum velocity (default: 50) */
  velocity?: number;
}

/**
 * Trigger a confetti explosion animation.
 * Performance-optimized for web (limited particles, cleanup).
 *
 * @param options Configuration for the confetti effect
 */
export function triggerConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return;
  }

  const {
    particleCount = 50,
    duration = 3000,
    gravity = 1.0,
    colors = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#0891b2"],
    origin = { x: 0.5, y: 0.5 },
    spread = 45,
    velocity = 50,
  } = options;

  // Cap particles for performance
  const maxParticles = Math.min(particleCount, 200);

  for (let i = 0; i < maxParticles; i++) {
    const particle = document.createElement("div");
    particle.style.cssText = `
      position: fixed;
      pointer-events: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${origin.x * 100}%;
      top: ${origin.y * 100}%;
      opacity: 1;
      z-index: 9999;
    `;

    document.body.appendChild(particle);

    // Calculate random trajectory
    const angle = (Math.random() - 0.5) * (spread * Math.PI) / 180;
    const initialVelocity = velocity * (0.5 + Math.random() * 0.5);
    let vx = initialVelocity * Math.cos(angle);
    let vy = initialVelocity * Math.sin(angle);

    const startTime = Date.now();
    const particleGravity = 9.81 * gravity;

    function animate(): void {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        particle.remove();
        return;
      }

      // Update position with gravity
      vy += particleGravity * 0.016; // Simplified gravity
      const x = (origin.x * window.innerWidth) + vx * elapsed * 0.001;
      const y = (origin.y * window.innerHeight) + vy * elapsed * 0.001;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.opacity = String(1 - progress);

      requestAnimationFrame(animate);
    }

    animate();
  }
}

/**
 * Show a badge reveal animation at a specific position.
 * Useful for unlocking achievements, new chapters, etc.
 *
 * @param badgeText The text to display (e.g., "Chapter Unlocked!")
 * @param iconHTML Optional HTML for an icon (SVG or emoji)
 * @param position Position on screen (top-center, bottom-center, etc.)
 */
export function showBadgeAnimation(
  badgeText: string,
  iconHTML?: string,
  position: "top-center" | "bottom-center" | "center" = "center"
): void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return;
  }

  const badge = document.createElement("div");
  badge.style.cssText = `
    position: fixed;
    z-index: 10000;
    padding: 20px 32px;
    background: linear-gradient(135deg, #088057 0%, #0a9e6e 100%);
    color: white;
    border-radius: 12px;
    box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.2);
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    font-size: 16px;
    animation: slideUp 400ms cubic-bezier(0.2, 0.7, 0.3, 1);
    pointer-events: none;
    max-width: 90vw;
  `;

  // Position the badge
  if (position === "top-center") {
    badge.style.top = "20px";
    badge.style.left = "50%";
    badge.style.transform = "translateX(-50%)";
  } else if (position === "bottom-center") {
    badge.style.bottom = "20px";
    badge.style.left = "50%";
    badge.style.transform = "translateX(-50%)";
  } else {
    badge.style.top = "50%";
    badge.style.left = "50%";
    badge.style.transform = "translate(-50%, -50%)";
  }

  if (iconHTML) {
    const icon = document.createElement("span");
    icon.innerHTML = iconHTML;
    icon.style.cssText = "display: flex; align-items: center; width: 24px; height: 24px;";
    badge.appendChild(icon);
  }

  const text = document.createElement("span");
  text.textContent = badgeText;
  badge.appendChild(text);

  document.body.appendChild(badge);

  // Remove after animation + delay
  setTimeout(() => {
    badge.style.animation = "fadeOut 400ms ease-in-out forwards";
    setTimeout(() => badge.remove(), 400);
  }, 2000);
}

/**
 * Show a trophy/achievement animation.
 * Displays a rotating trophy icon with celebration.
 *
 * @param title The achievement title (e.g., "Chapter Completed!")
 * @param subtitle Optional subtitle (e.g., "Business OS Complete")
 */
export function showTrophyAnimation(title: string, subtitle?: string): void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return;
  }

  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    background: rgba(0, 0, 0, 0.3);
    animation: fadeIn 200ms ease-in-out;
    pointer-events: none;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.2);
    animation: scaleIn 400ms cubic-bezier(0.2, 0.7, 0.3, 1);
    max-width: 400px;
  `;

  // Trophy icon (simplified SVG)
  const trophy = document.createElement("div");
  trophy.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin: 0 auto 16px; animation: flip 600ms ease-in-out;">
      <path d="M16 8H48V20C48 28 42 34 32 34C22 34 16 28 16 20V8Z" fill="#d97706"/>
      <rect x="28" y="34" width="8" height="12" fill="#d97706"/>
      <rect x="24" y="46" width="16" height="4" fill="#d97706"/>
    </svg>
  `;

  content.appendChild(trophy);

  const titleEl = document.createElement("h2");
  titleEl.textContent = title;
  titleEl.style.cssText = "font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #111827;";
  content.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.textContent = subtitle;
    subtitleEl.style.cssText = "font-size: 14px; margin: 0; color: #475569;";
    content.appendChild(subtitleEl);
  }

  container.appendChild(content);
  document.body.appendChild(container);

  // Remove after delay
  setTimeout(() => {
    container.style.animation = "fadeOut 400ms ease-in-out forwards";
    setTimeout(() => container.remove(), 400);
  }, 3000);
}

/**
 * Play a sound effect (optional, disabled by default).
 * Requires an audio file to be available.
 *
 * @param soundType Type of sound (success, achievement, unlock, etc.)
 * @param enabled Whether to play (default: false for accessibility)
 */
export function playSound(
  _soundType: "success" | "achievement" | "unlock" | "milestone" = "success",
  enabled = false
): void {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  // This would be called with an actual audio library like Howler
  // For now, we're just a placeholder for the interface
  // In production: new Howl({ src: ['/sounds/success.mp3'] }).play();
}

/**
 * Trigger a full celebration sequence (confetti + badge + optional sound).
 * Perfect for major milestone completions.
 *
 * @param config Celebration configuration
 */
export interface CelebrationConfig {
  title: string;
  subtitle?: string;
  showConfetti?: boolean;
  showBadge?: boolean;
  showTrophy?: boolean;
  confettiOptions?: Omit<ConfettiOptions, "origin">;
  sound?: boolean;
}

export function triggerCelebration(config: CelebrationConfig): void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return;
  }

  const {
    title,
    subtitle,
    showConfetti = true,
    showBadge = true,
    showTrophy = false,
    confettiOptions,
    sound = false,
  } = config;

  // Start confetti
  if (showConfetti) {
    triggerConfetti({
      ...confettiOptions,
      origin: { x: 0.5, y: 0.3 },
    });
  }

  // Show trophy (blocks other animations)
  if (showTrophy) {
    showTrophyAnimation(title, subtitle);
  } else if (showBadge) {
    // Otherwise show badge
    showBadgeAnimation(title, "✨", "top-center");
  }

  // Play sound (if enabled)
  if (sound) {
    playSound("achievement", sound);
  }
}

/**
 * Pulse a number counter animation.
 * Animates from a start number to an end number.
 *
 * @param element The DOM element to animate
 * @param start Starting number
 * @param end Ending number
 * @param duration Animation duration in milliseconds
 * @param format Optional format function (e.g., currency formatter)
 */
export function animateCounter(
  element: HTMLElement,
  start: number,
  end: number,
  duration = 1000,
  format?: (num: number) => string
): void {
  if (prefersReducedMotion()) {
    element.textContent = format ? format(end) : String(end);
    return;
  }

  const startTime = Date.now();
  const range = end - start;

  function update(): void {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: ease-out-cubic
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const current = start + range * easedProgress;

    element.textContent = format
      ? format(Math.round(current))
      : String(Math.round(current));

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  update();
}

/**
 * Scale pulse animation for attention-getting.
 * Useful for highlighting important metrics or alerts.
 *
 * @param element Element to pulse
 * @param cycles Number of pulse cycles (default: 3)
 */
export function scalePulse(element: HTMLElement, cycles = 3): void {
  if (prefersReducedMotion() || !element) {
    return;
  }

  let cycle = 0;

  function pulse(): void {
    element.style.transition = "transform 300ms ease-in-out";
    element.style.transform = "scale(1.1)";

    setTimeout(() => {
      element.style.transform = "scale(1)";
      cycle++;

      if (cycle < cycles) {
        setTimeout(pulse, 300);
      }
    }, 300);
  }

  pulse();
}
