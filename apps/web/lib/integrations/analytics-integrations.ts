/**
 * External analytics integrations:
 * - Google Analytics 4 (GA4)
 * - Segment (multi-tool routing)
 * - Sentry (error tracking)
 * - PostHog (product analytics)
 *
 * All integrations are environment-gated and fire-and-forget to never
 * block real feature operations.
 */

// Initialize integrations based on environment variables
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;
const SENTRY_DSN = process.env.SENTRY_DSN;
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com";

// ============ Google Analytics 4 ============

export async function trackGA4Event(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!GA4_MEASUREMENT_ID || typeof window === "undefined") return;

  try {
    // Use gtag if available (injected via script tag)
    if ((window as any).gtag) {
      (window as any).gtag("event", eventName, params || {});
    }
  } catch (e) {
    console.warn("[GA4] failed to track event:", e instanceof Error ? e.message : e);
  }
}

export async function trackGA4Conversion(
  eventName: string,
  value: number,
  currency: string = "USD",
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!GA4_MEASUREMENT_ID || typeof window === "undefined") return;

  try {
    if ((window as any).gtag) {
      (window as any).gtag("event", eventName, {
        value,
        currency,
        ...metadata,
      });
    }
  } catch (e) {
    console.warn("[GA4] failed to track conversion:", e instanceof Error ? e.message : e);
  }
}

// ============ Segment ============

export async function trackSegmentEvent(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!SEGMENT_WRITE_KEY) return;

  try {
    // Use analytics.js if available
    if ((window as any).analytics) {
      if (userId) {
        (window as any).analytics.identify(userId);
      }
      (window as any).analytics.track(eventName, properties || {});
    }
  } catch (e) {
    console.warn("[Segment] failed to track event:", e instanceof Error ? e.message : e);
  }
}

// Server-side Segment tracking
export async function trackSegmentEventServer(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
  anonymousId?: string,
): Promise<void> {
  if (!SEGMENT_WRITE_KEY) return;

  try {
    const response = await fetch("https://api.segment.com/v1/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${SEGMENT_WRITE_KEY}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        userId: userId || undefined,
        anonymousId: anonymousId || "anonymous",
        event: eventName,
        properties: properties || {},
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn("[Segment] API error:", response.status);
    }
  } catch (e) {
    console.warn("[Segment] failed to track event server-side:", e instanceof Error ? e.message : e);
  }
}

// ============ Sentry ============

export async function captureException(
  error: Error | string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!SENTRY_DSN || typeof window === "undefined") return;

  try {
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(
        typeof error === "string" ? new Error(error) : error,
        { extra: context || {} },
      );
    }
  } catch (e) {
    console.warn("[Sentry] failed to capture exception:", e instanceof Error ? e.message : e);
  }
}

export async function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>,
): Promise<void> {
  if (!SENTRY_DSN || typeof window === "undefined") return;

  try {
    if ((window as any).Sentry) {
      (window as any).Sentry.captureMessage(message, level, {
        extra: context || {},
      });
    }
  } catch (e) {
    console.warn("[Sentry] failed to capture message:", e instanceof Error ? e.message : e);
  }
}

// Server-side Sentry
export async function captureExceptionServer(
  error: Error | string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!SENTRY_DSN) return;

  try {
    // In a real app, you'd use @sentry/nextjs or similar
    // For now, just log the error
    console.error("[Sentry] Uncaught error:", error, context);
  } catch (e) {
    console.warn("[Sentry] failed to capture exception server-side:", e instanceof Error ? e.message : e);
  }
}

// ============ PostHog ============

export async function trackPostHogEvent(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!POSTHOG_KEY || typeof window === "undefined") return;

  try {
    if ((window as any).posthog) {
      const posthog = (window as any).posthog;
      if (userId) {
        posthog.identify(userId);
      }
      posthog.capture(eventName, properties || {});
    }
  } catch (e) {
    console.warn("[PostHog] failed to track event:", e instanceof Error ? e.message : e);
  }
}

// Server-side PostHog
export async function trackPostHogEventServer(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
  anonymousId?: string,
): Promise<void> {
  if (!POSTHOG_KEY) return;

  try {
    const response = await fetch(`${POSTHOG_HOST}/api/event/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: eventName,
        distinct_id: userId || anonymousId || "anonymous",
        properties: properties || {},
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn("[PostHog] API error:", response.status);
    }
  } catch (e) {
    console.warn("[PostHog] failed to track event server-side:", e instanceof Error ? e.message : e);
  }
}

// ============ Unified Tracking Function ============

export async function trackEventAllIntegrations(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: {
    isConversion?: boolean;
    conversionValue?: number;
    conversionCurrency?: string;
  },
): Promise<void> {
  // Fire all integrations in parallel (non-blocking)
  Promise.all([
    trackGA4Event(eventName, properties as any),
    options?.isConversion &&
      options?.conversionValue &&
      trackGA4Conversion(eventName, options.conversionValue, options.conversionCurrency),
    trackSegmentEvent(userId, eventName, properties),
    trackPostHogEvent(userId, eventName, properties),
  ]).catch((e) => console.warn("[integrations] error tracking event:", e));
}

export async function trackEventAllIntegrationsServer(
  userId: string | null,
  eventName: string,
  properties?: Record<string, unknown>,
  anonymousId?: string,
  _options?: {
    isConversion?: boolean;
    conversionValue?: number;
    conversionCurrency?: string;
  },
): Promise<void> {
  // Fire all integrations in parallel (non-blocking)
  Promise.all([
    trackSegmentEventServer(userId, eventName, properties, anonymousId),
    trackPostHogEventServer(userId, eventName, properties, anonymousId),
  ]).catch((e) => console.warn("[integrations] error tracking event server-side:", e));
}

// ============ Configuration Check ============

export function getAnalyticsConfig() {
  return {
    ga4Configured: !!GA4_MEASUREMENT_ID,
    segmentConfigured: !!SEGMENT_WRITE_KEY,
    sentryConfigured: !!SENTRY_DSN,
    postHogConfigured: !!POSTHOG_KEY,
    allConfigured:
      !!GA4_MEASUREMENT_ID && !!SEGMENT_WRITE_KEY && !!SENTRY_DSN && !!POSTHOG_KEY,
  };
}
