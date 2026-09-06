/**
 * Performance Optimization Utilities
 *
 * This module provides helpers for performance optimization including:
 * - Component lazy loading strategies
 * - Image optimization utilities
 * - Code splitting patterns
 * - Performance monitoring setup
 */

// Ambient shims for the optional, not-yet-installed 'web-vitals' and
// 'react-quill' dependencies this file dynamically imports live in
// types/ambient-modules.d.ts, not here — a `declare module "x"` inside a
// file that itself has top-level imports/exports is a *module augmentation*
// (must resolve an existing module), not a fresh ambient declaration, so it
// has to live in a global (no import/export) .d.ts instead. See that file's
// own comment, and the "Files Modified" note under Performance Optimization
// Strategy in CLAUDE.md ("apps/web/package.json — May need to add
// web-vitals dependency"). Installing the real packages later needs no
// changes here since the shim shapes match their real APIs.

/**
 * Dynamic import wrapper with error boundary and loading state
 * Usage: const MyComponent = dynamicImport(() => import('@/components/MyComponent'))
 */
export function dynamicImport(
  importFunc: () => Promise<{ default: any }>,
  options?: { loading?: React.ComponentType; ssr?: boolean }
) {
  if (typeof window === 'undefined') {
    // Server-side: return a placeholder
    return function ServerPlaceholder() {
      return null;
    };
  }

  // Client-side: use dynamic import. require() rather than a top-level
  // `import`, deliberately: this whole branch only runs once we're already
  // confirmed client-side (the check above), so this defers loading
  // next/dynamic and react out of the server bundle entirely rather than
  // having a static import hoist them in unconditionally. No real caller
  // today (dead code — grep finds none), but must still type-check.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const dynamic = require('next/dynamic');
  return dynamic(importFunc, {
    loading: options?.loading || (() => require('react').createElement('div', null, 'Loading...')),
    ssr: options?.ssr !== false,
  });
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/**
 * Configuration for optimal image sizes across breakpoints
 */
export const imageOptimizationConfig = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  formats: ['image/webp', 'image/avif'], // Prefer modern formats
  minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year for versioned assets
};

/**
 * Generate responsive srcset for images
 * Reduces multiple image requests by using srcset
 */
export function generateImageSrcset(
  basePath: string,
  _width: number,
  quality: number = 75
): string {
  const widths = [320, 640, 1024, 1280];
  return widths
    .map((w) => `${basePath}?w=${w}&q=${quality} ${w}w`)
    .join(', ');
}

/**
 * Intersection Observer helper for lazy loading components and images
 * Reduces initial paint time by deferring off-screen content
 *
 * Usage in a component:
 * const ref = useRef<HTMLDivElement>(null);
 * useIntersectionObserverHook(ref, (isVisible) => setLoaded(isVisible));
 */
export function useIntersectionObserverHook(
  _ref: React.RefObject<Element>,
  _callback: (isVisible: boolean) => void,
  _options?: IntersectionObserverInit
) {
  // This would be used in a client component with useEffect
  // For use in server contexts, see createIntersectionObserver below
}

/**
 * Create an Intersection Observer for lazy loading
 * Works in both client and server contexts
 */
export function createIntersectionObserver(
  element: Element,
  callback: (isVisible: boolean) => void,
  options?: IntersectionObserverInit
): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op in server context
  }

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry) callback(entry.isIntersecting);
  }, options);

  observer.observe(element);

  return () => {
    observer.unobserve(element);
  };
}

/**
 * Web Vitals tracking configuration
 * Monitors Core Web Vitals: LCP, FID, CLS
 */
export async function initWebVitals() {
  if (typeof window === 'undefined') return;

  try {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

    getCLS((metric) => {
      console.debug('CLS:', metric);
      reportWebVital(metric);
    });

    getFID((metric) => {
      console.debug('FID:', metric);
      reportWebVital(metric);
    });

    getFCP((metric) => {
      console.debug('FCP:', metric);
      reportWebVital(metric);
    });

    getLCP((metric) => {
      console.debug('LCP:', metric);
      reportWebVital(metric);
    });

    getTTFB((metric) => {
      console.debug('TTFB:', metric);
      reportWebVital(metric);
    });
  } catch (error) {
    console.error('Failed to initialize Web Vitals:', error);
  }
}

/**
 * Report Web Vital metric to analytics
 * In production, send to your analytics service
 */
function reportWebVital(metric: {
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  id: string;
}) {
  const body = JSON.stringify(metric);
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/web-vitals', body);
  } else {
    fetch('/api/analytics/web-vitals', { body, method: 'POST', keepalive: true }).catch(() => {
      // Silently ignore failures
    });
  }
}

/**
 * Tree-shaking helper: conditionally import heavy dependencies
 * Only loads when needed, reducing initial bundle
 */
export async function importHeavyLibraryOnDemand(name: 'pdf' | 'chart' | 'editor') {
  switch (name) {
    case 'pdf':
      return import('jspdf').then((m) => m.jsPDF);
    case 'chart':
      return import('@xyflow/react').then((m) => m.ReactFlow);
    case 'editor':
      return import('react-quill').catch(() => null);
    default:
      throw new Error(`Unknown heavy library: ${name}`);
  }
}

/**
 * Bundle analyzer helper
 * In production, use: ANALYZE=true pnpm build
 */
export const bundleAnalyzerConfig = {
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false, // Set to true to auto-open browser
  analyzerMode: 'static',
  reportFilename: 'bundle-report.html',
};
