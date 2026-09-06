"use client";
/**
 * useNavigation — Wave 2 Lane 1 foundation task #2: the one hook that gives a
 * nav-shaped component its state (docs/SPEC-WAVE1-LANE1-NAVIGATION.md §3.4's
 * "what AppNav needs to receive" list). It layers three things on top of
 * lib/navigation/structure.ts's pure data:
 *   - which section the current route belongs to, and which sections a role
 *     is allowed to see;
 *   - mobile-menu open/closed state;
 *   - a workspace-aware `navigate()`, and the resolved workspace id itself.
 *
 * Not wired into any layout yet (Wave 3) — components/navigation/UnifiedNav
 * is the one component meant to consume it today, though it's a standalone
 * hook any client component can call directly.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { NextAction, ProgrammeMap } from "@onevyrt/engine";
import {
  matchSection, visibleSections, withWorkspaceParam, WORKSPACE_PARAM,
  type NavSection, type UserRole,
} from "../lib/navigation/structure";

/**
 * The engine's own progress view-model — exactly the `map`/`nextAction`
 * shape /api/programme/enrollment already returns (see
 * components/ProgrammeJourney.tsx's fetch of that route) — threaded through
 * this hook rather than re-derived, so navigation can never disagree with
 * the engine about a learner's position.
 */
export interface NavProgressState {
  map: ProgrammeMap | null;
  nextAction: NextAction | null;
}

export interface UseNavigationOptions {
  /** The active pathname. Defaults to the live route (usePathname()) — pass
   *  this when the caller already has it (e.g. UnifiedNav's own
   *  `currentRoute` prop) so the two can never disagree. */
  currentRoute?: string;
  /** Defaults to "learner" (the least-privileged role) when the caller
   *  hasn't resolved one yet. */
  role?: UserRole;
  /** Explicit workspace context. Omit (leave `undefined`) to have this hook
   *  infer it from the live URL's `?ws=` param (see readWorkspaceIdFromLocation
   *  below); pass `null` explicitly to mean "definitely no workspace, don't
   *  guess" instead. */
  workspaceId?: string | null;
  /** The engine progress view-model, if the caller has it. Omit where there
   *  is no curriculum position to show (e.g. a bare admin page). */
  progress?: NavProgressState | null;
}

export interface UseNavigationResult {
  /** The section the current route belongs to, or null if none claims it. */
  currentSection: NavSection | null;
  /** The sections `role` is allowed to see, in canonical order. */
  sections: NavSection[];
  isOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
  /**
   * Imperative, workspace-aware client-side navigation — `?ws=` is preserved
   * automatically (withWorkspaceParam), the fix for the bug the "Preserve
   * ?ws= workspace scoping" commit (3215264) had to patch by hand at every
   * call site. Uses next/navigation's router (a soft transition), the same
   * mechanism components/GlobalCommandPalette.tsx already uses for its
   * keyboard-driven jumps — UnifiedNav's own rendered links stay plain <a>
   * tags (see that component's doc comment for why a real link, not this,
   * is the right choice there); this is for imperative call sites.
   */
  navigate: (href: string) => void;
  /** The resolved workspace id (explicit option, else the URL's `?ws=`), or
   *  null when there is none. */
  workspaceId: string | null;
  progress: NavProgressState | null;
}

/** Reads `?ws=` off the live URL — same idea as the Business-OS hub's own
 *  `wsQuery` state (app/business/page.tsx). Unlike that page's lazy
 *  useState initializer, this is read inside an effect (see below) rather
 *  than during render: UnifiedNav's links are part of the persistent chrome
 *  rendered on the very first paint (not gated behind a loading state the
 *  way that page's are), so computing the real value during SSR/first-render
 *  would risk a hydration mismatch; reading it post-mount instead means both
 *  server and the client's first render agree (no workspace param yet), and
 *  the real value lands a moment later via ordinary state update. */
function readWorkspaceIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(WORKSPACE_PARAM);
}

export function useNavigation(options: UseNavigationOptions = {}): UseNavigationResult {
  const { currentRoute, role = "learner", workspaceId: explicitWorkspaceId, progress = null } = options;

  const livePathname = usePathname();
  const router = useRouter();
  const pathname = currentRoute ?? livePathname ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [urlWorkspaceId, setUrlWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    // Only sniff the URL when the caller hasn't told us explicitly — an
    // explicit `null` means "no workspace," not "go look."
    if (explicitWorkspaceId === undefined) setUrlWorkspaceId(readWorkspaceIdFromLocation());
  }, [pathname, explicitWorkspaceId]);

  // A route change closes the mobile menu — it should never stay open over
  // the page it just navigated to. Harmless (and unreachable) for the common
  // case of a full page load, which this app's <a> links normally cause
  // (every fresh mount starts with isOpen === false already); it matters for
  // navigate() below, which uses a soft router.push that keeps this hook's
  // state alive across the transition.
  useEffect(() => { setIsOpen(false); }, [pathname]);

  const workspaceId = explicitWorkspaceId ?? urlWorkspaceId;

  const toggleMenu = useCallback(() => setIsOpen((o) => !o), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const navigate = useCallback((href: string) => {
    setIsOpen(false);
    router.push(withWorkspaceParam(href, workspaceId));
  }, [router, workspaceId]);

  const currentSection = useMemo(() => matchSection(pathname), [pathname]);
  const sections = useMemo(() => visibleSections(role), [role]);

  return { currentSection, sections, isOpen, toggleMenu, closeMenu, navigate, workspaceId, progress };
}
