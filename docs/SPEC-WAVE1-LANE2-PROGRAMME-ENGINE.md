# Wave 1 Lane 2: Programme Engine Mapping & Chapter 4 Gate Spec

**Status:** Specification for Wave 2/3 Implementation  
**Date:** 2026-09-02  
**Scope:** Document @onevyrt/engine gate logic, extend for Chapter 4, propose mind-map data structure

---

## Executive Summary

This specification documents the @onevyrt/engine gate logic that controls chapter progression in the ONEVYRT programme. The current system implements a sequential five-stage arc (Start → Chapter 1 → Chapter 2 → Chapter 3 → Finish) with strict prerequisite gates. We extend this for Chapter 4 and propose a hierarchical mind-map data structure to support visualization of the curriculum's topic landscape.

---

## Part 1: Current Gate Logic (Chapters 1–3)

### 1.1 The Five-Stage Arc

The canonical ONEVYRT curriculum structure is defined in `packages/engine/src/curriculum-chapters.ts` as:

| Stage | Order | Title | Psychological State | Output Document | Duration (estimated) |
|-------|-------|-------|---------------------|---------------------|----------------------|
| Start | 0 | Personal & Business Assessment | Uncertainty | Personal & Business Baseline | 1–2 modules |
| Chapter 1 | 1 | Define the Business and Psychology | Clarity | Business Psychology Blueprint | 5 modules |
| Chapter 2 | 2 | Implement It in the Business | Confidence | Implemented Business System | 7 modules |
| Chapter 3 | 3 | Define and Control the Numbers | Control | Numbers & Control Dashboard | 6 modules |
| Finish | 4 | Transformation Report & Next 90 Days | Freedom | Transformation Report | 1 module |

**Canonical Lesson Layout (20 modules total):**

```
Start (1 module):
  • m-start-assessment

Chapter 1 (5 modules):
  • m-founder-psychology
  • m-business-definition
  • m-customer-psychology
  • m-transformation-message
  • m-strategic-direction

Chapter 2 (7 modules):
  • m-positioning-brand
  • m-offer
  • m-customer-journey
  • m-marketing-system
  • m-sales-system
  • m-delivery-operations
  • m-90-day-plan

Chapter 3 (6 modules):
  • m-personal-freedom-number
  • m-price-unit-economics
  • m-growth-mathematics
  • m-business-economics
  • m-plan-vs-actual
  • m-improvement-loop

Finish (1 module):
  • m-finish-transformation
```

### 1.2 Gate State Machine

The gate logic is implemented in three functions in `packages/engine/src/enrollment.ts`:

#### 1.2.1 `effectiveStatus(programme, enrollment, lessonId): LessonStatus`

**Purpose:** Compute the displayed status of a lesson to the learner.

**Logic:**
1. If the lesson has an explicit stored status (started by learner or reviewed by coach), return that.
2. Otherwise, apply sequential gating:
   - The first lesson in the curriculum is `available`.
   - Every subsequent lesson is `available` only if the **immediately preceding lesson** has status `approved` or `completed`.
   - All others are `locked`.

**Status Values:**
```typescript
type LessonStatus = 
  | "locked"           // Not yet eligible to submit (prerequisite gate)
  | "available"        // Eligible to start (no submissions yet)
  | "in_progress"      // Learner has marked as started
  | "submitted"        // Learner submitted; awaiting coach review
  | "changes_requested"// Coach requested changes
  | "approved"         // Coach approved; next lesson unlocks
  | "completed"        // (Terminal state; same unlock behavior as "approved")
;
```

**Code Reference:**
```typescript
export function effectiveStatus(programme: ProgrammeTemplate, enrollment: Enrollment, lessonId: string): LessonStatus {
  const stored = entryFor(enrollment, lessonId)?.status;
  if (stored) return stored;
  const lessons = allLessons(programme);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return "locked";
  if (idx === 0) return "available";
  const prevId = lessons[idx - 1].id;
  const prevStatus = effectiveStatus(programme, enrollment, prevId);
  return prevStatus === "approved" || prevStatus === "completed" ? "available" : "locked";
}
```

**Key Behavior:**
- **Pure computation:** No side effects; same inputs always produce the same output.
- **Recursive base case:** The first lesson is always available; all others depend on the previous lesson's status.
- **No skip gates:** A learner cannot jump chapters; they must progress sequentially.

#### 1.2.2 `capStatusByStage(programme, lessonId, status, maxStageOrder): LessonStatus`

**Purpose:** Apply a cohort pacing cap on top of sequential gates (e.g., a 6-week cohort releases one chapter per week).

**Logic:**
1. If no cap is set (`null` or `undefined`), return the status unchanged.
2. If the status is not `available`, return unchanged (only affects newly-available lessons).
3. If the lesson's stage order exceeds `maxStageOrder`, return `locked` (pacing cap blocks it).
4. Otherwise, return the status unchanged.

**Code Reference:**
```typescript
export function capStatusByStage(programme: ProgrammeTemplate, lessonId: string, status: LessonStatus, maxStageOrder: number | null | undefined): LessonStatus {
  if (maxStageOrder == null || status !== "available") return status;
  const found = findLesson(programme, lessonId);
  if (!found) return status;
  return found.stage.order > maxStageOrder ? "locked" : status;
}
```

**Key Behavior:**
- **Never re-locks progress:** If a lesson has real progress (status `in_progress` or beyond), the cap is ignored.
- **Hierarchical:** Applied after `effectiveStatus()`, so it's a secondary gate.

#### 1.2.3 Current Gate Enforcement Points

**Client-Side (UI):**
- `apps/web/lib/enrollments.ts`: `submitAssignment()`, `startLesson()`
- Checks: `effectiveStatus()` + `capStatusByStage()` before allowing actions.

**Server-Side (API):**
- Route handlers gate submission and review endpoints by role (learner vs. coach).
- `submitAssignment()` rejects if status is `locked` or access is paused.

### 1.3 Coach Approval Workflow

#### 1.3.1 Submission Lifecycle

```
Learner submits → Submission created with reviewStatus: "pending" → Lesson status: "submitted"
                        ↓
                    Coach reviews
                        ↓
         ┌─────────────────┴──────────────┐
         ↓                                 ↓
    Coach approves              Coach requests changes
    reviewStatus: "approved"     reviewStatus: "changes_requested"
    Lesson status: "approved"    Lesson status: "changes_requested"
    → Next lesson unlocks        → Learner must resubmit
```

**Implementation:**
- `apps/web/lib/enrollments.ts`:
  - `submitAssignment()`: Creates pending submission; auto-approves if self-paced with no coach.
  - `reviewSubmission()`: Coach sets decision and optional feedback.
  - `resetLessonSubmissions()`: Admin recovery (clears pending submissions).

**Code Reference:**
```typescript
export async function submitAssignment(workspaceId, lessonId, userId, evidence, checklistChecked, programme, stageAccessLimit) {
  // ...
  if (!entry) { entry = { lessonId, submissions: [] }; enrollment.lessons.push(entry); }
  const latestSubmission = entry.submissions[entry.submissions.length - 1];
  if (latestSubmission?.reviewStatus === "pending") {
    return { error: "This lesson already has a submission awaiting review — wait for your coach's decision before submitting again." };
  }
  // ...
  const submission: Submission = {
    id: randomBytes(6).toString("hex"), submittedAt: new Date().toISOString(),
    evidence: clean, checklistChecked, reviewStatus: "pending",
  };
  entry.submissions.push(submission);
  entry.status = "submitted";
  if (enrollment.deliveryMode === "self_paced" && !hasCoach) {
    submission.reviewStatus = "approved";
    submission.reviewedAt = submission.submittedAt;
    submission.reviewedBy = "auto (self-paced)";
    entry.status = "approved";
  }
  return submission;
}
```

### 1.4 Chapter Completion Gates

**Chapter 1 → Chapter 2 Unlock:**
- All 5 Chapter 1 modules must have status `approved` or `completed`.
- The last Chapter 1 module is `m-strategic-direction`.
- Once it reaches `approved`, `effectiveStatus()` for the first Chapter 2 module (`m-positioning-brand`) returns `available`.

**Chapter 2 → Chapter 3 Unlock:**
- All 7 Chapter 2 modules must reach `approved`.
- Last: `m-90-day-plan`.
- Once approved, `m-personal-freedom-number` (first of Chapter 3) becomes `available`.

**Chapter 3 → Finish Unlock:**
- All 6 Chapter 3 modules must reach `approved`.
- Last: `m-improvement-loop`.
- Once approved, `m-finish-transformation` becomes `available`.

**Implementation Note:**
- No explicit "chapter completion" gate; the gate is implicit in the sequential prerequisite chain.
- A learner sees a chapter as "complete" when they can see the next chapter's first lesson is `available`.

---

## Part 2: Chapter 4 Extension

### 2.1 Proposed Chapter 4 Structure

**New Stage:**
| Order | Title | Psychological State | Output Document | Modules |
|-------|-------|---------------------|---------------------|---------|
| 5 | Chapter 4 — Sustain & Scale | Mastery | Sustainability & Scaling Plan | TBD (suggest 4–6 modules) |

**Proposed Module Layout (Examples; exact content TBD):**
```
Chapter 4 (4–6 modules, estimated):
  • m-revenue-optimization
  • m-team-scaling
  • m-operational-efficiency
  • m-market-expansion
  [+ optional: m-culture-systems, m-risk-management]
```

### 2.2 Chapter 4 Gate Logic

**Gate Requirements:**
1. Chapter 4 unlock: Last module of Chapter 3 (`m-improvement-loop`) must reach `approved`.
2. Finish unlock: Last module of Chapter 4 (e.g., `m-market-expansion`) must reach `approved`.
3. Sequential gating within Chapter 4: Module N+1 is `available` only when module N is `approved`.

**State Transitions:**
```
m-improvement-loop (Ch3 final) is approved
                ↓
    m-revenue-optimization (Ch4 start) becomes available
                ↓
    Learner progresses through Ch4 modules sequentially
                ↓
    m-market-expansion (Ch4 final) is approved
                ↓
    m-finish-transformation becomes available
```

### 2.3 Implementation Changes Required

#### 2.3.1 Data Structure Changes

**In `curriculum-chapters.ts`:**
- Add Chapter 4 to `CANONICAL_STAGES`:
  ```typescript
  {
    id: "chapter-4", order: 5, state: "mastery",
    title: "Chapter 4 — Sustain & Scale",
    outcome: "[outcome TBD]",
    output: "Sustainability & Scaling Plan",
  }
  ```
- Add Chapter 4 lessons to `CANONICAL_LESSON_LAYOUT`:
  ```typescript
  { stageId: "chapter-4", lessonIds: ["m-revenue-optimization", "m-team-scaling", "m-operational-efficiency", "m-market-expansion", ...] }
  ```
- Update schema version (currently `CURRICULUM_SCHEMA_VERSION = 3`); increment to `4` if the structure changes programmatically.

**In `enrollment.ts`:**
- No changes to status logic; `effectiveStatus()` and `capStatusByStage()` remain universal.
- The gate will automatically work once Chapter 4 is added to the curriculum.

#### 2.3.2 Migration Concerns

If an existing system is upgraded from 3-chapter to 4-chapter curriculum:
- Existing enrollments are unchanged; they continue progressing through the 3-chapter arc.
- New enrollments see the 4-chapter arc immediately.
- No lesson-id remapping needed (unlike the v2→v3 schema migration).

**No breaking change:** Old enrollments halfway through Chapter 3 will not suddenly require Chapter 4 to finish; the Finish stage is order 5 (after Chapter 4), so existing learners must complete Chapter 3 and then *choose* to progress into Chapter 4 (or skip if they opt out). **Clarification needed:** Should the Finish stage move to order 6, or should learners be able to skip Chapter 4? (Recommend: Finish moves to order 6; Chapter 4 becomes mandatory in the arc.)

#### 2.3.3 Cohort Pacing Caps

If cohort pacing is used:
- `stageAccessLimit` is still a stage order (0–5 for a 6-stage arc).
- Cohorts can now cap at order 5 (Chapter 4 final).
- Existing remapping logic (`remapStageAccessLimit()`) does not need changes for v3→v4 (it assumes 5 stages; update if the logic itself must change).

---

## Part 3: Mind-Map Data Structure Proposal

### 3.1 Current Limitation

The current curriculum structure is **linear and flat:**
```
Stage
  ├─ Lesson 1
  ├─ Lesson 2
  └─ Lesson 3
```

**Problem:** All chapters are presented in a flat, sequential list. Learners cannot see the *theme landscape* — which topics cluster together, which tools are interconnected, or the conceptual relationships between modules.

**Use Case:** A mind-map visualization would help learners understand:
- How Founder Psychology relates to Customer Psychology (both in Chapter 1).
- How Positioning/Brand feeds into the Offer, which feeds into Customer Journey (Chapter 2 flow).
- How Freedom Number and Unit Economics cascade into growth math and business economics (Chapter 3 relationships).
- How Chapter 4 topics support each other (Revenue Optimization → Team Scaling → Operational Efficiency → Market Expansion).

### 3.2 Proposed Hierarchical Data Structure

**Goal:** Extend the curriculum model to support visualization of chapter themes and cross-module relationships.

#### 3.2.1 Thematic Groupings (Topics)

Add an optional `topics` array to each stage:

```typescript
interface TopicTemplate {
  id: string;
  title: string;
  description: string;
  lessonIds: string[]; // Which lessons belong to this topic
  /** Optional: connections to other topics (e.g., m-offer depends on m-positioning-brand) */
  relatedTopicIds?: string[];
}

interface StageTemplate {
  id: string;
  order: number;
  title: string;
  outcome: string;
  lessons: LessonTemplate[];
  /** NEW: Optional hierarchical topics for mind-map visualization */
  topics?: TopicTemplate[];
}
```

#### 3.2.2 Mind-Map Example: Chapter 1

```typescript
{
  id: "chapter-1",
  order: 1,
  title: "Chapter 1 — Define the Business and Psychology",
  outcome: "Clarity: your founder psychology, a sharp business definition...",
  lessons: [
    { id: "m-founder-psychology", ... },
    { id: "m-business-definition", ... },
    { id: "m-customer-psychology", ... },
    { id: "m-transformation-message", ... },
    { id: "m-strategic-direction", ... },
  ],
  topics: [
    {
      id: "topic-ch1-founder",
      title: "Founder Self-Awareness",
      description: "Understand your psychology, values, and leadership style.",
      lessonIds: ["m-founder-psychology"],
      relatedTopicIds: ["topic-ch1-customer"],
    },
    {
      id: "topic-ch1-business",
      title: "Business Definition & Direction",
      description: "Define your business clearly and set strategic direction.",
      lessonIds: ["m-business-definition", "m-strategic-direction"],
      relatedTopicIds: ["topic-ch1-founder", "topic-ch1-message"],
    },
    {
      id: "topic-ch1-customer",
      title: "Customer Psychology & Positioning",
      description: "Understand your customer deeply and craft your message.",
      lessonIds: ["m-customer-psychology", "m-transformation-message"],
      relatedTopicIds: ["topic-ch1-founder", "topic-ch1-business"],
    },
  ],
}
```

#### 3.2.3 Mind-Map Example: Chapter 2

```typescript
{
  id: "chapter-2",
  order: 2,
  title: "Chapter 2 — Implement It in the Business",
  lessons: [...7 modules...],
  topics: [
    {
      id: "topic-ch2-market",
      title: "Market Positioning & Brand",
      lessonIds: ["m-positioning-brand"],
      relatedTopicIds: ["topic-ch2-offer"],
    },
    {
      id: "topic-ch2-offer",
      title: "Offer & Value Proposition",
      lessonIds: ["m-offer"],
      relatedTopicIds: ["topic-ch2-market", "topic-ch2-journey"],
    },
    {
      id: "topic-ch2-customer-ops",
      title: "Customer Journey & Delivery",
      lessonIds: ["m-customer-journey", "m-delivery-operations"],
      relatedTopicIds: ["topic-ch2-offer", "topic-ch2-go-to-market"],
    },
    {
      id: "topic-ch2-go-to-market",
      title: "Go-to-Market: Marketing & Sales",
      lessonIds: ["m-marketing-system", "m-sales-system"],
      relatedTopicIds: ["topic-ch2-customer-ops", "topic-ch2-planning"],
    },
    {
      id: "topic-ch2-planning",
      title: "90-Day Execution Plan",
      lessonIds: ["m-90-day-plan"],
      relatedTopicIds: ["topic-ch2-go-to-market"],
    },
  ],
}
```

### 3.3 Mind-Map Visualization Logic

**Client-Side Rendering (React/D3):**
1. Fetch the stage with its `topics` array.
2. Build a node-link diagram:
   - **Nodes:** Each topic is a node, labeled with the topic title.
   - **Links:** `relatedTopicIds` become edges in the graph.
   - **Clusters:** Topics within the same stage are visually grouped.
3. Lessons within each topic are rendered as sub-nodes or annotations.

**Example Layout:**
```
          [Founder Psychology]
                 ↓
     ┌─────────────┴──────────────┐
     ↓                             ↓
[Business Def]         [Customer Psychology]
     ↓                             ↓
[Strategic Dir]         [Message & Positioning]
```

### 3.4 Storage & Migration

**Scope Creep Avoidance:**
- The `topics` array is **optional** within `StageTemplate`.
- Existing curricula without `topics` continue to work (backward compatible).
- The mind-map feature is a **UI enhancement**, not a gate-logic change.
- Implementation can be phased:
  - Phase 1: Add structure to curriculum-content.ts (where lesson content lives).
  - Phase 2: Build React component to visualize topics.
  - Phase 3: Wire the visualization into the chapter view.

**Data Ownership:**
- Topics and connections are defined in the curriculum (content layer).
- Enrollment progress is blind to topics; gates still operate on individual lessons.
- A lesson's gate depends only on its position in `allLessons()`, not on topic membership.

---

## Part 4: @onevyrt/engine Changes Summary

### 4.1 Schema Version Update

**Current:** `CURRICULUM_SCHEMA_VERSION = 3`

**Proposed Change:** Increment to `4` only if the curriculum shape itself changes programmatically. If Chapter 4 is a content addition (new lessons added to the layout) but the shape rules remain the same, no version bump is needed.

**Recommendation:** Keep version at `3`; version bumps are for *transformation rules*, not content additions.

### 4.2 Enrollment.ts (No Changes Required)

The existing gate logic is **universal** and requires no changes:
- `effectiveStatus()` works for any number of lessons and stages.
- `capStatusByStage()` works for any stage order.
- `summarizeEnrollment()` counts lessons regardless of how many chapters exist.

### 4.3 Curriculum-Chapters.ts (Content Addition)

1. Add Chapter 4 to `CANONICAL_STAGES`.
2. Add Chapter 4 lessons to `CANONICAL_LESSON_LAYOUT`.
3. Add mapping entries to `OLD_TO_NEW_LESSON` if backporting existing enrollments.
4. Update `LESSON_TO_STAGE` (computed automatically from the layout).

### 4.4 Curriculum.ts (Optional: Topics Support)

Add optional `topics` field to `StageTemplate` (see Part 3 for details).

---

## Part 5: Gate State Machine Diagram

```
                    START OF JOURNEY
                           ↓
                   m-start-assessment
                    (available)
                           ↓
                  ✓ Learner submits
                  ✓ Coach approves
                           ↓
                  CHAPTER 1 UNLOCKS
                           ↓
      m-founder-psychology → m-business-definition → m-customer-psychology
            → m-transformation-message → m-strategic-direction
                           ↓
                  ✓ Last module approved
                           ↓
                  CHAPTER 2 UNLOCKS
                           ↓
      m-positioning-brand → m-offer → m-customer-journey
            → m-marketing-system → m-sales-system → m-delivery-operations
            → m-90-day-plan
                           ↓
                  ✓ Last module approved
                           ↓
                  CHAPTER 3 UNLOCKS
                           ↓
      m-personal-freedom-number → m-price-unit-economics
            → m-growth-mathematics → m-business-economics
            → m-plan-vs-actual → m-improvement-loop
                           ↓
                  ✓ Last module approved
                           ↓
          [PROPOSED] CHAPTER 4 UNLOCKS
                           ↓
      m-revenue-optimization → m-team-scaling → m-operational-efficiency
            → m-market-expansion [+ others]
                           ↓
                  ✓ Last module approved
                           ↓
              FINISH STAGE UNLOCKS
                           ↓
                  m-finish-transformation
                (Transformation Report)
                           ↓
                   END OF JOURNEY
```

---

## Part 6: Implementation Checklist for Wave 2/3

- [ ] **Curriculum Content**
  - [ ] Define Chapter 4 psychological state and outcome.
  - [ ] List 4–6 Chapter 4 modules with semantic IDs.
  - [ ] Add to `CANONICAL_STAGES` and `CANONICAL_LESSON_LAYOUT`.
  
- [ ] **Gate Logic Verification**
  - [ ] Confirm `effectiveStatus()` unlocks Chapter 4 correctly after Ch3 completion.
  - [ ] Verify Finish only unlocks after Ch4 completion.
  - [ ] Test cohort pacing caps with new stage orders (0–5 or 0–6).
  
- [ ] **Migration & Backward Compatibility**
  - [ ] Decide: Does Finish move to order 6, or can learners skip Chapter 4?
  - [ ] If Finish moves: Update `remapStageAccessLimit()` if needed.
  - [ ] Add Chapter 4 to `OLD_TO_NEW_LESSON` if retrofitting existing enrollments.
  
- [ ] **Mind-Map Visualization** (Phase 2+)
  - [ ] Define topics structure for each chapter.
  - [ ] Add `topics` field to curriculum content.
  - [ ] Build React component to render mind-map.
  - [ ] Wire into chapter view.
  
- [ ] **Testing**
  - [ ] Unit tests in `enrollment.test.ts`: Ch4 unlock gates.
  - [ ] Integration tests: learner progresses through all 5 stages.
  - [ ] Cohort pacing tests: cap at different stage orders.

---

## Part 7: Open Questions & Design Decisions

1. **Chapter 4 Mandatory or Optional?**
   - Current recommendation: Mandatory (Finish moves to order 6).
   - Alternative: Optional (learners can complete Ch3 → Finish, skipping Ch4).
   - Decision needed before implementation.

2. **Chapter 4 Module Count & Content?**
   - Proposed: 4–6 modules (Revenue Optimization, Team Scaling, Operational Efficiency, Market Expansion, +1–2 optional).
   - Content TBD by curriculum team.

3. **Mind-Map Phases?**
   - Phase 1 (Sprint 1): Define topic structure in curriculum-content.
   - Phase 2 (Sprint 2–3): React visualization component.
   - Phase 3 (Sprint 4+): Full integration & polish.

4. **Cohort Pacing & Chapter 4?**
   - Can a cohort cap at Chapter 4 (order 5), or should Finish always be available once all prior chapters are approved?
   - Recommend: Allow capping at any stage; it's up to the coach.

---

## Appendix: Code References

**Key Files:**
- `packages/engine/src/enrollment.ts` — Gate logic (effectiveStatus, capStatusByStage).
- `packages/engine/src/curriculum-chapters.ts` — Canonical structure & layout.
- `packages/engine/src/curriculum.ts` — Curriculum data model.
- `apps/web/lib/enrollments.ts` — Storage & submission enforcement.
- `packages/engine/test/enrollment.test.ts` — Unit tests.

**Related Docs:**
- `curriculum-content.ts` — Lesson content (where mind-map topics would live).
- Programme API routes (TBD path) — Submission & review endpoints.

---

## Sign-Off

This specification is ready for Wave 2/3 implementation teams to:
1. Define Chapter 4 curriculum content (psychological state, modules, assignments).
2. Implement the 5-stage extension in curriculum-chapters.ts.
3. Verify gate logic works correctly with new stage structure.
4. Plan mind-map visualization phasing.

No changes to @onevyrt/engine gate logic itself are required; the existing system is universal and will automatically support Chapter 4 once it is added to the curriculum.
