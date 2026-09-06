/**
 * Email templates index.
 * Centralized export of all email template functions and utilities.
 */

// Types
export type { EmailTemplate, EmailTemplateData, EmailQueueItem, TemplateContext } from "./types";
export type { EmailCategory } from "./types";

// Renderer
export { renderTemplate, renderEmailComponent, htmlToPlainText } from "./renderer";
export type { RenderedTemplate, RendererContext } from "./renderer";

// Queue
export { queueEmail, queueEmailBatch, getPendingEmails, markEmailSent, markEmailFailed } from "./queue";
export { getQueuedEmail, listQueuedEmails, cleanupOldEmails, retryFailedEmails } from "./queue";
export type { QueueEmailInput } from "./queue";

// Templates
export { WelcomeNewUserTemplate, WelcomeNewWorkspaceTemplate } from "./welcome-template";
export {
  ChapterSubmissionNotification,
  ChapterApprovedNotification,
  ChapterRevisionRequestedNotification,
} from "./chapter-notifications-template";
export {
  CoachMessageNotification,
  WeeklyCoachDigest,
  CohortSessionReminder,
  CoachingReminder,
} from "./coaching-templates";
export {
  MilestoneAchieved,
  JourneyProgress,
  GrowthPlanUpdate,
  TransformationReportReady,
} from "./milestone-templates";
