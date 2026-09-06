# Wave 1 Lane 4 Spec: Coaching Workflows & Batch Operations

**Goal:** Specify current chapter submission/approval workflows, map Chapter 4 integration, and design batch operations API for coaches managing multiple learners efficiently.

**Status:** Ready for Wave 2/3 implementation

---

## 1. Current Submission/Approval Workflow (Chapters 1–3)

### 1.1 Learner Submission Flow

**Trigger:** Learner reaches end of chapter (all lessons in chapter completed or coach-approved)

**Endpoint:** `POST /api/programme/chapters/[stageId]/submit`

**Request:**
```json
{
  "evidence": "string (max 4000 chars, trimmed)"
}
```

**Validations:**
- User is authenticated and has `viewer` role or higher on workspace
- `stageId` matches a known chapter (start, chapter-1, chapter-2, chapter-3)
- Chapter is "ready_to_submit" or "changes_requested" (per engine's chapterGates)
- No pending submission already exists for this chapter (duplicate guard)
- Evidence is non-empty after trim, max 4000 chars
- Workspace hasn't hit MAX_SUBMISSIONS (200) cap

**Response (Success):**
```json
{
  "submission": {
    "stageId": "chapter-1",
    "submittedAt": "2026-09-02T14:30:00Z",
    "evidence": "...",
    "reviewStatus": "submitted",
    "coachFeedback": null,
    "reviewedAt": null,
    "reviewedBy": null
  }
}
```

**Response (Error):**
- 401: not authenticated
- 403: viewers cannot submit
- 400: evidence empty, duplicate pending, chapter not reachable, workspace at MAX_SUBMISSIONS
- 404: unknown chapter

**Side Effects:**
- Activity recorded: `programme.chapter_submit` with stageId detail
- Prevents "gone quiet" false positive in engagement classifier

**Storage:** Appended to `chapter_submissions` JSONB array, keyed by workspace_id

### 1.2 Coach Review Flow

**Who:** Workspace owner or manager (coach role)

**Endpoint:** `POST /api/programme/chapters/[stageId]/review`

**Request:**
```json
{
  "reviewStatus": "approved" | "changes_requested",
  "coachFeedback": "string (optional, max 4000 chars, trimmed)"
}
```

**Validations:**
- User is authenticated and has `owner` or `manager` role
- `stageId` matches a known chapter
- Latest submission for this chapter exists (by submittedAt, ties to most recently added)
- Chapter gate state is currently "awaiting_review" (prevents early decisions)
- `reviewStatus` is exactly "approved" or "changes_requested"

**Response (Success):**
```json
{ "ok": true }
```

**Response (Error):**
- 401: not authenticated
- 403: only owner or manager can review
- 400: invalid reviewStatus
- 404: no submission found OR chapter not in "awaiting_review" state

**Mutation:**
```javascript
latest.reviewStatus = input.reviewStatus;
latest.reviewedAt = new Date().toISOString();
latest.reviewedBy = input.reviewedBy; // coach email
if (feedback) latest.coachFeedback = feedback.trim().slice(0, 4000);
```

**Effect on Gates:** Engine's chapterGates() immediately reflects approval:
- `approved` → chapter marked complete, next chapter gate becomes "ready_to_submit"
- `changes_requested` → chapter remains "changes_requested", learner can resubmit

**No notification yet** — surfaced only in coach UI and learner's own progress

### 1.3 Dual Storage Pattern

**Chapter Submissions Table:**
```sql
CREATE TABLE chapter_submissions (
  workspace_id UUID PRIMARY KEY,
  submissions JSONB -- array of ChapterSubmission
);
```

**ChapterSubmission type:**
```typescript
interface ChapterSubmission {
  stageId: string;
  submittedAt: string; // ISO8601
  evidence: string;
  reviewStatus: "submitted" | "approved" | "changes_requested";
  coachFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string; // coach email
}
```

**Advisory Lock:** All mutations happen under a cross-instance lock (`chapter-submissions:${workspaceId}`) to prevent concurrent writes from different app instances.

**Read Path:** Lock-free, cache-friendly reads via `listChapterSubmissions(workspaceId)`

---

## 2. Coach Dashboard: Submission List Requirements

### 2.1 Current "Coach Review" View (ProgrammeCentre.tsx)

**Location:** `/api/programme/coach-workspaces` (loaded in ProgrammeCentre's "Coach review" tab)

**Data Shape:**
```typescript
interface CoachClient {
  workspaceId: string;
  workspaceName: string;
  summary: {
    awaitingReview: { lessonId: string }[]; // lesson submissions
    changesRequested: string[];
  };
  chaptersAwaitingReview: {
    stageId: string;
    stageTitle: string;
    order: number;
    submission: ChapterSubmission;
  }[];
}
```

**UI Behavior:**
- Separate "LESSON SUBMISSIONS" and "CHAPTER APPROVALS" sections
- Each chapter item shows: workspace name, chapter order + title, submission timestamp, evidence (pre-wrapped), coach feedback textarea
- Approve / Request Changes buttons side-by-side
- Single-chapter review supported (after click, mutates `chapterReviewFeedback[key]` where key = `${workspaceId}:${stageId}`)

### 2.2 Current Limitations (Batch Operations Gap)

**Single-Item Review Only:**
- Coach must click approve/request-changes one chapter at a time
- No bulk select
- No way to send same feedback to multiple learners
- No filtering (by stage, status, recent first)
- No pagination (flattened across all workspaces on one page)
- No bulk message template

**Performance Bottleneck:**
- Coach reviewing 50 learners = 50 individual API calls
- Each call locks the workspace's advisory lock sequentially
- No dashboard reporting (e.g., "10 pending chapters, 3 changes requested")

### 2.3 Coach Dashboard Requirements for Wave 2/3

**Desired UX:**
```
┌─────────────────────────────────────────────────┐
│ CHAPTER APPROVALS                               │
├─────────────────────────────────────────────────┤
│ [Filters]     [Sort: Submitted desc ▼]          │
│ □ Chapter 1 (3)  □ Chapter 2 (5)  □ Approved   │
├─────────────────────────────────────────────────┤
│ □ Alice Corp     | Chapter 1 | submitted 2h ago│
│ □ Bob Ventures   | Chapter 2 | submitted 1d ago│
│ □ Carol & Co     | Chapter 1 | submitted 3d ago│
├─────────────────────────────────────────────────┤
│ [Select all] [Approve selected] [Request changes]
│ [Apply feedback template]                       │
└─────────────────────────────────────────────────┘
```

**Features:**
- **Filters:** By stageId, reviewStatus (submitted/approved/changes_requested), time window (today, this week, older)
- **Sorting:** By submittedAt (desc default), stageId, workspaceName
- **Bulk Selection:** Checkboxes, select-all toggle
- **Bulk Actions:** Approve all, request changes (with optional template feedback)
- **Pagination:** 10–25 items per page (load more or cursor-based)
- **Summary Stats:** Total pending, breakdown by chapter

**Learner Card Display (after selection):**
- Workspace name (clickable to switch context)
- Chapter order + title
- Submitted timestamp (relative: "2h ago")
- Evidence preview (first 200 chars, truncated)
- Coach feedback textarea (if reviewing)
- Status badge (Submitted / Approved / Changes Requested)

---

## 3. Chapter 4 Workflow Integration

### 3.1 Chapter 4 Unique Characteristics

**Unlike Chapters 1–3:**

1. **Mutable Post-Approval:** Growth & Improvement Plan can be edited after coach approval
   - Learner may refine actions, targets between 90-day cycles
   - Coach re-approval not required for edits (coach feedback was advisory)
   - Differs from chapters 1–3 (locked once approved)

2. **Subchapter Structure:** 5–6 subchapters (4.1–4.6), each with optional submission
   - 4.6 (Team & Capacity) only appears if business has staff
   - Not all subchapters require submission (e.g., learning-only)
   - Approval happens at chapter level (all submitted subchapters), not per-subchapter

3. **Long-Lived Artifact:** Growth & Improvement Plan is the persistent learner document
   - Copied to learner workspace after approval
   - Can be revisited, updated during action execution
   - May be referenced in later chapters or future programmes

4. **Approval Criteria:** Coach reviews entire plan (actions, metrics, feasibility)
   - Similar decision model: Approve / Request Changes
   - Feedback likely more detailed (feasibility, prioritization guidance)

### 3.2 Chapter 4 Submission Schema

**New Endpoint Pattern (mirrors chapters 1–3):**
- `POST /api/programme/chapters/chapter-4/submit` — learner submits plan
- `POST /api/programme/chapters/chapter-4/review` — coach approves/requests changes

**Chapter 4 Submission Storage:**

**New Column on `chapter_submissions` table:** Chapter 4 entries have extra fields:
```typescript
interface Chapter4Submission extends ChapterSubmission {
  stageId: "chapter-4";
  // Plan snapshot at submission time
  plan: {
    constraint: string; // from 4.1
    metrics: {
      [metricName: string]: {
        current: number;
        target: number;
        unit: string;
      };
    };
    actions: string[]; // top 3–5 from 4.5
    teamPlanIncluded: boolean; // was 4.6 shown/submitted?
  };
  // Mutable state (distinct from submission)
  currentPlan?: {
    updatedAt: string;
    constraint: string; // may differ from plan.constraint
    actions: string[]; // may differ from plan.actions
    updatedBy: string; // learner email
  };
}
```

**Immutable After Submission:** Original `plan` snapshot is never modified (audit trail).

**Mutable After Approval:** Learner can update `currentPlan` fields after coach approval.

### 3.3 Chapter 4 Coach Review UI (Same as 1–3)

**ProgrammeCentre Integration:**
- Chapter 4 items appear in "CHAPTER APPROVALS" section alongside chapters 1–3
- Same approve/request-changes buttons
- Same feedback textarea (coach notes on plan viability)

**Difference in Workflow:**
- Approval does NOT lock the plan
- Coach feedback is "please revise these actions" or "feasibility concern on this metric"
- Learner sees feedback, can modify plan, resubmit (unlike chapters 1–3 where approval is final)

**Future Enhancement (Wave 3+):**
- Track plan updates post-approval (audit log)
- Optional: "Coach, review updated plan?" flow if learner makes significant edits

---

## 4. Batch Operations API Design

### 4.1 Requirements Summary

**Use Case:** Coach reviewing 20–50 submissions in one session.

**Goal:** Reduce API calls from N (one per submission) to ~3 (list, bulk approve, bulk request-changes).

**Constraints:**
- Must preserve individual feedback per submission (coach may have different notes)
- Must support per-item decisions (some approve, some request changes in same batch)
- Must integrate with existing advisory lock pattern (no deadlocks)
- Must record separate `reviewedBy` per decision (may have multiple coaches)
- Must support optional template feedback + optional per-item overrides

### 4.2 Batch Submission List Endpoint

**Endpoint:** `GET /api/programme/chapters/submissions`

**Query Params:**
```
?stage=chapter-1,chapter-2                    # comma-sep stageIds, default: all
&status=submitted,changes_requested           # submitted | approved | changes_requested
&before=2026-09-02T15:00:00Z                  # submissions before this timestamp
&after=2026-09-02T10:00:00Z                   # submissions after this timestamp
&sort=-submittedAt                            # -submittedAt | stageId | workspaceName
&limit=25                                     # default 25, max 100
&cursor=opaque_string                         # pagination cursor
```

**Response:**
```json
{
  "submissions": [
    {
      "key": "ws-123:chapter-1",
      "workspaceId": "ws-123",
      "workspaceName": "Alice Corp",
      "stageId": "chapter-1",
      "stageTitle": "Chapter 1 — Define...",
      "stageOrder": 1,
      "submission": {
        "submittedAt": "2026-09-02T12:30:00Z",
        "evidence": "...",
        "reviewStatus": "submitted",
        "coachFeedback": null,
        "reviewedAt": null,
        "reviewedBy": null
      }
    }
  ],
  "nextCursor": "opaque_string_or_null",
  "stats": {
    "total": 47,
    "submitted": 32,
    "approved": 10,
    "changesRequested": 5
  }
}
```

**Scope:** Returns ALL chapters awaiting or recently reviewed by this coach, across all coached workspaces (not just active workspace).

**Permissions:** Coach (owner or manager) only.

**Performance:**
- Single query: fetch all coached workspaces' chapter_submissions
- Filter in-memory (submissions array is small, typically <200 per workspace)
- No N+1 queries (all data in one JSONB column per workspace)
- Cursor-based pagination (stateless, uses `submittedAt + workspaceId` as cursor)

### 4.3 Batch Review Endpoint

**Endpoint:** `POST /api/programme/chapters/submissions/bulk-review`

**Request:**
```json
{
  "decisions": [
    {
      "workspaceId": "ws-123",
      "stageId": "chapter-1",
      "reviewStatus": "approved",
      "coachFeedback": "Great work. Ready to move on."
    },
    {
      "workspaceId": "ws-456",
      "stageId": "chapter-2",
      "reviewStatus": "changes_requested",
      "coachFeedback": "Please expand on customer psychology section."
    }
  ]
}
```

**Constraints:**
- Max 50 decisions per request
- Each decision must have workspaceId, stageId, reviewStatus
- coachFeedback optional per item (trimmed to 4000 chars)

**Processing:**
1. **Validate:** Auth (coach role), all stageIds exist, all workspaceIds accessible to this coach
2. **Group by Workspace:** Decisions for ws-123, ws-456, etc.
3. **Process Each Workspace:**
   - Acquire advisory lock for workspace
   - Read current chapter_submissions
   - For each decision:
     - Find latest submission for stageId
     - Verify gate state is "awaiting_review"
     - Apply decision, set reviewedBy to current user email
   - Write updated submissions
   - Release lock
4. **Record Activity:** One activity record per workspace: `programme.chapter_bulk_review` with count

**Response (Success):**
```json
{
  "processed": 2,
  "results": [
    {
      "workspaceId": "ws-123",
      "stageId": "chapter-1",
      "ok": true
    },
    {
      "workspaceId": "ws-456",
      "stageId": "chapter-2",
      "ok": true
    }
  ]
}
```

**Response (Partial Failure):**
```json
{
  "processed": 1,
  "results": [
    { "workspaceId": "ws-123", "stageId": "chapter-1", "ok": true },
    {
      "workspaceId": "ws-456",
      "stageId": "chapter-2",
      "ok": false,
      "error": "Chapter not in awaiting_review state (already approved)"
    }
  ]
}
```

**Idempotency:** Not guaranteed (re-running same request applies decisions again). Caller should check current state first via GET endpoint.

### 4.4 Batch Request-Changes Endpoint

**Endpoint:** `POST /api/programme/chapters/submissions/bulk-request-changes`

**Request:**
```json
{
  "template": "Please revise and resubmit within 3 days.",
  "overrides": [
    {
      "workspaceId": "ws-123",
      "stageId": "chapter-1",
      "coachFeedback": "Expand on XYZ section specifically."
    }
  ]
}
```

**Behavior:**
- All selected submissions get `template` feedback by default
- Overrides replace template for specific items
- Decision is always "changes_requested"

**Advantages:**
- Single endpoint for batch request-changes (cleaner UX than approve/request separate)
- Template + overrides pattern reduces typos, ensures consistency

### 4.5 Batch Message Endpoint (Future: Wave 3)

**Endpoint:** `POST /api/programme/chapters/submissions/bulk-message` (not in scope for Wave 1)

**Concept (to be specced in Wave 2):**
- Send message to multiple learners re: chapter feedback
- Separate from coachFeedback field (which is internal)
- Learner sees message in programme UI
- Transactional: all-or-nothing send

---

## 5. Notification Flow

### 5.1 Current State (Chapters 1–3)

**No proactive notifications yet.** Learner finds out status by:
1. Checking their own progress in ProgrammeCentre
2. Waiting for a coach message (manual reach-out)

**Recording:**
- Activity logged: `programme.chapter_submit`, `programme.chapter_bulk_review` (if Wave 1 batch ops added)
- Summarized in engagement classifier (does not flag approved chapters as incomplete)

### 5.2 Proposed Notification Flow (Wave 2/3)

**Trigger: Coach approves chapter**
- Learner receives email: "Your [Chapter 1] submission has been approved. You can now access Chapter 2."
- Email includes coach feedback if provided
- Link to next chapter

**Trigger: Coach requests changes**
- Learner receives email: "Your [Chapter 1] submission needs revision. [Coach feedback]"
- Link back to chapter
- "Resubmit within X days" SLA (if set in future)

**Trigger: Bulk operations**
- One email per learner summarizing their decision(s) (if multiple chapters in one batch review)
- Or: Single consolidated email if all same decision
- TBD: Template vs. per-item feedback in email body

**Implementation (deferred to Wave 3):**
- New route: `POST /api/programme/chapters/notifications/send`
- Webhook/queue: After successful bulk review, enqueue notification job per learner
- Email service integration (existing pattern in lib/coach/messages.ts)

### 5.3 Coach Notification (Future: Wave 3)

**Dashboard Widget:**
- "5 submissions awaiting your review" badge in top navigation
- Click to jump to coach-review tab

**Bulk Action Confirmation:**
- Toast: "Approved 3 submissions" after batch review
- Error toast if any failures

---

## 6. Data Model & Migration

### 6.1 No New Tables Required

**Current Storage Sufficient:**
- Chapter submissions remain in `chapter_submissions` JSONB per workspace
- Add extra fields to ChapterSubmission type for Chapter 4 (currentPlan, etc.)
- Advisory lock pattern scales with batch operations (ordered processing per workspace)

### 6.2 Indexes (Optional, Wave 3 performance optimization)

```sql
-- Enable faster filtering on chapter_submissions.submissions->>'stageId'
CREATE INDEX submissions_stage_idx 
ON chapter_submissions USING GIN (submissions JSONB);

-- If we add a separate chapter_4_submissions table later:
CREATE TABLE chapter_4_submissions (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  submitted_at TIMESTAMP NOT NULL,
  review_status VARCHAR(50) DEFAULT 'submitted',
  coach_feedback TEXT,
  current_plan JSONB,
  UNIQUE(workspace_id, submitted_at)
);
CREATE INDEX chapter4_workspace_idx ON chapter_4_submissions(workspace_id);
CREATE INDEX chapter4_status_idx ON chapter_4_submissions(review_status);
```

### 6.3 Type Extensions

**Add to ChapterSubmission:**
```typescript
interface ChapterSubmission {
  stageId: string;
  submittedAt: string;
  evidence: string;
  reviewStatus: "submitted" | "approved" | "changes_requested";
  coachFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  
  // Chapter 4 only
  plan?: {
    constraint: string;
    metrics: Record<string, { current: number; target: number; unit: string }>;
    actions: string[];
    teamPlanIncluded: boolean;
  };
  currentPlan?: {
    updatedAt: string;
    constraint: string;
    actions: string[];
    updatedBy: string;
  };
}
```

---

## 7. Implementation Roadmap

### Wave 1 (This Lane)
- [x] Document current workflows
- [x] Specify Chapter 4 integration
- [x] Batch operations API design (GET list, POST bulk-review, POST bulk-request-changes)
- [x] Coach dashboard requirements

### Wave 2
- **Batch Operations API** (implement GET /submissions, POST /submissions/bulk-review, POST /submissions/bulk-request-changes)
- **Coach Dashboard UI** (filters, sorting, bulk selection in ProgrammeCentre)
- **Chapter 4 Submission Endpoint** (POST /chapters/chapter-4/submit with Growth Plan)
- **Chapter 4 Review Endpoint** (POST /chapters/chapter-4/review, mirrors chapters 1–3)

### Wave 3
- **Notification System** (email templates, transactional queue)
- **Dashboard Widget** (pending submission count badge)
- **Audit Log** (track Chapter 4 plan updates post-approval)
- **Bulk Message API** (message templates for feedback, separate from coachFeedback)

---

## 8. Open Questions & Notes

### 8.1 Batch Abort Strategy

**Q:** If bulk-review fails for workspace A halfway through, what happens?

**A:** Each workspace is processed independently under its own lock. Failure in ws-A does not affect ws-B. Response includes per-item status.

### 8.2 Chapter 4 Resubmission

**Q:** If coach requests changes on Chapter 4 plan, does learner resubmit entire plan or just edits?

**A:** Full resubmit (mirrors chapters 1–3). New submission record appended, oldLatestSubmissionFor() finds new one.

### 8.3 Template Feedback Length

**Q:** Should template feedback have same 4000-char limit as per-item feedback?

**A:** Yes. Total feedback (template + override) capped at 4000 chars per submission.

### 8.4 Multi-Coach Scenario

**Q:** Can two coaches review same submission simultaneously?

**A:** No. Advisory lock ensures sequential processing. Second coach sees "already reviewed" error on bulk-review if first coach completed it first.

### 8.5 Paginated Bulk Review

**Q:** Coach fetches page 1 (items 1–25), approves all, then fetches page 2. Do page 2 items include updated gate states?

**A:** Yes. GET /submissions reads fresh chapter_submissions each time. Coach should refetch after each bulk-review to see updated statuses.

---

## 9. Success Metrics (Wave 3)

- Coach bulk-reviewing 50 submissions: <5 sec (vs. 50 individual clicks)
- Error rate on batch operations: <0.1%
- Learner notification latency: <2 min from coach approval
- Chapter 4 plan acceptance rate: >80% first-review approval (vs. chapters 1–3 ~70%)

---

## Appendix: Current API Routes Reference

| Route | Method | Scope | Purpose |
|-------|--------|-------|---------|
| `/api/programme/chapters/[stageId]/submit` | POST | Learner | Submit chapter evidence |
| `/api/programme/chapters/[stageId]/review` | POST | Coach | Approve/request changes |
| `/api/programme/coach-workspaces` | GET | Coach | List all learners + chapters awaiting review |
| `/api/programme/chapters/submissions` | GET | Coach | **[NEW]** Batch list with filters/sort |
| `/api/programme/chapters/submissions/bulk-review` | POST | Coach | **[NEW]** Bulk approve/request changes |
| `/api/programme/chapters/submissions/bulk-request-changes` | POST | Coach | **[NEW]** Bulk request-changes with templates |
| `/api/programme/chapters/chapter-4/submit` | POST | Learner | **[NEW]** Submit Chapter 4 Growth Plan |
| `/api/programme/chapters/chapter-4/review` | POST | Coach | **[NEW]** Review Chapter 4 plan |
| `/api/programme/chapters/submissions/bulk-message` | POST | Coach | **[FUTURE]** Bulk learner messaging |
| `/api/programme/chapters/notifications/send` | POST | System | **[FUTURE]** Send approval/changes notifications |

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-02  
**Status:** Ready for Wave 2/3 Implementation  
**Assignee (Wave 2):** [Team assigned in Wave 2]
