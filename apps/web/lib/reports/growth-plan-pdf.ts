/**
 * Growth & Improvement Plan → PDF export. IMPLEMENTED.
 *
 * Mirrors TransformationReportPDF's jsPDF-based approach: manual page layout
 * with page breaks, no HTML→PDF conversion. Runs server-side; API route
 * GET /api/programme/chapter/4/pdf calls it in Node.
 *
 * buildGrowthPlanPdf() is the pure part (plan + workspace name → jsPDF doc).
 * Exported so API routes can call it headless; clients import via the API.
 */
import { jsPDF } from "jspdf";
import type { GrowthPlan } from "../growth-plan-utils";
import { formatCurrency, formatPercent } from "../growth-plan-utils";

const MARGIN_X = 48;
const BRAND = "ONEVYRT";
const ACCENT: [number, number, number] = [8, 128, 87]; // matches TransformationReportPDF

class PdfCursor {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  contentW: number;
  y = 0;
  readonly topY = 96;
  readonly bottomY: number;

  constructor(doc: jsPDF) {
    this.doc = doc;
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - MARGIN_X * 2;
    this.bottomY = this.pageH - 56;
    this.y = this.topY;
  }

  advance(dy: number): void {
    this.y += dy;
    if (this.y > this.bottomY) this.newPage();
  }

  newPage(): void {
    this.doc.addPage();
    drawHeader(this.doc, this.pageW);
    this.y = this.topY;
  }

  sectionBreak(title: string): void {
    this.newPage();
    this.doc.setFontSize(18).setFont("helvetica", "bold").setTextColor(20, 20, 20);
    this.doc.text(title, MARGIN_X, this.y);
    this.advance(10);
    this.doc.setDrawColor(...ACCENT).setLineWidth(1.5).line(MARGIN_X, this.y, MARGIN_X + 64, this.y);
    this.advance(22);
  }

  heading(text: string, size = 13): void {
    this.doc.setFontSize(size).setFont("helvetica", "bold").setTextColor(15, 15, 15);
    for (const line of this.doc.splitTextToSize(text, this.contentW)) {
      this.doc.text(line, MARGIN_X, this.y);
      this.advance(size + 4);
    }
  }

  label(text: string): void {
    this.doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(...ACCENT);
    this.doc.text(text.toUpperCase(), MARGIN_X, this.y);
    this.advance(14);
  }

  body(text: string, opts: { size?: number; lineH?: number; style?: "normal" | "italic"; color?: number } = {}): void {
    const { size = 10.5, lineH = 14.5, style = "normal", color = 55 } = opts;
    this.doc.setFontSize(size).setFont("helvetica", style).setTextColor(color);
    const paragraphs = text.split(/\n+/);
    for (const para of paragraphs) {
      const lines = this.doc.splitTextToSize(para || " ", this.contentW);
      for (const line of lines) {
        this.doc.text(line, MARGIN_X, this.y);
        this.advance(lineH);
      }
    }
    this.doc.setTextColor(0);
  }

  bullet(text: string): void {
    this.doc.setFontSize(10.5).setFont("helvetica", "normal").setTextColor(40);
    const lines = this.doc.splitTextToSize(text, this.contentW - 14);
    lines.forEach((line: string, i: number) => {
      this.doc.text(i === 0 ? "•" : " ", MARGIN_X, this.y);
      this.doc.text(line, MARGIN_X + 14, this.y);
      this.advance(14.5);
    });
    this.doc.setTextColor(0);
  }

  gap(dy = 12): void {
    this.advance(dy);
  }
}

function drawHeader(doc: jsPDF, pageW: number): void {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 46, "F");
  doc.setFontSize(13).setFont("helvetica", "bold").setTextColor(255, 255, 255);
  doc.text(BRAND, MARGIN_X, 29);
  doc.setFontSize(9.5).setFont("helvetica", "normal").setTextColor(230, 250, 244);
  doc.text("Growth & Improvement Plan", pageW - MARGIN_X, 29, { align: "right" });
  doc.setTextColor(0);
}

function stampFooters(doc: jsPDF, generatedAt: Date): void {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const stamp = `Generated ${generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} at ${generatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225).setLineWidth(0.75).line(MARGIN_X, pageH - 40, pageW - MARGIN_X, pageH - 40);
    doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(140);
    doc.text(`ONEVYRT · Growth & Improvement Plan`, MARGIN_X, pageH - 26);
    doc.text(stamp, pageW / 2, pageH - 26, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, pageW - MARGIN_X, pageH - 26, { align: "right" });
    doc.setTextColor(0);
  }
}

/**
 * Builds the full Growth & Improvement Plan PDF from a GrowthPlan object.
 * Pure function (besides jsPDF's internal state) — callers decide whether to
 * .save() it, hand it to a blob, etc.
 */
export function buildGrowthPlanPdf(plan: GrowthPlan, workspaceName = "Your workspace"): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawHeader(doc, doc.internal.pageSize.getWidth());
  const c = new PdfCursor(doc);

  // ── Cover ──────────────────────────────────────────────────────────────
  c.doc.setFontSize(24).setFont("helvetica", "bold").setTextColor(15, 15, 15);
  c.doc.text("Growth & Improvement Plan", MARGIN_X, c.y);
  c.advance(30);
  c.doc.setFontSize(13).setFont("helvetica", "normal").setTextColor(70);
  c.doc.text(workspaceName, MARGIN_X, c.y);
  c.advance(18);
  c.doc.setFontSize(10.5).setTextColor(120);
  c.doc.text(`Chapter 4: Improve & Scale`, MARGIN_X, c.y);
  c.advance(14);
  c.doc.text(`Your next 90 days`, MARGIN_X, c.y);
  c.doc.setTextColor(0);
  c.advance(34);

  // Status card
  const statusLabel: Record<typeof plan.status, string> = {
    in_progress: "In progress",
    submitted: "Awaiting coach review",
    changes_requested: "Changes requested",
    approved: "Approved",
  };
  c.doc.setDrawColor(225).setFillColor(248, 250, 249).roundedRect(MARGIN_X, c.y, c.contentW, 52, 6, 6, "FD");
  c.doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(120);
  c.doc.text("Status", MARGIN_X + 12, c.y + 18);
  c.doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(...ACCENT);
  c.doc.text(statusLabel[plan.status], MARGIN_X + 12, c.y + 39);
  c.doc.setTextColor(0);
  c.advance(78);

  // ── Current Position ────────────────────────────────────────────────────
  c.sectionBreak("Current Position");
  const cp = plan.currentPosition;
  const hasCurrentPosition =
    cp.monthlyRevenue != null || cp.grossMarginPct != null || cp.conversionRatePct != null || cp.avgCustomerValue != null;

  if (hasCurrentPosition) {
    c.doc.setFontSize(10.5).setFont("helvetica", "normal");
    const stats = [
      { label: "Monthly revenue", value: formatCurrency(cp.monthlyRevenue) },
      { label: "Gross margin", value: formatPercent(cp.grossMarginPct) },
      { label: "Lead → sale conversion", value: formatPercent(cp.conversionRatePct) },
      { label: "Avg. customer value", value: formatCurrency(cp.avgCustomerValue) },
    ];
    for (const stat of stats) {
      c.doc.setTextColor(120);
      c.doc.text(stat.label, MARGIN_X, c.y);
      c.doc.setFont("helvetica", "bold").setTextColor(...ACCENT);
      c.doc.text(stat.value, MARGIN_X + 300, c.y);
      c.doc.setTextColor(0).setFont("helvetica", "normal");
      c.advance(16);
    }
  } else {
    c.body("No baseline numbers entered yet.", { style: "italic", color: 140 });
  }
  c.gap(8);

  // ── Bottleneck ──────────────────────────────────────────────────────────
  c.sectionBreak("Biggest Bottleneck");
  if (plan.bottleneck) {
    c.heading(plan.bottleneck.area || "Not named yet", 12);
    c.gap(4);

    if (plan.bottleneck.currentValue != null || plan.bottleneck.targetValue != null) {
      c.doc.setFontSize(10.5).setFont("helvetica", "normal").setTextColor(120);
      c.doc.text("Current", MARGIN_X, c.y);
      c.doc.setFont("helvetica", "bold").setTextColor(...ACCENT);
      c.doc.text(formatPercent(plan.bottleneck.currentValue), MARGIN_X + 180, c.y);
      c.doc.setTextColor(0).setFont("helvetica", "normal");
      c.advance(16);

      c.doc.setTextColor(120);
      c.doc.text("Target", MARGIN_X, c.y);
      c.doc.setFont("helvetica", "bold").setTextColor(...ACCENT);
      c.doc.text(formatPercent(plan.bottleneck.targetValue), MARGIN_X + 180, c.y);
      c.doc.setTextColor(0).setFont("helvetica", "normal");
      c.advance(16);
    }

    if (plan.bottleneck.why) {
      c.label("Why");
      c.body(plan.bottleneck.why);
    }
  } else {
    c.body("No constraint identified yet.", { style: "italic", color: 140 });
  }
  c.gap(8);

  // ── Actions ─────────────────────────────────────────────────────────────
  c.sectionBreak("Action Plan");
  if (plan.actions.length > 0) {
    plan.actions.forEach((a, i) => {
      c.doc.setFontSize(10.5).setFont("helvetica", "bold").setTextColor(15, 15, 15);
      c.doc.text(`${i + 1}. ${a.title}`, MARGIN_X, c.y);
      c.advance(16);
      if (a.expectedImpact) {
        c.doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(120);
        c.doc.text(a.expectedImpact, MARGIN_X + 14, c.y);
        c.advance(14);
      }
    });
  } else {
    c.body("No actions defined yet.", { style: "italic", color: 140 });
  }
  c.gap(8);

  // ── Impact Projection ───────────────────────────────────────────────────
  c.sectionBreak("Expected 90-Day Impact");
  if (plan.impact) {
    c.doc.setFontSize(10.5).setFont("helvetica", "normal").setTextColor(120);
    c.doc.text("Current", MARGIN_X, c.y);
    c.doc.setTextColor(55);
    const currentCalc = `${plan.impact.leadVolume.toLocaleString()} leads × ${formatPercent(plan.impact.currentRatePct)} = ${plan.impact.currentUnits.toLocaleString()} sales`;
    c.doc.text(currentCalc, MARGIN_X + 120, c.y);
    c.advance(18);

    c.doc.setTextColor(120);
    c.doc.text("Target", MARGIN_X, c.y);
    c.doc.setTextColor(55);
    const targetCalc = `${plan.impact.leadVolume.toLocaleString()} leads × ${formatPercent(plan.impact.targetRatePct)} = ${plan.impact.targetUnits.toLocaleString()} sales`;
    c.doc.text(targetCalc, MARGIN_X + 120, c.y);
    c.advance(18);

    c.gap(6);
    c.doc.setFontSize(13).setFont("helvetica", "bold").setTextColor(...ACCENT);
    c.doc.text(`Uplift: ${formatPercent(plan.impact.upliftPct, { signed: true })} revenue potential`, MARGIN_X, c.y);
    c.doc.setTextColor(0);
  } else {
    c.body("Complete the bottleneck and lead volume to see the projected uplift.", { style: "italic", color: 140 });
  }

  stampFooters(doc, new Date());
  return doc;
}

function filenameFor(workspaceName: string): string {
  const slug = workspaceName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "workspace";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-growth-plan-${date}.pdf`;
}

export { filenameFor };
