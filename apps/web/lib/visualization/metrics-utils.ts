/**
 * Metrics Utilities — Calculations and formatting for dashboard visualizations
 */

export interface MetricTrend {
  value: number;
  percentChange: number;
  direction: "up" | "down" | "neutral";
  previousValue: number;
}

export interface MetricData {
  label: string;
  value: number | string;
  formattedValue: string;
  trend?: MetricTrend;
  benchmark?: {
    industry: number;
    comparison: "above" | "below" | "equal";
  };
  health: "healthy" | "caution" | "at-risk";
}

export interface SparklinePoint {
  value: number;
  label: string;
}

/**
 * Calculate trend metrics between current and previous values
 */
export function calculateTrend(current: number, previous: number): MetricTrend {
  const difference = current - previous;
  const percentChange = previous === 0 ? 0 : (difference / Math.abs(previous)) * 100;

  return {
    value: current,
    previousValue: previous,
    percentChange: Math.round(percentChange * 10) / 10,
    direction: difference > 0 ? "up" : difference < 0 ? "down" : "neutral",
  };
}

/**
 * Determine health status based on value, target, and metric type
 */
export function getHealthStatus(
  value: number,
  target: number,
  metricType: "revenue" | "profit" | "conversion" | "growth" | "efficiency"
): "healthy" | "caution" | "at-risk" {
  const percentOfTarget = (value / target) * 100;

  if (metricType === "conversion" || metricType === "efficiency") {
    if (percentOfTarget >= 90) return "healthy";
    if (percentOfTarget >= 70) return "caution";
    return "at-risk";
  }

  // For revenue, profit, growth
  if (percentOfTarget >= 100) return "healthy";
  if (percentOfTarget >= 75) return "caution";
  return "at-risk";
}

/**
 * Format number as currency
 */
export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format number with commas and optional decimals
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value).toFixed(decimals)}%`;
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${Math.round(days)}d`;
}

/**
 * Calculate average and trend for sparkline data
 */
export function calculateSparklineStats(points: SparklinePoint[]): {
  current: number;
  average: number;
  min: number;
  max: number;
  trend: "up" | "down" | "neutral";
} {
  const values = points.map((p) => p.value);
  const current = values[values.length - 1] ?? 0;
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const trend = secondAvg > firstAvg ? "up" : secondAvg < firstAvg ? "down" : "neutral";

  return { current, average, min, max, trend };
}

/**
 * Generate sparkline path coordinates for SVG
 */
export function generateSparklinePath(
  points: SparklinePoint[],
  width: number = 100,
  height: number = 40,
  padding: number = 2
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const x = width / 2;
    const y = height / 2;
    return `M ${x} ${y}`;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;
  const xStep = drawWidth / (points.length - 1);

  const pathData = points
    .map((point, i) => {
      const x = padding + i * xStep;
      const normalizedValue = (point.value - min) / range;
      const y = padding + drawHeight * (1 - normalizedValue);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return pathData;
}

/**
 * Calculate conversion rate between stages
 */
export function calculateConversionRate(from: number, to: number): number {
  return from === 0 ? 0 : (to / from) * 100;
}

/**
 * Identify bottleneck (lowest conversion rate)
 */
export function findBottleneck(
  stages: Array<{ name: string; input: number; output: number }>
): { stage: string; rate: number; impact: number } | null {
  if (stages.length === 0) return null;

  const rates = stages.map((stage) => ({
    stage: stage.name,
    rate: calculateConversionRate(stage.input, stage.output),
    impact: stage.input - stage.output,
  }));

  return rates.reduce((lowest, current) => (current.rate < lowest.rate ? current : lowest));
}

/**
 * Calculate engagement level based on activity metrics
 */
export function calculateEngagementLevel(
  submissionsCompleted: number,
  totalSubmissions: number,
  _daysActive: number,
  daysSinceLastActivity: number
): "active" | "moderate" | "at-risk" {
  const completionRate = totalSubmissions === 0 ? 0 : (submissionsCompleted / totalSubmissions) * 100;

  if (completionRate >= 80 && daysSinceLastActivity <= 7) return "active";
  if (completionRate >= 50 && daysSinceLastActivity <= 14) return "moderate";
  return "at-risk";
}

/**
 * Calculate overall health score (0-100)
 */
export function calculateHealthScore(
  revenue: number,
  revenueTarget: number,
  profit: number,
  profitTarget: number,
  conversionRate: number,
  conversionTarget: number,
  growth: number
): number {
  const revenueScore = Math.min((revenue / revenueTarget) * 100, 100) * 0.3;
  const profitScore = Math.min((profit / profitTarget) * 100, 100) * 0.25;
  const conversionScore = Math.min((conversionRate / conversionTarget) * 100, 100) * 0.25;
  const growthScore = Math.min(growth * 10, 100) * 0.2; // 10% growth = 100 points

  return Math.round(revenueScore + profitScore + conversionScore + growthScore);
}

/**
 * Get color based on health status
 */
export function getStatusColor(
  status: "healthy" | "caution" | "at-risk"
): { bg: string; text: string; border: string } {
  switch (status) {
    case "healthy":
      return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" };
    case "caution":
      return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
    case "at-risk":
      return { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" };
  }
}

/**
 * Format large numbers with abbreviations (1k, 1m, etc.)
 */
export function abbreviateNumber(value: number, decimals = 1): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}k`;
  }
  return value.toFixed(decimals);
}
