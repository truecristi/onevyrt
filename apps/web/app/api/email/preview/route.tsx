/**
 * Email template preview endpoint.
 * Renders templates for visual inspection and testing.
 *
 * Usage:
 *   GET /api/email/preview?template=welcome-user&name=John
 *   GET /api/email/preview?template=chapter-approved&format=text
 */

import { NextRequest, NextResponse } from "next/server";
import { renderTemplate } from "../../../../lib/email-templates";
import { WelcomeNewUserTemplate } from "../../../../lib/email-templates/welcome-template";
import { ChapterApprovedNotification } from "../../../../lib/email-templates/chapter-notifications-template";
import { MilestoneAchieved } from "../../../../lib/email-templates/milestone-templates";

interface TemplateParams {
  [key: string]: string | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get("template");
    const format = searchParams.get("format") || "html";

    if (!template) {
      return NextResponse.json(
        { error: "Template parameter required" },
        { status: 400 },
      );
    }

    // Parse template parameters
    const params: TemplateParams = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "template" && key !== "format") {
        params[key] = value;
      }
    }

    let renderedTemplate;

    // Route to correct template based on ID
    switch (template) {
      case "welcome-user":
        renderedTemplate = await renderTemplate(
          <WelcomeNewUserTemplate
            name={params.name || "John Doe"}
            verificationLink={params.verificationLink || "https://example.com/verify"}
            appUrl={params.appUrl || "https://onevyrt.masteryresearch.com"}
          />,
          "Welcome to ONEVYRT!",
        );
        break;

      case "chapter-approved":
        renderedTemplate = await renderTemplate(
          <ChapterApprovedNotification
            learnerName={params.learnerName || "Jane Smith"}
            coachName={params.coachName || "Coach Sarah"}
            chapterNumber={Number(params.chapterNumber) || 1}
            chapterName={params.chapterName || "DEFINE"}
            nextChapterNumber={Number(params.nextChapterNumber) || 2}
            nextChapterName={params.nextChapterName || "IMPLEMENT"}
            feedbackHighlights={
              params.feedbackHighlights
                ? params.feedbackHighlights.split("|")
                : ["Great customer analysis", "Clear market positioning"]
            }
            continueLink={params.continueLink || "https://example.com/chapter/2"}
            appUrl={params.appUrl || "https://onevyrt.masteryresearch.com"}
          />,
          "Chapter Approved - Move to Next Chapter",
        );
        break;

      case "milestone-achieved":
        renderedTemplate = await renderTemplate(
          <MilestoneAchieved
            learnerName={params.learnerName || "Jane Smith"}
            milestoneType={
              (params.milestoneType as
                | "first-chapter-complete"
                | "all-chapters-complete"
                | "first-assignment"
                | "halfway-through") || "first-chapter-complete"
            }
            milestoneTitle={params.milestoneTitle || "First Chapter Complete!"}
            milestoneDescription={
              params.milestoneDescription ||
              "You've completed your first chapter and are on your way to transforming your business."
            }
            nextStepLink={params.nextStepLink || "https://example.com/dashboard"}
            appUrl={params.appUrl || "https://onevyrt.masteryresearch.com"}
          />,
          "You've Achieved a Milestone!",
        );
        break;

      default:
        return NextResponse.json(
          {
            error: `Unknown template: ${template}`,
            available: ["welcome-user", "chapter-approved", "milestone-achieved"],
          },
          { status: 404 },
        );
    }

    // Return requested format
    if (format === "text") {
      return new NextResponse(renderedTemplate.text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (format === "json") {
      return NextResponse.json(renderedTemplate);
    }

    // Default: return HTML
    return new NextResponse(renderedTemplate.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("[email preview]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to render template",
      },
      { status: 500 },
    );
  }
}
