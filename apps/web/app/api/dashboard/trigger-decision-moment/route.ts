/**
 * POST /api/dashboard/trigger-decision-moment
 *
 * Triggers a "decision moment" reminder modal that surfaces the user's Why & Creed
 * before taking a major action (payment, milestone, level-up, etc).
 *
 * Request body:
 * {
 *   actionType: "payment" | "milestone" | "level-up" | "chapter-submit",
 *   context?: {
 *     amount?: number,
 *     description?: string,
 *     chapterName?: string,
 *     ...
 *   }
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   reminder: {
 *     actionType: string,
 *     why: string,
 *     creed: string,
 *     modal: {
 *       title: string,
 *       subtitle: string,
 *       primaryCta: string,
 *       secondaryCta: string,
 *       color: string,
 *       icon: string,
 *     },
 *     context: object
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { listForUser } from "../../../../lib/workspaces";
import { getWhyAndCreed } from "../../../../lib/dashboard/why-creed";

export const runtime = "nodejs";

// Action type validation
type ActionType = "payment" | "milestone" | "level-up" | "chapter-submit";

interface DecisionMomentContext {
  amount?: number;
  description?: string;
  chapterName?: string;
  chapterNumber?: number;
  lessonTitle?: string;
  [key: string]: unknown;
}

interface ModalConfig {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  color: string; // Hex color code
  icon: string; // Icon name (heroicon)
}

// Modal configurations per action type
const MODAL_CONFIGS: Record<ActionType, ModalConfig> = {
  payment: {
    title: "Before You Invest",
    subtitle:
      "Take a moment to reconnect with your deeper purpose. This investment is part of your journey.",
    primaryCta: "Yes, continue",
    secondaryCta: "Pause & reflect",
    color: "#2563eb", // Blue
    icon: "credit-card",
  },
  milestone: {
    title: "Milestone Reached",
    subtitle:
      "Celebrate this progress. Let your why fuel the next chapter of your growth.",
    primaryCta: "Celebrate & continue",
    secondaryCta: "Take a moment",
    color: "#16a34a", // Green
    icon: "star",
  },
  "level-up": {
    title: "Ready to Level Up?",
    subtitle:
      "You're about to unlock new capabilities. Ground yourself in your core purpose first.",
    primaryCta: "Level up",
    secondaryCta: "Reflect first",
    color: "#d97706", // Amber
    icon: "arrow-up",
  },
  "chapter-submit": {
    title: "Submit Your Work",
    subtitle:
      "Before sending this to your coach, reconnect with the transformation you're building.",
    primaryCta: "Submit",
    secondaryCta: "Review again",
    color: "#0891b2", // Cyan
    icon: "check-circle",
  },
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authenticate user
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's workspace(s)
    const workspaces = await listForUser(user.id);
    if (workspaces.length === 0) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 }
      );
    }

    // Parse request body
    let body: {
      actionType?: unknown;
      context?: DecisionMomentContext;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { actionType, context } = body;

    // Validate actionType
    if (
      typeof actionType !== "string" ||
      !Object.keys(MODAL_CONFIGS).includes(actionType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid actionType. Must be one of: ${Object.keys(MODAL_CONFIGS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate context if provided
    if (context !== undefined && typeof context !== "object") {
      return NextResponse.json(
        { error: "Context must be an object" },
        { status: 400 }
      );
    }

    // Fetch user's why & creed from primary workspace
    const workspace = workspaces[0]!;
    const whyCreedData = await getWhyAndCreed(workspace.id);

    // Get modal configuration for this action type
    const modalConfig = MODAL_CONFIGS[actionType as ActionType];

    // Build response
    const reminder = {
      actionType,
      why: whyCreedData?.why || "",
      creed: whyCreedData?.creed || "",
      modal: modalConfig,
      context: context || {},
    };

    return NextResponse.json({
      ok: true,
      reminder,
    });
  } catch (error) {
    console.error("POST /api/dashboard/trigger-decision-moment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
