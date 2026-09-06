"use client";

/**
 * useFeatureAccess Hook
 * React hook for checking feature access and managing preview state.
 */

import { useCallback, useEffect, useState } from "react";
import type { FeatureTier } from "../feature-preview";
import {
  hasFeatureAccess,
  getFeatureMinTier,
  getUpgradeTierForFeature,
  getLockedFeatures,
  getAccessibleFeatures,
  FEATURE_CATALOG,
} from "../feature-preview";
import {
  recordFeatureAttempt,
  getFeatureAttemptCount,
  trackFeatureAttemptServer,
} from "../feature-access-tracking";

export interface UseFeatureAccessOptions {
  /** User's current plan tier */
  userTier: FeatureTier | undefined;
  /** Workspace ID for tracking */
  workspaceId?: string;
  /** User ID for tracking */
  userId?: string;
}

export function useFeatureAccess(
  featureId: string,
  options: UseFeatureAccessOptions
) {
  const { userTier, workspaceId, userId: _userId } = options;
  const [attemptCount, setAttemptCount] = useState(0);
  const [isTrialing, setIsTrialing] = useState(false);

  // Hydrate attempt count on mount
  useEffect(() => {
    setAttemptCount(getFeatureAttemptCount(featureId));
  }, [featureId]);

  const feature = FEATURE_CATALOG[featureId];
  const isLocked = !hasFeatureAccess(userTier, featureId);
  const minTier = getFeatureMinTier(featureId);
  const upgradeTier = getUpgradeTierForFeature(userTier, featureId);

  // Track attempt when user tries to access locked feature
  const attemptAccess = useCallback(async () => {
    if (!isLocked) return; // Only track locked feature attempts

    const updated = recordFeatureAttempt(featureId);
    setAttemptCount(updated.find((a) => a.featureId === featureId)?.count ?? 0);

    // Send to analytics
    if (workspaceId) {
      await trackFeatureAttemptServer(featureId, workspaceId);
    }
  }, [isLocked, featureId, workspaceId]);

  // Start a trial access
  const startTrial = useCallback(() => {
    setIsTrialing(true);
    // In a real implementation, this would trigger trial access logic
    // For now, it's a local state change that can trigger UI changes
  }, []);

  // End trial
  const endTrial = useCallback(() => {
    setIsTrialing(false);
  }, []);

  return {
    // Access control
    isLocked,
    canAccess: !isLocked,
    isTrialing,

    // Feature info
    feature,
    minTier,
    upgradeTier,

    // Tracking
    attemptCount,
    attemptAccess,

    // Trial
    startTrial,
    endTrial,
  };
}

/**
 * Hook to get all locked features for current plan
 */
export function useLockedFeatures(userTier: FeatureTier | undefined) {
  return getLockedFeatures(userTier);
}

/**
 * Hook to get all accessible features for current plan
 */
export function useAccessibleFeatures(userTier: FeatureTier | undefined) {
  return getAccessibleFeatures(userTier);
}

/**
 * Hook to check if user is near a usage limit
 */
export function useNearLimit(
  currentUsage: number,
  limit: number,
  threshold: number = 0.8
): boolean {
  return currentUsage / limit >= threshold;
}

/**
 * Hook to manage feature preview visibility
 */
export function useFeaturePreviewState() {
  const [previewFeatureId, setPreviewFeatureId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const openPreview = useCallback((featureId: string) => {
    setPreviewFeatureId(featureId);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewFeatureId(null);
  }, []);

  const openComparison = useCallback(() => {
    setShowComparison(true);
  }, []);

  const closeComparison = useCallback(() => {
    setShowComparison(false);
  }, []);

  return {
    previewFeatureId,
    showComparison,
    openPreview,
    closePreview,
    openComparison,
    closeComparison,
  };
}
