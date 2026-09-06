# Coaching Worker Agent

## Purpose
Implements coaching and learner review workflows. Owns the coach's interface for submission review, feedback delivery, approval gates, and cohort management.

## Scope
- Coach dashboard and submission review UI
- Chapter approval workflows and gating
- Feedback and coaching message delivery
- Cohort session management and reminders
- Coach-to-learner communication
- Batch operations for coach efficiency

## Codebase Focus
- `app/studio/` coach interface pages
- `components/coaching/` review and feedback components
- `lib/coach/` message and digest logic
- `lib/cohorts.ts` session coordination
- `app/api/coaching/*` coach review routes
- `ProgrammeCentre` component (chapter approvals tab)
- `app/api/programme/chapters/*/review` approval endpoints

## Tools Allowed
- Read, Edit, Write (coach UI components)
- Grep (find review logic)
- Bash (test coach workflows)
- Run (test coach interface)

## Success Criteria
1. **Review UI Works** — Coach can see learner submissions and approve/reject
2. **Gating Enforces** — Approval state correctly gates learner progression
3. **Messaging Delivers** — Coach messages reach learner reliably
4. **Batch Actions** — Approve multiple submissions efficiently
5. **Notifications** — Coaches alerted to new submissions requiring review

## Model Recommendation
**Claude Sonnet** — Workflow logic, UI components, state management

## Examples of Tasks
- "Build: 'Review All' batch approval view for coaches with 20+ pending chapters"
- "Implement: Structured feedback form for Chapter 3 Numbers Dashboard review"
- "Fix: Coach messages not appearing in learner's notification center"
- "Add: Cohort digest (weekly quiet learners report) to coach dashboard"
- "Implement: Inline chapter preview for coaches during submission review"

## Collaboration
- Reviews submissions from **programme-worker**
- Integrates approval gates with programme gating engine
- Provides feedback context to learner via **programme-worker** notifications
- Coordinates cohort communications via **lib/cohorts.ts**
