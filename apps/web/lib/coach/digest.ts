/**
 * Digest email body builder — the "proactive alert" half of the engagement
 * console (lib/coach/engagement.ts is the "who's stuck and why" half it reads
 * from). Pure and dependency-free (no DB, no React, no mail provider): given
 * one recipient's learner list, it decides whether they need an email at all
 * and, if so, writes the plaintext body naming who's gone quiet, grouped by
 * how quiet. The caller (the cron digest route) decides who receives which
 * list and does the actual sending — this only decides what the email says.
 */
import type { Engagement } from "./engagement";

export interface DigestLearner {
  workspaceName: string;
  percentComplete: number;
  lastActivityAt: string | null;
  engagement: Engagement;
}

export interface Digest {
  atRiskCount: number;
  subject: string;
  text: string;
}

/** Group headings, in urgency order — mirrors the attention weighting in
 *  classifyEngagement, where dormant outranks idle, which outranks
 *  never_started. */
const GROUPS: ReadonlyArray<{ heading: string; status: Engagement["status"] }> = [
  { heading: "Gone quiet", status: "dormant" },
  { heading: "Idle", status: "idle" },
  { heading: "Not started", status: "never_started" },
];

/**
 * Builds one recipient's digest email from their learner list. Returns null
 * when nobody on the list is actually at risk, so "nothing to report" reads
 * as "no email" rather than an empty or falsely-cheerful one — never send an
 * empty digest.
 */
export function buildDigest(learners: DigestLearner[]): Digest | null {
  const atRisk = learners.filter((l) => l.engagement.atRisk);
  if (atRisk.length === 0) return null;

  const atRiskCount = atRisk.length;
  const one = atRiskCount === 1;
  const lines: string[] = [`${atRiskCount} learner${one ? "" : "s"} need${one ? "s" : ""} a nudge this week.`];

  for (const group of GROUPS) {
    const inGroup = atRisk.filter((l) => l.engagement.status === group.status);
    if (inGroup.length === 0) continue;
    lines.push("", `${group.heading}:`);
    for (const l of inGroup) {
      lines.push(`• ${l.workspaceName} — ${l.engagement.label}, ${l.percentComplete}% done`);
    }
  }

  lines.push("", "Reach out from your console: /businesses (your clients) or /admin/learners (everyone).");

  return {
    atRiskCount,
    subject: `${atRiskCount} learner${one ? " has" : "s have"} gone quiet`,
    text: lines.join("\n"),
  };
}
