"use client";
/**
 * BusinessDefinitionVisuals — Phase 1 lesson component (DEFINE chapter)
 *
 * Three integrated visuals teaching core business definition concepts:
 * 1. Positioning Map: 2D plot (Price × Premium/Budget) with competitor placement
 * 2. Value Ladder: 5-level pyramid (Lead Magnet → Frontend → Core → Backend → Upsell)
 * 3. Customer Avatar: Icon + demographics + pain points callout
 *
 * SVG-based (scalable, no images), Tailwind + ONEVYRT design tokens,
 * dark mode support, responsive (768px/1024px breakpoints), smooth animations.
 *
 * Self-scoped with "bdv-" prefix. Purely presentational; data flows in via props.
 */

/**
 * Competitor position in the Positioning Map
 */
export interface CompetitorPosition {
  name: string;
  priceScore: number; // 0-100, 0=budget, 100=premium pricing
  positionScore: number; // 0-100, 0=budget, 100=premium positioning
  size?: "sm" | "md" | "lg"; // bubble size, default "md"
}

/**
 * Rung on the Value Ladder
 */
export interface LadderRung {
  stage: "lead" | "frontend" | "core" | "backend" | "upsell";
  name: string;
  description?: string;
  price?: string | number;
}

/**
 * Customer Avatar definition
 */
export interface CustomerAvatar {
  name: string;
  role?: string;
  ageRange?: string;
  incomeLevel?: string;
  painPoints: string[];
  desiredOutcome?: string;
}

export interface BusinessDefinitionVisualsProps {
  /** Data for Positioning Map */
  competitors?: CompetitorPosition[];
  yourPosition?: {
    priceScore: number;
    positionScore: number;
  };

  /** Data for Value Ladder */
  ladder?: LadderRung[];

  /** Data for Customer Avatar */
  avatar?: CustomerAvatar;

  /** Optional title/heading */
  title?: string;

  /** Container class name */
  className?: string;
}

/**
 * Demo data: typical SaaS positioning, value ladder, and B2B customer avatar
 */
const DEMO_COMPETITORS: CompetitorPosition[] = [
  { name: "Budget Competitor", priceScore: 20, positionScore: 15, size: "sm" },
  { name: "Mid-Market Player", priceScore: 55, positionScore: 50, size: "md" },
  { name: "Premium Leader", priceScore: 85, positionScore: 90, size: "lg" },
];

const DEMO_YOUR_POSITION = { priceScore: 60, positionScore: 75 };

const DEMO_LADDER: LadderRung[] = [
  { stage: "lead", name: "Lead Magnet", description: "Free template/guide", price: "Free" },
  { stage: "frontend", name: "Frontend Offer", description: "Low-ticket entry", price: "$97" },
  { stage: "core", name: "Core Offer", description: "Main product/service", price: "$5k–$25k" },
  { stage: "backend", name: "Backend Offer", description: "High-ticket done-for-you", price: "$50k+" },
  { stage: "upsell", name: "Upsell", description: "Annual premium support", price: "$200/mo" },
];

const DEMO_AVATAR: CustomerAvatar = {
  name: "Sarah",
  role: "Small Business Owner",
  ageRange: "35–50",
  incomeLevel: "£50k–£120k annual revenue",
  painPoints: [
    "Unclear how to price services",
    "Losing leads in the sales funnel",
    "No systematic way to track metrics",
  ],
  desiredOutcome: "A documented, systemized business model with predictable revenue",
};

/**
 * PositioningMap: 2D scatter plot with axes (Price × Premium/Budget positioning)
 */
function PositioningMap({
  competitors = DEMO_COMPETITORS,
  yourPosition = DEMO_YOUR_POSITION,
}: {
  competitors: CompetitorPosition[];
  yourPosition: { priceScore: number; positionScore: number };
}) {
  const WIDTH = 400;
  const HEIGHT = 350;
  const PADDING = 40;
  const PLOT_WIDTH = WIDTH - 2 * PADDING;
  const PLOT_HEIGHT = HEIGHT - 2 * PADDING;

  const mapScore = (score: number, min: number, max: number) =>
    PADDING + (score / 100) * (max - min);

  return (
    <div className="bdv-map-container">
      <h3 className="bdv-visual-title">Market Positioning</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bdv-map-svg">
        {/* Grid background */}
        <defs>
          <pattern
            id="map-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${PADDING}, ${PADDING})`}
          >
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--ds-border-subtle)" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect x={PADDING} y={PADDING} width={PLOT_WIDTH} height={PLOT_HEIGHT} fill="url(#map-grid)" />

        {/* Axes */}
        <line x1={PADDING} y1={PADDING + PLOT_HEIGHT} x2={WIDTH - PADDING} y2={PADDING + PLOT_HEIGHT} stroke="var(--ds-border-default)" strokeWidth="2" />
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={PADDING + PLOT_HEIGHT} stroke="var(--ds-border-default)" strokeWidth="2" />

        {/* Axis labels */}
        <text x={WIDTH / 2} y={HEIGHT - 8} textAnchor="middle" className="bdv-axis-label">
          Price Level
        </text>
        <text x={16} y={HEIGHT / 2} textAnchor="middle" className="bdv-axis-label" transform={`rotate(-90, 16, ${HEIGHT / 2})`}>
          Premium Positioning
        </text>

        {/* Axis values */}
        <text x={PADDING - 8} y={PADDING + PLOT_HEIGHT + 4} textAnchor="end" className="bdv-axis-tick">
          Budget
        </text>
        <text x={WIDTH - PADDING + 8} y={PADDING + PLOT_HEIGHT + 4} textAnchor="start" className="bdv-axis-tick">
          Premium
        </text>
        <text x={PADDING - 8} y={PADDING + 4} textAnchor="end" className="bdv-axis-tick">
          Premium
        </text>
        <text x={PADDING - 8} y={PADDING + PLOT_HEIGHT + 4} textAnchor="end" className="bdv-axis-tick">
          Budget
        </text>

        {/* Competitors */}
        {competitors.map((comp, i) => {
          const x = mapScore(comp.priceScore, PADDING, WIDTH - PADDING);
          const y = mapScore(comp.positionScore, PADDING + PLOT_HEIGHT, PADDING);
          const sizeMap = { sm: 16, md: 24, lg: 32 };
          const r = (sizeMap[comp.size || "md"] ?? 24) / 2;

          return (
            <g key={i} className="bdv-competitor" style={{ animationDelay: `${i * 0.1}s` }}>
              <circle cx={x} cy={y} r={r} fill="var(--ds-chapter-define)" opacity="0.15" />
              <circle cx={x} cy={y} r={r} fill="none" stroke="var(--ds-chapter-define)" strokeWidth="2" />
              <text x={x} y={y + r + 18} textAnchor="middle" className="bdv-competitor-label">
                {comp.name}
              </text>
            </g>
          );
        })}

        {/* Your position (highlight) */}
        {yourPosition && (
          <g className="bdv-your-position" style={{ animationDelay: "0.3s" }}>
            <circle
              cx={mapScore(yourPosition.priceScore, PADDING, WIDTH - PADDING)}
              cy={mapScore(yourPosition.positionScore, PADDING + PLOT_HEIGHT, PADDING)}
              r={12}
              fill="var(--ds-brand)"
              opacity="0.8"
            />
            <circle
              cx={mapScore(yourPosition.priceScore, PADDING, WIDTH - PADDING)}
              cy={mapScore(yourPosition.positionScore, PADDING + PLOT_HEIGHT, PADDING)}
              r={12}
              fill="none"
              stroke="var(--ds-brand)"
              strokeWidth="2.5"
              className="bdv-pulse"
            />
            <text
              x={mapScore(yourPosition.priceScore, PADDING, WIDTH - PADDING)}
              y={mapScore(yourPosition.positionScore, PADDING + PLOT_HEIGHT, PADDING) - 22}
              textAnchor="middle"
              className="bdv-your-label"
            >
              You
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * ValueLadder: 5-level pyramid (Lead Magnet → Frontend → Core → Backend → Upsell)
 */
function ValueLadder({ ladder = DEMO_LADDER }: { ladder: LadderRung[] }) {
  const levels = ladder.slice(0, 5); // Ensure exactly 5 rungs
  const WIDTH = 400;
  const HEIGHT = 380;
  const BASE_Y = HEIGHT - 40;

  // Pyramid widths (widest at bottom)
  const widths = [280, 220, 160, 100, 60];
  const colors = [
    "var(--ds-chapter-start)",
    "var(--ds-chapter-define)",
    "var(--ds-chapter-implement)",
    "var(--ds-chapter-control)",
    "var(--ds-chapter-improve)",
  ];

  return (
    <div className="bdv-ladder-container">
      <h3 className="bdv-visual-title">Value Ladder</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bdv-ladder-svg">
        {/* Pyramid levels */}
        {levels.map((rung, i) => {
          const levelWidth = widths[i]!;
          const x = (WIDTH - levelWidth) / 2;
          const y = BASE_Y - (i + 1) * 60;
          const nextWidth = widths[i + 1] ?? levelWidth * 0.6;
          const nextX = (WIDTH - nextWidth) / 2;
          const nextY = y - 60;

          return (
            <g key={i} className="bdv-rung" style={{ animationDelay: `${i * 0.15}s` }}>
              {/* Trapezoid shape */}
              <path
                d={`M ${x} ${y} L ${x + levelWidth} ${y} L ${nextX + nextWidth} ${nextY} L ${nextX} ${nextY} Z`}
                fill={colors[i]}
                opacity="0.2"
                stroke={colors[i]}
                strokeWidth="2"
              />
              {/* Rung label */}
              <text x={WIDTH / 2} y={y - 15} textAnchor="middle" className="bdv-rung-title">
                {rung.name}
              </text>
              {rung.description && (
                <text x={WIDTH / 2} y={y - 2} textAnchor="middle" className="bdv-rung-desc">
                  {rung.description}
                </text>
              )}
              {rung.price && (
                <text x={WIDTH / 2} y={y + 12} textAnchor="middle" className="bdv-rung-price">
                  {rung.price}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * CustomerAvatar: Icon + demographics + pain points
 */
function CustomerAvatar({ avatar = DEMO_AVATAR }: { avatar: CustomerAvatar }) {
  return (
    <div className="bdv-avatar-container">
      <h3 className="bdv-visual-title">Your Customer Avatar</h3>

      {/* Avatar icon (styled circle with initials) */}
      <div className="bdv-avatar-icon">
        <div className="bdv-avatar-circle">
          {avatar.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Demographics */}
      <div className="bdv-avatar-content">
        <div className="bdv-avatar-name">{avatar.name}</div>
        {avatar.role && <div className="bdv-avatar-role">{avatar.role}</div>}

        <div className="bdv-avatar-demos">
          {avatar.ageRange && (
            <div className="bdv-demo-row">
              <span className="bdv-demo-label">Age:</span>
              <span className="bdv-demo-value">{avatar.ageRange}</span>
            </div>
          )}
          {avatar.incomeLevel && (
            <div className="bdv-demo-row">
              <span className="bdv-demo-label">Income:</span>
              <span className="bdv-demo-value">{avatar.incomeLevel}</span>
            </div>
          )}
        </div>

        {/* Pain points */}
        {avatar.painPoints.length > 0 && (
          <div className="bdv-pain-points">
            <div className="bdv-pain-label">Pain Points</div>
            <ul className="bdv-pain-list">
              {avatar.painPoints.map((point, i) => (
                <li key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Desired outcome */}
        {avatar.desiredOutcome && (
          <div className="bdv-outcome">
            <div className="bdv-outcome-label">Desired Outcome</div>
            <p className="bdv-outcome-text">{avatar.desiredOutcome}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main component: BusinessDefinitionVisuals
 * Combines all three visuals in a responsive grid layout
 */
export function BusinessDefinitionVisuals({
  competitors = DEMO_COMPETITORS,
  yourPosition = DEMO_YOUR_POSITION,
  ladder = DEMO_LADDER,
  avatar = DEMO_AVATAR,
  title,
  className = "",
}: BusinessDefinitionVisualsProps) {
  return (
    <div className={["bdv-root", className].filter(Boolean).join(" ")}>
      <style>{CSS}</style>

      {title && <h2 className="bdv-heading">{title}</h2>}

      <div className="bdv-grid">
        <PositioningMap competitors={competitors} yourPosition={yourPosition} />
        <ValueLadder ladder={ladder} />
        <CustomerAvatar avatar={avatar} />
      </div>
    </div>
  );
}

/**
 * CSS: All styles scoped to "bdv-" prefix
 * Includes dark mode support via CSS custom properties (--ds-* tokens)
 * Responsive design: adapts at 768px and 1024px breakpoints
 * Smooth animations on component load
 */
const CSS = `
.bdv-root {
  --bdv-text: var(--ds-text-primary);
  --bdv-text-soft: var(--ds-text-secondary);
  --bdv-text-muted: var(--ds-text-tertiary);
  --bdv-border: var(--ds-border-subtle);
  --bdv-bg: var(--ds-surface);
  --bdv-bg-soft: var(--ds-bg-subtle);
  font-family: var(--ds-font, system-ui, -apple-system, Segoe UI, sans-serif);
  color: var(--bdv-text);
  line-height: 1.5;
}

.bdv-root * {
  box-sizing: border-box;
}

/* Heading */
.bdv-heading {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 28px;
  color: var(--bdv-text);
  letter-spacing: -0.5px;
}

/* Main grid: 3 columns on desktop, responsive */
.bdv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
  margin-bottom: 16px;
}

@media (max-width: 1024px) {
  .bdv-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .bdv-heading {
    font-size: 22px;
    margin-bottom: 20px;
  }
  .bdv-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* =========== POSITIONING MAP =========== */
.bdv-map-container {
  background: var(--bdv-bg);
  border: 1px solid var(--bdv-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

.bdv-map-svg {
  width: 100%;
  height: auto;
  max-width: 400px;
  margin: 0 auto;
  display: block;
}

.bdv-visual-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--bdv-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bdv-axis-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--bdv-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.bdv-axis-tick {
  font-size: 10px;
  fill: var(--bdv-text-soft);
  font-weight: 500;
}

.bdv-competitor {
  opacity: 0;
  animation: bdv-fade-in-up 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.bdv-competitor-label {
  font-size: 10px;
  fill: var(--bdv-text-soft);
  font-weight: 500;
}

.bdv-your-position {
  opacity: 0;
  animation: bdv-fade-in-scale 0.7s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.bdv-your-label {
  font-size: 12px;
  font-weight: 700;
  fill: var(--ds-brand);
}

.bdv-pulse {
  stroke-dasharray: 75.4;
  stroke-dashoffset: 0;
  animation: bdv-pulse-ring 2s ease-in-out infinite;
}

@keyframes bdv-pulse-ring {
  0% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 75.4;
    opacity: 0;
  }
}

/* =========== VALUE LADDER =========== */
.bdv-ladder-container {
  background: var(--bdv-bg);
  border: 1px solid var(--bdv-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
}

.bdv-ladder-svg {
  width: 100%;
  height: auto;
  max-width: 400px;
  margin: 0 auto;
  display: block;
}

.bdv-rung {
  opacity: 0;
  animation: bdv-fade-in-down 0.6s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.bdv-rung-title {
  font-size: 13px;
  font-weight: 700;
  fill: var(--bdv-text);
}

.bdv-rung-desc {
  font-size: 10px;
  fill: var(--bdv-text-soft);
  font-weight: 500;
}

.bdv-rung-price {
  font-size: 11px;
  font-weight: 700;
  fill: var(--ds-brand);
}

/* =========== CUSTOMER AVATAR =========== */
.bdv-avatar-container {
  background: var(--bdv-bg);
  border: 1px solid var(--bdv-border);
  border-radius: var(--ds-radius-md);
  padding: 20px;
  box-shadow: var(--ds-shadow-xs);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.bdv-avatar-icon {
  margin-bottom: 16px;
  animation: bdv-fade-in-scale 0.6s cubic-bezier(0.23, 1, 0.320, 1);
}

.bdv-avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--ds-brand-soft);
  border: 2px solid var(--ds-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--ds-brand);
}

.bdv-avatar-content {
  width: 100%;
}

.bdv-avatar-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--bdv-text);
  margin-bottom: 4px;
}

.bdv-avatar-role {
  font-size: 13px;
  color: var(--bdv-text-soft);
  margin-bottom: 12px;
  font-weight: 500;
}

.bdv-avatar-demos {
  background: var(--bdv-bg-soft);
  border-radius: var(--ds-radius-sm);
  padding: 12px;
  margin-bottom: 16px;
  text-align: left;
}

.bdv-demo-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 8px;
}

.bdv-demo-row:last-child {
  margin-bottom: 0;
}

.bdv-demo-label {
  font-weight: 600;
  color: var(--bdv-text-soft);
}

.bdv-demo-value {
  font-weight: 700;
  color: var(--bdv-text);
}

.bdv-pain-points {
  text-align: left;
  margin-bottom: 16px;
}

.bdv-pain-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--bdv-text-muted);
  margin-bottom: 8px;
}

.bdv-pain-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.bdv-pain-list li {
  font-size: 12px;
  color: var(--bdv-text-soft);
  margin-bottom: 6px;
  padding-left: 18px;
  position: relative;
  line-height: 1.4;
  opacity: 0;
  animation: bdv-fade-in-left 0.5s cubic-bezier(0.23, 1, 0.320, 1) forwards;
}

.bdv-pain-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--ds-chapter-improve);
  font-weight: 700;
}

.bdv-outcome {
  background: var(--ds-success-soft);
  border: 1px solid var(--ds-success);
  border-radius: var(--ds-radius-sm);
  padding: 12px;
  text-align: left;
}

.bdv-outcome-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--ds-success);
  margin-bottom: 6px;
}

.bdv-outcome-text {
  font-size: 13px;
  color: var(--ds-success);
  margin: 0;
  line-height: 1.4;
  font-weight: 500;
}

/* =========== ANIMATIONS =========== */
@keyframes bdv-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bdv-fade-in-down {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bdv-fade-in-left {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes bdv-fade-in-scale {
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

export default BusinessDefinitionVisuals;
