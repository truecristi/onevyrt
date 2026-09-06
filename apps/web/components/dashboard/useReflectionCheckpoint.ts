import { useEffect, useState, useCallback } from "react";

export interface ReflectionCheckpointState {
  isDue: boolean;
  isLoading: boolean;
  nextReminderAt: string | null;
  error: string | null;
}

/**
 * useReflectionCheckpoint
 *
 * Hook to check if a 90-day reflection is due and get scheduling info.
 *
 * Usage:
 * ```tsx
 * const { isDue, isLoading, nextReminderAt } = useReflectionCheckpoint(workspaceId);
 *
 * if (isDue) {
 *   return <NinetyDayReflectionCheckpoint {...props} />;
 * }
 * ```
 */
export function useReflectionCheckpoint(
  workspaceId: string | null
): ReflectionCheckpointState {
  const [state, setState] = useState<ReflectionCheckpointState>({
    isDue: false,
    isLoading: true,
    nextReminderAt: null,
    error: null,
  });

  const checkReflectionStatus = useCallback(async () => {
    if (!workspaceId) {
      setState({
        isDue: false,
        isLoading: false,
        nextReminderAt: null,
        error: null,
      });
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(
        `/api/workspace/${workspaceId}/reflection-checkpoint`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check reflection status");
      }

      const data = await response.json();

      // Check if due (every 90 days from latest)
      let isDue = false;
      if (!data.latest) {
        // No reflection yet - consider due after 90 days of workspace existence
        isDue = true;
      } else {
        const lastReflection = new Date(data.latest.createdAt);
        const daysSince =
          (Date.now() - lastReflection.getTime()) / (24 * 60 * 60 * 1000);
        isDue = daysSince >= 90;
      }

      setState({
        isDue,
        isLoading: false,
        nextReminderAt: data.nextReminderAt,
        error: null,
      });
    } catch (err) {
      console.error("Error checking reflection status:", err);
      setState({
        isDue: false,
        isLoading: false,
        nextReminderAt: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [workspaceId]);

  useEffect(() => {
    checkReflectionStatus();

    // Check again every 24 hours (refresh in case 90-day threshold is crossed)
    const interval = setInterval(checkReflectionStatus, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkReflectionStatus]);

  return state;
}
