import { loadEnv } from "@onevyrt/contracts";
import { getDb } from "@onevyrt/database";

/** Single place apps/web reads env + acquires the pooled DB connection from. */
export function getServerContext() {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  return { env, db };
}
