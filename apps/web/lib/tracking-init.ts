/**
 * Tracking initialization module
 * Sets up analytics integrations and global error tracking
 * Should be called once on app startup
 */

import { getAnalyticsConfig } from "./integrations/analytics-integrations";

/**
 * Initialize third-party analytics integrations
 * This should be called in the root layout or app shell
 */
export function initializeAnalyticsIntegrations() {
  if (typeof window === "undefined") return;

  const config = getAnalyticsConfig();

  // Google Analytics
  if (config.ga4Configured) {
    const ga4_id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
    if (ga4_id) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4_id}`;
      document.head.appendChild(script);

      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: unknown[]) {
        ((window as any).dataLayer as any).push(args);
      }
      (window as any).gtag = gtag;
      (window as any).gtag("js", new Date());
      (window as any).gtag("config", ga4_id, {
        send_page_view: false, // We handle page views manually
      });
    }
  }

  // PostHog
  if (config.postHogConfigured) {
    const posthog_key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthog_host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com";
    if (posthog_key) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://cdn.jsdelivr.net/npm/posthog-js@1.180.0/dist/posthog.js";
      script.onload = function () {
        if ((window as any).posthog) {
          (window as any).posthog.init(posthog_key, {
            api_host: posthog_host,
            capture_pageview: false, // We handle page views manually
          });
        }
      };
      document.head.appendChild(script);
    }
  }

  // Segment
  if (config.segmentConfigured) {
    const segment_key = process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY;
    if (segment_key) {
      const script = document.createElement("script");
      script.async = true;
      script.innerHTML = `
        !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(e,t){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.segment.com/analytics.js/v1/"+e+"/analytics.min.js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a);analytics._loadOptions=t};analytics.SNIPPET_VERSION="4.13.1";analytics.load("${segment_key}");analytics.page();}}();
      `;
      document.head.appendChild(script);
    }
  }

  // Sentry (error tracking)
  if (config.sentryConfigured) {
    const sentry_dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentry_dsn) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@sentry/browser@7/dist/bundle.min.js";
      script.async = true;
      script.onload = function () {
        if ((window as any).Sentry) {
          (window as any).Sentry.init({
            dsn: sentry_dsn,
            environment: process.env.NODE_ENV,
            tracesSampleRate: 0.1,
            beforeSend(event: any) {
              // Filter out certain errors
              if (event.exception) {
                const error = event.exception.values?.[0]?.value || "";
                if (error.includes("ResizeObserver")) return null;
                if (error.includes("NetworkError")) return null;
              }
              return event;
            },
          });
        }
      };
      document.head.appendChild(script);
    }
  }

  // Global error handler
  window.addEventListener("error", (event) => {
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(event.error);
    }
  });

  // Global unhandled promise rejection handler
  window.addEventListener("unhandledrejection", (event) => {
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(event.reason);
    }
  });
}

/**
 * Track a user session
 * Should be called after user login with their user ID
 */
export function trackUserSession(userId: string, userData?: Record<string, any>) {
  if (typeof window === "undefined") return;

  // Identify in GA4
  if ((window as any).gtag) {
    (window as any).gtag("set", { user_id: userId, ...userData });
  }

  // Identify in PostHog
  if ((window as any).posthog) {
    (window as any).posthog.identify(userId, userData || {});
  }

  // Identify in Segment
  if ((window as any).analytics) {
    (window as any).analytics.identify(userId, userData || {});
  }

  // Identify in Sentry
  if ((window as any).Sentry) {
    (window as any).Sentry.setUser({ id: userId, ...userData });
  }
}

/**
 * Track user logout
 */
export function trackUserLogout() {
  if (typeof window === "undefined") return;

  // Reset user context in all integrations
  if ((window as any).gtag) {
    (window as any).gtag("set", { user_id: null });
  }

  if ((window as any).posthog) {
    (window as any).posthog.reset();
  }

  if ((window as any).analytics) {
    (window as any).analytics.reset();
  }

  if ((window as any).Sentry) {
    (window as any).Sentry.setUser(null);
  }
}

/**
 * Add custom metadata/tags to tracking
 */
export function setTrackingContext(context: Record<string, any>) {
  if (typeof window === "undefined") return;

  if ((window as any).Sentry) {
    (window as any).Sentry.setContext("custom", context);
  }

  if ((window as any).posthog) {
    Object.entries(context).forEach(([key, value]) => {
      (window as any).posthog.register({ [key]: value });
    });
  }
}
