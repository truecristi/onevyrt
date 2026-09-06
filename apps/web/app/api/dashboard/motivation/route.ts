/**
 * GET /api/dashboard/motivation — Unified motivation dashboard endpoint
 *
 * Returns a single call combining:
 * - Current why/creed (purpose + commitment)
 * - Motivation metrics (engagement score, activity, reflections)
 * - Next checkpoint (current chapter, blocked/ready/approved/submitted status)
 * - User notification preferences
 *
 * Respects workspace isolation via workspace membership check.
 * Workspace is auto-resolved from the current user's workspace list (primary).
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { listForUser } from "../../../../lib/workspaces";
import { getWhyAndCreed } from "../../../../lib/dashboard/why-creed";
import { getEngagementMetrics } from "../../../../lib/dashboard/motivation-metrics";
import { getEmailPreferences } from "../../../../lib/email-preferences";
import { getEnrollment } from "../../../../lib/enrollments";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { chapterGates } from "@onevyrt/engine";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { effectiveStageAccessLimit } from "../../../../lib/cohorts";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's workspaces and pick the primary one
    const workspaces = await listForUser(user.id);
    if (workspaces.length === 0) {
      return NextResponse.json(
        {
          error: "No workspace found",
          whyCreed: null,
          metrics: null,
          nextCheckpoint: null,
          preferences: null,
        },
        { status: 404 }
      );
    }

    const workspace = workspaces[0]; // Primary workspace
    if (!workspace) {
      return NextResponse.json(
        {
          error: "No workspace found",
          whyCreed: null,
          metrics: null,
          nextCheckpoint: null,
          preferences: null,
        },
        { status: 404 }
      );
    }
    const workspaceId = workspace.id;

    // Parallel fetch of all motivation data
    const [whyCreedData, emailPrefs, enrollment, programme, stageAccessLimit, submissions] = await Promise.all([
      getWhyAndCreed(workspaceId),
      getEmailPreferences(workspaceId),
      getEnrollment(workspaceId),
      getDefaultProgramme(),
      effectiveStageAccessLimit(workspaceId),
      listChapterSubmissions(workspaceId),
    ]);

    // Get engagement metrics for the past 30 days
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const metricsArray = await getEngagementMetrics(workspaceId, startDate, endDate, user.id);
    const metrics = metricsArray[0] || null; // Get metrics for current user

    // Compute chapter gates to determine next checkpoint
    const gates = enrollment
      ? chapterGates(programme, enrollment, submissions, stageAccessLimit)
      : [];

    // Find the next available checkpoint (first non-approved chapter)
    const nextCheckpoint = (() => {
      if (!gates || gates.length === 0) return null;

      // Look for the first stage that's not approved
      for (const gate of gates) {
        if (gate.state === "approved") continue; // Skip already approved chapters

        // Return the chapter information
        return {
          stageId: gate.stageId,
          state: gate.state, // "locked" | "in_progress" | "ready_to_submit" | "awaiting_review" | "changes_requested" | "approved"
          label: formatStageName(gate.stageId),
          href: stageToRoute(gate.stageId),
          lessonsComplete: gate.lessonsComplete,
          lessonsTotal: gate.lessonsTotal,
          unlocksNext: gate.unlocksNext,
        };
      }

      return null;
    })();

    // Return unified response
    return NextResponse.json({
      workspaceId,
      whyCreed: whyCreedData
        ? {
            why: whyCreedData.why,
            creed: whyCreedData.creed,
            lastUpdated: whyCreedData.lastUpdated,
          }
        : null,
      metrics: metrics
        ? {
            engagementScore: metrics.engagementScore,
            whyCreedViewCount: metrics.whyCreedViewCount,
            whyCreedEditCount: metrics.whyCreedEditCount,
            reflectionsCompleted: metrics.reflectionsCompleted,
            emailsSent: metrics.emailsSent,
            emailsOpened: metrics.emailsOpened,
            emailsClicked: metrics.emailsClicked,
            emailOpenRate: metrics.emailOpenRate,
            emailClickRate: metrics.emailClickRate,
            lastActivityAt: metrics.lastActivityAt,
            periodStartDate: metrics.periodStartDate,
            periodEndDate: metrics.periodEndDate,
          }
        : null,
      nextCheckpoint,
      preferences: {
        reminderEmails: emailPrefs.reminderEmails,
        weeklyDigest: emailPrefs.weeklyDigest,
        inAppNotifications: emailPrefs.inAppNotifications,
        decisionMoments: emailPrefs.decisionMoments,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/motivation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Format a stage ID into a human-readable label
 */
function formatStageName(stageId: string): string {
  const stageLabels: Record<string, string> = {
    start: "Personal & Business Baseline",
    "chapter-1": "Chapter 1: Define",
    "chapter-2": "Chapter 2: Implement",
    "chapter-3": "Chapter 3: Control",
    "chapter-4": "Chapter 4: Improve & Scale",
    finish: "Finish: Transformation Report",
  };
  return stageLabels[stageId] || stageId;
}

/**
 * Convert a stage ID to its canonical route
 */
function stageToRoute(stageId: string): string {
  const stageRoutes: Record<string, string> = {
    start: "/start",
    "chapter-1": "/programme/chapter-1",
    "chapter-2": "/programme/chapter-2",
    "chapter-3": "/programme/chapter-3",
    "chapter-4": "/programme/chapter-4",
    finish: "/programme/finish",
  };
  return stageRoutes[stageId] || "/programme";
}
