"use client";
/**
 * Phase2LessonVisuals — Phase 2 lesson component (IMPLEMENT chapter)
 *
 * Three integrated visuals teaching core business implementation concepts:
 * 1. Funnel Optimization: Conversion funnel with drop-off analysis + split test comparison
 * 2. Dashboard Visuals: KPI cards + trend comparison (revenue, conversion, CAC)
 * 3. Team Structure: Org chart with role responsibilities + delegation matrix
 *
 * SVG-based (scalable, no images), Tailwind + ONEVYRT design tokens,
 * dark mode support, responsive (768px/1024px breakpoints), smooth animations.
 *
 * Self-scoped with "p2v-" prefix. Purely presentational; data flows in via props.
 * Supports conditional rendering of individual visuals via `showFunnel`, `showDashboard`, `showTeam`.
 */

/**
 * Stage in the sales/marketing funnel
 */
export interface FunnelStage {
  name: string;
  value: number; // Count of people at this stage
  percentage?: number; // Calculated as percentage of initial
}

/**
 * Split test variant (A/B test comparison)
 */
export interface SplitTestVariant {
  name: string; // "Variant A" or "Variant B"
  conversionRate: number; // 0-100
  visitors: number;
  conversions: number;
  revenue?: number;
}

/**
 * KPI metric for dashboard
 */
export interface KPIMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral"; // Direction indicator
  change?: number; // Percentage change
}

/**
 * Role in org chart
 */
export interface TeamRole {
  id: string;
  title: string;
  person?: string; // Name of person in role
  responsibilities: string[];
  level?: "senior" | "mid" | "junior"; // For hierarchical placement
}

/**
 * Connection in org chart (who reports to whom)
 */
export interface TeamConnection {
  from: string; // Role ID
  to: string; // Reports to Role ID
}

export interface Phase2LessonVisualsProps {
  /** Data for Funnel Optimization */
  funnelStages?: FunnelStage[];
  splitTests?: SplitTestVariant[];

  /** Data for Dashboard */
  kpis?: KPIMetric[];

  /** Data for Team Structure */
  teamRoles?: TeamRole[];
  teamConnections?: TeamConnection[];

  /** Optional title/heading */
  title?: string;

  /** Container class name */
  className?: string;

  /** Show/hide individual visuals */
  showFunnel?: boolean;
  showDashboard?: boolean;
  showTeam?: boolean;
}

/**
 * Demo data: typical SaaS funnel, split test, KPIs, and team structure
 */
const DEMO_FUNNEL_STAGES: FunnelStage[] = [
  { name: "Visitors", value: 10000, percentage: 100 },
  { name: "Leads", value: 1200, percentage: 12 },
  { name: "Qualified", value: 480, percentage: 4.8 },
  { name: "Proposal", value: 240, percentage: 2.4 },
  { name: "Customers", value: 72, percentage: 0.72 },
];

const DEMO_SPLIT_TESTS: SplitTestVariant[] = [
  {
    name: "Variant A (Control)",
    conversionRate: 8.5,
    visitors: 5000,
    conversions: 425,
    revenue: 10625,
  },
  {
    name: "Variant B (New CTA)",
    conversionRate: 12.3,
    visitors: 5000,
    conversions: 615,
    revenue: 15375,
  },
];

const DEMO_KPIS: KPIMetric[] = [
  { label: "Monthly Revenue", value: "$42,500", trend: "up", change: 18.5 },
  { label: "Conversion Rate", value: "3.2%", trend: "up", change: 0.8 },
  { label: "Customer Acquisition Cost", value: "$245", trend: "down", change: -12 },
  { label: "Average Order Value", value: "$590", trend: "neutral", change: 0 },
];

const DEMO_TEAM_ROLES: TeamRole[] = [
  {
    id: "ceo",
    title: "CEO / Founder",
    person: "Sarah",
    responsibilities: ["Overall strategy", "Key client relationships", "Board reporting"],
    level: "senior",
  },
  {
    id: "ops",
    title: "Operations Manager",
    person: "James",
    responsibilities: ["Daily operations", "Team coordination", "Process improvement"],
    level: "mid",
  },
  {
    id: "sales",
    title: "Sales Lead",
    person: "Marcus",
    responsibilities: ["Lead qualification", "Closing deals", "Client onboarding"],
    level: "mid",
  },
  {
    id: "marketing",
    title: "Marketing Specialist",
    person: "Emma",
    responsibilities: ["Lead generation", "Campaign management", "Content creation"],
    level: "junior",
  },
  {
    id: "support",
    title: "Customer Support",
    person: "Alex",
    responsibilities: ["Customer success", "Issue resolution", "Feedback collection"],
    level: "junior",
  },
];

const DEMO_TEAM_CONNECTIONS: TeamConnection[] = [
  { from: "ops", to: "ceo" },
  { from: "sales", to: "ceo" },
  { from: "marketing", to: "ops" },
  { from: "support", to: "ops" },
];

/**
 * FunnelOptimization: Sales/marketing funnel with drop-off + split test comparison
 */
function FunnelOptimization({
  stages = DEMO_FUNNEL_STAGES,
  splitTests = DEMO_SPLIT_TESTS,
}: {
  stages: FunnelStage[];
  splitTests: SplitTestVariant[];
}) {
  const WIDTH = 420;
  const HEIGHT = 400;
  const PADDING = 20;

  // Calculate drop-off percentages
  const funnelWithDropoff = stages.map((stage, i) => {
    if (i === 0) return { ...stage, dropoff: 0 };
    const prevValue = stages[i - 1]!.value;
    const dropoff = ((prevValue - stage.value) / prevValue) * 100;
    return { ...stage, dropoff };
  });

  return (
    <div className="p2v-funnel-container">
      <h3 className="p2v-visual-title">Sales Funnel & Drop-off</h3>

      {/* Funnel SVG */}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="p2v-funnel-svg">
        {funnelWithDropoff.map((stage, i) => {
          const progress = (stage.percentage ?? 0) / 100;
          const baseWidth = WIDTH - 2 * PADDING;
          const stageWidth = baseWidth * progress;
          const x = (WIDTH - stageWidth) / 2;
          const y = PADDING + i * 60;
          const nextProgress = (funnelWithDropoff[i + 1]?.percentage ?? 50) / 100;
          const nextStageWidth = baseWidth * nextProgress;
          const nextX = (WIDTH - nextStageWidth) / 2;

          const colors = [
            "var(--ds-chapter-define)",
            "var(--ds-chapter-implement)",
            "var(--ds-chapter-control)",
            "var(--ds-chapter-improve)",
            "var(--ds-brand)",
          ];

          return (
            <g key={i} className="p2v-funnel-stage" style={{ animationDelay: `${i * 0.12}s` }}>
              {/* Trapezoid */}
              <path
                d={`M ${x} ${y} L ${x + stageWidth} ${y} L ${nextX + nextStageWidth} ${y + 50} L ${nextX} ${y + 50} Z`}
                fill={colors[i % colors.length]}
                opacity="0.15"
                stroke={colors[i % colors.length]}
                strokeWidth="2"
              />
              {/* Stage label */}
              <text x={WIDTH / 2} y={y + 20} textAnchor="middle" className="p2v-funnel-stage-label">
                {stage.name}
              </text>
              {/* Count */}
              <text x={WIDTH / 2} y={y + 36} textAnchor="middle" className="p2v-funnel-count">
                {stage.value.toLocaleString()} ({stage.percentage}%)
              </text>
              {/* Drop-off */}
              {i > 0 && (
                <text x={WIDTH / 2} y={y + 50} textAnchor="middle" className="p2v-funnel-dropoff">
                  {stage.dropoff.toFixed(1)}% drop
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Split Test Comparison */}
      <div className="p2v-split-test-section">
        <h4 className="p2v-split-test-title">A/B Test Results</h4>
        <div className="p2v-test-grid">
          {splitTests.map((test, i) => (
            <div key={i} className="p2v-test-card">
              <div className="p2v-test-label">{test.name}</div>
              <div className="p2v-test-metric">
                <span className="p2v-test-value">{test.conversionRate.toFixed(1)}%</span>
                <span className="p2v-test-unit">conversion</span>
              </div>
              <div className="p2v-test-details">
                <div>{test.visitors.toLocaleString()} visitors</div>
                <div>{test.conversions} conversions</div>
                {test.revenue && <div>${test.revenue.toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * DashboardVisuals: KPI cards + trend comparison
 */
function DashboardVisuals({ kpis = DEMO_KPIS }: { kpis: KPIMetric[] }) {
  return (
    <div className="p2v-dashboard-container">
      <h3 className="p2v-visual-title">Key Performance Indicators</h3>

      <div className="p2v-kpi-grid">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="p2v-kpi-card"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <div className="p2v-kpi-label">{kpi.label}</div>
            <div className="p2v-kpi-value">{kpi.value}</div>
            {kpi.unit && <div className="p2v-kpi-unit">{kpi.unit}</div>}
            {kpi.change !== undefined && kpi.change !== 0 && (
              <div className={`p2v-kpi-trend p2v-trend-${kpi.trend}`}>
                <span className="p2v-trend-arrow">
                  {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→"}
                </span>
                <span className="p2v-trend-value">
                  {Math.abs(kpi.change)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mini trend visualization */}
      <div className="p2v-trend-visualization">
        <div className="p2v-trend-header">30-Day Trend</div>
        <svg viewBox="0 0 300 80" className="p2v-trend-chart">
          <defs>
            <linearGradient id="p2v-trend-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--ds-brand)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--ds-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Sample trend line */}
          <polyline
            points="10,70 40,60 70,55 100,50 130,48 160,45 190,42 220,35 250,20 280,15"
            fill="none"
            stroke="var(--ds-brand)"
            strokeWidth="2"
          />
          {/* Gradient fill */}
          <polygon
            points="10,70 40,60 70,55 100,50 130,48 160,45 190,42 220,35 250,20 280,15 280,80 10,80"
            fill="url(#p2v-trend-gradient)"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * TeamStructure: Org chart + role responsibilities
 */
function TeamStructure({
  roles = DEMO_TEAM_ROLES,
}: {
  roles: TeamRole[];
  connections: TeamConnection[];
}) {
  // Build a simple hierarchical layout
  const seniorRoles = roles.filter((r) => r.level === "senior");
  const midRoles = roles.filter((r) => r.level === "mid");
  const juniorRoles = roles.filter((r) => r.level === "junior");

  return (
    <div className="p2v-team-container">
      <h3 className="p2v-visual-title">Team Structure</h3>

      {/* Org Chart Visualization */}
      <div className="p2v-org-chart">
        {/* Senior level (CEO) */}
        {seniorRoles.map((role, i) => (
          <div
            key={role.id}
            className="p2v-org-level"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="p2v-role-card p2v-role-senior">
              <div className="p2v-role-title">{role.title}</div>
              {role.person && <div className="p2v-role-person">{role.person}</div>}
            </div>
          </div>
        ))}

        {/* Mid level */}
        <div className="p2v-org-level-group">
          {midRoles.map((role, i) => (
            <div
              key={role.id}
              className="p2v-org-level"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              <div className="p2v-role-card p2v-role-mid">
                <div className="p2v-role-title">{role.title}</div>
                {role.person && <div className="p2v-role-person">{role.person}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Junior level */}
        <div className="p2v-org-level-group">
          {juniorRoles.map((role, i) => (
            <div
              key={role.id}
              className="p2v-org-level"
              style={{ animationDelay: `${0.6 + i * 0.1}s` }}
            >
              <div className="p2v-role-card p2v-role-junior">
                <div className="p2v-role-title">{role.title}</div>
                {role.person && <div className="p2v-role-person">{role.person}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Responsibilities Matrix */}
      <div className="p2v-responsibilities">
        <div className="p2v-resp-header">Role Responsibilities</div>
        {roles.slice(0, 3).map((role) => (
          <div key={role.id} className="p2v-resp-item">
            <div className="p2v-resp-title">
              {role.title}
              {role.person && <span className="p2v-resp-person">{role.person}</span>}
            </div>
            <ul className="p2v-resp-list">
              {role.responsibilities.map((resp, i) => (
                <li key={i}>{resp}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main component: Phase2LessonVisuals
 * Combines all three visuals in a responsive layout with conditional rendering
 */
export function Phase2LessonVisuals({
  funnelStages = DEMO_FUNNEL_STAGES,
  splitTests = DEMO_SPLIT_TESTS,
  kpis = DEMO_KPIS,
  teamRoles = DEMO_TEAM_ROLES,
  teamConnections = DEMO_TEAM_CONNECTIONS,
  title,
  className = "",
  showFunnel = true,
  showDashboard = true,
  showTeam = true,
}: Phase2LessonVisualsProps) {
  return (
    <div className={["p2v-root", className].filter(Boolean).join(" ")}>
      <style>{CSS}</style>

      {title && <h2 className="p2v-heading">{title}</h2>}

      <div className="p2v-grid">
        {showFunnel && (
          <FunnelOptimization stages={funnelStages} splitTests={splitTests} />
        )}
        {showDashboard && (
          <DashboardVisuals kpis={kpis} />
        )}
        {showTeam && (
          <TeamStructure roles={teamRoles} connections={teamConnections} />
        )}
      </div>
    </div>
  );
}

/**
 * CSS: All styles scoped to "p2v-" prefix
 * Includes dark mode support via CSS custom properties (--ds-* tokens)
 * Responsive design: adapts at 768px and 1024px breakpoints
 * Smooth animations on component load
 */
const CSS = `
.p2v-root {
  --p2v-text: var(--ds-text-primary);
  --p2v-text-soft: var(--ds-text-secondary);
  --p2v-text-muted: var(--ds-text-tertiary);
  --p2v-border: var(--ds-border-subtle);
  --p2v-bg: var(--ds-surface);
  --p2v-bg-soft: var(--ds-bg-subtle);
  font-family: var(--ds-font, system-ui, -apple-system, Segoe UI, sans-serif);
  color: var(--p2v-text);
  line-height: 1.5;
}

.p2v-root * {
  box-sizing: border-box;
}

/* Heading */
.p2v-heading {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 28px;
  color: var(--p2v-text);
  letter-spacing: -0.5px;
}

/* Main grid: responsive layout */
.p2v-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
  margin-bottom: 16px;
}

@media (max-width: 1024px) {
  .p2v-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .p2v-heading {
    font-size: 22px;
    margin-bottom: 20px;
  }
  .p2v-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* =========== FUNNEL OPTIMIZATION =========== */
.p2v-funnel-container {
  background: var(--p2v-bg);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

.p2v-visual-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--p2v-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.p2v-funnel-svg {
  width: 100%;
  height: auto;
  max-width: 420px;
  margin: 0 auto;
  display: block;
  margin-bottom: 20px;
}

.p2v-funnel-stage {
  opacity: 0;
  animation: p2v-fade-in-down 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.p2v-funnel-stage-label {
  font-size: 13px;
  font-weight: 700;
  fill: var(--p2v-text);
}

.p2v-funnel-count {
  font-size: 11px;
  fill: var(--p2v-text-soft);
  font-weight: 600;
}

.p2v-funnel-dropoff {
  font-size: 10px;
  fill: var(--ds-warning);
  font-weight: 600;
}

/* Split test section */
.p2v-split-test-section {
  border-top: 1px solid var(--p2v-border);
  padding-top: 16px;
  margin-top: 16px;
}

.p2v-split-test-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--p2v-text-muted);
  margin-bottom: 12px;
}

.p2v-test-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.p2v-test-card {
  background: var(--p2v-bg-soft);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-sm);
  padding: 12px;
  text-align: center;
}

.p2v-test-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p2v-text-soft);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.2px;
}

.p2v-test-metric {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.p2v-test-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--ds-brand);
}

.p2v-test-unit {
  font-size: 11px;
  color: var(--p2v-text-soft);
  font-weight: 500;
}

.p2v-test-details {
  font-size: 10px;
  color: var(--p2v-text-soft);
  line-height: 1.4;
}

/* =========== DASHBOARD VISUALS =========== */
.p2v-dashboard-container {
  background: var(--p2v-bg);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

.p2v-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .p2v-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.p2v-kpi-card {
  background: var(--p2v-bg-soft);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-sm);
  padding: 16px;
  text-align: center;
  opacity: 0;
  animation: p2v-fade-in-scale 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.p2v-kpi-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--p2v-text-muted);
  margin-bottom: 8px;
}

.p2v-kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--ds-brand);
  margin-bottom: 4px;
}

.p2v-kpi-unit {
  font-size: 11px;
  color: var(--p2v-text-soft);
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
}

.p2v-kpi-trend {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.p2v-trend-up {
  color: var(--ds-success);
}

.p2v-trend-down {
  color: var(--ds-warning);
}

.p2v-trend-neutral {
  color: var(--p2v-text-soft);
}

.p2v-trend-arrow {
  font-size: 14px;
  font-weight: 700;
}

.p2v-trend-visualization {
  background: var(--p2v-bg-soft);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-sm);
  padding: 12px;
}

.p2v-trend-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--p2v-text-muted);
  margin-bottom: 8px;
}

.p2v-trend-chart {
  width: 100%;
  height: auto;
  max-width: 300px;
  margin: 0 auto;
  display: block;
}

/* =========== TEAM STRUCTURE =========== */
.p2v-team-container {
  background: var(--p2v-bg);
  border: 1px solid var(--p2v-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

.p2v-org-chart {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--p2v-border);
}

.p2v-org-level {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  opacity: 0;
  animation: p2v-fade-in-up 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.p2v-org-level-group {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.p2v-role-card {
  border-radius: var(--ds-radius-md);
  padding: 12px 16px;
  text-align: center;
  min-width: 120px;
  border: 2px solid var(--p2v-border);
}

.p2v-role-senior {
  background: var(--ds-chapter-define);
  opacity: 0.2;
  border-color: var(--ds-chapter-define);
}

.p2v-role-mid {
  background: var(--ds-chapter-implement);
  opacity: 0.15;
  border-color: var(--ds-chapter-implement);
}

.p2v-role-junior {
  background: var(--ds-chapter-control);
  opacity: 0.15;
  border-color: var(--ds-chapter-control);
}

.p2v-role-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p2v-text);
  margin-bottom: 4px;
}

.p2v-role-person {
  font-size: 11px;
  color: var(--p2v-text-soft);
  font-weight: 500;
  display: block;
}

/* Responsibilities section */
.p2v-responsibilities {
  background: var(--p2v-bg-soft);
  border-radius: var(--ds-radius-sm);
  padding: 12px;
}

.p2v-resp-header {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--p2v-text-muted);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--p2v-border);
}

.p2v-resp-item {
  margin-bottom: 12px;
}

.p2v-resp-item:last-child {
  margin-bottom: 0;
}

.p2v-resp-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p2v-text);
  margin-bottom: 6px;
}

.p2v-resp-person {
  font-size: 10px;
  color: var(--p2v-text-soft);
  font-weight: 500;
  margin-left: 6px;
}

.p2v-resp-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.p2v-resp-list li {
  font-size: 11px;
  color: var(--p2v-text-soft);
  margin-bottom: 4px;
  padding-left: 16px;
  position: relative;
  line-height: 1.4;
}

.p2v-resp-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--ds-chapter-implement);
  font-weight: 700;
}

/* =========== ANIMATIONS =========== */
@keyframes p2v-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes p2v-fade-in-down {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes p2v-fade-in-scale {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Dark mode: CSS custom properties already handle this */
/* The --ds-* tokens automatically switch in dark mode */
`;

export default Phase2LessonVisuals;
