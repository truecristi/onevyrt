/**
 * MarketingIcons — the single inline line-style icon set for the product.
 * Deliberately NOT emoji: consistent 24-grid, currentColor, so the nav, the
 * Launch Studio and any surface stay visually one system. Import <MarketingIcon
 * name="funnel" /> anywhere; size + color come from the parent (font-size /
 * color / width prop).
 */
import type { ReactNode } from "react";

export type MarketingIconName =
  | "home" | "plan" | "studio" | "funnels" | "campaigns"
  | "leads" | "audiences" | "insights" | "community"
  | "rocket" | "sun" | "moon" | "check" | "spark"
  | "compass" | "tree" | "bolt" | "refresh" | "book" | "message"
  | "calendar" | "trophy" | "search" | "gear" | "card" | "link" | "pen"
  | "save" | "cloud" | "trash" | "signal"
  | "hash" | "wave" | "warning" | "lock";

const PATHS: Record<MarketingIconName, ReactNode> = {
  // dashboard grid
  home: (<><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></>),
  // bullseye / targeting
  plan: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>),
  // funnel flow map
  studio: (<><rect x="3" y="3.5" width="7" height="5" rx="1.4" /><rect x="14" y="9.5" width="7" height="5" rx="1.4" /><rect x="6.5" y="15.5" width="7" height="5" rx="1.4" /><path d="M10 6h2.5a1.8 1.8 0 0 1 1.8 1.8V9.5" /><path d="M10 18h-.2A3.3 3.3 0 0 1 6.5 14.7V8.5" /></>),
  // marketing funnel
  funnels: (<><path d="M3 4.5h18" /><path d="M6 9.5h12" /><path d="M10 14.5h4v5l-4 2z" /></>),
  // megaphone / announce
  campaigns: (<><path d="M4 10v4h3l7 4V6l-7 4H4z" /><path d="M17.5 9a4 4 0 0 1 0 6" /></>),
  // horseshoe magnet
  leads: (<><path d="M6 4h4v7a2 2 0 0 0 4 0V4h4v7a6 6 0 0 1-12 0z" /><path d="M6 8h4M14 8h4" /></>),
  // audience / people
  audiences: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3 3 0 0 1 0 5.8" /><path d="M17.4 13.2a5.5 5.5 0 0 1 3.1 5" /></>),
  // trending up
  insights: (<><path d="M4 4v16h16" /><path d="M7.5 14.5 11 10.5l3 2.5 5.5-6" /><path d="M15.5 7h4.5v4.5" /></>),
  // globe
  community: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" /></>),
  // rocket / launch
  rocket: (<><path d="M12 3c3 1.2 4.8 4 4.8 8.2 0 2-.6 3.7-1.3 5H8.5c-.7-1.3-1.3-3-1.3-5C7.2 7 9 4.2 12 3z" /><circle cx="12" cy="9.5" r="1.6" /><path d="M8.6 16.5 6.5 18.7M15.4 16.5l2.1 2.2M9.5 19.5c-.3 1.3-.3 1.3-1.5 2 .2-1.4.2-1.4 1.5-2zM14.5 19.5c.3 1.3.3 1.3 1.5 2-.2-1.4-.2-1.4-1.5-2z" /></>),
  // theme toggle
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>),
  moon: (<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />),
  check: (<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />),
  spark: (<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>),
  // compass — reality map / where you are
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4 13.2 13.2 8.4 15.6 10.8 10.8z" /></>),
  // driver tree — levers that multiply
  tree: (<><circle cx="12" cy="4.5" r="2" /><circle cx="6.5" cy="19" r="2" /><circle cx="17.5" cy="19" r="2" /><path d="M12 6.5v3M12 9.5c0 3-5.5 3.5-5.5 7.5M12 9.5c0 3 5.5 3.5 5.5 7.5" /></>),
  // bolt — execution
  bolt: (<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />),
  // refresh loop — review
  refresh: (<><path d="M3.5 12a8.5 8.5 0 0 1 14.6-6" /><path d="M20.5 12a8.5 8.5 0 0 1-14.6 6" /><path d="M18.5 2.5V6H15M5.5 21.5V18H9" /></>),
  // book — programme / learning
  book: (<><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" /></>),
  // chat bubble — message / one-liner
  message: (<><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9l-5 4v-3.5z" /><path d="M8.5 8.5h7M8.5 11.5h4" /></>),
  // calendar — booked calls
  calendar: (<><rect x="3.5" y="5" width="17" height="16" rx="2.4" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
  // trophy — leaderboard / winning angles
  trophy: (<><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M9.5 14.5h5l-.5 3h-4z" /><path d="M8.5 20.5h7" /></>),
  // search — filter / find
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>),
  // gear — settings / account (proper cog outline, not sun-like)
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  // card — subscription / billing
  card: (<><rect x="2.5" y="5" width="19" height="14" rx="2.4" /><path d="M2.5 9.5h19M6 15h4" /></>),
  // link — connections / integrations
  link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  // pen — write / asset writer
  pen: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>),
  // save — write a local copy
  save: (<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>),
  // cloud — save / open from the shared library
  cloud: (<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />),
  // trash — delete
  trash: (<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>),
  // signal — live tracking
  signal: (<><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.2" fill="currentColor" stroke="none" /></>),
  // hash — numbers layer (rate/people on the lines)
  hash: (<path d="M9 3 7 21M17 3l-2 18M3.5 8.5h17M2.5 15.5h17" />),
  // wave — flow layer (volume/health flowing through the lines)
  wave: (<path d="M2 12c2.5-4 4.5-4 7 0s4.5 4 7 0 4.5-4 6 0" />),
  // warning — risk layer (flagged assumptions)
  warning: (<><path d="M12 3 22 20H2z" /><path d="M12 10v5" /><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" /></>),
  // lock — gated / sign-in required states
  lock: (<><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>),
};

export function MarketingIcon({ name, size = 18, className }: { name: MarketingIconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
