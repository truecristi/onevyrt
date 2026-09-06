/**
 * The coach digest, as a reusable run — shared by the jobs engine (lib/jobs.ts,
 * so it fires on the existing cron tick with no extra host config) and the
 * manual POST /api/cron/digest (so an admin can fire it by hand). Keeping the
 * gather-and-send here, and the pure email formatting in ./digest, lets the
 * formatter stay unit-tested without a database while this side owns the DB.
 *
 * Finds every at-risk learner on the instance (see ./engagement) and emails the
 * people who can act — every platform admin gets everyone; each manager gets the
 * clients they coach — de-duped per recipient. Learners themselves are never on
 * this list (that's staleProgrammeNudges' job).
 */
import { adminEmails } from "../admin";
import { listAllWorkspaces, type Workspace } from "../workspaces";
import { pgPool } from "../db";
import { getDefaultProgramme } from "../curriculum-store";
import { summarizeEnrollment, type Enrollment } from "@onevyrt/engine";
import { getUserById } from "../auth";
import { classifyEngagement } from "./engagement";
import { buildDigest, type DigestLearner } from "./digest";
import { sendMail } from "../mailer";

export interface CoachDigestResult { atRisk: number; recipients: number; sent: number; }

interface AtRiskEntry { ws: Workspace; learner: DigestLearner; }

export async function runCoachDigest(): Promise<CoachDigestResult> {
  // Gather every enrolled learner — same shape as /api/admin/learners: all
  // workspaces, all enrollments, latest activity batched per enrolled workspace,
  // one programme fetch reused for all.
  const workspaces = await listAllWorkspaces();
  const wsById = new Map(workspaces.map((ws) => [ws.id, ws]));

  const enr = await pgPool().query<{ workspace_id: string; enrollment: Enrollment }>(
    "SELECT workspace_id, enrollment FROM enrollments",
  );

  const ids = enr.rows.map((row) => row.workspace_id);
  const actRows = ids.length
    ? (await pgPool().query<{ ws_id: string; at: Date }>(
        "SELECT ws_id, max(at) AS at FROM activity WHERE ws_id = ANY($1) GROUP BY ws_id",
        [ids],
      )).rows
    : [];
  const lastActivityByWsId = new Map(actRows.map((row) => [row.ws_id, (row.at as Date).toISOString()]));

  const programme = await getDefaultProgramme();

  // Keep only the at-risk ones — nobody on track or completed ever needs an email.
  const atRiskEntries: AtRiskEntry[] = [];
  for (const row of enr.rows) {
    const ws = wsById.get(row.workspace_id);
    if (!ws) continue; // Enrollment for a workspace that's since been deleted.
    const summary = summarizeEnrollment(programme, row.enrollment);
    const lastActivityAt = lastActivityByWsId.get(row.workspace_id) ?? null;
    const engagement = classifyEngagement({
      percentComplete: summary.percentComplete,
      awaitingReviewCount: summary.awaitingReview.length,
      changesRequestedCount: summary.changesRequested.length,
      overdueCount: 0,
      lastActivityAt,
    });
    if (!engagement.atRisk) continue;
    atRiskEntries.push({ ws, learner: { workspaceName: ws.name, percentComplete: summary.percentComplete, lastActivityAt, engagement } });
  }

  // Recipient map: every admin gets every at-risk learner; each at-risk
  // workspace's manager(s) get just their own. Keyed by lowercased email so an
  // admin who is also a manager gets one email with no duplicate workspace rows.
  const recipients = new Map<string, { learners: DigestLearner[]; wsIds: Set<string> }>();
  function addLearner(email: string | null, wsId: string, learner: DigestLearner): void {
    if (!email) return;
    const key = email.trim().toLowerCase();
    if (!key) return;
    let bucket = recipients.get(key);
    if (!bucket) { bucket = { learners: [], wsIds: new Set() }; recipients.set(key, bucket); }
    if (bucket.wsIds.has(wsId)) return;
    bucket.wsIds.add(wsId);
    bucket.learners.push(learner);
  }

  for (const email of adminEmails()) {
    for (const { ws, learner } of atRiskEntries) addLearner(email, ws.id, learner);
  }

  const managerEmailCache = new Map<string, string | null>();
  for (const { ws, learner } of atRiskEntries) {
    for (const member of ws.members) {
      if (member.role !== "manager") continue;
      let email = managerEmailCache.get(member.userId);
      if (email === undefined) {
        const user = await getUserById(member.userId);
        email = user?.email ?? null;
        managerEmailCache.set(member.userId, email);
      }
      addLearner(email, ws.id, learner);
    }
  }

  let sent = 0;
  for (const [email, bucket] of recipients) {
    const d = buildDigest(bucket.learners);
    if (!d) continue;
    const result = await sendMail({ to: email, subject: d.subject, text: d.text });
    if (result.sent) sent++;
  }

  return { atRisk: atRiskEntries.length, recipients: recipients.size, sent };
}
