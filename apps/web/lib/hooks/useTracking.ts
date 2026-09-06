/**
 * React hook for event tracking
 * Wraps the analytics API and external integrations
 */

"use client";

import { useEffect, useCallback } from "react";
import {
  trackPageView,
  trackUserAction,
  trackConversion,
  trackError,
  trackPerformance,
  type UserActionEvent,
  type ConversionEvent,
  type ErrorEvent,
  type PerformanceMetric,
} from "../analytics-extended";
import {
  trackEventAllIntegrations,
} from "../integrations/analytics-integrations";

interface UseTrackingOptions {
  userId?: string;
  workspaceId?: string;
}

export function useTracking(options: UseTrackingOptions = {}) {
  // Track page views
  useEffect(() => {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const title = typeof document !== "undefined" ? document.title : "";

    if (pathname) {
      // Fire both internal and external tracking (non-blocking)
      trackPageView(options.userId || null, options.workspaceId || null, {
        pagePath: pathname,
        pageTitle: title,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }).catch((e) => console.warn("[tracking] page view error:", e));

      trackEventAllIntegrations(
        options.userId || null,
        "page_view",
        {
          page_path: pathname,
          page_title: title,
        }
      ).catch((e) => console.warn("[tracking] integration error:", e));
    }
  }, [options.userId, options.workspaceId]);

  // Track user actions
  const trackAction = useCallback(
    async (event: UserActionEvent) => {
      try {
        await trackUserAction(options.userId || null, options.workspaceId || null, event);
        await trackEventAllIntegrations(
          options.userId || null,
          `action:${event.actionName}`,
          {
            action_type: event.actionType,
            action_name: event.actionName,
            ...event.metadata,
          }
        );
      } catch (e) {
        console.warn("[tracking] action error:", e);
      }
    },
    [options.userId, options.workspaceId]
  );

  // Track conversions
  const trackConversionEvent = useCallback(
    async (event: ConversionEvent) => {
      try {
        await trackConversion(options.userId || null, options.workspaceId || null, event);
        await trackEventAllIntegrations(
          options.userId || null,
          `conversion:${event.conversionType}`,
          {
            conversion_type: event.conversionType,
            conversion_name: event.conversionName,
            revenue_value: event.revenueValue,
            ...event.metadata,
          },
          {
            isConversion: true,
            conversionValue: event.revenueValue || 0,
            conversionCurrency: event.currency,
          }
        );
      } catch (e) {
        console.warn("[tracking] conversion error:", e);
      }
    },
    [options.userId, options.workspaceId]
  );

  // Track errors
  const trackErrorEvent = useCallback(
    async (event: ErrorEvent) => {
      try {
        await trackError(options.userId || null, options.workspaceId || null, event);
      } catch (e) {
        console.warn("[tracking] error tracking failed:", e);
      }
    },
    [options.userId, options.workspaceId]
  );

  // Track performance
  const trackPerformanceMetric = useCallback(
    async (metric: PerformanceMetric) => {
      try {
        await trackPerformance(options.userId || null, options.workspaceId || null, metric);
      } catch (e) {
        console.warn("[tracking] performance error:", e);
      }
    },
    [options.userId, options.workspaceId]
  );

  // Measure page load time
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPageLoad = () => {
      const perfData = window.performance.timing;
      const pageLoadTime =
        perfData.loadEventEnd - perfData.navigationStart;

      if (pageLoadTime > 0) {
        trackPerformanceMetric({
          metricType: "page_load",
          metricName: "full_page_load",
          valueMs: pageLoadTime,
          pagePath: window.location.pathname,
          metadata: {
            dns_time: perfData.domainLookupEnd - perfData.domainLookupStart,
            tcp_time: perfData.connectEnd - perfData.connectStart,
            ttfb: perfData.responseStart - perfData.navigationStart,
            dom_interactive: perfData.domInteractive - perfData.navigationStart,
          },
        }).catch((e) => console.warn("[tracking] page load metric error:", e));
      }
    };

    if (document.readyState === "complete") {
      onPageLoad();
    } else {
      window.addEventListener("load", onPageLoad);
      return () => window.removeEventListener("load", onPageLoad);
    }
  }, [trackPerformanceMetric]);

  return {
    trackAction,
    trackConversion: trackConversionEvent,
    trackError: trackErrorEvent,
    trackPerformance: trackPerformanceMetric,
  };
}

// Convenience hook for tracking button clicks
export function useTrackClick(
  actionName: string,
  actionType: string = "button_click",
  options: UseTrackingOptions = {}
) {
  const { trackAction } = useTracking(options);

  return useCallback(
    async (metadata?: Record<string, unknown>) => {
      await trackAction({
        actionType,
        actionName,
        metadata,
      });
    },
    [trackAction, actionType, actionName]
  );
}

// Convenience hook for tracking form submissions
export function useTrackFormSubmit(
  formName: string,
  options: UseTrackingOptions = {}
) {
  const { trackAction } = useTracking(options);

  return useCallback(
    async (data?: Record<string, unknown>) => {
      await trackAction({
        actionType: "form_submit",
        actionName: formName,
        metadata: data,
      });
    },
    [trackAction, formName]
  );
}
