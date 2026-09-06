"use client";
/**
 * Per-user, localStorage-backed UI preferences for the studio shell — whether
 * the onboarding strip, the "define your business" canvas nudge, and the
 * always-on coach band have been dismissed / collapsed. Lifted out of
 * funnel-studio.tsx; each read/write is wrapped so a storage exception (private
 * mode, blocked site data) degrades to the default instead of throwing.
 */
import { useCallback, useState } from "react";

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? "1" : "0"); } catch { /* non-fatal */ }
}

export function useStudioUiPrefs(userId: string) {
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => readFlag(`gb-onboarding-dismissed:${userId}`));
  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    writeFlag(`gb-onboarding-dismissed:${userId}`, true);
  }, [userId]);

  const [defNoticeDismissed, setDefNoticeDismissed] = useState(() => readFlag(`gb-defnotice-dismissed:${userId}`));
  const dismissDefNotice = useCallback(() => {
    setDefNoticeDismissed(true);
    writeFlag(`gb-defnotice-dismissed:${userId}`, true);
  }, [userId]);

  const [coachCollapsed, setCoachCollapsed] = useState(() => readFlag(`gb-coach-collapsed:${userId}`));
  const toggleCoach = useCallback(() => {
    setCoachCollapsed((v) => {
      const next = !v;
      writeFlag(`gb-coach-collapsed:${userId}`, next);
      return next;
    });
  }, [userId]);

  return {
    onboardingDismissed, setOnboardingDismissed, dismissOnboarding,
    defNoticeDismissed, setDefNoticeDismissed, dismissDefNotice,
    coachCollapsed, setCoachCollapsed, toggleCoach,
  };
}
