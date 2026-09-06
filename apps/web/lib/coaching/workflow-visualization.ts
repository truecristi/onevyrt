/**
 * Workflow Visualization Utilities — Calculation helpers for coaching dashboards.
 *
 * Provides data structures and computation helpers for rendering approval workflows,
 * learner progress funnels, and cohort progress visualizations.
 */

/**
 * Approval stage in the review workflow.
 */
export type ApprovalStage = "submitted" | "reviewing" | "approved" | "rejected" | "resubmitted";

/**
 * Color mapping for approval stages.
 */
export const APPROVAL_STAGE_COLORS: Record<ApprovalStage, string> = {
  submitted: "#2563eb", // Blue
  reviewing: "#d97706", // Amber
  approved: "#16a34a", // Green
  rejected: "#dc2626", // Red
  resubmitted: "#0891b2", // Cyan
};

/**
 * Learner progress stage in the funnel.
 */
export type ProgressStage = "started" | "in-progress" | "completed" | "awaiting-review" | "approved" | "rejected";

/**
 * Color mapping for progress stages (red to green gradient).
 */
export const PROGRESS_STAGE_COLORS: Record<ProgressStage, string> = {
  started: "#94a3b8", // Gray
  "in-progress": "#f59e0b", // Amber
  completed: "#3b82f6", // Blue
  "awaiting-review": "#d97706", // Orange
  approved: "#16a34a", // Green
  rejected: "#dc2626", // Red
};

/**
 * Learner status in cohort.
 */
export type LearnerCohortStatus = "on-track" | "at-risk" | "completed" | "inactive";

export const COHORT_STATUS_COLORS: Record<LearnerCohortStatus, string> = {
  "on-track": "#16a34a", // Green
  "at-risk": "#dc2626", // Red
  completed: "#0891b2", // Cyan
  inactive: "#94a3b8", // Gray
};

/**
 * Chapter gate status.
 */
export type ChapterGateStatus = "locked" | "available" | "in-progress" | "awaiting-review" | "approved" | "completed";

export const CHAPTER_GATE_COLORS: Record<ChapterGateStatus, string> = {
  locked: "#94a3b8", // Gray
  available: "#2563eb", // Blue
  "in-progress": "#f59e0b", // Amber
  "awaiting-review": "#d97706", // Orange
  approved: "#16a34a", // Green
  completed: "#0891b2", // Cyan
};

/**
 * Represents a single submission in the approval workflow.
 */
export interface SubmissionWorkflowEvent {
  id: string;
  stage: ApprovalStage;
  timestamp: Date;
  feedback?: string;
  reviewer?: string;
}

/**
 * Represents an approval workflow timeline for a single submission.
 */
export interface ApprovalWorkflow {
  submissionId: string;
  learnerName: string;
  chapter: number;
  events: SubmissionWorkflowEvent[];
  currentStage: ApprovalStage;
  isReviewable: boolean;
  estimatedCompletionDate?: Date;
}

/**
 * Represents learner count at each progress stage.
 */
export interface ProgressStageCounts {
  started: number;
  "in-progress": number;
  completed: number;
  "awaiting-review": number;
  approved: number;
  rejected: number;
}

/**
 * Represents conversion rates between progress stages.
 */
export interface ProgressConversionRates {
  startedToInProgress: number;
  inProgressToCompleted: number;
  completedToAwaitingReview: number;
  awaitingReviewToApproved: number;
  awaitingReviewToRejected: number;
}

/**
 * Represents overall learner progress funnel data.
 */
export interface LearnerProgressFunnel {
  totalLearners: number;
  stageCounts: ProgressStageCounts;
  conversionRates: ProgressConversionRates;
  dropoffStage: ProgressStage | null; // Stage where most learners are stuck
  dropoffPercentage: number;
}

/**
 * Represents a learner's status in a cohort.
 */
export interface CohortLearnerStatus {
  learnerId: string;
  learnerName: string;
  email: string;
  status: LearnerCohortStatus;
  currentChapter: number;
  completedChapters: number;
  daysInCurrentChapter: number;
  lastActivityDate: Date | null;
  isAtRisk: boolean;
  pendingReviewSubmissions: number;
}

/**
 * Represents cohort-wide progress data.
 */
export interface CohortProgressData {
  cohortId: string;
  coachName: string;
  totalLearners: number;
  learnerStatuses: CohortLearnerStatus[];
  onTrackCount: number;
  atRiskCount: number;
  completedCount: number;
  inactiveCount: number;
  averageChapterCompletion: number;
  onTimeCompletionRate: number; // Percentage
  atRiskPercentage: number;
  chapterDistribution: Record<number, number>; // Chapter -> count
}

/**
 * Represents lesson completion requirements.
 */
export interface LessonRequirement {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  isRequired: boolean;
  icon?: string;
}

/**
 * Represents lesson completion status.
 */
export interface LessonCompletionStatus {
  lessonId: string;
  lessonTitle: string;
  requirements: LessonRequirement[];
  completionPercentage: number;
  isReadyForSubmission: boolean;
  missingRequirements: string[];
}

/**
 * Represents a chapter's full gate summary (distinct from `ChapterGateStatus`,
 * the status enum above — this is the richer per-chapter record that embeds it).
 */
export interface ChapterGateInfo {
  chapterNumber: number;
  chapterTitle: string;
  status: ChapterGateStatus;
  approvedDate?: Date;
  submittedDate?: Date;
  feedbackCount: number;
  nextMilestone?: string;
  estimatedCompletionDate?: Date;
}

/**
 * Represents feedback quality metrics.
 */
export interface FeedbackQualityMetrics {
  coachId: string;
  coachName: string;
  clarity: number; // 1-10
  helpfulness: number; // 1-10
  actionability: number; // 1-10
  timeliness: number; // 1-10
  averageScore: number;
  learnerSatisfaction?: number; // If available
  comparisonToBenchmark: number; // -5 to +5
  improvementSuggestions: string[];
  totalFeedbackGiven: number;
}

/**
 * Calculate conversion rates for learner progress funnel.
 */
export function calculateConversionRates(
  stageCounts: ProgressStageCounts
): ProgressConversionRates {
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return {
      startedToInProgress: 0,
      inProgressToCompleted: 0,
      completedToAwaitingReview: 0,
      awaitingReviewToApproved: 0,
      awaitingReviewToRejected: 0,
    };
  }

  return {
    startedToInProgress:
      stageCounts.started > 0
        ? (stageCounts["in-progress"] / stageCounts.started) * 100
        : 0,
    inProgressToCompleted:
      stageCounts["in-progress"] > 0
        ? (stageCounts.completed / stageCounts["in-progress"]) * 100
        : 0,
    completedToAwaitingReview:
      stageCounts.completed > 0
        ? (stageCounts["awaiting-review"] / stageCounts.completed) * 100
        : 0,
    awaitingReviewToApproved:
      stageCounts["awaiting-review"] > 0
        ? (stageCounts.approved / stageCounts["awaiting-review"]) * 100
        : 0,
    awaitingReviewToRejected:
      stageCounts["awaiting-review"] > 0
        ? (stageCounts.rejected / stageCounts["awaiting-review"]) * 100
        : 0,
  };
}

/**
 * Identify the stage where most learners are stuck (bottleneck).
 */
export function identifyDropoffStage(
  stageCounts: ProgressStageCounts
): ProgressStage | null {
  const stages: ProgressStage[] = [
    "started",
    "in-progress",
    "completed",
    "awaiting-review",
    "approved",
  ];

  let maxDropoff = 0;
  let bottleneckStage: ProgressStage | null = null;

  for (let i = 0; i < stages.length - 1; i++) {
    const currentCount = stageCounts[stages[i]!];
    const nextCount = stageCounts[stages[i + 1]!];
    const dropoff = currentCount - nextCount;

    if (dropoff > maxDropoff) {
      maxDropoff = dropoff;
      bottleneckStage = stages[i]!;
    }
  }

  return bottleneckStage;
}

/**
 * Format a date for display in workflows.
 */
export function formatWorkflowDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format a relative time (e.g., "2 days ago").
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatWorkflowDate(date);
}

/**
 * Calculate days in current chapter.
 */
export function calculateDaysInChapter(startDate: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determine if a learner is at risk based on activity.
 */
export function isLearnerAtRisk(
  lastActivityDate: Date | null,
  currentChapterDays: number
): boolean {
  if (!lastActivityDate) return false;
  const daysSinceActivity = calculateDaysInChapter(lastActivityDate);
  return daysSinceActivity > 14 || (currentChapterDays > 21 && daysSinceActivity > 7);
}

/**
 * Assess chapter gate status based on submission state.
 */
export function assessChapterGateStatus(
  isSubmitted: boolean,
  isApproved: boolean,
  isRejected: boolean
): ChapterGateStatus {
  if (isApproved) return "approved";
  if (isRejected) return "in-progress"; // Can resubmit
  if (isSubmitted) return "awaiting-review";
  return "available";
}
