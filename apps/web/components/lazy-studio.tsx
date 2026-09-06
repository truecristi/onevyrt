/**
 * Lazy-loaded studio components
 *
 * This file demonstrates route-based code splitting for heavy studio components.
 * Components are only loaded when their corresponding route is accessed, reducing
 * initial bundle size by ~150-200KB.
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Lazy loading with error boundaries
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <p className="mt-4 text-gray-600">Loading studio components...</p>
    </div>
  </div>
);

// Large studio components - lazy loaded
export const LazyFunnelCanvasBuilder: ComponentType<any> = dynamic(
  () => import('../components/funnel-builder/FunnelCanvasBuilder').then(mod => ({ default: mod.FunnelCanvasBuilder })),
  {
    loading: LoadingFallback,
    ssr: false, // Canvas-based components don't need SSR
  }
);

export const LazyInspectorPanels: ComponentType<any> = dynamic(
  () => import('../components/studio/InspectorPanels').then(mod => ({ default: mod.InspectorTabs })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

export const LazyReportPanels: ComponentType<any> = dynamic(
  () => import('../components/studio/ReportPanels').then(mod => ({ default: mod.ReportView })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

export const LazySimulatePanels: ComponentType<any> = dynamic(
  () => import('../components/studio/SimulatePanels').then(mod => ({ default: mod.SimulatePanel })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

// Large programme/funnel education components
export const LazyFunnelCalculator: ComponentType<any> = dynamic(
  () => import('../components/funnel-education/FunnelCalculator').then(mod => ({ default: mod.FunnelCalculator })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

export const LazyDropoffAnalysis: ComponentType<any> = dynamic(
  () => import('../components/funnel-education/DropoffAnalysis').then(mod => ({ default: mod.DropoffAnalysis })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

export const LazyQualificationWizard: ComponentType<any> = dynamic(
  () => import('../components/qualify/QualificationWizard').then(mod => ({ default: mod.QualificationWizard })),
  {
    loading: LoadingFallback,
    ssr: false,
  }
);

// LazyProgramCentre/LazyProgrammeCentre used to live here too, but were
// never actually imported anywhere — the real app renders
// ProgramCentre.tsx/ProgrammeCentre.tsx directly
// (app/psychology/business-intelligence/page.tsx, app/funnel-studio.tsx).
// Removed as dead code; see docs/PERFORMANCE.md/docs/BUNDLE_OPTIMIZATION.md's
// matching correction.

/**
 * Usage in a route:
 *
 * import { LazyFunnelCanvasBuilder } from '@/components/lazy-studio';
 *
 * export default function StudioPage() {
 *   return <LazyFunnelCanvasBuilder />;
 * }
 *
 * This ensures a large component is only loaded when its route is
 * accessed, not in the initial bundle.
 */
