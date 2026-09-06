"use client";

import { useRef, type ReactNode } from "react";
import { summarizeChecklist, type RiskReport, type ConstraintReport, type ChecklistItem } from "@onevyrt/engine";
import { ACCENT } from "../../lib/studio-ui";
import { useDialogA11y } from "../../lib/use-dialog-a11y";

/**
 * The old "Tools ▾" dropdown packed 13 destinations into a 240px-wide list —
 * fine for a keyboard-and-mouse power user, cramped for anything else, and
 * it gave every tool equal visual weight whether it's opened once a project
 * or every five minutes. This is the same set of destinations reorganized
 * as a spacious, grouped dashboard: each tile is a real touch target
 * (well over the 44px guideline) and shows its own status at a glance
 * (readiness %, risk score, violation count) instead of a bare label.
 */

interface Tile {
  icon: string;
  hue: string;
  label: string;
  term: string;
  status?: string;
  statusTone?: "good" | "warn" | "bad";
  onClick: () => void;
}

function Section({ title, tiles }: { title: string; tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: "var(--dim)", marginBottom: 10, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {tiles.map((t) => <ToolTile key={t.label} {...t} />)}
      </div>
    </div>
  );
}

const TONE_COLOR: Record<NonNullable<Tile["statusTone"]>, string> = { good: "#16a34a", warn: "#ca8a04", bad: "#dc2626" };

function ToolTile({ icon, hue, label, term, status, statusTone, onClick }: Tile) {
  return (
    <button onClick={onClick} data-term={term} className="gb-hub-tile" style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, textAlign: "left",
      background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14,
      padding: "14px 14px", cursor: "pointer", minHeight: 108,
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, background: `${hue}1c`, color: hue, flexShrink: 0,
      }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{label}</span>
        {status && <span style={{ fontSize: 11.5, color: statusTone ? TONE_COLOR[statusTone] : "var(--dim)" }}>{status}</span>}
      </span>
    </button>
  );
}

export function ToolsHub({
  risk, constraintReport, checklist, hasNotes, retargetingCount, hasRecurring, hasTimeline,
  onOpenTour, onOpenNotes, onOpenChecklist, onOpenHistory, onOpenActivity, onOpenRisk,
  onOpenRetargeting, onOpenJourneys, onOpenConstraints, onOpenRecurring, onOpenTimeline,
  onOpenAiCopilot, onOpenIntegrations, onClose,
}: {
  risk: RiskReport | null;
  constraintReport: ConstraintReport | null;
  checklist: ChecklistItem[];
  hasNotes: boolean;
  retargetingCount: number;
  hasRecurring: boolean;
  hasTimeline: boolean;
  onOpenTour: () => void;
  onOpenNotes: () => void;
  onOpenChecklist: () => void;
  onOpenHistory: () => void;
  onOpenActivity: () => void;
  onOpenRisk: () => void;
  onOpenRetargeting: () => void;
  onOpenJourneys: () => void;
  onOpenConstraints: () => void;
  onOpenRecurring: () => void;
  onOpenTimeline: () => void;
  onOpenAiCopilot: () => void;
  onOpenIntegrations: () => void;
  onClose: () => void;
}): ReactNode {
  const checklistSummary = checklist.length > 0 ? summarizeChecklist(checklist) : null;

  const planTiles: Tile[] = [
    {
      icon: "✓", hue: "#16a34a", label: "Launch checklist", term: "launchChecklist", onClick: onOpenChecklist,
      ...(checklistSummary
        ? { status: checklistSummary.ready ? "Ready to launch" : `${checklistSummary.done}/${checklistSummary.total} done`, statusTone: checklistSummary.ready ? "good" as const : undefined }
        : { status: "No items yet" }),
    },
    {
      icon: "⚠", hue: "#ea580c", label: "Risk assessment", term: "riskAssessment", onClick: onOpenRisk,
      ...(risk ? { status: `${risk.band} risk · ${risk.score}`, statusTone: risk.score >= 50 ? "bad" as const : risk.band === "moderate" ? "warn" as const : "good" as const } : { status: "Add traffic + offer" }),
    },
    {
      icon: "⌗", hue: "#7c3aed", label: "Constraints", term: "constraints", onClick: onOpenConstraints,
      ...(constraintReport && constraintReport.results.length > 0
        ? { status: constraintReport.allSatisfied ? "All satisfied" : `${constraintReport.violated.length} violated`, statusTone: constraintReport.allSatisfied ? "good" as const : "bad" as const }
        : { status: "None set" }),
    },
    { icon: "📝", hue: "#0891b2", label: "Notes", term: "notesFeature", status: hasNotes ? "Has notes" : "Empty", onClick: onOpenNotes },
  ];

  const historyTiles: Tile[] = [
    { icon: "🕒", hue: "#64748b", label: "Version history", term: "versionHistory", onClick: onOpenHistory },
    { icon: "📣", hue: "#64748b", label: "Activity feed", term: "activityFeed", onClick: onOpenActivity },
    { icon: "🧑", hue: "#64748b", label: "People journeys", term: "peopleJourneys", status: "Preview", onClick: onOpenJourneys },
  ];

  const advancedTiles: Tile[] = [
    { icon: "↻", hue: "#db2777", label: "Retargeting loops", term: "retargetingLoops", status: retargetingCount > 0 ? `${retargetingCount} loop${retargetingCount === 1 ? "" : "s"}` : "None set", onClick: onOpenRetargeting },
    ...(hasRecurring ? [{ icon: "♻", hue: "#db2777", label: "Recurring revenue", term: "recurringRevenue", onClick: onOpenRecurring }] : []),
    ...(hasTimeline ? [{ icon: "⏱", hue: "#db2777", label: "Timeline", term: "timeline", onClick: onOpenTimeline }] : []),
  ];

  const connectTiles: Tile[] = [
    { icon: "✦", hue: ACCENT, label: "AI Copilot", term: "aiCopilot", onClick: onOpenAiCopilot },
    { icon: "⇄", hue: ACCENT, label: "Integrations", term: "integrations", onClick: onOpenIntegrations },
  ];

  const learnTiles: Tile[] = [
    { icon: "🧭", hue: "#64748b", label: "Guided tour", term: "guidedTour", onClick: onOpenTour },
  ];

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(10,14,22,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto",
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Studio tools" onClick={(e) => e.stopPropagation()} className="gb-glass-panel" style={{
        width: 760, maxWidth: "100%", background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
        borderRadius: 22, boxShadow: "var(--shadow-panel)", padding: "22px 24px 26px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>TOOLS</div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Everything else this plan needs</div>
          </div>
          <button onClick={onClose} title="Close" aria-label="Close"
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 999, color: "var(--muted)", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>✕</button>
        </div>
        <Section title="Plan & readiness" tiles={planTiles} />
        <Section title="Reality & history" tiles={historyTiles} />
        <Section title="Advanced modeling" tiles={advancedTiles} />
        <Section title="Connect" tiles={connectTiles} />
        <Section title="Learn" tiles={learnTiles} />
      </div>
    </div>
  );
}
