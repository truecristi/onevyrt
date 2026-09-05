// Postgres unique_violation - see https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Shared by every use case that needs to turn a database-level unique
 * constraint violation into a typed domain error (registerUser's email
 * check, curriculum-use-cases.ts's slug checks) instead of letting a raw
 * Postgres error surface as an unhandled 500. Originally lived only in
 * auth-use-cases.ts; pulled out here once a second use case needed it.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
