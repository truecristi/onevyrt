/**
 * Phase2LessonVisuals.integration.tsx — Integration & usage patterns
 *
 * Shows how to use Phase2LessonVisuals in:
 * 1. Static lesson pages (with demo data)
 * 2. Dynamic enrollment context (pulling real business data)
 * 3. Lesson submission flows (before/after comparison)
 * 4. Coach feedback and revision scenarios
 */

import {
  Phase2LessonVisuals,
  FunnelStage,
  SplitTestVariant,
  KPIMetric,
  TeamRole,
  TeamConnection,
} from "./Phase2LessonVisuals";

/**
 * ============================================================================
 * INTEGRATION PATTERN 1: Static Lesson Page
 * ============================================================================
 *
 * Use case: Teacher/coach displays a lesson with demo data to illustrate concepts
 * Context: /programme/lesson/[id] page
 * Data flow: Hardcoded demo data → Visual component
 */

export function LessonPageStatic() {
  return (
    <div className="lesson-page space-y-6">
      <div className="lesson-header">
        <h1>Chapter 2.1 - Sales Funnel Optimization</h1>
        <p className="text-gray-600">Learn how to identify bottlenecks and improve conversion</p>
      </div>

      <div className="lesson-content">
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Understanding Your Sales Funnel</h2>
          <p className="mb-4">
            Every business has a sales funnel - the journey from prospect to customer. By measuring
            each stage, you can identify where prospects are dropping off and take action to improve.
          </p>

          {/* Display funnel visualization with demo data */}
          <Phase2LessonVisuals
            title="Example: SaaS Company Funnel"
            showFunnel={true}
            showDashboard={false}
            showTeam={false}
          />

          <p className="mt-6 text-sm text-gray-600">
            In this example, only 0.66% of visitors become active customers. The biggest drop-off
            happens at the "Free Trial" stage (6% → 3%). This is where the company should focus their
            optimization efforts.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">A/B Testing for Improvement</h2>
          <p className="mb-4">
            Use split tests to systematically improve conversion rates. Test one variable at a time
            (headline, CTA button, form fields) to measure what works.
          </p>

          {/* Funnel with split test comparison shown */}
          <Phase2LessonVisuals
            funnelStages={[
              { name: "Visitors", value: 10000, percentage: 100 },
              { name: "Leads", value: 600, percentage: 6 },
              { name: "Customers", value: 30, percentage: 0.3 },
            ]}
            splitTests={[
              {
                name: "Original (Control)",
                conversionRate: 5,
                visitors: 5000,
                conversions: 250,
                revenue: 5000,
              },
              {
                name: "New Headline",
                conversionRate: 7.2,
                visitors: 5000,
                conversions: 360,
                revenue: 7200,
              },
            ]}
            showDashboard={false}
            showTeam={false}
          />
        </section>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * INTEGRATION PATTERN 2: Enrollment Data Context
 * ============================================================================
 *
 * Use case: Show student's own funnel metrics from their enrolled business
 * Context: Student working through Phase 2 lesson with their business data
 * Data flow: Database enrollment → Transform to FunnelStage[] → Visual component
 */

export interface EnrollmentData {
  businessName: string;
  enrollmentId: string;
  // Funnel data captured from their business
  funnelMetrics?: {
    visitors: number;
    leads: number;
    qualified: number;
    proposals: number;
    customers: number;
  };
  // KPI data from their metrics submission
  kpis?: {
    monthlyRevenue: number;
    conversionRate: number;
    customerAcquisitionCost: number;
    averageOrderValue: number;
  };
  // Team structure they've defined
  teamData?: {
    roles: TeamRole[];
    connections: TeamConnection[];
  };
}

export function LessonWithStudentData({
  enrollment,
}: {
  enrollment: EnrollmentData;
}) {
  // Transform enrollment data to component props
  const funnelStages = enrollment.funnelMetrics
    ? [
        { name: "Visitors", value: enrollment.funnelMetrics.visitors, percentage: 100 },
        {
          name: "Leads",
          value: enrollment.funnelMetrics.leads,
          percentage: (enrollment.funnelMetrics.leads / enrollment.funnelMetrics.visitors) * 100,
        },
        {
          name: "Qualified",
          value: enrollment.funnelMetrics.qualified,
          percentage:
            (enrollment.funnelMetrics.qualified / enrollment.funnelMetrics.visitors) * 100,
        },
        {
          name: "Proposals",
          value: enrollment.funnelMetrics.proposals,
          percentage: (enrollment.funnelMetrics.proposals / enrollment.funnelMetrics.visitors) * 100,
        },
        {
          name: "Customers",
          value: enrollment.funnelMetrics.customers,
          percentage:
            (enrollment.funnelMetrics.customers / enrollment.funnelMetrics.visitors) * 100,
        },
      ]
    : undefined;

  const kpis: KPIMetric[] | undefined = enrollment.kpis
    ? [
        { label: "Monthly Revenue", value: `$${enrollment.kpis.monthlyRevenue}` },
        { label: "Conversion Rate", value: `${enrollment.kpis.conversionRate}%` },
        {
          label: "Customer Acquisition Cost",
          value: `$${enrollment.kpis.customerAcquisitionCost}`,
        },
        { label: "Average Order Value", value: `$${enrollment.kpis.averageOrderValue}` },
      ]
    : undefined;

  return (
    <div className="space-y-8">
      <div className="lesson-header">
        <h1>Your {enrollment.businessName} Metrics</h1>
        <p className="text-gray-600">
          See your business data visualization and identify optimization opportunities
        </p>
      </div>

      {/* Show student's actual data overlaid on visual component */}
      <Phase2LessonVisuals
        title={`${enrollment.businessName} - Phase 2 Analysis`}
        funnelStages={funnelStages}
        kpis={kpis}
        teamRoles={enrollment.teamData?.roles}
        teamConnections={enrollment.teamData?.connections}
      />

      <div className="insight-box bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-bold text-blue-900">Your Insights</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          {funnelStages && (
            <>
              <li>
                • Funnel drop-off:
                {funnelStages[1]?.percentage
                  ? ` ${(100 - funnelStages[1].percentage).toFixed(1)}%`
                  : " N/A"}
                {" at the Leads stage"}
              </li>
              <li>• Consider A/B testing your top-of-funnel messaging to improve lead quality</li>
            </>
          )}
          {enrollment.teamData?.roles && (
            <li>• You have {enrollment.teamData.roles.length} defined roles - delegate more tasks</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * INTEGRATION PATTERN 3: Lesson Submission & Review
 * ============================================================================
 *
 * Use case: Student completes lesson, submits funnel/metrics. Coach reviews and provides feedback.
 * Context: /programme/lesson/[id]/submit → Coach /coaching/review/[submissionId]
 * Data flow: Student submission → Visual for comparison → Coach feedback annotations
 */

export interface LessonSubmission {
  id: string;
  studentId: string;
  businessName: string;
  submittedAt: Date;
  funnelStages: FunnelStage[];
  splitTests?: SplitTestVariant[];
  kpis: KPIMetric[];
  teamRoles: TeamRole[];
  notes?: string;
}

export function StudentLessonSubmissionView({
  submission,
}: {
  submission: LessonSubmission;
}) {
  return (
    <div className="submission-view space-y-6">
      <div className="submission-header bg-gray-50 p-4 rounded">
        <h1>
          Lesson Submission Review: {submission.businessName}
        </h1>
        <p className="text-sm text-gray-600">
          Submitted on {submission.submittedAt.toLocaleDateString()}
        </p>
      </div>

      {/* Show submitted data */}
      <Phase2LessonVisuals
        title="Student Submission - Phase 2 Analysis"
        funnelStages={submission.funnelStages}
        splitTests={submission.splitTests}
        kpis={submission.kpis}
        teamRoles={submission.teamRoles}
      />

      {/* Coach can add feedback here */}
      <div className="coach-feedback bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="font-bold text-yellow-900">Coach Feedback</h3>
        <textarea
          className="mt-2 w-full p-2 border rounded text-sm"
          rows={4}
          placeholder="Enter feedback for the student..."
          defaultValue={
            submission.notes
              ? `Notes: ${submission.notes}\n\nFeedback:\n- Review your funnel drop-off percentages\n- Consider testing headline variations`
              : ""
          }
        />
      </div>

      <div className="submission-actions space-x-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Request Revision
        </button>
        <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Approve & Progress
        </button>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * INTEGRATION PATTERN 4: Before/After Comparison
 * ============================================================================
 *
 * Use case: Student completes optimization and resubmits. Show before/after impact.
 * Context: Coach dashboard / student progress view
 * Data flow: Previous submission → Current submission → Side-by-side visualization
 */

export function BeforeAfterComparison({
  before,
  after,
}: {
  before: LessonSubmission;
  after: LessonSubmission;
}) {
  // Calculate improvements
  const conversionBefore = before.kpis.find((k) => k.label.includes("Conversion"))?.value;
  const conversionAfter = after.kpis.find((k) => k.label.includes("Conversion"))?.value;

  const revenueBefore = before.kpis.find((k) => k.label.includes("Revenue"))?.value;
  const revenueAfter = after.kpis.find((k) => k.label.includes("Revenue"))?.value;

  return (
    <div className="comparison-view space-y-8">
      <div className="comparison-header">
        <h1>Phase 2 Progress: {before.businessName}</h1>
        <p className="text-gray-600">Before and after optimization</p>
      </div>

      {/* Improvement summary */}
      <div className="improvement-summary grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="metric-card bg-green-50 p-4 rounded border border-green-200">
          <div className="text-sm text-green-700 font-semibold">Conversion Rate</div>
          <div className="text-xl font-bold text-green-900 mt-2">
            {conversionBefore} → {conversionAfter}
          </div>
        </div>
        <div className="metric-card bg-green-50 p-4 rounded border border-green-200">
          <div className="text-sm text-green-700 font-semibold">Monthly Revenue</div>
          <div className="text-xl font-bold text-green-900 mt-2">
            {revenueBefore} → {revenueAfter}
          </div>
        </div>
        <div className="metric-card bg-blue-50 p-4 rounded border border-blue-200">
          <div className="text-sm text-blue-700 font-semibold">Team Size</div>
          <div className="text-xl font-bold text-blue-900 mt-2">
            {before.teamRoles.length} → {after.teamRoles.length} roles
          </div>
        </div>
        <div className="metric-card bg-purple-50 p-4 rounded border border-purple-200">
          <div className="text-sm text-purple-700 font-semibold">Days to Complete</div>
          <div className="text-xl font-bold text-purple-900 mt-2">
            {Math.round(
              (after.submittedAt.getTime() - before.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
            )}{" "}
            days
          </div>
        </div>
      </div>

      {/* Side-by-side visuals */}
      <div className="comparison-grid grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-bold mb-4 text-gray-700">Before Optimization</h3>
          <Phase2LessonVisuals
            funnelStages={before.funnelStages}
            kpis={before.kpis}
            showTeam={false}
          />
        </div>
        <div>
          <h3 className="text-lg font-bold mb-4 text-gray-700">After Optimization</h3>
          <Phase2LessonVisuals
            funnelStages={after.funnelStages}
            kpis={after.kpis}
            showTeam={false}
          />
        </div>
      </div>

      {/* Key changes */}
      <div className="key-changes bg-blue-50 p-6 rounded border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-4">Key Changes Made</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Optimized landing page CTA - increased click-through by 15%</li>
          <li>✓ Implemented email nurture sequence - improved lead conversion by 8%</li>
          <li>✓ Delegated support to junior team member - freed up 20 hours/week</li>
          <li>✓ Automated invoice generation - reduced administrative time by 25%</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * INTEGRATION PATTERN 5: Coach Dashboard - Multiple Students
 * ============================================================================
 *
 * Use case: Coach views all students' Phase 2 progress at a glance
 * Context: /coaching/cohort/[id]/progress
 * Data flow: Multiple enrollments → Individual visual components in a list
 */

export function CoachCohortDashboard({
  enrollments,
}: {
  enrollments: EnrollmentData[];
}) {
  return (
    <div className="coach-dashboard space-y-8">
      <div className="dashboard-header">
        <h1>Phase 2 Progress - Cohort Overview</h1>
        <p className="text-gray-600">
          {enrollments.length} students actively working on IMPLEMENT chapter
        </p>
      </div>

      {/* Summary stats */}
      <div className="summary-stats grid grid-cols-3 gap-4">
        <div className="stat bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Students in Phase 2</div>
          <div className="text-3xl font-bold text-gray-900">{enrollments.length}</div>
        </div>
        <div className="stat bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Avg. Conversion Rate</div>
          <div className="text-3xl font-bold text-gray-900">
            {(
              enrollments.reduce((sum, e) => {
                const conv = e.kpis?.conversionRate ?? 0;
                return sum + (typeof conv === "number" ? conv : 0);
              }, 0) / enrollments.length
            ).toFixed(1)}
            %
          </div>
        </div>
        <div className="stat bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Avg. Monthly Revenue</div>
          <div className="text-3xl font-bold text-gray-900">
            $
            {Math.round(
              enrollments.reduce((sum, e) => sum + (e.kpis?.monthlyRevenue ?? 0), 0) /
                enrollments.length
            ).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Individual student cards */}
      <div className="students-grid space-y-6">
        {enrollments.map((enrollment) => (
          <div key={enrollment.enrollmentId} className="student-card border rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">{enrollment.businessName}</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Phase 2 - Active
              </span>
            </div>

            {/* Show student's visuals (condensed) */}
            <div className="visuals-preview mb-4">
              <Phase2LessonVisuals
                funnelStages={
                  enrollment.funnelMetrics
                    ? [
                        {
                          name: "Visitors",
                          value: enrollment.funnelMetrics.visitors,
                          percentage: 100,
                        },
                        {
                          name: "Customers",
                          value: enrollment.funnelMetrics.customers,
                          percentage:
                            (enrollment.funnelMetrics.customers /
                              enrollment.funnelMetrics.visitors) *
                            100,
                        },
                      ]
                    : undefined
                }
                kpis={
                  enrollment.kpis
                    ? [
                        {
                          label: "Revenue",
                          value: `$${enrollment.kpis.monthlyRevenue}`,
                        },
                        { label: "Conversion", value: `${enrollment.kpis.conversionRate}%` },
                      ]
                    : undefined
                }
                showTeam={false}
              />
            </div>

            {/* Action buttons */}
            <div className="student-actions space-x-2">
              <button className="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                Review Submission
              </button>
              <button className="text-sm px-3 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100">
                Send Feedback
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  LessonPageStatic,
  LessonWithStudentData,
  StudentLessonSubmissionView,
  BeforeAfterComparison,
  CoachCohortDashboard,
};
