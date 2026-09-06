/**
 * Production migration runner for the ov1 deploy.
 *
 * Runs the node-pg-migrate `up` migrations programmatically so the migration
 * connection uses EXACTLY the same TLS posture as the running app's pool
 * (lib/db.ts::buildSslConfig): in production, certificate verification is
 * mandatory. This keeps the one-shot admin migration as secure as live
 * traffic — no `sslmode=no-verify` shortcut that would weaken it.
 *
 * Reads (same env contract as the app):
 *   DATABASE_URL                      required
 *   DATABASE_CA_CERT                  inline CA bundle PEM, or
 *   DATABASE_CA_CERT_PATH             path to a CA bundle file, or
 *   DATABASE_SSL_REJECT_UNAUTHORIZED  "1" to verify against Node's trust store
 *   NODE_ENV                          "production" makes verification mandatory
 *
 * Invoked by deploy/docker-entrypoint.sh before `next start`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runner } from "node-pg-migrate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "..", "migrations");

/** Mirror of lib/db.ts::buildSslConfig — kept in lockstep so migrations and
 *  the runtime pool trust the database the same way. */
function buildSslConfig(needsTls) {
  if (!needsTls) return undefined;
  const isProduction = process.env.NODE_ENV === "production";
  const caInline = process.env.DATABASE_CA_CERT;
  const caPath = process.env.DATABASE_CA_CERT_PATH;
  const rejectUnauth = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "1";

  let ca = caInline;
  if (!ca && caPath) {
    try { ca = readFileSync(caPath, "utf8"); } catch { /* fall through */ }
  }
  if (ca) return { ca, rejectUnauthorized: true };
  if (rejectUnauth) return { rejectUnauthorized: true };
  if (isProduction) {
    throw new Error(
      "CRITICAL: TLS certificate verification is not configured in production. " +
      "Set DATABASE_CA_CERT, DATABASE_CA_CERT_PATH, or DATABASE_SSL_REJECT_UNAUTHORIZED=1.",
    );
  }
  return { rejectUnauthorized: false };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot run migrations.");
  }
  const needsTls = !/localhost|127\.0\.0\.1/.test(connectionString);
  const ssl = buildSslConfig(needsTls);

  console.log("[ov1] applying database migrations…");
  const applied = await runner({
    databaseUrl: { connectionString, ssl },
    dir: migrationsDir,
    direction: "up",
    migrationsTable: "pgmigrations",
    count: Infinity,
    verbose: true,
  });
  const n = Array.isArray(applied) ? applied.length : 0;
  console.log(`[ov1] migrations complete — ${n} applied this run.`);
}

main().catch((err) => {
  console.error("[ov1] migration failed:", err?.message ?? err);
  process.exit(1);
});
