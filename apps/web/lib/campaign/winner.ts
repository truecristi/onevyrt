/**
 * "Publish a winner" detection. Given the per-creative performance a workspace
 * has actually collected (leads / qualified per ad creative, see
 * lib/campaign/creatives-store), decide whether ONE creative has pulled far
 * enough ahead to confidently scale — and refuse to call a winner on noise.
 *
 * Pure and network-free so the whole decision (the thresholds that stop a
 * lucky 1-of-3 from looking like a winner) is unit-tested without a DB. The UI
 * turns a positive verdict into a nudge ("Creative X is your winner — put more
 * behind it"); this module owns the maths and the honesty.
 */

/** The slice of CreativePerformance this decision needs. Structurally
 *  compatible with lib/campaign/creatives-store's CreativePerformance. */
export interface CreativeStat {
  creativeId: string;
  headline: string;
  angle: string | null;
  leads: number;
  qualified: number;
}

export interface WinnerContender {
  creativeId: string;
  headline: string;
  angle: string | null;
  leads: number;
  qualified: number;
  /** qualified ÷ leads, 0..1 */
  rate: number;
}

export type WinnerVerdict =
  | { hasWinner: true; winner: WinnerContender; runnerUp: WinnerContender | null; lift: number; reason: string }
  | { hasWinner: false; reason: string };

export interface WinnerThresholds {
  /** Total leads across all creatives before we'll call anything. */
  minTotalLeads: number;
  /** The winner needs at least this many leads of its own. */
  minWinnerLeads: number;
  /** The winner needs at least this many qualified (a rate off 1 lead is noise). */
  minWinnerQualified: number;
  /** Winner's rate must beat the runner-up's by at least this RELATIVE margin. */
  minRelativeLift: number;
}

export const DEFAULT_WINNER_THRESHOLDS: WinnerThresholds = {
  minTotalLeads: 30,
  minWinnerLeads: 10,
  minWinnerQualified: 3,
  minRelativeLift: 0.25, // 25% better than the next best
};

const rateOf = (s: CreativeStat): number => (s.leads > 0 ? s.qualified / s.leads : 0);
const toContender = (s: CreativeStat): WinnerContender => ({
  creativeId: s.creativeId, headline: s.headline, angle: s.angle,
  leads: s.leads, qualified: s.qualified, rate: rateOf(s),
});

/**
 * Decide whether there's a creative worth scaling.
 *
 * A winner must clear every bar:
 *  - enough total signal (minTotalLeads) so the comparison isn't premature;
 *  - the top creative has its own volume (minWinnerLeads) and real outcomes
 *    (minWinnerQualified), so a 1-lead-1-qualified fluke never wins;
 *  - it beats the runner-up's qualify rate by minRelativeLift. With only one
 *    creative that has leads, there's nothing to beat, so it can still win on
 *    its own volume + outcomes (the margin test is skipped, not failed).
 */
export function detectCreativeWinner(
  stats: CreativeStat[],
  thresholds: WinnerThresholds = DEFAULT_WINNER_THRESHOLDS,
): WinnerVerdict {
  const withLeads = stats.filter((s) => s.leads > 0);
  const totalLeads = withLeads.reduce((n, s) => n + s.leads, 0);
  if (totalLeads < thresholds.minTotalLeads) {
    return { hasWinner: false, reason: `Not enough data yet — ${totalLeads}/${thresholds.minTotalLeads} leads across your creatives.` };
  }
  if (withLeads.length === 0) {
    return { hasWinner: false, reason: "No creative has any leads yet." };
  }

  // Rank by qualify rate, then by qualified volume as the tie-breaker so the
  // more-proven creative wins a rate tie.
  const ranked = [...withLeads].sort((a, b) => (rateOf(b) - rateOf(a)) || (b.qualified - a.qualified));
  const top = ranked[0]!;
  const runnerUp = ranked[1] ?? null;

  if (top.leads < thresholds.minWinnerLeads || top.qualified < thresholds.minWinnerQualified) {
    return { hasWinner: false, reason: `Your best creative needs more traffic before it's a safe bet (${top.leads} leads, ${top.qualified} qualified).` };
  }

  const winner = toContender(top);
  if (!runnerUp) {
    return {
      hasWinner: true, winner, runnerUp: null, lift: 1,
      reason: `"${winner.headline}" is converting at ${(winner.rate * 100).toFixed(0)}% with ${winner.leads} leads.`,
    };
  }

  const runnerRate = rateOf(runnerUp);
  // Relative lift over the runner-up. When the runner-up converts nobody, any
  // real winner rate is an infinite lift — treat that as a clear win.
  const lift = runnerRate > 0 ? (winner.rate - runnerRate) / runnerRate : Infinity;
  if (lift < thresholds.minRelativeLift) {
    return { hasWinner: false, reason: `No clear winner yet — your top two creatives are within ${Math.round(thresholds.minRelativeLift * 100)}% of each other.` };
  }

  const liftPct = lift === Infinity ? "∞" : `${Math.round(lift * 100)}%`;
  return {
    hasWinner: true, winner, runnerUp: toContender(runnerUp), lift,
    reason: `"${winner.headline}" is qualifying ${liftPct} better than your next creative (${(winner.rate * 100).toFixed(0)}% vs ${(runnerRate * 100).toFixed(0)}%).`,
  };
}
