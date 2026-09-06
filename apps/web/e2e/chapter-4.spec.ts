import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { pgPool } from "../lib/db";
import { getChapter4SubchapterByCode } from "../lib/chapter-4";
import { getRequirementsForLesson } from "../lib/lesson-requirements";
import { uid, registerNewAccount, cleanupAccount } from "./helpers";

/**
 * Chapter 4 (IMPROVE & SCALE) end-to-end: a learner walks all 5 subchapters,
 * submits the chapter's Growth & Improvement Plan for review, a coach
 * approves it, and the learner sees it reflected in their Transformation
 * Report — proving the real browser flow on top of what
 * test/chapter-4.test.ts already proves at the server/DB level (the gate
 * chain, the migration, the notification builders).
 *
 * Chapters 1-3 are seeded straight through Postgres (already-approved lessons
 * + chapter submissions) rather than driven through the UI — that path is
 * covered by the existing chapter/lesson submit-review mechanics this reuses
 * unchanged; this spec's job is Chapter 4 itself. The coach is added to the
 * workspace only AFTER the learner finishes Chapter 4's own 5 lessons, so
 * those still self-approve on the (at that point still coach-less) self-paced
 * track — adding the coach any earlier would leave lesson 4.2 locked behind
 * an unreviewed 4.1, which is a real product rule (see lib/enrollments.ts's
 * submitAssignment) this spec must respect, not fight.
 */

async function workspaceIdFor(email: string): Promise<string> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!u.rows[0]) throw new Error(`no user for ${email}`);
  const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [u.rows[0].id]);
  if (!w.rows[0]) throw new Error(`no workspace for ${email}`);
  return w.rows[0].id;
}
async function userIdFor(email: string): Promise<string> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!u.rows[0]) throw new Error(`no user for ${email}`);
  return u.rows[0].id;
}

/** Seeds start/chapter-1/chapter-2/chapter-3 as fully approved (every lesson,
 *  and the chapter-level output submission) — the prerequisite chain Chapter
 *  4 needs, without re-driving three already-covered chapters through the UI. */
async function seedApprovedThroughChapter3(wsId: string, userId: string): Promise<void> {
  const pool = pgPool();
  const prog = await pool.query<{ programme: { stages: { id: string; lessons: { id: string }[] }[] } }>(
    "SELECT programme FROM curriculum ORDER BY id LIMIT 1",
  );
  if (!prog.rows[0]) throw new Error("no curriculum found");
  const stages = prog.rows[0].programme.stages;
  const priorLessons = ["start", "chapter-1", "chapter-2", "chapter-3"].flatMap(
    (id) => stages.find((s) => s.id === id)?.lessons.map((l) => l.id) ?? [],
  );
  const enrollment = {
    id: "e2e-enrollment", programmeId: "onevyrt-growth-programme", workspaceId: wsId, userId, deliveryMode: "self_paced",
    startedAt: new Date().toISOString(),
    lessons: priorLessons.map((lessonId) => ({ lessonId, status: "approved", submissions: [] })),
  };
  await pool.query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [wsId, JSON.stringify(enrollment)],
  );
  const submissions = ["start", "chapter-1", "chapter-2", "chapter-3"].map((stageId) => ({
    stageId, submittedAt: new Date().toISOString(), evidence: `${stageId} output (seeded)`, reviewStatus: "approved", reviewedAt: new Date().toISOString(), reviewedBy: "seed",
  }));
  await pool.query(
    "INSERT INTO chapter_submissions (workspace_id, submissions) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET submissions = EXCLUDED.submissions",
    [wsId, JSON.stringify(submissions)],
  );
}

async function addCoachToWorkspace(wsId: string, coachUserId: string): Promise<void> {
  await pgPool().query(
    `UPDATE workspaces SET members = members || $1::jsonb WHERE id = $2`,
    [JSON.stringify([{ userId: coachUserId, role: "manager" }]), wsId],
  );
}

/** Completes one Chapter 4 subchapter's assignment: checks every checklist
 *  box, writes evidence, submits, and waits for the confirmation notice.
 *
 *  The evidence text is padded to clear THIS lesson's real minEvidenceLength
 *  (lib/lesson-requirements.ts — 150/120/120/120/200 chars for 4.1..4.5,
 *  well above the whole-programme default of 10) instead of a hand-picked
 *  number: submitAssignment() runs validateLessonSubmission() before it does
 *  anything else, so a too-short evidence string 400s with "Evidence must be
 *  at least N characters…", LessonGuide.tsx renders that as its inline error
 *  banner instead of the "Submitted ✓" notice, and this test's wait for that
 *  text times out — exactly the failure this test was hitting. That
 *  per-lesson floor was added to lib/enrollments.ts + lib/lesson-requirements.ts
 *  (git commit b670900) a couple of hours after this spec's own first commit
 *  (3f21f9e) the same day, so the fixed short sentence this test used to send
 *  ("My {code} evidence — completed via E2E.", 36 chars) was never long
 *  enough for any of these five lessons even on day one — it just hadn't been
 *  run since that validation landed. Reading the requirement from its real
 *  source here (rather than copying today's numbers into the test) means a
 *  future change to the bar can't make this go stale the same way again. */
async function completeSubchapter(page: Page, code: string): Promise<void> {
  await page.goto(`/programme/chapter-4/${code}`);
  await expect(page.locator(".lg-title")).toContainText(code);
  // A second, independent race, found by actually running this (not just
  // reading the code): LessonGuide.tsx's checklist renders from `assignment`,
  // which loads asynchronously after the route param that sets .lg-title —
  // so a bare `.locator(...).all()` right after the title assertion can fire
  // before any checkbox exists yet, silently checking zero boxes (the API
  // then 400s with "Please complete at least 3 checklist items. You have
  // checked 0." — a DIFFERENT, earlier validation than the evidence-length
  // one above, and easy to mistake for a re-occurrence of it since both 400
  // at the same submit() call). .all() doesn't wait/retry the way
  // expect(...).toBeVisible() does, so wait for the first checkbox first.
  const checkboxes = page.locator('input[type="checkbox"]');
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  for (const box of await checkboxes.all()) await box.check();
  const moduleId = getChapter4SubchapterByCode(code)?.moduleId ?? "";
  const minLength = getRequirementsForLesson(moduleId).minEvidenceLength ?? 0;
  const sentence = `My ${code} evidence — completed via E2E.`;
  let evidence = sentence;
  while (evidence.length < minLength) evidence += ` ${sentence}`;
  await page.locator("#lg-evidence").fill(evidence);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Submitted ✓/)).toBeVisible({ timeout: 10_000 });
}

test.describe("Chapter 4 — Improve & Scale", () => {
  test("learner completes all 5 subchapters, submits the plan, a coach approves it, and it shows up in the Transformation Report", async ({ page, browser }) => {
    // This one test does a genuinely large amount of real work — register 2
    // accounts, 5+ full page navigations as the learner (each a fresh
    // Turbopack dev-server compile the first time that route is hit), submit
    // 5 lessons plus the whole chapter, register and add a coach, load the
    // Studio (one of this app's heaviest pages — see CLAUDE.md's Performance
    // Optimization notes), approve, then check the Transformation Report and
    // a DB notification. That's comfortably more than Playwright's 30s
    // per-test default, which nothing in this file (or the similarly large
    // critical-flows.spec.ts) ever overrides — confirmed by running this
    // locally: everything up through the chapter-level submit consistently
    // completes in ~10-12s, only to have the coach's own steps (a cold
    // /studio compile in particular) get cut off mid-flight by that 30s
    // ceiling, not by anything actually broken in the coach-approval UI.
    test.setTimeout(120_000);

    const learnerPrefix = uid("e2e-ch4-learner");
    const coachPrefix = uid("e2e-ch4-coach");
    const learnerEmail = `${learnerPrefix}@example.com`;
    const coachEmail = `${coachPrefix}@example.com`;

    try {
      await registerNewAccount(page, learnerPrefix);
      // Touch a workspace-scoped page once so ensurePersonalWorkspace has
      // definitely run before this spec starts writing to it directly.
      await page.goto("/programme");
      const wsId = await workspaceIdFor(learnerEmail);
      const learnerUserId = await userIdFor(learnerEmail);

      await test.step("seed chapters 1-3 as already approved", async () => {
        await seedApprovedThroughChapter3(wsId, learnerUserId);
      });

      await test.step("Chapter 4 intro shows unlocked, with all 5 subchapters listed", async () => {
        await page.goto("/programme/chapter-4");
        await expect(page.getByText("Chapter 3 isn't approved yet", { exact: false })).toHaveCount(0);
        for (const code of ["4.1", "4.2", "4.3", "4.4", "4.5"]) {
          await expect(page.getByText(code, { exact: false }).first()).toBeVisible();
        }
      });

      await test.step("learner walks and submits every subchapter, in order, with prev/next navigation working", async () => {
        await completeSubchapter(page, "4.1");
        // Prev/next navigation within the chapter (not the whole-programme
        // guide) is Chapter 4's own routing addition — confirm it lands on
        // 4.2's own URL before completing it the same way as the rest.
        await page.getByRole("link", { name: /Next module/ }).click();
        await expect(page).toHaveURL(/chapter-4\/4\.2/);
        await completeSubchapter(page, "4.2");
        await completeSubchapter(page, "4.3");
        await completeSubchapter(page, "4.4");
        await completeSubchapter(page, "4.5");
      });

      const coachContext: BrowserContext = await browser.newContext();
      try {
        await test.step("register the coach and invite them onto the learner's workspace", async () => {
          const coachSetupPage = await coachContext.newPage();
          await registerNewAccount(coachSetupPage, coachPrefix);
          const coachUserId = await userIdFor(coachEmail);
          await addCoachToWorkspace(wsId, coachUserId);
          await coachSetupPage.close();
        });

        await test.step("learner submits the Growth & Improvement Plan for coach review", async () => {
          await page.goto("/programme/chapter-4");
          await expect(page.getByText(/submit your Growth & Improvement Plan/i)).toBeVisible({ timeout: 10_000 });
          await page.locator(".c4i-ta").fill("Constraint: close rate. Conversion fixed. Profit lever pulled. Follow-up systemised. 90-day plan attached.");
          await page.getByRole("button", { name: "Submit for approval" }).click();
          await expect(page.getByText(/awaiting your coach's review|coach is reviewing/i)).toBeVisible({ timeout: 10_000 });
        });

        await test.step("coach approves the submitted Growth & Improvement Plan", async () => {
          const coachPage = await coachContext.newPage();
          const r = await coachPage.request.post("/api/auth/login", { data: { email: coachEmail, password: "e2e-test-password-1" } });
          expect(r.ok()).toBeTruthy();
          // funnel-studio.tsx's refreshWorkspaces() only honours a ?ws= deep-link
          // when present in the URL — without it, activeWsId falls back to
          // list[0] from GET /api/workspaces, which for a coach account is
          // their OWN (newly registered, unrelated) workspace, not the
          // learner's. ProgrammeCentre's coach tabs still render either way
          // (isCoach reflects the LAST successful role fetch), but its content
          // area shows a permanent "not a member of this workspace" error for
          // whichever workspace actually ends up active — silently hiding
          // "CHAPTER APPROVALS" on every tab, not just this one. Pass the real
          // workspace explicitly rather than relying on the fallback ordering.
          await coachPage.goto(`/studio?panel=programme&ws=${encodeURIComponent(wsId)}`);
          await coachPage.getByRole("button", { name: /Coach review/ }).click();
          await expect(coachPage.getByText("CHAPTER APPROVALS")).toBeVisible({ timeout: 10_000 });
          await coachPage.getByRole("button", { name: "Approve" }).first().click();
          await expect(coachPage.getByText(/No chapter outputs awaiting review/i)).toBeVisible({ timeout: 10_000 });
          await coachPage.close();
        });
      } finally {
        await coachContext.close();
      }

      await test.step("learner sees the plan approved, and it appears in the Transformation Report", async () => {
        await page.goto("/programme/chapter-4");
        await expect(page.getByText(/Approved — your Growth & Improvement Plan is complete/i)).toBeVisible({ timeout: 10_000 });

        await page.goto("/account/transformation-report");
        await expect(page.getByText(/Growth & Improvement Plan|What You Will Improve/i).first()).toBeVisible({ timeout: 15_000 });
      });

      await test.step("the coach's approval notified the learner (in-app bell row)", async () => {
        const rows = await pgPool().query(
          "SELECT type, title FROM notifications WHERE user_id = $1 AND type = 'chapter_review' ORDER BY created_at DESC LIMIT 1",
          [learnerUserId],
        );
        expect(rows.rows.length).toBe(1);
        expect(rows.rows[0].title).toMatch(/Approved/i);
      });
    } finally {
      await pgPool().query("DELETE FROM notifications WHERE user_id = (SELECT id FROM users WHERE email = $1)", [learnerEmail]).catch(() => {});
      await cleanupAccount(learnerEmail);
      await cleanupAccount(coachEmail);
    }
  });
});
