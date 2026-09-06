"use client";

/**
 * VisualReferencesLibrary
 *
 * Collection of visual references, sketches, diagrams, and illustrations
 * for embedding directly in lesson content. All as inline SVGs or data URIs.
 *
 * Components:
 * - FunnelDiagram: Visual sales funnel with drop-off rates
 * - CustomerJourneyMap: Timeline of customer touchpoints
 * - RevenueBreakdown: Pie chart of revenue sources
 * - ValueLadderSketch: Visual representation of pricing tiers
 * - PositioningMap: 2x2 matrix positioning
 * - ProcessFlow: Step-by-step workflow diagram
 */

/**
 * FunnelDiagram
 * Visualizes a sales funnel with visitor counts and conversion rates
 */
export function FunnelDiagram({
  stages,
  title = "Sales Funnel",
}: {
  stages?: Array<{ name: string; count: number; color: string }>;
  title?: string;
}) {
  const defaultStages = [
    { name: "Visitors", count: 10000, color: "#3b82f6" },
    { name: "Leads", count: 1000, color: "#10b981" },
    { name: "Qualified", count: 200, color: "#f59e0b" },
    { name: "Customers", count: 20, color: "#ef4444" },
  ];

  const data = stages || defaultStages;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <svg viewBox="0 0 400 300" className="w-full border border-slate-200 rounded p-4 bg-white">
        {/* Title */}
        <text x="200" y="20" fontSize="14" fontWeight="bold" textAnchor="middle">
          {title}
        </text>

        {/* Funnel bars */}
        {data.map((stage, idx) => {
          const startX = 50 + idx * 15;
          const width = 300 - idx * 30;
          const y = 50 + idx * 50;
          const percent = ((stage.count / data[0]!.count) * 100).toFixed(1);

          return (
            <g key={idx}>
              {/* Bar */}
              <rect
                x={startX}
                y={y}
                width={width}
                height={40}
                fill={stage.color}
                opacity="0.7"
                stroke={stage.color}
                strokeWidth="2"
              />

              {/* Label */}
              <text
                x={startX + width / 2}
                y={y + 25}
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                fill="white"
              >
                {stage.name}
              </text>

              {/* Number + Percentage */}
              <text
                x={startX + width / 2}
                y={y + 55}
                fontSize="11"
                textAnchor="middle"
                fill={stage.color}
                fontWeight="bold"
              >
                {stage.count.toLocaleString()} ({percent}%)
              </text>

              {/* Conversion arrow */}
              {idx < data.length - 1 && (
                <text
                  x={200}
                  y={y + 65}
                  fontSize="14"
                  textAnchor="middle"
                  fill="#94a3b8"
                >
                  ↓
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
 * CustomerJourneyMap
 * Timeline showing customer touchpoints from awareness to loyalty
 */
export function CustomerJourneyMap({ title = "Customer Journey" }: { title?: string }) {
  const stages = [
    { stage: "Awareness", action: "See ad", duration: "Day 1" },
    { stage: "Interest", action: "Visit site", duration: "Day 1-2" },
    { stage: "Consideration", action: "Download guide", duration: "Day 2-7" },
    { stage: "Decision", action: "Book call", duration: "Day 7-14" },
    { stage: "Purchase", action: "Pay invoice", duration: "Day 14-30" },
    { stage: "Loyalty", action: "Repeat buy", duration: "Day 30+" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="space-y-2">
        {stages.map((step, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <div className="flex-1 flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                {idx + 1}
              </div>
              <div className="ml-4 flex-1">
                <div className="font-bold text-slate-900">{step.stage}</div>
                <div className="text-sm text-slate-600">{step.action}</div>
              </div>
              <div className="text-sm text-slate-500 italic">{step.duration}</div>
            </div>
            {idx < stages.length - 1 && (
              <div className="text-slate-400 text-xl">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * RevenueBreakdownChart
 * Pie chart showing revenue distribution
 */
export function RevenueBreakdownChart({
  segments,
}: {
  segments?: Array<{ label: string; percent: number; color: string }>;
}) {
  const defaultSegments = [
    { label: "Lead Magnet ($0)", percent: 0, color: "#94a3b8" },
    { label: "Frontend ($97)", percent: 15, color: "#3b82f6" },
    { label: "Core Offer ($5k)", percent: 60, color: "#10b981" },
    { label: "Backend ($25k)", percent: 20, color: "#8b5cf6" },
    { label: "Upsell ($2k/mo)", percent: 5, color: "#f59e0b" },
  ];

  const data = segments || defaultSegments;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Revenue Breakdown</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Pie Chart (simplified) */}
        <div className="bg-slate-50 rounded p-4 flex items-center justify-center min-h-48">
          <svg viewBox="0 0 200 200" className="w-full max-w-xs">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" strokeWidth="20" />
            {(() => {
              let cumulativeAngle = 0;
              return data.map((segment, idx) => {
                const startAngle = cumulativeAngle;
                const endAngle = startAngle + (segment.percent * 360) / 100;
                cumulativeAngle = endAngle;
                const start = polarToCartesian(100, 100, 80, startAngle);
                const end = polarToCartesian(100, 100, 80, endAngle);

                return (
                  segment.percent > 0 && (
                    <path
                      key={idx}
                      d={`M ${start.x} ${start.y} A 80 80 0 ${
                        endAngle - startAngle > 180 ? 1 : 0
                      } 1 ${end.x} ${end.y} L 100 100 Z`}
                      fill={segment.color}
                      opacity="0.8"
                    />
                  )
                );
              });
            })()}
          </svg>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {data.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: segment.color }}
              />
              <span className="font-medium text-slate-900">
                {segment.label} ({segment.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ValueLadderVisualization
 * 3D-inspired visual of the value ladder
 */
export function ValueLadderVisualization() {
  const rungs = [
    { level: 5, name: "Upsell", price: "$2k/mo", color: "#f59e0b", width: "50%" },
    { level: 4, name: "Backend", price: "$25k+", color: "#8b5cf6", width: "65%" },
    { level: 3, name: "Core Offer", price: "$5k", color: "#10b981", width: "80%" },
    { level: 2, name: "Frontend", price: "$97", color: "#3b82f6", width: "85%" },
    { level: 1, name: "Lead Magnet", price: "FREE", color: "#94a3b8", width: "100%" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Your Value Ladder</h3>
      <div className="space-y-2">
        {rungs.map((rung) => (
          <div key={rung.level} className="flex items-center gap-4">
            <div className="text-right w-12 text-sm font-bold text-slate-600">
              #{rung.level}
            </div>
            <div
              style={{
                backgroundColor: rung.color,
                width: rung.width,
              }}
              className="py-3 px-4 rounded text-white font-bold shadow-md transition-all hover:shadow-lg"
            >
              {rung.name} — {rung.price}
            </div>
            <div className="text-xs text-slate-500">
              {rung.level === 1 && "Awareness"}
              {rung.level === 2 && "Trust"}
              {rung.level === 3 && "Main Revenue"}
              {rung.level === 4 && "Premium"}
              {rung.level === 5 && "Recurring"}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 italic mt-4">
        Each rung should be 3-5x the previous price. Wider base = more volume at lower price.
      </p>
    </div>
  );
}

/**
 * PositioningMatrixSketch
 * 2x2 matrix: Premium/Budget × Specialist/Generalist
 */
export function PositioningMatrixSketch() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Where Do You Fit?</h3>
      <svg viewBox="0 0 400 400" className="w-full border border-slate-200 rounded p-4 bg-white">
        {/* Axes */}
        <line x1="50" y1="350" x2="350" y2="350" stroke="#94a3b8" strokeWidth="2" />
        <line x1="50" y1="350" x2="50" y2="50" stroke="#94a3b8" strokeWidth="2" />

        {/* Axis labels */}
        <text x="360" y="360" fontSize="12" fontWeight="bold">
          PREMIUM →
        </text>
        <text x="20" y="40" fontSize="12" fontWeight="bold">
          SPECIALIST →
        </text>

        {/* Quadrants */}
        <rect x="50" y="50" width="150" height="150" fill="#fecaca" opacity="0.3" />
        <text x="125" y="135" textAnchor="middle" fontSize="11" fontWeight="bold">
          Premium Specialist ✓
        </text>
        <text x="125" y="150" textAnchor="middle" fontSize="9">
          (Most Profitable)
        </text>

        <rect x="200" y="50" width="150" height="150" fill="#fed7aa" opacity="0.3" />
        <text x="275" y="135" textAnchor="middle" fontSize="11" fontWeight="bold">
          Premium Generalist
        </text>

        <rect x="50" y="200" width="150" height="150" fill="#bfdbfe" opacity="0.3" />
        <text x="125" y="285" textAnchor="middle" fontSize="11" fontWeight="bold">
          Budget Specialist
        </text>

        <rect x="200" y="200" width="150" height="150" fill="#dbeafe" opacity="0.3" />
        <text x="275" y="285" textAnchor="middle" fontSize="11" fontWeight="bold">
          Budget Generalist
        </text>

        {/* Center lines (dividers) */}
        <line x1="200" y1="50" x2="200" y2="350" stroke="#cbd5e1" strokeDasharray="5,5" />
        <line x1="50" y1="200" x2="350" y2="200" stroke="#cbd5e1" strokeDasharray="5,5" />

        {/* Sample positioning (mark where YOU are) */}
        <circle cx="130" cy="120" r="8" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
        <text x="130" y="30" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#ef4444">
          YOU (your positioning)
        </text>
      </svg>
    </div>
  );
}

/**
 * ProcessFlowDiagram
 * Generic step-by-step workflow
 */
export function ProcessFlowDiagram({
  steps,
  title = "Process Flow",
}: {
  steps?: string[];
  title?: string;
}) {
  const defaultSteps = ["Problem", "Solution", "Objection", "Close", "Delivery", "Upsell"];
  const data = steps || defaultSteps;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((step, idx) => (
          <div key={idx} className="flex items-center">
            <div className="bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
              {idx + 1}
            </div>
            <div className="mx-2 text-slate-700 font-medium text-sm">{step}</div>
            {idx < data.length - 1 && (
              <div className="text-blue-500 text-2xl mx-2">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ComparisonTable
 * Side-by-side comparison of options
 */
export function ComparisonTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<{ label: string; values: Array<string | boolean> }>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="w-full">
          <thead className="bg-slate-100 border-b border-slate-300">
            <tr>
              <th className="p-3 text-left font-bold text-slate-900">Feature</th>
              {headers.map((h) => (
                <th key={h} className="p-3 text-center font-bold text-slate-900">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">{row.label}</td>
                {row.values.map((val, vidx) => (
                  <td key={vidx} className="p-3 text-center">
                    {typeof val === "boolean" ? (
                      <span
                        className={`text-2xl ${val ? "text-green-500" : "text-red-500"}`}
                      >
                        {val ? "✓" : "✗"}
                      </span>
                    ) : (
                      <span className="text-slate-700">{val}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Helper function to convert polar coordinates to cartesian
 */
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}
