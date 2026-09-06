/**
 * Next-best-audience suggestions on Segments (task #41).
 *
 * Given aggregate counts of the contact base, rank the audiences most worth
 * messaging next — intent first (hot leads left un-booked beat a big cold
 * list), size as the tiebreak. Each suggestion carries a ready-to-use rule
 * Group so one click opens the composer already scoped to that audience.
 *
 * Deterministic and pure (no AI, no fetch): stable, testable, and works with
 * no model connected. The page layers an optional AI "why" phrasing on top.
 */
import type { Group } from "./rules";

export interface AudienceStats {
  total: number;
  /** Qualified leads who never booked — the highest-intent follow-up. */
  qualifiedNotBooked: number;
  /** Nurture-stage leads with a phone on file (SMS-reachable). */
  nurtureWithPhone: number;
  /** Leads created in the last 7 days. */
  newLast7: number;
  /** Booked / converted — for referrals, upsells, reviews. */
  booked: number;
  /** Verified, email-reachable contacts — safe for a clean broadcast. */
  verifiedEmail: number;
  /** Anyone with a phone number. */
  smsReachable: number;
}

export interface AudienceSuggestion {
  id: keyof AudienceStats;
  name: string;
  icon: string;
  reason: string;
  size: number;
  channel: "email" | "sms" | "any";
  rules: Group;
}

const g = (rules: Group["rules"]): Group => ({ combinator: "and", rules });

/**
 * Candidate audiences in intent order (weight = how valuable it usually is to
 * message this group next). The engine keeps only those with people in them,
 * ranks by weight then size, and returns the top few.
 */
const CANDIDATES: Array<{
  id: keyof AudienceStats;
  weight: number;
  name: string;
  icon: string;
  channel: AudienceSuggestion["channel"];
  reason: (n: number) => string;
  rules: Group;
}> = [
  {
    id: "qualifiedNotBooked",
    weight: 100,
    name: "Qualified, not booked",
    icon: "🔥",
    channel: "any",
    reason: (n) => `${n} lead${n === 1 ? "" : "s"} qualified but never booked — a single nudge is the cheapest conversion you have.`,
    rules: g([{ field: "status", op: "eq", value: "qualified" }, { field: "booked", op: "isFalse" }]),
  },
  {
    id: "newLast7",
    weight: 80,
    name: "New in the last 7 days",
    icon: "🆕",
    channel: "any",
    reason: (n) => `${n} fresh lead${n === 1 ? "" : "s"} arrived this week — reach out while you're still top of mind.`,
    rules: g([{ field: "createdAt", op: "withinDays", value: 7 }]),
  },
  {
    id: "nurtureWithPhone",
    weight: 70,
    name: "Nurture with a phone",
    icon: "☎️",
    channel: "sms",
    reason: (n) => `${n} warm lead${n === 1 ? "" : "s"} you can text — SMS gets read in minutes, not days.`,
    rules: g([{ field: "status", op: "eq", value: "nurture" }, { field: "hasPhone", op: "isTrue" }]),
  },
  {
    id: "booked",
    weight: 60,
    name: "Booked — converted",
    icon: "✅",
    channel: "any",
    reason: (n) => `${n} customer${n === 1 ? "" : "s"} already said yes — ask for a referral, a review, or the next step.`,
    rules: g([{ field: "booked", op: "isTrue" }]),
  },
  {
    id: "verifiedEmail",
    weight: 40,
    name: "Verified email contacts",
    icon: "🔐",
    channel: "email",
    reason: (n) => `${n} verified email${n === 1 ? "" : "s"} — a clean list keeps your sender reputation healthy.`,
    rules: g([{ field: "verified", op: "isTrue" }, { field: "hasEmail", op: "isTrue" }]),
  },
  {
    id: "smsReachable",
    weight: 35,
    name: "SMS-reachable",
    icon: "📱",
    channel: "sms",
    reason: (n) => `${n} contact${n === 1 ? "" : "s"} with a phone — a fast channel when email goes quiet.`,
    rules: g([{ field: "hasPhone", op: "isTrue" }]),
  },
];

/**
 * The rule Group for each candidate audience, so the page can fetch a live
 * count per audience (via the preview endpoint) without re-declaring rules —
 * the rules live here as the single source of truth.
 */
export const AUDIENCE_PROBES: Array<{ id: keyof AudienceStats; rules: Group }> = CANDIDATES.map((c) => ({ id: c.id, rules: c.rules }));

/**
 * Rank the audiences worth messaging next. Empty audiences are dropped; the
 * rest sort by intent weight, then by size. Returns at most `limit` (default 4).
 */
export function suggestAudiences(stats: AudienceStats, limit = 4): AudienceSuggestion[] {
  return CANDIDATES.filter((c) => (stats[c.id] ?? 0) > 0)
    .map((c) => ({ c, size: stats[c.id] }))
    .sort((a, b) => (b.c.weight - a.c.weight) || (b.size - a.size))
    .slice(0, Math.max(0, limit))
    .map(({ c, size }) => ({ id: c.id, name: c.name, icon: c.icon, reason: c.reason(size), size, channel: c.channel, rules: c.rules }));
}
