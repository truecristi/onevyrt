/**
 * Funnel Calculations — Helper functions for conversion metrics,
 * drop-off analysis, and funnel health scoring.
 */

export interface FunnelStage {
  id: string;
  name: string;
  visitors: number;
  conversions?: number;
  conversionRate?: number;
}

export interface FunnelMetrics {
  totalVisitors: number;
  totalConversions: number;
  overallConversionRate: number;
  stages: FunnelStage[];
  bottleneck: { stageId: string; stageName: string; rate: number };
  averageConversionRate: number;
}

/**
 * Calculate conversion rate for a stage
 */
export function calculateConversionRate(visitors: number, conversions: number): number {
  if (visitors === 0) return 0;
  return (conversions / visitors) * 100;
}

/**
 * Calculate drop-off for a stage
 */
export function calculateDropOff(visitors: number, conversions: number): number {
  if (visitors === 0) return 0;
  return visitors - conversions;
}

/**
 * Calculate drop-off percentage
 */
export function calculateDropOffPercent(visitors: number, conversions: number): number {
  if (visitors === 0) return 0;
  return ((visitors - conversions) / visitors) * 100;
}

/**
 * Identify the bottleneck stage (lowest conversion rate)
 */
export function findBottleneck(stages: FunnelStage[]): FunnelStage | null {
  if (stages.length === 0) return null;

  const stagesWithRates = stages.map(stage => ({
    ...stage,
    rate: calculateConversionRate(stage.visitors, stage.conversions || 0),
  }));

  return stagesWithRates.reduce((lowest, current) =>
    current.rate < lowest.rate ? current : lowest
  );
}

/**
 * Calculate funnel health score (0-100)
 * Based on conversion rates across all stages
 */
export function calculateFunnelHealthScore(stages: FunnelStage[]): number {
  if (stages.length === 0) return 0;

  const avgRate = stages.reduce((sum, stage) => {
    const rate = calculateConversionRate(stage.visitors, stage.conversions || 0);
    return sum + rate;
  }, 0) / stages.length;

  // Scale: 0.5% avg = 0 score, 10% avg = 100 score
  return Math.min(100, Math.max(0, (avgRate / 10) * 100));
}

/**
 * Get health status label and color
 */
export function getHealthStatus(score: number): { label: string; color: string; emoji: string } {
  if (score >= 80) return { label: "Excellent", color: "#0891b2", emoji: "🚀" };
  if (score >= 60) return { label: "Good", color: "#16a34a", emoji: "✓" };
  if (score >= 40) return { label: "Fair", color: "#d97706", emoji: "⚠" };
  return { label: "Needs Work", color: "#dc2626", emoji: "❌" };
}

/**
 * Calculate stage width for visualization (proportional to visitors)
 */
export function calculateStageWidth(stage: FunnelStage, maxVisitors: number): number {
  if (maxVisitors === 0) return 100;
  return (stage.visitors / maxVisitors) * 100;
}

/**
 * Generate conversion metrics for all stages
 */
export function generateFunnelMetrics(stages: FunnelStage[]): FunnelMetrics {
  const totalVisitors = stages[0]?.visitors || 0;
  const totalConversions = stages[stages.length - 1]?.conversions || 0;
  const overallConversionRate = calculateConversionRate(totalVisitors, totalConversions);

  const stagesWithMetrics = stages.map(stage => ({
    ...stage,
    conversions: stage.conversions || 0,
    conversionRate: calculateConversionRate(stage.visitors, stage.conversions || 0),
  }));

  const bottleneckStage = findBottleneck(stagesWithMetrics);
  const bottleneck = bottleneckStage ? {
    stageId: bottleneckStage.id,
    stageName: bottleneckStage.name,
    rate: bottleneckStage.conversionRate || 0,
  } : { stageId: "", stageName: "N/A", rate: 0 };

  const averageConversionRate = stagesWithMetrics.reduce((sum, s) => sum + (s.conversionRate || 0), 0) / stagesWithMetrics.length;

  return {
    totalVisitors,
    totalConversions,
    overallConversionRate,
    stages: stagesWithMetrics,
    bottleneck,
    averageConversionRate,
  };
}

/**
 * Get improvement suggestions based on funnel analysis
 */
export interface ImprovementSuggestion {
  stageId: string;
  stageName: string;
  priority: "high" | "medium" | "low";
  suggestion: string;
}

export function generateImprovementSuggestions(metrics: FunnelMetrics): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  // Bottleneck suggestion
  if (metrics.bottleneck.rate < 10) {
    suggestions.push({
      stageId: metrics.bottleneck.stageId,
      stageName: metrics.bottleneck.stageName,
      priority: "high",
      suggestion: `${metrics.bottleneck.stageName} has the lowest conversion rate (${metrics.bottleneck.rate.toFixed(1)}%). Focus on optimizing this stage first.`,
    });
  }

  // Low conversion stages
  metrics.stages.forEach((stage, index) => {
    const rate = stage.conversionRate || 0;
    if (rate < 5 && index > 0) {
      suggestions.push({
        stageId: stage.id,
        stageName: stage.name,
        priority: rate < 2 ? "high" : "medium",
        suggestion: `Conversion from ${stage.name} is low at ${rate.toFixed(1)}%. Consider A/B testing your messaging or landing page.`,
      });
    }
  });

  // Overall conversion suggestion
  if (metrics.overallConversionRate < 1) {
    suggestions.push({
      stageId: "overall",
      stageName: "Overall Funnel",
      priority: "high",
      suggestion: "Your overall funnel conversion is below 1%. Consider auditing your targeting or value proposition.",
    });
  }

  return suggestions.sort((a, b) => {
    const priorityMap = { high: 0, medium: 1, low: 2 };
    return priorityMap[a.priority] - priorityMap[b.priority];
  });
}

/**
 * Simulate funnel with different conversion rates (for "what-if" analysis)
 */
export function simulateFunnelScenario(
  baseStages: FunnelStage[],
  improvementRate: number // 0.1 = 10% improvement
): FunnelMetrics {
  const improvedStages = baseStages.map(stage => ({
    ...stage,
    conversions: Math.round((stage.conversions || 0) * (1 + improvementRate)),
  }));

  return generateFunnelMetrics(improvedStages);
}

/**
 * Get performance color based on conversion rate
 */
export function getPerformanceColor(rate: number): string {
  if (rate >= 10) return "#0891b2"; // Cyan - Excellent
  if (rate >= 5) return "#16a34a"; // Green - Good
  if (rate >= 2) return "#d97706"; // Amber - Fair
  return "#dc2626"; // Red - Poor
}

/**
 * Calculate expected revenue impact of improving a stage
 */
export function calculateRevenueImpact(
  baseConversions: number,
  improvementPercent: number,
  averageOrderValue: number
): number {
  const additionalConversions = Math.round((baseConversions * improvementPercent) / 100);
  return additionalConversions * averageOrderValue;
}
