/**
 * SVG Utility Functions
 *
 * Reusable helpers for creating SVG elements, paths, and visual effects
 * for business strategy diagrams without external charting libraries.
 */

/**
 * Generate SVG path data for a rounded rectangle
 */
export function createRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string {
  const r = Math.min(radius, width / 2, height / 2);
  return `M ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x + r} ${y + height} Q ${x} ${y + height} ${x} ${y + height - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

/**
 * Generate SVG path data for a circle
 */
export function createCircle(
  cx: number,
  cy: number,
  r: number
): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/**
 * Generate SVG path for an arrow
 */
export function createArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  headSize: number = 8
): { path: string; head: string } {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  // Fixed 2-tuples (not a plain number[][]) so each point's [0]/[1] stay
  // precisely `number` under noUncheckedIndexedAccess, instead of needing
  // non-null assertions on every access below.
  const tip: [number, number] = [x2, y2];
  const left: [number, number] = [x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6)];
  const right: [number, number] = [x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6)];

  return {
    path: `M ${x1} ${y1} L ${x2} ${y2}`,
    head: `M ${tip[0]} ${tip[1]} L ${left[0]} ${left[1]} L ${right[0]} ${right[1]} Z`,
  };
}

/**
 * Generate SVG path for a curved connector (Bezier curve)
 */
export function createCurvedConnector(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number = 0.5
): string {
  const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const cpX1 = x1 + distance * curvature;
  const cpY1 = y1;
  const cpX2 = x2 - distance * curvature;
  const cpY2 = y2;

  return `M ${x1} ${y1} C ${cpX1} ${cpY1} ${cpX2} ${cpY2} ${x2} ${y2}`;
}

/**
 * Generate SVG path for a circle segment (pie slice)
 */
export function createPieSlice(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * Format number as percentage
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency: string = "$"): string {
  return `${currency}${(value / 1000).toFixed(1)}k`;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  min1: number,
  max1: number,
  min2: number,
  max2: number
): number {
  return ((value - min1) / (max1 - min1)) * (max2 - min2) + min2;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate color from hex with opacity
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lighten or darken a color by a percentage
 */
export function adjustHexColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B)
    .toString(16)
    .slice(1)
    .toUpperCase()}`;
}

/**
 * Create SVG text with automatic wrapping and sizing
 */
export interface TextOptions {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontWeight?: string;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  maxWidth?: number;
  lineHeight?: number;
}

export function createTextElement(options: TextOptions): {
  elements: Array<{ type: "tspan"; x: number; y: number; text: string }>;
  height: number;
} {
  const {
    x,
    y,
    text,
    fontSize = 14,
    maxWidth = Infinity,
    lineHeight = 1.4,
  } = options;

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  // Simple word wrapping (approximation)
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    // Approximate character width
    const estimatedWidth = testLine.length * (fontSize * 0.6);

    if (estimatedWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const elements = lines.map((line, i) => ({
    type: "tspan" as const,
    x,
    y: y + i * fontSize * lineHeight,
    text: line,
  }));

  return {
    elements,
    height: lines.length * fontSize * lineHeight,
  };
}

/**
 * Generate gradient definition for SVG
 */
export function createLinearGradient(
  id: string,
  colors: Array<{ offset: string; color: string }>
): string {
  const stops = colors.map((c) => `<stop offset="${c.offset}" stop-color="${c.color}" />`).join("");
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs>`;
}

/**
 * Create an animated SVG path for loading/progress
 */
export function createAnimatedPath(pathData: string, duration: number = 3): string {
  const pathLength = estimatePathLength(pathData);
  return `<style>
    @keyframes dash {
      to {
        stroke-dashoffset: ${pathLength};
      }
    }
    .animated-path {
      stroke-dasharray: ${pathLength};
      stroke-dashoffset: 0;
      animation: dash ${duration}s linear infinite;
    }
  </style>`;
}

/**
 * Estimate path length (simplified)
 */
export function estimatePathLength(pathData: string): number {
  // This is a rough approximation - a proper implementation would parse the path
  return pathData.length * 0.5;
}

/**
 * Create a grid pattern for background
 */
export function createGridPattern(
  id: string,
  size: number = 20,
  color: string = "#f0f0f0"
): string {
  return `<defs>
    <pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
      <path d="M ${size} 0 L 0 0 0 ${size}" fill="none" stroke="${color}" stroke-width="0.5"/>
    </pattern>
  </defs>`;
}

/**
 * Create a tooltip SVG group
 */
export interface TooltipOptions {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
}

export function createTooltip(options: TooltipOptions): string {
  const {
    x,
    y,
    text,
    width = 120,
    height = 40,
    bgColor = "#1f2937",
    textColor = "#ffffff",
    fontSize = 12,
  } = options;

  return `
    <g class="tooltip" transform="translate(${x}, ${y})">
      <rect width="${width}" height="${height}" rx="4" fill="${bgColor}" opacity="0.9" />
      <text x="${width / 2}" y="${height / 2 + fontSize / 3}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="500">
        ${text}
      </text>
    </g>
  `;
}

/**
 * Create SVG filter for shadow effect
 */
export function createShadowFilter(id: string, offset: number = 2, blur: number = 4): string {
  return `<defs>
    <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="${offset}" dy="${offset}" stdDeviation="${blur}" flood-opacity="0.15" />
    </filter>
  </defs>`;
}
