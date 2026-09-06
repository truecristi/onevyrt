"use client";

import { barGhost, barPrimary, money, num } from "../lib/studio-ui";

export interface LibProject { id: string; name: string; archived: boolean; kpi: { traffic: number; orders: number; revenue: number; profit: number; roas: number | null } | null; nodeCount: number; hasDefinition: boolean; hasTrackingData: boolean; hasGoals?: boolean; readiness?: { score: number | null; label: "no_data" | "fragile" | "developing" | "strong" }; programProgress?: { doneCount: number; total: number; allDone: boolean } | null;
  /** Set to the template's name when the project is still that unedited
   *  template — its KPIs are the sample's illustrative numbers, not the
   *  founder's own, so the card frames them as example data. */
  exampleTemplate?: string | null; }

const READINESS_COPY: Record<"no_data" | "fragile" | "developing" | "strong", { text: string; color: string }> = {
  no_data: { text: "Readiness: not started", color: "var(--dim)" },
  fragile: { text: "Readiness: Fragile", color: "#dc2626" },
  developing: { text: "Readiness: Developing", color: "#f59e0b" },
  strong: { text: "Readiness: Strong", color: "#16a34a" },
};

/** One project tile on the library screen. Presentational: it renders a
 *  LibProject and calls back for the four actions. Extracted from the library
 *  view's inline map as the first step of breaking up the studio monolith. */
export function LibraryProjectCard({ pr, canEdit, onOpen, onDuplicate, onDelete, onToggleArchive, onResumeProgram }: {
  pr: LibProject; canEdit: boolean;
  onOpen: (id: string) => void; onDuplicate: (pr: LibProject) => void;
  onDelete: (pr: LibProject) => void; onToggleArchive: (pr: LibProject) => void;
  onResumeProgram?: (id: string) => void;
}) {
  const kv = (label: string, value: string, tone?: string) => (
    <div style={{ flex: "1 1 44%", minWidth: 92, border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px" }}>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: tone ?? "var(--text)" }}>{value}</div>
    </div>
  );
  return (
    <div style={{ width: 322, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: 18, boxShadow: "var(--shadow-soft)", opacity: pr.archived ? 0.72 : 1, transition: "box-shadow .2s ease, transform .2s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-panel)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-soft)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.name}</div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{pr.archived ? "Archived" : "Active"}</span>
            {pr.readiness && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: READINESS_COPY[pr.readiness.label].color, fontWeight: 500 }}>
                  {READINESS_COPY[pr.readiness.label].text}{pr.readiness.score !== null ? ` (${pr.readiness.score})` : ""}
                </span>
              </>
            )}
          </div>
        </div>
        <button onClick={() => void onToggleArchive(pr)} disabled={!canEdit} style={{ ...barGhost, opacity: canEdit ? 1 : 0.5 }} title={pr.archived ? "Restore" : "Archive"}>{pr.archived ? "↺" : "⤓"}</button>
      </div>
      {pr.programProgress && pr.programProgress.doneCount > 0 && (
        <button onClick={() => onResumeProgram?.(pr.id)}
          style={{ display: "block", width: "100%", textAlign: "left", marginTop: 10, background: pr.programProgress.allDone ? "var(--surface2)" : "var(--accent-soft, rgba(26,115,232,0.1))", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>
          {pr.programProgress.allDone ? "✓ Growth Program complete — review it" : `🎓 Growth Program: ${pr.programProgress.doneCount}/${pr.programProgress.total} lessons — continue →`}
        </button>
      )}
      {pr.exampleTemplate && pr.kpi && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 11, color: "var(--dim)" }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#1d4ed8", background: "rgba(29,78,216,0.10)", borderRadius: 5, padding: "2px 6px" }}>Example</span>
          <span>Sample numbers from the template — edit the funnel to make them yours.</span>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
        {kv("TRAFFIC", pr.kpi ? num(pr.kpi.traffic) : "—")}
        {kv("ORDERS", pr.kpi ? num(pr.kpi.orders) : "—")}
        {kv("REVENUE", pr.kpi ? money(pr.kpi.revenue) : "—")}
        {/* On unedited example data the profit/ROAS stay neutral — they're the
            template author's illustration, not a real win or loss to celebrate. */}
        {kv("PROFIT", pr.kpi ? money(pr.kpi.profit) : "—", pr.exampleTemplate ? "var(--text)" : pr.kpi && pr.kpi.profit < 0 ? "#e11d48" : "#16a34a")}
        {kv("ROAS", pr.kpi && pr.kpi.roas != null ? pr.kpi.roas.toFixed(2) + "x" : "—", pr.exampleTemplate ? "var(--text)" : pr.kpi && pr.kpi.roas != null && pr.kpi.roas >= 1 ? "#16a34a" : "#e11d48")}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => void onOpen(pr.id)} style={{ ...barPrimary, flex: 1 }}>{"📂 Open"}</button>
        <button onClick={() => void onDuplicate(pr)} disabled={!canEdit} style={{ ...barGhost, opacity: canEdit ? 1 : 0.5 }} aria-label="Duplicate project" title="Duplicate">{"⧉"}</button>
        <button onClick={() => void onDelete(pr)} disabled={!canEdit} style={{ ...barGhost, color: "#e11d48", borderColor: "var(--ds-danger-soft)", opacity: canEdit ? 1 : 0.5 }} aria-label="Delete project" title="Delete">{"🗑"}</button>
      </div>
    </div>
  );
}
