/**
 * Progress milestone and achievement notification templates.
 */

import { EmailWrapper } from "../../components/email/EmailWrapper";
import {
  Heading,
  Paragraph,
  Button,
  Card,
  Link,
  ProgressBar,
  Divider,
} from "../../components/email/EmailComponents";

interface MilestoneAchievedProps {
  learnerName: string;
  milestoneType:
    | "first-chapter-complete"
    | "all-chapters-complete"
    | "first-assignment"
    | "halfway-through";
  milestoneTitle: string;
  milestoneDescription: string;
  nextStepLink: string;
  appUrl: string;
}

export function MilestoneAchieved({
  learnerName,
  milestoneType,
  milestoneTitle,
  milestoneDescription,
  nextStepLink,
  appUrl: _appUrl,
}: MilestoneAchievedProps) {
  const icons: Record<string, string> = {
    "first-chapter-complete": "🎯",
    "all-chapters-complete": "🏆",
    "first-assignment": "✨",
    "halfway-through": "⚡",
  };

  const icon = icons[milestoneType];

  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        {icon} {milestoneTitle}
      </Heading>

      <Paragraph>
        Congratulations, {learnerName}!
      </Paragraph>

      <Paragraph>
        {milestoneDescription}
      </Paragraph>

      <Card backgroundColor="#ecfdf5" borderColor="#a7f3d0" padding="16px">
        <Heading level={3} color="#065f46" margin="0 0 8px 0">
          You're Making Real Progress
        </Heading>
        <Paragraph color="#065f46" margin="0" fontSize="13px">
          Each step forward brings you closer to transforming your business.
        </Paragraph>
      </Card>

      <Button href={nextStepLink} backgroundColor="#10b981" textColor="#ffffff">
        Continue Your Journey
      </Button>

      <Divider />

      <Paragraph fontSize="12px" color="#6b7280">
        Questions? Reply to this email or contact your assigned coach.
      </Paragraph>
    </EmailWrapper>
  );
}

interface JourneyProgressProps {
  learnerName: string;
  currentChapter: number;
  totalChapters: number;
  completedChapters: number;
  currentFocus: string;
  dashboardLink: string;
  appUrl: string;
}

export function JourneyProgress({
  learnerName,
  currentChapter,
  totalChapters,
  completedChapters,
  currentFocus,
  dashboardLink,
  appUrl: _appUrl,
}: JourneyProgressProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Your Programme Progress
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        Here's an update on where you are in your ONEVYRT journey:
      </Paragraph>

      <ProgressBar
        current={completedChapters}
        total={totalChapters}
        label="Overall Progress"
        color="#6366f1"
      />

      <Card backgroundColor="#f9fafb" borderColor="#e5e7eb" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 12px 0">
          You're Working On
        </Heading>

        {currentChapter <= totalChapters ? (
          <>
            <Paragraph margin="0 0 4px 0" fontSize="13px">
              <strong>Chapter {currentChapter}</strong>
            </Paragraph>
            <Paragraph margin="0" fontSize="13px" color="#6b7280">
              {currentFocus}
            </Paragraph>
          </>
        ) : (
          <Paragraph margin="0" fontSize="13px" color="#065f46">
            <strong>✓ All chapters completed!</strong> Ready for your Transformation Report.
          </Paragraph>
        )}
      </Card>

      <Button href={dashboardLink} backgroundColor="#6366f1" textColor="#ffffff">
        View Full Dashboard
      </Button>

      <Divider />

      <Heading level={3} color="#1f2937">
        What's Next?
      </Heading>

      <Paragraph fontSize="13px" color="#4b5563">
        {completedChapters === totalChapters
          ? "You've completed all chapters! We're compiling your Transformation Report and 90-Day Plan."
          : `You have ${totalChapters - completedChapters} chapter${totalChapters - completedChapters !== 1 ? "s" : ""} remaining.`}
      </Paragraph>

      <Paragraph fontSize="12px" color="#6b7280">
        Keep up the momentum! Your coach is following your progress.
      </Paragraph>
    </EmailWrapper>
  );
}

interface GrowthPlanUpdateProps {
  learnerName: string;
  coachName: string;
  bottleneckIdentified: string;
  improvementAreas: string[];
  timelineMonths: number;
  viewPlanLink: string;
  appUrl: string;
}

export function GrowthPlanUpdate({
  learnerName,
  coachName,
  bottleneckIdentified,
  improvementAreas,
  timelineMonths,
  viewPlanLink,
  appUrl: _appUrl,
}: GrowthPlanUpdateProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Your Growth Plan is Ready
      </Heading>

      <Paragraph>
        Excellent work, {learnerName}!
      </Paragraph>

      <Paragraph>
        {coachName} has reviewed your chapter submissions and created your personalized Growth & Improvement Plan. This is your roadmap for the next {timelineMonths} months.
      </Paragraph>

      <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 12px 0">
          Your Growth Plan Highlights
        </Heading>

        <Heading level={3} color="#6366f1" margin="0 0 6px 0">
          Bottleneck Identified
        </Heading>
        <Paragraph margin="0 0 12px 0" fontSize="13px" color="#4b5563">
          {bottleneckIdentified}
        </Paragraph>

        <Heading level={3} color="#6366f1" margin="0 0 6px 0">
          Improvement Areas
        </Heading>
        {improvementAreas.map((area, index) => (
          <Paragraph
            key={index}
            margin={index === improvementAreas.length - 1 ? "0" : "0 0 6px 0"}
            fontSize="13px"
            color="#4b5563"
          >
            • {area}
          </Paragraph>
        ))}
      </Card>

      <Button href={viewPlanLink} backgroundColor="#6366f1" textColor="#ffffff">
        View Your Growth Plan
      </Button>

      <Divider />

      <Heading level={3} color="#1f2937">
        What Happens Next?
      </Heading>

      <Paragraph>
        Your Growth Plan includes:
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
        <li>Current business position assessment</li>
        <li>Your key bottleneck and why it matters</li>
        <li>Specific improvement actions</li>
        <li>Expected impact and timeline</li>
        <li>Your next 90-day priorities</li>
      </ul>

      <Paragraph fontSize="12px" color="#6b7280">
        Review it with your coach and start implementing the actions. Remember, small consistent improvements compound into transformational results.
      </Paragraph>
    </EmailWrapper>
  );
}

interface TransformationReportReadyProps {
  learnerName: string;
  reportLink: string;
  shareLink: string;
  downloadPdfLink: string;
  appUrl: string;
}

export function TransformationReportReady({
  learnerName,
  reportLink,
  shareLink,
  downloadPdfLink,
  appUrl: _appUrl,
}: TransformationReportReadyProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Your Transformation Report is Ready! 🎉
      </Heading>

      <Paragraph>
        Hi {learnerName},
      </Paragraph>

      <Paragraph>
        Congratulations! Your complete ONEVYRT journey has been compiled into your Transformation Report.
      </Paragraph>

      <Paragraph>
        This report shows:
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
        <li>Where you started (baseline)</li>
        <li>What you defined (strategy)</li>
        <li>What you built (systems)</li>
        <li>What you can measure (metrics)</li>
        <li>What you'll improve (growth plan)</li>
        <li>Your next 90 days (roadmap)</li>
      </ul>

      <Card backgroundColor="#ecfdf5" borderColor="#a7f3d0" padding="16px">
        <Heading level={3} color="#065f46" margin="0 0 8px 0">
          A Permanent Record of Your Growth
        </Heading>
        <Paragraph color="#065f46" margin="0" fontSize="13px">
          This report documents your transformation and serves as your blueprint for continued growth.
        </Paragraph>
      </Card>

      <Heading level={3} color="#1f2937">
        What You Can Do Now
      </Heading>

      <Button href={reportLink} backgroundColor="#6366f1" textColor="#ffffff">
        View Full Report
      </Button>

      <Paragraph fontSize="12px" color="#6b7280">
        <Link href={downloadPdfLink}>Download as PDF</Link> • <Link href={shareLink}>Get shareable link</Link>
      </Paragraph>

      <Divider />

      <Paragraph>
        Share your report with:
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
        <li>Your business partners or investors</li>
        <li>Your team for alignment and motivation</li>
        <li>Your mentor or advisor for feedback</li>
      </ul>

      <Paragraph fontSize="12px" color="#6b7280">
        You've done incredible work. Keep this momentum going with your 90-day plan, and you'll continue to see transformational results.
      </Paragraph>
    </EmailWrapper>
  );
}
