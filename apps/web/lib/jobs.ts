/**
 * The jobs engine: a small in-process registry, ticked by an external
 * caller (see app/api/cron/tick/route.ts) rather than a self-scheduling
 * timer — this app runs as a single container with no separate worker
 * process, so "cron hits an API route" (already the proven pattern for
 * healthcheck-alert.sh/error-alert.sh at the host level) is the realistic
 * shape here, not an in-process setInterval that would silently stop
 * doing anything useful the moment the one container restarts.
 *
 * Each job is idempotent by construction: it computes a deterministic
 * dedupeKey per notification (see lib/notifications.ts) rather than
 * relying on job_runs alone to prevent duplicates, so re-running a job
 * that partially failed never double-notifies anyone. job_runs exists
 * purely as a cheap "don't bother re-scanning yet" gate.
 */
import { pgPool } from "./db";
import { createNotification } from "./notifications";
import { sendMail } from "./mailer";
import { isNotificationAllowed } from "./email-preferences";
import { dispatchDueBroadcasts } from "./outreach/broadcasts";
import { purgeExpiredProjects } from "./store";
import { purgeExpiredRows } from "./soft-delete";
import { purgeExpiredLeadsAndBookings } from "./acquisition/leads";
import { purgeExpiredOtpVerifications } from "./acquisition/otp";
import { pruneFunnelEvents } from "./acquisition/funnel-events";
import { runCoachDigest } from "./coach/digest-run";
import { createWorkflowExecution, updateWorkflowExecution, evaluateConditions, executeActions } from "./workflows";
import { processScheduledExports, cleanupExpiredData, enforceDataRetention } from "./data-management/jobs";
import type { Enrollment } from "@onevyrt/engine";

interface JobResult { created: number; }
interface Job { key: string; intervalHours: number; run: () => Promise<JobResult>; }

export async function dueJobKeys(keys: string[], intervalHoursOf: Map<string, number>): Promise<Set<string>> {
  const res = await pgPool().query<{ job_key: string; last_run_at: Date }>(
    "SELECT job_key, last_run_at FROM job_runs WHERE job_key = ANY($1::text[])", [keys],
  );
  const lastRun = new Map(res.rows.map((r) => [r.job_key, r.last_run_at.getTime()]));
  const due = new Set<string>();
  for (const key of keys) {
    const last = lastRun.get(key);
    const intervalMs = (intervalHoursOf.get(key) ?? 24) * 3600_000;
    if (last == null || Date.now() - last >= intervalMs) due.add(key);
  }
  return due;
}
export async function markRun(key: string): Promise<void> {
  await pgPool().query(
    "INSERT INTO job_runs (job_key, last_run_at) VALUES ($1, now()) ON CONFLICT (job_key) DO UPDATE SET last_run_at = now()",
    [key],
  );
}

/** Notifies every member of every cohort about a session starting within
 *  the next REMINDER_WINDOW_HOURS — coach and roster alike, since both
 *  need the same heads-up. Reads the whole (small) cohorts table, same
 *  "read it all, filter in JS" pattern lib/cohorts.ts already uses. */
const SESSION_REMINDER_WINDOW_HOURS = 30; // a bit over one day, so a daily tick can't skip a session that lands just past the last window
async function cohortSessionReminders(): Promise<JobResult> {
  const pool = pgPool();
  const cohorts = await pool.query<{
    id: string; name: string; coach_user_id: string; coach_email: string; member_workspace_ids: string[];
    sessions: { id: string; title: string; date: string; meetingUrl?: string }[];
  }>("SELECT id, name, coach_user_id, coach_email, member_workspace_ids, sessions FROM cohorts");

  const now = Date.now();
  const windowMs = SESSION_REMINDER_WINDOW_HOURS * 3600_000;
  let created = 0;

  for (const cohort of cohorts.rows) {
    const upcoming = cohort.sessions.filter((s) => {
      const t = new Date(s.date).getTime();
      return t > now && t - now <= windowMs;
    });
    if (upcoming.length === 0) continue;

    // Recipients: the coach, plus the current owner of every member workspace.
    // workspaceId is undefined for the coach — they aren't a member of any of
    // these workspaces, just the one running the session, so there's no
    // per-workspace email_preferences row to gate their own copy against
    // (see the preference check below).
    const recipients = new Map<string, { email: string; workspaceId?: string }>(); // userId -> recipient
    recipients.set(cohort.coach_user_id, { email: cohort.coach_email });
    if (cohort.member_workspace_ids.length > 0) {
      const owners = await pool.query<{ id: string; owner_id: string; email: string }>(
        `SELECT w.id, w.owner_id, u.email FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE w.id = ANY($1::text[])`,
        [cohort.member_workspace_ids],
      );
      for (const o of owners.rows) recipients.set(o.owner_id, { email: o.email, workspaceId: o.id });
    }

    for (const session of upcoming) {
      const when = new Date(session.date).toLocaleString();
      const title = `Upcoming: ${session.title}`;
      const body = `${cohort.name} — "${session.title}" starts ${when}.${session.meetingUrl ? ` Join: ${session.meetingUrl}` : ""}`;
      for (const [userId, { email, workspaceId }] of recipients) {
        // Only a workspace owner's copy is preference-gated (their own
        // "reminder emails" toggle) — the coach's copy is operational
        // information about a session they're running, not something a
        // per-workspace preference naturally covers.
        if (workspaceId && !(await isNotificationAllowed(workspaceId, "reminder"))) continue;
        const notification = await createNotification({
          userId, type: "cohort_session_reminder", title, body,
          dedupeKey: `cohort_session:${session.id}:${userId}`,
        });
        if (notification) {
          created++;
          await sendMail({ to: email, subject: title, text: body });
        }
      }
    }
  }
  return { created };
}

/** Nudges a workspace's owner back to the programme once nobody has
 *  touched a lesson in STALE_DAYS — computed from the enrollment's own
 *  timestamps (its own startedAt, each lesson's startedAt, each
 *  submission's submittedAt), not a separate activity table. Once per
 *  ISO week per workspace (the dedupeKey's bucket), so a workspace that
 *  stays stale for a month gets one nudge a week, not one a day. */
const STALE_DAYS = 10;
export function isoWeekBucket(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}
export function lastActivity(e: Enrollment): number {
  let latest = new Date(e.startedAt).getTime();
  for (const lesson of e.lessons) {
    if (lesson.startedAt) latest = Math.max(latest, new Date(lesson.startedAt).getTime());
    for (const sub of lesson.submissions) latest = Math.max(latest, new Date(sub.submittedAt).getTime());
  }
  return latest;
}
async function staleProgrammeNudges(): Promise<JobResult> {
  const pool = pgPool();
  const rows = await pool.query<{ workspace_id: string; enrollment: Enrollment }>(
    "SELECT workspace_id, enrollment FROM enrollments",
  );
  const staleCutoff = Date.now() - STALE_DAYS * 86400_000;
  const bucket = isoWeekBucket(new Date());
  let created = 0;

  // Pass 1: decide which enrollments are stale (pure in-memory, no DB), keeping
  // the original row order so the createNotification/dedupe sequence below is
  // identical to the previous per-row version.
  const stale = rows.rows.filter((row) => {
    const e = row.enrollment;
    if (e.accessGranted === false) return false; // paused access — a nudge would be actively wrong here
    return lastActivity(e) <= staleCutoff;
  });

  // Pass 2: one batched owner lookup for every stale workspace instead of a
  // query per row (the N+1). Keyed by workspace id; a workspace whose owner row
  // is absent simply won't be in the map, matching the old `if (!o) continue`.
  const workspaceIds = [...new Set(stale.map((row) => row.workspace_id))];
  const owners = new Map<string, { owner_id: string; email: string; name: string }>();
  if (workspaceIds.length > 0) {
    const res = await pool.query<{ id: string; owner_id: string; email: string; name: string }>(
      "SELECT w.id, w.owner_id, u.email, w.name FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE w.id = ANY($1::text[])",
      [workspaceIds],
    );
    for (const r of res.rows) owners.set(r.id, { owner_id: r.owner_id, email: r.email, name: r.name });
  }

  for (const row of stale) {
    const o = owners.get(row.workspace_id);
    if (!o) continue;
    if (!(await isNotificationAllowed(row.workspace_id, "reminder"))) continue;

    const title = "Pick up where you left off";
    const body = `It's been over ${STALE_DAYS} days since any activity on the Growth Program for "${o.name}". Jump back in when you're ready.`;
    const notification = await createNotification({
      userId: o.owner_id, workspaceId: row.workspace_id, type: "programme_stale", title, body,
      dedupeKey: `programme_stale:${row.workspace_id}:${bucket}`,
    });
    if (notification) {
      created++;
      await sendMail({ to: o.email, subject: title, text: body });
    }
  }
  return { created };
}

/** Weekly "who's gone quiet" digest to coaches and admins — the push
 *  counterpart to staleProgrammeNudges (which nudges the quiet LEARNER):
 *  this instead tells the people COACHING them who to reach out to. Weekly
 *  so it's a summary, not a firehose; the job_runs interval gate keeps it to
 *  once a week even if the tick runs every minute. `created` = emails sent.
 *
 *  See lib/coach/digest-scheduler.ts's scheduleCoachDigests for a Wave 4
 *  cohort-scoped alternative (HTML+text via lib/email/coach-digest-template.ts,
 *  delivered through lib/notifications/bulk-sender.ts) — built but
 *  deliberately not wired in here yet: running both would double-email any
 *  coach who is also a workspace manager. */
async function coachDigest(): Promise<JobResult> {
  const r = await runCoachDigest();
  return { created: r.sent };
}

/** Fire any broadcasts whose scheduled time has passed. Unlike the notify
 *  jobs this wants to run on (almost) every tick so a scheduled send goes out
 *  promptly; the tiny interval just caps it to roughly once a minute even if
 *  cron ticks faster. dispatchDueBroadcasts claims each broadcast atomically,
 *  so running it back-to-back never double-sends. `created` = how many fired. */
async function scheduledBroadcasts(): Promise<JobResult> {
  return { created: await dispatchDueBroadcasts() };
}

/** Empty the bin: hard-delete funnels that have sat soft-deleted longer than the
 *  30-day retention window. `created` = how many were purged. Idempotent — a
 *  second run in the same day simply finds nothing left to remove. */
async function purgeBin(): Promise<JobResult> {
  const funnels = await purgeExpiredProjects();
  const rest = await purgeExpiredRows(); // segments, campaigns
  return { created: funnels + rest };
}

/** Prune raw funnel_events past the retention window. Counts live in the
 *  funnel_event_daily rollup, so this frees the high-volume table without
 *  touching any reported number. `created` = rows removed. */
async function pruneFunnelEventsJob(): Promise<JobResult> {
  return { created: await pruneFunnelEvents() };
}

/** Empty the leads/bookings bin: hard-delete leads, bookings, and lead_events
 *  that have sat soft-deleted (see lib/acquisition/leads.ts deleted_at —
 *  stamped by the GDPR cascade on account/workspace deletion) longer than the
 *  retention window. The Acquisition OS's counterpart to purgeBin above; same
 *  shape. `created` = how many rows were purged. Idempotent — a second run
 *  the same day simply finds nothing left in the window to remove. */
async function purgeLeadsBin(): Promise<JobResult> {
  return { created: await purgeExpiredLeadsAndBookings() };
}

/** Purge OTP verification rows (see lib/acquisition/otp.ts) past their
 *  retention window — a captured email/phone otherwise had no retention path
 *  at all. Same shape as pruneFunnelEventsJob; `created` = rows removed. */
async function purgeOtpVerificationsJob(): Promise<JobResult> {
  return { created: await purgeExpiredOtpVerifications() };
}

/** Execute scheduled workflows. Scans all workflows with trigger type "schedule"
 *  and runs those whose cron expression indicates they are due. `created` = how
 *  many workflow executions were created and run. */
async function executeScheduledWorkflows(): Promise<JobResult> {
  const pool = pgPool();
  const workflowsRes = await pool.query<{
    id: string;
    workspace_id: string;
    trigger_type: string;
    trigger_config: unknown;
    conditions: unknown;
    actions: unknown;
    enabled: boolean;
  }>(
    "SELECT id, workspace_id, trigger_type, trigger_config, conditions, actions, enabled FROM workflows WHERE trigger_type = 'schedule' AND enabled = true",
  );

  let created = 0;
  const now = new Date();
  const lastRunMap = new Map<string, Date>();

  // Get last run times
  const lastRunRes = await pool.query<{ workflow_id: string; last_run_at: Date }>(
    "SELECT workflow_id, last_run_at FROM workflow_runs WHERE workflow_id = ANY($1::text[])",
    [workflowsRes.rows.map((r) => r.id)],
  );
  for (const row of lastRunRes.rows) lastRunMap.set(row.workflow_id, row.last_run_at);

  for (const workflow of workflowsRes.rows) {
    // Simple schedule check: if schedule says "daily", run once per day
    const config = (workflow.trigger_config ?? {}) as Record<string, unknown>;
    const schedule = String(config.schedule ?? "0 0 * * *"); // Default to daily at midnight

    // For now, support simple schedules: "daily", "weekly", "hourly"
    // In production, would use cron parser library
    const lastRun = lastRunMap.get(workflow.id) ?? new Date(0);
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / 3600_000;
    let shouldRun = false;

    if (schedule === "daily" || schedule === "0 0 * * *") {
      shouldRun = hoursSinceLastRun >= 24;
    } else if (schedule === "weekly" || schedule === "0 0 * * 1") {
      shouldRun = hoursSinceLastRun >= 168;
    } else if (schedule === "hourly") {
      shouldRun = hoursSinceLastRun >= 1;
    }

    if (!shouldRun) continue;

    try {
      const conditions = (workflow.conditions ?? []) as any[];
      const actions = (workflow.actions ?? []) as any[];

      // Create execution
      const execution = await createWorkflowExecution({
        workflowId: workflow.id,
        workspaceId: workflow.workspace_id,
      });

      // Evaluate conditions
      if (conditions.length > 0 && !evaluateConditions(conditions, {})) {
        await updateWorkflowExecution(execution.id, {
          status: "success",
          executedAt: new Date().toISOString(),
        });
      } else {
        // Execute actions
        const actionResults = await executeActions(actions, {}, workflow.workspace_id);
        await updateWorkflowExecution(execution.id, {
          status: actionResults.some((r) => r.status === "failed") ? "failed" : "success",
          actionResults,
          executedAt: new Date().toISOString(),
        });
      }

      // Update last run time
      await pool.query(
        "INSERT INTO workflow_runs (workflow_id, last_run_at) VALUES ($1, now()) ON CONFLICT (workflow_id) DO UPDATE SET last_run_at = now()",
        [workflow.id],
      );

      created++;
    } catch (error) {
      console.error(`Error executing scheduled workflow ${workflow.id}:`, error);
    }
  }

  return { created };
}

/** Daily why/creed motivational reminders at 9am UTC to workspace owners.
 *  Each owner who has set their why/creed receives one notification per day,
 *  deduplicated by ISO date bucket. Runs every 6 hours, but only sends during
 *  the 9-10am UTC window (handles job execution timing variance). */
async function whyCreedReminders(): Promise<JobResult> {
  const pool = pgPool();
  const now = new Date();
  const nineAmUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0));
  const tenAmUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0));

  // Only send during 9-10am UTC window
  if (now < nineAmUTC || now >= tenAmUTC) {
    return { created: 0 };
  }

  // ISO date bucket for deduplication (one reminder per calendar day per owner)
  const dateBucket = now.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const rows = await pool.query<{
      workspace_id: string;
      owner_id: string;
      owner_email: string;
      why: string;
      creed: string;
    }>(
      `SELECT w.id as workspace_id, w.owner_id, u.email as owner_email, wc.why, wc.creed
       FROM workspaces w
       JOIN users u ON u.id = w.owner_id
       JOIN workspace_why_creed wc ON wc.workspace_id = w.id AND wc.deleted_at IS NULL
       WHERE w.deleted_at IS NULL`,
    );

    let created = 0;
    for (const row of rows.rows) {
      if (!(await isNotificationAllowed(row.workspace_id, "reminder"))) continue;
      const title = "Remember Your Why";
      const body = `Why: ${row.why}\n\nCreed: ${row.creed}\n\nLet this fuel your decisions today.`;
      const notification = await createNotification({
        userId: row.owner_id,
        workspaceId: row.workspace_id,
        type: "why_creed_reminder",
        title,
        body,
        dedupeKey: `why_creed_reminder:${row.workspace_id}:${dateBucket}`,
      });
      if (notification) {
        created++;
        await sendMail({ to: row.owner_email, subject: title, text: body });
      }
    }
    return { created };
  } catch (error) {
    console.error("Error in whyCreedReminders:", error);
    return { created: 0 };
  }
}

/** Weekly digest sent to coaches every Sunday at 7pm UTC.
 *  Summarizes learner activity and progress for the week. Runs every 24 hours,
 *  but only sends on Sundays between 7-8pm UTC. Deduplicated per ISO week.
 *
 *  Not preference-gated, unlike the workspace-owner-facing jobs above:
 *  email_preferences is strictly per-workspace (see lib/email-preferences.ts's
 *  own header comment), and a coach isn't a member of any single workspace
 *  this digest could check against — they coach many. There's no per-coach
 *  preference row to gate this against today; a real gap, left open rather
 *  than silently mis-checking some arbitrary workspace's toggle. */
async function weeklyDigest(): Promise<JobResult> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const seventhPmUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19, 0, 0));
  const eighthPmUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));

  // Only send on Sundays between 7-8pm UTC
  if (dayOfWeek !== 0 || now < seventhPmUTC || now >= eighthPmUTC) {
    return { created: 0 };
  }

  // ISO week bucket matching staleProgrammeNudges pattern (one digest per week)
  const bucket = isoWeekBucket(now);

  const pool = pgPool();
  try {
    const coachesRes = await pool.query<{ user_id: string; email: string }>(
      "SELECT DISTINCT coach_user_id as user_id, coach_email as email FROM cohorts WHERE coach_user_id IS NOT NULL",
    );

    let created = 0;
    for (const coach of coachesRes.rows) {
      const title = "Weekly Learner Activity Digest";
      const body = "Here's this week's summary of learner progress across your cohorts.\n\nLog in to the coaching hub to see detailed activity and approvals pending.";
      const notification = await createNotification({
        userId: coach.user_id,
        type: "weekly_digest",
        title,
        body,
        dedupeKey: `weekly_digest:${coach.user_id}:${bucket}`,
      });
      if (notification) {
        created++;
        await sendMail({ to: coach.email, subject: title, text: body });
      }
    }
    return { created };
  } catch (error) {
    console.error("Error in weeklyDigest:", error);
    return { created: 0 };
  }
}

/** Bi-weekly reflection prompts to workspace owners.
 *  Encourages owners to reflect on progress every 14 days. Uses job_runs interval
 *  gate for scheduling (runs once every 336 hours / 14 days). Deduplication via
 *  month bucket ensures at most one prompt per calendar month. Includes retry logic:
 *  if send fails, next job run (14 days later) will retry the same users. */
async function reflectionCheck(): Promise<JobResult> {
  const pool = pgPool();
  const now = new Date();
  const monthBucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM

  try {
    const rows = await pool.query<{
      workspace_id: string;
      owner_id: string;
      owner_email: string;
    }>(
      "SELECT w.id as workspace_id, w.owner_id, u.email as owner_email FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE w.deleted_at IS NULL",
    );

    let created = 0;
    for (const row of rows.rows) {
      if (!(await isNotificationAllowed(row.workspace_id, "reminder"))) continue;
      const title = "Time to Reflect";
      const body = "Take 10 minutes to review your progress over the last two weeks.\n\nWhat's working? What's not? What adjustments will you make this week?";
      const notification = await createNotification({
        userId: row.owner_id,
        workspaceId: row.workspace_id,
        type: "reflection_check",
        title,
        body,
        dedupeKey: `reflection_check:${row.workspace_id}:${monthBucket}`,
      });
      if (notification) {
        created++;
        await sendMail({ to: row.owner_email, subject: title, text: body });
      }
    }
    return { created };
  } catch (error) {
    console.error("Error in reflectionCheck:", error);
    return { created: 0 };
  }
}

const JOBS: Job[] = [
  { key: "scheduled_broadcasts", intervalHours: 1 / 60, run: scheduledBroadcasts },
  { key: "scheduled_workflows", intervalHours: 1, run: executeScheduledWorkflows },
  { key: "cohort_session_reminders", intervalHours: 6, run: cohortSessionReminders },
  { key: "stale_programme_nudges", intervalHours: 24, run: staleProgrammeNudges },
  { key: "coach_digest", intervalHours: 168, run: coachDigest },
  { key: "purge_deleted_funnels", intervalHours: 24, run: purgeBin },
  { key: "prune_funnel_events", intervalHours: 24, run: pruneFunnelEventsJob },
  { key: "purge_deleted_leads", intervalHours: 24, run: purgeLeadsBin },
  { key: "purge_otp_verifications", intervalHours: 24, run: purgeOtpVerificationsJob },
  // Motivational & coaching reminders
  { key: "why_creed_reminders", intervalHours: 6, run: whyCreedReminders },
  { key: "weekly_digest", intervalHours: 24, run: weeklyDigest },
  { key: "reflection_check", intervalHours: 336, run: reflectionCheck },
  // Data management system jobs
  { key: "scheduled_exports", intervalHours: 1, run: processScheduledExports },
  { key: "cleanup_expired_data", intervalHours: 24, run: cleanupExpiredData },
  { key: "enforce_data_retention", intervalHours: 24, run: enforceDataRetention },
];

export interface JobRunSummary { key: string; ran: boolean; created?: number; error?: string; }

/** Runs every job whose interval has elapsed since its last run. Never
 *  throws — a single job's failure is reported in its own summary entry
 *  and does not stop the others from running. */
export async function runDueJobs(): Promise<JobRunSummary[]> {
  const due = await dueJobKeys(JOBS.map((j) => j.key), new Map(JOBS.map((j) => [j.key, j.intervalHours])));
  const summaries: JobRunSummary[] = [];
  for (const job of JOBS) {
    if (!due.has(job.key)) { summaries.push({ key: job.key, ran: false }); continue; }
    try {
      const result = await job.run();
      await markRun(job.key);
      summaries.push({ key: job.key, ran: true, created: result.created });
    } catch (e) {
      summaries.push({ key: job.key, ran: true, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
  return summaries;
}
