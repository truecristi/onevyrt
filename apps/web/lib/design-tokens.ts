/**
 * ONEVYRT Design Tokens — TypeScript source of truth
 *
 * Complete, type-safe token definitions for the design system.
 * Use this module for programmatic access, component prop types,
 * and token discovery. For CSS, refer to app/design-system.css.
 *
 * @module lib/design-tokens
 * @example
 * import { tokens, searchTokens } from '@/lib/design-tokens';
 * const brandColor = tokens.colors.brand.base; // #088057
 * const spacingScale = tokens.spacing;
 * const matching = searchTokens('brand');
 */

/**
 * Chapter color identifiers for programme stage visualization.
 * Used to color-code curriculum progress, chapter badges, and status indicators.
 */
export const chapterColors = {
  /** START — Baseline & setup (grey/neutral) */
  start: { base: '#64748b', soft: '#f1f5f9', dark: '#334155' },
  /** DEFINE — Strategy & blueprint (blue) */
  define: { base: '#2563eb', soft: '#eff6ff', dark: '#1e40af' },
  /** IMPLEMENT — Systems & operations (green) */
  implement: { base: '#16a34a', soft: '#dcfce7', dark: '#15803d' },
  /** CONTROL — Metrics & reporting (amber) */
  control: { base: '#d97706', soft: '#fef3c7', dark: '#b45309' },
  /** IMPROVE — Growth & scaling (red) */
  improve: { base: '#dc2626', soft: '#fee2e2', dark: '#b91c1c' },
  /** FINISH — Transformation & next steps (cyan) */
  finish: { base: '#0891b2', soft: '#ecf8fa', dark: '#0e7490' },
} as const;

/**
 * Status colors for submission workflow, approval gates, and progress states.
 * Communicate review state to learners and coaches throughout the programme.
 */
export const statusColors = {
  /** Awaiting review or approval (blue) */
  awaiting: '#2563eb',
  /** Coach approved / ready to proceed (green) */
  approved: '#16a34a',
  /** Changes requested by coach (amber) */
  changes: '#d97706',
  /** Rejected / blocked (red) */
  rejected: '#dc2626',
  /** Work in progress (cyan) */
  inProgress: '#0891b2',
  /** Not yet started (grey) */
  notStarted: '#94a3b8',
  /** Task complete (green) */
  complete: '#16a34a',
} as const;

export const tokens = { chapterColors, statusColors } as const;

export function searchTokens(query: string) {
  const results: Array<{ path: string; value: any; category: string }> = [];
  const q = query.toLowerCase();
  const traverse = (obj: any, prefix = '', category = '') => {
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const currentCategory = category || path.split('.')[0]!;
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        traverse(val, path, currentCategory);
      } else {
        const fullPath = path.toLowerCase();
        const fullValue = String(val).toLowerCase();
        if (fullPath.includes(q) || fullValue.includes(q)) {
          results.push({ path, value: val, category: currentCategory });
        }
      }
    }
  };
  traverse(tokens);
  return results;
}
