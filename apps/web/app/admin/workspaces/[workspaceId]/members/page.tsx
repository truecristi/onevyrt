import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { MemberProgressDashboard } from "@/components/admin/MemberProgressDashboard";

/**
 * Admin Members Progress Page
 * Path: /admin/workspaces/[workspaceId]/members
 *
 * Superadmin dashboard to check on workspace members:
 * - See all members in your workspace
 * - Current chapter + progress for each
 * - Sort by progress, activity, name
 * - Filter by role (learner/coach) and status (active/stuck/completed)
 * - Quick promote to coach button
 */

export default async function AdminMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const cookieStore = await cookies();
  const user = await currentUser(cookieStore.get("auth")?.value || "");

  if (!user) {
    redirect("/login");
  }

  // Fetch members from API
  const membersRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/workspaces/${workspaceId}/members`,
    {
      method: "GET",
      headers: {
        Cookie: `auth=${cookieStore.get("auth")?.value}`,
      },
    }
  );

  if (!membersRes.ok) {
    if (membersRes.status === 401) redirect("/login");
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          Failed to load members. You may not have permission to view this workspace.
        </p>
      </div>
    );
  }

  const { members } = await membersRes.json();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <MemberProgressDashboard
          members={members}
          workspaceId={workspaceId}
          onMemberClick={(member) => {
            // TODO: Navigate to member detail page
            console.log("View member:", member);
          }}
          onPromoteToCoach={async (memberId) => {
            // TODO: Call promotion API
            console.log("Promote to coach:", memberId);
          }}
        />
      </div>
    </div>
  );
}
