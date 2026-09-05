import type { Config } from "drizzle-kit";

/**
 * Config for `drizzle-kit generate` going forward. Migration 0000 was
 * hand-written to bootstrap the repo (see migrations/0000_init.sql's
 * header comment); every migration after it should be generated from
 * schema.ts changes with this config so the two never drift silently.
 */
export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:onevyrt@127.0.0.1:5432/onevyrt_dev",
  },
} satisfies Config;
