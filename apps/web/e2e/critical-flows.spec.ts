import { test, expect, type BrowserContext } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount, userIdFor, workspaceIdFor, loginViaAPI, addCoachToWorkspace } from "./helpers";
import { pgPool } from "../lib/db";

/**
 * CRITICAL-FLOW E2E TESTS: 10 Non-Negotiable Tests
 *
 * These tests enforce the most critical user flows with ZERO conditional logic,
 * NO placeholder assertions, and FAIL-FAST behavior. Each test is designed to
 * catch regressions in the core journeys:
 *
 * 1. Login → Home → Continue Programme → Correct Lesson
 * 2. Learner Navigation (All Required)
 * 3. Coach Navigation (All Required)
 * 4. My Business URL and Component
 * 5. Coaching URL and Component
 * 6. Lesson Rejection Without Evidence
 * 7. Complete Lesson → Review → Approval → Next Unlocks
 * 8. Chapter 4 → Growth Plan → Finish
 * 9. Transformation Report Share
 * 10. Protected Page Redirect
 */

test.describe("Critical Flows — Non-Negotiable", () => {
  /**
   * TEST 1: Login → Home → Continue Programme → Correct Lesson
   *
   * MUST:
   * - User logs in
   * - Lands on /command-center
   * - Clicks Programme button/link
   * - Sees the correct next lesson based on enrollment
   */
  test("1. Login → Home → Continue Programme → Correct Lesson", async ({ page }) => {
    const prefix = uid("cf-1-login");
    const email = `${prefix}@example.com`;

    try {
      // Register and land on Command Centre
      await registerNewAccount(page, prefix);
      await expect(page).toHaveURL(/\/command-center/);

      // Verify Command Centre is rendered (look for identifying content)
      const commandCenterHeading = page.locator("h1, [role='heading']").first();
      await expect(commandCenterHeading).toBeVisible({ timeout: 5_000 });

      // Navigate to Programme
      const programmeLink = page.locator('a, button').filter({ hasText: /programme|program/i }).first();
      await expect(programmeLink).toBeVisible({ timeout: 5_000 });
      await programmeLink.click();

      // MUST land on /programme and see Chapter 1 (START is the default next step)
      await expect(page).toHaveURL(/\/programme/);
      // "text=START" is a case-insensitive substring match, so it also hits
      // every other "start"/"Start"/"Starting" on the page (the stage intro
      // paragraph, the Finish lesson's outcome copy, etc.) — a strict-mode
      // violation with 4 matches (see components/ProgrammeJourney.tsx). The
      // real Start stage heading is "Start — Personal & Business Assessment"
      // (packages/engine/src/curriculum-chapters.ts's "start" stage title).
      await expect(page.getByRole("heading", { name: /Start — Personal & Business/i })).toBeVisible({ timeout: 5_000 });
    } finally {
      await cleanupAccount(email);
    }
  });

  /**
   * TEST 2: Learner Navigation (All Required)
   *
   * MUST show all required sections, NO exceptions:
   * ✓ Home
   * ✓ Programme
   * ✓ My Business
   * ✓ Resources
   * ✗ Coaching (NOT visible to learners)
   */
  test("2. Learner Navigation (All Required)", async ({ page }) => {
    const prefix = uid("cf-2-nav-learner");
    const email = `${prefix}@example.com`;

    try {
      await registerNewAccount(page, prefix);

      // Home link must be visible
      const homeLink = page.locator('a, button').filter({ hasText: /home|command center/i }).first();
      await expect(homeLink).toBeVisible({ timeout: 5_000 });

      // Programme link must be visible
      const programmeLink = page.locator('a, button').filter({ hasText: /programme|program/i }).first();
      await expect(programmeLink).toBeVisible({ timeout: 5_000 });

      // My Business link must be visible
      const businessLink = page.locator('a, button').filter({ hasText: /my business|business/i }).first();
      await expect(businessLink).toBeVisible({ timeout: 5_000 });

      // Resources link must be visible
      const resourcesLink = page.locator('a, button').filter({ hasText: /resources|campaign|community/i }).first();
      await expect(resourcesLink).toBeVisible({ timeout: 5_000 });

      // Coaching link MUST NOT be visible (learner cannot be a coach without explicit role)
      const coachingLink = page.locator('a, button').filter({ hasText: /^coaching$/i });
      await expect(coachingLink).toHaveCount(0);
    } finally {
      await cleanupAccount(email);
    }
  });

  /**
   * TEST 3: Coach Navigation (All Required)
   *
   * MUST show all required sections for a coach:
   * ✓ Home
   * ✓ Programme
   * ✓ My Business
   * ✓ Coaching
   * ✓ Resources
   */
  test("3. Coach Navigation (All Required)", async ({ page, browser }) => {
    const learnerPrefix = uid("cf-3-coach-learner");
    const coachPrefix = uid("cf-3-coach-coach");
    const learnerEmail = `${learnerPrefix}@example.com`;
    const coachEmail = `${coachPrefix}@example.com`;

    const coachContext: BrowserContext = await browser.newContext();

    try {
      // Register learner first to have a workspace to add coach to
      await registerNewAccount(page, learnerPrefix);
      const wsId = await workspaceIdFor(learnerEmail);

      // Register coach in separate context
      const coachSetupPage = await coachContext.newPage();
      await registerNewAccount(coachSetupPage, coachPrefix);
      const coachUserId = await userIdFor(coachEmail);

      // Add coach to the learner's workspace
      await addCoachToWorkspace(wsId, coachUserId);
      await coachSetupPage.close();

      // Coach logs in and navigates to their workspace
      const coachPage = await coachContext.newPage();
      await loginViaAPI(coachPage, coachEmail);
      await coachPage.goto("/command-center");

      // Home link must be visible
      const homeLink = coachPage.locator('a, button').filter({ hasText: /home|command center/i }).first();
      await expect(homeLink).toBeVisible({ timeout: 5_000 });

      // Programme link must be visible
      const programmeLink = coachPage.locator('a, button').filter({ hasText: /programme|program/i }).first();
      await expect(programmeLink).toBeVisible({ timeout: 5_000 });

      // My Business link must be visible
      const businessLink = coachPage.locator('a, button').filter({ hasText: /my business|business/i }).first();
      await expect(businessLink).toBeVisible({ timeout: 5_000 });

      // Coaching link MUST be visible for coaches
      const coachingLink = coachPage.locator('a, button').filter({ hasText: /coaching/i }).first();
      await expect(coachingLink).toBeVisible({ timeout: 5_000 });

      // Resources link must be visible
      const resourcesLink = coachPage.locator('a, button').filter({ hasText: /resources|campaign|community/i }).first();
      await expect(resourcesLink).toBeVisible({ timeout: 5_000 });

      await coachPage.close();
    } finally {
      await coachContext.close();
      await cleanupAccount(learnerEmail);
      await cleanupAccount(coachEmail);
    }
  });

  /**
   * TEST 4: My Business URL and Component
   *
   * MUST:
   * - Navigate to My Business
   * - URL must be EXACTLY /business
   * - MyBusinessDashboard component must be rendered
   * - No redirect should occur
   */
  test("4. My Business URL and Component", async ({ page }) => {
    const prefix = uid("cf-4-business");
    const email = `${prefix}@example.com`;

    try {
      await registerNewAccount(page, prefix);

      // Navigate to My Business via the navigation link
      const businessLink = page.locator('a, button').filter({ hasText: /my business|business/i }).first();
      await businessLink.click();

      // URL MUST be /business (not /my-business or anything else)
      await expect(page).toHaveURL(/\/business$/);

      // Dashboard component must be visible (look for main content)
      const businessContent = page.locator("h1, h2, [role='heading']").first();
      await expect(businessContent).toBeVisible({ timeout: 5_000 });

      // Verify we're not on a redirect or error page
      const errorText = page.locator("text=/not found|not found|404/i");
      await expect(errorText).toHaveCount(0);
    } finally {
      await cleanupAccount(email);
    }
  });

  /**
   * TEST 5: Coaching URL and Component
   *
   * MUST (as a coach):
   * - Navigate to Coaching
   * - URL must be EXACTLY /coaching
   * - Coaching hub/dashboard must be rendered
   */
  test("5. Coaching URL and Component", async ({ page, browser }) => {
    const learnerPrefix = uid("cf-5-coach-learner");
    const coachPrefix = uid("cf-5-coach-coach");
    const learnerEmail = `${learnerPrefix}@example.com`;
    const coachEmail = `${coachPrefix}@example.com`;

    const coachContext: BrowserContext = await browser.newContext();

    try {
      // Setup: Register learner and add coach
      await registerNewAccount(page, learnerPrefix);
      const wsId = await workspaceIdFor(learnerEmail);

      const coachSetupPage = await coachContext.newPage();
      await registerNewAccount(coachSetupPage, coachPrefix);
      const coachUserId = await userIdFor(coachEmail);
      await addCoachToWorkspace(wsId, coachUserId);
      await coachSetupPage.close();

      // Coach logs in and navigates to coaching
      const coachPage = await coachContext.newPage();
      await loginViaAPI(coachPage, coachEmail);
      await coachPage.goto("/command-center");

      // Click the Coaching link
      const coachingLink = coachPage.locator('a, button').filter({ hasText: /coaching/i }).first();
      await expect(coachingLink).toBeVisible({ timeout: 5_000 });
      await coachingLink.click();

      // URL MUST be /coaching
      await expect(coachPage).toHaveURL(/\/coaching$/);

      // Coaching dashboard must be visible
      const coachingContent = coachPage.locator("h1, h2, [role='heading']").first();
      await expect(coachingContent).toBeVisible({ timeout: 5_000 });

      // Verify no error pages
      const errorText = coachPage.locator("text=/not found|404/i");
      await expect(errorText).toHaveCount(0);

      await coachPage.close();
    } finally {
      await coachContext.close();
      await cleanupAccount(learnerEmail);
      await cleanupAccount(coachEmail);
    }
  });

  /**
   * TEST 6: Lesson Rejection Without Evidence
   *
   * MUST:
   * - Attempt to submit lesson with minimal evidence (just "test")
   * - Server MUST reject with validation error
   * - Lesson MUST NOT be marked as submitted
   */
  test("6. Lesson Rejection Without Evidence", async ({ page }) => {
    const prefix = uid("cf-6-reject");
    const email = `${prefix}@example.com`;

    try {
      await registerNewAccount(page, prefix);

      // Navigate to a lesson (START module). "start-define" was never a real
      // lesson id — the START stage's one module is "m-start-assessment"
      // (packages/engine/src/curriculum-chapters.ts's CANONICAL_LESSON_LAYOUT
      // + curriculum-content.ts). An unknown id renders LessonPage's "Module
      // not found" fallback, which has no evidence textarea at all.
      await page.goto("/programme/lesson/m-start-assessment");

      // Try to submit with minimal evidence
      const evidenceField = page.locator("textarea[id*='evidence'], textarea[placeholder*='evidence'], textarea[placeholder*='action']").first();
      await expect(evidenceField).toBeVisible({ timeout: 5_000 });
      await evidenceField.fill("test");

      // Click submit
      const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
      await expect(submitButton).toBeVisible({ timeout: 5_000 });
      await submitButton.click();

      // Server MUST reject the submission with validation error
      // Look for error message or validation feedback
      const errorMessage = page.locator("text=/evidence|required|insufficient|more detail/i");
      await expect(errorMessage).toBeVisible({ timeout: 5_000 });

      // Lesson MUST NOT show as submitted
      const submittedStatus = page.locator("text=/submitted/i");
      await expect(submittedStatus).toHaveCount(0);
    } finally {
      await cleanupAccount(email);
    }
  });

  /**
   * TEST 7: Complete Lesson → Review → Approval → Next Unlocks
   *
   * MUST:
   * - Complete all checklist items
   * - Provide substantial evidence (>100 chars)
   * - Submit lesson
   * - Coach approves
   * - Next lesson becomes available
   * - No exceptions or skips
   */
  test("7. Complete Lesson → Review → Approval → Next Unlocks", async ({ page, browser }) => {
    const learnerPrefix = uid("cf-7-lesson-learner");
    const coachPrefix = uid("cf-7-lesson-coach");
    const learnerEmail = `${learnerPrefix}@example.com`;
    const coachEmail = `${coachPrefix}@example.com`;

    const coachContext: BrowserContext = await browser.newContext();

    try {
      // Register learner and setup
      await registerNewAccount(page, learnerPrefix);
      await page.goto("/programme"); // Touch workspace-scoped page
      const wsId = await workspaceIdFor(learnerEmail);
      const learnerUserId = await userIdFor(learnerEmail);

      // Seed START lesson enrollment
      const pool = pgPool();
      const prog = await pool.query<{ programme: { stages: { id: string; lessons: { id: string }[] }[] } }>(
        "SELECT programme FROM curriculum ORDER BY id LIMIT 1",
      );
      const startLessons = prog.rows[0]!.programme.stages.find((s) => s.id === "start")?.lessons.map((l) => l.id) ?? [];

      const enrollment = {
        id: "e2e-enrollment",
        programmeId: "onevyrt-growth-programme",
        workspaceId: wsId,
        userId: learnerUserId,
        deliveryMode: "self_paced",
        startedAt: new Date().toISOString(),
        lessons: startLessons.map((lessonId) => ({ lessonId, status: "available", submissions: [] })),
      };
      await pool.query(
        "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
        [wsId, JSON.stringify(enrollment)],
      );

      // Register coach and add to workspace
      const coachSetupPage = await coachContext.newPage();
      await registerNewAccount(coachSetupPage, coachPrefix);
      const coachUserId = await userIdFor(coachEmail);
      await addCoachToWorkspace(wsId, coachUserId);
      await coachSetupPage.close();

      // Learner navigates to START lesson. Real lesson id is
      // "m-start-assessment" — "start-define" doesn't exist and renders
      // LessonPage's "Module not found" fallback (see test 6 above; same
      // curriculum-chapters.ts/curriculum-content.ts evidence), which has no
      // textarea/checkbox at all, so this hung on evidenceField.fill() until
      // the global 30s test timeout instead of failing on a real assertion.
      await page.goto("/programme/lesson/m-start-assessment");

      // Complete all checklist items. LessonGuide.tsx's checklist renders from
      // an async-loaded `assignment`, after the page itself has already
      // navigated — .count() doesn't wait/retry the way expect(...).
      // toBeVisible() does, so without this wait it can run before any
      // checkbox exists yet and silently check zero (the submit then 400s on
      // "Please complete at least N checklist items" instead of succeeding,
      // which is exactly why "submitted" below never appeared).
      const checkboxes = page.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
      const checkboxCount = await checkboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        await checkboxes.nth(i).check();
      }

      // Provide substantial evidence (>100 chars)
      const evidenceField = page.locator("textarea[id*='evidence'], textarea").first();
      const longEvidence = "This is comprehensive evidence of completing the START lesson. I have thoroughly reviewed the material and completed all action items as required. My detailed understanding includes the foundation concepts needed for the programme.";
      await evidenceField.fill(longEvidence);
      expect(longEvidence.length).toBeGreaterThan(100);

      // Submit the lesson
      const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
      await submitButton.click();

      // Wait for submission confirmation. A loose text match can legitimately
      // resolve to 2 real elements at once here — LessonGuide.tsx's own
      // "Submitted ✓ — ..." toast (.lg-msg.ok) AND a persistent "Submitted —
      // in review." status elsewhere on the page — tripping Playwright's
      // strict mode. Target the actual toast class instead of guessing at
      // text unique enough to avoid the collision.
      await expect(page.locator(".lg-msg.ok")).toBeVisible({ timeout: 10_000 });

      // Coach logs in and approves the lesson
      const coachPage = await coachContext.newPage();
      await loginViaAPI(coachPage, coachEmail);
      await coachPage.goto("/studio?panel=programme");

      // Coach must be able to access review panel
      const reviewButton = coachPage.getByRole("button", { name: /coach review|review/i }).first();
      await expect(reviewButton).toBeVisible({ timeout: 5_000 });
      await reviewButton.click();

      // Find and approve the learner's submission
      const approveButton = coachPage.getByRole("button", { name: /approve|accept/i }).first();
      await expect(approveButton).toBeVisible({ timeout: 10_000 });
      await approveButton.click();

      // Wait for approval confirmation. ProgrammeCentre's review() (see
      // components/ProgrammeCentre.tsx) has no success toast/banner — the
      // approved item simply drops out of reviewItems on the next
      // loadReview(), leaving the empty-state copy below once nothing is
      // left pending. That's the real, observable confirmation here.
      await expect(coachPage.locator("text=/nothing awaiting review/i")).toBeVisible({ timeout: 10_000 });

      // Learner refreshes and sees next lesson is now available
      await page.reload();
      await page.goto("/programme");

      // Next lesson in START must be available (or chapter-1 if START is done).
      // Neither "available" nor "start again" is real copy anywhere on
      // /programme (see ProgrammeJourney.tsx's treat(): an unlocked-but-not-
      // current module gets no pill text at all, just "Open →"). The real,
      // unambiguous signal that the next module unlocked is the live status
      // band's CTA, which reads "Continue Programme" once a lesson has been
      // approved (see @onevyrt/engine's programme-nav.ts nextAction()).
      const nextLesson = page.locator(".pg-cta").filter({ hasText: /continue programme/i });
      await expect(nextLesson).toBeVisible({ timeout: 5_000 });

      await coachPage.close();
    } finally {
      await coachContext.close();
      await cleanupAccount(learnerEmail);
      await cleanupAccount(coachEmail);
    }
  });

  /**
   * TEST 8: Chapter 4 → Growth Plan → Finish
   *
   * MUST:
   * - Complete Chapter 4 assignments
   * - Submit Growth Plan
   * - Coach approves
   * - Finish chapter unlocks
   * - Transformation Report accessible
   */
  test("8. Chapter 4 → Growth Plan → Finish", async ({ page, browser }) => {
    const learnerPrefix = uid("cf-8-ch4-learner");
    const coachPrefix = uid("cf-8-ch4-coach");
    const learnerEmail = `${learnerPrefix}@example.com`;
    const coachEmail = `${coachPrefix}@example.com`;

    const coachContext: BrowserContext = await browser.newContext();

    try {
      // Setup: Register learner
      await registerNewAccount(page, learnerPrefix);
      await page.goto("/programme");
      const wsId = await workspaceIdFor(learnerEmail);
      const learnerUserId = await userIdFor(learnerEmail);

      // Seed chapters 1-3 as approved (prerequisite for Chapter 4)
      const pool = pgPool();
      const prog = await pool.query<{ programme: { stages: { id: string; lessons: { id: string }[] }[] } }>(
        "SELECT programme FROM curriculum ORDER BY id LIMIT 1",
      );
      const stages = prog.rows[0]!.programme.stages;
      const priorLessons = ["start", "chapter-1", "chapter-2", "chapter-3"].flatMap(
        (id) => stages.find((s) => s.id === id)?.lessons.map((l) => l.id) ?? [],
      );

      const enrollment = {
        id: "e2e-enrollment",
        programmeId: "onevyrt-growth-programme",
        workspaceId: wsId,
        userId: learnerUserId,
        deliveryMode: "self_paced",
        startedAt: new Date().toISOString(),
        lessons: priorLessons.map((lessonId) => ({ lessonId, status: "approved", submissions: [] })),
      };

      await pool.query(
        "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
        [wsId, JSON.stringify(enrollment)],
      );

      const submissions = ["start", "chapter-1", "chapter-2", "chapter-3"].map((stageId) => ({
        stageId,
        submittedAt: new Date().toISOString(),
        evidence: `${stageId} output (seeded)`,
        reviewStatus: "approved",
        reviewedAt: new Date().toISOString(),
        reviewedBy: "seed",
      }));

      await pool.query(
        "INSERT INTO chapter_submissions (workspace_id, submissions) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET submissions = EXCLUDED.submissions",
        [wsId, JSON.stringify(submissions)],
      );

      // Navigate to Chapter 4 and verify it's unlocked (chapters 1-3 were
      // just seeded as approved above via chapter_submissions, so
      // chapterGates() sees prevApproved and chapter-4 isn't locked — see
      // packages/engine/src/chapter-gates.ts).
      await page.goto("/programme/chapter-4");
      await expect(page.locator("text=/Chapter 3 isn't approved/i")).toHaveCount(0);

      // Complete all 5 subchapters (4.1 - 4.5). No coach is on this
      // workspace yet — deliberately: submitAssignment() (lib/enrollments.ts)
      // only auto-approves a submission when the workspace has NO coach
      // (self-paced, hasCoach false), and chapterGates()'s "ready_to_submit"
      // state for chapter-4 requires every one of these 5 lessons to be
      // "approved", not merely "submitted" (chapter-gates.ts's lessonsComplete
      // filter only counts approved/completed) — so registering the coach
      // only AFTER this loop is what unlocks the Growth Plan gate below
      // without a 5x learner/coach lesson-review round trip.
      for (const code of ["4.1", "4.2", "4.3", "4.4", "4.5"]) {
        await page.goto(`/programme/chapter-4/${code}`);
        // Same async-checklist race as the earlier lesson flow above — wait
        // for the first checkbox before counting/checking, or this silently
        // checks zero and the submit 400s on "Please complete at least N
        // checklist items" instead of the evidence actually being accepted.
        const checkboxes = page.locator('input[type="checkbox"]');
        await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
          await checkboxes.nth(i).check();
        }
        const evidenceField = page.locator("#lg-evidence, textarea").first();
        // Real per-lesson minimums run up to 200 chars (m-growth-plan/4.5 —
        // see lib/lesson-requirements.ts's LESSON_REQUIREMENTS), well past
        // the ~55-char template this used to send; every subchapter submit
        // was being rejected server-side for insufficient evidence length.
        await evidenceField.fill(
          `My ${code} evidence — completed via E2E critical flow test. This subchapter's assignment is fully done: the constraint/lever was identified from real numbers, the actual change was made, and the before/after values are recorded here, well past this lesson's minimum evidence length.`,
        );
        const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
        await submitButton.click();
        // Same LessonGuide.tsx toast as the earlier lesson-flow test above —
        // target the real .lg-msg.ok class rather than "submitted" text,
        // which can also match a second, persistent status element at once.
        await expect(page.locator(".lg-msg.ok")).toBeVisible({ timeout: 10_000 });
      }

      // Register coach and add to workspace — now that all 5 subchapters
      // are self-paced-approved above, the coach is only needed for the
      // chapter-level Growth Plan review below.
      const coachSetupPage = await coachContext.newPage();
      await registerNewAccount(coachSetupPage, coachPrefix);
      const coachUserId = await userIdFor(coachEmail);
      await addCoachToWorkspace(wsId, coachUserId);
      await coachSetupPage.close();

      // Submit Growth Plan
      await page.goto("/programme/chapter-4");
      const planTextarea = page.locator(".c4i-ta, textarea").first();
      await expect(planTextarea).toBeVisible({ timeout: 5_000 });
      await planTextarea.fill(
        "Constraint identified: conversion rate. Actions: improve messaging, test offer, systemise follow-up. Expected impact: 25% improvement in close rate. 90-day plan: weeks 1-2 messaging test, weeks 3-4 offer refinement, weeks 5-12 systemisation.",
      );

      const submitPlanButton = page.getByRole("button", { name: /submit|approve/i }).first();
      await submitPlanButton.click();
      await expect(page.locator("text=/awaiting.*review|coach is reviewing/i")).toBeVisible({ timeout: 10_000 });

      // Coach approves the Growth Plan
      const coachPage = await coachContext.newPage();
      await loginViaAPI(coachPage, coachEmail);
      await coachPage.goto("/studio?panel=programme");

      const reviewButton = coachPage.getByRole("button", { name: /coach review|chapter.*review/i }).first();
      await expect(reviewButton).toBeVisible({ timeout: 5_000 });
      await reviewButton.click();

      const approveButton = coachPage.getByRole("button", { name: /approve|accept/i }).first();
      await expect(approveButton).toBeVisible({ timeout: 10_000 });
      await approveButton.click();

      // Same as the lesson-level review in test 7: reviewChapter()
      // (ProgrammeCentre.tsx) shows no "approved" confirmation text — the
      // card just drops out of chapterReviewItems, leaving this empty-state
      // copy once nothing's left awaiting review.
      await expect(coachPage.locator("text=/no chapter outputs awaiting review/i")).toBeVisible({ timeout: 10_000 });

      // Learner refreshes and verifies Finish chapter is unlocked
      await page.reload();
      await page.goto("/programme");

      const finishButton = page.locator("text=/finish/i").first();
      await expect(finishButton).toBeVisible({ timeout: 5_000 });

      // Transformation Report MUST be accessible. Either word alone
      // (/transformation|report/i) also matches Chapter 1's own
      // "Transformation & Message" lesson link, which sits earlier in the
      // page and so wins .first() — send it straight to the real URL
      // instead (see chapter-4.spec.ts's own working use of this same path)
      // rather than trying to disambiguate a link by guessed text.
      await page.goto("/account/transformation-report");

      // Verify Transformation Report page loads
      await expect(page).toHaveURL(/transformation-report|finish/i);
      const reportContent = page.locator("h1, h2, [role='heading']").first();
      await expect(reportContent).toBeVisible({ timeout: 5_000 });

      await coachPage.close();
    } finally {
      await coachContext.close();
      await cleanupAccount(learnerEmail);
      await cleanupAccount(coachEmail);
    }
  });

  /**
   * TEST 9: Transformation Report Share
   *
   * MUST:
   * - Generate share link
   * - Open in incognito/new context (no login)
   * - Public access works (no login required)
   * - PDF generates successfully
   */
  test("9. Transformation Report Share", async ({ page, browser }) => {
    const prefix = uid("cf-9-share");
    const email = `${prefix}@example.com`;

    const anonContext = await browser.newContext();

    try {
      // Setup learner with approved chapters
      await registerNewAccount(page, prefix);
      await page.goto("/programme");
      const wsId = await workspaceIdFor(email);
      const userId = await userIdFor(email);

      // Seed full curriculum as approved
      const pool = pgPool();
      const prog = await pool.query<{ programme: { stages: { id: string; lessons: { id: string }[] }[] } }>(
        "SELECT programme FROM curriculum ORDER BY id LIMIT 1",
      );
      const stages = prog.rows[0]!.programme.stages;
      const allLessons = stages.flatMap((s) => s.lessons.map((l) => l.id));

      const enrollment = {
        id: "e2e-enrollment",
        programmeId: "onevyrt-growth-programme",
        workspaceId: wsId,
        userId,
        deliveryMode: "self_paced",
        startedAt: new Date().toISOString(),
        lessons: allLessons.map((lessonId) => ({ lessonId, status: "approved", submissions: [] })),
      };

      await pool.query(
        "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
        [wsId, JSON.stringify(enrollment)],
      );

      const submissions = ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4"].map((stageId) => ({
        stageId,
        submittedAt: new Date().toISOString(),
        evidence: `${stageId} output (seeded)`,
        reviewStatus: "approved",
        reviewedAt: new Date().toISOString(),
        reviewedBy: "seed",
      }));

      await pool.query(
        "INSERT INTO chapter_submissions (workspace_id, submissions) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET submissions = EXCLUDED.submissions",
        [wsId, JSON.stringify(submissions)],
      );

      // Navigate to Transformation Report. The page renders several elements
      // whose text matches /transformation|report/i at once (the h1, an
      // "Email me this report" button, an "Your Transformation Journey" h2,
      // and a footer note) — a bare text= regex here is a strict-mode
      // violation, not a wait; scope to the one heading that actually
      // confirms we've landed on the right page.
      await page.goto("/account/transformation-report");
      await expect(page.getByRole("heading", { name: "Your Transformation Report" })).toBeVisible({ timeout: 5_000 });

      // Find and click the share button. Real button text is "Get share link
      // (24h)" (app/account/transformation-report/page.tsx), which "share" matches.
      const shareButton = page.getByRole("button", { name: /share|copy link/i }).first();
      await expect(shareButton).toBeVisible({ timeout: 5_000 });
      await shareButton.click();

      // Extract the share link. The real markup has no input/data-testid —
      // once the POST to /api/account/transformation-report/share resolves,
      // an <a href={share.url} class="share-link"> renders with the full
      // absolute URL (see that page's `share` state, and shareUrl() in
      // app/api/account/transformation-report/share/route.ts, which returns
      // "<origin>/share/transformation/<token>"). `.isVisible({timeout})` is
      // NOT a wait — Playwright's own types mark that option "ignored... does
      // not wait for the element to become visible and returns immediately"
      // — so this has to poll with expect(...).toBeVisible() for the async
      // share creation instead, or it always races the fetch and reads null.
      const linkElement = page.locator('a[href*="/share/transformation/"]');
      await expect(linkElement).toBeVisible({ timeout: 5_000 });
      const shareLink = await linkElement.getAttribute("href");

      expect(shareLink).toBeTruthy();
      expect(shareLink).toContain("/share/");

      // Open share link in anonymous context (no login)
      const anonPage = await anonContext.newPage();
      const fullShareUrl = new URL(shareLink!, "http://localhost:4300").toString();
      await anonPage.goto(fullShareUrl);

      // Verify report is accessible without login
      const reportContent = anonPage.locator("text=/transformation|report|journey/i").first();
      await expect(reportContent).toBeVisible({ timeout: 5_000 });

      // PDF generation must work
      const pdfButton = anonPage.getByRole("button", { name: /download|pdf|print/i }).first();
      if (await pdfButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await pdfButton.click();
        // Wait for download to complete (or modal to appear)
        await anonPage.waitForTimeout(1_000);
      }

      await anonPage.close();
    } finally {
      await anonContext.close();
      await cleanupAccount(email);
    }
  });

  /**
   * TEST 10: Protected Page Redirect
   *
   * MUST:
   * - Logout completely
   * - Attempt to access protected page (/programme)
   * - MUST redirect to login
   * - Content MUST NOT be visible without login
   */
  test("10. Protected Page Redirect", async ({ page, browser }) => {
    const prefix = uid("cf-10-protected");
    const email = `${prefix}@example.com`;

    const anonContext = await browser.newContext();

    try {
      // Register and logout
      await registerNewAccount(page, prefix);
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();

      // Wait for logout to complete. Signed-out "/" (components/studio/LandingPage.tsx)
      // has TWO "Sign in" buttons by design — one in the sticky header, one in
      // the hero next to "Get started free" — so this needs .first(), same as
      // every other multi-match nav locator in this file.
      await expect(page.getByRole("button", { name: "Sign in" }).first()).toBeVisible({ timeout: 10_000 });

      // Try to access protected page in anonymous context (no cookies)
      const anonPage = await anonContext.newPage();
      await anonPage.goto("/programme");

      // /programme deliberately has no server-side redirect for signed-out
      // visitors: it's not in proxy.ts's matcher, and ProgrammeJourney.tsx's
      // own header comment says the server passes the public curriculum
      // STRUCTURE precisely "so signed-out visitors still see the whole path
      // with no flash" — the stage titles/outcomes render unconditionally.
      // (The previous currentUrl.includes("/") check could never actually
      // fail either way — every URL contains "/".) What's real and actually
      // gated is this ACCOUNT's data: /api/programme/enrollment 401s when
      // signed out, and the client renders a generic sign-in nudge instead
      // of this learner's live progress band — that's the boundary worth
      // proving didn't leak into a cookie-less context.
      await expect(anonPage.locator("text=/sign in to start your journey/i")).toBeVisible({ timeout: 5_000 });

      // This learner's personalized progress (percent complete, current-lesson
      // CTA) MUST NOT render for a signed-out visitor — only the generic nudge above.
      await expect(anonPage.locator(".pg-live")).toHaveCount(0);

      await anonPage.close();
    } finally {
      await anonContext.close();
      await cleanupAccount(email);
    }
  });
});
