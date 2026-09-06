import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import { getEnrollment } from "@/lib/enrollments";
import { getDefaultProgramme } from "@/lib/curriculum-store";
import { listChapterSubmissions } from "@/lib/chapter-submissions";
import { listActivity } from "@/lib/activity";
import { pgPool } from "@/lib/db";
import { chapterGates, summarizeEnrollment, CANONICAL_STAGES } from "@onevyrt/engine";

/**
 * GET /api/admin/workspaces/[id]/members
 *
 * Fetch all members in a workspace with their enrollment progress.
 *
 * Query params:
 * - sortBy: "name" | "progress" | "activity" (default: "progress")
 * - role: "all" | "learner" | "coach" (default: "all")
 * - status: "all" | "active" | "stuck" | "completed" (default: "all")
 *
 * Response:
 * ```json
 * {
 *   "members": [
 *     {
 *       "id": "user_123",
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "role": "editor",
 *       "joinedAt": "2026-09-01T00:00:00Z",
 *       "enrollmentData": {
 *         "currentChapter": 2,
 *         "chapterName": "IMPLEMENT",
 *         "progressPercent": 45,
 *         "completedChapters": 1,
 *         "lastActivityAt": "2026-09-03T14:22:00Z",
 *         "isStuck": false
 *       }
 *     }
 *   ],
 *   "stats": {
 *     "total": 12,
 *     "avgProgress": 35,
 *     "completed": 2,
 *     "coaches": 1
 *   }
 * }
 * ```
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Verify user has access to this workspace
    const userWorkspaces = await listForUser(user.id);
    const workspace = userWorkspaces.find((w) => w.id === workspaceId);

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Only owner and managers can see all members
    const memberRole = workspace.members?.find((m) => m.userId === user.id)?.role;
    if (!["owner", "manager"].includes(memberRole || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get all workspace members
    const membersResult = await pgPool().query<{
      user_id: string;
      role: string;
      name: string | null;
      email: string;
      joined_at: string;
    }>(
      `
      SELECT wu.user_id, wu.role, u.name, u.email, wu.created_at as joined_at
      FROM workspaces_users wu
      JOIN users u ON u.id = wu.user_id
      WHERE wu.workspace_id = $1
      ORDER BY wu.created_at DESC
      `,
      [workspaceId]
    );

    // Enrollment/chapter progress lives on the workspace (one learner's
    // business per workspace — lib/enrollments.ts), not per member, so it's
    // fetched once and shared across every member row below.
    const [programme, enrollment, chapterSubmissions, activity] = await Promise.all([
      getDefaultProgramme(),
      getEnrollment(workspaceId),
      listChapterSubmissions(workspaceId),
      listActivity(workspaceId, 1),
    ]);

    // Highest canonical chapter (order 0=start..5=finish) approved so far.
    const approvedOrders = enrollment
      ? chapterGates(programme, enrollment, chapterSubmissions)
          .filter((g) => g.state === "approved")
          .map((g) => g.order)
      : [];
    const currentChapter = Math.min(approvedOrders.length ? Math.max(...approvedOrders) + 1 : 0, 5);
    const completedChapters = approvedOrders.length;
    const currentChapterName =
      CANONICAL_STAGES.find((s) => s.order === currentChapter)?.title ?? "Unknown";

    // Real lesson-level completion across the whole programme (same source
    // /api/admin/learners and every learner-facing progress bar already use)
    // instead of a hand-rolled per-chapter estimate.
    const progressPercent = enrollment ? summarizeEnrollment(programme, enrollment).percentComplete : 0;

    // Detect if stuck (no activity in >7 days)
    const lastActivityAt = activity[0]?.at ?? null;
    const lastActivity = lastActivityAt ? new Date(lastActivityAt) : null;
    const isStuck = lastActivity
      ? Date.now() - lastActivity.getTime() > 7 * 24 * 60 * 60 * 1000
      : false;

    // Enrich with enrollment data
    const members = membersResult.rows.map((row) => {
      return {
        id: row.user_id,
        name: row.name || "Unknown",
        email: row.email,
        role: row.role,
        joinedAt: row.joined_at,
        enrollmentData: {
          currentChapter,
          chapterName: currentChapterName,
          progressPercent,
          completedChapters,
          lastActivityAt,
          isStuck,
        },
      };
    });

    // Calculate stats
    const stats = {
      total: members.length,
      avgProgress: Math.round(
        members.reduce((sum, m) => sum + (m.enrollmentData.progressPercent || 0), 0) /
          members.length
      ),
      completed: members.filter((m) => m.enrollmentData.currentChapter === 5).length,
      coaches: members.filter((m) => ["manager", "owner"].includes(m.role)).length,
    };

    return NextResponse.json({ members, stats });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
