"use client";
/**
 * AppNav — the one persistent navigation across the ONEVYRT surfaces, so the
 * app reads as a single product rather than separate tools. Organised around
 * the LEARNER'S journey (Phase 2 spec §1): the canonical five —
 * Home | Programme · My Business · Coaching | Resources. The old task tabs
 * (Foundation/Check/Launch/Sell/Improve) and the Psychology/Numbers/Execution
 * pillars fold into these; their tools stay reachable underneath. Each tab lands
 * on a real route and stays highlighted across the routes that live under it;
 * the `match` predicates are mutually exclusive so exactly one tab is active.
 *
 * Self-contained (its own styles + inline marketing icon set — deliberately not
 * emoji), mounted via the per-section layouts so it appears on every page.
 * Colours are token-driven and the whole thing follows the app-wide light/dark
 * switch (rendered here at the far right), which sets [data-theme] on <html>.
 *
 * Navigation definition is derived from lib/navigation/structure.ts — the single
 * canonical source of truth for ONEVYRT's navigable surface (see Wave 1 spec).
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandLogo";
import { MarketingIcon, type MarketingIconName } from "./MarketingIcons";
import GlobalCommandPalette from "./GlobalCommandPalette";
import { NAV_SECTIONS, visibleSections, type NavSection, type UserRole } from "../lib/navigation/structure";
import { CANONICAL_ROUTES } from "../lib/navigation/canonical-routes";
import { saveThemeMode, applyThemeMode, getCurrentTheme } from "../lib/theme-mode";

interface Tab { label: string; icon: MarketingIconName; href: string; group: string; match: (p: string) => boolean; }

// Build TABS from the canonical structure.ts — no duplication, single source of truth
// This will be filtered by role once the user is fetched in AccountMenu
const TABS: Tab[] = NAV_SECTIONS.map((section: NavSection) => ({
  label: section.label,
  icon: section.icon,
  href: section.href,
  group: section.group,
  match: section.match,
}));

/**
 * Account menu — the sign-out / account control that the persistent nav was
 * missing, so every signed-in AppNav page (Command Centre, business hubs) has
 * a way to sign out rather than that living only inside the Studio shell.
 * Takes the user role as a prop (computed by AppNav's useCurrentUser).
 * Shows an initial avatar and a dropdown with the email + Sign out. Signed-out
 * (401) renders nothing.
 */
function AccountMenu({ userRole: _userRole }: { userRole: UserRole | null }) {
  const [me, setMe] = useState<{ email: string; avatarUrl?: string; superAdmin?: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && typeof d.email === "string") setMe({ email: d.email, avatarUrl: d.avatarUrl, superAdmin: d.superAdmin === true }); })
      .catch(() => { /* signed out or offline — render nothing */ });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  if (!me) return null;
  const initial = (me.email[0] || "?").toUpperCase();
  const signOut = async () => {
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { /* clear locally anyway */ }
    window.location.assign("/");
  };
  return (
    <div className="an-acct" onClick={(e) => e.stopPropagation()}>
      <button className="an-acct-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="an-acct-av" /> : <span className="an-acct-av" aria-hidden>{initial}</span>}
      </button>
      {open && (
        <div className="an-acct-menu" role="menu">
          <div className="an-acct-email" title={me.email}>{me.email}</div>
          {me.superAdmin && <a className="an-acct-item" role="menuitem" href={CANONICAL_ROUTES.admin}>🛡️ Admin</a>}
          <a className="an-acct-item" role="menuitem" href={CANONICAL_ROUTES.coaching}>My businesses &amp; clients</a>
          <a className="an-acct-item" role="menuitem" href={CANONICAL_ROUTES.studioAccountSettings}>Account &amp; workspace</a>
          <a className="an-acct-item" role="menuitem" href={CANONICAL_ROUTES.studioSubscription}>Subscription &amp; billing</a>
          <button className="an-acct-item danger" role="menuitem" disabled={busy} onClick={() => void signOut()}>{busy ? "Signing out…" : "Sign out"}</button>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const read = () => setTheme(getCurrentTheme());
    read();
    // Other surfaces (e.g. settings modal, other components) may flip data-theme.
    // Observe it so this toggle's icon/label never go stale and its next click
    // always moves in the right direction.
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  const toggle = () => {
    // Use theme-mode utilities for consistent dark mode management across the app.
    const cur = getCurrentTheme();
    const next = cur === "dark" ? "light" : "dark";
    applyThemeMode(next);
    saveThemeMode(next);
    setTheme(next);
  };
  const isDark = theme === "dark";
  return (
    <button className="an-toggle" onClick={toggle} type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}>
      <MarketingIcon name={isDark ? "sun" : "moon"} size={17} />
    </button>
  );
}

/**
 * LessonContextStrip — when a founder opens a tool link from inside a
 * programme lesson, that link carries `?lesson=<moduleId>` (added at the
 * lesson-guide call site) so they need a way back to the lesson they came
 * from. usePathname() alone can't see query params, and reading them via
 * useSearchParams() would force this always-mounted nav under a <Suspense>
 * boundary on every section page — so read window.location.search directly
 * in an effect instead, re-reading whenever the route changes. Renders
 * nothing when the param is absent or empty, which is the common case on
 * every page not reached from a lesson.
 */
function LessonContextStrip({ pathname }: { pathname: string }) {
  const [lesson, setLesson] = useState<string | null>(null);
  useEffect(() => {
    setLesson(new URLSearchParams(window.location.search).get("lesson"));
  }, [pathname]);
  if (!lesson) return null;
  return (
    <div className="an-lesson">
      <span className="an-lesson-msg">
        <span className="an-ic"><MarketingIcon name="compass" className="an-svg" /></span>
        You're working on a programme module
      </span>
      <a className="an-lesson-back" href={`/programme/lesson/${encodeURIComponent(lesson)}`}>
        ← Back to your lesson
      </a>
    </div>
  );
}

const ROLE_CACHE_KEY = "an-role";

function isUserRole(v: string | null): v is UserRole {
  return v === "learner" || v === "coach" || v === "admin";
}

export function AppNav() {
  const pathname = usePathname() || "";
  // Always start at null — matching the server's render exactly, since SSR
  // has no window/sessionStorage to seed from. A PRIOR version of this read
  // sessionStorage synchronously inside the useState initializer; that
  // diverges from the server on a warm session (client sees a cached role,
  // server always sees null), a real hydration mismatch. React's recovery
  // from a bad-enough mismatch is to regenerate the whole tree client-side,
  // which was blowing away layout.tsx's pre-paint inline theme script's
  // manual `data-theme` mutation on <html> — the root cause of
  // e2e/axe.spec.ts's dark-mode tests failing in real CI (data-theme read
  // back as "light" after the test's addInitScript set it to "dark").
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let live = true;
    // Apply a same-session cache first — safe here (an effect only ever runs
    // client-side, after hydration has already committed the null-state
    // render, so this can't cause the mismatch above) — so a returning visit
    // still renders the correctly-filtered nav almost immediately instead of
    // waiting on /api/auth/me again, before that fetch confirms/corrects it.
    try {
      const cached = sessionStorage.getItem(ROLE_CACHE_KEY);
      if (isUserRole(cached)) setUserRole(cached);
    } catch { /* private mode etc. — cache is best-effort */ }

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && typeof d.role === "string") {
          setUserRole(d.role as UserRole);
          try { sessionStorage.setItem(ROLE_CACHE_KEY, d.role); } catch { /* private mode etc. — cache is best-effort */ }
        }
      })
      .catch(() => { /* signed out or offline — render no role-based filtering */ });
    return () => { live = false; };
  }, []);

  // Filter tabs based on user role: show only visible sections. Default to
  // showing every tab (not the most-restrictive role) while /api/auth/me is
  // still in flight and nothing is cached yet — tried defaulting to
  // "learner" instead, but that made a coach's very first page load in a
  // session wait on this fetch before Coaching (the one hiddenFor'd section)
  // appeared at all, breaking a real workflow, not just cosmetics: nav
  // visibility here is explicitly "a hint, not a security boundary" (see
  // lib/navigation/structure.ts's doc comment) — every route re-checks auth
  // server-side regardless of what this bar shows — so a brief, cosmetic,
  // self-correcting over-show on a COLD session is the cheaper failure mode
  // than a per-load latency hit on every WARM one. The sessionStorage cache
  // above is what actually fixes the original bug's frequency: once any
  // role has resolved once this session, every subsequent page load reads
  // the correct filtered list immediately, cold-start flash included.
  const visibleTabs = userRole
    ? TABS.filter((t) => visibleSections(userRole).some((s) => s.label === t.label))
    : TABS;

  return (
    <>
      <style>{CSS}</style>
      {/* Keyboard/screen-reader users can bypass the nav straight to the page's
          own content — invisible until it receives focus (first Tab stop on
          every page). Pairs with the <main id="main-content"> each section
          layout renders around its page. */}
      <a className="an-skip" href="#main-content">Skip to main content</a>
      <nav className="an-root" aria-label="Primary">
        <a className="an-brand" href="/" title="OneVYRT home"><BrandMark size={22} interactive />ONE<span>VYRT</span></a>
      <div className="an-tabs">
        {visibleTabs.map((t, i) => {
          const active = t.match(pathname);
          const newGroup = i > 0 && visibleTabs[i - 1]!.group !== t.group;
          return (
            <span className="an-cell" key={t.label}>
              {newGroup && <span className="an-div" aria-hidden="true" />}
              {/* aria-label is essential: at <=640px the .an-lbl text is
                  display:none and the icon is aria-hidden, so without this the
                  link would be nameless to screen readers on mobile. */}
              <a href={t.href} className={`an-tab ${active ? "active" : ""}`} aria-label={t.label} aria-current={active ? "page" : undefined}>
                <span className="an-ic"><MarketingIcon name={t.icon} className="an-svg" /></span>
                <span className="an-lbl">{t.label}</span>
              </a>
            </span>
          );
        })}
      </div>
      <GlobalCommandPalette />
      <ThemeToggle />
      <AccountMenu userRole={userRole} />
      </nav>
      {/* Sibling of <nav>, not nested in it — a slim second bar, shown only
          when a lesson param is present (see LessonContextStrip above). */}
      <LessonContextStrip pathname={pathname} />
    </>
  );
}

const CSS = `
.an-acct{position:relative;flex:none;}
.an-acct-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid var(--an-border,#e2e7f0);background:var(--an-bg,#fff);border-radius:999px;cursor:pointer;}
.an-acct-av{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:var(--ds-brand-solid,#088057);color:#fff;font-size:12px;font-weight:700;object-fit:cover;}
.an-acct-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:200px;background:var(--an-bg,#fff);border:1px solid var(--an-border,#e2e7f0);border-radius:12px;box-shadow:0 12px 32px rgba(20,30,25,.16);padding:6px;z-index:210;display:flex;flex-direction:column;gap:2px;}
.an-acct-email{font-size:12px;color:var(--an-muted,#586687);padding:6px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:1px solid var(--an-border,#e2e7f0);margin-bottom:2px;}
.an-acct-item{display:block;width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:8px 10px;font-size:13px;color:var(--an-fg,#1e2c46);cursor:pointer;text-decoration:none;font-family:inherit;}
.an-acct-item:hover{background:var(--an-hover,#f2f5fb);}
.an-acct-item.danger{color:var(--ds-danger,#c81e1e);}
.an-skip{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;z-index:200;}
.an-skip:focus{position:fixed;left:12px;top:12px;width:auto;height:auto;overflow:visible;
  padding:10px 16px;background:var(--ds-brand-solid);color:#fff;border-radius:8px;font-weight:700;font-size:13px;
  text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.an-root{
  --an-bg:rgba(255,255,255,.82);--an-fg:#111827;--an-muted:#475569;
  --an-hover:#f1f4f9;--an-active-bg:#e7f6f0;--an-active-fg:#0a7d57;
  --an-border:#e8ecf2;--an-divider:#e2e8f0;
  position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:12px;
  padding:9px 16px;background:var(--an-bg);backdrop-filter:saturate(200%) blur(22px);
  -webkit-backdrop-filter:saturate(200%) blur(22px);border-bottom:1px solid var(--an-border);
  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 6px 18px -12px rgba(15,23,42,.22);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .an-root{box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 6px 18px -12px rgba(0,0,0,.5);}
:root[data-theme="dark"] .an-root{
  --an-bg:rgba(17,23,38,.72);--an-fg:#f1f5f9;--an-muted:#94a3b8;
  --an-hover:#1c2436;--an-active-bg:#0e2b22;--an-active-fg:#3fd39e;
  --an-border:rgba(148,163,184,.14);--an-divider:rgba(148,163,184,.18);}
.an-brand{display:inline-flex;align-items:center;gap:7px;font-size:15px;font-weight:700;letter-spacing:.5px;color:var(--ds-brand);text-decoration:none;white-space:nowrap;flex:none;}
.an-brand span{color:var(--an-fg);}
.an-tabs{display:flex;align-items:center;gap:3px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;}
.an-tabs::-webkit-scrollbar{display:none;}
.an-cell{display:inline-flex;align-items:center;flex:none;}
.an-div{width:1px;height:18px;background:var(--an-divider);margin:0 7px;border-radius:1px;}
.an-tab{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:11px;text-decoration:none;
  color:var(--an-muted);font-size:13px;font-weight:500;white-space:nowrap;transition:background .16s var(--ds-ease,ease),color .16s var(--ds-ease,ease),box-shadow .16s ease;}
.an-tab:hover{background:var(--an-hover);color:var(--an-fg);}
.an-tab.active{background:var(--an-active-bg);color:var(--an-active-fg);box-shadow:0 1px 2px rgba(10,158,110,.12);}
.an-ic{display:inline-flex;color:currentColor;}
.an-svg{display:block;}
.an-tab .an-svg{opacity:.9;}
.an-tab.active .an-svg{opacity:1;}
.an-toggle{margin-left:auto;flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:34px;height:34px;border-radius:11px;border:1px solid var(--an-border);background:transparent;
  color:var(--an-muted);cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.an-toggle:hover{background:var(--an-hover);color:var(--an-fg);}
/* Lesson context strip — a sibling of .an-root, not a descendant, so it
   can't inherit --an-* custom properties scoped to .an-root above; it gets
   its own small scoped set instead, same pattern as .an-root itself.
   --ds-brand-soft is a global design-system token (flips with [data-theme]
   on its own), giving the "brand-soft" background the spec calls for; the
   foreground pairing reuses the same brand-on-soft colours as .an-tab.active
   for one consistent "soft brand" look across this nav. */
.an-lesson{
  --an-lesson-bg:var(--ds-brand-soft,#e7f6f0);--an-lesson-fg:#0a7d57;
  --an-lesson-border:#cdeee0;--an-lesson-hover:rgba(255,255,255,.5);
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;width:100%;box-sizing:border-box;
  padding:7px 16px;background:var(--an-lesson-bg);border-bottom:1px solid var(--an-lesson-border);
  color:var(--an-lesson-fg);font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);
  font-size:12.5px;}
:root[data-theme="dark"] .an-lesson{
  --an-lesson-fg:#3fd39e;--an-lesson-border:rgba(63,211,158,.28);--an-lesson-hover:rgba(255,255,255,.08);}
.an-lesson-msg{display:inline-flex;align-items:center;gap:8px;font-weight:600;}
.an-lesson-back{margin-left:auto;flex:none;display:inline-flex;align-items:center;
  padding:5px 10px;border-radius:8px;color:inherit;font-weight:700;text-decoration:none;
  white-space:nowrap;transition:background .14s var(--ds-ease,ease);}
.an-lesson-back:hover{background:var(--an-lesson-hover);text-decoration:underline;}
/* Mobile-first responsive navigation for small screens (375px–639px) */
@media(max-width:639px){
  .an-lbl{display:none;}
  .an-tab{padding:8px;min-height:44px;display:flex;align-items:center;justify-content:center;}
  .an-div{margin:0 3px;}
  .an-svg{width:19px;height:19px;}
  .an-root{padding:8px 12px;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .an-tabs{gap:2px;padding-right:8px;}
  .an-acct-btn{min-width:44px;min-height:44px;}
  .an-toggle{min-width:44px;min-height:44px;}
  .an-acct-menu{right:-4px;min-width:160px;font-size:12px;}
  .an-acct-email{font-size:11px;padding:5px 8px;}
  .an-acct-item{font-size:12px;padding:7px 8px;min-height:44px;display:flex;align-items:center;}
  .an-lesson{padding:6px 12px;font-size:12px;gap:6px 8px;}
  .an-lesson-back{margin-left:0;width:100%;min-height:44px;display:flex;align-items:center;}
  .an-lesson-msg{font-size:12px;}
  .an-svg{min-width:19px;}
}

/* Tablet and larger screens (640px+) */
@media(min-width:640px){
  .an-tab{min-height:auto;}
  .an-acct-btn{min-height:auto;}
  .an-toggle{min-height:auto;}
}
`;
