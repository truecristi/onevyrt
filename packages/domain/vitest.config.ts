import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These are integration tests sharing one real Postgres database
    // (TEST_DATABASE_URL), and several truncate shared tables in their own
    // beforeEach for per-test isolation *within* a file. Running test
    // *files* in parallel would let one file's truncate wipe rows another
    // file's test just inserted - so files run sequentially here. Cases
    // within a single file remain fast; this only serializes across files.
    fileParallelism: false,
  },
});
