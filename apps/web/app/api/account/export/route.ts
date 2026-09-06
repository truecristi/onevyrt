/**
 * "Download all my data" (GDPR portability). Returns everything tied to the
 * signed-in user as one JSON file: their account (public fields only — never
 * the password hash or 2FA secrets), every workspace they belong to, and for
 * each workspace: its projects (each with in-app comments + revision
 * history), programme enrollment, cohort membership, workspace activity log,
 * chapter submissions, coach messages, what it has published to the
 * community hub, and its billing/revenue history. Plus, user-scoped: the
 * cohorts this user coaches, and their in-app notifications. Cookie-
 * authenticated and lightly rate-limited, since assembling it is a heavier
 * read than a normal request.
 *
 * SCOPE: every read below is keyed off either `user.id` directly, or one
 * `ws.id` drawn from `listForUser(user.id)` — i.e. a workspace this user is
 * actually a member of (owner, manager/coach, editor, or viewer). This never
 * reads another user's account, and never a workspace this user doesn't
 * belong to. Where a per-workspace record can itself reference other
 * people (a cohort's coach + fellow member workspaces, a coach message's
 * sender), that's included as-is because it's data this workspace's members
 * already see in the live app today (e.g. app/api/programme/enrollment
 * already returns the same unfiltered cohort record to any member) — the
 * export adds no new exposure beyond the app's existing per-workspace access
 * model.
 *
 * Two community angles are covered per workspace: everything it has itself
 * PUBLISHED to the hub (lib/community/authors.ts getAuthorProfile, which
 * aggregates lib/studio/shared-templates.ts + lib/campaign/shared-creatives.ts
 * by author workspace) as `communityContributions`, and everything it has
 * itself LEFT on any artifact — its own or anyone else's — as
 * `communityOutboundActivity` (lib/community/author-comments.ts +
 * lib/community/author-reactions.ts, which filter comments.ts's and
 * reactions.ts's tables by author_workspace_id instead of by artifact).
 *
 * That closes what used to be a real gap here: comments.ts and reactions.ts
 * are only queryable by artifact (type + id), so nowhere upstream let a
 * workspace see its own comments/"helpful" reactions left on OTHER
 * workspaces' shared items — the author-* modules add exactly that read.
 */
import { currentUser } from "../../../../lib/auth";
import { listForUser } from "../../../../lib/workspaces";
import { listProjects, loadProject } from "../../../../lib/store";
import { getEnrollment } from "../../../../lib/enrollments";
import { checkRateLimit, rateLimitHeaders } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
import { listCohortsForCoach, listCohortsForWorkspace } from "../../../../lib/cohorts";
import { listComments as listProjectComments } from "../../../../lib/comments";
import { listRevisions as listProjectRevisions } from "../../../../lib/revisions";
import { listActivity } from "../../../../lib/activity";
import { listNotifications } from "../../../../lib/notifications";
import { listLearnerMessages } from "../../../../lib/coach/messages";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { listInvoices } from "../../../../lib/stripe-billing";
import { getWorkspaceRevenue } from "../../../../lib/revenue-ledger";
import { getAuthorProfile } from "../../../../lib/community/authors";
import { listCommentsByAuthor } from "../../../../lib/community/author-comments";
import { listReactionsByAuthor } from "../../../../lib/community/author-reactions";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

/** Never let one category's failure — a workspace with nothing in it yet, a
 *  transient read error — fail the whole export. Falls back and keeps going,
 *  the same spirit as the pre-existing `.filter(Boolean)` over missing
 *  projects below. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const GET = withRouteLogging("api/account/export:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  // A heavy endpoint — cap it so it can't be used to hammer the database.
  const rl = await checkRateLimit(`data-export:${user.id}`, { windowMs: 3_600_000, max: 5 });
  if (!rl.allowed) return json({ error: "too many export requests — try again later" }, 429, rateLimitHeaders(rl));

  const workspaces = await listForUser(user.id);
  const data = {
    exportedAt: new Date().toISOString(),
    // Public User fields only (id, email, createdAt, avatarUrl) — currentUser
    // never returns the stored secrets.
    account: user,
    // Cohorts this user coaches — their own coach-owned container (see
    // lib/cohorts.ts), not tied to any single workspace, so it's user-scoped
    // rather than nested under one workspace entry below.
    cohortsCoached: await safe(() => listCohortsForCoach(user.id), []),
    // This user's in-app notifications (bell icon). User-scoped; capped at 50
    // by listNotifications itself (no limit param exposed).
    notifications: await safe(() => listNotifications(user.id), []),
    workspaces: await Promise.all(workspaces.map(async (ws) => {
      const metas = await listProjects(ws.id);
      const stripeCustomerId = ws.stripeCustomerId;

      // Each project's own comments + revision history, keyed by scopeKey —
      // confirmed to be the workspace id itself (same value passed to
      // listProjects/loadProject above), matching how
      // app/api/projects/[id]/comments and .../revisions derive `scope.wsId`.
      async function projectsWithHistory() {
        const list = await Promise.all(metas.map(async (m) => {
          const proj = await loadProject(ws.id, m.id);
          if (!proj) return null;
          const [comments, revisions] = await Promise.all([
            safe(() => listProjectComments(ws.id, m.id), []),
            safe(() => listProjectRevisions(ws.id, m.id), []),
          ]);
          return { ...proj, id: m.id, comments, revisions };
        }));
        return list.filter(Boolean);
      }

      // Everything this workspace has itself LEFT on any shared artifact —
      // its own or anyone else's — as opposed to communityContributions
      // below (what it has PUBLISHED). See lib/community/author-comments.ts
      // and lib/community/author-reactions.ts, and the file header.
      async function communityOutboundActivity() {
        const [comments, reactions] = await Promise.all([
          safe(() => listCommentsByAuthor(ws.id), []),
          safe(() => listReactionsByAuthor(ws.id), []),
        ]);
        return { comments, reactions };
      }

      const [
        projects,
        enrollment,
        cohortsAsMember,
        activityLog,
        chapterSubmissions,
        coachMessages,
        communityContributions,
        communityOutbound,
        invoices,
        revenueLedger,
      ] = await Promise.all([
        projectsWithHistory(),
        getEnrollment(ws.id),
        // Cohort(s) this workspace belongs to as a learner — usually zero or
        // one, but lib/cohorts.ts doesn't cap it at exactly one, so this is
        // an array. Full record (coach contact info, fellow member workspace
        // ids, sessions, announcements) — see the file header for why that's
        // in-scope as-is.
        safe(() => listCohortsForWorkspace(ws.id), []),
        // Collaboration/audit trail for this workspace. A generous limit
        // since this is a one-time full export, not the paginated UI feed
        // (the table itself never holds more than 200 rows per workspace
        // regardless of the limit requested).
        safe(() => listActivity(ws.id, 500), []),
        // The coach's per-chapter approval decisions + the learner's
        // submitted evidence.
        safe(() => listChapterSubmissions(ws.id), []),
        // In-app "Reach out" messages tied to this workspace — readable by
        // any of its members, whether they're the learner receiving them or
        // the coach/manager who sent them. This app has no cross-workspace
        // "coach" identity separate from a workspace's own manager role (see
        // lib/enrollments.ts's header), so a workspace this user coaches is
        // already one of the workspaces this outer loop covers — there's no
        // second, sent-by-me-elsewhere pool of coach messages to add here.
        // Capped at 50 by listLearnerMessages itself (no limit param
        // exposed).
        safe(() => listLearnerMessages(ws.id), []),
        // Funnel templates + swipe-file creatives this workspace has
        // published to the community hub, plus headline totals. What this
        // workspace left on OTHER workspaces' items (comments, reactions) is
        // covered separately below by communityOutboundActivity.
        safe(() => getAuthorProfile(ws.id), null),
        // Comments + "helpful" reactions this workspace has itself left on
        // any shared artifact — its own or anyone else's. Closes the gap
        // above: communityContributions only covers what this workspace
        // published, not what it said or endorsed elsewhere.
        communityOutboundActivity(),
        // What this workspace has paid OneVYRT (Stripe invoices) — distinct
        // from revenueLedger below (what the workspace's own funnels
        // generated). Skips cleanly to [] with no stored Stripe customer id,
        // if billing isn't configured on this server, or on any Stripe
        // error — listInvoices itself never throws, but this stays wrapped
        // in `safe` too so a change there can never turn into a 500 here.
        // limit:100 is Stripe's own per-request ceiling.
        safe(async () => {
          if (!stripeCustomerId) return [];
          const result = await listInvoices(stripeCustomerId, 100);
          return "invoices" in result ? result.invoices : [];
        }, []),
        // What this workspace's own funnels have generated in revenue,
        // per currency — durable totals, distinct from the Stripe invoices
        // above (which is what THIS workspace paid OneVYRT).
        safe(() => getWorkspaceRevenue(ws.id), []),
      ]);

      return {
        workspace: ws,
        projects,
        enrollment,
        cohortsAsMember,
        activityLog,
        chapterSubmissions,
        coachMessages,
        communityContributions,
        communityOutboundActivity: communityOutbound,
        invoices,
        revenueLedger,
      };
    })),
  };

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="onevyrt-data-${user.id}.json"`,
    },
  });
});
