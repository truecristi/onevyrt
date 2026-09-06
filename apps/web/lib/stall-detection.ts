/**
 * Stall Detection Logic
 *
 * Identifies users who have become inactive or stuck on their learning journey.
 * Factors: Last activity date, chapter progression, time in current chapter.
 */

export interface StallIndicators {
  noActivityDays: number;
  sameChapterDays: number;
  hasWhyAndCreed: boolean;
  isProfileOldEnough: boolean; // Profile created > MIN_AGE_DAYS ago
  isActiveUser: boolean; // At least one prior activity
}

/**
 * Configuration for stall detection
 */
export const STALL_CONFIG = {
  // User hasn't accessed platform in X days
  NO_ACTIVITY_THRESHOLD_DAYS: 7,

  // User stuck on same chapter for X days
  SAME_CHAPTER_THRESHOLD_DAYS: 14,

  // Don't send emails to users in first X days (avoid new user noise)
  MIN_PROFILE_AGE_DAYS: 3,

  // Don't email users who have already received 2+ reminders this month
  MAX_REMINDERS_PER_MONTH: 3,
} as const;

/**
 * Determine if a user is "stalled"
 * A stalled user has:
 * - NOT accessed the platform in 7+ days
 * - OR is stuck on the same chapter for 14+ days
 * - AND has a why/creed set (indicates motivation exists)
 * - AND profile is old enough (3+ days)
 */
export function isUserStalled(indicators: StallIndicators): boolean {
  const { noActivityDays, sameChapterDays, hasWhyAndCreed, isProfileOldEnough, isActiveUser } =
    indicators;

  // If no why/creed set, skip (not engaged enough)
  if (!hasWhyAndCreed) return false;

  // If profile too new, skip (avoid new user noise)
  if (!isProfileOldEnough) return false;

  // If never been active, skip (onboarding in progress)
  if (!isActiveUser) return false;

  // Stalled if: no activity in 7+ days OR stuck 14+ days on same chapter
  const noActivity = noActivityDays >= STALL_CONFIG.NO_ACTIVITY_THRESHOLD_DAYS;
  const sameChapter = sameChapterDays >= STALL_CONFIG.SAME_CHAPTER_THRESHOLD_DAYS;

  return noActivity || sameChapter;
}

/**
 * Calculate days since last activity
 */
export function daysSinceDate(date: Date | null): number {
  if (!date) return Infinity; // Never accessed
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Classify user's stall severity (for template selection)
 */
export type StallSeverity = "mild" | "moderate" | "severe";

export function classifyStallSeverity(noActivityDays: number): StallSeverity {
  if (noActivityDays >= 90) return "severe";
  if (noActivityDays >= 30) return "moderate";
  return "mild";
}

/**
 * Human-readable stall reason
 */
export function getStallReason(
  noActivityDays: number,
  sameChapterDays: number,
  currentChapter: number
): string {
  if (noActivityDays >= 90) {
    return `No activity for 90 days — major disengagement`;
  }

  if (noActivityDays >= 30) {
    return `No activity for ${Math.floor(noActivityDays / 7)} weeks — momentum lost`;
  }

  if (sameChapterDays >= STALL_CONFIG.SAME_CHAPTER_THRESHOLD_DAYS) {
    return `Stuck on Chapter ${currentChapter} for ${Math.floor(sameChapterDays / 7)} weeks`;
  }

  return `No activity for ${noActivityDays} days`;
}

/**
 * Should we email this user? (accounting for email preference, frequency caps, etc.)
 */
export interface EmailEligibility {
  eligible: boolean;
  reason?: string;
}

export function isEligibleForEmail(
  remindersThisMonth: number,
  hasOptedOut: boolean,
  hasWhyAndCreed: boolean
): EmailEligibility {
  if (hasOptedOut) {
    return { eligible: false, reason: "User has opted out of emails" };
  }

  if (!hasWhyAndCreed) {
    return { eligible: false, reason: "User has not set why/creed" };
  }

  if (remindersThisMonth >= STALL_CONFIG.MAX_REMINDERS_PER_MONTH) {
    return { eligible: false, reason: "Max reminders per month reached" };
  }

  return { eligible: true };
}
