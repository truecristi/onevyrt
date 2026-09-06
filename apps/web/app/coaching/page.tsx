"use client";
/**
 * /coaching — Coaching hub for both learners and coaches.
 *
 * COACHES see:
 * - Summary of pending submissions across all their workspaces
 * - List of clients/learners with progress status
 * - Quick actions to review submissions or message clients
 *
 * LEARNERS see:
 * - Their assigned coach (if any)
 * - Latest feedback/messages
 * - Enrolled cohorts and next session
 * - Progress summary and next lesson
 * - Link to their submissions
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { Notice } from "../../components/ui/Notice";
import { SkeletonStats } from "../../components/Skeleton";
import { STATUS_COLORS } from "../../lib/colors/chapter-tokens";
import { ClientProgressCard } from "../../components/coaching/ClientProgressCard";

interface CoachClient {
  workspaceId: string;
  workspaceName: string;
  summary: {
    totalLessons: number;
    completedLessons: number;
    percentComplete: number;
    currentLessonId: string | null;
    awaitingReview: Array<{ lessonId: string; submission: { submittedAt: string } }>;
    changesRequested: string[];
  };
  currentLessonTitle: string;
  snapshot: { overdueCount: number; readinessBaseline?: number };
  lastActivityAt: string | null;
  chaptersAwaitingReview: Array<{ stageId: string; stageTitle: string; order: number }>;
}

interface CoachDashboard {
  clients: CoachClient[];
}

interface LearnerData {
  enrollment: {
    coachUserId?: string;
    cohortId?: string;
  };
  summary: {
    currentLessonId: string | null;
    awaitingReview: Array<{ lessonId: string; submission: { submittedAt: string; coachFeedback?: string } }>;
  };
  nextAction: { currentLessonId: string; currentLessonTitle: string };
  cohorts: Array<{ id: string; name: string; coachEmail: string; sessions: Array<{ title: string; date: string }> }>;
  snapshot: { readinessScore: number };
  hasCoach: boolean;
}

type ViewState = "loading" | "coach" | "learner" | "not-authenticated" | "error";

export default function CoachingPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [coach, setCoach] = useState<CoachDashboard | null>(null);
  const [learner, setLearner] = useState<LearnerData | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setErrorMsg("");
    try {
      // Try to load both coach and learner data to determine role
      const [coachRes, learnerRes] = await Promise.all([
        fetch("/api/programme/coach-workspaces", { credentials: "include" }),
        fetch("/api/programme/enrollment", { credentials: "include" }),
      ]);

      if (coachRes.status === 401 || learnerRes.status === 401) {
        setState("not-authenticated");
        return;
      }

      const coachData = coachRes.ok ? await coachRes.json() : null;
      const learnerData = learnerRes.ok ? await learnerRes.json() : null;

      // Determine role: coach if they have clients, otherwise learner
      if (coachData?.clients && coachData.clients.length > 0) {
        setCoach(coachData);
        setState("coach");
      } else if (learnerData?.enrollment) {
        setLearner(learnerData);
        setState("learner");
      } else {
        setState("learner");
        setLearner(learnerData);
      }
    } catch (err) {
      setErrorMsg("Network error — is the app reachable?");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "not-authenticated") {
    return (
      <PageShell eyebrow="Coaching" title="Coaching Hub" subtitle="Sign in to view your coaching information.">
        <Notice icon="lock" title="Sign in required" body="Please sign in to access the coaching hub." />
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell eyebrow="Coaching" title="Coaching Hub" subtitle="There was an error loading your coaching data.">
        <Notice icon="warning" title="Couldn't load data" body={errorMsg} onRetry={() => void load()} />
      </PageShell>
    );
  }

  if (state === "loading") {
    return (
      <PageShell eyebrow="Coaching" title="Coaching Hub" subtitle="Loading...">
        <SkeletonStats />
      </PageShell>
    );
  }

  // COACH VIEW
  if (state === "coach" && coach) {
    const pendingCount = coach.clients.reduce((sum, c) => sum + c.chaptersAwaitingReview.length, 0);
    const atRiskCount = coach.clients.filter((c) => c.snapshot.overdueCount > 0).length;
    const onTrackCount = coach.clients.filter((c) => c.snapshot.overdueCount === 0 && c.summary.percentComplete < 100).length;

    return (
      <PageShell
        eyebrow="Coaching"
        title="Coach Dashboard"
        subtitle={`Managing ${coach.clients.length} learner${coach.clients.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/coaching/submissions/pending" className="ds-btn ds-btn--primary ds-btn--sm">
            View all submissions →
          </Link>
        }
      >
        {/* Summary Cards */}
        <div className="coaching-summary-grid">
          <div
            className="coaching-summary-card"
            style={{ borderLeftColor: STATUS_COLORS.awaiting }}
          >
            <div className="coaching-summary-label">Awaiting Review</div>
            <div className="coaching-summary-value">{pendingCount}</div>
            <Link href="/coaching/submissions/pending" className="coaching-summary-link">
              View submissions →
            </Link>
          </div>

          <div
            className="coaching-summary-card"
            style={{ borderLeftColor: "#dc2626" }}
          >
            <div className="coaching-summary-label">At Risk</div>
            <div className="coaching-summary-value">{atRiskCount}</div>
            <div className="coaching-summary-link ds-help">{atRiskCount} learner{atRiskCount === 1 ? "" : "s"} have overdue work</div>
          </div>

          <div
            className="coaching-summary-card"
            style={{ borderLeftColor: STATUS_COLORS.approved }}
          >
            <div className="coaching-summary-label">On Track</div>
            <div className="coaching-summary-value">{onTrackCount}</div>
            <div className="coaching-summary-link ds-help">{onTrackCount} learner{onTrackCount === 1 ? "" : "s"} progressing well</div>
          </div>

          <div
            className="coaching-summary-card"
            style={{ borderLeftColor: STATUS_COLORS.complete }}
          >
            <div className="coaching-summary-label">Total Learners</div>
            <div className="coaching-summary-value">{coach.clients.length}</div>
            <div className="coaching-summary-link ds-help">Across all workspaces</div>
          </div>
        </div>

        {/* Learners List */}
        <div className="coaching-section">
          <h2 className="coaching-section-title">Your Learners</h2>
          {coach.clients.length === 0 ? (
            <Notice icon="inbox" title="No learners yet" body="You haven't coached any learners yet. Invite people to your workspaces to get started." />
          ) : (
            <ul className="coaching-learners-list">
              {coach.clients.map((client) => (
                <li key={client.workspaceId}>
                  <Card className="coaching-learner-card">
                    <div className="coaching-learner-info">
                      <ClientProgressCard
                        workspaceName={client.workspaceName}
                        percentComplete={client.summary.percentComplete}
                        completedLessons={client.summary.completedLessons}
                        totalLessons={client.summary.totalLessons}
                        awaitingReviewCount={client.chaptersAwaitingReview.length}
                        changesRequestedCount={client.summary.changesRequested.length}
                        overdueCount={client.snapshot.overdueCount}
                      />
                    </div>
                    <div className="coaching-learner-actions">
                      <Link
                        href={`/studio?ws=${encodeURIComponent(client.workspaceId)}&panel=programme`}
                        className="ds-btn ds-btn--secondary ds-btn--xs"
                      >
                        Review
                      </Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <style>{`
          .coaching-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 14px;
            margin-bottom: 28px;
          }
          .coaching-summary-card {
            border-left: 4px solid var(--ds-border);
            padding: 16px;
            background: var(--ds-surface-secondary);
            border-radius: 8px;
          }
          .coaching-summary-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--ds-text-secondary);
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }
          .coaching-summary-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--ds-text-primary);
            margin-bottom: 8px;
          }
          .coaching-summary-link {
            display: inline-block;
            font-size: 12px;
            color: var(--ds-link);
            text-decoration: none;
            cursor: pointer;
          }
          .coaching-summary-link:hover {
            text-decoration: underline;
          }
          .coaching-section {
            margin-top: 32px;
          }
          .coaching-section-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--ds-text-primary);
            margin-bottom: 14px;
          }
          .coaching-learners-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .coaching-learner-card {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 14px 16px;
            justify-content: space-between;
          }
          .coaching-learner-info {
            flex: 1;
            min-width: 0;
          }
          .coaching-learner-name {
            font-weight: 700;
            font-size: 14px;
            color: var(--ds-text-primary);
            margin-bottom: 8px;
          }
          .coaching-learner-progress {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }
          .coaching-progress-bar {
            flex: 1;
            height: 4px;
            background: var(--ds-border);
            border-radius: 2px;
            min-width: 100px;
            overflow: hidden;
          }
          .coaching-progress-fill {
            height: 100%;
            transition: width 200ms ease;
          }
          .coaching-learner-meta {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
          }
          .coaching-learner-actions {
            display: flex;
            gap: 8px;
            align-items: center;
          }
        `}</style>
      </PageShell>
    );
  }

  // LEARNER VIEW
  if (state === "learner" && learner) {
    const { summary, nextAction, cohorts, hasCoach } = learner;

    return (
      <PageShell
        eyebrow="Coaching"
        title="Your Coaching"
        subtitle={hasCoach ? "You're enrolled in a coaching programme" : "You're learning at your own pace"}
      >
        {/* Coaching Status */}
        {hasCoach ? (
          <div className="learner-coaching-card">
            <Card className="learner-status-card">
              <div className="learner-status-icon">
                <span role="img" aria-label="Coach">👨‍🏫</span>
              </div>
              <div className="learner-status-content">
                <div className="learner-status-label">Coach Support</div>
                <div className="learner-status-desc">You have a coach reviewing your work and providing guidance.</div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="learner-coaching-card">
            <Card className="learner-status-card learner-status-card--solo">
              <div className="learner-status-icon">
                <span role="img" aria-label="Solo">🚀</span>
              </div>
              <div className="learner-status-content">
                <div className="learner-status-label">Self-Paced Learning</div>
                <div className="learner-status-desc">You're progressing through the programme at your own pace. No coach review required.</div>
              </div>
            </Card>
          </div>
        )}

        {/* Cohorts */}
        {cohorts.length > 0 && (
          <div className="learner-section">
            <h2 className="learner-section-title">Your Cohorts</h2>
            <ul className="learner-cohorts-list">
              {cohorts.map((cohort) => {
                const nextSession = cohort.sessions.find((s) => new Date(s.date) > new Date());
                return (
                  <li key={cohort.id}>
                    <Card className="learner-cohort-card">
                      <div className="learner-cohort-info">
                        <div className="learner-cohort-name">{cohort.name}</div>
                        <div className="learner-cohort-coach">Led by {cohort.coachEmail}</div>
                        {nextSession && (
                          <div className="learner-cohort-next">
                            <strong>Next session:</strong> {new Date(nextSession.date).toLocaleDateString()} — {nextSession.title}
                          </div>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Progress & Next Action */}
        <div className="learner-section">
          <h2 className="learner-section-title">Your Progress</h2>
          <Card className="learner-progress-card">
            <div className="learner-progress-header">
              <div>
                <div className="learner-progress-label">Current Step</div>
                <div className="learner-progress-title">{nextAction.currentLessonTitle}</div>
              </div>
              <Link href="/programme" className="ds-btn ds-btn--primary ds-btn--sm">
                Continue →
              </Link>
            </div>
          </Card>
        </div>

        {/* Submissions Status */}
        {hasCoach && summary.awaitingReview.length > 0 && (
          <div className="learner-section">
            <h2 className="learner-section-title">Your Submissions</h2>
            <div className="learner-submissions-list">
              {summary.awaitingReview.map((item, idx) => (
                <Card key={idx} className="learner-submission-card">
                  <div className="learner-submission-info">
                    <div className="learner-submission-status">Awaiting review</div>
                    {item.submission.coachFeedback && (
                      <div className="learner-submission-feedback">
                        <strong>Feedback:</strong> {item.submission.coachFeedback}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <style>{`
          .learner-coaching-card {
            margin-bottom: 28px;
          }
          .learner-status-card {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
          }
          .learner-status-card--solo {
            background: linear-gradient(135deg, var(--ds-surface-secondary) 0%, rgba(107, 172, 230, 0.05) 100%);
          }
          .learner-status-icon {
            font-size: 32px;
            min-width: 40px;
            text-align: center;
          }
          .learner-status-content {
            flex: 1;
          }
          .learner-status-label {
            font-weight: 700;
            font-size: 14px;
            color: var(--ds-text-primary);
            margin-bottom: 4px;
          }
          .learner-status-desc {
            font-size: 13px;
            color: var(--ds-text-secondary);
          }
          .learner-section {
            margin-bottom: 28px;
          }
          .learner-section-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--ds-text-primary);
            margin-bottom: 14px;
          }
          .learner-cohorts-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .learner-cohort-card {
            padding: 14px 16px;
          }
          .learner-cohort-name {
            font-weight: 700;
            font-size: 14px;
            color: var(--ds-text-primary);
            margin-bottom: 4px;
          }
          .learner-cohort-coach {
            font-size: 12px;
            color: var(--ds-text-secondary);
            margin-bottom: 8px;
          }
          .learner-cohort-next {
            font-size: 12px;
            color: var(--ds-text-primary);
          }
          .learner-progress-card {
            padding: 16px;
          }
          .learner-progress-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .learner-progress-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--ds-text-secondary);
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }
          .learner-progress-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--ds-text-primary);
          }
          .learner-submissions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .learner-submission-card {
            padding: 14px 16px;
          }
          .learner-submission-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .learner-submission-status {
            font-size: 12px;
            font-weight: 600;
            color: ${STATUS_COLORS.awaiting};
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .learner-submission-feedback {
            font-size: 13px;
            color: var(--ds-text-primary);
            padding: 8px;
            background: var(--ds-surface-secondary);
            border-radius: 4px;
            border-left: 3px solid ${STATUS_COLORS.awaiting};
          }
        `}</style>
      </PageShell>
    );
  }

  return null;
}
