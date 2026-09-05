import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests against one real Postgres database - see
    // packages/domain/vitest.config.ts for the full rationale. Only one
    // file exists here today, but this is set proactively so a second
    // migration/schema test file added later doesn't reintroduce the same
    // cross-file truncation race.
    fileParallelism: false,
  },
});
