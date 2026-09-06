# Wave 1 Lane 1 Spec: Navigation Audit & Canonical Source

**Status**: Complete audit | **Date**: 2026-09-02 | **Target**: Phase 2 unified navigation component

---

## 1. Current Architecture

### 1.1 Navigation Entry Points

The app's navigation is **unified through a single persistent component** (`AppNav.tsx`) mounted in every major section layout:

- **Root layout** (`app/layout.tsx`) — global theme/font setup, no nav
- **Section layouts** — all section routes mount identical shell:
  - `app/studio/layout.tsx`, `app/programme/layout.tsx`, `app/business/layout.tsx`, etc.
  - Pattern: `<ToastProvider><AppNav /><main id="main-content">...</main></ToastProvider>`
  - **13 section layouts** confirmed following this pattern

### 1.2 The Persistent Navigation Bar (AppNav)

**File**: `components/AppNav.tsx` (262 lines)

**Components within AppNav**:
1. **Primary nav tabs** — The "canonical five" (TABS array):
   - Home → `/command-center` (matches `/`, `/app`, `/command-center/*`)
   - Programme → `/programme` (matches `/programme/*`, `/psychology/*`, `/numbers/*`, `/execution/*`, `/start/*`)
   - My Business → `/business` (matches `/business`, `/business/*`)
   - Coaching → `/businesses` (matches `/businesses`, `/businesses/*`)
   - Resources → `/studio` (matches `/studio`, `/campaign-studio/*`, `/community/*`, `/glossary/*`)

2. **Brand logo** — OneVYRT mark + text (links to `/`)

3. **Global command palette** (`GlobalCommandPalette.tsx`)
   - Hotkey: ⌘K / Ctrl+K
   - Feeds 62 commands from `lib/nav-commands.ts` into a fuzzy-search overlay
   - Sections mirror the five tabs (ensures command section always matches active tab)

4. **Theme toggle** — Light/dark switcher (reads/writes `[data-theme]` attribute + localStorage `gb-theme`)

5. **Account menu**:
   - Fetches user email + avatar from `/api/auth/me`
   - Shows: email, "My businesses & clients", "Account & workspace", "Subscription & billing", sign-out
   - Links workspace access only via `/studio?panel=account`

6. **Lesson context strip** (conditional):
   - Appears when `?lesson=<moduleId>` query param present
   - Shows breadcrumb: "You're working on a programme module" + back button
   - Back link: `/programme/lesson/{lesson}`

### 1.3 Route Structure

**Canonical routes** (from `lib/nav-commands.ts` and AppNav TABS):

| Section | Primary | Nested | Status |
|---------|---------|--------|--------|
| Home | `/command-center` | `/command-center/insights` | ✅ Implemented |
| Programme | `/programme` | `/programme/lesson/*`, `/start/*` | ✅ Implemented (old pillars aliased below) |
| — | `/psychology/*` | Psychology pillar lessons | 🔗 Aliased to Programme |
| — | `/numbers/*` | Numbers pillar lessons | 🔗 Aliased to Programme |
| — | `/execution/*` | Execution pillar lessons | 🔗 Aliased to Programme |
| My Business | `/business` | `/business/reality`, `/business/drivers`, `/business/constraint`, etc. | ✅ Implemented |
| Coaching | `/businesses` | `/businesses/{businessId}` | ✅ Implemented |
| Resources | `/studio` | `/campaign-studio/*`, `/community`, `/glossary` | ✅ Implemented |

### 1.4 Progress Display

**Source of truth**: `packages/engine/src/programme-nav.ts`

**Key interfaces**:
- `ProgrammeMap` — full learner state (current stage, current lesson, per-stage completion %)
- `NextAction` — what the learner should do next (CTA label + href)
- `buildProgrammeMap()` — computes map from curriculum + enrollment
- `nextAction()` — computes primary action for Home/Dashboard

**Components using progress**:
- `components/ProgrammeJourney.tsx` — renders full map with chapter gates and lesson statuses
- `components/LessonGuide.tsx` — individual module with status lifecycle (locked → available → in_progress → submitted → review → approved/completed)
- `components/CommandCentre.tsx` (implied, not audited) — should use `nextAction()` to drive Home CTA

**Data flow**:
1. Learner lands on programme page
2. Component fetches `/api/programme/enrollment`
3. Passes enrollment + curriculum to `buildProgrammeMap()`
4. Map drives render: chapter status, lesson badges, lock gates
5. Lesson context param (`?lesson=`) added by lesson-guide link (line 127 in LessonGuide)

---

## 2. Problems Identified

### 2.1 Navigation Inconsistencies

1. **Hardcoded role treatment** — AppNav shows same five tabs to all users (learner, coach, admin)
   - Coach users see "My Business" pointing at `/business` (their own business)
   - Coach users see "Coaching" pointing at `/businesses` (client portfolio)
   - No distinction in nav based on role → confusing IA for coaches
   - Solution: Tab labels/href should be role-aware

2. **Old pillar aliasing creates ambiguity** — Three match predicates in AppNav point different old routes to "Programme":
   ```tsx
   match: (p) => p.startsWith("/psychology") || p.startsWith("/numbers") || p.startsWith("/execution")
   ```
   - Old deep links (e.g., `/psychology/golden`) still work but no explicit redirect
   - If a pillar page is bookmarked before the renaming, the link silently resolves to Programme tab
   - New users don't see these routes; old cohorts do → inconsistent IA

3. **Lesson context strip is URL-dependent and fragile** — `LessonContextStrip` only renders when:
   - `window.location.search` contains `?lesson=<moduleId>`
   - If a learner navigates away and back without the param, the breadcrumb disappears
   - No server-side lesson context propagation → relies on client-side param passing

4. **No progress visibility in the nav bar** — AppNav shows tab+icon but not:
   - Overall journey % complete
   - Current chapter name/progress
   - Next action label
   - These live only in Command Centre or Programme Journey page

### 2.2 Workspace/Business Context Gaps

1. **Workspace switching buried in account menu** — Only path to switch workspace:
   - Click avatar → "Account & workspace" → `/studio?panel=account`
   - No quick switcher in nav for coaches juggling multiple businesses
   - No indicator of current workspace/business in nav

2. **"My Business" href is static (`/business`)** — Doesn't respect selected workspace
   - Coaches switch workspace in Studio settings but nav doesn't follow
   - Deep links to `/business/reality` etc. might belong to a different workspace

### 2.3 Navigation Command Consistency

1. **NAV_COMMANDS mirrors AppNav tabs** (good) but lives in separate file
   - If a new tab is added to AppNav, the command array must be updated separately
   - No type-level guarantee that commands match tabs
   - Solution: NAV_COMMANDS should be generated from TABS or vice versa

2. **Section names in commands vs. tabs**:
   - AppNav `group` field drives visual dividers (home | work | grow)
   - NAV_COMMANDS `section` field is the five-tab names
   - No mapping between the two → future refactors risk mismatch

---

## 3. Proposed Unified Navigation Component

### 3.1 New Canonical Structure

Instead of AppNav reading static TABS array + NAV_COMMANDS separately, introduce a **Navigation Configuration** that is:
- **Single source of truth** for all navigation
- **Role-aware** (learner vs. coach vs. admin)
- **Workspace-aware** (current business context)
- **Centrally defined** so tabs, commands, and breadcrumbs all derive from it

### 3.2 Data Structure

```typescript
// lib/navigation.ts — New canonical source

export type UserRole = "learner" | "coach" | "admin";

export interface NavSection {
  id: string;
  label: string;
  icon: MarketingIconName;
  href: string;
  /** Route patterns that keep this tab active. */
  match: (pathname: string) => boolean;
  /** Visual grouping (home | work | grow). */
  group: "home" | "work" | "grow";
  /** Hide from nav for given roles (undefined = show all). */
  hiddenFor?: UserRole[];
  /** Replace href for specific role (undefined = use default). */
  hrefFor?: Partial<Record<UserRole, string>>;
}

export interface NavigationConfig {
  /** The five canonical sections. */
  sections: NavSection[];
  /** All searchable destinations (⌘K). */
  commands: NavCommand[];
  /** Current workspace context (null if no business selected). */
  currentWorkspaceId: string | null;
  currentWorkspaceName: string | null;
}

export function getNavigationConfig(
  role: UserRole,
  workspaceId?: string,
): NavigationConfig {
  // Derive sections, hide/modify based on role
  // Inject workspace context into commands
  // Return unified config
}

export const SECTIONS_BASE: NavSection[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    href: "/command-center",
    group: "home",
    match: (p) => p === "/" || p === "/app" || p.startsWith("/command-center"),
  },
  {
    id: "programme",
    label: "Programme",
    icon: "book",
    href: "/programme",
    group: "work",
    match: (p) => p.startsWith("/programme") || p.startsWith("/start"),
  },
  {
    id: "business",
    label: "My Business",
    icon: "plan",
    href: "/business",
    group: "work",
    match: (p) => p === "/business" || p.startsWith("/business/"),
    // Coaches see this as "Client: {name}" with workspace switcher
    hiddenFor: [],
  },
  {
    id: "coaching",
    label: "Coaching",
    icon: "message",
    href: "/businesses",
    group: "work",
    match: (p) => p === "/businesses" || p.startsWith("/businesses/"),
    hiddenFor: ["learner"], // Only coaches & admins
  },
  {
    id: "resources",
    label: "Resources",
    icon: "rocket",
    href: "/studio",
    group: "grow",
    match: (p) => p === "/studio" || p.startsWith("/campaign-studio") || p.startsWith("/community") || p.startsWith("/glossary"),
  },
];
```

### 3.3 Integration Points

**AppNav refactoring** (Phase 2, Wave 2):
- Replace hardcoded TABS with `getNavigationConfig()` call
- Render tabs from config, respecting role + workspace
- Account menu can access config for workspace switcher links

**GlobalCommandPalette refactoring**:
- Draw commands from config rather than separate NAV_COMMANDS
- Type-safe guarantee that palette matches nav

**LessonContextStrip enhancement**:
- Patch lesson context via parent context provider (not URL param alone)
- Fallback to URL param for deep links, but prefer context

### 3.4 Data for Navigation State

**What AppNav needs to receive** (via context or props):
1. `currentUserRole: UserRole` — from auth/me endpoint
2. `currentWorkspaceId?: string` — from account settings or workspace selector
3. `currentLessonContext?: { moduleId: string; moduleName: string }` — from ProgrammeJourney or LessonGuide context
4. `currentProgress?: { percent: number; stage: string }` — from `buildProgrammeMap()` result

**Where to store**:
- User role: Already in `/api/auth/me` response (fetch on mount)
- Workspace: Session storage or React Context (already selected by user in Studio settings)
- Lesson context: React Context provider wrapping programme pages
- Progress: Can be passed down from route-level data fetches

---

## 4. Chapter 4 Integration Points

**Placeholder**: This spec assumes Chapter 4 (Progress & Enrollment System) will provide:
- Real-time progress updates to AppNav (% complete, current stage)
- Workspace/business context manager (which business is "current"?)
- Role-based nav adjustments (coach vs. learner UI)

**Link to Chapter 4 work**:
- Request that Chapter 4's enrollment/progress API exports `ProgrammeMap` or computes it server-side
- Request workspace context be available early in request lifecycle (not just in Studio settings)
- If Chapter 4 implements role-based UI anywhere else, align nav role handling there

---

## 5. Implementation Checklist (Wave 2)

- [ ] Create `lib/navigation.ts` with `NavigationConfig` interface + `getNavigationConfig()` function
- [ ] Migrate AppNav TABS array into SECTIONS_BASE + move to navigation.ts
- [ ] Fetch user role from existing `/api/auth/me` endpoint (already done, no new API needed)
- [ ] Add workspace context provider (integrate with existing account selector if available)
- [ ] Refactor AppNav to render sections from config, passing role + workspace
- [ ] Refactor GlobalCommandPalette to derive commands from navigation config
- [ ] Implement lesson context provider for programme pages (wrap ProgrammeJourney, LessonGuide)
- [ ] Update LessonContextStrip to read from context (with URL param fallback)
- [ ] Test that each role (learner, coach, admin) sees correct tabs and commands
- [ ] Verify old pillar routes (psychology, numbers, execution) still resolve without breaking nav

---

## 6. Key Metrics / Success Criteria

- ✅ **Single source of truth**: Nav sections, commands, and role rules defined once
- ✅ **Type-safe**: Config changes don't require updating multiple components
- ✅ **Role-aware**: Learner/coach/admin see different nav, no confusion
- ✅ **Workspace-aware**: Coach can see which business they're in + quick switcher
- ✅ **Progress visible**: Nav bar or Home hint shows overall % or current stage
- ✅ **Backward compatible**: Old pillar links still work but redirect cleanly

---

## 7. Files Modified / Created

**New**:
- `docs/SPEC-WAVE1-LANE1-NAVIGATION.md` (this file)
- `lib/navigation.ts` (Phase 2)

**Modified**:
- `components/AppNav.tsx` (Phase 2)
- `components/GlobalCommandPalette.tsx` (Phase 2)
- `lib/nav-commands.ts` (merge into navigation.ts, Phase 2)

**Analyzed** (no changes needed):
- `app/*/layout.tsx` (13 files) — all follow identical correct pattern
- `packages/engine/src/programme-nav.ts` — already canonical, use as-is
- `components/ProgrammeJourney.tsx` — already uses correct progress model

---

## Appendix A: All Navigation Sources Audited

| File | Type | Purpose | Status |
|------|------|---------|--------|
| `app/layout.tsx` | Layout | Root; sets theme + global providers | ✅ Root setup |
| `app/app/layout.tsx` | Layout | Legacy `/app` alias for studio | ✅ Uses AppNav |
| `app/studio/layout.tsx` | Layout | Creative studio | ✅ Uses AppNav |
| `app/programme/layout.tsx` | Layout | Journey hub | ✅ Uses AppNav |
| `app/business/layout.tsx` | Layout | Business OS | ✅ Uses AppNav |
| `app/psychology/layout.tsx` | Layout | Pillar 1 (aliased to programme) | ✅ Uses AppNav |
| `app/numbers/layout.tsx` | Layout | Pillar 2 (aliased to programme) | ✅ Uses AppNav |
| `app/execution/layout.tsx` | Layout | Pillar 3 (aliased to programme) | ✅ Uses AppNav |
| `app/start/layout.tsx` | Layout | Guided journey onboarding | ✅ Uses AppNav |
| `app/glossary/layout.tsx` | Layout | Definitions reference | ✅ Uses AppNav |
| `app/community/layout.tsx` | Layout | Community hub (Resources) | ✅ Uses AppNav |
| `app/campaign-studio/layout.tsx` | Layout | Campaigns (Resources) | ✅ Uses AppNav |
| `app/businesses/layout.tsx` | Layout | Coaching portfolio | ✅ Uses AppNav |
| `app/command-center/layout.tsx` | Layout | Home / dashboard | ✅ Uses AppNav |
| `components/AppNav.tsx` | Component | Persistent nav + account menu + command palette | ✅ Canonical |
| `components/GlobalCommandPalette.tsx` | Component | ⌘K overlay | ✅ Uses NAV_COMMANDS |
| `lib/nav-commands.ts` | Data | 62 searchable navigation targets | ✅ Mirrors tabs |
| `packages/engine/src/programme-nav.ts` | Engine | Progress map builder (LEARNER_MENU vs. web AppNav TABS) | ⚠️ Small mismatch |

**Note**: Engine's `LEARNER_MENU` uses slightly different labels/icons than web AppNav TABS (e.g., `/` vs. `/command-center`). Spec Phase 2 should align these.
