import test from "node:test";
import assert from "node:assert/strict";
import { detectCreativeWinner, DEFAULT_WINNER_THRESHOLDS, type CreativeStat } from "../lib/campaign/winner";

const c = (creativeId: string, leads: number, qualified: number, headline = creativeId, angle: string | null = null): CreativeStat =>
  ({ creativeId, headline, angle, leads, qualified });

test("holds back until there's enough total signal", () => {
  const v = detectCreativeWinner([c("a", 5, 4), c("b", 5, 1)]); // 10 leads < 30
  assert.equal(v.hasWinner, false);
  assert.match(v.reason, /Not enough data|10\/30/);
});

test("won't crown a fluke: top creative needs its own volume + qualified", () => {
  // 30 total leads, but the 'winner' has only 2 leads / 1 qualified — noise.
  const v = detectCreativeWinner([c("spike", 2, 1), c("bulk", 28, 3)]);
  assert.equal(v.hasWinner, false);
  assert.match(v.reason, /more traffic|safe bet/i);
});

test("declares a winner when one creative clearly beats the runner-up", () => {
  const v = detectCreativeWinner([
    c("win", 40, 16, "Free audit, real results"), // 40% qualify
    c("mid", 40, 8, "Book a call"),               // 20% qualify → win is +100%
  ]);
  assert.equal(v.hasWinner, true);
  if (v.hasWinner) {
    assert.equal(v.winner.creativeId, "win");
    assert.equal(v.runnerUp?.creativeId, "mid");
    assert.ok(v.lift >= 0.9 && v.lift <= 1.1, `~100% lift, got ${v.lift}`);
    assert.match(v.reason, /Scale it|better/);
  }
});

test("refuses when the top two are within the margin", () => {
  const v = detectCreativeWinner([
    c("a", 40, 12), // 30%
    c("b", 40, 11), // 27.5% → only ~9% better, under the 25% bar
  ]);
  assert.equal(v.hasWinner, false);
  assert.match(v.reason, /No clear winner|within/i);
});

test("a runner-up that converts nobody makes any real winner an infinite lift", () => {
  const v = detectCreativeWinner([c("win", 30, 9), c("dud", 30, 0)]);
  assert.equal(v.hasWinner, true);
  if (v.hasWinner) { assert.equal(v.lift, Infinity); assert.match(v.reason, /∞/); }
});

test("a single creative can win on its own volume when there's nothing to compare", () => {
  const v = detectCreativeWinner([c("solo", 40, 12, "Only ad")]);
  assert.equal(v.hasWinner, true);
  if (v.hasWinner) { assert.equal(v.runnerUp, null); assert.equal(v.lift, 1); }
});

test("rate ties break toward the more-proven (more qualified) creative", () => {
  // Same 30% rate; 'proven' has more qualified so it should rank first. Neither
  // beats the other on rate, so there's no winner — but the tie-break still
  // decides which is 'top' for the volume/margin checks.
  const v = detectCreativeWinner([c("proven", 100, 30), c("small", 40, 12)]);
  assert.equal(v.hasWinner, false, "identical rate → no margin → no winner");
});

test("default thresholds are the documented values", () => {
  assert.deepEqual(DEFAULT_WINNER_THRESHOLDS, { minTotalLeads: 30, minWinnerLeads: 10, minWinnerQualified: 3, minRelativeLift: 0.25 });
});
