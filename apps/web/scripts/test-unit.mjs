/**
 * test:unit — runs only the DB-free tests, giving a fast green signal without a
 * Postgres instance (the full `pnpm test` needs one, and hard-fails every
 * DB-backed test with ECONNREFUSED when there isn't one). Useful as a
 * pre-deploy / pre-push check since master auto-deploys to production.
 *
 * Selection is by content: any test file that references the database directly
 * (pg pool, the shared pg test helper, DATABASE_URL, port 5432, or the
 * purgeWorkspaces cleanup helper) is skipped; everything else runs. These
 * markers were verified to split the suite exactly — the excluded set is the
 * DB-backed tests, the included set all pass with no database. Exclusion is the
 * safe direction: a mis-skipped pure test simply doesn't run here (still covered
 * by `pnpm test`), whereas a DB test is never let through to fail spuriously.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const DB_MARKERS = /5432|DATABASE_URL|pg\.|helpers\/pg|purgeWorkspaces|pgPool/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const all = walk("test");
const unit = all.filter((f) => !DB_MARKERS.test(readFileSync(f, "utf8"))).sort();
console.log(`test:unit — running ${unit.length} DB-free test file(s), skipping ${all.length - unit.length} that need Postgres.`);

const res = spawnSync("tsx", ["--test", "--test-concurrency=1", ...unit], { stdio: "inherit" });
process.exit(res.status ?? 1);
