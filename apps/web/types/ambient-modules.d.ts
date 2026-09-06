/**
 * Ambient declarations for optional, not-yet-installed dependencies.
 *
 * This file has NO top-level import/export, which keeps it in TypeScript's
 * "global script" mode — that's what makes `declare module "x"` here count
 * as declaring a brand-new ambient module. The same declaration written
 * inside an ordinary module file (one with its own imports/exports) would
 * instead be treated as *augmenting* an existing module of that name, which
 * TypeScript rejects when the named package can't actually be resolved
 * ("Invalid module name in augmentation, module 'x' cannot be found").
 *
 * Used by lib/performance.ts's on-demand `import('web-vitals')` /
 * `import('react-quill')` (see CLAUDE.md's Performance Optimization
 * Strategy: "apps/web/package.json — May need to add web-vitals
 * dependency"). Installing the real packages later needs no changes here —
 * the shapes below match their real public APIs — this file just stops
 * being necessary at that point.
 */
declare module "web-vitals" {
  export interface Metric {
    name: string;
    value: number;
    delta: number;
    id: string;
    rating?: string;
  }
  export function getCLS(onReport: (metric: Metric) => void): void;
  export function getFID(onReport: (metric: Metric) => void): void;
  export function getFCP(onReport: (metric: Metric) => void): void;
  export function getLCP(onReport: (metric: Metric) => void): void;
  export function getTTFB(onReport: (metric: Metric) => void): void;
}

declare module "react-quill";
