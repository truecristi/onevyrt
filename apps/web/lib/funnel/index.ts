/**
 * Funnel Utilities - All exports for funnel calculations and SVG generation
 */

// Calculations
export {
  calculateConversionRate,
  calculateDropOff,
  calculateDropOffPercent,
  findBottleneck,
  calculateFunnelHealthScore,
  getHealthStatus,
  calculateStageWidth,
  generateFunnelMetrics,
  generateImprovementSuggestions,
  simulateFunnelScenario,
  getPerformanceColor,
  calculateRevenueImpact,
  type FunnelStage,
  type FunnelMetrics,
  type ImprovementSuggestion,
} from "./calculations";

// SVG Utilities
export {
  createTrapezoidPath,
  createArrowPath,
  createConnectorPath,
  generateTrafficParticles,
  getTrapezoidCenter,
  createGradientDef,
  createParticleSVG,
  createBarSegment,
  createStageLabel,
  createPercentageBadge,
  createDropOffIndicator,
  createLegendItem,
  createTooltipBg,
  type SVGRect,
  type SVGPoint,
} from "./svg-diagrams";
