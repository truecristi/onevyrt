"use client";
/**
 * A coach's review page for one Chapter 4 (Growth & Improvement Plan)
 * submission. The actual review UI (subchapter breakdown, plan preview,
 * decision form) lives in ChapterSubmissionReview — self-contained, fetches
 * its own data from the submissionId in the URL. This page supplies the
 * surrounding chrome: the learner's wider programme context and this
 * submission's history, both read from the SAME payload
 * ChapterSubmissionReview already fetched (via onLoaded) rather than a
 * second request.
 */
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageShell } from "../../../../../components/ui/PageShell";
import { Card, Badge } from "../../../../../components/ui/Card";
import { ChapterSubmissionReview, formatWhen } from "../../../../../components/coaching/ChapterSubmissionReview";
import type { SubmissionReview } from "../../../../../lib/coaching/chapter-4-review";

const STATE_TONE: Record<string, "success" | "warning" | "neutral"> = {
  approved: "success",
  changes_requested: "warning",
};

export default function Chapter4SubmissionPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId = params?.submissionId ?? "";
  const [review, setReview] = useState<SubmissionReview | null>(null);

  return (
    <PageShell
      eyebrow="Coach review"
      title="Chapter 4 — Growth & Improvement Plan"
      subtitle={review ? `${review.workspaceName}${review.learner ? ` · ${review.learner.email}` : ""}` : "Loading…"}
    >
      {review?.learner && (
        <Card className="c4p-context">
          <div className="c4p-context-row">
            <div className="c4p-context-progress">
              <div className="ds-help">Programme progress (Chapters 1–3)</div>
              <div className="c4p-progress-value">{review.learner.percentComplete}%</div>
              <div className="ds-help">{review.learner.completedLessons} of {review.learner.totalLessons} modules complete</div>
            </div>
            <div className="c4p-context-chapters">
              <div className="ds-help">Previous chapters</div>
              <div className="c4p-badges">
                {review.learner.previousChapters.length === 0 && <span className="ds-help">—</span>}
                {review.learner.previousChapters.map((c) => (
                  <Badge key={c.stageId} tone={STATE_TONE[c.state] ?? "neutral"}>
                    {c.title.replace(/^Chapter\s*\d+\s*—\s*/i, "")}: {c.state.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {review.submission && (review.submission.submittedAt || review.submission.reviewedAt) && (
            <div className="c4p-history">
              <div className="ds-help">History</div>
              <ul>
                {review.submission.submittedAt && (
                  <li>Submitted {formatWhen(review.submission.submittedAt)}{review.submission.submittedBy ? ` by ${review.submission.submittedBy}` : ""}</li>
                )}
                {review.submission.reviewedAt && (
                  <li>
                    {review.submission.coachDecision === "approved" ? "Approved" : "Changes requested"} {formatWhen(review.submission.reviewedAt)}
                    {review.submission.reviewedBy ? ` by ${review.submission.reviewedBy}` : ""}
                    {review.submission.coachFeedback ? ` — “${review.submission.coachFeedback}”` : ""}
                  </li>
                )}
              </ul>
            </div>
          )}
        </Card>
      )}

      {submissionId ? (
        <ChapterSubmissionReview submissionId={submissionId} onLoaded={setReview} />
      ) : (
        <p className="ds-help">Missing submission id.</p>
      )}

      <style>{`
        .c4p-context { padding: 16px 18px; margin-bottom: 16px; }
        .c4p-context-row { display: flex; gap: 28px; flex-wrap: wrap; }
        .c4p-progress-value { font-size: 22px; font-weight: 800; }
        .c4p-context-chapters { flex: 1; min-width: 220px; }
        .c4p-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
        .c4p-history { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--ds-border, #e2e8f0); }
        .c4p-history ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
        .c4p-history li { margin-bottom: 4px; }
      `}</style>
    </PageShell>
  );
}
