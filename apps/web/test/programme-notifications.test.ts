import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubmissionEmail,
  buildReviewEmail,
  buildReportReadyEmail,
  selectCoachRecipients,
  selectLearnerRecipient,
  type MemberSummary,
} from "../lib/programme-notifications";

// Everything under test here is pure — the message builders and the recipient
// selectors — so no DB and no network are touched. The notify* wrappers that DO
// hit the DB/mailer are left to the route-level flow; this file locks down the
// two things that matter: WHO gets mailed and WHAT the mail says.

const members: MemberSummary[] = [
  { userId: "owner1", email: "Learner@Example.com", role: "owner" },
  { userId: "mgr1", email: "coach@example.com", role: "manager" },
  { userId: "mgr2", email: "coach2@example.com", role: "manager" },
  { userId: "ed1", email: "editor@example.com", role: "editor" },
  { userId: "v1", email: "viewer@example.com", role: "viewer" },
];

test("selectCoachRecipients picks only managers", () => {
  const coaches = selectCoachRecipients(members);
  assert.deepEqual(coaches, ["coach@example.com", "coach2@example.com"]);
});

test("selectCoachRecipients excludes a manager who is the submitter, case-insensitively", () => {
  const coaches = selectCoachRecipients(members, "COACH@example.com");
  assert.deepEqual(coaches, ["coach2@example.com"]);
});

test("selectCoachRecipients dedupes repeated coach emails", () => {
  const dupes: MemberSummary[] = [
    { userId: "a", email: "c@example.com", role: "manager" },
    { userId: "b", email: "c@example.com", role: "manager" },
  ];
  assert.deepEqual(selectCoachRecipients(dupes), ["c@example.com"]);
});

test("selectCoachRecipients returns [] when there is no coach", () => {
  const noCoach: MemberSummary[] = [{ userId: "o", email: "o@example.com", role: "owner" }];
  assert.deepEqual(selectCoachRecipients(noCoach), []);
});

test("selectLearnerRecipient returns the owner's email", () => {
  assert.equal(selectLearnerRecipient(members), "Learner@Example.com");
});

test("selectLearnerRecipient skips the owner when they are the reviewer", () => {
  assert.equal(selectLearnerRecipient(members, "learner@example.com"), undefined);
});

test("selectLearnerRecipient returns undefined with no owner row", () => {
  const noOwner: MemberSummary[] = [{ userId: "m", email: "m@example.com", role: "manager" }];
  assert.equal(selectLearnerRecipient(noOwner), undefined);
});

test("buildSubmissionEmail: subject names the lesson, body names learner + relative link", () => {
  const msg = buildSubmissionEmail({ to: "coach@example.com", learnerEmail: "learner@example.com", lessonTitle: "Define your offer" });
  assert.equal(msg.to, "coach@example.com");
  assert.equal(msg.subject, "New submission to review — Define your offer");
  assert.match(msg.text, /learner@example\.com/);
  assert.match(msg.text, /Define your offer/);
  assert.match(msg.text, /\/studio\?panel=programme/);
  // Relative link only — no absolute host baked in.
  assert.doesNotMatch(msg.text, /https?:\/\//);
});

test("buildReviewEmail (approved): subject + body reflect approval", () => {
  const msg = buildReviewEmail({ to: "learner@example.com", decision: "approved", lessonTitle: "Define your offer" });
  assert.equal(msg.to, "learner@example.com");
  assert.equal(msg.subject, "Approved — Define your offer");
  assert.match(msg.text, /approved/i);
  assert.match(msg.text, /Define your offer/);
  assert.match(msg.text, /\/studio\?panel=programme/);
});

test("buildReviewEmail (changes_requested): subject + body reflect the ask and include feedback", () => {
  const msg = buildReviewEmail({
    to: "learner@example.com",
    decision: "changes_requested",
    lessonTitle: "Define your offer",
    feedback: "Tighten the guarantee.",
  });
  assert.equal(msg.subject, "Changes requested — Define your offer");
  assert.match(msg.text, /requested changes/i);
  assert.match(msg.text, /Coach feedback:/);
  assert.match(msg.text, /Tighten the guarantee\./);
});

test("buildReviewEmail omits the feedback block when feedback is blank", () => {
  const msg = buildReviewEmail({ to: "l@example.com", decision: "approved", lessonTitle: "X", feedback: "   " });
  assert.doesNotMatch(msg.text, /Coach feedback:/);
});

test("buildReportReadyEmail: addressed to the learner, links to the report, mentions the Next 90-Day Plan", () => {
  const msg = buildReportReadyEmail({ to: "learner@example.com" });
  assert.equal(msg.to, "learner@example.com");
  assert.equal(msg.subject, "Your Transformation Report is ready");
  assert.match(msg.text, /Chapter 4/);
  assert.match(msg.text, /Next 90-Day Plan/);
  assert.match(msg.text, /\/account\/transformation-report/);
});
