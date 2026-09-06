# ONEVYRT — Navigation & User-Flow Specification (Phase 2)

> **Status:** Canonical spec. Decision-locked.
> **Owner of decisions:** authored autonomously; do **not** re-litigate placement/naming — implement as written. Only stop for irreversible data loss or a direct conflict with the canonical six-stage programme.
> **Date:** 2026-08-30
> **Prerequisite:** Phase 1 (canonical six-stage curriculum: Start, Chapter 1–4, Finish + safe migration) must be 100% green before any of this ships. See `ONEVYRT_IMPLEMENTATION_STATUS.md`.
>
> **Reconciliation note (added by the first session with repo access):** The Phase 1 *engine foundation* — the canonical 5-stage model (`CANONICAL_STAGES`, `CANONICAL_LESSON_LAYOUT`), the pure deterministic `reconcileToChapters()`, the conservative `remapStageAccessLimit()`, and `schemaVersion` — is **implemented, tested (engine suite 335/335), and merged to `master`** (commit `9d63697`). The remaining Phase 1 work (the versioned DB migration + seed/store wiring) is in progress. The working line is **`master` / `claude/works-f7cor7`**, not `claude/remote-control-ygviv2`. This spec's decisions are otherwise unchanged — implement as written.

---

## 0. North star

Make the **programme mind map the single canonical path** through the app. Every competing journey either becomes this path, redirects into it, or moves to Resources. The learner is never asked "where do I start?" — the app always answers "what should I do next?"

**Psychological progression (must be visible in the Programme map):**

```
Start: Uncertainty
  → Chapter 1  Define the Business and Psychology     → Clarity
  → Chapter 2  Implement Psychology in the Business    → Confidence
  → Chapter 3  Define and Control the Numbers          → Control
Finish: Transformation Report                           → Freedom
```

---

## 1. Global application menu (learner)

The learner's main navigation contains **exactly five destinations**:

1. **Home**
2. **Programme**
3. **My Business**
4. **Coaching**
5. **Resources**

Account, Billing, Security, Settings live under the **user-profile menu at the bottom** of the nav — never in the primary five.

- Do **not** surface individual tools, lessons, or features in the global menu.
- Coach and Admin areas stay **separate** from learner nav and remain protected by existing permissions/roles.
- Same five destinations on desktop sidebar and mobile drawer — no destination is desktop-only.

## 2. Home — "What should I do next?"

Single-purpose screen. Shows:

- **Continue Programme** — primary CTA; always resolves via the *single canonical progress source* to the correct next required lesson.
- Current chapter + current lesson.
- Overall progress (one number, one source).
- Required next action.
- Latest coach feedback.
- Upcoming coaching activity (when available).
- Most recently completed programme output.

**Forbidden on Home:** multiple journeys, multiple "start" buttons, competing CTAs.

## 3. Programme — the complete course experience

### 3.1 Landing view: interactive programme map

Generated from the **same canonical curriculum + progress data** as the course (no hardcoded parallel copy that can drift). Nodes:

- Start — Personal & Business Baseline
- Chapter 1 — Define the Business and Psychology → **Chapter 1 output + approval gate**
- Chapter 2 — Implement Psychology in the Business → **Chapter 2 output + approval gate**
- Chapter 3 — Define and Control the Numbers → **Chapter 3 output + approval gate**
- Finish — Transformation Report & Next 90 Days

Map must render, per node: current position, completed lessons, current lesson, available lessons, locked lessons, chapter outputs, coach-approval status, final destination. The Uncertainty→Clarity→Confidence→Control→Freedom arc is visible. Clicking an **available** node opens that lesson; locked nodes show why they're locked.

### 3.2 Programme sidebar (collapsible, curriculum-generated)

Order comes from the **curriculum engine**, never a hand-maintained second list:

```
Start
Chapter 1
  ├─ (sequential Chapter 1 lessons)
  ├─ Output: Business Psychology Blueprint
  └─ Chapter 1 approval gate
Chapter 2
  ├─ (sequential Chapter 2 lessons)
  ├─ Output: Working Business System
  └─ Chapter 2 approval gate
Chapter 3
  ├─ (sequential Chapter 3 lessons)
  ├─ Output: Numbers and Control Dashboard
  └─ Chapter 3 approval gate
Finish
  ├─ Before-and-after comparison
  ├─ Transformation Report
  └─ Next 90-Day Plan
```

Show lesson numbers, completion status, current location, locked state.

## 4. Standard lesson experience (every lesson, identical)

Five-part structure: **Understand → Reflect → Build → Apply → Submit/Complete.**

Lesson page includes: chapter+lesson breadcrumb; lesson objective; learning content; required questions/exercise; contextual tool when needed (e.g. "Open the Offer Builder for this step"); saved work; evidence/output requirement; coach feedback when available; **Previous / Save / Complete & Continue**.

**Hard rule:** opening a page **never** marks it complete. Completion requires the decision/exercise/submission/approved output appropriate to that lesson.

## 5. My Business — the living result (NOT a second course)

The business the learner builds *through* the programme. Programme answers **auto-populate** it; the learner enters information **once** and it appears everywhere. Organised as:

Founder & business identity · Desired life & direction · Customer psychology · Transformation · Message · Strategy · Business model · Offer · Positioning & brand · Customer journey · Marketing system · Sales system · Delivery system · Operations · Financial model · Numbers dashboard · Next 90-Day Plan.

**Migration decision:** convert **ProgramCentre** into My Business / "Strategy Workbook." Strip its duplicate guided-course behaviour; keep its tools and all user data. It is no longer a course.

## 6. Coaching

Assignments · Submissions · Coach comments · Changes requested · Approved outputs · **Chapter approval gates** · Cohort info · Sessions/activity. Programme shows coaching *status* contextually; detailed management lives here. Coach approves the **business decision**, not whether the lesson was opened.

## 7. Resources (available always, never in the required path)

Move here: Studio · AI tools · Golden examples · Swipe library · Templates · Funnel templates · Content angles · Cold outreach · Advanced scenarios · Community · Risk tools · History & comments · API & integrations. When a resource supports a lesson, surface it **contextually** inside the lesson, not by making the learner hunt for it.

## 8. Existing-journey → canonical mapping (add redirects; do NOT delete routes)

| Existing route / journey | New role |
|---|---|
| `/start` | Official Personal & Business Baseline |
| Command Centre journey | Home + current required action |
| Business OS journey | My Business |
| Psychology pillar | Chapter 1 |
| Execution pillar | Chapter 2 |
| Numbers pillar | Chapter 3 |
| Foundation / Check / Launch / Sell / Improve | Contextual labels only (not a curriculum) |
| Studio Start / Run / Improve | Resource categories only |
| Duplicate ProgramCentre course flow | My Business / Strategy Workbook |

Add safe redirects/compatibility so bookmarks and deep links keep working. **Document every old route → new destination** (put the table in `ONEVYRT_IMPLEMENTATION_STATUS.md` when built).

## 9. One navigation & progress source (the linchpin)

Home, Programme, My Business, Coaching all read one source for: current chapter · current lesson · completed lessons · chapter-output status · coach approval · locked/unlocked state · next required action · overall progress. **Never** compute progress separately per component. Build/verify this **before** the visual work — most "competing journeys" symptoms are this single fact leaking.

## 10. Responsive & accessible navigation

Desktop sidebar · mobile drawer · visible active state · keyboard nav · correct focus handling · accessible expanded/collapsed states · clear locked/completed states · no icon-only inaccessible nav · no hidden learner actions on mobile.

## 11. Implementation process (order is decided)

1. Inspect & map existing menus, routes, nav components, progress calculations.
2. Create **one** central navigation + route configuration derived from the canonical curriculum.
3. Map every existing feature to its correct lesson/destination.
4. Build the four programme output documents + Transformation Report as persistent artefacts.
5. Wire coaching approvals to the chapter gates.
6. Build My Business population from programme answers.
7. Unify progress onto the single source.
8. Add redirects for old journeys.
9. Migrate existing client progress.
10. Test the full start→finish experience.

Preserve: lesson IDs · user progress · assignments · submissions · reviews · cohorts · workbook answers · admin/coach permissions · useful tools · deep links. **No destructive deletions this phase.**

## 12. Required tests

Learners see only the five-item menu · coaches/admins keep authorised areas · Home shows one correct next action · Continue Programme opens the correct lesson · Programme nav matches curriculum order · map uses canonical curriculum data · completed/current/available/locked states correct · chapter gates work · opening a lesson does not complete it · My Business is not a second course · old routes redirect correctly · deep links stay safe · desktop & mobile contain the same destinations · progress consistent everywhere · accessibility passes.

Run: type-check · lint · navigation tests · curriculum/progression tests · full relevant suite · production build. **Stop on failure, repair the cause, rerun.**

## 13. Completion report (required at end of phase)

Final global menu · complete learner path · old-route→new-destination map · components/files changed · progress logic consolidated · tests added/updated · validation results · remaining work for the next phase.
