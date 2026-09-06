/**
 * Canonical routes for ONEVYRT — the single source of truth for all application
 * URLs. Every hardcoded route reference should import from this module.
 *
 * Route organization:
 * - Core entry points: /, /command-center, /studio, /app
 * - Learning: /programme
 * - Business OS: /business/*
 * - Coaching: /coaching, /businesses (deprecated)
 * - Resources: /campaign-studio, /community, /glossary
 * - Account: /account
 * - Admin: /admin/*
 *
 * Deprecated aliases (redirected to canonical):
 * - /app → /studio
 * - /businesses → /coaching
 *
 * Authentication redirects (in middleware):
 * - / (signed-in, no params) → /command-center
 */

export const CANONICAL_ROUTES = {
  /**
   * Home & Entry Points
   */
  home: "/command-center",
  studio: "/studio",
  // /app is a deprecated alias redirected to /studio
  // / is auth-aware: signed-out → sign-in, signed-in → /command-center

  /**
   * Learning & Curriculum
   */
  programme: "/programme",
  programmeChapter: (chapter: number) => `/programme/chapter-${chapter}` as const,
  programmeLesson: (lessonId: string) => `/programme/lesson/${lessonId}` as const,

  /**
   * Business OS (My Business)
   * /my-business is deprecated — see DEPRECATED_ROUTES below.
   */
  businessReality: "/business/reality",
  businessConstraint: "/business/constraint",
  // The 8-category business baseline (platform spec Section 2) — a periodic
  // full-business scorecard, distinct from businessConstraint's single
  // active-bottleneck declaration.
  businessDiagnostic: "/business/diagnostic",
  businessDrivers: "/business/drivers",
  businessExecution: "/business/execution",
  businessReview: "/business/review",
  businessFunnels: "/business/funnels",
  businessLeads: "/business/leads",
  businessSegments: "/business/segments",
  businessMessage: "/business/message",
  // The unified business profile — one place that shows the business facts
  // assembled from every store (definition + reality map + brand) via
  // assembleMyBusiness(). This is where the deprecated /my-business dashboard
  // now lives, inside the canonical /business namespace.
  businessProfile: "/business/profile",
  // Main business hub (resolves to reality or first unfinished lesson)
  business: "/business",

  /**
   * Coaching & Community (Coach-only features)
   */
  coaching: "/coaching",
  // /businesses is a deprecated alias redirected to /coaching
  coachingCohortsIndex: "/coaching/cohorts",
  coachingCohort: (cohortId: string) => `/coaching/cohorts/${cohortId}` as const,
  coachingStudio: "/studio?panel=coaching",

  /**
   * Resources, Tools & Learning Materials
   */
  resources: "/resources",
  campaignStudio: "/campaign-studio",
  campaignStudioBrand: "/campaign-studio/brand",
  campaignStudioWrite: "/campaign-studio/write",
  campaignStudioCreative: "/campaign-studio/creative",
  campaignStudioCampaigns: "/campaign-studio/campaigns",
  campaignStudioConnections: "/campaign-studio/connections",
  community: "/community",
  glossary: "/glossary",

  /**
   * Account & Settings
   */
  account: "/account",
  accountProfile: "/account/profile",
  accountSettings: "/account/settings",
  accountExport: "/account/export",
  accountDeletion: "/account/deletion",
  accountTransformationReport: "/account/transformation-report",
  studioAccountSettings: "/studio?panel=account",
  studioSubscription: "/studio?panel=subscription",

  /**
   * Admin Console (admin-only)
   */
  admin: "/admin",
  adminCurriculum: "/admin/curriculum",
  adminLearners: "/admin/learners",

  /**
   * Public & Onboarding
   */
  welcome: "/welcome",
  start: "/start",
  privacy: "/privacy",
  terms: "/terms",

  /**
   * Communities & Sharing
   */
  communityAuthor: (wsId: string) => `/community/u/${wsId}` as const,
  share: (shareId: string) => `/share/${shareId}` as const,
  funnelPreview: (slug: string) => `/q/${slug}` as const,
} as const;

/**
 * Route type for type-safe href usage. Use this when you need to pass
 * a dynamic route as a prop or store it in state.
 */
export type CanonicalRoute = typeof CANONICAL_ROUTES[keyof typeof CANONICAL_ROUTES];

/**
 * Deprecated routes and their canonical replacements.
 * Used by redirect middleware and redirect route handlers.
 *
 * Redirects (permanent 308s for SEO):
 * - /app → /studio (legacy alias, studio is canonical)
 * - /businesses → /coaching (route consolidation, coaching is canonical)
 * - /my-business → /business (route consolidation, business is canonical)
 */
export const DEPRECATED_ROUTES: Record<string, string> = {
  "/app": CANONICAL_ROUTES.studio,
  "/businesses": CANONICAL_ROUTES.coaching,
  "/my-business": CANONICAL_ROUTES.business,
} as const;

/**
 * Check if a route is deprecated and return its canonical replacement.
 * Returns null if the route is not in the deprecated list.
 */
export function getCanonicalRedirect(pathname: string): string | null {
  return DEPRECATED_ROUTES[pathname] ?? null;
}

/**
 * Prefix helper for adding workspace query parameter to routes that need it.
 * Example: withWorkspace("/business/funnels", "ws-123") → "/business/funnels?ws=ws-123"
 *
 * Note: This is different from lib/navigation/structure.ts's withWorkspaceParam
 * which does more sophisticated query string merging. This is a simpler helper
 * for one-off cases where you're building a route string manually.
 */
export function withWorkspace(route: string, workspaceId?: string): string {
  if (!workspaceId) return route;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}ws=${encodeURIComponent(workspaceId)}`;
}
