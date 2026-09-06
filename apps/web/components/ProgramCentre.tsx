"use client";

/**
 * ProgramCentre — the business-MODEL workspace. This is the big authoring
 * surface where the owner builds their plan: money machine, profit drivers,
 * objections/hooks, promises, goals, assumptions, experiments, and the
 * shareable business report — plus the guided "build your model" lesson list.
 *
 * NOTE — do not confuse with ProgrammeCentre (one extra "me"): that is the
 * COACHING-programme hub (curriculum progress, cohorts, coach review). This
 * file is about the user's own business model; that one is about the course
 * they're taking. They are unrelated components that happen to sit one letter
 * apart in the import list.
 */
import { useState, useMemo, useEffect } from "react";
import { jsPDF } from "jspdf";
import {
  formatMoney, summarizeForceActions, buildBusinessReport, projectMoneyMachine, simulateProfitDrivers,
  analyzeDriverSensitivity,
  computeRavingFansScore, summarizePromises, FORCE_NAMES, projectMonths,
  type BusinessDefinition, type ForceActionItem, type ForceNumber, type MoneyMachineConfig,
  type ObjectionEntry, type HookEntry, type ProfitDriverInputs, type ClientPromise, type RavingFansInputs,
  type TransformationBrief, type BusinessReport,
  type MindfulnessEntry, type MindfulnessKind,
  type ActionConfidence, type LinkedKpi,
  buildDecidePhaseSummary, type RiskReport, type VarianceReport,
  type ScenarioComparison,
  GOAL_LEVELS, GOAL_LEVEL_LABELS, rollUpStatus, summarizeGoals,
  type GoalNode, type GoalLevel, type GoalStatus,
  summarizeAssumptions, type AssumptionEntry, type AssumptionConfidence, type AssumptionStatus,
  summarizeExperiments, type ExperimentEntry, type ExperimentStatus, type ExperimentDecision, type ExperimentConfidence,
  computeReadiness, type ReadinessLabel,
  summarizeLedger, monthsToTarget, requiredMonthlyContribution, type LedgerEntry, type LedgerBucket, type LedgerKind, type MoneyMachineTargets,
} from "@onevyrt/engine";
import { ACCENT, barGhost, barPrimary } from "../lib/studio-ui";
import { BreakEvenCard } from "./studio/BreakEvenCard";
import { AiFieldButton } from "./studio/AiFieldButton";
import { withGrounding, type Grounding } from "../lib/ai-grounding";
import { computeProgramProgress, type LessonKey } from "../lib/program-progress";

// Shared system prompt for the per-field "✨ AI" drafts on the Define/Story tabs.
const DEF_AI_SYSTEM = "You are a sharp business strategist helping a founder complete their business definition. Answer ONLY the single field requested, in 1–2 concise, specific sentences. Plain text — no preamble, no restating the label, no quotes.";

const DEFINITION_FIELDS: { key: keyof BusinessDefinition; label: string; placeholder: string }[] = [
  { key: "businessName", label: "Business name", placeholder: "What is this business called?" },
  { key: "whoServe", label: "Who you serve", placeholder: "Who is the customer?" },
  { key: "mainOffer", label: "Main offer", placeholder: "What do they buy?" },
  { key: "currentReality", label: "Current reality", placeholder: "Where is the business really at, today?" },
  { key: "breakthrough", label: "Breakthrough needed", placeholder: "What has to change?" },
  { key: "vision", label: "24–36 month vision", placeholder: "Where should this be in 2-3 years?" },
  { key: "milestones", label: "6–12 month milestones", placeholder: "What has to be true a year from now?" },
  { key: "mainConstraint", label: "Main constraint", placeholder: "What's actually holding this back?" },
  { key: "mainOpportunity", label: "Main opportunity", placeholder: "What's the highest-leverage opening?" },
];
const STORY_FIELDS: { key: keyof BusinessDefinition; label: string; placeholder: string }[] = [
  { key: "currentState", label: "Current state", placeholder: "How would you honestly describe where things are right now?" },
  { key: "currentStory", label: "Current story", placeholder: "What's the story you keep telling yourself or your team about why things are this way?" },
  { key: "newStory", label: "New, more useful story", placeholder: "What's a more empowering — and still true — way to see the same situation?" },
  { key: "strategy", label: "Strategy that follows from it", placeholder: "Given that new story, what's the actual plan?" },
];
const FORCE_LIST: ForceNumber[] = [1, 2, 3, 4, 5, 6, 7];
// A starting set of action items per Force — original phrasing, generic
// business fundamentals, not any third-party workbook's text. The point is
// to give the 7 Systems tab something other than a blank table; every item
// is editable/removable, not prescriptive gospel. Exported: also used by
// funnel-studio.tsx to seed a fresh playbook-driven project.
export const FORCE_STARTER_KIT: { force: ForceNumber; principle: string; actionItem: string }[] = [
  { force: 1, principle: "Know your numbers", actionItem: "Document current revenue, cost, and profit per customer so every decision has a real baseline." },
  { force: 1, principle: "See the whole business", actionItem: "Map the business on one page: who you serve, what you sell, how people find you, how you deliver." },
  { force: 2, principle: "Differentiate deliberately", actionItem: "Write down the one thing this business does better or differently than the obvious alternative." },
  { force: 2, principle: "Test before you commit", actionItem: "Pick one new offer or channel idea and run a small, cheap test before investing heavily." },
  { force: 3, principle: "Promise what you can prove", actionItem: "List the specific outcomes the product promises, and confirm each one is actually deliverable." },
  { force: 3, principle: "Speak to one person", actionItem: "Rewrite the main sales message for a single, specific ideal customer instead of \"everyone\"." },
  { force: 4, principle: "Systemize the close", actionItem: "Write a repeatable sales script or checklist so results don't depend on one person's memory." },
  { force: 4, principle: "Track the funnel", actionItem: "Record how many leads become calls, and how many calls become sales, every week." },
  { force: 5, principle: "Plan for the tax bill", actionItem: "Set aside a fixed percentage of every sale for taxes before spending anything else." },
  { force: 5, principle: "Protect the business", actionItem: "Confirm contracts, terms of service, and business entity are actually in place and current." },
  { force: 6, principle: "Document the how", actionItem: "Write down the steps for the most repeated task so it can be handed off to someone else." },
  { force: 6, principle: "Fix the biggest leak first", actionItem: "Identify the single funnel step with the worst conversion rate and commit to one change to improve it." },
  { force: 7, principle: "Keep the promises you make", actionItem: "List every promise made to customers during the sale and confirm each one is actually being delivered." },
  { force: 7, principle: "Ask for the referral", actionItem: "Build a simple moment after delivery where happy customers are asked to refer or leave a review." },
];
const STATUS_CYCLE: Record<ForceActionItem["status"], ForceActionItem["status"]> = { open: "in_progress", in_progress: "done", done: "open" };
const STATUS_COLOR: Record<ForceActionItem["status"], string> = { open: "#64748b", in_progress: "#d97706", done: "#16a34a" };
const PRIORITY_CYCLE: Record<ForceActionItem["priority"], ForceActionItem["priority"]> = { low: "medium", medium: "high", high: "low" };
const PRIORITY_COLOR: Record<ForceActionItem["priority"], string> = { low: "#64748b", medium: "#2563eb", high: "#dc2626" };
const CONFIDENCE_CYCLE: Record<ActionConfidence, ActionConfidence> = { low: "medium", medium: "high", high: "low" };
const CONFIDENCE_COLOR: Record<ActionConfidence, string> = { low: "#dc2626", medium: "#d97706", high: "#16a34a" };
const LINKED_KPI_OPTIONS: { value: LinkedKpi; label: string }[] = [
  { value: "grossProfit", label: "Gross profit" }, { value: "revenue", label: "Revenue" }, { value: "buyers", label: "Buyers" },
  { value: "cost", label: "Cost" }, { value: "mrr", label: "MRR" }, { value: "ltv", label: "LTV" },
];

function exportBusinessReportPdf(report: BusinessReport, businessName: string | undefined, currency: string): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  let y = 56;
  const pageH = doc.internal.pageSize.getHeight();
  const nextLine = (dy: number) => { y += dy; if (y > pageH - 48) { doc.addPage(); y = 56; } };

  doc.setFontSize(20).setFont("helvetica", "bold");
  doc.text(businessName?.trim() || "Business report", marginX, y);
  nextLine(18);
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(107, 114, 128);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, marginX, y);
  doc.setTextColor(17, 24, 39);
  nextLine(28);

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("Growth Brief", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  for (const [label, val] of [["Breakthrough", report.brief.breakthrough], ["Vision", report.brief.vision], ["Main opportunity", report.brief.mainOpportunity]] as const) {
    if (!val) continue;
    doc.text(`${label}: ${val}`, marginX, y, { maxWidth: 500 });
    nextLine(16);
  }

  nextLine(10);
  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("Freedom Plan", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`Freedom Fund: ${formatMoney(report.moneyMachine.freedomFundMonthly, currency)}/mo (${formatMoney(report.moneyMachine.freedomFundAnnual, currency)}/yr)`, marginX, y);
  nextLine(16);
  doc.text(`Security ${formatMoney(report.moneyMachine.securityMonthly, currency)} · Growth ${formatMoney(report.moneyMachine.growthMonthly, currency)} · Dream ${formatMoney(report.moneyMachine.dreamMonthly, currency)}`, marginX, y);
  nextLine(16);
  const ml = report.moneyMachineLedger;
  doc.text(`The Fund (actual): Security ${formatMoney(ml.security.balance, currency)}${ml.security.progressPct != null ? ` (${ml.security.progressPct}%)` : ""} · Growth ${formatMoney(ml.growth.balance, currency)}${ml.growth.progressPct != null ? ` (${ml.growth.progressPct}%)` : ""} · Dream ${formatMoney(ml.dream.balance, currency)}${ml.dream.progressPct != null ? ` (${ml.dream.progressPct}%)` : ""}`, marginX, y, { maxWidth: 500 });
  nextLine(24);

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("5 Profit Levers", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`Combined effect: ${report.profitDrivers.compoundMultiplier.toFixed(2)}x — profit ${formatMoney(report.profitDrivers.profitBaseline, currency)} -> ${formatMoney(report.profitDrivers.profitImproved, currency)}`, marginX, y);
  nextLine(24);

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("Client Advocacy", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`Score: ${report.ravingFans.score}/100 (${report.ravingFans.band})`, marginX, y);
  nextLine(24);

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("Business Readiness", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(report.readiness.score === null ? "Not enough data yet — no goals, assumptions or experiments logged." : `Score: ${report.readiness.score}/100 (${report.readiness.label})`, marginX, y);
  nextLine(16);
  for (const issue of report.readiness.topIssues) {
    doc.text(`- ${issue}`, marginX, y, { maxWidth: 500 });
    nextLine(16);
  }
  nextLine(8);

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("Top Actions", marginX, y);
  nextLine(18);
  doc.setFontSize(11).setFont("helvetica", "normal");
  if (report.brief.topActions.length === 0) {
    doc.text("None logged yet.", marginX, y);
    nextLine(16);
  } else {
    for (const a of report.brief.topActions) {
      doc.text(`- ${a.actionItem} (System ${a.force})`, marginX, y, { maxWidth: 500 });
      nextLine(16);
    }
  }

  doc.save(`${(businessName?.trim() || "business")}-report.pdf`);
}

function exportBusinessReportCsv(report: BusinessReport, businessName: string | undefined, currency: string, scenarioComparison?: ScenarioComparison | null): void {
  const rows: (string | number)[][] = [["Section", "Metric", "Value"]];
  rows.push(["Brief", "Business name", report.brief.businessName || ""]);
  rows.push(["Brief", "Breakthrough", report.brief.breakthrough || ""]);
  rows.push(["Brief", "Vision", report.brief.vision || ""]);
  rows.push(["Brief", "Main opportunity", report.brief.mainOpportunity || ""]);
  rows.push(["Brief", "Main constraint", report.brief.mainConstraint || ""]);
  for (const a of report.brief.topActions) {
    rows.push(["Top action", `System ${a.force} — ${a.actionItem}`, a.dollarValue != null ? formatMoney(a.dollarValue, currency) : ""]);
  }
  rows.push(["Freedom Plan", "Monthly profit", formatMoney(report.moneyMachine.monthlyProfit, currency)]);
  rows.push(["Freedom Plan", "Freedom Fund (monthly)", formatMoney(report.moneyMachine.freedomFundMonthly, currency)]);
  rows.push(["Freedom Plan", "Freedom Fund (annual)", formatMoney(report.moneyMachine.freedomFundAnnual, currency)]);
  rows.push(["Freedom Plan", "Security", formatMoney(report.moneyMachine.securityMonthly, currency)]);
  rows.push(["Freedom Plan", "Growth", formatMoney(report.moneyMachine.growthMonthly, currency)]);
  rows.push(["Freedom Plan", "Dream", formatMoney(report.moneyMachine.dreamMonthly, currency)]);
  rows.push(["The Fund (actual)", "Security balance", formatMoney(report.moneyMachineLedger.security.balance, currency)]);
  rows.push(["The Fund (actual)", "Growth balance", formatMoney(report.moneyMachineLedger.growth.balance, currency)]);
  rows.push(["The Fund (actual)", "Dream balance", formatMoney(report.moneyMachineLedger.dream.balance, currency)]);
  rows.push(["Profit Levers", "Combined multiplier", `${report.profitDrivers.compoundMultiplier.toFixed(2)}x`]);
  rows.push(["Profit Levers", "Baseline profit", formatMoney(report.profitDrivers.profitBaseline, currency)]);
  rows.push(["Profit Levers", "Improved profit", formatMoney(report.profitDrivers.profitImproved, currency)]);
  rows.push(["Client Advocacy", "Score", `${report.ravingFans.score}/100`]);
  rows.push(["Client Advocacy", "Band", report.ravingFans.band]);
  rows.push(["Force Actions", "Total / done", `${report.forceActionSummary.done}/${report.forceActionSummary.total}`]);
  rows.push(["Force Actions", "Dollar value still open", formatMoney(report.forceActionSummary.totalDollarValue, currency)]);
  rows.push(["Business Readiness", "Score", report.readiness.score === null ? "no data" : `${report.readiness.score}/100`]);
  rows.push(["Business Readiness", "Label", report.readiness.label]);
  for (const issue of report.readiness.topIssues) {
    rows.push(["Business Readiness", "Issue", issue]);
  }
  if (scenarioComparison && scenarioComparison.scenarios.length > 0) {
    rows.push(["Scenario", "Base plan revenue", formatMoney(scenarioComparison.base.revenue, currency)]);
    rows.push(["Scenario", "Base plan profit", formatMoney(scenarioComparison.base.grossProfit, currency)]);
    for (const s of scenarioComparison.scenarios) {
      rows.push([`Scenario: ${s.name}`, "Revenue Δ", formatMoney(s.delta.revenue, currency)]);
      rows.push([`Scenario: ${s.name}`, "Profit Δ", formatMoney(s.delta.grossProfit, currency)]);
    }
  }

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${(businessName?.trim() || "business")}-report.csv`; a.click();
  URL.revokeObjectURL(url);
}

/** A complete, self-contained HTML document — the same content as the PDF/
 *  email export, styled as a standalone page. This is what actually gets
 *  stored and served at /share/[token]: a frozen snapshot, not a live view,
 *  the same way a PDF is frozen at export time. */
function buildReportShareHtml(report: BusinessReport, businessName: string | undefined, currency: string): string {
  const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const name = businessName?.trim() || "Business";
  const section = (title: string, rows: string[]): string =>
    `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="font-size:11px;letter-spacing:0.6px;color:#64748b;font-weight:700;margin-bottom:10px">${esc(title.toUpperCase())}</div>
      ${rows.join("")}
    </div>`;
  const row = (label: string, value: string, color = "#0f172a"): string =>
    `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#64748b">${esc(label)}</span><span style="font-weight:500;color:${color}">${esc(value)}</span></div>`;

  const briefRows: string[] = [];
  if (report.brief.breakthrough) briefRows.push(row("Breakthrough", report.brief.breakthrough));
  if (report.brief.vision) briefRows.push(row("Vision", report.brief.vision));
  if (report.brief.mainOpportunity) briefRows.push(row("Main opportunity", report.brief.mainOpportunity));
  if (briefRows.length === 0) briefRows.push(`<div style="font-size:13px;color:#94a3b8">Not filled in yet.</div>`);

  const ml = report.moneyMachineLedger;
  const freedomRows = [
    row("Freedom Fund (monthly / annual)", `${formatMoney(report.moneyMachine.freedomFundMonthly, currency)} / ${formatMoney(report.moneyMachine.freedomFundAnnual, currency)}`, "#2563eb"),
    row("Security", `${formatMoney(report.moneyMachine.securityMonthly, currency)}/mo`),
    row("Growth", `${formatMoney(report.moneyMachine.growthMonthly, currency)}/mo`),
    row("Dream", `${formatMoney(report.moneyMachine.dreamMonthly, currency)}/mo`),
    row("The Fund — Security balance", `${formatMoney(ml.security.balance, currency)}${ml.security.progressPct != null ? ` (${ml.security.progressPct}%)` : ""}`, "#16a34a"),
    row("The Fund — Growth balance", `${formatMoney(ml.growth.balance, currency)}${ml.growth.progressPct != null ? ` (${ml.growth.progressPct}%)` : ""}`, "#16a34a"),
    row("The Fund — Dream balance", `${formatMoney(ml.dream.balance, currency)}${ml.dream.progressPct != null ? ` (${ml.dream.progressPct}%)` : ""}`, "#16a34a"),
  ];

  const readinessRows = [
    row("Score", report.readiness.score === null ? "Not enough data yet" : `${report.readiness.score}/100 (${report.readiness.label})`, "#7c3aed"),
    ...report.readiness.topIssues.map((issue) => `<div style="font-size:12px;color:#dc2626;margin-top:4px">⚠ ${esc(issue)}</div>`),
  ];

  const actionsRows = report.brief.topActions.length === 0
    ? [`<div style="font-size:13px;color:#94a3b8">None logged yet.</div>`]
    : report.brief.topActions.map((a, i) => `<div style="font-size:13px;padding:6px 0;border-top:${i > 0 ? "1px solid #e2e8f0" : "none"}">${esc(a.actionItem)} <span style="color:#94a3b8">· System ${a.force}</span>${a.dollarValue ? ` — ${esc(formatMoney(a.dollarValue, currency))}` : ""}</div>`);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} — Growth Brief</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:28px 16px">
<div style="max-width:640px;margin:0 auto">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;flex-wrap:wrap;gap:8px">
    <h1 style="font-size:20px;margin:0">${esc(name)} — Growth Brief</h1>
    <span style="font-size:11px;color:#94a3b8;background:#e2e8f0;border-radius:999px;padding:4px 10px">Shared snapshot · ${esc(new Date(report.generatedAt).toLocaleDateString())}</span>
  </div>
  <div style="font-size:12px;color:#94a3b8;margin-bottom:20px">Read-only — this is a point-in-time snapshot, not a live view of the current plan.</div>
  ${section("Growth Brief", briefRows)}
  ${section("Freedom Plan", freedomRows)}
  ${section("Business Readiness", readinessRows)}
  ${section("Client Advocacy", [row("Score", `${report.ravingFans.score}/100 (${report.ravingFans.band})`)])}
  ${section("Top Actions", actionsRows)}
</div>
</body></html>`;
}

/** Plain-text version of the same report, for the "email me this report"
 *  button — same sections as the PDF, no markup, so it reads cleanly in any
 *  mail client. */
function buildReportEmailText(report: BusinessReport, businessName: string | undefined, currency: string): string {
  const lines: string[] = [];
  lines.push(`${businessName?.trim() || "Business"} — Growth Brief`);
  lines.push(`Generated ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push("");
  lines.push("GROWTH BRIEF");
  if (report.brief.breakthrough) lines.push(`Breakthrough: ${report.brief.breakthrough}`);
  if (report.brief.vision) lines.push(`Vision: ${report.brief.vision}`);
  if (report.brief.mainOpportunity) lines.push(`Main opportunity: ${report.brief.mainOpportunity}`);
  lines.push("");
  lines.push("FREEDOM PLAN");
  lines.push(`Freedom Fund: ${formatMoney(report.moneyMachine.freedomFundMonthly, currency)}/mo (${formatMoney(report.moneyMachine.freedomFundAnnual, currency)}/yr)`);
  lines.push(`Security ${formatMoney(report.moneyMachine.securityMonthly, currency)} · Growth ${formatMoney(report.moneyMachine.growthMonthly, currency)} · Dream ${formatMoney(report.moneyMachine.dreamMonthly, currency)}`);
  const ml = report.moneyMachineLedger;
  lines.push(`The Fund (actual): Security ${formatMoney(ml.security.balance, currency)}${ml.security.progressPct != null ? ` (${ml.security.progressPct}%)` : ""} · Growth ${formatMoney(ml.growth.balance, currency)}${ml.growth.progressPct != null ? ` (${ml.growth.progressPct}%)` : ""} · Dream ${formatMoney(ml.dream.balance, currency)}${ml.dream.progressPct != null ? ` (${ml.dream.progressPct}%)` : ""}`);
  lines.push("");
  lines.push("5 PROFIT LEVERS");
  lines.push(`Combined effect: ${report.profitDrivers.compoundMultiplier.toFixed(2)}x — profit ${formatMoney(report.profitDrivers.profitBaseline, currency)} -> ${formatMoney(report.profitDrivers.profitImproved, currency)}`);
  lines.push("");
  lines.push("CLIENT ADVOCACY");
  lines.push(`Score: ${report.ravingFans.score}/100 (${report.ravingFans.band})`);
  lines.push("");
  lines.push("BUSINESS READINESS");
  lines.push(report.readiness.score === null ? "Not enough data yet." : `Score: ${report.readiness.score}/100 (${report.readiness.label})`);
  for (const issue of report.readiness.topIssues) lines.push(`- ${issue}`);
  lines.push("");
  lines.push("TOP ACTIONS");
  if (report.brief.topActions.length === 0) {
    lines.push("None logged yet.");
  } else {
    for (const a of report.brief.topActions) {
      lines.push(`- ${a.actionItem} (System ${a.force})${a.dollarValue ? ` — ${formatMoney(a.dollarValue, currency)}` : ""}`);
    }
  }
  return lines.join("\n");
}

export function ProgramCentre({ definition, patchDefinition, forceActions, addForceAction, patchForceAction, removeForceAction, currency, moneyMachineCfg, patchMoneyMachine, monthlyProfit, profitSource, moneyMachineTargets, patchMoneyMachineTargets, moneyMachineLedger, addLedgerEntry, removeLedgerEntry, shareReport, unshareReport, getShareStatus, objections, addObjection, removeObjection, hooks, addHook, removeHook, generateHooksWithAi, aiHooksBusy, aiHooksErr, profitDrivers, patchProfitDrivers, driverBaseline, monthlyVisitors, clientPromises, addClientPromise, toggleClientPromise, removeClientPromise, ravingFansInputs, patchRavingFans, mindfulness, addMindfulness, removeMindfulness, goals, addGoal, updateGoal, removeGoal, assumptions, addAssumption, updateAssumption, removeAssumption, experiments, addExperiment, updateExperiment, removeExperiment, canvasNodes, risk, variance, scenarioComparison, onContinueToCanvas, visitedLessons, onVisitLesson, introSeen, onDismissIntro, graduationSeen, onAckGraduation, realitySuggestions, suggestionSource, realityHref, grounding }: {
  definition: BusinessDefinition; patchDefinition: (p: Partial<BusinessDefinition>) => void;
  forceActions: ForceActionItem[]; addForceAction: (force: ForceNumber, principle: string, actionItem: string, dollarValue?: number, deadline?: string, owner?: string) => void;
  patchForceAction: (id: string, p: Partial<ForceActionItem>) => void; removeForceAction: (id: string) => void;
  currency: string;
  moneyMachineCfg: MoneyMachineConfig; patchMoneyMachine: (p: Partial<MoneyMachineConfig>) => void; monthlyProfit: number; profitSource: "plan" | "actual";
  moneyMachineTargets: MoneyMachineTargets; patchMoneyMachineTargets: (p: Partial<MoneyMachineTargets>) => void;
  moneyMachineLedger: LedgerEntry[]; addLedgerEntry: (bucket: LedgerBucket, kind: LedgerKind, amount: number, note?: string) => void; removeLedgerEntry: (id: string) => void;
  shareReport: (html: string) => Promise<{ url: string; expiresAt: number } | { error: string }>;
  unshareReport: () => Promise<boolean>;
  getShareStatus: () => Promise<{ url: string; expiresAt: number } | null>;
  objections: ObjectionEntry[]; addObjection: (objection: string, response: string) => void; removeObjection: (id: string) => void;
  hooks: HookEntry[]; addHook: (hook: string, angle?: string) => void; removeHook: (id: string) => void;
  generateHooksWithAi: () => void; aiHooksBusy: boolean; aiHooksErr: string;
  profitDrivers: ProfitDriverInputs; patchProfitDrivers: (p: Partial<ProfitDriverInputs>) => void;
  driverBaseline: { revenue: number; cost: number }; monthlyVisitors: number;
  clientPromises: ClientPromise[]; addClientPromise: (p: string) => void; toggleClientPromise: (id: string) => void; removeClientPromise: (id: string) => void;
  ravingFansInputs: RavingFansInputs; patchRavingFans: (p: Partial<RavingFansInputs>) => void;
  mindfulness: MindfulnessEntry[]; addMindfulness: (kind: MindfulnessKind, text: string) => void; removeMindfulness: (id: string) => void;
  goals: GoalNode[]; addGoal: (level: GoalLevel, title: string, parentId?: string) => void;
  updateGoal: (id: string, patch: Partial<Omit<GoalNode, "id" | "createdAt">>) => void; removeGoal: (id: string) => void;
  assumptions: AssumptionEntry[]; addAssumption: (text: string, confidence: AssumptionConfidence, category?: string) => void;
  updateAssumption: (id: string, patch: Partial<Omit<AssumptionEntry, "id" | "createdAt">>) => void; removeAssumption: (id: string) => void;
  experiments: ExperimentEntry[]; addExperiment: (hypothesis: string, linkedAssumptionId?: string) => void;
  updateExperiment: (id: string, patch: Partial<Omit<ExperimentEntry, "id" | "createdAt">>) => void; removeExperiment: (id: string) => void;
  canvasNodes: { id: string; label: string }[];
  risk: RiskReport | null; variance: VarianceReport | null;
  scenarioComparison: ScenarioComparison | null;
  onContinueToCanvas: () => void;
  visitedLessons: string[]; onVisitLesson: (key: string) => void;
  introSeen: boolean; onDismissIntro: () => void;
  graduationSeen: boolean; onAckGraduation: () => void;
  /** Values already captured elsewhere in Business-OS (the reality map, Brand
   *  Brain, the Offer tool, the Growth Constraint tool — see
   *  lib/studio/*-bridge.ts), mapped to definition keys — offered as one-click
   *  "use this" suggestions on empty fields so a founder never retypes what
   *  Business-OS already knows. */
  realitySuggestions?: Partial<BusinessDefinition>;
  /** Per-field human label for where a suggestion came from (e.g. "your Offer
   *  tool"), shown on the "use this" chip. A field with a suggestion but no
   *  entry here falls back to a generic phrase. */
  suggestionSource?: Partial<Record<keyof BusinessDefinition, string>>;
  /** Deep-link to the unified Business profile (carries ?ws=), for "see it all". */
  realityHref?: string;
  /** Brand + strategy grounding for the per-field "✨ AI" drafts, so they write
   *  in this business's voice and strategy instead of drafting blind. */
  grounding?: Grounding | null;
}) {
  type TabKey = "define" | "story" | "forces" | "money" | "objections" | "hooks" | "drivers" | "raving" | "mindfulness" | "goals" | "assumptions" | "experiments" | "readiness" | "brief";
  const progressCtx = { definition, forceActions, mindfulness, clientPromises, ravingFansInputs, visitedLessons };
  const [tab, setTab] = useState<TabKey>(() => (computeProgramProgress(progressCtx).firstIncomplete as TabKey | null) ?? "define");
  // Guided course mode: the same tabs, walked in a fixed teaching order with
  // a short prompt per lesson and Back/Next instead of free jumping. "All
  // tools" mode is the original flat tab bar, still there for revising
  // anything out of order. Objections/Hooks are supplementary swipe files,
  // not part of the core lesson sequence, so they only live in All tools.
  const [courseMode, setCourseMode] = useState<"guided" | "all">("guided");
  // Persisted (survives a reload) — money/drivers/brief lessons have no
  // other "wrote something down" signal, so their done-ness is "opened it
  // at least once." Also what powers the library's resume-here badge.
  const goTo = (k: TabKey) => { setTab(k); onVisitLesson(k); };
  const [emailReportBusy, setEmailReportBusy] = useState(false);
  const [emailReportMsg, setEmailReportMsg] = useState("");
  const [shareInfo, setShareInfo] = useState<{ url: string; expiresAt: number } | null>(null);
  const [shareLoaded, setShareLoaded] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  useEffect(() => {
    if (tab !== "brief" || shareLoaded) return;
    setShareLoaded(true);
    void getShareStatus().then(setShareInfo);
  }, [tab, shareLoaded, getShareStatus]);
  const [draftForce, setDraftForce] = useState<ForceNumber>(1);
  const [draftPrinciple, setDraftPrinciple] = useState("");
  const [draftAction, setDraftAction] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [draftOwner, setDraftOwner] = useState("");
  const [draftObjection, setDraftObjection] = useState("");
  const [draftResponse, setDraftResponse] = useState("");
  const [draftHook, setDraftHook] = useState("");
  const [draftAngle, setDraftAngle] = useState("");
  const [draftGoalLevel, setDraftGoalLevel] = useState<GoalLevel>("vision");
  const [draftGoalTitle, setDraftGoalTitle] = useState("");
  const [draftGoalParent, setDraftGoalParent] = useState("");
  const [draftAssumptionText, setDraftAssumptionText] = useState("");
  const [draftAssumptionConfidence, setDraftAssumptionConfidence] = useState<AssumptionConfidence>("medium");
  const [draftAssumptionCategory, setDraftAssumptionCategory] = useState("");
  const [draftExperimentHypothesis, setDraftExperimentHypothesis] = useState("");
  const [draftExperimentAssumption, setDraftExperimentAssumption] = useState("");
  /** Which experiment cards have their metric/baseline/audience/owner/etc.
   *  "more details" section open — most experiments only need the top row,
   *  so the extra fields are opt-in per card rather than always-on clutter. */
  const [expandedExperiments, setExpandedExperiments] = useState<Set<string>>(new Set());
  const [draftLedgerBucket, setDraftLedgerBucket] = useState<LedgerBucket>("security");
  const [draftLedgerKind, setDraftLedgerKind] = useState<LedgerKind>("contribution");
  const [draftLedgerAmount, setDraftLedgerAmount] = useState("");
  const [draftLedgerNote, setDraftLedgerNote] = useState("");
  const [draftPromise, setDraftPromise] = useState("");
  const [draftAssumption, setDraftAssumption] = useState("");
  const [draftOpportunity, setDraftOpportunity] = useState("");
  const [projGrowth, setProjGrowth] = useState(0);
  const summary = useMemo(() => summarizeForceActions(forceActions), [forceActions]);
  const report = useMemo(
    () => buildBusinessReport(definition, forceActions, monthlyProfit, moneyMachineCfg, driverBaseline, profitDrivers, clientPromises, ravingFansInputs, undefined, goals, assumptions, experiments, moneyMachineLedger, moneyMachineTargets),
    [definition, forceActions, monthlyProfit, moneyMachineCfg, driverBaseline, profitDrivers, clientPromises, ravingFansInputs, goals, assumptions, experiments, moneyMachineLedger, moneyMachineTargets],
  );
  const brief: TransformationBrief = report.brief;
  const decide = useMemo(() => buildDecidePhaseSummary(forceActions, risk, variance), [forceActions, risk, variance]);

  // The course sequence: same tabs as All tools, walked in a fixed teaching
  // order with a "why this, now" prompt per lesson. "Done" is derived from
  // whatever's already been written down — same convention as the onboarding
  // checklist elsewhere in the app — not a separate flag that can drift out
  // of sync with the actual answers.
  const LESSON_COPY: Record<LessonKey, { title: string; prompt: string }> = {
    define: { title: "Lesson 1 — Define the business", prompt: "Write these down before anything else. Every later lesson builds on what you put here — vague answers here make everything after it vague too." },
    story: { title: "Lesson 2 — State, Story & Strategy", prompt: "The story you tell yourself about the business shapes the strategy you'll actually follow. Write the honest current one, then a more useful one — not a fantasy, just more useful." },
    mindfulness: { title: "Lesson 3 — What are you missing?", prompt: "Name at least one blind spot and one hidden opportunity on purpose. Things stay invisible until someone writes them down." },
    money: { title: "Lesson 4 — The Freedom Plan", prompt: "Decide, in advance, what happens to profit before it arrives. Set your Freedom Fund and bucket split — revisit it any time the numbers change." },
    forces: { title: "Lesson 5 — The 7 Systems", prompt: "Work through each System and log at least one real action item with a dollar value. This is the list the whole plan gets built from." },
    drivers: { title: "Lesson 6 — The 5 Profit Levers", prompt: "Small, realistic lifts compound. Set a % for each lever and see the combined effect on this model's actual numbers." },
    raving: { title: "Lesson 7 — Client Advocacy", prompt: "Log what you actually promise clients, and be honest about whether it's delivered. This is what turns customers into referrals." },
    brief: { title: "Lesson 8 — The Brief", prompt: "Read it all back as one story. If something reads wrong, that's a sign to go back and revise that lesson — not to ignore the brief." },
  };
  const progress = computeProgramProgress(progressCtx);
  const LESSON_STEPS: { key: TabKey; title: string; prompt: string; done: boolean }[] = progress.statuses.map((s) => ({ key: s.key, done: s.done, ...LESSON_COPY[s.key] }));
  const stepIdx = LESSON_STEPS.findIndex((s) => s.key === tab);
  const currentStep = stepIdx >= 0 ? LESSON_STEPS[stepIdx] : null;
  const doneCount = progress.doneCount;

  if (courseMode === "guided" && !introSeen) {
    return (
      <div style={{ padding: 20, maxWidth: 640 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700, marginBottom: 6 }}>BUSINESS INTELLIGENCE</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Welcome to the Growth Program</div>
        <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
          This is an 8-lesson program that takes this business from a raw idea to a working, numbers-backed plan — before you touch the canvas, not instead of it.
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          Each lesson builds on the last: <b>Define</b> and <b>Story</b> get the thinking straight, <b>Mindfulness</b> surfaces what you're missing, <b>Freedom Plan</b> decides what happens to profit before it arrives, <b>7 Systems</b> and <b>Profit Levers</b> give you the actual numbers to work, <b>Client Advocacy</b> turns customers into referrals, and the <b>Brief</b> pulls it all into one story.
        </div>
        <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 22 }}>You can jump around anytime later via "All tools" — the order matters most on this first pass.</div>
        <button onClick={onDismissIntro} style={barPrimary}>Start Lesson 1 →</button>
      </div>
    );
  }

  if (progress.allDone && !graduationSeen) {
    return (
      <div style={{ padding: 20, maxWidth: 640 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.6, color: "#16a34a", fontWeight: 700, marginBottom: 6 }}>PROGRAM COMPLETE</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>You've completed the Growth Program 🎉</div>
        <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
          Every lesson has something written down — the business is defined, the numbers are set, and the Growth Brief has a real story to tell. That's the foundation the canvas builds on next.
        </div>
        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, marginBottom: 20, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px" }}>
          {buildDecidePhaseSummary(forceActions, risk, variance).decisionSummary}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { onAckGraduation(); setTab("brief"); }} style={barPrimary}>Review the Growth Brief</button>
          <button onClick={() => { onAckGraduation(); onContinueToCanvas(); }} style={barGhost}>Continue to Map →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>BUSINESS INTELLIGENCE</div>
        <div role="group" aria-label="Course mode" style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setCourseMode("guided")} aria-pressed={courseMode === "guided"} style={{ ...barGhost, fontSize: 11, padding: "3px 8px", background: courseMode === "guided" ? "var(--accent-soft)" : "transparent", color: courseMode === "guided" ? ACCENT : "var(--muted)" }}>📖 Guided course</button>
          <button onClick={() => setCourseMode("all")} aria-pressed={courseMode === "all"} style={{ ...barGhost, fontSize: 11, padding: "3px 8px", background: courseMode === "all" ? "var(--accent-soft)" : "transparent", color: courseMode === "all" ? ACCENT : "var(--muted)" }}>🗂 All tools</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>Define the business, work the 7 Systems, then generate the brief — before the canvas, not instead of it.</div>

      {courseMode === "all" && (() => {
        // Grouped, not a flat 14-tab wall: each tool reads as part of a named
        // stage of the work. "Persuasion" is the psychology of the sale for
        // THIS model (objections, hooks, advocacy) — per-funnel, so it lives
        // here rather than in the workspace-level Psychology pillar, which
        // works the overall offer/message. FLAT preserves a single roving
        // tab order across the groups for keyboard nav.
        const TAB_GROUPS: { label: string; tabs: readonly (readonly [TabKey, string])[] }[] = [
          { label: "Define", tabs: [["define", "Define"], ["story", "Story"], ["mindfulness", "Mindfulness"]] },
          { label: "Persuasion", tabs: [["objections", "Objections"], ["hooks", "Hooks"], ["raving", "Client Advocacy"]] },
          { label: "Numbers", tabs: [["forces", "7 Systems"], ["money", "Freedom Plan"], ["drivers", "Profit Levers"]] },
          { label: "Validate", tabs: [["goals", "Goal Hierarchy"], ["assumptions", "Assumptions"], ["experiments", "Experiments"], ["readiness", "Readiness Score"]] },
          { label: "Output", tabs: [["brief", "Reports"]] },
        ];
        const FLAT: readonly (readonly [TabKey, string])[] = TAB_GROUPS.flatMap((g) => g.tabs);
        return (
          <div role="tablist" aria-label="Business intelligence tools" style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            {TAB_GROUPS.map((g) => (
              <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.7, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", paddingLeft: 2 }}>{g.label}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {g.tabs.map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={tab === k} tabIndex={tab === k ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                        e.preventDefault();
                        const dir = e.key === "ArrowRight" ? 1 : -1;
                        const i = FLAT.findIndex(([fk]) => fk === k);
                        const n = (i + dir + FLAT.length) % FLAT.length;
                        goTo(FLAT[n]![0]);
                        e.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
                      }}
                      onClick={() => goTo(k)}
                      style={{ ...barGhost, background: tab === k ? "var(--accent-soft)" : "transparent", color: tab === k ? ACCENT : "var(--muted)", borderColor: tab === k ? ACCENT : "var(--border3)" }}>{label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {courseMode === "guided" && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {LESSON_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => goTo(s.key)} title={s.title}
                aria-label={`Lesson ${i + 1}: ${s.title}${s.done ? " (done)" : ""}`}
                aria-current={i === stepIdx ? "step" : undefined}
                style={{ flex: 1, height: 6, borderRadius: 999, border: "none", cursor: "pointer", background: s.done ? "#16a34a" : i === stepIdx ? ACCENT : "var(--border3)" }} />
            ))}
          </div>
          {currentStep && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{currentStep.title}</span>
                <span style={{ fontSize: 11, color: "var(--dim)" }}>Lesson {stepIdx + 1} of {LESSON_STEPS.length} · {doneCount}/{LESSON_STEPS.length} done</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{currentStep.prompt}</div>
            </div>
          )}
        </div>
      )}

      {tab === "define" && (
        <div>
          {realityHref && Object.keys(realitySuggestions ?? {}).length > 0 && (
            <div style={{ maxWidth: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--accent-soft)", border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
              <span>You've already answered some of this elsewhere in ONEVYRT. The dashed prompts below fill an empty field with what you saved there.</span>
              <a href={realityHref} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: ACCENT, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Open your Business profile →</a>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, maxWidth: 900 }}>
            {DEFINITION_FIELDS.map((f) => {
              const sug = String(realitySuggestions?.[f.key] ?? "").trim();
              const empty = !String(definition[f.key] ?? "").trim();
              return (
              <label key={f.key} style={{ display: "block" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 20 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{f.label}</span>
                  {f.key !== "businessName" && String(definition.businessName ?? "").trim() && (
                    <AiFieldButton label="AI" system={DEF_AI_SYSTEM}
                      user={withGrounding(grounding, `Business: "${String(definition.businessName ?? "").trim()}". ${DEFINITION_FIELDS.filter((x) => x.key !== f.key && x.key !== "businessName" && String(definition[x.key] ?? "").trim()).map((x) => `${x.label}: ${definition[x.key]}`).join("; ")} — write the "${f.label}" (${f.placeholder}).`)}
                      onDraft={(t) => patchDefinition({ [f.key]: t })} />
                  )}
                </span>
                <textarea value={definition[f.key] ?? ""} onChange={(e) => patchDefinition({ [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", minHeight: 56, marginTop: 4, boxSizing: "border-box", resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13, lineHeight: 1.4, fontFamily: "inherit" }} />
                {sug && empty && (() => {
                  const srcLabel = suggestionSource?.[f.key] ?? "elsewhere in ONEVYRT";
                  return (
                    <button type="button" onClick={() => patchDefinition({ [f.key]: sug })} title={`Fill this field from ${srcLabel}`}
                      style={{ marginTop: 6, display: "block", width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: `1px dashed ${ACCENT}`, borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "var(--text)", lineHeight: 1.35, fontFamily: "inherit" }}>
                      <span style={{ fontWeight: 700, color: ACCENT }}>From {srcLabel} · </span>
                      <span style={{ color: "var(--muted)" }}>{sug.length > 90 ? `${sug.slice(0, 90)}…` : sug}</span>
                      <span style={{ fontWeight: 700, color: ACCENT }}>  · Use</span>
                    </button>
                  );
                })()}
              </label>
              );
            })}
          </div>
        </div>
      )}

      {tab === "story" && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>The human layer before the numbers: what's actually going on, the story you've been telling yourself about it, a more useful one, and the strategy that follows.</div>
          {STORY_FIELDS.map((f) => (
            <label key={f.key} style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 20 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{f.label}</span>
                {String(definition.businessName ?? "").trim() && (
                  <AiFieldButton label="AI" system={DEF_AI_SYSTEM}
                    user={withGrounding(grounding, `Business: "${String(definition.businessName ?? "").trim()}". ${STORY_FIELDS.filter((x) => x.key !== f.key && String(definition[x.key] ?? "").trim()).map((x) => `${x.label}: ${definition[x.key]}`).join("; ")} — write the "${f.label}" (${f.placeholder}).`)}
                    onDraft={(t) => patchDefinition({ [f.key]: t })} />
                )}
              </span>
              <textarea value={definition[f.key] ?? ""} onChange={(e) => patchDefinition({ [f.key]: e.target.value })}
                placeholder={f.placeholder}
                style={{ width: "100%", minHeight: 64, marginTop: 4, boxSizing: "border-box", resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13, lineHeight: 1.4, fontFamily: "inherit" }} />
            </label>
          ))}
        </div>
      )}

      {tab === "forces" && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 16, fontSize: 13, color: "var(--muted)", alignItems: "center" }}>
            <span>{summary.total} action{summary.total === 1 ? "" : "s"}</span>
            <span style={{ color: "#16a34a" }}>{summary.done} done</span>
            <span style={{ color: "#d97706" }}>{summary.inProgress} in progress</span>
            <span>{summary.open} open</span>
            {summary.totalDollarValue > 0 && <span style={{ fontWeight: 500, color: "var(--text)" }}>{formatMoney(summary.totalDollarValue, currency)} still on the table</span>}
            <button onClick={() => {
              const existing = new Set(forceActions.map((a) => a.actionItem.toLowerCase()));
              for (const s of FORCE_STARTER_KIT) if (!existing.has(s.actionItem.toLowerCase())) addForceAction(s.force, s.principle, s.actionItem);
            }} style={{ ...barGhost, marginLeft: "auto" }} title="Adds a starting set of action items across all 7 Systems — edit or remove any of them">
              ✦ Load 7 Systems starter kit
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center", background: "var(--surface2)", padding: 10, borderRadius: 8 }}>
            <select value={draftForce} onChange={(e) => setDraftForce(Number(e.target.value) as ForceNumber)}
              style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
              {FORCE_LIST.map((f) => <option key={f} value={f}>System {f} — {FORCE_NAMES[f]}</option>)}
            </select>
            <input value={draftPrinciple} onChange={(e) => setDraftPrinciple(e.target.value)} placeholder="Principle"
              style={{ width: 160, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
            <input value={draftAction} onChange={(e) => setDraftAction(e.target.value)} placeholder="Action item"
              style={{ flex: 1, minWidth: 160, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
            <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder="$ value" type="number"
              style={{ width: 90, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
            <input value={draftDeadline} onChange={(e) => setDraftDeadline(e.target.value)} type="date" title="Deadline (optional)"
              style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
            <input value={draftOwner} onChange={(e) => setDraftOwner(e.target.value)} placeholder="Owner (optional)"
              style={{ width: 110, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
            <button onClick={() => {
              const v = parseFloat(draftValue);
              addForceAction(draftForce, draftPrinciple, draftAction, Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined, draftDeadline || undefined, draftOwner || undefined);
              setDraftPrinciple(""); setDraftAction(""); setDraftValue(""); setDraftDeadline(""); setDraftOwner("");
            }} style={barPrimary}>Add</button>
          </div>
          {forceActions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--dim)" }}>No action items yet. Add the moves that come out of working each Force.</div>
          ) : (
            FORCE_LIST.filter((f) => forceActions.some((a) => a.force === f)).map((f) => (
              <div key={f} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, marginBottom: 6 }}>SYSTEM {f} — {FORCE_NAMES[f].toUpperCase()}</div>
                {forceActions.filter((a) => a.force === f).map((a) => (
                  <div key={a.id} style={{ padding: "7px 9px", marginBottom: 5, borderRadius: 7, background: "var(--surface2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => patchForceAction(a.id, { status: STATUS_CYCLE[a.status] })} title="Click to cycle status"
                        style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                          background: `${STATUS_COLOR[a.status]}22`, color: STATUS_COLOR[a.status] }}>{a.status.replace("_", " ").toUpperCase()}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: a.status === "done" ? "var(--dim)" : "var(--text)", textDecoration: a.status === "done" ? "line-through" : "none" }}>{a.actionItem}</div>
                        {a.principle && <div style={{ fontSize: 11, color: "var(--dim)" }}>{a.principle}</div>}
                      </div>
                      {a.dollarValue ? <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>{formatMoney(a.dollarValue, currency)}</span> : null}
                      <button onClick={() => patchForceAction(a.id, { priority: PRIORITY_CYCLE[a.priority] })} title="Click to cycle priority"
                        style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                          background: `${PRIORITY_COLOR[a.priority]}22`, color: PRIORITY_COLOR[a.priority] }}>{a.priority.toUpperCase()}</button>
                      <button onClick={() => patchForceAction(a.id, { confidence: CONFIDENCE_CYCLE[a.confidence ?? "medium"] })} title="Click to cycle confidence this gets done"
                        style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                          background: `${CONFIDENCE_COLOR[a.confidence ?? "medium"]}22`, color: CONFIDENCE_COLOR[a.confidence ?? "medium"] }}>{(a.confidence ?? "medium").toUpperCase()} CONF.</button>
                      <button onClick={() => removeForceAction(a.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <input type="date" value={a.deadline ?? ""} onChange={(e) => patchForceAction(a.id, { deadline: e.target.value || undefined })} title="Deadline"
                        style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 5, padding: "3px 6px" }} />
                      <input type="text" value={a.owner ?? ""} onChange={(e) => patchForceAction(a.id, { owner: e.target.value || undefined })} placeholder="Owner" title="Owner"
                        style={{ width: 90, fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 5, padding: "3px 6px" }} />
                      <select value={a.linkedNodeId ?? ""} onChange={(e) => patchForceAction(a.id, { linkedNodeId: e.target.value || undefined })} title="Linked canvas node"
                        style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 5, padding: "3px 6px", maxWidth: 130 }}>
                        <option value="">No linked node</option>
                        {canvasNodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                      </select>
                      <select value={a.linkedKpi ?? ""} onChange={(e) => patchForceAction(a.id, { linkedKpi: (e.target.value || undefined) as ForceActionItem["linkedKpi"] })} title="Linked KPI"
                        style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 5, padding: "3px 6px" }}>
                        <option value="">No linked KPI</option>
                        {LINKED_KPI_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "money" && (() => {
        const proj = projectMoneyMachine(monthlyProfit, moneyMachineCfg);
        const ledgerSummary = summarizeLedger(moneyMachineLedger, moneyMachineTargets);
        const BUCKETS: { key: LedgerBucket; label: string; color: string; monthlyRate: number }[] = [
          { key: "security", label: "Security", color: "#16a34a", monthlyRate: proj.securityMonthly },
          { key: "growth", label: "Growth", color: "#2563eb", monthlyRate: proj.growthMonthly },
          { key: "dream", label: "Dream", color: "#7c3aed", monthlyRate: proj.dreamMonthly },
        ];
        const TARGET_KEY: Record<LedgerBucket, keyof MoneyMachineTargets> = { security: "securityTarget", growth: "growthTarget", dream: "dreamTarget" };
        const GOAL_DATE_KEY: Record<LedgerBucket, keyof MoneyMachineTargets> = { security: "securityGoalDate", growth: "growthGoalDate", dream: "dreamGoalDate" };
        const sortedLedger = [...moneyMachineLedger].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const today = new Date();
        return (
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>
            Set aside a share of profit first, then split it. Numbers below are live against {profitSource === "actual" ? "this project's real tracked" : "the current model's projected"} monthly gross profit
            {profitSource === "plan" && " — once tracking data comes in from ACTUAL, this switches to what actually happened instead of the plan"}.
          </div>
          <div style={{ fontSize: 12, color: "var(--dim)", background: "var(--surface2)", border: "1px dashed var(--border3)", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
            This is a plan, not a connected bank balance. Nothing here moves real money — the numbers above are what your profit model SUPPORTS, and "The Fund" below only tracks what you log by hand. Treat every figure on this tab as intent, not cash actually sitting anywhere.
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>FREEDOM FUND — % OF PROFIT SET ASIDE</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={50} step={1} value={Math.round(moneyMachineCfg.freedomFundRate * 100)}
                onChange={(e) => patchMoneyMachine({ freedomFundRate: Number(e.target.value) / 100 })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 13, fontWeight: 700, width: 42, textAlign: "right" }}>{Math.round(moneyMachineCfg.freedomFundRate * 100)}%</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {([["securityRate", "Security", "#16a34a"], ["growthRate", "Growth", "#2563eb"], ["dreamRate", "Dream", "#7c3aed"]] as const).map(([key, label, color]) => (
              <label key={key} style={{ display: "block", background: "var(--surface2)", borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 11, color, fontWeight: 700 }}>{label.toUpperCase()}</span>
                <input type="number" min={0} max={100} value={Math.round(moneyMachineCfg[key] * 100)}
                  onChange={(e) => patchMoneyMachine({ [key]: (parseFloat(e.target.value) || 0) / 100 } as Partial<MoneyMachineConfig>)}
                  style={{ width: "100%", marginTop: 4, boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
                <span style={{ fontSize: 10, color: "var(--dim)" }}>relative weight — normalised automatically</span>
              </label>
            ))}
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Monthly gross profit ({profitSource})</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(proj.monthlyProfit, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Freedom Fund (monthly / annual)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatMoney(proj.freedomFundMonthly, currency)} / {formatMoney(proj.freedomFundAnnual, currency)}</span>
            </div>
            {([["Security", proj.securityMonthly, proj.securityAnnual, "#16a34a"], ["Growth", proj.growthMonthly, proj.growthAnnual, "#2563eb"], ["Dream", proj.dreamMonthly, proj.dreamAnnual, "#7c3aed"]] as const).map(([label, m, a, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color }}>{label}</span>
                <span style={{ fontSize: 13 }}>{formatMoney(m, currency)}/mo <span style={{ color: "var(--dim)" }}>· {formatMoney(a, currency)}/yr</span></span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 4 }}>THE FUND</div>
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 14 }}>
              The projection above is what SHOULD happen every month. This is what actually has — log a real transfer into (or out of) each bucket, set a target, and watch the balance build.
            </div>
            {BUCKETS.map(({ key, label, color, monthlyRate }) => {
              const b = ledgerSummary[key];
              const months = monthsToTarget(b.balance, b.target, monthlyRate);
              const required = requiredMonthlyContribution(b.balance, b.target, b.goalDate, today);
              return (
                <div key={key} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{formatMoney(b.balance, currency)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--dim)" }}>Target</span>
                    <input type="number" min={0} value={b.target != null ? b.target / 100 : ""} placeholder="none set"
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        patchMoneyMachineTargets({ [TARGET_KEY[key]]: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined });
                      }}
                      style={{ width: 110, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "3px 7px", fontSize: 12 }} />
                    {b.target != null && (
                      <>
                        <span style={{ fontSize: 11, color: "var(--dim)" }}>by</span>
                        <input type="date" value={b.goalDate ?? ""}
                          onChange={(e) => patchMoneyMachineTargets({ [GOAL_DATE_KEY[key]]: e.target.value || undefined })}
                          style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "3px 7px", fontSize: 12 }} />
                      </>
                    )}
                    {b.target != null && (
                      <div style={{ flex: 1, minWidth: 60, height: 5, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${b.progressPct ?? 0}%`, background: color, borderRadius: 999 }} />
                      </div>
                    )}
                    {b.target != null && <span style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0 }}>{b.progressPct}%{months != null ? months === 0 ? " · met" : ` · ~${months}mo left at current pace` : ""}</span>}
                  </div>
                  {required != null && required > 0 && (
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>
                      To hit that date, you&apos;d need to set aside ~{formatMoney(Math.round(required), currency)}/mo from here.
                    </div>
                  )}
                  {b.goalDate && required == null && b.target != null && b.progressPct !== 100 && (
                    <div style={{ fontSize: 11, color: "#dc2626" }}>
                      That date has already passed — either move it, or raise the target once it&apos;s met.
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", background: "var(--surface2)", padding: 10, borderRadius: 8, marginTop: 4 }}>
              <select value={draftLedgerBucket} onChange={(e) => setDraftLedgerBucket(e.target.value as LedgerBucket)}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                <option value="security">Security</option>
                <option value="growth">Growth</option>
                <option value="dream">Dream</option>
              </select>
              <select value={draftLedgerKind} onChange={(e) => setDraftLedgerKind(e.target.value as LedgerKind)}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                <option value="contribution">Contribution (+)</option>
                <option value="withdrawal">Withdrawal (−)</option>
              </select>
              <input type="number" min={0} value={draftLedgerAmount} onChange={(e) => setDraftLedgerAmount(e.target.value)} placeholder="Amount"
                style={{ width: 100, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              <input value={draftLedgerNote} onChange={(e) => setDraftLedgerNote(e.target.value)} placeholder="Note (optional)"
                style={{ flex: 1, minWidth: 140, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              <button onClick={() => {
                const v = parseFloat(draftLedgerAmount);
                if (!(v > 0)) return;
                addLedgerEntry(draftLedgerBucket, draftLedgerKind, Math.round(v * 100), draftLedgerNote || undefined);
                setDraftLedgerAmount(""); setDraftLedgerNote("");
              }} style={barPrimary}>Log</button>
            </div>

            {sortedLedger.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {sortedLedger.slice(0, 20).map((e) => {
                  const bucketColor = BUCKETS.find((b) => b.key === e.bucket)?.color ?? "var(--text)";
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--dim)", flexShrink: 0 }}>{new Date(e.createdAt).toLocaleDateString()}</span>
                      <span style={{ color: bucketColor, fontWeight: 500, flexShrink: 0, textTransform: "capitalize" }}>{e.bucket}</span>
                      <span style={{ color: e.kind === "contribution" ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{e.kind === "contribution" ? "+" : "−"}{formatMoney(e.amount, currency)}</span>
                      {e.note && <span style={{ color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</span>}
                      <button onClick={() => removeLedgerEntry(e.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0, marginLeft: "auto" }}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {tab === "drivers" && (() => {
        const proj = simulateProfitDrivers(driverBaseline, profitDrivers);
        const DRIVER_FIELDS: { key: keyof ProfitDriverInputs; label: string; hint: string }[] = [
          { key: "leadsPct", label: "Leads / Traffic", hint: "More people into the top of the funnel" },
          { key: "salesProcessPct", label: "Sales Process", hint: "More of those leads become real conversations" },
          { key: "conversionPct", label: "Conversion", hint: "More of those conversations become sales" },
          { key: "transactionValuePct", label: "Transaction Value", hint: "Higher average order value" },
          { key: "retentionPct", label: "Retention / Follow-up", hint: "More repeat purchases and referrals" },
        ];
        return (
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 18 }}>Small improvements compound. Set a realistic % lift for each lever and see the combined effect on profit — against this model&apos;s current revenue and cost.</div>
          {DRIVER_FIELDS.map((f) => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{f.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: profitDrivers[f.key] > 0 ? "#16a34a" : profitDrivers[f.key] < 0 ? "#dc2626" : "var(--muted)" }}>
                  {profitDrivers[f.key] > 0 ? "+" : ""}{Math.round(profitDrivers[f.key] * 100)}%
                </span>
              </div>
              <input type="range" min={-50} max={100} step={1} value={Math.round(profitDrivers[f.key] * 100)}
                onChange={(e) => patchProfitDrivers({ [f.key]: Number(e.target.value) / 100 } as Partial<ProfitDriverInputs>)}
                style={{ width: "100%" }} />
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{f.hint}</div>
            </div>
          ))}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 18, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Combined effect</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{proj.compoundMultiplier.toFixed(2)}×</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Revenue</span>
              <span style={{ fontSize: 13 }}>{formatMoney(proj.baseline.revenue, currency)} → <b>{formatMoney(proj.improved.revenue, currency)}</b></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Cost</span>
              <span style={{ fontSize: 13 }}>{formatMoney(proj.baseline.cost, currency)} → <b>{formatMoney(proj.improved.cost, currency)}</b></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Profit</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: proj.profitLift >= 0 ? "#16a34a" : "#dc2626" }}>
                {formatMoney(proj.profitBaseline, currency)} → {formatMoney(proj.profitImproved, currency)}
                {" "}({proj.profitLift >= 0 ? "+" : ""}{formatMoney(proj.profitLift, currency)})
              </span>
            </div>
          </div>

          {(() => {
            // Diagnostic, not a scenario: probe each lever with the SAME +10%
            // in isolation and rank by the profit it moves, so the user can
            // see where their leverage actually is before touching the sliders.
            const sens = analyzeDriverSensitivity(driverBaseline, 0.1);
            const anyLeverage = sens.topDriver !== null;
            return (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 18, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Which lever first?</div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 14 }}>
                  A +10% test on each lever alone, ranked by the profit it moves against this model. Longer bar = more leverage here.
                </div>
                {!anyLeverage ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>No revenue or cost set yet — add the numbers to see where your leverage is.</div>
                ) : sens.drivers.map((d, i) => {
                  const pct = d.shareOfTop ?? 0;
                  const isTop = i === 0;
                  const barColor = d.profitLift > 0 ? "#16a34a" : d.profitLift < 0 ? "#dc2626" : "var(--muted)";
                  return (
                    <div key={d.driver} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: isTop ? 700 : 500 }}>
                          {isTop ? "→ " : ""}{d.label}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>
                          {d.profitLift >= 0 ? "+" : ""}{formatMoney(d.profitLift, currency)}
                        </span>
                      </div>
                      <div style={{ height: 8, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: barColor, borderRadius: 999, transition: "width .2s" }} />
                      </div>
                    </div>
                  );
                })}
                {anyLeverage && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    Highest-leverage lever right now: <b style={{ color: "var(--text)" }}>{sens.drivers[0]!.label}</b>. Start there.
                  </div>
                )}
              </div>
            );
          })()}
          <BreakEvenCard currency={currency} />
        </div>
        );
      })()}

      {tab === "raving" && (() => {
        const score = computeRavingFansScore(clientPromises, ravingFansInputs);
        const promiseSummary = summarizePromises(clientPromises);
        const bandColor = score.band === "raving" ? "#16a34a" : score.band === "solid" ? "#d97706" : "#64748b";
        return (
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 18 }}>Clients for life, not just clients. Log what you promise, whether it was delivered, and your honest read on retention and referrals.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${bandColor}1e`, border: `2px solid ${bandColor}` }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: bandColor }}>{score.score}</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", color: bandColor }}>{score.band}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {promiseSummary.rate != null ? `${Math.round(promiseSummary.rate * 100)}% of promises delivered · ` : "No promises logged yet · "}
                {Math.round(ravingFansInputs.retentionRate * 100)}% retention · {Math.round(ravingFansInputs.referralRate * 100)}% referral
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>RETENTION RATE</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input type="range" min={0} max={100} value={Math.round(ravingFansInputs.retentionRate * 100)}
                  onChange={(e) => patchRavingFans({ retentionRate: Number(e.target.value) / 100 })} style={{ flex: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 700, width: 38 }}>{Math.round(ravingFansInputs.retentionRate * 100)}%</span>
              </div>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>REFERRAL RATE</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input type="range" min={0} max={100} value={Math.round(ravingFansInputs.referralRate * 100)}
                  onChange={(e) => patchRavingFans({ referralRate: Number(e.target.value) / 100 })} style={{ flex: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 700, width: 38 }}>{Math.round(ravingFansInputs.referralRate * 100)}%</span>
              </div>
            </label>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, marginBottom: 8 }}>CLIENT PROMISES</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input value={draftPromise} onChange={(e) => setDraftPromise(e.target.value)} placeholder="What do you promise clients?"
              onKeyDown={(e) => { if (e.key === "Enter") { addClientPromise(draftPromise); setDraftPromise(""); } }}
              style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
            <button onClick={() => { addClientPromise(draftPromise); setDraftPromise(""); }} style={barPrimary}>Add</button>
          </div>
          {clientPromises.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--dim)" }}>No promises logged yet.</div>
          ) : (
            clientPromises.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "6px 8px", borderRadius: 7, background: "var(--surface2)" }}>
                <input type="checkbox" checked={p.delivered} onChange={() => toggleClientPromise(p.id)} style={{ cursor: "pointer", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: p.delivered ? "var(--text)" : "var(--muted)" }}>{p.promise}</span>
                <span style={{ fontSize: 11, color: p.delivered ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{p.delivered ? "Delivered" : "Not yet"}</span>
                <button onClick={() => removeClientPromise(p.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
              </div>
            ))
          )}
        </div>
        );
      })()}

      {tab === "mindfulness" && (() => {
        const assumptions = mindfulness.filter((m) => m.kind === "assumption");
        const opportunities = mindfulness.filter((m) => m.kind === "opportunity");
        return (
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>Blind spots and hidden openings, named on purpose so they don't stay invisible.</div>
          <label style={{ display: "block", marginBottom: 20, maxWidth: 500 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>ONE THING WORTH AN HOUR OF FOCUS THIS WEEK</span>
            <textarea value={definition.weeklyFocus ?? ""} onChange={(e) => patchDefinition({ weeklyFocus: e.target.value })}
              placeholder="What deserves real attention this week, even though it's easy to keep putting off?"
              style={{ width: "100%", minHeight: 48, marginTop: 4, boxSizing: "border-box", resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "7px 9px", fontSize: 13, lineHeight: 1.4, fontFamily: "inherit" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, marginBottom: 8 }}>WHAT ARE WE NOT SEEING?</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input value={draftAssumption} onChange={(e) => setDraftAssumption(e.target.value)} placeholder="A blind spot or missing assumption…"
                  onKeyDown={(e) => { if (e.key === "Enter") { addMindfulness("assumption", draftAssumption); setDraftAssumption(""); } }}
                  style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
                <button onClick={() => { addMindfulness("assumption", draftAssumption); setDraftAssumption(""); }} style={barPrimary}>Add</button>
              </div>
              {assumptions.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Nothing logged yet.</div>
              ) : (
                assumptions.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "8px 10px", borderRadius: 7, background: "var(--surface2)" }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{m.text}</span>
                    <button onClick={() => removeMindfulness(m.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                  </div>
                ))
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, marginBottom: 8 }}>HIDDEN OPPORTUNITIES</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input value={draftOpportunity} onChange={(e) => setDraftOpportunity(e.target.value)} placeholder="An opportunity hiding in a current problem…"
                  onKeyDown={(e) => { if (e.key === "Enter") { addMindfulness("opportunity", draftOpportunity); setDraftOpportunity(""); } }}
                  style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
                <button onClick={() => { addMindfulness("opportunity", draftOpportunity); setDraftOpportunity(""); }} style={barPrimary}>Add</button>
              </div>
              {opportunities.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Nothing logged yet.</div>
              ) : (
                opportunities.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "8px 10px", borderRadius: 7, background: "var(--surface2)" }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{m.text}</span>
                    <button onClick={() => removeMindfulness(m.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {tab === "objections" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>The pushback you hear on calls or in DMs, and the response that actually moves it — so nobody has to improvise it live.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, background: "var(--surface2)", padding: 10, borderRadius: 8 }}>
            <input value={draftObjection} onChange={(e) => setDraftObjection(e.target.value)} placeholder="The objection…"
              style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
            <textarea value={draftResponse} onChange={(e) => setDraftResponse(e.target.value)} placeholder="The response…"
              style={{ minHeight: 44, boxSizing: "border-box", resize: "vertical", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13, fontFamily: "inherit" }} />
            <button onClick={() => { addObjection(draftObjection, draftResponse); setDraftObjection(""); setDraftResponse(""); }}
              style={{ ...barPrimary, alignSelf: "flex-start" }}>Add</button>
          </div>
          {objections.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--dim)" }}>No objections logged yet.</div>
          ) : (
            objections.map((o) => (
              <div key={o.id} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{"“"}{o.objection}{"”"}</div>
                  <button onClick={() => removeObjection(o.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{o.response}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "hooks" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--dim)" }}>Headlines and hooks worth reusing across ads, emails and content — the angle they worked is optional but helps you spot what pattern is actually converting.</div>
            <button onClick={generateHooksWithAi} disabled={aiHooksBusy} style={{ ...barGhost, flexShrink: 0, opacity: aiHooksBusy ? 0.6 : 1 }}>{aiHooksBusy ? "Writing…" : "✨ Generate with AI"}</button>
          </div>
          {aiHooksErr && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{aiHooksErr}</div>}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", background: "var(--surface2)", padding: 10, borderRadius: 8, alignItems: "center" }}>
            <input value={draftHook} onChange={(e) => setDraftHook(e.target.value)} placeholder="The hook / headline…"
              style={{ flex: 1, minWidth: 200, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
            <input value={draftAngle} onChange={(e) => setDraftAngle(e.target.value)} placeholder="Angle (optional)"
              style={{ width: 140, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
            <button onClick={() => { addHook(draftHook, draftAngle); setDraftHook(""); setDraftAngle(""); }} style={barPrimary}>Add</button>
          </div>
          {hooks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--dim)" }}>No hooks saved yet.</div>
          ) : (
            hooks.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "8px 10px", borderRadius: 7, background: "var(--surface2)" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{h.hook}</span>
                {h.angle && <span style={{ fontSize: 11, color: ACCENT, background: "var(--accent-soft)", borderRadius: 999, padding: "2px 8px", flexShrink: 0 }}>{h.angle}</span>}
                <button onClick={() => removeHook(h.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "goals" && (() => {
        const goalSummary = summarizeGoals(goals);
        const STATUS_COLOR: Record<GoalStatus, string> = { not_started: "var(--dim)", on_track: "#16a34a", at_risk: "#dc2626", done: ACCENT };
        const STATUS_LABEL: Record<GoalStatus, string> = { not_started: "Not started", on_track: "On track", at_risk: "At risk", done: "Done" };
        const levelIdx = (l: GoalLevel) => GOAL_LEVELS.indexOf(l);
        const parentOptions = levelIdx(draftGoalLevel) > 0 ? goals.filter((g) => g.level === GOAL_LEVELS[levelIdx(draftGoalLevel) - 1]) : [];
        const sorted = [...goals].sort((a, b) => levelIdx(a.level) - levelIdx(b.level) || a.createdAt.localeCompare(b.createdAt));
        return (
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>
              One connected chain — vision → annual goal → quarterly target → monthly KPI → project → action — so a single stalled action can be traced all the way up to the vision it's actually blocking.
            </div>
            {goals.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {([["done", goalSummary.done, ACCENT], ["on_track", goalSummary.onTrack, "#16a34a"], ["at_risk", goalSummary.atRisk, "#dc2626"], ["not_started", goalSummary.notStarted, "var(--dim)"]] as const).map(([key, count, color]) => (
                  <div key={key} style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: "6px 12px", background: "var(--surface2)" }}>
                    <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 0.5 }}>{STATUS_LABEL[key as GoalStatus].toUpperCase()}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{count}</div>
                  </div>
                ))}
              </div>
            )}
            {goalSummary.atRiskRoots.length > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                ⚠ At risk: {goalSummary.atRiskRoots.map((g) => g.title).join(", ")} — something underneath is blocked.
              </div>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, background: "var(--surface2)", padding: 10, borderRadius: 8, alignItems: "center" }}>
              <select value={draftGoalLevel} onChange={(e) => { setDraftGoalLevel(e.target.value as GoalLevel); setDraftGoalParent(""); }}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                {GOAL_LEVELS.map((l) => <option key={l} value={l}>{GOAL_LEVEL_LABELS[l]}</option>)}
              </select>
              {parentOptions.length > 0 && (
                <select value={draftGoalParent} onChange={(e) => setDraftGoalParent(e.target.value)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                  <option value="">No parent (unlinked)</option>
                  {parentOptions.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
              <input value={draftGoalTitle} onChange={(e) => setDraftGoalTitle(e.target.value)} placeholder="Title…"
                style={{ flex: 1, minWidth: 180, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              <button onClick={() => { addGoal(draftGoalLevel, draftGoalTitle, draftGoalParent || undefined); setDraftGoalTitle(""); }} style={barPrimary}>Add</button>
            </div>

            {sorted.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>No goals yet — start with the vision, then work down to annual, quarterly, monthly KPIs, projects and actions.</div>
            ) : (
              sorted.map((g) => {
                const effective = rollUpStatus(g.id, goals);
                const parent = g.parentId ? goals.find((p) => p.id === g.parentId) : undefined;
                const linkedLabel = g.linkedNodeId ? canvasNodes.find((n) => n.id === g.linkedNodeId)?.label : undefined;
                return (
                  <div key={g.id} style={{ marginLeft: levelIdx(g.level) * 16, marginBottom: 8, padding: "9px 11px", borderRadius: 8, background: "var(--surface2)", borderLeft: `3px solid ${STATUS_COLOR[effective]}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, letterSpacing: 0.5, color: "var(--dim)", textTransform: "uppercase", flexShrink: 0 }}>{GOAL_LEVEL_LABELS[g.level]}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 120 }}>{g.title}</span>
                      <select value={g.status} onChange={(e) => updateGoal(g.id, { status: e.target.value as GoalStatus })}
                        style={{ fontSize: 11, background: "var(--surface)", border: `1px solid ${STATUS_COLOR[g.status]}`, color: STATUS_COLOR[g.status], borderRadius: 6, padding: "2px 6px" }}>
                        {(["not_started", "on_track", "at_risk", "done"] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <button onClick={() => removeGoal(g.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <select value={g.linkedNodeId ?? ""} onChange={(e) => updateGoal(g.id, { linkedNodeId: e.target.value || undefined })} title="Linked canvas node"
                        style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 5, padding: "3px 6px", maxWidth: 160 }}>
                        <option value="">No linked canvas node</option>
                        {canvasNodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                      </select>
                    </div>
                    {(parent || g.targetValue != null || g.dueDate || linkedLabel || effective !== g.status) && (
                      <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {parent && <span>under: {parent.title}</span>}
                        {g.targetValue != null && <span>{g.actualValue ?? 0}{g.unit ? ` ${g.unit}` : ""} / {g.targetValue}{g.unit ? ` ${g.unit}` : ""} target</span>}
                        {g.dueDate && <span>due {g.dueDate}</span>}
                        {linkedLabel && <span>→ {linkedLabel}</span>}
                        {effective !== g.status && <span style={{ color: STATUS_COLOR[effective] }}>effective: {STATUS_LABEL[effective]} (from children)</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {tab === "assumptions" && (() => {
        const summary = summarizeAssumptions(assumptions);
        const CONF_COLOR: Record<AssumptionConfidence, string> = { low: "var(--dim)", medium: "#f59e0b", high: "#dc2626" };
        const STATUS_COLOR: Record<AssumptionStatus, string> = { untested: "var(--dim)", testing: "#f59e0b", confirmed: "#16a34a", invalidated: "#dc2626" };
        return (
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>
              A business model is only as reliable as the beliefs it's resting on. Write down what you're assuming — a conversion rate, "this channel keeps working" — before it quietly becomes a fact nobody questioned.
            </div>
            {summary.overconfident.length > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                ⚠ High confidence, never tested: {summary.overconfident.map((a) => a.text).join(" · ")}
              </div>
            )}
            {summary.unreviewedInvalidated.length > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                ⚠ Invalidated but not yet reviewed — the rest of the plan may still be resting on these: {summary.unreviewedInvalidated.map((a) => a.text).join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, background: "var(--surface2)", padding: 10, borderRadius: 8, alignItems: "center" }}>
              <input value={draftAssumptionText} onChange={(e) => setDraftAssumptionText(e.target.value)} placeholder="What are you assuming is true?"
                style={{ flex: 1, minWidth: 220, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              <input value={draftAssumptionCategory} onChange={(e) => setDraftAssumptionCategory(e.target.value)} placeholder="Category (optional)"
                style={{ width: 140, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              <select value={draftAssumptionConfidence} onChange={(e) => setDraftAssumptionConfidence(e.target.value as AssumptionConfidence)}
                style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                <option value="low">Low confidence</option>
                <option value="medium">Medium confidence</option>
                <option value="high">High confidence</option>
              </select>
              <button onClick={() => { addAssumption(draftAssumptionText, draftAssumptionConfidence, draftAssumptionCategory); setDraftAssumptionText(""); setDraftAssumptionCategory(""); }} style={barPrimary}>Add</button>
            </div>
            {assumptions.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>No assumptions logged yet.</div>
            ) : (
              assumptions.map((a) => (
                <div key={a.id} style={{ marginBottom: 8, padding: "9px 11px", borderRadius: 8, background: "var(--surface2)", borderLeft: `3px solid ${STATUS_COLOR[a.status]}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 160 }}>{a.text}</span>
                    <span style={{ fontSize: 10, letterSpacing: 0.4, color: CONF_COLOR[a.confidence], border: `1px solid ${CONF_COLOR[a.confidence]}`, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>{a.confidence.toUpperCase()} CONF.</span>
                    <select value={a.status} onChange={(e) => updateAssumption(a.id, { status: e.target.value as AssumptionStatus, ...(e.target.value === "invalidated" ? {} : { reviewedAt: undefined }) })}
                      style={{ fontSize: 11, background: "var(--surface)", border: `1px solid ${STATUS_COLOR[a.status]}`, color: STATUS_COLOR[a.status], borderRadius: 6, padding: "2px 6px" }}>
                      <option value="untested">Untested</option>
                      <option value="testing">Testing</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="invalidated">Invalidated</option>
                    </select>
                    {a.status === "invalidated" && !a.reviewedAt && (
                      <button onClick={() => updateAssumption(a.id, { reviewedAt: new Date().toISOString() })} style={{ ...barGhost, fontSize: 11, padding: "2px 7px", flexShrink: 0 }}>Mark reviewed</button>
                    )}
                    <button onClick={() => removeAssumption(a.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                  </div>
                  {a.category && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>{a.category}</div>}
                </div>
              ))
            )}
          </div>
        );
      })()}

      {tab === "experiments" && (() => {
        const summary = summarizeExperiments(experiments);
        const STATUS_COLOR: Record<ExperimentStatus, string> = { planned: "var(--dim)", running: "#f59e0b", completed: "#16a34a", abandoned: "#dc2626" };
        // "reject" is a deprecated synonym for "stop" (packages/engine/src/experiments.ts) —
        // labeled but not offered as a fresh choice below, so old data still reads clearly
        // without steering anyone toward writing it again.
        const DECISION_LABEL: Record<ExperimentDecision, string> = { adopt: "Adopt", iterate: "Iterate", retest: "Retest", stop: "Stop", insufficient_evidence: "Insufficient evidence", reject: "Stop (legacy)" };
        const DECISION_OPTIONS: ExperimentDecision[] = ["adopt", "iterate", "retest", "stop", "insufficient_evidence"];
        const toggleExpanded = (id: string) => setExpandedExperiments((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
        const detailInputStyle = { flex: 1, minWidth: 140, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "3px 7px", fontSize: 11 };
        const detailLabelStyle = { fontSize: 10, color: "var(--dim)", textTransform: "uppercase" as const, letterSpacing: "0.03em", display: "block", marginBottom: 2 };
        return (
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>
              Hypothesis → experiment → result → decision. An assumption doesn't get tested by being marked confident — it gets tested by an actual experiment with a real result.
            </div>
            {summary.awaitingDecision.length > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                ⚠ Completed with no recorded decision — the test ran, but nothing was decided about it: {summary.awaitingDecision.map((e) => e.hypothesis).join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, background: "var(--surface2)", padding: 10, borderRadius: 8, alignItems: "center" }}>
              <input value={draftExperimentHypothesis} onChange={(e) => setDraftExperimentHypothesis(e.target.value)} placeholder="What do you believe will happen if…"
                style={{ flex: 1, minWidth: 220, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
              {assumptions.length > 0 && (
                <select value={draftExperimentAssumption} onChange={(e) => setDraftExperimentAssumption(e.target.value)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }}>
                  <option value="">Not tied to an assumption</option>
                  {assumptions.map((a) => <option key={a.id} value={a.id}>{a.text}</option>)}
                </select>
              )}
              <button onClick={() => { addExperiment(draftExperimentHypothesis, draftExperimentAssumption || undefined); setDraftExperimentHypothesis(""); }} style={barPrimary}>Add</button>
            </div>
            {experiments.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>No experiments logged yet.</div>
            ) : (
              experiments.map((e) => {
                const linkedAssumption = e.linkedAssumptionId ? assumptions.find((a) => a.id === e.linkedAssumptionId) : undefined;
                const isExpanded = expandedExperiments.has(e.id);
                const wantsFollowUp = e.decision === "retest" || e.decision === "iterate";
                return (
                  <div key={e.id} style={{ marginBottom: 8, padding: "9px 11px", borderRadius: 8, background: "var(--surface2)", borderLeft: `3px solid ${STATUS_COLOR[e.status]}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 160 }}>{e.hypothesis}</span>
                      <select value={e.status} onChange={(ev) => updateExperiment(e.id, { status: ev.target.value as ExperimentStatus })}
                        style={{ fontSize: 11, background: "var(--surface)", border: `1px solid ${STATUS_COLOR[e.status]}`, color: STATUS_COLOR[e.status], borderRadius: 6, padding: "2px 6px" }}>
                        <option value="planned">Planned</option>
                        <option value="running">Running</option>
                        <option value="completed">Completed</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                      <button onClick={() => toggleExpanded(e.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>{isExpanded ? "Hide details" : "Details"}</button>
                      <button onClick={() => removeExperiment(e.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                    </div>
                    {(linkedAssumption || e.status === "completed") && (
                      <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {linkedAssumption && <span>tests: {linkedAssumption.text}</span>}
                        {e.status === "completed" && (
                          <>
                            <input value={e.result ?? ""} onChange={(ev) => updateExperiment(e.id, { result: ev.target.value })} placeholder="What happened?"
                              style={{ flex: 1, minWidth: 140, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "3px 7px", fontSize: 11 }} />
                            <select value={e.decision ?? ""} onChange={(ev) => updateExperiment(e.id, { decision: (ev.target.value || undefined) as ExperimentDecision | undefined })}
                              style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "2px 6px" }}>
                              <option value="">No decision yet</option>
                              {DECISION_OPTIONS.map((d) => <option key={d} value={d}>{DECISION_LABEL[d]}</option>)}
                              {e.decision === "reject" && <option value="reject">{DECISION_LABEL.reject}</option>}
                            </select>
                          </>
                        )}
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border3)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                        <div><span style={detailLabelStyle}>Metric</span><input value={e.metric ?? ""} onChange={(ev) => updateExperiment(e.id, { metric: ev.target.value })} placeholder="e.g. opt-in rate" style={detailInputStyle} /></div>
                        <div><span style={detailLabelStyle}>Baseline</span><input value={e.baseline ?? ""} onChange={(ev) => updateExperiment(e.id, { baseline: ev.target.value })} placeholder="where it stands now" style={detailInputStyle} /></div>
                        <div><span style={detailLabelStyle}>Target / success threshold</span><input value={e.successThreshold ?? ""} onChange={(ev) => updateExperiment(e.id, { successThreshold: ev.target.value })} placeholder="what counts as a win" style={detailInputStyle} /></div>
                        <div><span style={detailLabelStyle}>Audience</span><input value={e.audience ?? ""} onChange={(ev) => updateExperiment(e.id, { audience: ev.target.value })} placeholder="who's being tested" style={detailInputStyle} /></div>
                        <div><span style={detailLabelStyle}>Owner</span><input value={e.owner ?? ""} onChange={(ev) => updateExperiment(e.id, { owner: ev.target.value })} placeholder="who's accountable" style={detailInputStyle} /></div>
                        <div><span style={detailLabelStyle}>Test design</span><input value={e.testDesign ?? ""} onChange={(ev) => updateExperiment(e.id, { testDesign: ev.target.value })} placeholder="how it's actually run" style={detailInputStyle} /></div>
                        {e.status === "completed" && (
                          <>
                            <div>
                              <span style={detailLabelStyle}>Confidence in result</span>
                              <select value={e.confidence ?? ""} onChange={(ev) => updateExperiment(e.id, { confidence: (ev.target.value || undefined) as ExperimentConfidence | undefined })} style={{ ...detailInputStyle, flex: "unset", width: "100%" }}>
                                <option value="">Not set</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}><span style={detailLabelStyle}>Learning (what this changed our minds about)</span><input value={e.learning ?? ""} onChange={(ev) => updateExperiment(e.id, { learning: ev.target.value })} placeholder="beyond the raw result — what do we now believe?" style={{ ...detailInputStyle, width: "100%" }} /></div>
                          </>
                        )}
                        {wantsFollowUp && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <span style={detailLabelStyle}>Follow-up experiment</span>
                            <select value={e.followUpExperimentId ?? ""} onChange={(ev) => updateExperiment(e.id, { followUpExperimentId: ev.target.value || undefined })} style={{ ...detailInputStyle, flex: "unset", width: "100%" }}>
                              <option value="">Not linked yet</option>
                              {experiments.filter((other) => other.id !== e.id).map((other) => <option key={other.id} value={other.id}>{other.hypothesis}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {tab === "readiness" && (() => {
        const r = computeReadiness(goals, assumptions, experiments);
        const LABEL_COPY: Record<ReadinessLabel, { text: string; color: string }> = {
          no_data: { text: "Not enough data yet", color: "var(--dim)" },
          fragile: { text: "Fragile", color: "#dc2626" },
          developing: { text: "Developing", color: "#f59e0b" },
          strong: { text: "Strong", color: "#16a34a" },
        };
        const copy = LABEL_COPY[r.label];
        const Bar = ({ label, score }: { label: string; score: number | null }) => (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>
              <span>{label}</span>
              <span>{score === null ? "no data" : `${score}/100`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${score ?? 0}%`, background: score === null ? "transparent" : score >= 80 ? "#16a34a" : score >= 60 ? "#f59e0b" : "#dc2626", borderRadius: 999 }} />
            </div>
          </div>
        );
        return (
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 20 }}>
              One number for "how solid is this plan, really" — combining the Goal Hierarchy, Assumption Register and Experiment Register instead of checking three tabs separately.
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 22, padding: "16px 18px", borderRadius: 10, background: "var(--surface2)" }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: copy.color }}>{r.score === null ? "—" : r.score}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: copy.color }}>{copy.text}</div>
                <div style={{ fontSize: 12, color: "var(--dim)" }}>Goal Hierarchy, Assumptions and Experiments, weighted 40/30/30.</div>
              </div>
            </div>
            <Bar label="Goal Hierarchy" score={r.goalsScore} />
            <Bar label="Assumption Register" score={r.assumptionsScore} />
            <Bar label="Experiment Register" score={r.experimentsScore} />
            {r.topIssues.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--dim)", marginBottom: 8, letterSpacing: 0.3 }}>WHAT'S DRAGGING IT DOWN</div>
                {r.topIssues.map((issue, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#dc2626", background: "var(--surface2)", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                    ⚠ {issue}
                  </div>
                ))}
              </div>
            ) : r.score !== null ? (
              <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 18 }}>Nothing flagged — every registered goal, assumption and experiment is in good shape.</div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 18 }}>Log goals, assumptions or experiments in the tabs above to get a readiness score.</div>
            )}
            {r.gaps.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--dim)", marginBottom: 8, letterSpacing: 0.3 }}>NOT YET REFLECTED IN THIS SCORE</div>
                {r.gaps.map((gap, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface2)", borderRadius: 8, padding: "7px 12px", marginBottom: 5 }}>
                    {gap}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {tab === "brief" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--dim)" }}>Everything built across Business Intelligence, read as one story — generated fresh from the current model every time.</div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => exportBusinessReportCsv(report, definition.businessName, currency, scenarioComparison)} style={barGhost}>⬇ CSV</button>
              <button onClick={() => exportBusinessReportPdf(report, definition.businessName, currency)} style={barGhost}>⬇ Export PDF</button>
              <button onClick={async () => {
                if (emailReportBusy) return;
                setEmailReportBusy(true); setEmailReportMsg("");
                try {
                  const text = buildReportEmailText(report, definition.businessName, currency);
                  const r = await fetch("/api/reports/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: `${definition.businessName?.trim() || "Business"} — Growth Brief`, text }) });
                  const data = await r.json() as { ok?: boolean; error?: string };
                  setEmailReportMsg(r.ok ? "Sent — check your inbox." : (data.error ?? "Could not send the email."));
                } catch { setEmailReportMsg("Network error — is the app reachable?"); }
                setEmailReportBusy(false);
              }} disabled={emailReportBusy} style={{ ...barGhost, opacity: emailReportBusy ? 0.6 : 1 }}>{emailReportBusy ? "Sending…" : "✉ Email me this"}</button>
              {shareInfo ? (
                <button onClick={async () => {
                  if (shareBusy) return;
                  setShareBusy(true); setShareErr("");
                  const ok = await unshareReport();
                  // Only clear the link from the UI if it was really revoked —
                  // otherwise it stays shown (and live), with an error, instead
                  // of falsely reading as revoked.
                  if (ok) setShareInfo(null); else setShareErr("Couldn't revoke the link — it may still be live. Try again.");
                  setShareBusy(false);
                }} disabled={shareBusy} style={{ ...barGhost, opacity: shareBusy ? 0.6 : 1, color: "#dc2626" }}>{shareBusy ? "Revoking…" : "🔗 Revoke link"}</button>
              ) : (
                <button onClick={async () => {
                  if (shareBusy) return;
                  setShareBusy(true); setShareErr("");
                  const html = buildReportShareHtml(report, definition.businessName, currency);
                  const result = await shareReport(html);
                  if ("error" in result) setShareErr(result.error); else setShareInfo(result);
                  setShareBusy(false);
                }} disabled={shareBusy} style={{ ...barGhost, opacity: shareBusy ? 0.6 : 1 }}>{shareBusy ? "Creating…" : "🔗 Get shareable link"}</button>
              )}
            </div>
          </div>
          {emailReportMsg && <div style={{ fontSize: 12, color: emailReportMsg.startsWith("Sent") ? "#16a34a" : "#dc2626", marginBottom: 14 }}>{emailReportMsg}</div>}
          {shareErr && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 14 }}>{shareErr}</div>}
          {shareInfo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--dim)" }}>Anyone with this link can view a read-only snapshot — no login needed:</span>
              <code style={{ fontSize: 12, flex: "1 1 240px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareInfo.url}</code>
              <button onClick={() => { void navigator.clipboard.writeText(shareInfo.url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} style={{ ...barGhost, padding: "3px 9px", fontSize: 11, flexShrink: 0 }}>{shareCopied ? "Copied!" : "Copy"}</button>
              <span style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0 }}>Expires {new Date(shareInfo.expiresAt).toLocaleDateString()}</span>
            </div>
          )}

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 4 }}>GROWTH BRIEF</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{brief.businessName || "Untitled business"}</div>
            {([["Breakthrough needed", brief.breakthrough], ["Vision", brief.vision], ["6–12 month milestones", brief.milestones],
              ["Main opportunity", brief.mainOpportunity], ["Main constraint", brief.mainConstraint]] as const).map(([label, val]) => (
              val ? (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 13, marginTop: 2, whiteSpace: "pre-wrap" }}>{val}</div>
                </div>
              ) : null
            ))}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 8 }}>TOP 3 HIGHEST-LEVERAGE ACTIONS</div>
              {brief.topActions.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Add action items with a dollar value in the 7 Systems tab to surface them here.</div>
              ) : (
                brief.topActions.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: ACCENT, fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{a.actionItem} <span style={{ color: "var(--dim)" }}>· System {a.force}</span></span>
                    {a.dollarValue ? <span style={{ color: "var(--muted)" }}>{formatMoney(a.dollarValue, currency)}</span> : null}
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: "var(--dim)" }}>
              {summary.done}/{summary.total} actions done{summary.totalDollarValue > 0 ? ` · ${formatMoney(summary.totalDollarValue, currency)} still on the table` : ""}
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 4 }}>DECIDE — WHAT MATTERS MOST</div>
            <div style={{ fontSize: 13, marginBottom: 14 }}>{decide.decisionSummary}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 3 }}>HIGHEST-LEVERAGE ACTION</div>
                {decide.highestLeverageAction ? (
                  <div style={{ fontSize: 13 }}>{decide.highestLeverageAction.actionItem}
                    {decide.highestLeverageAction.dollarValue ? <span style={{ color: "var(--muted)" }}> · {formatMoney(decide.highestLeverageAction.dollarValue, currency)}</span> : null}
                  </div>
                ) : <div style={{ fontSize: 12, color: "var(--dim)" }}>Add a Force action with a dollar value to surface one.</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 3 }}>BIGGEST BOTTLENECK</div>
                {decide.biggestBottleneck ? (
                  <div style={{ fontSize: 13 }}>{decide.biggestBottleneck.label} <span style={{ fontSize: 10, color: decide.biggestBottleneck.source === "measured" ? "#16a34a" : "var(--dim)", textTransform: "uppercase", fontWeight: 700 }}>· {decide.biggestBottleneck.source}</span>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{decide.biggestBottleneck.detail}</div>
                  </div>
                ) : <div style={{ fontSize: 12, color: "var(--dim)" }}>Run a risk assessment or start tracking actuals to surface one.</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 3 }}>FASTEST CASH IMPROVEMENT</div>
                {decide.fastestCashImprovement ? (
                  <div style={{ fontSize: 13 }}>{decide.fastestCashImprovement.actionItem} <span style={{ color: "var(--muted)" }}>· due {new Date(decide.fastestCashImprovement.deadline as string).toLocaleDateString()}</span></div>
                ) : <div style={{ fontSize: 12, color: "var(--dim)" }}>Add a deadline to a Force action to surface one.</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 3 }}>BIGGEST RISK</div>
                {decide.biggestRisk ? <div style={{ fontSize: 13 }}>{decide.biggestRisk}</div> : <div style={{ fontSize: 12, color: "var(--dim)" }}>Run a risk assessment (Tools menu) to surface one.</div>}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>FREEDOM PLAN REPORT</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Freedom Fund (monthly / annual)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatMoney(report.moneyMachine.freedomFundMonthly, currency)} / {formatMoney(report.moneyMachine.freedomFundAnnual, currency)}</span>
            </div>
            {([["Security", report.moneyMachine.securityMonthly], ["Growth", report.moneyMachine.growthMonthly], ["Dream", report.moneyMachine.dreamMonthly]] as const).map(([label, v]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "var(--muted)" }}>{label}</span><span>{formatMoney(v, currency)}/mo</span>
              </div>
            ))}
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginTop: 14, marginBottom: 6 }}>THE FUND — ACTUAL BALANCE</div>
            {([["Security", report.moneyMachineLedger.security], ["Growth", report.moneyMachineLedger.growth], ["Dream", report.moneyMachineLedger.dream]] as const).map(([label, b]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "var(--muted)" }}>{label}</span>
                <span>{formatMoney(b.balance, currency)}{b.progressPct != null ? ` · ${b.progressPct}% of target` : ""}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>5 PROFIT LEVERS REPORT</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Combined effect of current lever settings</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{report.profitDrivers.compoundMultiplier.toFixed(2)}×</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Profit</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: report.profitDrivers.profitLift >= 0 ? "#16a34a" : "#dc2626" }}>
                {formatMoney(report.profitDrivers.profitBaseline, currency)} → {formatMoney(report.profitDrivers.profitImproved, currency)}
              </span>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700 }}>12-MONTH PROJECTION</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Monthly growth</span>
                <input type="range" min={-20} max={30} value={Math.round(projGrowth * 100)}
                  onChange={(e) => setProjGrowth(Number(e.target.value) / 100)} style={{ width: 90 }} />
                <span style={{ fontSize: 12, fontWeight: 700, width: 34 }}>{projGrowth >= 0 ? "+" : ""}{Math.round(projGrowth * 100)}%</span>
              </div>
            </div>
            {(() => {
              const months = projectMonths({ visitors: monthlyVisitors, revenue: driverBaseline.revenue, cost: driverBaseline.cost }, 12, projGrowth);
              const picks = [1, 3, 6, 12].map((m) => months[m - 1]!);
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {picks.map((p) => (
                    <div key={p.month} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Month {p.month}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: p.cumulativeProfit >= 0 ? "#16a34a" : "#dc2626" }}>{formatMoney(p.cumulativeProfit, currency)}</div>
                      <div style={{ fontSize: 10, color: "var(--dim)" }}>cumulative</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 10 }}>Assumes today&apos;s unit economics hold at every scale — a simplification, not a forecast of CAC or conversion staying flat forever.</div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>CLIENT ADVOCACY REPORT</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Score</span>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{report.ravingFans.score}/100 · {report.ravingFans.band}</span>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>BUSINESS READINESS REPORT</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Score</span>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>
                {report.readiness.score === null ? "No data yet" : `${report.readiness.score}/100 · ${report.readiness.label}`}
              </span>
            </div>
            {report.readiness.topIssues.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {report.readiness.topIssues.map((issue, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#dc2626" }}>⚠ {issue}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>EXECUTIVE ACTION PLAN — TOP 3</div>
            {brief.topActions.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>Add action items with a dollar value in the 7 Systems tab to populate this.</div>
            ) : (
              brief.topActions.map((a, i) => (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.actionItem} <span style={{ color: "var(--dim)" }}>· System {a.force}</span></div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                      {a.dollarValue ? formatMoney(a.dollarValue, currency) : "No $ value"}
                      {a.deadline ? ` · Due ${new Date(a.deadline).toLocaleDateString()}` : ""}
                      {a.owner ? ` · Owner: ${a.owner}` : ""}
                      {a.confidence ? ` · ${a.confidence} confidence` : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 700, marginBottom: 10 }}>SCENARIO COMPARISON REPORT</div>
            {!scenarioComparison || scenarioComparison.scenarios.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>Build a what-if scenario (Scenarios tab) to compare it against the base plan here.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "4px 8px 4px 0" }}>Scenario</th>
                    <th style={{ padding: "4px 8px" }}>Revenue Δ</th>
                    <th style={{ padding: "4px 8px" }}>Profit Δ</th>
                    <th style={{ padding: "4px 8px" }}>MRR Δ</th>
                  </tr></thead>
                  <tbody>
                    <tr><td style={{ padding: "4px 8px 4px 0", fontWeight: 700 }}>Base plan</td>
                      <td style={{ padding: "4px 8px" }}>{formatMoney(scenarioComparison.base.revenue, currency)}</td>
                      <td style={{ padding: "4px 8px" }}>{formatMoney(scenarioComparison.base.grossProfit, currency)}</td>
                      <td style={{ padding: "4px 8px" }}>{formatMoney(scenarioComparison.base.mrr ?? 0, currency)}</td>
                    </tr>
                    {scenarioComparison.scenarios.map((s) => (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "4px 8px 4px 0" }}>{s.name}</td>
                        <td style={{ padding: "4px 8px", color: s.delta.revenue >= 0 ? "#16a34a" : "#dc2626" }}>{s.delta.revenue >= 0 ? "+" : ""}{formatMoney(s.delta.revenue, currency)}</td>
                        <td style={{ padding: "4px 8px", color: s.delta.grossProfit >= 0 ? "#16a34a" : "#dc2626" }}>{s.delta.grossProfit >= 0 ? "+" : ""}{formatMoney(s.delta.grossProfit, currency)}</td>
                        <td style={{ padding: "4px 8px", color: s.delta.mrr >= 0 ? "#16a34a" : "#dc2626" }}>{s.delta.mrr >= 0 ? "+" : ""}{formatMoney(s.delta.mrr, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {courseMode === "guided" && currentStep && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, maxWidth: 900 }}>
          <button onClick={() => stepIdx > 0 && goTo(LESSON_STEPS[stepIdx - 1]!.key)} disabled={stepIdx === 0}
            style={{ ...barGhost, opacity: stepIdx === 0 ? 0.4 : 1 }}>{"← Back"}</button>
          {stepIdx < LESSON_STEPS.length - 1 ? (
            <button onClick={() => goTo(LESSON_STEPS[stepIdx + 1]!.key)} style={barPrimary}>Next lesson →</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: doneCount === LESSON_STEPS.length ? "#16a34a" : "var(--dim)" }}>
                {doneCount === LESSON_STEPS.length ? "✓ Every lesson has something written down." : `${LESSON_STEPS.length - doneCount} lesson${LESSON_STEPS.length - doneCount === 1 ? "" : "s"} still empty — jump back any time to fill them in.`}
              </span>
              <button onClick={onContinueToCanvas} style={barPrimary} title="The business definition is never locked — come back and revise it any time.">Continue to Map →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
