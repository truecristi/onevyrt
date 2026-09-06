/**
 * Resource Utilization — Team capacity and workload visualization
 */
"use client";

import React, { useMemo } from "react";

interface TeamMember {
  id: string;
  name: string;
  role: "owner" | "manager" | "staff" | "contractor";
  hoursPerWeek: number;
  allocatedHours: number;
  tasks: number;
  utilization: number; // 0-100
  bottleneck?: boolean;
  tasks_breakdown?: {
    operations: number;
    customer_service: number;
    sales: number;
    admin: number;
    other: number;
  };
}

interface ResourceUtilizationProps {
  teamMembers: TeamMember[];
  totalCapacityHours: number;
  totalAllocatedHours: number;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

const roleColors = {
  owner: { bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
  manager: { bg: "#dbeafe", text: "#1e40af", border: "#2563eb" },
  staff: { bg: "#fce7f3", text: "#831843", border: "#db2777" },
  contractor: { bg: "#f3e8ff", text: "#6b21a8", border: "#a855f7" },
};

const getUtilizationColor = (utilization: number): { bg: string; text: string; border: string } => {
  if (utilization >= 90) return { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" }; // Over-utilized
  if (utilization >= 75) return { bg: "#fef3c7", text: "#92400e", border: "#d97706" }; // Well-utilized
  if (utilization >= 50) return { bg: "#dbeafe", text: "#1e40af", border: "#2563eb" }; // Healthy
  return { bg: "#f0fdf4", text: "#166534", border: "#22c55e" }; // Under-utilized
};

export const ResourceUtilization = React.memo(
  ({
    teamMembers,
    totalCapacityHours,
    totalAllocatedHours,
    title,
    subtitle,
    isLoading,
  }: ResourceUtilizationProps) => {
    const { overallUtilization, bottlenecks, roleBreakdown, underutilized } = useMemo(() => {
      const overall = totalCapacityHours > 0 ? (totalAllocatedHours / totalCapacityHours) * 100 : 0;
      const bottleneckList = teamMembers.filter((m) => m.utilization >= 90);
      const underUtil = teamMembers.filter((m) => m.utilization < 50);

      const breakdown = {
        owner: teamMembers.filter((m) => m.role === "owner"),
        manager: teamMembers.filter((m) => m.role === "manager"),
        staff: teamMembers.filter((m) => m.role === "staff"),
        contractor: teamMembers.filter((m) => m.role === "contractor"),
      };

      return {
        overallUtilization: overall,
        bottlenecks: bottleneckList,
        roleBreakdown: breakdown,
        underutilized: underUtil,
      };
    }, [teamMembers, totalCapacityHours, totalAllocatedHours]);

    if (isLoading) {
      return (
        <div className="w-full space-y-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="rounded-lg border bg-white p-6 h-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-4 h-20" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-6 sm:mb-8">
            {title && <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}

        {/* Overall utilization card */}
        <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-gray-50 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Team Utilization</p>
              <p className="text-4xl font-bold text-gray-900">{Math.round(overallUtilization)}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalAllocatedHours.toFixed(0)} of {totalCapacityHours.toFixed(0)} hours
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Team Size</p>
              <p className="text-4xl font-bold text-gray-900">{teamMembers.length}</p>
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                <p>• {roleBreakdown.owner.length} Owner{roleBreakdown.owner.length !== 1 ? "s" : ""}</p>
                <p>• {roleBreakdown.staff.length + roleBreakdown.manager.length} Staff</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Capacity Status</p>
              <div className="mt-2">
                {overallUtilization >= 90 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                    🔴 Over capacity
                  </div>
                )}
                {overallUtilization >= 75 && overallUtilization < 90 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                    🟡 Well utilized
                  </div>
                )}
                {overallUtilization < 75 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                    🟢 Healthy capacity
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overallUtilization >= 90
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : overallUtilization >= 75
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : "bg-gradient-to-r from-green-500 to-emerald-500"
                }`}
                style={{ width: `${Math.min(overallUtilization, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>Optimal (75%)</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {bottlenecks.length > 0 && (
          <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-red-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-900">Over-Capacity Alert</h4>
                <p className="text-xs text-red-700 mt-1">
                  {bottlenecks.length} team member{bottlenecks.length !== 1 ? "s are" : " is"} over 90% utilized. Consider
                  delegating, hiring, or outsourcing.
                </p>
              </div>
            </div>
          </div>
        )}

        {underutilized.length > 0 && (
          <div className="rounded-lg border-l-4 border-l-green-500 bg-green-50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-green-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-green-900">Capacity Available</h4>
                <p className="text-xs text-green-700 mt-1">
                  {underutilized.length} team member{underutilized.length !== 1 ? "s have" : " has"} available capacity for
                  additional projects.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Team members list */}
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Breakdown</h3>

        <div className="space-y-3 mb-6">
          {teamMembers.map((member) => {
            const roleColor = roleColors[member.role];
            const utilColor = getUtilizationColor(member.utilization);

            return (
              <div key={member.id} className="rounded-lg border bg-white p-4 sm:p-5 hover:shadow-sm transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 truncate">{member.name}</h4>
                      <div
                        className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0"
                        style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                      >
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </div>
                      {member.bottleneck && (
                        <div className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap flex-shrink-0">
                          ⚠️ Bottleneck
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {member.allocatedHours.toFixed(1)} / {member.hoursPerWeek} hours/week • {member.tasks} active{" "}
                      {member.tasks === 1 ? "task" : "tasks"}
                    </p>
                  </div>

                  {/* Utilization badge */}
                  <div
                    className="px-4 py-2 rounded-lg font-bold text-sm text-center whitespace-nowrap flex-shrink-0"
                    style={{ backgroundColor: utilColor.bg, color: utilColor.text }}
                  >
                    {Math.round(member.utilization)}%
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(member.utilization, 100)}%`,
                        backgroundColor:
                          member.utilization >= 90
                            ? "#dc2626"
                            : member.utilization >= 75
                              ? "#d97706"
                              : member.utilization >= 50
                                ? "#2563eb"
                                : "#22c55e",
                      }}
                    />
                  </div>
                </div>

                {/* Task breakdown (if available) */}
                {member.tasks_breakdown && (
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div className="bg-orange-50 rounded p-2 text-center">
                      <p className="text-gray-600">Ops</p>
                      <p className="font-bold text-gray-900">{member.tasks_breakdown.operations}</p>
                    </div>
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <p className="text-gray-600">CS</p>
                      <p className="font-bold text-gray-900">{member.tasks_breakdown.customer_service}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2 text-center">
                      <p className="text-gray-600">Sales</p>
                      <p className="font-bold text-gray-900">{member.tasks_breakdown.sales}</p>
                    </div>
                    <div className="bg-purple-50 rounded p-2 text-center">
                      <p className="text-gray-600">Admin</p>
                      <p className="font-bold text-gray-900">{member.tasks_breakdown.admin}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <p className="text-gray-600">Other</p>
                      <p className="font-bold text-gray-900">{member.tasks_breakdown.other}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Workload distribution heatmap */}
        {teamMembers.length > 1 && (
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Workload Distribution</h3>

            <div className="space-y-2">
              {teamMembers.map((member) => {
                return (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">{member.name}</div>

                    {/* Mini heatmap */}
                    <div className="flex-1 flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-6 rounded-sm transition-colors"
                          style={{
                            backgroundColor:
                              i / 10 < member.utilization / 100
                                ? member.utilization >= 90
                                  ? "#dc2626"
                                  : member.utilization >= 75
                                    ? "#d97706"
                                    : member.utilization >= 50
                                      ? "#2563eb"
                                      : "#22c55e"
                                : "#e5e7eb",
                          }}
                          title={`${Math.round((member.utilization / 10) * (i + 1))}% of capacity`}
                        />
                      ))}
                    </div>

                    <div className="w-12 text-right text-xs font-medium text-gray-600">
                      {Math.round(member.utilization)}%
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs">
              <span className="text-gray-600">Capacity strain →</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-green-500" />
                <span className="text-gray-600">Healthy</span>
                <div className="w-4 h-4 rounded-sm bg-blue-500 ml-2" />
                <span className="text-gray-600">Normal</span>
                <div className="w-4 h-4 rounded-sm bg-orange-500 ml-2" />
                <span className="text-gray-600">High</span>
                <div className="w-4 h-4 rounded-sm bg-red-500 ml-2" />
                <span className="text-gray-600">Critical</span>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Recommendations</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            {overallUtilization >= 90 && <li>• Consider hiring or outsourcing to reduce team workload</li>}
            {overallUtilization >= 75 && overallUtilization < 90 && (
              <li>• Team is well-utilized — monitor for burnout and maintain current workload</li>
            )}
            {overallUtilization < 75 && (
              <li>• Team has available capacity — consider new projects or expansion initiatives</li>
            )}
            {bottlenecks.length > 0 && (
              <li>• {bottlenecks[0]!.name} is a bottleneck — redistribute work or provide support</li>
            )}
            <li>• Track utilization weekly to catch capacity issues early</li>
          </ul>
        </div>
      </div>
    );
  }
);

ResourceUtilization.displayName = "ResourceUtilization";

/**
 * Example usage
 */
export function ResourceUtilizationExample() {
  const exampleTeam: TeamMember[] = [
    {
      id: "owner-1",
      name: "You (Owner)",
      role: "owner",
      hoursPerWeek: 50,
      allocatedHours: 48,
      tasks: 12,
      utilization: 96,
      bottleneck: true,
      tasks_breakdown: {
        operations: 4,
        customer_service: 2,
        sales: 3,
        admin: 2,
        other: 1,
      },
    },
    {
      id: "staff-1",
      name: "Sarah (Operations)",
      role: "staff",
      hoursPerWeek: 40,
      allocatedHours: 32,
      tasks: 8,
      utilization: 80,
      tasks_breakdown: {
        operations: 5,
        customer_service: 2,
        sales: 1,
        admin: 0,
        other: 0,
      },
    },
    {
      id: "contractor-1",
      name: "Mike (Contractor)",
      role: "contractor",
      hoursPerWeek: 20,
      allocatedHours: 12,
      tasks: 4,
      utilization: 60,
      tasks_breakdown: {
        operations: 1,
        customer_service: 1,
        sales: 1,
        admin: 1,
        other: 0,
      },
    },
    {
      id: "staff-2",
      name: "Jennifer (Support)",
      role: "staff",
      hoursPerWeek: 40,
      allocatedHours: 25,
      tasks: 6,
      utilization: 62,
      tasks_breakdown: {
        operations: 1,
        customer_service: 4,
        sales: 0,
        admin: 1,
        other: 0,
      },
    },
  ];

  return (
    <div className="p-8 bg-gray-50">
      <ResourceUtilization
        teamMembers={exampleTeam}
        totalCapacityHours={150}
        totalAllocatedHours={117}
        title="Team Capacity & Resource Utilization"
        subtitle="Monitor workload distribution and identify bottlenecks"
      />
    </div>
  );
}
