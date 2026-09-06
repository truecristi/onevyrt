"use client";

/**
 * Transformation Report → PDF. Same jsPDF pattern already used for every
 * other "Export PDF" button in this app (ProgrammeCentre.tsx's workbook,
 * ProgramCentre.tsx's business report, funnel-studio.tsx's funnel report):
 * manual page layout with jsPDF gives real, guaranteed page numbers and a
 * one-click download — CSS print stylesheets can't reliably number pages
 * across browsers, which is why none of this app's other export buttons use
 * them either.
 *
 * buildTransformationReportPdf() is the pure part (report in, jsPDF doc
 * out) — exported so a route or test can call it head­less. The default
 * export wraps it as a button, so the page just renders
 * `<TransformationReportPDF report={report} />` to get a working export.
 */
import { jsPDF } from "jspdf";
import type { TransformationReport } from "../../lib/reports/transformation-report";

const MARGIN_X = 48;
const BRAND = "ONEVYRT";
const ACCENT: [number, number, number] = [8, 128, 87]; // matches lib/studio-ui.ts ACCENT_SOLID

function fmtDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, opts);
}

class PdfCursor {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  contentW: number;
  y = 0;
  /** Page top after the branded header band, and bottom before the footer —
   *  every page (not just the first) gets both, so section content never
   *  collides with either. */
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

  /** Advances y by dy; starts a fresh (headered) page first if that would
   *  run past the footer band. */
  advance(dy: number): void {
    this.y += dy;
    if (this.y > this.bottomY) this.newPage();
  }

  newPage(): void {
    this.doc.addPage();
    drawHeader(this.doc, this.pageW);
    this.y = this.topY;
  }

  /** Starts a new top-level report section on its own fresh page — the
   *  "clear section breaks" the multi-page layout needs. */
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
    for (const line of this.doc.splitTextToSize(text, this.contentW)) { this.doc.text(line, MARGIN_X, this.y); this.advance(size + 4); }
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
      for (const line of lines) { this.doc.text(line, MARGIN_X, this.y); this.advance(lineH); }
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

  /** A two-column "current → target" row (or any left/right metric pair). */
  metricRow(left: string, mid: string, right: string): void {
    this.doc.setFontSize(10.5).setFont("helvetica", "normal").setTextColor(30);
    this.doc.text(left, MARGIN_X, this.y);
    this.doc.setTextColor(120);
    this.doc.text(mid, MARGIN_X + this.contentW * 0.42, this.y);
    this.doc.setFont("helvetica", "bold").setTextColor(...ACCENT);
    this.doc.text(right, MARGIN_X + this.contentW * 0.72, this.y);
    this.doc.setTextColor(0);
    this.advance(17);
    this.doc.setDrawColor(230).setLineWidth(0.5).line(MARGIN_X, this.y - 6, MARGIN_X + this.contentW, this.y - 6);
  }

  gap(dy = 12): void { this.advance(dy); }
}

function drawHeader(doc: jsPDF, pageW: number): void {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 46, "F");
  doc.setFontSize(13).setFont("helvetica", "bold").setTextColor(255, 255, 255);
  doc.text(BRAND, MARGIN_X, 29);
  doc.setFontSize(9.5).setFont("helvetica", "normal").setTextColor(230, 250, 244);
  doc.text("Transformation Report", pageW - MARGIN_X, 29, { align: "right" });
  doc.setTextColor(0);
}

/** Stamps a consistent footer — page numbers + the generation timestamp —
 *  on every page, once the full document is built (jsPDF only knows the
 *  final page count after every page exists). */
function stampFooters(doc: jsPDF, generatedAt: string): void {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const generatedDate = new Date(generatedAt);
  const stamp = Number.isNaN(generatedDate.getTime())
    ? "Generated —"
    : `Generated ${generatedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} at ${generatedDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225).setLineWidth(0.75).line(MARGIN_X, pageH - 40, pageW - MARGIN_X, pageH - 40);
    doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(140);
    doc.text(`ONEVYRT · Transformation Report`, MARGIN_X, pageH - 26);
    doc.text(stamp, pageW / 2, pageH - 26, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, pageW - MARGIN_X, pageH - 26, { align: "right" });
    doc.setTextColor(0);
  }
}

/** Builds the full multi-page PDF from a compiled TransformationReport. Pure
 *  (besides jsPDF's own internal canvas state) — callers decide whether to
 *  .save() it, hand it to a blob, etc. */
export function buildTransformationReportPdf(report: TransformationReport): jsPDF {
  const { account, readiness, journey, improve, next90, achievements } = report;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawHeader(doc, doc.internal.pageSize.getWidth());
  const c = new PdfCursor(doc);

  // ── Cover ──────────────────────────────────────────────────────────────
  c.doc.setFontSize(24).setFont("helvetica", "bold").setTextColor(15, 15, 15);
  c.doc.text("Your Transformation Report", MARGIN_X, c.y);
  c.advance(30);
  c.doc.setFontSize(13).setFont("helvetica", "normal").setTextColor(70);
  c.doc.text(account.workspaceName, MARGIN_X, c.y);
  c.advance(18);
  c.doc.setFontSize(10.5).setTextColor(120);
  c.doc.text(account.programmeName, MARGIN_X, c.y);
  c.advance(14);
  c.doc.text(
    account.completedAt ? `Programme completed ${fmtDate(account.completedAt)}` : "Programme in progress",
    MARGIN_X, c.y,
  );
  c.doc.setTextColor(0);
  c.advance(34);

  const cards: [string, string][] = [["Programme progress", `${account.overallPercent}%`]];
  if (readiness.current != null) cards.push(["Readiness score", String(readiness.current)]);
  if (readiness.delta != null) cards.push(["Readiness change", `${readiness.delta >= 0 ? "+" : ""}${readiness.delta}`]);
  const cardW = (c.contentW - 16 * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value], i) => {
    const x = MARGIN_X + i * (cardW + 16);
    c.doc.setDrawColor(225).setFillColor(248, 250, 249).roundedRect(x, c.y, cardW, 52, 6, 6, "FD");
    c.doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(120);
    c.doc.text(label.toUpperCase(), x + 12, c.y + 18);
    c.doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(...ACCENT);
    c.doc.text(value, x + 12, c.y + 39);
    c.doc.setTextColor(0);
  });
  c.advance(78);

  c.label("Key Achievements");
  for (const a of achievements) c.bullet(a);

  // ── Section 1: Your Transformation Journey ──────────────────────────────
  c.sectionBreak("Your Transformation Journey");
  for (const step of journey) {
    c.heading(step.outputName ? `${step.heading} — ${step.outputName}` : step.heading);
    c.doc.setFontSize(9).setFont("helvetica", "italic").setTextColor(140);
    c.doc.text(step.stageTitle, MARGIN_X, c.y);
    c.doc.setTextColor(0);
    c.advance(15);
    c.body(step.narrative);
    if (step.approvedAt) c.body(`Approved ${fmtDate(step.approvedAt)}`, { size: 9, style: "italic", color: 8 });
    c.gap(14);
  }

  // ── Section 2: What You Will Improve ────────────────────────────────────
  c.sectionBreak("What You Will Improve");
  c.body(improve.narrative);
  c.gap(6);
  if (improve.bottleneck) {
    c.label("Bottleneck identified");
    c.heading(improve.bottleneck.area, 12);
    c.label("Why this matters");
    c.body(improve.bottleneck.why);
    if (improve.bottleneck.relieve !== "Not documented yet.") {
      c.label("The move to relieve it");
      c.body(improve.bottleneck.relieve);
    }
    c.gap(8);
  }
  if (improve.metrics.length > 0) {
    c.label("Current → Target metrics");
    c.metricRow("METRIC", "CURRENT", "TARGET");
    for (const m of improve.metrics) c.metricRow(m.label, m.current, m.target);
    c.gap(10);
  }

  // ── Section 3: Your Next 90 Days ────────────────────────────────────────
  c.sectionBreak("Your Next 90 Days");
  c.body(`${fmtDate(next90.windowStart)} → ${fmtDate(next90.windowEnd)}`, { size: 9.5, style: "italic", color: 120 });
  c.gap(8);
  c.body(next90.narrative);
  c.gap(8);
  if (next90.actions.length > 0) {
    c.label("Top actions");
    for (const a of next90.actions) {
      c.bullet(`${a.title}${a.owner ? ` — ${a.owner}` : ""}${a.due ? ` (due ${a.due})` : ""}`);
    }
    c.gap(8);
  }
  if (next90.milestones.length > 0) {
    c.label("Milestones & expected impact");
    for (const m of next90.milestones) c.bullet(`${m.title}${m.impact ? ` — ${m.impact}` : ""}`);
    c.gap(8);
  }
  if (next90.successCriteria.length > 0) {
    c.label("Success criteria");
    for (const s of next90.successCriteria) c.bullet(s);
  }

  stampFooters(doc, account.generatedAt);
  return doc;
}

function filenameFor(report: TransformationReport): string {
  const slug = report.account.workspaceName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "workspace";
  const date = report.account.generatedAt.slice(0, 10);
  return `${slug}-transformation-report-${date}.pdf`;
}

/** One-click "Export to PDF" button. Renders as a plain button so the page
 *  can drop it in next to the Share/Email actions; styling matches this
 *  app's `.btn.primary` convention via className, with an inline fallback
 *  for pages that don't load that stylesheet. */
export default function TransformationReportPDF({ report, className, onExported }: {
  report: TransformationReport;
  className?: string;
  onExported?: () => void;
}) {
  const handleClick = () => {
    const doc = buildTransformationReportPdf(report);
    doc.save(filenameFor(report));
    onExported?.();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? "btn primary"}
      style={className ? undefined : { background: "#088057", border: "1px solid #088057", color: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
    >
      Export to PDF
    </button>
  );
}
