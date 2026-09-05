import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * Per the repository README ("Environment configuration"): only variables
 * actually used by implemented features belong here. Add a new variable to
 * this schema in the same change that starts using it - do not pre-declare
 * variables for unimplemented phases.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Postgres connection string. Required - Phase 1 has no in-memory fallback. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /**
   * 32-byte hex secret used to sign session cookies.
   * Generate with: `openssl rand -hex 32`
   */
  AUTH_SECRET: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "AUTH_SECRET must be a 32-byte hex string (64 hex characters)"),

  /** Public base URL of the web app, used for absolute links (e.g. in email). */
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validate and parse `process.env` once per process. Throws a descriptive
 * error at startup rather than allowing an unvalidated `undefined` to reach
 * a domain/database call later.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = result.data;
  return cached;
}

/** Test-only: clear the cached env so a test can reload with different values. */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
