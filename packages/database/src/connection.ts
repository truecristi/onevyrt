import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let db: Database | undefined;

/**
 * Lazily creates a single pooled connection for the process. Tests that
 * need an isolated pool (e.g. against a different DATABASE_URL) should call
 * `createDatabase` directly instead of this singleton.
 */
export function getDb(databaseUrl: string): Database {
  if (!db) {
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzle(pool, { schema });
  }
  return db;
}

export function createDatabase(databaseUrl: string): { db: Database; pool: Pool } {
  const localPool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(localPool, { schema }), pool: localPool };
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

export { schema };
