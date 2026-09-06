import test from "node:test";
import assert from "node:assert/strict";
import { tallyFromSends } from "../lib/outreach/broadcasts";

test("tallyFromSends: counts sent and failed, ignores skipped", () => {
  assert.deepEqual(
    tallyFromSends([{ status: "sent" }, { status: "sent" }, { status: "failed" }, { status: "skipped" }]),
    { sent: 2, failed: 1 },
  );
});

test("tallyFromSends: empty send log tallies to zero (a broadcast that died before sending anything)", () => {
  assert.deepEqual(tallyFromSends([]), { sent: 0, failed: 0 });
});
