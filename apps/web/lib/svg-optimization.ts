/**
 * SVG Optimization Utilities
 *
 * Provides helpers for optimizing SVG assets to reduce bundle size.
 * SVGs can often be reduced by 30-50% with lossless optimization.
 */

/**
 * SVG Optimization Options
 */
export interface SVGOptimizationOptions {
  // Remove whitespace and newlines
  removeWhitespace?: boolean;

  // Remove default attribute values
  removeAttributeDefaults?: boolean;

  // Remove empty containers
  removeEmptyContainers?: boolean;

  // Remove viewBox if width/height are present
  removeViewBox?: boolean;

  // Sort attributes alphabetically
  sortAttributes?: boolean;

  // Convert colors to hex notation
  convertColors?: boolean;

  // Optimize path data (reduce decimal precision)
  optimizePathData?: boolean;

  // Precision for path data (2-8 digits)
  pathDataPrecision?: number;
}

/**
 * Default SVG optimization config
 * These settings preserve SVG functionality while reducing size
 */
export const DEFAULT_SVG_OPTIMIZATION: SVGOptimizationOptions = {
  removeWhitespace: true,
  removeAttributeDefaults: true,
  removeEmptyContainers: true,
  removeViewBox: false, // Keep for responsive scaling
  sortAttributes: true,
  convertColors: true,
  optimizePathData: true,
  pathDataPrecision: 2,
};

/**
 * Aggressive SVG optimization config
 * Use when maximum size reduction is needed
 * WARNING: May affect some SVGs rendering
 */
export const AGGRESSIVE_SVG_OPTIMIZATION: SVGOptimizationOptions = {
  removeWhitespace: true,
  removeAttributeDefaults: true,
  removeEmptyContainers: true,
  removeViewBox: true,
  sortAttributes: true,
  convertColors: true,
  optimizePathData: true,
  pathDataPrecision: 1,
};

/**
 * Parse SVG content and return SVGO configuration
 * Used by webpack loader to optimize SVGs at build time
 */
export function getSVGOConfig(options: SVGOptimizationOptions = DEFAULT_SVG_OPTIMIZATION) {
  return {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: options.removeViewBox ?? false,
            removeHiddenElems: options.removeEmptyContainers ?? true,
            removeEmptyContainers: options.removeEmptyContainers ?? true,
            cleanupNumericValues: {
              floatToShort: true,
              leadingZero: 'remove',
              removeTrailingZeros: true,
            },
            convertPathData: {
              precision: options.pathDataPrecision ?? 2,
            },
            sortAttrs: options.sortAttributes ?? true,
            convertColors: options.convertColors ?? true,
          },
        },
      },
      // Additional optimization plugins
      {
        name: 'removeAttrs',
        params: {
          attrs: ['data-*', 'id', 'class'], // Remove data attributes that may not be needed
        },
      },
    ],
  };
}

/**
 * Estimate SVG optimization savings
 * Returns approximate size reduction percentage
 */
export function estimateSVGOptimizationSavings(
  _originalSize: number,
  options: SVGOptimizationOptions = DEFAULT_SVG_OPTIMIZATION
): number {
  // Empirical savings based on optimization level
  let estimatedSavings = 0;

  if (options.removeWhitespace) estimatedSavings += 5;
  if (options.removeAttributeDefaults) estimatedSavings += 10;
  if (options.removeEmptyContainers) estimatedSavings += 5;
  if (options.sortAttributes) estimatedSavings += 3;
  if (options.convertColors) estimatedSavings += 5;
  if (options.optimizePathData) estimatedSavings += 15;

  // Cap at 45% maximum savings (conservative estimate)
  return Math.min(estimatedSavings, 45);
}

/**
 * SVG Size Optimization Report
 */
export interface SVGOptimizationReport {
  originalSize: number;
  estimatedOptimizedSize: number;
  estimatedSavings: number;
  savingsPercent: number;
}

/**
 * Generate optimization report for an SVG
 */
export function generateSVGOptimizationReport(
  svgSize: number,
  options: SVGOptimizationOptions = DEFAULT_SVG_OPTIMIZATION
): SVGOptimizationReport {
  const savingsPercent = estimateSVGOptimizationSavings(svgSize, options);
  const estimatedOptimizedSize = svgSize * (1 - savingsPercent / 100);

  return {
    originalSize: svgSize,
    estimatedOptimizedSize: Math.round(estimatedOptimizedSize),
    estimatedSavings: Math.round(svgSize - estimatedOptimizedSize),
    savingsPercent,
  };
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * Print optimization report to console
 */
export function printSVGOptimizationReport(
  report: SVGOptimizationReport,
  svgName: string = 'SVG'
): void {
  console.log(`
╔════════════════════════════════════════╗
║  SVG Optimization Report: ${svgName.padEnd(24)}║
╠════════════════════════════════════════╣
║  Original Size:        ${formatBytes(report.originalSize).padStart(20)} │
║  Optimized Size:       ${formatBytes(report.estimatedOptimizedSize).padStart(20)} │
║  Savings:              ${formatBytes(report.estimatedSavings).padStart(20)} │
║  Reduction:            ${`${report.savingsPercent.toFixed(1)}%`.padStart(20)} │
╚════════════════════════════════════════╝
  `);
}

/**
 * SVG-as-Image vs SVG-as-Component Trade-offs
 *
 * SVG as <img> (smaller, simpler):
 * - ~20% smaller (no React wrapper)
 * - No interactivity
 * - Better caching
 * - Faster render
 *
 * SVG as React Component (larger, flexible):
 * - ~20% larger (React wrapper + dynamic props)
 * - Full interactivity
 * - CSS styling support
 * - Animation support
 */

export interface SVGUsageOptimization {
  staticIcons: {
    recommendation: string;
    format: 'img' | 'component';
    typicalSaving: number;
  };
  interactiveGraphics: {
    recommendation: string;
    format: 'component';
    typicalSaving: number;
  };
  largeIllustrations: {
    recommendation: string;
    format: 'img';
    typicalSaving: number;
  };
}

export const SVG_USAGE_OPTIMIZATION: SVGUsageOptimization = {
  staticIcons: {
    recommendation: 'Use <img> or CSS background for pure visual icons (no interactivity)',
    format: 'img',
    typicalSaving: 20,
  },
  interactiveGraphics: {
    recommendation: 'Use React components for interactive charts, diagrams, and visualizations',
    format: 'component',
    typicalSaving: 0, // No saving, trade-off for functionality
  },
  largeIllustrations: {
    recommendation: 'Use <img> with webp/avif formats for large illustrations',
    format: 'img',
    typicalSaving: 40,
  },
};

/**
 * SVG Optimization Checklist for developers
 */
export const SVG_OPTIMIZATION_CHECKLIST = [
  '☐ Use @svgr/webpack to automatically optimize SVGs at build time',
  '☐ Remove unnecessary attributes (id, class, data-*) that are not needed',
  '☐ Use <img> tags for simple, non-interactive SVGs',
  '☐ Group related icons to reduce duplication',
  '☐ Consider using CSS for simple shapes instead of SVGs',
  '☐ Optimize path data: use 2-3 decimal precision instead of 8+',
  '☐ Remove whitespace and unnecessary elements from SVG files',
  '☐ Test rendering after optimization to ensure quality',
  '☐ Use gzip compression for all SVG transfers',
  '☐ Consider WebP/AVIF formats for complex raster images',
];
