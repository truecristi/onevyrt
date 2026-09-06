"use client";

import { useState, useMemo } from "react";

/**
 * MemberProgressDashboard
 *
 * Superadmin view to check on all workspace members:
 * - Current chapter (DEFINE / IMPLEMENT / CONTROL / IMPROVE / FINISH)
 * - Progress % through the programme
 * - Role (learner, editor, manager/coach)
 * - Last activity status
 * - Quick actions (view details, promote to coach, etc.)
 *
 * Usage:
 * ```tsx
 * import { MemberProgressDashboard } from "@/components/admin/MemberProgressDashboard";
 *
 * export default function AdminPage() {
 *   const members = await fetchWorkspaceMembers(workspaceId);
 *   return <MemberProgressDashboard members={members} />;
 * }
 * ```
 */

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "editor" | "viewer";
  joinedAt: Date | string;
  enrollmentData?: {
    currentChapter: 0 | 1 | 2 | 3 | 4 | 5; // 0=start, 1-4=chapters, 5=finish
    chapterName: string;
    progressPercent: number; // 0-100
    completedChapters: number;
    lastActivityAt?: Date | string;
    isStuck?: boolean; // inactive >7 days
  };
}

interface MemberProgressDashboardProps {
  members: Member[];
  workspaceId?: string;
  onMemberClick?: (member: Member) => void;
  onPromoteToCoach?: (memberId: string) => Promise<void>;
}

const CHAPTER_COLORS: Record<number, string> = {
  0: "bg-slate-100 text-slate-700",
  1: "bg-blue-100 text-blue-700", // DEFINE
  2: "bg-green-100 text-green-700", // IMPLEMENT
  3: "bg-amber-100 text-amber-700", // CONTROL
  4: "bg-red-100 text-red-700", // IMPROVE
  5: "bg-cyan-100 text-cyan-700", // FINISH
};

export function MemberProgressDashboard({
  members,
  onMemberClick,
  onPromoteToCoach,
}: MemberProgressDashboardProps) {
  const [sortBy, setSortBy] = useState<"name" | "progress" | "activity">("progress");
  const [filterRole, setFilterRole] = useState<"all" | "learner" | "coach">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "stuck" | "completed">("all");

  // Sort & filter members
  const filteredMembers = useMemo(() => {
    let filtered = [...members];

    // Filter by role
    if (filterRole === "learner") {
      filtered = filtered.filter((m) => m.role === "editor" || m.role === "viewer");
    } else if (filterRole === "coach") {
      filtered = filtered.filter((m) => m.role === "manager" || m.role === "owner");
    }

    // Filter by status
    if (filterStatus === "active") {
      filtered = filtered.filter((m) => !m.enrollmentData?.isStuck);
    } else if (filterStatus === "stuck") {
      filtered = filtered.filter((m) => m.enrollmentData?.isStuck);
    } else if (filterStatus === "completed") {
      filtered = filtered.filter((m) => m.enrollmentData?.currentChapter === 5);
    }

    // Sort
    if (sortBy === "progress") {
      filtered.sort((a, b) => (b.enrollmentData?.progressPercent ?? 0) - (a.enrollmentData?.progressPercent ?? 0));
    } else if (sortBy === "activity") {
      filtered.sort((a, b) => {
        const aTime = a.enrollmentData?.lastActivityAt ? new Date(a.enrollmentData.lastActivityAt).getTime() : 0;
        const bTime = b.enrollmentData?.lastActivityAt ? new Date(b.enrollmentData.lastActivityAt).getTime() : 0;
        return bTime - aTime;
      });
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [members, sortBy, filterRole, filterStatus]);

  const stats = useMemo(() => {
    const total = members.length;
    const completed = members.filter((m) => m.enrollmentData?.currentChapter === 5).length;
    const stuck = members.filter((m) => m.enrollmentData?.isStuck).length;
    const coaches = members.filter((m) => m.role === "manager" || m.role === "owner").length;
    const avgProgress = members.reduce((sum, m) => sum + (m.enrollmentData?.progressPercent ?? 0), 0) / total;

    return { total, completed, stuck, coaches, avgProgress: Math.round(avgProgress) };
  }, [members]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Members Progress</h1>
        <p className="text-slate-600 mt-1">Monitor your team's journey through the programme</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Members" value={stats.total} />
        <StatCard label="Average Progress" value={`${stats.avgProgress}%`} />
        <StatCard label="Completed" value={stats.completed} highlight="green" />
        <StatCard label="Coaches" value={stats.coaches} highlight="blue" />
        <StatCard label="Stuck" value={stats.stuck} highlight="red" />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="progress">Sort by Progress</option>
            <option value="activity">Sort by Activity</option>
            <option value="name">Sort by Name</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="learner">Learners Only</option>
            <option value="coach">Coaches Only</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="stuck">Inactive (&gt;7d)</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="text-sm text-slate-600">
          Showing {filteredMembers.length} of {members.length} members
        </div>
      </div>

      {/* Members Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Member</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Current Chapter</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Progress</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No members match your filters
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onMemberClick={onMemberClick}
                  onPromoteToCoach={onPromoteToCoach}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * MemberRow Component
 * Single member row with chapter, progress, and quick actions
 */
function MemberRow({
  member,
  onMemberClick,
  onPromoteToCoach,
}: {
  member: Member;
  onMemberClick?: (member: Member) => void;
  onPromoteToCoach?: (memberId: string) => Promise<void>;
}) {
  const [isPromoting, setIsPromoting] = useState(false);

  const enrollment: NonNullable<Member["enrollmentData"]> = member.enrollmentData || {
    currentChapter: 0,
    chapterName: "Not started",
    progressPercent: 0,
    completedChapters: 0,
    isStuck: false,
  };

  const chapterNum = enrollment.currentChapter;
  const chapterColor = CHAPTER_COLORS[chapterNum];
  const isCompleted = chapterNum === 5;
  const isStuck = enrollment.isStuck;

  const handlePromote = async () => {
    if (!onPromoteToCoach) return;
    setIsPromoting(true);
    try {
      await onPromoteToCoach(member.id);
      // Toast/notification would go here in real app
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      {/* Member Name & Email */}
      <td className="px-4 py-3">
        <button
          onClick={() => onMemberClick?.(member)}
          className="text-left hover:underline focus:outline-none"
        >
          <div className="font-medium text-slate-900">{member.name}</div>
          <div className="text-xs text-slate-500">{member.email}</div>
        </button>
      </td>

      {/* Role Badge */}
      <td className="px-4 py-3">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            member.role === "manager" || member.role === "owner"
              ? "bg-purple-100 text-purple-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {member.role === "manager" ? "Coach" : member.role === "owner" ? "Owner" : "Learner"}
        </span>
      </td>

      {/* Current Chapter */}
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${chapterColor}`}>
          {enrollment.chapterName}
        </span>
      </td>

      {/* Progress Bar */}
      <td className="px-4 py-3">
        <div className="w-24">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isCompleted ? "bg-cyan-500" : isStuck ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${enrollment.progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-slate-600 mt-1">{enrollment.progressPercent}%</div>
        </div>
      </td>

      {/* Status Indicator */}
      <td className="px-4 py-3">
        {isCompleted ? (
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
            ✓ Completed
          </span>
        ) : isStuck ? (
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
            ⚠ Inactive
          </span>
        ) : (
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
            → Active
          </span>
        )}
      </td>

      {/* Quick Actions */}
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {isCompleted && member.role !== "manager" && member.role !== "owner" && (
            <button
              onClick={handlePromote}
              disabled={isPromoting}
              className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isPromoting ? "..." : "→ Coach"}
            </button>
          )}
          <button
            onClick={() => onMemberClick?.(member)}
            className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
          >
            View
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * StatCard Component
 * Displays a single stat in the header grid
 */
function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "green" | "blue" | "red";
}) {
  const highlightMap: Record<"green" | "blue" | "red", string> = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
  };
  const highlightClass = (highlight && highlightMap[highlight]) || "bg-slate-50 border-slate-200";

  return (
    <div className={`border ${highlightClass} rounded-lg p-3`}>
      <div className="text-xs text-slate-600 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
