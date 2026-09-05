import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadEnv } from "@onevyrt/contracts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

/**
 * Minimal forward-only migration runner (§43 migration-as-a-feature, scoped
 * to what Phase 1 needs). Applies any `.sql` file in migrations/ that isn't
 * already recorded in `schema_migrations`, in filename order, each inside
 * its own transaction.
 */
export async function runMigrations(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const alreadyApplied = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map(
        (row) => row.name,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (alreadyApplied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }
  } finally {
    await client.end();
  }

  return applied;
}

async function main() {
  const env = loadEnv();
  const applied = await runMigrations(env.DATABASE_URL);
  if (applied.length === 0) {
    console.log("Database already up to date.");
  } else {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }
}

// Only run automatically when invoked directly (`pnpm migrate`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
