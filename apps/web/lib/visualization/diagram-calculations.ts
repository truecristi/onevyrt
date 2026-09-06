/**
 * Diagram Calculations
 *
 * Core calculations and algorithms for business visualization diagrams
 * including metrics, positions, and transformations.
 */

/**
 * Calculate positions for nodes in a circular layout
 */
export function calculateCircularLayout(
  nodeCount: number,
  radius: number,
  centerX: number = 0,
  centerY: number = 0
): Array<{ x: number; y: number; angle: number }> {
  const angleStep = (2 * Math.PI) / nodeCount;
  const positions: Array<{ x: number; y: number; angle: number }> = [];

  for (let i = 0; i < nodeCount; i++) {
    const angle = angleStep * i;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions.push({ x, y, angle });
  }

  return positions;
}

/**
 * Calculate positions for nodes in a grid layout
 */
export function calculateGridLayout(
  items: any[],
  width: number,
  height: number,
  cols: number
): Array<{ x: number; y: number; colIndex: number; rowIndex: number }> {
  const positions: Array<{ x: number; y: number; colIndex: number; rowIndex: number }> = [];
  const colWidth = width / cols;
  const rowHeight = Math.ceil(items.length / cols);
  const cellHeight = height / rowHeight;

  items.forEach((_item, index) => {
    const colIndex = index % cols;
    const rowIndex = Math.floor(index / cols);
    positions.push({
      x: colIndex * colWidth + colWidth / 2,
      y: rowIndex * cellHeight + cellHeight / 2,
      colIndex,
      rowIndex,
    });
  });

  return positions;
}

/**
 * Calculate conversion rate for a funnel stage
 */
export function calculateConversionRate(visitors: number, conversions: number): number {
  if (visitors === 0) return 0;
  return (conversions / visitors) * 100;
}

/**
 * Calculate drop-off for a funnel stage
 */
export function calculateDropoff(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((previous - current) / previous) * 100;
}

/**
 * Calculate width for a bar in a waterfall chart
 */
export function calculateWaterfallBar(
  value: number,
  maxValue: number,
  width: number
): { barWidth: number; x: number } {
  const barWidth = (Math.abs(value) / maxValue) * width;
  const x = value < 0 ? width - barWidth : 0;
  return { barWidth, x };
}

/**
 * Calculate position for a pie chart slice
 */
export interface PieSlice {
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export function calculatePieSlices(
  items: Array<{ label: string; value: number; color: string }>
): PieSlice[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const slices: PieSlice[] = [];
  let currentAngle = 0;

  items.forEach((item) => {
    const percentage = (item.value / total) * 100;
    const sliceAngle = (item.value / total) * 360;
    const endAngle = currentAngle + sliceAngle;

    slices.push({
      label: item.label,
      value: item.value,
      percentage: percentage,
      startAngle: currentAngle,
      endAngle: endAngle,
      color: item.color,
    });

    currentAngle = endAngle;
  });

  return slices;
}

/**
 * Calculate quadrant position for impact/effort matrix
 */
export interface MatrixPosition {
  x: number;
  y: number;
  quadrant: "quick-wins" | "major-initiatives" | "backlog" | "time-wasters";
}

export function calculateMatrixPosition(
  impact: number, // 0-100
  effort: number, // 0-100
  width: number,
  height: number
): MatrixPosition {
  const x = (effort / 100) * width;
  const y = ((100 - impact) / 100) * height; // Invert Y so high impact is at top

  let quadrant: MatrixPosition["quadrant"];
  if (impact > 50 && effort < 50) {
    quadrant = "quick-wins";
  } else if (impact > 50 && effort >= 50) {
    quadrant = "major-initiatives";
  } else if (impact <= 50 && effort < 50) {
    quadrant = "time-wasters";
  } else {
    quadrant = "backlog";
  }

  return { x, y, quadrant };
}

/**
 * Calculate color intensity based on value (0-100)
 */
export function calculateColorIntensity(value: number, baseColor: string): string {
  // Simple approach: adjust opacity based on value
  const alpha = value / 100;
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calculate health score based on multiple metrics
 */
export interface HealthMetrics {
  revenue: number; // 0-100
  profitability: number; // 0-100
  customerSatisfaction: number; // 0-100
  teamCapacity: number; // 0-100
  growthRate: number; // 0-100
}

export function calculateBusinessHealth(metrics: HealthMetrics): {
  score: number;
  level: "fragile" | "developing" | "strong" | "excellent";
  color: string;
} {
  const weights = {
    revenue: 0.25,
    profitability: 0.25,
    customerSatisfaction: 0.2,
    teamCapacity: 0.2,
    growthRate: 0.1,
  };

  const score =
    metrics.revenue * weights.revenue +
    metrics.profitability * weights.profitability +
    metrics.customerSatisfaction * weights.customerSatisfaction +
    metrics.teamCapacity * weights.teamCapacity +
    metrics.growthRate * weights.growthRate;

  let level: "fragile" | "developing" | "strong" | "excellent";
  let color: string;

  if (score < 30) {
    level = "fragile";
    color = "#dc2626"; // Red
  } else if (score < 60) {
    level = "developing";
    color = "#d97706"; // Amber
  } else if (score < 85) {
    level = "strong";
    color = "#16a34a"; // Green
  } else {
    level = "excellent";
    color = "#0891b2"; // Cyan
  }

  return { score: Math.round(score), level, color };
}

/**
 * Calculate constraint impact (bottleneck analysis)
 */
export interface ConstraintAnalysis {
  stage: string;
  input: number;
  output: number;
  conversionRate: number;
  dropoff: number;
  severity: number; // 0-100, how much this constraint limits throughput
}

export function analyzeConstraint(
  funnel: Array<{ stage: string; value: number }>
): ConstraintAnalysis[] {
  const analysis: ConstraintAnalysis[] = [];

  for (let i = 0; i < funnel.length; i++) {
    const stage = funnel[i]!;
    const nextStage = i + 1 < funnel.length ? funnel[i + 1] : null;

    if (!nextStage) break;

    const conversionRate = (nextStage.value / stage.value) * 100;
    const dropoff = 100 - conversionRate;

    // Severity is based on dropoff percentage and absolute numbers lost
    const absoluteLoss = stage.value - nextStage.value;
    const severity = Math.max(dropoff, (absoluteLoss / funnel[0]!.value) * 100);

    analysis.push({
      stage: stage.stage,
      input: stage.value,
      output: nextStage.value,
      conversionRate,
      dropoff,
      severity,
    });
  }

  // Find most severe constraint
  analysis.sort((a, b) => b.severity - a.severity);
  return analysis;
}

/**
 * Calculate trajectory from current state to goals
 */
export interface TrajectoryPoint {
  label: string;
  value: number;
  progress: number; // 0-100
}

export function calculateTrajectory(
  current: number,
  goal: number,
  timeframe: number = 12 // months
): TrajectoryPoint[] {
  const trajectory: TrajectoryPoint[] = [];
  const difference = goal - current;

  for (let i = 0; i <= timeframe; i++) {
    const progress = (i / timeframe) * 100;
    const value = current + (difference / timeframe) * i;

    trajectory.push({
      label: `Month ${i}`,
      value: Math.round(value),
      progress,
    });
  }

  return trajectory;
}

/**
 * Calculate benchmark comparison
 */
export interface BenchmarkComparison {
  metric: string;
  your: number;
  industry: number;
  percentile: number;
  status: "below" | "aligned" | "above";
}

export function calculateBenchmark(
  yourValue: number,
  industryMedian: number,
  industryRange: { min: number; max: number }
): BenchmarkComparison["status"] {
  if (yourValue >= industryRange.min && yourValue <= industryRange.max) {
    return "aligned";
  } else if (yourValue < industryMedian) {
    return "below";
  } else {
    return "above";
  }
}

/**
 * Calculate revenue opportunity
 */
export interface RevenueOpportunity {
  source: string;
  current: number;
  potential: number;
  gap: number;
  growthPercent: number;
}

export function calculateRevenueOpportunities(
  segments: Array<{ name: string; current: number; potential: number }>
): RevenueOpportunity[] {
  return segments.map((seg) => ({
    source: seg.name,
    current: seg.current,
    potential: seg.potential,
    gap: seg.potential - seg.current,
    growthPercent: ((seg.potential - seg.current) / seg.current) * 100,
  }));
}

/**
 * Calculate customer lifetime value impact
 */
export interface CLVImpact {
  metric: string;
  currentCLV: number;
  potentialCLV: number;
  impact: number;
  percentChange: number;
}

export function calculateCLVImpact(
  basePrice: number,
  retentionRate: number,
  lifespan: number,
  improvements: {
    priceIncrease?: number;
    retentionIncrease?: number;
    lifespanIncrease?: number;
  }
): CLVImpact[] {
  const currentCLV = basePrice * retentionRate * lifespan;
  const newPrice = basePrice * (1 + (improvements.priceIncrease || 0));
  const newRetention = retentionRate * (1 + (improvements.retentionIncrease || 0));
  const newLifespan = lifespan * (1 + (improvements.lifespanIncrease || 0));

  const potentialCLV = newPrice * newRetention * newLifespan;

  return [
    {
      metric: "Current CLV",
      currentCLV,
      potentialCLV,
      impact: potentialCLV - currentCLV,
      percentChange: ((potentialCLV - currentCLV) / currentCLV) * 100,
    },
  ];
}

/**
 * Generate improvement recommendations
 */
export interface Recommendation {
  stage: string;
  opportunity: string;
  potential: number;
  difficulty: "easy" | "medium" | "hard";
  timeframe: string;
}

export function generateRecommendations(
  analysis: ConstraintAnalysis[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  analysis.slice(0, 3).forEach((constraint, index) => {
    const potential = constraint.dropoff / 2; // Assume 50% improvement possible

    recommendations.push({
      stage: constraint.stage,
      opportunity: `Improve conversion from ${Math.round(constraint.conversionRate)}% to ${Math.round(constraint.conversionRate + potential)}%`,
      potential,
      difficulty: index === 0 ? "medium" : "hard",
      timeframe: index === 0 ? "30 days" : "90 days",
    });
  });

  return recommendations;
}
