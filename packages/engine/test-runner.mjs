#!/usr/bin/env node

/**
 * Test runner wrapper that ensures tests are actually executed.
 * Fails if 0 tests are found, preventing false-green CI results.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const reporterArg = args.includes("--test-reporter=spec")
  ? "--test-reporter=spec"
  : undefined;

const txsArgs = [
  "--test",
  reporterArg,
  "test/**/*.test.ts",
].filter(Boolean);

const proc = spawn("tsx", txsArgs, {
  cwd: __dirname,
  stdio: "pipe",
});

let output = "";

proc.stdout.on("data", (data) => {
  output += data.toString();
  process.stdout.write(data);
});

proc.stderr.on("data", (data) => {
  output += data.toString();
  process.stderr.write(data);
});

proc.on("close", (code) => {
  // Check if any tests were actually executed by looking for "# tests"
  const testsMatch = output.match(/^# tests (\d+)/m);
  const testsCount = testsMatch ? parseInt(testsMatch[1], 10) : 0;

  if (testsCount === 0) {
    console.error(
      "\n❌ ERROR: No tests were executed. The test suite is broken.\n" +
        "Expected to find and execute .ts test files from test/**/*.test.ts\n" +
        "This is a critical CI failure — tests must run before passing."
    );
    process.exit(1);
  }

  if (code !== 0) {
    process.exit(code);
  }
});
