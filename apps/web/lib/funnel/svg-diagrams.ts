/**
 * SVG Diagram Utilities — Reusable SVG generation functions
 * for creating professional funnel visualizations.
 */

export interface SVGRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SVGPoint {
  x: number;
  y: number;
}

/**
 * Create a trapezoid (funnel segment) path
 */
export function createTrapezoidPath(
  topX: number,
  topWidth: number,
  bottomX: number,
  bottomWidth: number,
  y: number,
  height: number
): string {
  const topLeft = topX;
  const topRight = topX + topWidth;
  const bottomLeft = bottomX;
  const bottomRight = bottomX + bottomWidth;
  const bottomY = y + height;

  return `M ${topLeft} ${y} L ${topRight} ${y} L ${bottomRight} ${bottomY} L ${bottomLeft} ${bottomY} Z`;
}

/**
 * Create arrow/connector path between funnel stages
 */
export function createArrowPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  curvature: number = 0.2
): string {
  const controlY1 = fromY + (toY - fromY) * curvature;
  const controlY2 = toY - (toY - fromY) * curvature;

  return `M ${fromX} ${fromY} C ${fromX} ${controlY1}, ${toX} ${controlY2}, ${toX} ${toY}`;
}

/**
 * Create smooth connector line
 */
export function createConnectorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curveAmount: number = 0.15
): string {
  const midX = (x1 + x2) / 2;
  const curveY = y1 + (y2 - y1) * (1 - curveAmount);

  return `M ${x1} ${y1} Q ${midX} ${curveY} ${x2} ${y2}`;
}

/**
 * Generate animated traffic particle positions
 */
export function generateTrafficParticles(
  startY: number,
  endY: number,
  count: number,
  startX: number = 0,
  endX: number = 0
): Array<{ x: number; y: number; index: number; delay: number }> {
  return Array.from({ length: count }, (_, i) => ({
    x: startX + (i / count) * (endX - startX),
    y: startY + (i / count) * (endY - startY),
    index: i,
    delay: (i / count) * 2, // Stagger animation over 2 seconds
  }));
}

/**
 * Calculate center positions for text in trapezoid
 */
export function getTrapezoidCenter(
  topX: number,
  topWidth: number,
  bottomX: number,
  bottomWidth: number,
  y: number,
  height: number
): SVGPoint {
  // Average of top and bottom midpoints
  const topMid = topX + topWidth / 2;
  const bottomMid = bottomX + bottomWidth / 2;
  const midX = (topMid + bottomMid) / 2;
  const midY = y + height / 2;

  return { x: midX, y: midY };
}

/**
 * Create gradient definition with given color
 */
export function createGradientDef(
  id: string,
  color: string,
  opacity1: number = 0.8,
  opacity2: number = 0.2
): string {
  return `
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%">
      <stop offset="0%" stopColor="${color}" stopOpacity="${opacity1}" />
      <stop offset="100%" stopColor="${color}" stopOpacity="${opacity2}" />
    </linearGradient>
  `.trim();
}

/**
 * Create animated traffic particle SVG element
 */
export function createParticleSVG(
  cx: number,
  cy: number,
  r: number = 4,
  color: string = "#3b82f6",
  animationDelay: number = 0,
  duration: number = 3
): string {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"
            style="animation: particle-flow ${duration}s ease-in-out infinite; animation-delay: ${animationDelay}s;" />
  `.trim();
}

/**
 * Create bar chart segment
 */
export function createBarSegment(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  label?: string,
  labelColor: string = "#ffffff"
): string {
  const rx = 4;
  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${color}" />`;

  if (label && width > 40) {
    const textX = x + width / 2;
    const textY = y + height / 2 + 4;
    svg += `
      <text x="${textX}" y="${textY}" text-anchor="middle" fill="${labelColor}"
            font-size="12" font-weight="600">${label}</text>
    `;
  }

  return svg;
}

/**
 * Create stage label with metrics
 */
export function createStageLabel(
  x: number,
  y: number,
  name: string,
  metrics: string,
  color: string = "#000000"
): string {
  return `
    <text x="${x}" y="${y}" font-size="14" font-weight="600" fill="${color}">${name}</text>
    <text x="${x}" y="${y + 16}" font-size="11" fill="#666666">${metrics}</text>
  `.trim();
}

/**
 * Create percentage badge
 */
export function createPercentageBadge(
  x: number,
  y: number,
  percentage: number,
  color: string = "#16a34a"
): string {
  const text = percentage >= 0 ? `${percentage.toFixed(1)}%` : "N/A";
  return `
    <circle cx="${x}" cy="${y}" r="20" fill="${color}" opacity="0.1" />
    <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${color}">${text}</text>
  `.trim();
}

/**
 * Create drop-off indicator arrow
 */
export function createDropOffIndicator(
  x: number,
  y: number,
  percentage: number,
  direction: "down" | "right" = "down"
): string {
  const arrowColor = percentage > 80 ? "#dc2626" : percentage > 50 ? "#d97706" : "#16a34a";

  if (direction === "down") {
    return `
      <g>
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 20}" stroke="${arrowColor}" stroke-width="2" />
        <polygon points="${x},${y + 20} ${x - 4},${y + 14} ${x + 4},${y + 14}" fill="${arrowColor}" />
        <text x="${x + 15}" y="${y + 15}" font-size="11" font-weight="600" fill="${arrowColor}">
          -${Math.round(percentage)}%
        </text>
      </g>
    `.trim();
  }

  return "";
}

/**
 * Create a legend item
 */
export function createLegendItem(
  x: number,
  y: number,
  color: string,
  label: string,
  size: number = 12
): string {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${color}" />
      <text x="${x + size + 8}" y="${y + size / 2 + 4}" font-size="12" fill="#000000">${label}</text>
    </g>
  `.trim();
}

/**
 * Create tooltip background
 */
export function createTooltipBg(
  x: number,
  y: number,
  width: number = 120,
  height: number = 60,
  bgColor: string = "#ffffff",
  borderColor: string = "#e5e7eb"
): string {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6"
          fill="${bgColor}" stroke="${borderColor}" stroke-width="1" />
  `.trim();
}

/**
 * Animate number counter (returns CSS animation)
 */
export function createCounterAnimation(
  _startValue: number,
  _endValue: number,
  _duration: number = 0.6
): string {
  return `
    @keyframes counter {
      from { content-visibility: auto; }
      to { content-visibility: auto; }
    }
  `.trim();
}
