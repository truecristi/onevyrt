/**
 * User role derivation — computing a user's role based on their membership
 * status across the platform. Role is never stored on the user record; it's
 * always computed fresh from isAdminEmail and coach roster membership.
 *
 * Used by AppNav and other role-gated navigation surfaces to filter sections
 * based on what a user can actually do (spec Wave 3 §3.3).
 */

import { isAdminEmail } from "../admin";
import { listCohortsForCoach } from "../cohorts";
import type { UserRole } from "./structure";

/**
 * Compute the user's role on the platform.
 *
 * Admin takes precedence (an admin who coaches is still an admin);
 * then coach (anyone who coaches a cohort);
 * everyone else is a learner.
 *
 * Requires async to check coach roster, so the result must be awaited.
 */
export async function computeUserRole(userId: string, email: string): Promise<UserRole> {
  // Admin checks first and takes absolute precedence
  if (isAdminEmail(email)) {
    return "admin";
  }

  // Then check if they coach any cohorts
  try {
    const cohorts = await listCohortsForCoach(userId);
    if (cohorts.length > 0) {
      return "coach";
    }
  } catch {
    // If the cohort lookup fails, assume learner (fail open, not closed)
  }

  // Default: everyone else is a learner
  return "learner";
}
