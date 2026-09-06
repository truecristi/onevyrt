/**
 * Coach-related email templates: messages, digests, and learner reminders.
 */

import { EmailWrapper } from "../../components/email/EmailWrapper";
import {
  Heading,
  Paragraph,
  Button,
  Card,
  Divider,
} from "../../components/email/EmailComponents";

interface CoachMessageNotificationProps {
  learnerName: string;
  coachName: string;
  subject: string;
  messagePreview: string;
  viewLink: string;
  appUrl: string;
}

export function CoachMessageNotification({
  learnerName,
  coachName,
  subject,
  messagePreview,
  viewLink,
}: CoachMessageNotificationProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Message from {coachName}
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        {coachName} has sent you a message:
      </Paragraph>

      <Card backgroundColor="#f9fafb" borderColor="#e5e7eb" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 8px 0">
          {subject}
        </Heading>
        <Paragraph margin="0" fontSize="13px" color="#4b5563">
          {messagePreview}
        </Paragraph>
        {messagePreview.length > 150 && (
          <Paragraph margin="8px 0 0 0" fontSize="12px" color="#6b7280">
            ...
          </Paragraph>
        )}
      </Card>

      <Button href={viewLink} backgroundColor="#6366f1" textColor="#ffffff">
        Read Full Message
      </Button>

      <Paragraph fontSize="12px" color="#6b7280">
        Reply directly in your ONEVYRT inbox to continue the conversation.
      </Paragraph>
    </EmailWrapper>
  );
}

interface WeeklyCoachDigestProps {
  coachName: string;
  weekNumber: number;
  quietLearners: Array<{ name: string; chapterStatus: string; daysQuiet: number }>;
  pendingReviews: number;
  recentlyCompleted: number;
  coachPortalLink: string;
  appUrl: string;
}

export function WeeklyCoachDigest({
  coachName,
  weekNumber,
  quietLearners,
  pendingReviews,
  recentlyCompleted,
  coachPortalLink,
}: WeeklyCoachDigestProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Weekly Coaching Digest — Week {weekNumber}
      </Heading>

      <Paragraph>
        Hi {coachName},
      </Paragraph>

      <Paragraph>
        Here's what's happening with your cohort this week:
      </Paragraph>

      <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 12px 0">
          Cohort Summary
        </Heading>

        <div style={{ marginBottom: "12px" }}>
          <Paragraph margin="0 0 4px 0" fontSize="13px">
            <strong>Pending Reviews:</strong> {pendingReviews} submission{pendingReviews !== 1 ? "s" : ""}
          </Paragraph>
          <Paragraph margin="0" fontSize="13px">
            <strong>Recently Completed:</strong> {recentlyCompleted} chapter{recentlyCompleted !== 1 ? "s" : ""}
          </Paragraph>
        </div>
      </Card>

      {quietLearners.length > 0 && (
        <>
          <Heading level={3} color="#1f2937">
            Quiet Learners ({quietLearners.length})
          </Heading>

          <Paragraph fontSize="13px" color="#6b7280">
            These learners haven't engaged recently — consider reaching out:
          </Paragraph>

          {quietLearners.map((learner, index) => (
            <Card
              key={index}
              backgroundColor="#fef3c7"
              borderColor="#fcd34d"
              padding="12px"
            >
              <Paragraph margin="0 0 4px 0" fontSize="13px">
                <strong>{learner.name}</strong>
              </Paragraph>
              <Paragraph margin="0" fontSize="12px" color="#6b7280">
                {learner.chapterStatus} • Quiet for {learner.daysQuiet} days
              </Paragraph>
            </Card>
          ))}
        </>
      )}

      <Divider />

      <Heading level={3} color="#1f2937">
        Quick Actions
      </Heading>

      <Button href={coachPortalLink} backgroundColor="#6366f1" textColor="#ffffff">
        Go to Coach Portal
      </Button>

      <Paragraph fontSize="12px" color="#6b7280">
        Use the Coach Portal to review submissions, send messages, and manage your cohort.
      </Paragraph>
    </EmailWrapper>
  );
}

interface CohortSessionReminderProps {
  learnerName: string;
  coachName: string;
  sessionDate: string;
  sessionTime: string;
  sessionTopic: string;
  joinLink: string;
  appUrl: string;
  hoursUntilSession: number;
}

export function CohortSessionReminder({
  learnerName,
  coachName,
  sessionDate,
  sessionTime,
  sessionTopic,
  joinLink,
  hoursUntilSession,
}: CohortSessionReminderProps) {
  const timeUntil =
    hoursUntilSession < 2
      ? "in less than 2 hours"
      : hoursUntilSession < 24
        ? `in ${hoursUntilSession} hours`
        : "coming up";

  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Cohort Session Reminder
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        Your cohort session with {coachName} is {timeUntil}!
      </Paragraph>

      <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 12px 0">
          Session Details
        </Heading>

        <Paragraph margin="0 0 8px 0" fontSize="13px">
          <strong>Date:</strong> {sessionDate}
        </Paragraph>
        <Paragraph margin="0 0 8px 0" fontSize="13px">
          <strong>Time:</strong> {sessionTime}
        </Paragraph>
        <Paragraph margin="0" fontSize="13px">
          <strong>Topic:</strong> {sessionTopic}
        </Paragraph>
      </Card>

      <Button href={joinLink} backgroundColor="#6366f1" textColor="#ffffff">
        Join Session
      </Button>

      <Paragraph fontSize="12px" color="#6b7280">
        Make sure to join a few minutes early. Have your notes ready!
      </Paragraph>
    </EmailWrapper>
  );
}

interface CoachingReminderProps {
  learnerName: string;
  reminderType: "stalled" | "incomplete" | "upcoming-deadline";
  chapterNumber?: number;
  chapterName?: string;
  actionUrl: string;
  appUrl: string;
}

export function CoachingReminder({
  learnerName,
  reminderType,
  chapterNumber,
  chapterName,
  actionUrl,
}: CoachingReminderProps) {
  const reminders = {
    stalled: {
      title: "Let's Keep Momentum Going",
      message: `You've been quiet on Chapter ${chapterNumber}: ${chapterName}. We'd love to hear how things are progressing!`,
      buttonText: "Continue Chapter",
    },
    incomplete: {
      title: "Almost There!",
      message: `You're close to finishing Chapter ${chapterNumber}: ${chapterName}. A few more assignments to complete.`,
      buttonText: "Continue Learning",
    },
    "upcoming-deadline": {
      title: "Upcoming Deadline",
      message: `Your Chapter ${chapterNumber}: ${chapterName} submission is due soon. Don't lose momentum!`,
      buttonText: "Submit Chapter",
    },
  };

  const reminder = reminders[reminderType];

  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        {reminder.title}
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        {reminder.message}
      </Paragraph>

      <Button href={actionUrl} backgroundColor="#6366f1" textColor="#ffffff">
        {reminder.buttonText}
      </Button>

      <Divider />

      <Paragraph fontSize="12px" color="#6b7280">
        Stuck? Your coach is here to help. Reply to this email or visit your ONEVYRT dashboard.
      </Paragraph>
    </EmailWrapper>
  );
}
