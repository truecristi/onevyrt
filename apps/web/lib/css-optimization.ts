/**
 * CSS Optimization Utilities
 *
 * This module provides helpers for CSS optimization including:
 * - Critical CSS extraction
 * - Unused CSS removal
 * - CSS-in-JS performance patterns
 * - Font loading optimization
 */

/**
 * Critical CSS loader
 * Loads only the CSS needed for initial render (above-the-fold)
 *
 * Usage: Add to _document.tsx or layout.tsx
 * <CriticalCSSLoader />
 */
export const criticalCSSConfig = {
  // Paths that should have critical CSS extracted
  criticalPaths: [
    '/',
    '/auth',
    '/studio',
    '/programme',
  ],

  // Generate critical CSS with:
  // npm install --save-dev critical
  // npx critical dist/out index.html --base . --inline > src/css/critical.css
};

/**
 * Tailwind CSS optimization config
 * Included in tailwind.config.ts
 */
export const tailwindOptimizationConfig = {
  // Purge unused styles in production
  purge: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Content for tailwind (Next.js 13+)
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Safelist classes that should never be purged
  safelist: [
    // Dynamic classes that can't be statically analyzed
    { pattern: /^(bg|text|border|ring)-(blue|red|green|amber)-(50|100|200|300|400|500)$/ },
    // Status indicators
    { pattern: /^(w|h)-(4|6|8|10|12|16)$/ },
  ],

  // Production-only optimizations
  productionOptimizations: {
    minify: true,
    removeUnused: true,
    removeDuplicates: true,
  },
};

/**
 * Font loading strategy for optimal performance
 * Prioritize system fonts, use variable fonts
 */
export const fontOptimizationStrategy = {
  // System fonts (fastest - no download)
  systemFonts: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ],

  // Google Fonts to preload (if used)
  preloadFonts: [
    {
      family: 'Inter', // Variable font recommended
      weights: ['400', '500', '600', '700'],
      formats: ['woff2'], // Modern format only
      display: 'swap', // Show fallback immediately
    },
  ],

  // Font loading implementation:
  // <link rel="preload" as="font" href="/fonts/inter-var.woff2" crossOrigin="anonymous" />
  // <style>{`
  //   @font-face {
  //     font-family: 'Inter';
  //     src: url('/fonts/inter-var.woff2') format('woff2');
  //     font-weight: 100 900;
  //     font-display: swap;
  //   }
  // `}</style>
};

/**
 * CSS-in-JS performance patterns
 * Inline critical styles, lazy load non-critical
 */
export function generateCriticalStyles(): string {
  return `
    /* Critical styles for initial paint */
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    html, body { width: 100%; height: 100%; }

    /* Hero/above-fold styles */
    .hero-section {
      background: linear-gradient(135deg, #088057 0%, #077049 100%);
      color: white;
      padding: 80px 24px 60px;
    }

    /* Navigation */
    nav { display: flex; gap: 16px; }

    /* Buttons */
    button {
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 200ms ease;
    }
  `;
}

/**
 * Lazy load non-critical styles
 * Reduces initial CSS payload
 */
export function lazyLoadStylesheet(href: string, priority: 'low' | 'high' = 'low'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;

  if (priority === 'high') {
    document.head.insertBefore(link, document.head.firstChild);
  } else {
    link.onload = () => {
      // Stylesheet loaded
    };
    document.head.appendChild(link);
  }
}

/**
 * Remove unused CSS selectors (for dynamic styling)
 * Process: analyze DOM at build time, remove unused selectors
 */
export const unusedCSSRemovalConfig = {
  // Tools to consider:
  // - PurgeCSS: npm install --save-dev purgecss
  // - UnCSS: npm install --save-dev uncss
  // - Tailwind (built-in purging)

  // Configuration example:
  enabled: true,
  patterns: [
    'app/**/*.{js,ts,jsx,tsx}',
    'components/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Dynamic classes from JavaScript
    'opacity-50',
    'opacity-75',
    'opacity-100',
    'scale-50',
    'scale-75',
    'scale-100',
  ],
};

/**
 * Animation performance optimization
 * Use transform and opacity only (GPU accelerated)
 */
export const animationOptimizationGuide = `
  /* BAD: Triggers layout/paint */
  .slow-animation {
    transition: width 0.3s ease;
    width: 100% > 50%;
  }

  /* GOOD: GPU accelerated (transform + opacity) */
  .fast-animation {
    transition: transform 0.3s ease, opacity 0.3s ease;
    transform: scale(0.5) translateX(-50px);
    opacity: 0.8;
  }

  /* Use will-change sparingly (10-20 elements max) */
  .animated-element {
    will-change: transform;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from { transform: translateX(-100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

/**
 * Critical rendering path optimization checklist
 */
export const criticalRenderingPathChecklist = [
  {
    step: '1. Reduce Critical Resources',
    actions: [
      '- Inline critical CSS',
      '- Defer non-critical CSS/JS',
      '- Use dynamic imports for large components',
      '- Minify and compress all assets',
    ],
  },
  {
    step: '2. Optimize Resource Sizes',
    actions: [
      '- Minify CSS (remove unused rules)',
      '- Remove duplicate styles',
      '- Use shorthand properties',
      '- Enable gzip/brotli compression',
    ],
  },
  {
    step: '3. Reduce Parse & Compile Time',
    actions: [
      '- Reduce CSS file size',
      '- Use modern syntax (custom properties)',
      '- Avoid expensive selectors',
      '- Cache parsed styles',
    ],
  },
  {
    step: '4. Optimize Rendering',
    actions: [
      '- Avoid forced reflows/repaints',
      '- Use requestAnimationFrame for animations',
      '- Batch DOM updates',
      '- Use CSS containment',
    ],
  },
];
