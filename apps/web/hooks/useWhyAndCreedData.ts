import { useState, useEffect } from "react";

export interface WhyAndCreedData {
  why: string;
  creed: string;
}

/**
 * useWhyAndCreedData
 *
 * Custom hook to fetch a workspace's Why & Creed data.
 * Used by MajorDecisionReminder and related components.
 *
 * Features:
 * - Automatic fetching on mount
 * - Error handling
 * - Loading state
 * - Caching (optional)
 * - Refetch capability
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error, refetch } = useWhyAndCreedData(workspaceId);
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return <MajorDecisionReminder whyAndCreedData={data} />;
 * ```
 */

interface UseWhyAndCreedDataOptions {
  /** Enable caching (default: true) */
  cache?: boolean;
  /** Cache duration in milliseconds (default: 5 minutes) */
  cacheDurationMs?: number;
  /** Whether to skip fetching on mount */
  skip?: boolean;
}

// Simple in-memory cache
const cache = new Map<
  string,
  { data: WhyAndCreedData | null; timestamp: number }
>();

export function useWhyAndCreedData(
  workspaceId: string | undefined,
  options: UseWhyAndCreedDataOptions = {}
) {
  const {
    cache: enableCache = true,
    cacheDurationMs = 5 * 60 * 1000, // 5 minutes
    skip = !workspaceId,
  } = options;

  const [data, setData] = useState<WhyAndCreedData | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!workspaceId || skip) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check cache
      if (enableCache) {
        const cached = cache.get(workspaceId);
        if (cached && Date.now() - cached.timestamp < cacheDurationMs) {
          setData(cached.data);
          setIsLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await fetch("/api/command-center/why-creed", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch why/creed: ${response.statusText}`
        );
      }

      const fetchedData = await response.json();

      // Normalize response
      const normalizedData: WhyAndCreedData = {
        why: fetchedData.why || "",
        creed: fetchedData.creed || "",
      };

      // Cache result
      if (enableCache) {
        cache.set(workspaceId, {
          data: normalizedData,
          timestamp: Date.now(),
        });
      }

      setData(normalizedData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Error fetching why/creed:", error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, skip]);

  const refetch = async () => {
    // Clear cache for this workspace
    if (enableCache) {
      cache.delete(workspaceId || "");
    }
    await fetchData();
  };

  return {
    data,
    isLoading,
    error,
    refetch,
    isConfigured: Boolean(data?.why || data?.creed),
  };
}
