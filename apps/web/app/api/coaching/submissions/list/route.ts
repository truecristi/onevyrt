import { currentUser } from "../../../../../lib/auth";
import { listForUser, listWorkspaceMemberSummaries } from "../../../../../lib/workspaces";
import { getOrCreateEnrollment } from "../../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../../lib/curriculum-store";
import { pacingForWorkspaces } from "../../../../../lib/cohorts";
import { listChapterSubmissions } from "../../../../../lib/chapter-submissions";
import { getChapter4Submission } from "../../../../../lib/chapter4-submissions";
import { chapterGates } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

const PAGE_SIZE = 25;
/** Where a chapter-4 pending item links to (this lane's own review page); for
 *  chapters 1-3 there is no dedicated per-submission page yet, so items link
 *  into the existing generic coach-review UI instead (ProgrammeCentre's
 *  "Coach review" tab, opened on the right workspace). */
const STUDIO_REVIEW_LINK = (workspaceId: string): string => `/studio?ws=${encodeURIComponent(workspaceId)}&panel=programme`;

interface PendingItem {
  submissionId: string;
  workspaceId: string;
  workspaceName: string;
  learnerEmail: string | null;
  chapter: string;
  chapterTitle: string;
  submittedAt: string;
  daysPending: number;
  reviewHref: string;
}

function daysBetween(iso: string, now: number): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/** Every submission awaiting this coach's review, across every workspace
 *  they are owner/manager of (this app's "coach's cohorts" — see
 *  lib/enrollments.ts's header) — pooled from BOTH review mechanisms this
 *  product has: the generic chapter_submissions/chapterGates path chapters
 *  1-3 use, and Chapter 4's own chapter_4_submissions table (see
 *  lib/coaching/chapter-4-review.ts's header for why Chapter 4 is separate).
 *  Sorted most-recently-submitted first; paginated 25/page; optionally
 *  filtered to one chapter via ?chapter=chapter-1|chapter-2|chapter-3|
 *  chapter-4. There is no per-submission DB row to page over (both
 *  mechanisms store at most one current document per workspace/stage), so
 *  this loads the coach's own workspace roster — never another coach's — and
 *  paginates the flattened, sorted list in memory; the same scale trade-off
 *  api/programme/coach-workspaces already makes for its own per-coach
 *  aggregation. */
export const GET = withRouteLogging("api/coaching/submissions/list:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const chapterFilter = url.searchParams.get("chapter");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const all = await listForUser(user.id);
  const coached = all
    .map((ws) => ({ ws, role: ws.members.find((m) => m.userId === user.id)?.role }))
    .filter((x): x is { ws: (typeof all)[number]; role: "owner" | "manager" } => x.role === "owner" || x.role === "manager");

  const programme = await getDefaultProgramme();
  const pacing = await pacingForWorkspaces(coached.map(({ ws }) => ws.id));

  const perWorkspace = await Promise.all(coached.map(async ({ ws }): Promise<PendingItem[]> => {
    const [enrollment, chapterSubmissions, chapter4, members] = await Promise.all([
      getOrCreateEnrollment(ws.id, user.id, programme.id),
      listChapterSubmissions(ws.id),
      getChapter4Submission(ws.id),
      listWorkspaceMemberSummaries(ws.id),
    ]);
    const learnerEmail = members.find((m) => m.role === "owner")?.email ?? null;
    const cap = pacing.get(ws.id)?.stageAccessLimit ?? null;

    const items: PendingItem[] = [];

    // Chapters 1-3 (the generic mechanism) — same gate computation
    // api/programme/coach-workspaces/route.ts already uses.
    for (const gate of chapterGates(programme, enrollment, chapterSubmissions, cap)) {
      if (gate.state !== "awaiting_review" || !gate.submission) continue;
      items.push({
        submissionId: `${ws.id}:${gate.stageId}`,
        workspaceId: ws.id, workspaceName: ws.name, learnerEmail,
        chapter: gate.stageId, chapterTitle: gate.title,
        submittedAt: gate.submission.submittedAt,
        daysPending: daysBetween(gate.submission.submittedAt, Date.now()),
        reviewHref: STUDIO_REVIEW_LINK(ws.id),
      });
    }

    // Chapter 4 (its own table — see lib/chapter4-submissions.ts).
    if (chapter4 && chapter4.status === "submitted" && chapter4.submittedAt) {
      items.push({
        submissionId: chapter4.id,
        workspaceId: ws.id, workspaceName: ws.name, learnerEmail,
        chapter: "chapter-4", chapterTitle: "Chapter 4 — Improve & Scale",
        submittedAt: chapter4.submittedAt,
        daysPending: daysBetween(chapter4.submittedAt, Date.now()),
        reviewHref: `/coaching/submissions/chapter-4/${encodeURIComponent(chapter4.id)}`,
      });
    }

    return items;
  }));

  let flat = perWorkspace.flat();
  if (chapterFilter) flat = flat.filter((it) => it.chapter === chapterFilter);
  flat.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0)); // most recent first

  const total = flat.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
  const items = flat.slice(start, start + PAGE_SIZE);

  return json({ items, page: Math.min(page, totalPages), pageSize: PAGE_SIZE, total, totalPages });
});
