"use client";

import { useState } from "react";
import type { Node } from "@xyflow/react";
import { summarizeChecklist, type ChecklistItem } from "@onevyrt/engine";
import { ACCENT, barGhost, barPrimary } from "../../lib/studio-ui";
import { GlassDrawer } from "./GlassDrawer";

export function ChecklistPanel({
  nodes, checklist, addChecklistItem, toggleChecklistDone, removeChecklistItem, presetChecklistForAllBlocks, onClose,
}: {
  nodes: Node[];
  checklist: ChecklistItem[];
  addChecklistItem: (text: string, linkedNodeId?: string, parentId?: string) => void;
  toggleChecklistDone: (id: string) => void;
  removeChecklistItem: (id: string) => void;
  presetChecklistForAllBlocks: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [subOpenId, setSubOpenId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState("");
  const s = summarizeChecklist(checklist);
  return (
    <GlassDrawer width={380} label="Launch checklist" onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>READINESS</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Launch checklist</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: s.ready ? "#16a34a" : "var(--text)" }}>
              {s.total === 0 ? "No items yet" : s.ready ? "Ready to launch" : `${s.done} of ${s.total} done`}
            </span>
            {s.total > 0 && <span style={{ fontSize: 11, color: "var(--dim)" }}>{Math.round(s.pct * 100)}%</span>}
          </div>
          {s.total > 0 && (
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(s.pct * 100)}%`, background: s.ready ? "#16a34a" : ACCENT, transition: "width .15s ease" }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addChecklistItem(draft); setDraft(""); } }}
            placeholder="Add a readiness item…"
            style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 9px", fontSize: 13 }} />
          <button onClick={() => { addChecklistItem(draft); setDraft(""); }} style={barPrimary}>Add</button>
        </div>
        {nodes.some((n) => n.type !== "annot") && (
          <button onClick={presetChecklistForAllBlocks} style={{ ...barGhost, width: "100%", justifyContent: "center", display: "flex", marginBottom: 14 }}
            title="Adds a starter readiness item to every block on the canvas — tracking/copy/checkout basics, edit or remove any of them">
            ✦ Preset checklist for all blocks
          </button>
        )}
        {checklist.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--dim)" }}>Add the things that must be true before this goes live — tracking installed, offer reviewed, checkout tested.</div>
        ) : (
          checklist.filter((c) => !c.parentId).map((c) => {
            const children = checklist.filter((k) => k.parentId === c.id);
            return (
              <div key={c.id} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 7, background: "var(--surface2)" }}>
                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklistDone(c.id)} style={{ marginTop: 3, cursor: "pointer", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: c.done ? "var(--dim)" : "var(--text)", textDecoration: c.done ? "line-through" : "none" }}>
                    {c.text}{children.length > 0 ? <span style={{ color: "var(--dim)", fontWeight: 400 }}> {`(${children.filter((k) => k.done).length}/${children.length})`}</span> : null}
                  </span>
                  <button onClick={() => setSubOpenId((v) => (v === c.id ? null : c.id))} title="Add sub-item" style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>+ Sub</button>
                  <button onClick={() => removeChecklistItem(c.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                </div>
                {children.map((k) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, marginLeft: 22, padding: "5px 8px", borderRadius: 6, background: "var(--surface2)", opacity: 0.9 }}>
                    <input type="checkbox" checked={k.done} onChange={() => toggleChecklistDone(k.id)} style={{ marginTop: 2, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: k.done ? "var(--dim)" : "var(--text)", textDecoration: k.done ? "line-through" : "none" }}>{k.text}</span>
                    <button onClick={() => removeChecklistItem(k.id)} style={{ ...barGhost, padding: "1px 6px", fontSize: 10, flexShrink: 0 }}>Remove</button>
                  </div>
                ))}
                {subOpenId === c.id && (
                  <div style={{ display: "flex", gap: 6, marginTop: 4, marginLeft: 22 }}>
                    <input value={subDraft} onChange={(e) => setSubDraft(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { addChecklistItem(subDraft, undefined, c.id); setSubDraft(""); setSubOpenId(null); } }}
                      placeholder="Sub-item…" style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }} />
                    <button onClick={() => { addChecklistItem(subDraft, undefined, c.id); setSubDraft(""); setSubOpenId(null); }} style={{ ...barGhost, fontSize: 11, padding: "3px 8px" }}>Add</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </GlassDrawer>
  );
}
