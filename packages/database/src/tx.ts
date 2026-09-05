import type { Database } from "./connection";

/**
 * Runs `fn` inside a single Postgres transaction, per §37's "persist
 * atomically" step of the consequential-command lifecycle. Any thrown error
 * rolls the whole transaction back.
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}
