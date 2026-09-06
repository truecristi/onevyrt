/**
 * Feature Access Tracking
 * Tracks when users attempt to access locked features.
 * Used for personalized upsell recommendations and analytics.
 */

import type { LockedFeatureAttempt } from "./feature-preview";

const STORAGE_KEY = "onevyrt_feature_attempts";
const MAX_ATTEMPTS_TO_TRACK = 50;

/**
 * Load tracked feature access attempts from localStorage
 * @returns Array of feature access attempts
 */
export function loadFeatureAttempts(): LockedFeatureAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save feature attempts to localStorage
 * @param attempts - Attempts to save
 */
function saveFeatureAttempts(attempts: LockedFeatureAttempt[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Record a feature access attempt
 * @param featureId - Feature that was attempted
 * @returns Updated attempts list
 */
export function recordFeatureAttempt(featureId: string): LockedFeatureAttempt[] {
  const attempts = loadFeatureAttempts();
  const existing = attempts.find((a) => a.featureId === featureId);

  if (existing) {
    existing.count += 1;
    existing.lastAttemptedAt = new Date().toISOString();
  } else {
    const now = new Date().toISOString();
    attempts.push({
      featureId,
      attemptedAt: now,
      count: 1,
      lastAttemptedAt: now,
    });
  }

  // Keep only most recent attempts
  const sorted = attempts.sort(
    (a, b) =>
      new Date(b.lastAttemptedAt).getTime() -
      new Date(a.lastAttemptedAt).getTime()
  );
  const trimmed = sorted.slice(0, MAX_ATTEMPTS_TO_TRACK);

  saveFeatureAttempts(trimmed);
  return trimmed;
}

/**
 * Get attempts for a specific feature
 * @param featureId - Feature to check
 * @returns Attempt count for this feature, or 0
 */
export function getFeatureAttemptCount(featureId: string): number {
  const attempts = loadFeatureAttempts();
  return attempts.find((a) => a.featureId === featureId)?.count ?? 0;
}

/**
 * Get all attempts in the last N days
 * @param days - Number of days to look back
 * @returns Recent attempts
 */
export function getRecentAttempts(days: number = 7): LockedFeatureAttempt[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return loadFeatureAttempts().filter((a) => {
    const attemptDate = new Date(a.lastAttemptedAt);
    return attemptDate > cutoff;
  });
}

/**
 * Get the most frequently attempted locked features
 * @param limit - Max number to return
 * @returns Top attempted features
 */
export function getTopAttemptedFeatures(limit: number = 5): LockedFeatureAttempt[] {
  const attempts = loadFeatureAttempts();
  return attempts
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Clear all tracked attempts
 */
export function clearFeatureAttempts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Get attempts grouped by feature for analytics
 * @returns Map of feature ID to attempt info
 */
export function getAttemptsByFeature(): Record<
  string,
  { count: number; lastAttempted: string }
> {
  const attempts = loadFeatureAttempts();
  const grouped: Record<string, { count: number; lastAttempted: string }> = {};

  for (const attempt of attempts) {
    grouped[attempt.featureId] = {
      count: attempt.count,
      lastAttempted: attempt.lastAttemptedAt,
    };
  }

  return grouped;
}

/**
 * Track an attempted action with server-side analytics
 * @param featureId - Feature that was attempted
 * @param workspaceId - Workspace context
 */
export async function trackFeatureAttemptServer(
  featureId: string,
  workspaceId: string
): Promise<void> {
  try {
    await fetch("/api/analytics/feature-attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featureId, workspaceId, timestamp: new Date().toISOString() }),
    }).catch(() => {
      // Fail silently — analytics is non-critical
    });
  } catch {
    // Silently ignore errors
  }
}

/**
 * Send feature attempt data for personalized email campaigns
 * @param userId - User to track
 * @param workspaceId - Workspace context
 * @returns Promise that resolves when sent
 */
export async function sendFeatureAttemptsToAnalytics(
  userId: string,
  workspaceId: string
): Promise<void> {
  const attempts = loadFeatureAttempts();
  if (attempts.length === 0) return;

  try {
    await fetch("/api/analytics/feature-attempts-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        workspaceId,
        attempts,
        sentAt: new Date().toISOString(),
      }),
    }).catch(() => {
      // Fail silently
    });
  } catch {
    // Silently ignore errors
  }
}
