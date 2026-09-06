/**
 * Lazy-Loaded Components Registry
 *
 * Comprehensive component lazy-loading strategy with:
 * - Route-based code splitting for large components
 * - Error boundaries with fallbacks
 * - Prefetching hints for critical paths
 * - Loading state indicators
 *
 * Strategy:
 * 1. Studio components (canvas, builders) - only load on demand
 * 2. Education components (calculators, visualizations) - lazy load
 * 3. Coach/review panels - lazy load
 * 4. Heavy third-party components - separate chunks
 *
 * Total potential savings: 150-250 KB
 */

import dynamic from 'next/dynamic';

/**
 * Loading fallback component
 */
export const LazyLoadingFallback = () => (
  <div className="flex items-center justify-center w-full h-full p-8">
    <div className="text-center">
      <div className="inline-flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
      <p className="mt-4 text-sm text-gray-600">Loading component...</p>
    </div>
  </div>
);

/**
 * Error fallback component
 */
export const LazyErrorFallback = ({ error }: { error?: Error }) => (
  <div className="flex items-center justify-center w-full h-full p-8">
    <div className="text-center">
      <div className="text-red-500 text-4xl mb-2">⚠️</div>
      <p className="text-sm text-gray-600">Failed to load component</p>
      {error && <p className="text-xs text-gray-400 mt-2">{error.message}</p>}
    </div>
  </div>
);

// ============================================================================
// STUDIO COMPONENTS (Largest, route-specific)
// ============================================================================

/**
 * Funnel Canvas Builder (~150 KB unpacked)
 * Only loaded when user navigates to /studio
 */
export const LazyFunnelCanvasBuilder = dynamic(
  () => import('./funnel-builder/FunnelCanvasBuilder').then(mod => ({ default: mod.FunnelCanvasBuilder })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

/**
 * Inspector Panels - property inspector for canvas elements
 */
export const LazyInspectorPanels = dynamic(
  () => import('./studio/InspectorPanels').then(mod => ({ default: mod.InspectorTabs })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

/**
 * Report Panels - analytics and reporting
 */
export const LazyReportPanels = dynamic(
  () => import('./studio/ReportPanels').then(mod => ({ default: mod.ReportView })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

/**
 * Simulate Panels - funnel simulation and testing
 */
export const LazySimulatePanels = dynamic(
  () => import('./studio/SimulatePanels').then(mod => ({ default: mod.SimulatePanel })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

// ============================================================================
// EDUCATION & FUNNEL COMPONENTS
// ============================================================================

/**
 * Funnel Calculator - interactive ROI calculator (~50 KB)
 * Used in /programme/lesson routes
 */
export const LazyFunnelCalculator = dynamic(
  () => import('./funnel-education/FunnelCalculator').then(mod => ({ default: mod.FunnelCalculator })),
  {
    loading: LazyLoadingFallback,
    ssr: true, // Can be SSR'd for better SEO
  }
);

/**
 * Dropoff Analysis - funnel visualization and metrics
 */
export const LazyDropoffAnalysis = dynamic(
  () => import('./funnel-education/DropoffAnalysis').then(mod => ({ default: mod.DropoffAnalysis })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

/**
 * Qualification Wizard - multi-step lead qualification
 */
export const LazyQualificationWizard = dynamic(
  () => import('./qualify/QualificationWizard').then(mod => ({ default: mod.QualificationWizard })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

// ============================================================================
// COACH & PROGRAMME COMPONENTS
// ============================================================================

// LazyProgramCentre/LazyProgrammeCentre used to live here (and in
// lazy-studio.tsx) but were never actually imported anywhere — the real
// app renders ProgramCentre.tsx/ProgrammeCentre.tsx directly
// (app/psychology/business-intelligence/page.tsx, app/funnel-studio.tsx),
// contradicting this file's own "route-based code splitting" claim for
// them. Removed as dead code rather than left as misleading unlazy-loaded
// scaffolding; see docs/PERFORMANCE.md/docs/BUNDLE_OPTIMIZATION.md's
// matching correction.

/**
 * Growth Improvement Plan - Chapter 4 artifact viewer
 */
export const LazyGrowthImprovementPlan = dynamic(
  () => import('./programme/GrowthImprovementPlan'),
  {
    loading: LazyLoadingFallback,
    ssr: true,
  }
);

// ============================================================================
// ANALYTICS & DASHBOARD COMPONENTS
// ============================================================================

/**
 * Member Progress Dashboard - coach admin dashboard
 */
export const LazyMemberProgressDashboard = dynamic(
  () => import('./admin/MemberProgressDashboard').then(mod => ({ default: mod.MemberProgressDashboard })),
  {
    loading: LazyLoadingFallback,
    ssr: false,
  }
);

// ============================================================================
// UTILITY: PREFETCH HINTS
// ============================================================================

/**
 * Generate prefetch hints for common navigation patterns
 * Add to <Head> in critical routes to warm up chunks
 *
 * Usage:
 * <head>
 *   <link rel="prefetch" href={getPrefetchHint('studio')} />
 * </head>
 */
export function getPrefetchHint(route: string): string {
  const hints: Record<string, string> = {
    studio: '/_next/static/chunks/studio-*.js',
    programme: '/_next/static/chunks/programme-*.js',
    coaching: '/_next/static/chunks/coaching-*.js',
    campaign: '/_next/static/chunks/campaign-*.js',
    funnel: '/_next/static/chunks/libs-heavy-*.js', // jsPDF, @xyflow
  };
  return hints[route] || '';
}

/**
 * Prefetch multiple routes
 *
 * Usage in a component:
 * useEffect(() => {
 *   prefetchRoutes(['studio', 'campaign']);
 * }, []);
 */
export function prefetchRoutes(routes: string[]) {
  if (typeof window === 'undefined') return;

  routes.forEach(route => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = getPrefetchHint(route);
    document.head.appendChild(link);
  });
}

// ============================================================================
// EXPORT ALL FOR CONVENIENCE
// ============================================================================

export const LAZY_COMPONENTS = {
  // Studio
  FunnelCanvasBuilder: LazyFunnelCanvasBuilder,
  InspectorPanels: LazyInspectorPanels,
  ReportPanels: LazyReportPanels,
  SimulatePanels: LazySimulatePanels,

  // Education
  FunnelCalculator: LazyFunnelCalculator,
  DropoffAnalysis: LazyDropoffAnalysis,
  QualificationWizard: LazyQualificationWizard,

  // Coach & Programme
  GrowthImprovementPlan: LazyGrowthImprovementPlan,

  // Analytics
  MemberProgressDashboard: LazyMemberProgressDashboard,
};
