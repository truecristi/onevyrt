/**
 * Wave 4 foundation: a cohort-scoped weekly coach digest. Built from the same
 * primitives as the existing instance-wide digest (classifyEngagement,
 * getDefaultProgramme/summarizeEnrollment) but grouped by each cohort's own
 * coach and roster instead of every workspace on the box, rendered as
 * HTML+text via lib/email/coach-digest-template.ts, and delivered through the
 * generic lib/notifications/bulk-sender.ts — so it comes with concurrency-
 * capped sending, per-recipient delivery tracking, and a retry queue for
 * free instead of a plain sequential loop.
 *
 * NOT wired into lib/jobs.ts yet. A "coach_digest" job already runs weekly
 * there (lib/coach/digest-run.ts's runCoachDigest), emailing every admin and
 * every workspace manager about every at-risk learner on the instance.
 * Turning this on alongside it as a second weekly job would double-email any
 * coach who is also a workspace manager — one plain-text summary from the
 * existing job, one HTML one from this. This file is deliberately prep-only:
 * Wave 4 decides whether scheduleCoachDigests replaces runCoachDigest,
 * complements it (cohort-specific detail layered on the instance-wide
 * summary), or the two get merged outright — see lib/jobs.ts for where that
 * decision plugs in.
 */
import { pgPool } from "../db";
import { getDefaultProgramme } from "../curriculum-store";
import { summarizeEnrollment, type Enrollment } from "@onevyrt/engine";
import { recordAudit } from "../audit-log";
import { classifyEngagement, type Engagement } from "./engagement";
import {
  renderCoachDigest,
  recommendedActionFor,
  type CoachDigestContent,
  type CoachDigestLearnerRow,
} from "../email/coach-digest-template";
import { sendBulkNotifications, type BulkRecipient } from "../notifications/bulk-sender";

export interface CoachDigestScheduleResult {
  /** Cohorts read, before filtering out ones that have already ended. */
  cohortsScanned: number;
  /** Distinct coaches with at least one still-active cohort. */
  coachesConsidered: number;
  /** Coaches who actually had an email delivered (a coach whose whole roster
   *  is on track is considered, but never sent to). */
  coachesNotified: number;
  /** Quiet-learner mentions across every notified coach. A learner enrolled
   *  in two coaches' cohorts is counted once per coach they're quiet for
   *  (each coach needs to see it), so this can exceed the number of distinct
   *  quiet workspaces on the instance. */
  quietLearners: number;
  sent: number;
  failed: number;
  skipped: number;
  retryQueueSize: number;
}

const SYSTEM_ACTOR = "system@coach-digest-scheduler";

/** A cohort past its end date no longer needs a weekly nudge about it — same
 *  "unparseable = not ended" rule lib/cohorts.ts's (unexported) endDatePassed
 *  uses, so a garbage date can't silently exclude a live cohort. */
function cohortStillActive(endDate: string, now: number): boolean {
  const t = new Date(endDate).getTime();
  return !Number.isFinite(t) || t >= now;
}

interface CohortRow {
  id: string;
  name: string;
  coach_user_id: string;
  coach_email: string;
  member_workspace_ids: string[];
  end_date: string;
}

/**
 * Finds every coach with at least one active cohort, works out which of
 * their learners have gone quiet, and emails each coach ONE digest covering
 * every cohort they run (not one email per cohort). Scoped to cohort member
 * workspaces only — unlike digest-run.ts's instance-wide scan, this never
 * touches a workspace that isn't on some coach's roster.
 */
export async function scheduleCoachDigests(now: Date = new Date()): Promise<CoachDigestScheduleResult> {
  const pool = pgPool();

  const allCohorts = (
    await pool.query<CohortRow>(
      "SELECT id, name, coach_user_id, coach_email, member_workspace_ids, end_date FROM cohorts",
    )
  ).rows;
  const cohorts = allCohorts.filter((c) => cohortStillActive(c.end_date, now.getTime()));

  const empty: CoachDigestScheduleResult = {
    cohortsScanned: allCohorts.length, coachesConsidered: 0, coachesNotified: 0,
    quietLearners: 0, sent: 0, failed: 0, skipped: 0, retryQueueSize: 0,
  };
  const memberWsIds = [...new Set(cohorts.flatMap((c) => c.member_workspace_ids))];
  if (cohorts.length === 0 || memberWsIds.length === 0) return empty;

  // One batched read for everything these cohorts' rosters need, instead of a
  // query per cohort or per workspace — same "read it all, filter/group in
  // JS" shape as lib/jobs.ts's cohortSessionReminders, just scoped to the
  // workspaces actually on a cohort roster rather than the whole table.
  const [wsRes, enrRes, actRes, programme] = await Promise.all([
    pool.query<{ id: string; name: string; owner_email: string | null }>(
      "SELECT w.id, w.name, u.email AS owner_email FROM workspaces w LEFT JOIN users u ON u.id = w.owner_id WHERE w.id = ANY($1::text[])",
      [memberWsIds],
    ),
    pool.query<{ workspace_id: string; enrollment: Enrollment }>(
      "SELECT workspace_id, enrollment FROM enrollments WHERE workspace_id = ANY($1::text[])",
      [memberWsIds],
    ),
    pool.query<{ ws_id: string; at: Date }>(
      "SELECT ws_id, max(at) AS at FROM activity WHERE ws_id = ANY($1::text[]) GROUP BY ws_id",
      [memberWsIds],
    ),
    getDefaultProgramme(),
  ]);

  const wsById = new Map(wsRes.rows.map((r) => [r.id, r]));
  const enrollmentByWs = new Map(enrRes.rows.map((r) => [r.workspace_id, r.enrollment]));
  const lastActivityByWs = new Map(actRes.rows.map((r) => [r.ws_id, r.at.toISOString()]));

  // Classify each workspace at most once even if it sits in several cohorts
  // (or several of the same coach's cohorts) — classifyEngagement is pure and
  // cheap, but there's no reason to redo it per cohort membership.
  const engagementCache = new Map<string, Engagement | null>();
  function engagementFor(wsId: string): Engagement | null {
    if (engagementCache.has(wsId)) return engagementCache.get(wsId) ?? null;
    const enrollment = enrollmentByWs.get(wsId);
    if (!enrollment) { engagementCache.set(wsId, null); return null; } // not enrolled in the programme — nothing to classify
    const summary = summarizeEnrollment(programme, enrollment);
    const engagement = classifyEngagement({
      percentComplete: summary.percentComplete,
      awaitingReviewCount: summary.awaitingReview.length,
      changesRequestedCount: summary.changesRequested.length,
      overdueCount: 0,
      lastActivityAt: lastActivityByWs.get(wsId) ?? null,
    });
    engagementCache.set(wsId, engagement);
    return engagement;
  }

  // Group quiet (atRisk) learners by coach email — a coach running several
  // cohorts gets ONE digest, de-duped so a workspace in two of the same
  // coach's cohorts is listed once.
  const byCoach = new Map<string, { rows: CoachDigestLearnerRow[]; wsSeen: Set<string> }>();
  let quietLearners = 0;
  for (const cohort of cohorts) {
    const email = cohort.coach_email?.trim().toLowerCase();
    if (!email) continue;
    let bucket = byCoach.get(email);
    if (!bucket) { bucket = { rows: [], wsSeen: new Set() }; byCoach.set(email, bucket); }
    for (const wsId of cohort.member_workspace_ids) {
      if (bucket.wsSeen.has(wsId)) continue;
      const engagement = engagementFor(wsId);
      if (!engagement || !engagement.atRisk) continue;
      bucket.wsSeen.add(wsId);
      const ws = wsById.get(wsId);
      quietLearners++;
      bucket.rows.push({
        // No separate "display name" exists on a user (see lib/auth.ts) — the
        // owner's email is the closest honest identifier; workspaceName is
        // the always-present label for the account itself.
        learnerName: ws?.owner_email ?? "(unknown)",
        workspaceName: ws?.name ?? "(deleted workspace)",
        daysSinceActivity: engagement.daysSinceActivity,
        status: engagement.status,
        recommendedAction: recommendedActionFor(engagement.status),
      });
    }
  }

  // Only coaches with at least one quiet learner become a send — a coach
  // whose whole roster is on track is "considered" but gets no email
  // (renderCoachDigest would refuse an empty digest anyway; skipping here too
  // avoids doing the work for what's the common, good-news case).
  const recipients: BulkRecipient[] = [];
  const digestData = new Map<string, CoachDigestContent>();
  for (const [email, bucket] of byCoach) {
    if (bucket.rows.length === 0) continue;
    recipients.push({ id: email, to: email });
    digestData.set(email, { learners: bucket.rows });
  }

  const summary = await sendBulkNotifications(recipients, renderCoachDigest, digestData);

  // The task spec for this job calls its log target "activity_log"; this
  // codebase's equivalent append-only operational record is audit_log (see
  // lib/audit-log.ts) — lib/activity.ts's `activity` table is scoped to one
  // workspace's own member-facing feed (created a project, invited someone),
  // which isn't the right home for a cross-workspace scheduler run. Logging
  // is best-effort: a logging failure must never fail the digest run itself.
  await recordAudit({
    actorEmail: SYSTEM_ACTOR,
    action: "coach_digest_scheduled",
    targetType: "coach_digest",
    targetLabel: `${byCoach.size} coach(es)`,
    detail: `${summary.sent} sent, ${summary.failed} failed, ${summary.skipped} skipped, ${quietLearners} quiet learner mention(s) across ${cohorts.length} active cohort(s).`,
  }).catch(() => { /* logging must never fail the digest run */ });

  return {
    cohortsScanned: allCohorts.length,
    coachesConsidered: byCoach.size,
    coachesNotified: summary.sent,
    quietLearners,
    sent: summary.sent,
    failed: summary.failed,
    skipped: summary.skipped,
    retryQueueSize: summary.retryQueue.length,
  };
}
