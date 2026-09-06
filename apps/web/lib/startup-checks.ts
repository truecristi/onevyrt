/**
 * Security Startup Checks (Wave 1).
 * Runs on app initialization to verify critical security settings are
 * correctly configured for the current environment.
 *
 * Call this from app/layout.tsx or the server startup hook, before the
 * app begins handling requests.
 */

import { dbConfigured, buildSslConfig } from "./db";

const isProduction = process.env.NODE_ENV === "production";

/**
 * AUTH_SECRET Production Enforcement: In production, AUTH_SECRET must be
 * explicitly set (not generated). This prevents accidental session loss when
 * replicating to production or rotating containers on a system without
 * persistent storage for .gearbox/auth-secret.
 *
 * In development, we allow auto-generation with a warning, so developers
 * don't need to manage the secret locally.
 */
export function checkAuthSecret(): void {
  const isSet = Boolean(process.env.AUTH_SECRET?.trim());

  if (isProduction) {
    if (!isSet) {
      throw new Error(
        "CRITICAL: AUTH_SECRET is not set in production. " +
        "Set it as an environment variable before deploying. " +
        "Generate a 64-character hex string: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'. " +
        "All instances must share the same secret, or sessions will be invalidated on failover."
      );
    }
  } else {
    // Development
    if (!isSet && !process.env.ONEVYRT_ROOT) {
      console.warn(
        "[Security] Development mode: AUTH_SECRET not set. " +
        "Using auto-generated secret from .gearbox/auth-secret. " +
        "For production, set AUTH_SECRET as an env var."
      );
    }
  }
}

/**
 * TLS Certificate Verification: In production, reject invalid certificates.
 * Prevents MITM attacks on the database connection.
 *
 * In development, we allow permissive verification if no CA is provided,
 * so local Postgres and dev-tier databases work without extra config.
 */
export function checkDatabaseTLS(): void {
  if (!dbConfigured()) {
    if (isProduction) {
      throw new Error(
        "CRITICAL: DATABASE_URL is not set in production. " +
        "Add it to your environment variables before deploying."
      );
    }
    return; // Dev: optional
  }

  const url = process.env.DATABASE_URL;
  if (!url) return;

  const needsTls = !/localhost|127\.0\.0\.1/.test(url);
  if (!needsTls) return; // Local Postgres, no TLS

  if (isProduction) {
    // Production: require valid certificate or explicit permission
    const hasCert =
      Boolean(process.env.DATABASE_CA_CERT) ||
      Boolean(process.env.DATABASE_CA_CERT_PATH) ||
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "1";

    if (!hasCert) {
      throw new Error(
        "CRITICAL: Database TLS certificate verification is not configured in production. " +
        "Set one of: " +
        "DATABASE_CA_CERT (inline PEM), " +
        "DATABASE_CA_CERT_PATH (path to CA bundle), " +
        "or DATABASE_SSL_REJECT_UNAUTHORIZED=1 (use Node's default trust store). " +
        "This prevents MITM attacks on the database connection."
      );
    }

    // Additionally check that we're not accidentally permitting unverified certs
    const ssl = buildSslConfig(true);
    if (ssl && !ssl.rejectUnauthorized) {
      throw new Error(
        "CRITICAL: Database TLS certificate verification is disabled in production. " +
        "This is a security vulnerability. " +
        "Set DATABASE_CA_CERT, DATABASE_CA_CERT_PATH, or DATABASE_SSL_REJECT_UNAUTHORIZED=1."
      );
    }
  } else {
    // Development: log a warning if not configured
    const hasCert =
      Boolean(process.env.DATABASE_CA_CERT) ||
      Boolean(process.env.DATABASE_CA_CERT_PATH) ||
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "1";

    if (!hasCert) {
      console.warn(
        "[Security] Development mode: Database TLS certificate verification is disabled. " +
        "For production, set DATABASE_CA_CERT, DATABASE_CA_CERT_PATH, or DATABASE_SSL_REJECT_UNAUTHORIZED=1."
      );
    }
  }
}

/**
 * CSRF Protection: Verify the middleware is wired into routes.
 * This is a soft check — we can't easily verify every route has the check,
 * but we can at least confirm the module loads without error.
 */
export async function checkCsrfMiddleware(): Promise<void> {
  try {
    // Just importing the module ensures it's syntactically correct and doesn't
    // have circular dependencies or other critical issues.
    await import("./middleware/csrf");
  } catch (err) {
    throw new Error(
      `CRITICAL: CSRF middleware failed to load: ${err instanceof Error ? err.message : String(err)}. ` +
      "This is a code issue, not a configuration issue."
    );
  }
}

/**
 * Run all startup checks. Call this once during app initialization,
 * before the app handles any requests.
 *
 * Note: checkAuthSecret() is already called when auth.ts is imported
 * (see lib/auth.ts), so it doesn't need to be called here again.
 *
 * Throws synchronously on critical issues so the app fails fast and loudly
 * rather than running with a partial configuration.
 *
 * Async to support checks that need to load modules dynamically (like CSRF).
 */
export async function runStartupChecks(): Promise<void> {
  // AUTH_SECRET check runs at module load (see lib/auth.ts)
  checkDatabaseTLS();
  await checkCsrfMiddleware();

  if (isProduction) {
    console.log("[Security] All production security checks passed.");
  }
}
