/**
 * Welcome email templates for new users and workspaces.
 */

import { EmailWrapper } from "../../components/email/EmailWrapper";
import {
  Heading,
  Paragraph,
  Button,
  Card,
  Link,
  Divider,
} from "../../components/email/EmailComponents";

interface WelcomeNewUserTemplateProps {
  name: string;
  verificationLink: string;
  appUrl: string;
}

export function WelcomeNewUserTemplate({
  name,
  verificationLink,
  appUrl,
}: WelcomeNewUserTemplateProps) {
  const firstName = name.split(" ")[0];

  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        Welcome to ONEVYRT, {firstName}! 🚀
      </Heading>

      <Paragraph>
        We're excited to have you join our community of business owners on a mission to grow.
      </Paragraph>

      <Paragraph>
        ONEVYRT is your Growth Operating System — a structured four-stage programme that transforms
        how you think about and operate your business:
      </Paragraph>

      <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
        <Paragraph margin="0 0 8px 0" fontSize="13px">
          <strong>Chapter 1: DEFINE</strong> — Your Business Blueprint
        </Paragraph>
        <Paragraph margin="0 0 8px 0" fontSize="13px">
          <strong>Chapter 2: IMPLEMENT</strong> — Your Working System
        </Paragraph>
        <Paragraph margin="0 0 8px 0" fontSize="13px">
          <strong>Chapter 3: CONTROL</strong> — Your Numbers Dashboard
        </Paragraph>
        <Paragraph margin="0" fontSize="13px">
          <strong>Chapter 4: IMPROVE & SCALE</strong> — Your Growth Plan
        </Paragraph>
      </Card>

      <Paragraph>
        To get started, please verify your email address:
      </Paragraph>

      <Button href={verificationLink} backgroundColor="#6366f1" textColor="#ffffff">
        Verify Your Email
      </Button>

      <Paragraph fontSize="12px" color="#6b7280">
        This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
      </Paragraph>

      <Divider />

      <Heading level={3} color="#1f2937">
        What's Next?
      </Heading>

      <Paragraph>
        Once verified, you'll:
      </Paragraph>

      <ul
        style={{
          margin: "12px 0",
          paddingLeft: "20px",
          color: "#4b5563",
          fontSize: "14px",
          lineHeight: "1.8",
        }}
      >
        <li>Complete your personal & business baseline</li>
        <li>Meet your assigned coach</li>
        <li>Begin Chapter 1: DEFINE</li>
      </ul>

      <Paragraph>
        Questions? Reply to this email or visit our <Link href={`${appUrl}/help`}>Help Center</Link>.
      </Paragraph>

      <Paragraph fontSize="12px" color="#6b7280">
        Welcome aboard — let's build something great together.
      </Paragraph>
    </EmailWrapper>
  );
}

interface WelcomeNewWorkspaceTemplateProps {
  businessName: string;
  workspaceName: string;
  ownerName: string;
  inviteLink: string;
  appUrl: string;
}

export function WelcomeNewWorkspaceTemplate({
  businessName,
  workspaceName,
  ownerName,
  inviteLink,
  appUrl,
}: WelcomeNewWorkspaceTemplateProps) {
  return (
    <EmailWrapper>
      <Heading level={2} color="#1f2937">
        New Workspace Created
      </Heading>

      <Paragraph>
        Hi {ownerName},
      </Paragraph>

      <Paragraph>
        Your new workspace <strong>"{workspaceName}"</strong> for {businessName} has been set up and is ready to go.
      </Paragraph>

      <Card backgroundColor="#f0f4ff" borderColor="#e0e7ff" padding="16px">
        <Heading level={3} color="#1f2937" margin="0 0 8px 0">
          Workspace Details
        </Heading>
        <Paragraph margin="0 0 4px 0" fontSize="13px">
          <strong>Business:</strong> {businessName}
        </Paragraph>
        <Paragraph margin="0 0 4px 0" fontSize="13px">
          <strong>Workspace:</strong> {workspaceName}
        </Paragraph>
        <Paragraph margin="0" fontSize="13px">
          <strong>Status:</strong> Active
        </Paragraph>
      </Card>

      <Paragraph>
        You can now:
      </Paragraph>

      <ul
        style={{
          margin: "12px 0",
          paddingLeft: "20px",
          color: "#4b5563",
          fontSize: "14px",
          lineHeight: "1.8",
        }}
      >
        <li>Invite team members</li>
        <li>Start building your business model</li>
        <li>Access all programme chapters</li>
        <li>Connect with your assigned coach</li>
      </ul>

      <Button href={inviteLink} backgroundColor="#6366f1" textColor="#ffffff">
        Go to Your Workspace
      </Button>

      <Divider />

      <Paragraph>
        <Link href={`${appUrl}/account/workspace-settings`}>Manage workspace settings</Link> {" · "}
        <Link href={`${appUrl}/help/workspace-setup`}>Setup guide</Link>
      </Paragraph>
    </EmailWrapper>
  );
}
