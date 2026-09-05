/**
 * Shared integration-test helpers (§14.1's "application tests ... against a
 * real test database"). Every package's integration tests should get their
 * Postgres connection string from here rather than hardcoding it, so the
 * one place that needs to change (CI vs local Docker vs local native
 * Postgres) is this file.
 */
export function getTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? "postgres://postgres:onevyrt@127.0.0.1:5432/onevyrt_test";
}

/** Truncates the given tables (and anything cascading from them) - use in a beforeEach for test isolation between cases in the same file. */
export async function truncateTables(
  client: { query: (sql: string) => Promise<unknown> },
  tables: string[],
): Promise<void> {
  if (tables.length === 0) return;
  await client.query(`TRUNCATE ${tables.join(", ")} CASCADE`);
}
