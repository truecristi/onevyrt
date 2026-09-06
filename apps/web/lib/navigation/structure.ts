/**
 * Navigation structure — the single canonical source for ONEVYRT's navigable
 * surface (Wave 1 Lane 1 spec, docs/SPEC-WAVE1-LANE1-NAVIGATION.md §3). Every
 * nav-shaped surface (UnifiedNav's sidebar/top bar/mobile menu, a future
 * GlobalCommandPalette, breadcrumbs, RBAC checks) is meant to read FROM here
 * instead of each keeping its own copy of "what are the sections" and "who
 * can see them" — the exact drift the spec's §2.3 flagged between AppNav's
 * TABS array and lib/nav-commands.ts's NAV_COMMANDS.
 *
 * All route hrefs and match patterns are derived from CANONICAL_ROUTES
 * (canonical-routes.ts), the single source of truth for application URLs.
 * This prevents routing inconsistencies (e.g. the coaching tab pointing
 * to a deprecated route instead of the canonical one).
 *
 * Pure data + pure functions: no React, no fetch, no storage. Nothing here
 * ENFORCES access — a `hiddenFor` entry is a navigation-visibility hint, not
 * a security boundary. Every route still gates itself server-side exactly as
 * it does today (lib/auth.ts's currentUser, lib/admin.ts's isAdminEmail,
 * lib/workspaces.ts's membership checks) — this module never computes a
 * role, it only reacts to one a caller already resolved.
 *
 * NOT wired into components/AppNav.tsx / GlobalCommandPalette.tsx yet — that
 * swap is Wave 3 (spec §3.3, §5 checklist). This module and its consumers
 * (components/navigation/UnifiedNav, hooks/useNavigation,
 * components/navigation/ProgressIndicator) are Wave 2 foundation only.
 */
import { CANONICAL_ROUTES } from "./canonical-routes";
import { NAV_COMMANDS } from "../nav-commands";
import type { MarketingIconName } from "../../components/MarketingIcons";

/** A learner's relationship to the platform. Never stored as a field on the
 *  user record — a Wave 3 caller derives it the same way the rest of the app
 *  already does: admin = isAdminEmail(user.email) (lib/admin.ts), coach =
 *  listCohortsForCoach(user.id).length > 0 (lib/cohorts.ts), else "learner".
 *  This module only consumes the result. */
export type UserRole = "learner" | "coach" | "admin";

/** Visual grouping — the thin dividers between clusters of sections (spec
 *  §1.2's "Home | Programme · My Business · Coaching | Resources"). "admin"
 *  is new here: the three /admin/* pages have never had a nav presence
 *  (components/AppNav.tsx's account menu links to /admin directly and only
 *  for isAdminEmail() users) — see ADMIN_SECTIONS below. */
export type NavGroup = "home" | "work" | "grow" | "admin";

export type RouteMatcher = (pathname: string) => boolean;

/** Shared by NavSection and NavPage: something that can be hidden from
 *  certain roles in NAVIGATION only. Absent/empty = visible to everyone. */
interface RoleGated {
  hiddenFor?: readonly UserRole[];
}

export interface NavSection extends RoleGated {
  id: string;
  label: string;
  icon: MarketingIconName;
  href: string;
  /** Route patterns that keep this section active. By convention (see the
   *  "mutually exclusive matches" test) exactly one NAV_SECTIONS entry
   *  claims any given pathname, mirroring AppNav's existing `match` set. */
  match: RouteMatcher;
  group: NavGroup;
  /** Replace this section's href for one role (e.g. a coach's "My Business"
   *  eventually landing on their own workspace) — undefined for a role means
   *  "use `href`" (spec §3.2). Not populated for any section yet; the field
   *  exists so a later wave can add an override without a shape change. */
  hrefFor?: Partial<Record<UserRole, string>>;
  /** Whether this section's hub carries a curriculum position worth showing
   *  via ProgressIndicator — Home's next-action CTA and the Programme
   *  journey both do; the rest have no chapter/step to report. */
  showsProgress?: boolean;
}

/**
 * The canonical five navigation sections (Wave 1 spec §1.2, §3.2) — all hrefs
 * and patterns derived from CANONICAL_ROUTES to ensure consistency across the
 * application (preventing the coaching tab from pointing to a deprecated route,
 * for example). Match patterns include both canonical and legacy aliases
 * (e.g., /psychology, /numbers, /execution for the programme section) to
 * maintain backward compatibility with existing deep-links.
 *
 * Swapping AppNav over to this module (Wave 3) changes nothing about where any
 * existing link lands. The one behavioural addition is `hiddenFor` on Coaching,
 * exactly as the spec's own §3.2 example specifies — dormant until a Wave 3
 * caller actually passes a role through (AppNav today shows Coaching to everyone;
 * see spec §2.1.1).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "home", label: "Home", icon: "home", href: CANONICAL_ROUTES.home, group: "home", showsProgress: true,
    match: (p) => p === "/" || p === "/app" || p.startsWith(CANONICAL_ROUTES.home),
  },
  {
    id: "programme", label: "Programme", icon: "book", href: CANONICAL_ROUTES.programme, group: "work", showsProgress: true,
    match: (p) => p.startsWith(CANONICAL_ROUTES.programme) || p.startsWith("/psychology") || p.startsWith("/numbers") || p.startsWith("/execution") || p.startsWith("/start"),
  },
  {
    id: "business", label: "My Business", icon: "plan", href: CANONICAL_ROUTES.business, group: "work",
    match: (p) => p === CANONICAL_ROUTES.business || p.startsWith(CANONICAL_ROUTES.business + "/") || p === "/my-business" || p.startsWith("/my-business/"),
  },
  {
    id: "coaching", label: "Coaching", icon: "message", href: CANONICAL_ROUTES.coaching, group: "work", hiddenFor: ["learner"],
    match: (p) => p === CANONICAL_ROUTES.coaching || p.startsWith(CANONICAL_ROUTES.coaching + "/") || p === "/businesses" || p.startsWith("/businesses/"),
  },
  {
    id: "resources", label: "Resources", icon: "rocket", href: CANONICAL_ROUTES.studio, group: "grow",
    match: (p) => p === CANONICAL_ROUTES.studio || p.startsWith(CANONICAL_ROUTES.campaignStudio) || p.startsWith(CANONICAL_ROUTES.community) || p.startsWith(CANONICAL_ROUTES.glossary),
  },
];

/**
 * The three real /admin/* pages (app/admin, app/admin/curriculum,
 * app/admin/learners) — today reachable only via a conditional link buried
 * in AppNav's account menu, never surfaced as first-class nav. This is the
 * "admin sections" half of this module's brief: kept as their own list
 * rather than folded into the five-tab bar, since they're an operator
 * console, not a learner-journey destination — a caller (UnifiedNav) renders
 * them as a separate, clearly-divided group only for roles that can see them.
 * All hrefs derived from CANONICAL_ROUTES for consistency.
 */
export const ADMIN_SECTIONS: readonly NavSection[] = [
  {
    id: "admin-overview", label: "Admin", icon: "gear", href: CANONICAL_ROUTES.admin, group: "admin", hiddenFor: ["learner", "coach"],
    match: (p) => p === CANONICAL_ROUTES.admin,
  },
  {
    id: "admin-curriculum", label: "Curriculum", icon: "book", href: CANONICAL_ROUTES.adminCurriculum, group: "admin", hiddenFor: ["learner", "coach"],
    match: (p) => p.startsWith(CANONICAL_ROUTES.adminCurriculum),
  },
  {
    id: "admin-learners", label: "Learners", icon: "audiences", href: CANONICAL_ROUTES.adminLearners, group: "admin", hiddenFor: ["learner", "coach"],
    match: (p) => p.startsWith(CANONICAL_ROUTES.adminLearners),
  },
];

/** Every section this module knows about — for lookups that don't care
 *  which list an id came from (see matchSection's default below). */
export const ALL_SECTIONS: readonly NavSection[] = [...NAV_SECTIONS, ...ADMIN_SECTIONS];

export interface NavPage extends RoleGated {
  id: string;
  title: string;
  href: string;
  /** The NavSection this page is filed under. */
  sectionId: string;
  keywords: readonly string[];
  /** True for pages under the Programme section — the only ones a curriculum
   *  position applies to. */
  showsProgress: boolean;
}

const SECTION_ID_BY_LABEL: ReadonlyMap<string, string> = new Map(NAV_SECTIONS.map((s) => [s.label, s.id]));

/**
 * Every searchable destination inside the five sections, DERIVED from the
 * existing lib/nav-commands.ts rather than re-typed here — the "NAV_COMMANDS
 * should be generated from TABS or vice versa" fix the spec calls for
 * (§2.3, §5 checklist), so a page's section membership, RBAC, and progress
 * visibility can never drift from which tab it actually lives under. A
 * command whose `section` label doesn't match a known NavSection is dropped
 * rather than silently mis-filed — see the well-formedness test, which also
 * asserts this never actually happens.
 */
export const NAV_PAGES: readonly NavPage[] = NAV_COMMANDS
  .map((c): NavPage | null => {
    const sectionId = c.section ? SECTION_ID_BY_LABEL.get(c.section) : undefined;
    if (!sectionId) return null;
    const section = NAV_SECTIONS.find((s) => s.id === sectionId);
    return {
      id: c.id,
      title: c.title,
      href: c.href,
      sectionId,
      keywords: c.keywords ?? [],
      showsProgress: sectionId === "programme",
      ...(section?.hiddenFor ? { hiddenFor: section.hiddenFor } : {}),
    };
  })
  .filter((p): p is NavPage => p !== null);

/** True when `item` is visible in navigation for `role` — an absent/empty
 *  `hiddenFor` means visible to everyone. Visibility only; never the actual
 *  access check (see the module doc comment). */
export function isVisibleTo(item: RoleGated, role: UserRole): boolean {
  return !item.hiddenFor?.includes(role);
}

/** The sections `role` sees in the primary nav, in canonical order. */
export function visibleSections(role: UserRole): NavSection[] {
  return NAV_SECTIONS.filter((s) => isVisibleTo(s, role));
}

/** This role's real href for a section: `hrefFor[role]` when the section
 *  defines one, else its default `href` (spec §3.2's per-role override). */
export function sectionHref(section: NavSection, role: UserRole): string {
  return section.hrefFor?.[role] ?? section.href;
}

/**
 * Which section "owns" a pathname, regardless of role — matched against
 * every section (including admin) by default, so a direct visit to a
 * role-hidden route still resolves to a real section instead of none; the
 * separate isVisibleTo/visibleSections checks are what actually hide a tab
 * from the rendered bar. Returns null only when no section claims the route
 * at all (e.g. a bare marketing page) — callers should treat that as "no
 * active tab," not an error.
 */
export function matchSection(pathname: string, sections: readonly NavSection[] = ALL_SECTIONS): NavSection | null {
  return sections.find((s) => s.match(pathname)) ?? null;
}

export const WORKSPACE_PARAM = "ws";

/**
 * Appends/overwrites `?ws=<workspaceId>` on `href`, preserving any other
 * query string and hash the caller already put there. This is the fix for
 * the bug the "Preserve ?ws= workspace scoping" commit (3215264) had to
 * patch by hand at every call site in app/business/page.tsx — a
 * workspace-aware nav should never need that done again per-link.
 * `workspaceId` falsy (no workspace context) returns `href` unchanged,
 * matching the existing "absent = personal workspace" convention that
 * page's own `wsQuery` already establishes.
 */
export function withWorkspaceParam(href: string, workspaceId: string | null | undefined): string {
  if (!workspaceId) return href;
  const hashIndex = href.indexOf("#");
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const qIndex = path.indexOf("?");
  const base = qIndex === -1 ? path : path.slice(0, qIndex);
  const query = qIndex === -1 ? "" : path.slice(qIndex + 1);
  const params = new URLSearchParams(query);
  params.set(WORKSPACE_PARAM, workspaceId);
  return `${base}?${params.toString()}${hash}`;
}
