"use client";

import type { ReactNode } from "react";
import { ACCENT } from "../../lib/studio-ui";
import { NAV_SECTION_LABEL, type NavSection } from "../../lib/studio/types";

/** Fixed banner shown app-wide while an admin is impersonating someone —
 *  impossible to miss, since acting as another account without a visible
 *  reminder is exactly how "which account am I even in" mistakes happen. */
export function ImpersonationBanner({ email, onStop }: { email: string; onStop: () => void }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#7c2d12", color: "#fff", padding: "6px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
      <span>⚠ Impersonating <strong>{email}</strong> as an instance admin</span>
      <button onClick={onStop} style={{ background: "#fff", color: "#7c2d12", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Return to admin</button>
    </div>
  );
}

// --- Start / Run / Improve strip, shared by Home, Library and Canvas so the
// same three-way grouping is visible everywhere, not just on login. ---
export function TriNav({ active, onPick }: { active: NavSection | null; onPick: (s: NavSection) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 9, padding: 2, flexShrink: 0 }}>
      {(["start", "run", "improve"] as NavSection[]).map((s) => {
        const on = active === s;
        const meta = NAV_SECTION_LABEL[s];
        return (
          <button key={s} onClick={() => onPick(s)} title={meta.sub}
            style={{ background: on ? "var(--surface)" : "transparent", border: "none", borderRadius: 7, padding: "5px 13px", cursor: "pointer", textAlign: "left" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: on ? "var(--text)" : "var(--dim)" }}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Command Centre building blocks ---

// Foregrounds use the theme-aware semantic tokens so the pills clear WCAG AA in
// both light (darker fg) and dark (brighter fg) modes; the translucent bg tints
// work over either surface.
const PILL_TONE: Record<"good" | "warn" | "crit" | "neutral", { bg: string; fg: string }> = {
  good: { bg: "rgba(22,163,74,0.12)", fg: "var(--ds-success)" },
  warn: { bg: "rgba(217,119,6,0.12)", fg: "var(--ds-warning)" },
  crit: { bg: "rgba(220,38,38,0.12)", fg: "var(--ds-danger)" },
  neutral: { bg: "var(--surface2)", fg: "var(--dim)" },
};

export function HomeCard({ eyebrow, pill, span, children }: { eyebrow: string; pill?: { text: string; tone: "good" | "warn" | "crit" | "neutral" }; span?: number; children: ReactNode }) {
  const tone = pill ? PILL_TONE[pill.tone] : null;
  // Column span as a CSS class (not an inline gridColumn) so the
  // responsive breakpoints in theme-css.ts's .gb-home-grid rules can
  // override it at narrow widths — a plain inline "span 2" has no way to
  // become "span 1" on mobile without a media query, which is exactly
  // what forced the Command Centre's 4-column grid wider than a phone
  // screen could ever shrink to.
  return (
    <div className={span ? `gb-span-${span}` : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--dim)", textTransform: "uppercase" }}>{eyebrow}</div>
        {pill && tone && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>{pill.text}</span>}
      </div>
      {children}
    </div>
  );
}

export function AttnRow({ title, sub, crit, onClick }: { title: string; sub: string; crit?: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: crit ? "#dc2626" : "#d97706", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
      <button onClick={onClick} style={{ background: "transparent", border: "none", color: ACCENT, fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Open</button>
    </div>
  );
}

export function ReadinessRing({ score }: { score: number }) {
  const r = 21, c = 2 * Math.PI * r;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? ACCENT : score >= 35 ? "#d97706" : "#dc2626";
  return (
    <div style={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
      <svg width="50" height="50" viewBox="0 0 50 50" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--border3)" strokeWidth="5" />
        <circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, Math.max(0, score)) / 100) * c} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>{score}%</div>
    </div>
  );
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
