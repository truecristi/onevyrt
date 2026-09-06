/**
 * Chapter submission and approval notification templates.
 * Sent to learners and coaches for chapter progress updates.
 */

import { EmailWrapper } from "../../components/email/EmailWrapper";
import {
  Heading,
  Paragraph,
  Button,
  Card,
  ChapterStatus,
  Divider,
} from "../../components/email/EmailComponents";

interface ChapterSubmissionNotificationProps {
  learnerName: string;
  chapterNumber: number;
  chapterName: string;
  submissionDate: string;
  viewLink: string;
  appUrl: string;
}

export function ChapterSubmissionNotification({
  learnerName,
  chapterNumber,
  chapterName,
  submissionDate,
  viewLink,
  appUrl: _appUrl,
}: ChapterSubmissionNotificationProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        New Chapter Submission
      </Heading>

      <Paragraph>
        {learnerName} has submitted Chapter {chapterNumber}: {chapterName} for review.
      </Paragraph>

      <ChapterStatus
        chapterNumber={chapterNumber}
        chapterName={chapterName}
        status="pending"
        learnerName={learnerName}
      />

      <Paragraph fontSize="13px" color="#6b7280">
        Submitted on {submissionDate}
      </Paragraph>

      <Button href={viewLink} backgroundColor="#6366f1" textColor="#ffffff">
        Review Submission
      </Button>

      <Divider />

      <Heading level={3} color="#1f2937">
        What's Included?
      </Heading>

      <Paragraph fontSize="13px" color="#4b5563">
        The submission includes:
      </Paragraph>

      <ul
        style={{
          margin: "12px 0",
          paddingLeft: "20px",
          color: "#4b5563",
          fontSize: "13px",
          lineHeight: "1.8",
        }}
      >
        <li>Completed chapter worksheets and assignments</li>
        <li>Personal reflection on learnings</li>
        <li>Implementation progress notes</li>
      </ul>

      <Paragraph fontSize="12px" color="#6b7280">
        Please review and provide feedback within 48 hours to keep momentum.
      </Paragraph>
    </EmailWrapper>
  );
}

interface ChapterApprovedNotificationProps {
  learnerName: string;
  coachName: string;
  chapterNumber: number;
  chapterName: string;
  nextChapterNumber?: number;
  nextChapterName?: string;
  feedbackHighlights?: string[];
  continueLink: string;
  appUrl: string;
}

export function ChapterApprovedNotification({
  learnerName,
  coachName,
  chapterNumber,
  chapterName,
  nextChapterNumber,
  nextChapterName,
  feedbackHighlights = [],
  continueLink,
  appUrl: _appUrl,
}: ChapterApprovedNotificationProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        ✓ Chapter Approved!
      </Heading>

      <Paragraph>
        Great work, {learnerName}! Your submission for Chapter {chapterNumber}: {chapterName} has been approved by {coachName}.
      </Paragraph>

      <ChapterStatus
        chapterNumber={chapterNumber}
        chapterName={chapterName}
        status="approved"
        learnerName={learnerName}
      />

      {feedbackHighlights.length > 0 && (
        <>
          <Heading level={3} color="#1f2937">
            Coach Feedback
          </Heading>

          <Card backgroundColor="#f9fafb" borderColor="#e5e7eb" padding="16px">
            {feedbackHighlights.map((highlight, index) => (
              <Paragraph
                key={index}
                margin={index === feedbackHighlights.length - 1 ? "0" : "0 0 12px 0"}
                fontSize="13px"
              >
                <strong>•</strong> {highlight}
              </Paragraph>
            ))}
          </Card>
        </>
      )}

      {nextChapterNumber && nextChapterName ? (
        <>
          <Divider />

          <Heading level={3} color="#1f2937">
            Ready for the Next Chapter?
          </Heading>

          <Paragraph>
            You're now ready to start Chapter {nextChapterNumber}: {nextChapterName}.
          </Paragraph>

          <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
            <Heading level={3} color="#1f2937" margin="0 0 8px 0">
              Chapter {nextChapterNumber}: {nextChapterName}
            </Heading>
            <Paragraph margin="0" fontSize="13px">
              Build on your foundation and take the next step toward growth.
            </Paragraph>
          </Card>

          <Button href={continueLink} backgroundColor="#6366f1" textColor="#ffffff">
            Start Chapter {nextChapterNumber}
          </Button>
        </>
      ) : (
        <>
          <Divider />

          <Paragraph>
            <strong>You've completed all chapters!</strong> Let's finalize your journey.
          </Paragraph>

          <Button href={continueLink} backgroundColor="#10b981" textColor="#ffffff">
            View Transformation Report
          </Button>
        </>
      )}

      <Paragraph fontSize="12px" color="#6b7280">
        Questions about the feedback? Reply to this email or reach out to {coachName} directly.
      </Paragraph>
    </EmailWrapper>
  );
}

interface ChapterRevisionRequestedNotificationProps {
  learnerName: string;
  coachName: string;
  chapterNumber: number;
  chapterName: string;
  revisionReason: string;
  revisionDeadline?: string;
  reviseLink: string;
  appUrl: string;
}

export function ChapterRevisionRequestedNotification({
  learnerName,
  coachName,
  chapterNumber,
  chapterName,
  revisionReason,
  revisionDeadline,
  reviseLink,
  appUrl: _appUrl,
}: ChapterRevisionRequestedNotificationProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Revision Requested
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        {coachName} has reviewed your Chapter {chapterNumber}: {chapterName} submission and has a few suggestions.
      </Paragraph>

      <ChapterStatus
        chapterNumber={chapterNumber}
        chapterName={chapterName}
        status="rejected"
        learnerName={learnerName}
      />

      <Card backgroundColor="#fef3c7" borderColor="#fcd34d" padding="16px">
        <Heading level={3} color="#92400e" margin="0 0 8px 0">
          What to Focus On
        </Heading>
        <Paragraph color="#92400e" margin="0" fontSize="13px">
          {revisionReason}
        </Paragraph>
      </Card>

      {revisionDeadline && (
        <Paragraph fontSize="12px" color="#6b7280">
          Please resubmit by {revisionDeadline} to keep momentum.
        </Paragraph>
      )}

      <Button href={reviseLink} backgroundColor="#6366f1" textColor="#ffffff">
        Review & Revise
      </Button>

      <Divider />

      <Paragraph fontSize="13px" color="#4b5563">
        This is a normal part of the process — most submissions benefit from refinement. {coachName} is here to support you.
      </Paragraph>

      <Paragraph fontSize="12px" color="#6b7280">
        Have questions? Reply to this email or contact {coachName} directly.
      </Paragraph>
    </EmailWrapper>
  );
}
