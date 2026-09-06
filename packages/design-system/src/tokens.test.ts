import { describe, expect, it } from "vitest";
import { color } from "./tokens";

/**
 * PRD-HARDEN-006: accessibility testing (README "Migration and
 * hardening" -> "Conduct accessibility testing", Phase 8). Implements
 * WCAG 2.2's own relative-luminance and contrast-ratio formulas
 * (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) directly, rather
 * than trusting the hand-computed ratios in tokens.ts's comments - this
 * is what actually caught `color.border` failing (the original
 * `#d2d2d7` was 1.51:1, not the 3:1 SC 1.4.11 requires) during this
 * phase's audit, and is what stops that regressing silently again: a
 * future token edit that drops a color's contrast below its required
 * threshold fails this test, not just a comment nobody re-checks.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.2's contrast ratio formula: (L1 + 0.05) / (L2 + 0.05), lighter over darker. */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_UI_COMPONENT = 3.0;

describe("design tokens meet WCAG 2.2 AA contrast", () => {
  it("textPrimary meets 4.5:1 on background (normal text)", () => {
    expect(contrastRatio(color.textPrimary, color.background)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("textSecondary meets 4.5:1 on background (normal text)", () => {
    expect(contrastRatio(color.textSecondary, color.background)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("accent meets 4.5:1 on background (used as normal-size text/links)", () => {
    expect(contrastRatio(color.accent, color.background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("danger meets 4.5:1 on background (used as normal-size text)", () => {
    expect(contrastRatio(color.danger, color.background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("border meets 3:1 on background (SC 1.4.11 non-text/UI-component contrast)", () => {
    expect(contrastRatio(color.border, color.background)).toBeGreaterThanOrEqual(AA_UI_COMPONENT);
  });

  it("focusRing meets 3:1 on background (a focus indicator is a UI component boundary)", () => {
    expect(contrastRatio(color.focusRing, color.background)).toBeGreaterThanOrEqual(
      AA_UI_COMPONENT,
    );
  });
});

describe("contrastRatio helper (proves the test itself discriminates pass/fail)", () => {
  it("computes the WCAG spec's own worked example (black on white = 21:1)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("computes 1:1 for identical colors", () => {
    expect(contrastRatio("#808080", "#808080")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    expect(contrastRatio("#111827", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#111827"),
      10,
    );
  });

  it("correctly fails a color pair known not to meet AA (the original, un-fixed border color)", () => {
    // #d2d2d7 was this file's own color.border value before this audit
    // fixed it - kept here as a literal, not a reference to the current
    // token, so this regression-discrimination check doesn't silently
    // stop testing anything if the token is ever edited again.
    expect(contrastRatio("#d2d2d7", "#ffffff")).toBeLessThan(AA_UI_COMPONENT);
  });
});
