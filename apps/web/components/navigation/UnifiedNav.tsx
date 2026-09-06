"use client";
/**
 * UnifiedNav — Wave 2 Lane 1 foundation task #1: the single navigation
 * component every section is meant to mount once Wave 3 swaps it in for
 * components/AppNav.tsx (docs/SPEC-WAVE1-LANE1-NAVIGATION.md §3.3). This
 * file only builds and exports it — it is NOT wired into any
 * app/*\/layout.tsx yet.
 *
 * Renders three surfaces from one navigation model (lib/navigation/structure.ts)
 * and one state hook (hooks/useNavigation.ts), so "what's in the nav" can
 * never drift between them:
 *  - a top bar (brand, mobile hamburger, compact progress, workspace
 *    selector) — always present;
 *  - a desktop sidebar — a vertical rail, hidden below the mobile breakpoint;
 *  - a mobile menu — a dropdown panel shown only while the hook's `isOpen`
 *    is true, hidden at desktop widths.
 * The sidebar and the mobile menu render from the exact same section list.
 *
 * Rendered links are plain <a> tags targeting real app routes, not a
 * client-side router push — the convention every other nav surface in this
 * app already uses (AppNav, ProgrammeJourney, the Business-OS hub's own
 * links). That matters here specifically: several pages (e.g.
 * app/business/page.tsx) resolve `?ws=` once, during their own first render,
 * rather than reactively — a soft client-side transition into one of them
 * would carry over whatever workspace state was already in memory, while a
 * real navigation always re-reads the URL fresh. `?ws=` itself is preserved
 * on every link via withWorkspaceParam, so switching sections never drops a
 * coach out of the client workspace they were looking at (the bug the
 * "Preserve ?ws= workspace scoping" commit, 3215264, otherwise has to be
 * re-fixed by hand at each new call site).
 *
 * This component does not fetch anything itself (no user, no workspace list,
 * no progress) — it is purely presentational over the four props below, so
 * it's equally usable from a server-rendered layout that already resolved
 * that data and a client one that's still loading it.
 */
import { useEffect, useId } from "react";
import { MarketingIcon } from "../MarketingIcons";
import { BrandMark } from "../BrandLogo";
import { useNavigation, type NavProgressState } from "../../hooks/useNavigation";
import {
  ADMIN_SECTIONS, isVisibleTo, sectionHref, withWorkspaceParam,
  type NavSection, type UserRole,
} from "../../lib/navigation/structure";
import { ProgressIndicator } from "./ProgressIndicator";

export interface NavWorkspaceOption {
  id: string;
  name: string;
}

export interface UnifiedNavProps {
  /** The active pathname (e.g. usePathname() in the caller's layout). */
  currentRoute: string;
  userRole: UserRole;
  /** The workspace currently in context. Omit (`undefined`) to let the nav
   *  infer it from `?ws=` on the live URL; pass `null` to say explicitly
   *  that there is none (don't guess). */
  workspaceId?: string | null;
  /** The engine's progress view-model — omit where there's no curriculum
   *  position to show (e.g. the admin console). */
  progressState?: NavProgressState | null;
  /** Present only for a multi-workspace user (typically a coach juggling
   *  several client businesses) — with two or more entries, a workspace
   *  selector renders in the top bar and the mobile menu. A single entry (or
   *  none) renders no selector: there is nothing to switch between. */
  workspaces?: NavWorkspaceOption[];
  /** Called instead of the default full-page reload when the visitor picks a
   *  different workspace. Omit to just reload the current route under the
   *  new workspace — the safe default (see handleWorkspaceChange below for
   *  why a hard reload, not a soft navigate, is deliberate here). */
  onWorkspaceChange?: (workspaceId: string) => void;
}

function SectionLink({ section, role, workspaceId, active, onClick }: {
  section: NavSection;
  role: UserRole;
  workspaceId: string | null;
  active: boolean;
  onClick?: () => void;
}) {
  const href = withWorkspaceParam(sectionHref(section, role), workspaceId);
  return (
    <a href={href} className={`un-link${active ? " active" : ""}`} data-section={section.id} aria-current={active ? "page" : undefined} onClick={onClick}>
      <span className="un-ic"><MarketingIcon name={section.icon} className="un-svg" /></span>
      <span className="un-label">{section.label}</span>
    </a>
  );
}

function WorkspaceSelector({ workspaces, workspaceId, onChange, id }: {
  workspaces: NavWorkspaceOption[];
  workspaceId: string | null;
  onChange: (id: string) => void;
  id: string;
}) {
  return (
    <div className="un-ws">
      <label className="un-ws-label" htmlFor={id}>Workspace</label>
      <select id={id} className="un-ws-select" value={workspaceId ?? ""} onChange={(e) => onChange(e.target.value)}>
        {!workspaceId && <option value="" disabled>Choose a workspace…</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </div>
  );
}

export function UnifiedNav({
  currentRoute, userRole, workspaceId, progressState = null, workspaces = [], onWorkspaceChange,
}: UnifiedNavProps) {
  const { currentSection, sections, isOpen, toggleMenu, closeMenu, workspaceId: resolvedWorkspaceId } =
    useNavigation({ currentRoute, role: userRole, workspaceId });
  const wsSelectId = useId();

  // Escape closes the mobile menu — the one keyboard affordance a dropdown
  // panel needs beyond a visible close control, which the hamburger already
  // is (same aria-expanded toggle either way).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeMenu]);

  const adminSections = ADMIN_SECTIONS.filter((s) => isVisibleTo(s, userRole));
  const showProgress = Boolean(progressState) && (currentSection?.showsProgress ?? false);

  const handleWorkspaceChange = (nextId: string) => {
    if (!nextId || nextId === resolvedWorkspaceId) return;
    if (onWorkspaceChange) { onWorkspaceChange(nextId); return; }
    // A hard reload, not the hook's navigate(): several pages resolve `?ws=`
    // once during their own first render rather than reactively (see this
    // file's doc comment) — only a real navigation guarantees the
    // destination re-reads it under the newly-selected workspace.
    if (typeof window !== "undefined") window.location.assign(withWorkspaceParam(currentRoute, nextId));
  };

  const renderSectionList = (list: readonly NavSection[], onLinkClick?: () => void) => (
    <ul className="un-list">
      {list.map((s) => (
        <li key={s.id}>
          <SectionLink section={s} role={userRole} workspaceId={resolvedWorkspaceId} active={currentSection?.id === s.id} onClick={onLinkClick} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <style>{CSS}</style>
      <a className="un-skip" href="#main-content">Skip to main content</a>

      <header className="un-topbar">
        <button
          type="button" className="un-hamburger" aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen} onClick={toggleMenu}
        >
          <span aria-hidden="true"><span className="un-hamburger-bar" /><span className="un-hamburger-bar" /><span className="un-hamburger-bar" /></span>
        </button>
        <a className="un-brand" href={withWorkspaceParam("/", resolvedWorkspaceId)} title="OneVYRT home">
          <BrandMark size={22} interactive />ONE<span>VYRT</span>
        </a>
        {showProgress && (
          <div className="un-topbar-progress">
            <ProgressIndicator map={progressState?.map ?? null} nextAction={progressState?.nextAction ?? null} variant="compact" />
          </div>
        )}
        {workspaces.length > 1 && (
          <div className="un-topbar-ws">
            <WorkspaceSelector workspaces={workspaces} workspaceId={resolvedWorkspaceId} onChange={handleWorkspaceChange} id={`${wsSelectId}-top`} />
          </div>
        )}
      </header>

      <nav className="un-sidebar" aria-label="Primary">
        {renderSectionList(sections)}
        {adminSections.length > 0 && (
          <>
            <div className="un-divider" role="separator" aria-hidden="true" />
            {renderSectionList(adminSections)}
          </>
        )}
      </nav>

      {isOpen && (
        <>
          <div className="un-backdrop" onClick={closeMenu} aria-hidden="true" />
          <div className="un-mobile" role="dialog" aria-modal="true" aria-label="Navigation menu">
            {workspaces.length > 1 && (
              <WorkspaceSelector workspaces={workspaces} workspaceId={resolvedWorkspaceId} onChange={handleWorkspaceChange} id={`${wsSelectId}-mobile`} />
            )}
            {renderSectionList(sections, closeMenu)}
            {adminSections.length > 0 && (
              <>
                <div className="un-divider" role="separator" aria-hidden="true" />
                {renderSectionList(adminSections, closeMenu)}
              </>
            )}
            {progressState && (
              <div className="un-mobile-progress">
                <ProgressIndicator map={progressState.map} nextAction={progressState.nextAction} variant="full" />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

const CSS = `
.un-skip{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;z-index:200;}
.un-skip:focus{position:fixed;left:12px;top:12px;width:auto;height:auto;overflow:visible;
  padding:10px 16px;background:var(--ds-brand-solid,#0891b2);color:#fff;border-radius:8px;font-weight:700;font-size:13px;
  text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:var(--ds-font,system-ui,sans-serif);}

.un-topbar,.un-sidebar,.un-mobile{
  --un-bg:rgba(255,255,255,.82);--un-fg:#111827;--un-muted:#475569;
  --un-hover:#f1f4f9;--un-active-bg:#ecf8fa;--un-active-fg:#0e7490;
  --un-border:#e8ecf2;--un-divider:#e2e8f0;
  font-family:var(--ds-font,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif);
}
:root[data-theme="dark"] .un-topbar,:root[data-theme="dark"] .un-sidebar,:root[data-theme="dark"] .un-mobile{
  --un-bg:rgba(17,23,38,.72);--un-fg:#f1f5f9;--un-muted:#94a3b8;
  --un-hover:#1c2436;--un-active-bg:#0e3d48;--un-active-fg:#22d3ee;
  --un-border:rgba(148,163,184,.14);--un-divider:rgba(148,163,184,.18);
}

/* Section-specific colors for visual hierarchy */
.un-link[data-section="home"] { --un-link-color: #0891b2; }
.un-link[data-section="programme"] { --un-link-color: #2563eb; }
.un-link[data-section="business"] { --un-link-color: #16a34a; }
.un-link[data-section="coaching"] { --un-link-color: #d97706; }
.un-link[data-section="resources"] { --un-link-color: #8b5cf6; }

.un-topbar{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:9px 16px;background:var(--un-bg);backdrop-filter:saturate(200%) blur(22px);-webkit-backdrop-filter:saturate(200%) blur(22px);
  border-bottom:1px solid var(--un-border);color:var(--un-fg);}
.un-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;gap:4px;
  width:34px;height:34px;border-radius:9px;border:1px solid var(--un-border);background:transparent;cursor:pointer;flex:none;padding:0;}
.un-hamburger-bar{display:block;width:16px;height:2px;border-radius:1px;background:var(--un-fg);}
.un-brand{display:inline-flex;align-items:center;gap:7px;font-size:15px;font-weight:700;letter-spacing:.5px;
  color:var(--ds-brand,#088057);text-decoration:none;white-space:nowrap;flex:none;}
.un-brand span{color:var(--un-fg);}
.un-topbar-progress{flex:1 1 160px;min-width:110px;max-width:280px;}
.un-topbar-ws{flex:none;margin-left:auto;}

.un-sidebar{display:none;flex-direction:column;gap:10px;width:220px;flex:none;padding:14px 10px;
  position:sticky;top:60px;align-self:flex-start;max-height:calc(100vh - 60px);overflow-y:auto;
  background:var(--un-bg);border-right:1px solid var(--un-border);color:var(--un-fg);}
.un-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;}
.un-divider{height:1px;background:var(--un-divider);margin:4px;flex:none;}

.un-link{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;text-decoration:none;
  color:var(--un-muted);font-size:13.5px;font-weight:500;white-space:nowrap;
  transition:background .16s var(--ds-ease,ease),color .16s var(--ds-ease,ease);}
.un-link:hover{background:var(--un-hover);color:var(--un-fg);}
.un-link.active{background:var(--un-active-bg);color:var(--un-active-fg);font-weight:600;}
.un-link:focus-visible{outline:2px solid var(--un-link-color,#0891b2);outline-offset:1px;}
.un-ic{display:inline-flex;color:currentColor;}
.un-svg{display:block;opacity:.9;}
.un-link.active .un-svg{opacity:1;}

.un-ws{display:flex;flex-direction:column;gap:3px;min-width:140px;}
.un-ws-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--un-muted);}
.un-ws-select{font:inherit;font-size:12.5px;padding:6px 8px;border-radius:8px;border:1px solid var(--un-border);
  background:var(--ds-surface,#fff);color:var(--un-fg);}

.un-backdrop{position:fixed;inset:0;z-index:39;background:rgba(15,23,42,.4);}
.un-mobile{position:fixed;left:0;right:0;top:60px;z-index:41;max-height:calc(100vh - 60px);overflow-y:auto;
  padding:16px;display:flex;flex-direction:column;gap:14px;background:var(--un-bg);backdrop-filter:saturate(200%) blur(24px);
  -webkit-backdrop-filter:saturate(200%) blur(24px);border-bottom:1px solid var(--un-border);
  box-shadow:0 20px 48px -12px rgba(15,23,42,.3);color:var(--un-fg);}
.un-mobile .un-link{font-size:15px;padding:12px 14px;}
.un-mobile-progress{padding:12px;border-radius:12px;background:var(--ds-bg-subtle,#f1f4f9);}

@media (max-width:768px){ .un-hamburger{display:flex;} }
@media (min-width:769px){ .un-sidebar{display:flex;} }
`;
