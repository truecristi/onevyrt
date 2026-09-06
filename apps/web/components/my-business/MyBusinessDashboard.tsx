"use client";

/**
 * My Business Dashboard — displays the learner's unified business profile.
 *
 * Shows all sections of MyBusiness: identity, direction, customer, strategy,
 * offer, numbers, message, brand, transformation, and next 90 days.
 *
 * Completeness indicator at the top shows progress filling in the profile
 * (counted as filled leaf fields across all sections).
 *
 * Data is assembled by the API route from three sources with precedence:
 * definition > reality map > brand — so each fact appears once, from its
 * most authoritative source.
 */
import { useState } from "react";
import type { MyBusiness, MyBusinessCompleteness } from "@onevyrt/engine";

interface MyBusinessData {
  myBusiness: MyBusiness;
  completeness: MyBusinessCompleteness;
  workspace: { id: string; name: string };
}

interface ProgrammeOutput {
  stageId: string;
  title: string;
  outputName?: string;
  status: "not_started" | "in_progress" | "awaiting_review" | "changes_requested" | "approved" | "locked";
  submittedAt?: string;
  approvedAt?: string;
  coachName?: string;
  coachEmail?: string;
  coachFeedback?: string;
  lessonsComplete?: number;
  lessonsTotal?: number;
  data?: Record<string, unknown>;
}

interface Section {
  key: Exclude<keyof MyBusiness, "programmeOutputs">;
  title: string;
  description: string;
}

const SECTIONS: Section[] = [
  { key: "identity", title: "Business Identity", description: "What business are you building?" },
  { key: "direction", title: "Direction & Vision", description: "Where are you headed?" },
  { key: "customer", title: "Your Customer", description: "Who do you serve and what's their problem?" },
  { key: "strategy", title: "Strategy", description: "Your competitive position and opportunity" },
  { key: "offer", title: "Your Offer", description: "What you deliver and your guarantees" },
  { key: "numbers", title: "Current Numbers", description: "Where you are today" },
  { key: "message", title: "Your Message", description: "How you explain your value" },
  { key: "brand", title: "Brand Position", description: "Your brand voice and competitive landscape" },
  { key: "transformation", title: "Transformation Story", description: "Your journey from then to now" },
  { key: "next90", title: "Next 90 Days", description: "What you're focusing on" },
];

function formatFieldLabel(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getStatusBadgeColor(status: ProgrammeOutput["status"]): string {
  switch (status) {
    case "approved":
      return "bg-green-50 text-green-700 border-green-200";
    case "awaiting_review":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "changes_requested":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "locked":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function formatStatusLabel(status: ProgrammeOutput["status"]): string {
  switch (status) {
    case "approved":
      return "✓ Approved";
    case "awaiting_review":
      return "⏳ Awaiting Review";
    case "changes_requested":
      return "✏️ Changes Requested";
    case "in_progress":
      return "📝 In Progress";
    case "locked":
      return "🔒 Locked";
    default:
      return "Not Started";
  }
}

function ProgrammeOutputCard({ output }: { output: ProgrammeOutput }) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return null;
    }
  };

  return (
    <div className="border rounded-lg p-4 sm:p-6 bg-white hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base sm:text-lg text-gray-900">{output.title}</h3>
          {output.outputName && (
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              <strong>Output:</strong> {output.outputName}
            </p>
          )}
        </div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${getStatusBadgeColor(output.status)}`}>
          {formatStatusLabel(output.status)}
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4 text-sm">
        {/* Lesson progress */}
        {output.lessonsTotal !== undefined && (
          <div className="flex items-center justify-between text-gray-700">
            <span>Lessons:</span>
            <span className="font-medium">
              {output.lessonsComplete ?? 0} of {output.lessonsTotal}
            </span>
          </div>
        )}

        {/* Submission date */}
        {output.submittedAt && (
          <div className="flex items-center justify-between text-gray-700">
            <span>Submitted:</span>
            <span className="font-medium">{formatDate(output.submittedAt)}</span>
          </div>
        )}

        {/* Approval date */}
        {output.approvedAt && (
          <div className="flex items-center justify-between text-gray-700">
            <span>Approved:</span>
            <span className="font-medium">{formatDate(output.approvedAt)}</span>
          </div>
        )}

        {/* Coach info */}
        {output.coachEmail && (
          <div className="flex items-center justify-between text-gray-700">
            <span>Coach:</span>
            <span className="font-medium">{output.coachName || output.coachEmail}</span>
          </div>
        )}

        {/* Coach feedback */}
        {output.coachFeedback && (
          <div className="border-l-2 border-amber-200 pl-3 sm:pl-4 py-2 bg-amber-50 rounded">
            <p className="text-xs font-medium text-amber-900 mb-1">Coach Feedback:</p>
            <p className="text-xs text-amber-800 break-words">{output.coachFeedback}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  data,
  isFilled,
}: {
  section: Section;
  data: Record<string, string | undefined>;
  isFilled: boolean;
}) {
  const fields = Object.entries(data).filter(([, v]) => v !== undefined && v !== "");

  return (
    <div className="border rounded-lg p-4 sm:p-6 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base sm:text-lg text-gray-900">{section.title}</h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">{section.description}</p>
        </div>
        {isFilled && <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium whitespace-nowrap">✓ Filled</div>}
      </div>

      {fields.length === 0 ? (
        <p className="text-gray-400 text-xs sm:text-sm italic">No data yet. Complete the programme to fill this section.</p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {fields.map(([key, value]) => (
            <div key={key} className="border-l-2 border-gray-200 pl-3 sm:pl-4">
              <p className="text-xs sm:text-sm font-medium text-gray-700">{formatFieldLabel(key)}</p>
              <p className="text-xs sm:text-sm text-gray-900 mt-1 break-words">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MyBusinessDashboard({ data }: { data: MyBusinessData }) {
  const { myBusiness, completeness } = data;
  const [expandedSections, setExpandedSections] = useState<Set<keyof MyBusiness>>(
    new Set(SECTIONS.filter(s => completeness.bySection[s.key]).map(s => s.key))
  );

  const toggleSection = (sectionKey: keyof MyBusiness) => {
    const updated = new Set(expandedSections);
    if (updated.has(sectionKey)) {
      updated.delete(sectionKey);
    } else {
      updated.add(sectionKey);
    }
    setExpandedSections(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Business</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Your unified business profile, assembled as you complete the programme</p>

          {/* Completeness Indicator */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Profile Completeness</span>
              <span className="text-sm font-semibold text-gray-900">{completeness.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${completeness.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {completeness.filled} of {completeness.total} fields filled
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Programme Outputs Section */}
        {myBusiness.programmeOutputs && myBusiness.programmeOutputs.length > 0 && (
          <div className="mb-8 sm:mb-12">
            <div className="mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Programme Outputs</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                Your permanent artifacts and coach approvals across all chapters
              </p>
            </div>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              {myBusiness.programmeOutputs.map((output) => (
                <ProgrammeOutputCard key={output.stageId} output={output} />
              ))}
            </div>
          </div>
        )}

        {/* Grid of sections */}
        <div className="space-y-4 sm:space-y-6">
          {SECTIONS.map((section) => {
            const sectionData = myBusiness[section.key];
            const isFilled = completeness.bySection[section.key];
            const isExpanded = expandedSections.has(section.key);

            if (Object.keys(sectionData).length === 0) return null;

            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full text-left mb-2 px-3 sm:px-4 py-3 sm:py-2 rounded hover:bg-gray-100 active:bg-gray-100 transition-colors flex items-start sm:items-center justify-between gap-3 min-h-[44px]"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900">{section.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{section.description}</p>
                  </div>
                  <span className={`text-gray-400 transform transition-transform flex-shrink-0 mt-1 sm:mt-0 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true">
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <SectionCard section={section} data={sectionData} isFilled={isFilled} />
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {completeness.filled === 0 && (
          <div className="text-center py-8 sm:py-12">
            <p className="text-sm sm:text-base text-gray-600 px-4">
              Complete the programme lessons to build your My Business profile. Each chapter feeds into your business definition.
            </p>
            <a href="/programme" className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium min-h-[44px] flex items-center justify-center">
              Start the Programme
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
