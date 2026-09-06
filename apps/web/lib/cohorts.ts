/**
 * Cohort management: the group-coaching container the productisation spec
 * asks for — a name, a start/end date, a coach, a roster of enrolled
 * workspaces, weekly sessions, and announcements. One global store (like
 * report-shares.ts) rather than per-workspace, because a cohort's whole
 * point is spanning many workspaces at once — there is no single workspace
 * it belongs to.
 *
 * "Coach" here is whichever user creates the cohort — they must already be
 * owner/manager of every workspace they add to it (checked at the API
 * layer, not here), consistent with enrollments.ts's "coach == manager"
 * simplification.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export interface CohortSession {
  id: string;
  title: string;
  date: string; // ISO datetime
  meetingUrl?: string;
}
export interface CohortAnnouncement {
  id: string;
  message: string;
  postedAt: string;
  postedBy: string;
}
export interface Cohort {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  coachUserId: string;
  coachEmail: string;
  programmeId: string;
  memberWorkspaceIds: string[];
  sessions: CohortSession[];
  announcements: CohortAnnouncement[];
  createdAt: string;
  /** The "programme access rules" the spec asks for: caps members to
   *  stages up to and including this order, so a paced cohort can't race
   *  ahead into content the coach hasn't covered yet. Absent = unrestricted
   *  (the pre-existing behaviour). See capStatusByStage in the engine. */
  stageAccessLimit?: number;
}
const MAX_MEMBERS = 200;
const MAX_SESSIONS = 200;
const MAX_ANNOUNCEMENTS = 200;
const MAX_TEXT = 2000;

/** True only for a real ISO-8601 calendar date/datetime the way the app stores
 *  session dates (an <input type="datetime-local"> "2026-09-15T10:00", a full
 *  "…:00.000Z", or a bare "2026-09-15"). Rejects free text ("Sept 31") and
 *  out-of-range values ("2026-13-45", "…T25:00") — a bad date would otherwise
 *  be stored and later make the reminder job's `new Date(date)` comparison
 *  meaningless (NaN / a nonsense instant), silently skipping the session so
 *  nobody is reminded (see lib/jobs.ts cohortSessionReminders). */
function isValidSessionDate(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}

/** A cohort whose endDate is in the past no longer paces its learners: its
 *  stage cap is skipped so a finished cohort can't keep members locked out of
 *  later modules forever. An unparseable endDate is treated as "not ended", so
 *  a garbage value never silently drops a live cap. */
function endDatePassed(endDate: string, now: number): boolean {
  const t = new Date(endDate).getTime();
  return Number.isFinite(t) && t < now;
}

function rowToCohort(row: {
  id: string; name: string; start_date: string; end_date: string; coach_user_id: string; coach_email: string; programme_id: string;
  member_workspace_ids: string[]; sessions: CohortSession[]; announcements: CohortAnnouncement[]; created_at: string; stage_access_limit: number | null;
}): Cohort {
  return {
    id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date,
    coachUserId: row.coach_user_id, coachEmail: row.coach_email, programmeId: row.programme_id,
    memberWorkspaceIds: row.member_workspace_ids, sessions: row.sessions, announcements: row.announcements, createdAt: row.created_at,
    ...(row.stage_access_limit != null ? { stageAccessLimit: row.stage_access_limit } : {}),
  };
}

/**
 * Row-level replacement for the old "read every cohort, mutate one in memory,
 * rewrite the whole table" pattern (see git history — readAll/writeAll under
 * an in-process lock, same shape auth.ts and workspaces.ts used before their
 * refactors). Locks just the one cohort row (`SELECT ... FOR UPDATE`),
 * confirms the caller is its coach, and hands it to `fn` for a targeted
 * UPDATE. Both "not found" and "not your cohort" collapse to the same
 * "Cohort not found." message the old code returned, so a coach can't probe
 * for the existence of cohorts they don't own. Correct across multiple server
 * instances; touches one row instead of the whole table.
 */
async function withOwnedCohort(cohortId: string, coachUserId: string, fn: (cohort: Cohort, client: import("pg").PoolClient) => Promise<Cohort | { error: string }>): Promise<Cohort | { error: string }> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query("SELECT * FROM cohorts WHERE id = $1 FOR UPDATE", [cohortId]);
    const row = res.rows[0];
    if (!row || row.coach_user_id !== coachUserId) { await client.query("ROLLBACK"); return { error: "Cohort not found." }; }
    const result = await fn(rowToCohort(row), client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}

export async function createCohort(coachUserId: string, coachEmail: string, programmeId: string, name: string, startDate: string, endDate: string): Promise<Cohort | { error: string }> {
  const cleanName = name.trim().slice(0, 200);
  if (!cleanName) return { error: "A cohort needs a name." };
  const cohort: Cohort = {
    id: randomBytes(8).toString("hex"), name: cleanName, startDate, endDate,
    coachUserId, coachEmail, programmeId, memberWorkspaceIds: [], sessions: [], announcements: [],
    createdAt: new Date().toISOString(),
  };
  await pgPool().query(
    `INSERT INTO cohorts (id, name, start_date, end_date, coach_user_id, coach_email, programme_id, member_workspace_ids, sessions, announcements, created_at, stage_access_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [cohort.id, cohort.name, cohort.startDate, cohort.endDate, cohort.coachUserId, cohort.coachEmail, cohort.programmeId,
      JSON.stringify(cohort.memberWorkspaceIds), JSON.stringify(cohort.sessions), JSON.stringify(cohort.announcements), cohort.createdAt, null],
  );
  return cohort;
}

/** Every cohort a given coach created — the only scoping this store needs,
 *  since a coach only ever manages their own cohorts. */
export async function listCohortsForCoach(coachUserId: string): Promise<Cohort[]> {
  const res = await pgPool().query("SELECT * FROM cohorts WHERE coach_user_id = $1 ORDER BY start_date ASC", [coachUserId]);
  return res.rows.map(rowToCohort);
}

/** Every cohort a given workspace belongs to — for a learner's "upcoming
 *  session" banner. Usually zero or one, but not enforced as exactly one.
 *  Filters in SQL via a jsonb membership scan instead of loading every
 *  cohort on the instance into app memory. */
export async function listCohortsForWorkspace(workspaceId: string): Promise<Cohort[]> {
  const res = await pgPool().query(
    // jsonb containment so the GIN index on member_workspace_ids (migration
    // 1786630900000) serves this instead of a full-table scan.
    "SELECT * FROM cohorts WHERE member_workspace_ids @> $1::jsonb",
    [JSON.stringify([workspaceId])],
  );
  return res.rows.map(rowToCohort);
}

/** The strictest stage cap across every ACTIVE cohort this workspace belongs
 *  to — a coach who deliberately paces one cohort shouldn't have that undone
 *  by the learner also sitting in an unrestricted one. Cohorts past their
 *  endDate are skipped (see endDatePassed) so a finished cohort stops pacing.
 *  null = no cap. */
export async function effectiveStageAccessLimit(workspaceId: string): Promise<number | null> {
  const now = Date.now();
  const cohorts = await listCohortsForWorkspace(workspaceId);
  const limits = cohorts
    .filter((c) => !endDatePassed(c.endDate, now))
    .map((c) => c.stageAccessLimit)
    .filter((n): n is number => typeof n === "number");
  return limits.length ? Math.min(...limits) : null;
}

/** Per-workspace pacing for a batch of workspaces, in ONE query — the roster
 *  equivalent of effectiveStageAccessLimit so the coach/admin dashboards don't
 *  fan out one cohort lookup per learner. For each id: the strictest cap across
 *  its ACTIVE cohorts (same endDate skip as above), and whether any active
 *  cohort still carries the migration's dormant `pacing_needs_review` flag (a
 *  cap that was auto-remapped and needs a coach to confirm — see migration
 *  1786700000000). Every requested id is present in the result. */
export interface WorkspacePacing { stageAccessLimit: number | null; pacingNeedsReview: boolean }
export async function pacingForWorkspaces(workspaceIds: string[]): Promise<Map<string, WorkspacePacing>> {
  const out = new Map<string, WorkspacePacing>();
  for (const id of workspaceIds) out.set(id, { stageAccessLimit: null, pacingNeedsReview: false });
  if (workspaceIds.length === 0) return out;
  const now = Date.now();
  const res = await pgPool().query<{ stage_access_limit: number | null; end_date: string; pacing_needs_review: boolean; member_workspace_ids: string[] }>(
    // `?|` (jsonb "exists any") is served by the cohorts_member_ws_gin index
    // (migration 1786630900000), so this touches only cohorts overlapping the
    // batch rather than the whole table.
    "SELECT stage_access_limit, end_date, pacing_needs_review, member_workspace_ids FROM cohorts WHERE member_workspace_ids ?| $1::text[]",
    [workspaceIds],
  );
  const wanted = new Set(workspaceIds);
  for (const row of res.rows) {
    if (endDatePassed(row.end_date, now)) continue; // a finished cohort neither caps nor needs pacing review
    for (const wsId of row.member_workspace_ids) {
      const acc = out.get(wsId);
      if (!acc || !wanted.has(wsId)) continue;
      if (typeof row.stage_access_limit === "number") {
        acc.stageAccessLimit = acc.stageAccessLimit === null ? row.stage_access_limit : Math.min(acc.stageAccessLimit, row.stage_access_limit);
      }
      if (row.pacing_needs_review) acc.pacingNeedsReview = true;
    }
  }
  return out;
}

export async function getCohort(cohortId: string): Promise<Cohort | null> {
  const res = await pgPool().query("SELECT * FROM cohorts WHERE id = $1", [cohortId]);
  return res.rows[0] ? rowToCohort(res.rows[0]) : null;
}

export async function addCohortMember(cohortId: string, coachUserId: string, workspaceId: string): Promise<Cohort | { error: string }> {
  return withOwnedCohort(cohortId, coachUserId, async (cohort, client) => {
    if (cohort.memberWorkspaceIds.includes(workspaceId)) return cohort;
    if (cohort.memberWorkspaceIds.length >= MAX_MEMBERS) return { error: "This cohort is full." };
    const members = [...cohort.memberWorkspaceIds, workspaceId];
    await client.query("UPDATE cohorts SET member_workspace_ids = $2 WHERE id = $1", [cohortId, JSON.stringify(members)]);
    return { ...cohort, memberWorkspaceIds: members };
  });
}

export async function removeCohortMember(cohortId: string, coachUserId: string, workspaceId: string): Promise<Cohort | { error: string }> {
  return withOwnedCohort(cohortId, coachUserId, async (cohort, client) => {
    const members = cohort.memberWorkspaceIds.filter((id) => id !== workspaceId);
    await client.query("UPDATE cohorts SET member_workspace_ids = $2 WHERE id = $1", [cohortId, JSON.stringify(members)]);
    return { ...cohort, memberWorkspaceIds: members };
  });
}

export async function addCohortSession(cohortId: string, coachUserId: string, title: string, date: string, meetingUrl?: string): Promise<Cohort | { error: string }> {
  const cleanTitle = title.trim().slice(0, MAX_TEXT);
  if (!cleanTitle) return { error: "A session needs a title." };
  // Reject an unparseable/invalid date up front, exactly as a blank title is
  // rejected: a stored bad date silently breaks the session-reminder job.
  if (!isValidSessionDate(date)) return { error: "A session needs a valid date." };
  return withOwnedCohort(cohortId, coachUserId, async (cohort, client) => {
    if (cohort.sessions.length >= MAX_SESSIONS) return { error: "Too many sessions on this cohort already." };
    const sessions = [...cohort.sessions, { id: randomBytes(6).toString("hex"), title: cleanTitle, date, meetingUrl: meetingUrl?.trim().slice(0, MAX_TEXT) || undefined }]
      .sort((a, b) => a.date.localeCompare(b.date));
    await client.query("UPDATE cohorts SET sessions = $2 WHERE id = $1", [cohortId, JSON.stringify(sessions)]);
    return { ...cohort, sessions };
  });
}

export async function setCohortStageAccessLimit(cohortId: string, coachUserId: string, stageAccessLimit: number | null): Promise<Cohort | { error: string }> {
  return withOwnedCohort(cohortId, coachUserId, async (cohort, client) => {
    await client.query("UPDATE cohorts SET stage_access_limit = $2 WHERE id = $1", [cohortId, stageAccessLimit]);
    const next = { ...cohort };
    if (stageAccessLimit === null) delete next.stageAccessLimit;
    else next.stageAccessLimit = stageAccessLimit;
    return next;
  });
}

export async function postCohortAnnouncement(cohortId: string, coachUserId: string, coachEmail: string, message: string): Promise<Cohort | { error: string }> {
  const clean = message.trim().slice(0, MAX_TEXT);
  if (!clean) return { error: "Announcement can't be empty." };
  return withOwnedCohort(cohortId, coachUserId, async (cohort, client) => {
    if (cohort.announcements.length >= MAX_ANNOUNCEMENTS) return { error: "Too many announcements on this cohort already." };
    const announcements = [...cohort.announcements, { id: randomBytes(6).toString("hex"), message: clean, postedAt: new Date().toISOString(), postedBy: coachEmail }];
    await client.query("UPDATE cohorts SET announcements = $2 WHERE id = $1", [cohortId, JSON.stringify(announcements)]);
    return { ...cohort, announcements };
  });
}

/** GDPR cascade (account deletion): permanently delete every cohort this user
 *  coaches. The stage-access cap lives ON the cohort row, so deleting the row
 *  also removes the derived cap it was imposing on OTHER learners — an orphaned
 *  cohort left behind would otherwise keep pacing them forever with no coach to
 *  lift it. Idempotent: a second call deletes nothing. Returns the count for
 *  audit/reporting. See app/api/auth/delete-account. */
export async function deleteCohortsForCoach(coachUserId: string): Promise<number> {
  const res = await pgPool().query("DELETE FROM cohorts WHERE coach_user_id = $1", [coachUserId]);
  return res.rowCount ?? 0;
}

/** GDPR cascade: drop the given (deleted) workspaces from every cohort's roster
 *  so a coach's cohort no longer references an erased learner and the
 *  session-reminder job (which resolves recipients from member_workspace_ids)
 *  can never target them. Set-based single UPDATE; the `?|` predicate is
 *  index-served and also makes this idempotent (a second call matches nothing).
 *  Returns how many cohort rosters were changed. */
export async function removeWorkspacesFromCohortRosters(workspaceIds: string[]): Promise<number> {
  if (workspaceIds.length === 0) return 0;
  const res = await pgPool().query(
    `UPDATE cohorts
        SET member_workspace_ids = COALESCE(
              (SELECT jsonb_agg(elem)
                 FROM jsonb_array_elements_text(member_workspace_ids) AS elem
                WHERE elem <> ALL($1::text[])),
              '[]'::jsonb)
      WHERE member_workspace_ids ?| $1::text[]`,
    [workspaceIds],
  );
  return res.rowCount ?? 0;
}
