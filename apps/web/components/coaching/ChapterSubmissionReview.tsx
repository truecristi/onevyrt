"use client";
/**
 * ChapterSubmissionReview — a coach's review surface for one Chapter 4
 * (Growth & Improvement Plan) submission: a subchapter-by-subchapter
 * breakdown of what the learner has filled in, a preview of the plan itself
 * — rendered through the SAME GrowthImprovementPlan artifact component the
 * learner sees, so a coach reviews exactly what the learner will read back —
 * and the Approve / Request changes decision form.
 *
 * Self-contained, following components/coach/LearnerDetailDrawer.tsx's
 * pattern: fetches its own data (GET /api/coaching/chapter/4/review) from
 * nothing more than a submissionId prop, and renders its own loading/error
 * states, so any surface — this lane's own review page, or a future modal —
 * can drop it in with just that one prop. The decision form is disabled once
 * the API reports the submission isn't `reviewable` (already decided, and
 * not yet resubmitted).
 */
import { useCallback, useEffect, useState } from "react";
import { Card, Badge, Field } from "../ui/Card";
import { Notice } from "../ui/Notice";
import { formatPlan, type GrowthPlan } from "../../lib/growth-plan-utils";
import { GrowthImprovementPlan } from "../programme/GrowthImprovementPlan";
import type { SubmissionReview, SubchapterResponse, Chapter4Decision } from "../../lib/coaching/chapter-4-review";

type LoadState = "loading" | "ok" | "not-authenticated" | "error";

export interface ChapterSubmissionReviewProps {
  submissionId: string;
  /** Called after a decision is successfully submitted, so a parent list or
   *  page can refresh its own data or navigate away. */
  onReviewed?: (decision: Chapter4Decision) => void;
  /** Called with the full review payload once it loads (and again after a
   *  decision, since the component reloads itself) — lets a parent page
   *  render its own supplementary chrome (learner context, submission
   *  history) from the SAME fetch, instead of duplicating the request. */
  onLoaded?: (review: SubmissionReview) => void;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SubchapterRow({ s }: { s: SubchapterResponse }) {
  return (
    <li className="csr-subrow">
      <div className="csr-subrow-head">
        <span className="csr-subrow-id">{s.id}</span>
        <span className="csr-subrow-title">{s.title}</span>
        <Badge tone={s.completed ? "success" : "neutral"}>{s.completed ? "Done" : "Not started"}</Badge>
      </div>
      {s.fields && (
        <dl className="csr-subrow-fields">
          {Object.entries(s.fields).map(([key, value]) => (
            <div className="csr-subrow-field" key={key}>
              <dt>{key}</dt>
              <dd>{Array.isArray(value) ? `${value.length} item(s)` : value == null || value === "" ? "—" : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

export function ChapterSubmissionReview({ submissionId, onReviewed, onLoaded }: ChapterSubmissionReviewProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [decision, setDecision] = useState<Chapter4Decision | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [justReviewed, setJustReviewed] = useState<Chapter4Decision | null>(null);

  const load = useCallback(async () => {
    setState("loading"); setErrorMsg("");
    try {
      const r = await fetch(`/api/coaching/chapter/4/review?submission_id=${encodeURIComponent(submissionId)}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      const data = (await r.json()) as { review?: SubmissionReview; error?: string };
      if (!r.ok || !data.review) { setErrorMsg(data.error ?? "Could not load this submission."); setState("error"); return; }
      setReview(data.review);
      setState("ok");
      onLoaded?.(data.review);
    } catch {
      setErrorMsg("Network error — is the app reachable?");
      setState("error");
    }
  }, [submissionId, onLoaded]);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async () => {
    if (!decision || busy) return;
    setBusy(true); setSubmitErr("");
    try {
      const r = await fetch("/api/coaching/chapter/4/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, decision, feedback }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setSubmitErr(data.error ?? "Could not submit your review — please try again."); setBusy(false); return; }
      setJustReviewed(decision);
      onReviewed?.(decision);
      await load();
    } catch {
      setSubmitErr("Network error — couldn't submit your review.");
    }
    setBusy(false);
  }, [decision, feedback, busy, submissionId, onReviewed, load]);

  if (state === "loading") return <p className="ds-help">Loading submission…</p>;
  if (state === "not-authenticated") return <Notice icon="lock" title="Sign in required" body="Sign in to review this submission." />;
  if (state === "error" || !review) return <Notice icon="warning" title="Couldn't load this submission" body={errorMsg || "It may have moved, or you may not have access."} onRetry={() => void load()} />;

  const plan: GrowthPlan | null = review.submission ? formatPlan(review.submission) : null;

  return (
    <div className="csr-root">
      <style>{CSS}</style>

      <Card className="csr-block">
        <h3 className="csr-heading">Subchapter responses</h3>
        <ul className="csr-subchapters">
          {review.subchapters.map((s) => <SubchapterRow key={s.id} s={s} />)}
        </ul>
      </Card>

      <Card className="csr-block">
        <h3 className="csr-heading">Growth &amp; Improvement Plan — preview</h3>
        {plan ? (
          <GrowthImprovementPlan plan={plan} workspaceName={review.workspaceName} />
        ) : (
          <p className="ds-help">This learner hasn&rsquo;t started their Growth &amp; Improvement Plan yet.</p>
        )}
      </Card>

      <Card className="csr-block">
        <h3 className="csr-heading">Your decision</h3>
        {!review.reviewable ? (
          <p className="ds-help">
            {justReviewed
              ? `You ${justReviewed === "approve" ? "approved" : "requested changes on"} this plan.`
              : review.submission?.coachDecision
                ? `This plan was already ${review.submission.coachDecision === "approved" ? "approved" : "sent back for changes"}${review.submission.reviewedAt ? ` on ${formatWhen(review.submission.reviewedAt)}` : ""} — nothing new to review until the learner resubmits.`
                : "Nothing is currently submitted for review."}
          </p>
        ) : (
          <>
            <div className="csr-radios" role="radiogroup" aria-label="Decision">
              <label className="csr-radio">
                <input type="radio" name="decision" value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} disabled={busy} />
                Approve
              </label>
              <label className="csr-radio">
                <input type="radio" name="decision" value="request_changes" checked={decision === "request_changes"} onChange={() => setDecision("request_changes")} disabled={busy} />
                Request changes
              </label>
            </div>
            <Field label="Feedback" help="Optional for an approval; recommended when requesting changes.">
              <textarea
                className="ds-textarea"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Notes or guidance for the learner…"
                disabled={busy}
                rows={4}
              />
            </Field>
            {submitErr && <p className="csr-error" role="alert">{submitErr}</p>}
            <button type="button" className="ds-btn ds-btn--primary" onClick={() => void submit()} disabled={!decision || busy}>
              {busy ? "Submitting…" : "Submit review"}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

const CSS = `
.csr-root { display: flex; flex-direction: column; gap: 16px; }
.csr-block { padding: 18px; }
.csr-heading { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: var(--ds-text-primary, #111827); }
.csr-subchapters { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.csr-subrow { border: 1px solid var(--ds-border, #e2e8f0); border-radius: 10px; padding: 10px 12px; }
.csr-subrow-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.csr-subrow-id { font-size: 11px; font-weight: 700; color: var(--ds-text-secondary, #64748b); }
.csr-subrow-title { flex: 1; font-size: 13px; font-weight: 600; }
.csr-subrow-fields { margin: 8px 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px 16px; }
.csr-subrow-field { display: flex; flex-direction: column; font-size: 12px; }
.csr-subrow-field dt { color: var(--ds-text-secondary, #64748b); text-transform: capitalize; }
.csr-subrow-field dd { margin: 0; font-weight: 600; word-break: break-word; }
.csr-radios { display: flex; gap: 16px; margin-bottom: 12px; }
.csr-radio { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.csr-error { color: #dc2626; font-size: 12px; margin: 4px 0 10px; }
`;
