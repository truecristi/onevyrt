"use client";
/**
 * The Studio's top bar for the home and library screens, extracted from
 * funnel-studio.tsx (task #8, split slice 3). Pure render — no hooks — so
 * behaviour is identical to the inline renderTopBar; the Studio passes the live
 * values/handlers as props (tsc verifies every one).
 */
import type { ReactNode } from "react";
import { BrandMark as AppLogoMark } from "../BrandLogo";
import { NotificationBell } from "../NotificationBell";
import { MarketingIcon } from "../MarketingIcons";
import { TriNav } from "./HomeWidgets";
import { HeaderMenu, MenuItem } from "./header-menu";
import { barGhost, ACCENT } from "../../lib/studio-ui";
import { NAV_SECTION_DEFAULT } from "../../lib/studio/funnel-constants";
import type { Mode } from "../../lib/studio/types";
import type { Ws } from "./studio-internal";
import { CANONICAL_ROUTES } from "../../lib/navigation/canonical-routes";

export interface StudioTopBarProps {
  /** Fired when the "Start" nav is picked (home = no-op, library returns home). */
  onStart: () => void;
  user: { email: string; superAdmin?: boolean };
  workspaces: Ws[];
  activeWsId: string;
  setActiveWsId: (id: string) => void;
  /** The Guided/Pro mode switch, rendered by the Studio and passed through. */
  modeSwitch: ReactNode;
  theme: "light" | "dark";
  toggleTheme: () => void;
  setMode: (m: Mode) => void;
  setView: (v: "library" | "canvas" | "home") => void;
  onProgramme: () => void;
  onAccount: () => void;
  onSubscription: () => void;
  onLogout: () => void;
}

const menuIcon: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8 };

export function StudioTopBar({
  onStart, user, workspaces, activeWsId, setActiveWsId, modeSwitch, theme, toggleTheme,
  setMode, setView, onProgramme, onAccount, onSubscription, onLogout,
}: StudioTopBarProps) {
  return (
    <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {/* Logo → Home (proposal §3): the mark and wordmark link to the Command
          Center, the one signed-in Home. */}
      <a href={CANONICAL_ROUTES.home} title="Dashboard" aria-label="Dashboard"
        style={{ display: "flex", alignItems: "center", gap: 9, marginRight: "auto", textDecoration: "none", color: "inherit" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <AppLogoMark size={26} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.6 }}>ONEVYRT</div>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>Know if your funnel makes money — before you spend</div>
        </div>
      </a>
      <TriNav active="start" onPick={(s) => { if (s === "start") { onStart(); return; } setMode(NAV_SECTION_DEFAULT[s]); setView("canvas"); }} />
      {workspaces.length > 1 && (
        <select aria-label="Active workspace" value={activeWsId} onChange={(e) => setActiveWsId(e.target.value)}
          style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 7, padding: "5px 8px", fontSize: 13 }}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {modeSwitch}
      <button onClick={toggleTheme} style={{ ...barGhost, display: "inline-flex", alignItems: "center" }} title="Theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}><MarketingIcon name={theme === "dark" ? "sun" : "moon"} size={16} /></button>
      {user.superAdmin && (
        <span title="Instance super-admin: every feature and plan capability, on every workspace, without changing this workspace's plan."
          style={{ fontSize: 11, fontWeight: 700, color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 5, padding: "2px 6px", letterSpacing: 0.4 }}>{"★"} SUPER ADMIN</span>
      )}
      <span style={{ fontSize: 11, color: "var(--dim)" }}>{user.email}</span>
      {/* Cross-product destinations folded into one overflow menu (audit Phase 2
          — "fold sprawling one-button-per-action toolbars into a single
          control"). Kept reachable here because the Studio is its own nav
          island (no global AppNav), just no longer four competing buttons. */}
      <HeaderMenu label="More" title="More tools & sections">
        <MenuItem onClick={onProgramme} title="Programme"><span style={menuIcon}><MarketingIcon name="book" size={15} /> Programme</span></MenuItem>
        <MenuItem onClick={() => { window.location.href = CANONICAL_ROUTES.campaignStudioBrand; }} title="Campaign Studio — AI brand, creatives & campaigns"><span style={menuIcon}><MarketingIcon name="campaigns" size={15} /> Campaign Studio</span></MenuItem>
        <MenuItem onClick={() => { window.location.href = CANONICAL_ROUTES.business; }} title="Business OS — reality, drivers, constraint, execution, launch, review"><span style={menuIcon}><MarketingIcon name="compass" size={15} /> Business OS</span></MenuItem>
        {user.superAdmin && <MenuItem onClick={() => { window.location.href = CANONICAL_ROUTES.admin; }} title="Admin"><span style={menuIcon}><MarketingIcon name="gear" size={15} /> Admin</span></MenuItem>}
      </HeaderMenu>
      <button onClick={onAccount} style={{ ...barGhost, display: "inline-flex", alignItems: "center" }} title="Account settings" aria-label="Account settings"><MarketingIcon name="gear" size={16} /></button>
      <button onClick={onSubscription} style={{ ...barGhost, display: "inline-flex", alignItems: "center" }} title="Subscription" aria-label="Subscription"><MarketingIcon name="card" size={16} /></button>
      <NotificationBell />
      <button onClick={onLogout} style={barGhost}>Sign out</button>
    </div>
  );
}
