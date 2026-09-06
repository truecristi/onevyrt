"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { confirmDialog } from "../../../components/Modal";

interface ChecklistItem { id: string; label: string; }
interface Assignment { id: string; title: string; instructions: string; checklist: ChecklistItem[]; evidencePrompt: string; }
interface Lesson { id: string; order: number; title: string; outcome: string; content: string; videoUrl?: string; resourceUrls?: string[]; toolDeepLink?: string; assignment?: Assignment; estimatedMinutes?: number; }
interface Stage { id: string; order: number; title: string; outcome: string; lessons: Lesson[]; }
interface Programme { id: string; name: string; status: "draft" | "published"; stages: Stage[]; }

/** Mirrors curriculum-store.ts's CurriculumDeleteImpact. */
interface DeleteImpact { learnersWithProgress: number; learnersAwaitingReview: number; }
const ZERO_IMPACT: DeleteImpact = { learnersWithProgress: 0, learnersAwaitingReview: 0 };

/** How the delete-confirm message reads once a learner-impact count is known
 *  — "3 learners have progress on…, including 1 awaiting review". Falls back
 *  to today's plain message when nothing's been touched, so the common
 *  no-impact case reads exactly as it always has. */
function deleteConfirmMessage(impact: DeleteImpact, subject: string, plainMessage: string, verb: string): string {
  if (impact.learnersWithProgress === 0) return plainMessage;
  const { learnersWithProgress: n, learnersAwaitingReview: awaiting } = impact;
  const who = `${n} learner${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"}`;
  const review = awaiting > 0 ? `, including ${awaiting} awaiting review` : "";
  return `${who} progress ${subject}${review} — ${verb}?`;
}

const TOOL_KEYS = ["", "define", "goals", "forces", "money", "objections", "hooks", "canvas", "raving", "assumptions", "experiments", "readiness"];

function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }
const EMPTY_ASSIGNMENT: Assignment = { id: "", title: "", instructions: "", checklist: [], evidencePrompt: "" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span className="kv-label">{label}</span>{children}</label>;
}

export default function CurriculumAdminPage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Lesson>>>({});
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/admin/curriculum", { credentials: "include" });
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as { programme: Programme };
      setProgramme(d.programme);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (action: string, payload: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey); setMsg("");
    try {
      const r = await fetch("/api/admin/curriculum", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ action, ...payload }) });
      const d = await r.json() as { programme?: Programme; error?: string };
      if (!r.ok || !d.programme) { setMsg(d.error ?? "Could not save."); setBusy(null); return; }
      setProgramme(d.programme);
      setMsg("Saved ✓");
    } catch { setMsg("Network error."); }
    setBusy(null);
  }, []);

  // Learner-impact counts for the delete confirm dialogs, keyed by
  // "stage:<id>" / "lesson:<id>". Warmed on hover/focus of a delete button —
  // well before the click that would otherwise need to wait on this fetch —
  // so by the time an admin actually clicks, the count is normally already
  // in hand and the dialog opens with zero added latency. A click with no
  // prior warm (e.g. a fast keyboard activation) still works: the same
  // promise is created lazily and simply awaited then. Never re-fetched once
  // resolved for a given id — ids are freshly minted per add/duplicate, so
  // there's no stale-id reuse to worry about within a page session.
  const impactCache = useRef(new Map<string, Promise<DeleteImpact>>());
  const warmDeleteImpact = useCallback((key: string, qs: string): Promise<DeleteImpact> => {
    let p = impactCache.current.get(key);
    if (!p) {
      p = fetch(`/api/admin/curriculum?${qs}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() as Promise<{ impact?: DeleteImpact }> : null))
        .then((d) => d?.impact ?? ZERO_IMPACT)
        .catch(() => ZERO_IMPACT);
      impactCache.current.set(key, p);
    }
    return p;
  }, []);

  const confirmDeleteStage = useCallback(async (stage: Stage) => {
    const impact = await warmDeleteImpact(`stage:${stage.id}`, `stageId=${encodeURIComponent(stage.id)}`);
    const message = deleteConfirmMessage(impact, `across "${stage.title}"`, `Delete stage "${stage.title}" and all its lessons?`, `delete this stage and all its lessons anyway`);
    const ok = await confirmDialog({ title: "Delete stage", danger: true, confirmLabel: "Delete stage", message });
    if (ok) void act("deleteStage", { stageId: stage.id }, `stage-${stage.id}`);
  }, [act, warmDeleteImpact]);

  const confirmDeleteLesson = useCallback(async (lesson: Lesson) => {
    const impact = await warmDeleteImpact(`lesson:${lesson.id}`, `lessonId=${encodeURIComponent(lesson.id)}`);
    const message = deleteConfirmMessage(impact, `on "${lesson.title}"`, `Delete lesson "${lesson.title}"?`, `delete anyway`);
    const ok = await confirmDialog({ title: "Delete lesson", danger: true, confirmLabel: "Delete", message });
    if (ok) void act("deleteLesson", { lessonId: lesson.id }, `lesson-${lesson.id}`);
  }, [act, warmDeleteImpact]);

  const draftFor = (lesson: Lesson): Lesson => ({ ...lesson, ...drafts[lesson.id] });
  const setDraft = (lessonId: string, patch: Partial<Lesson>) => setDrafts((d) => ({ ...d, [lessonId]: { ...d[lessonId], ...patch } }));
  const setAssignmentDraft = (lesson: Lesson, fn: (a: Assignment) => Assignment) =>
    setDrafts((d) => ({ ...d, [lesson.id]: { ...d[lesson.id], assignment: fn(d[lesson.id]?.assignment ?? lesson.assignment ?? EMPTY_ASSIGNMENT) } }));

  const orderedStages = programme ? [...programme.stages].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="ca-root">
      <style>{CSS}</style>
      <header className="ca-header">
        <div>
          <div className="eyebrow">ONEVYRT · CURRICULUM</div>
          <h1>Programme content editor</h1>
        </div>
        <div className="header-right">
          {programme && <span className={`status-chip status-${programme.status}`}>{programme.status}</span>}
          {programme && (
            <button className="btn" onClick={() => void act("setStatus", { status: programme.status === "published" ? "draft" : "published" }, "status")} disabled={busy === "status"}>
              {programme.status === "published" ? "Unpublish" : "Publish"}
            </button>
          )}
          <a href="/admin" className="btn">← Admin</a>
        </div>
      </header>

      {msg && <div className={`msg ${msg.includes("✓") ? "ok" : "err"}`} role={msg.includes("✓") ? "status" : "alert"} aria-live={msg.includes("✓") ? "polite" : "assertive"}>{msg}</div>}

      {state === "loading" && <p className="muted pad">Loading…</p>}
      {state === "error" && <p className="muted pad">Something went wrong. <button className="link" onClick={() => void load()}>Try again</button></p>}
      {state === "forbidden" && (
        <div className="card notice">
          <h2>Not authorized</h2>
          <p className="muted">This page is only available to instance admins.</p>
        </div>
      )}

      {state === "ok" && programme && (
        <>
          {orderedStages.map((stage, si) => (
            <section className="card" key={stage.id}>
              <div className="stage-head">
                <input className="stage-title" value={stage.title} onChange={(e) => setProgramme((p) => p && { ...p, stages: p.stages.map((s) => (s.id === stage.id ? { ...s, title: e.target.value } : s)) })}
                  onBlur={(e) => void act("updateStage", { stageId: stage.id, title: e.target.value }, `stage-${stage.id}`)} />
                <div className="row-actions">
                  <button className="btn" onClick={() => void act("moveStage", { stageId: stage.id, direction: "up" }, `stage-${stage.id}`)} disabled={si === 0}>↑</button>
                  <button className="btn" onClick={() => void act("moveStage", { stageId: stage.id, direction: "down" }, `stage-${stage.id}`)} disabled={si === orderedStages.length - 1}>↓</button>
                  <button className="btn danger"
                    onMouseEnter={() => { void warmDeleteImpact(`stage:${stage.id}`, `stageId=${encodeURIComponent(stage.id)}`); }}
                    onFocus={() => { void warmDeleteImpact(`stage:${stage.id}`, `stageId=${encodeURIComponent(stage.id)}`); }}
                    onClick={() => void confirmDeleteStage(stage)}>Delete stage</button>
                </div>
              </div>
              <textarea className="stage-outcome" value={stage.outcome} placeholder="Stage outcome"
                onChange={(e) => setProgramme((p) => p && { ...p, stages: p.stages.map((s) => (s.id === stage.id ? { ...s, outcome: e.target.value } : s)) })}
                onBlur={(e) => void act("updateStage", { stageId: stage.id, outcome: e.target.value }, `stage-${stage.id}`)} />

              {[...stage.lessons].sort((a, b) => a.order - b.order).map((lesson, li) => {
                const expanded = expandedLessonId === lesson.id;
                const d = draftFor(lesson);
                const a = d.assignment ?? EMPTY_ASSIGNMENT;
                return (
                  <div className="lesson" key={lesson.id}>
                    <div
                      className="lesson-head"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() => setExpandedLessonId(expanded ? null : lesson.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedLessonId(expanded ? null : lesson.id); }
                      }}
                    >
                      <span className="lesson-title">{lesson.title}</span>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn" onClick={() => void act("moveLesson", { lessonId: lesson.id, direction: "up" }, `lesson-${lesson.id}`)} disabled={li === 0}>↑</button>
                        <button className="btn" onClick={() => void act("moveLesson", { lessonId: lesson.id, direction: "down" }, `lesson-${lesson.id}`)} disabled={li === stage.lessons.length - 1}>↓</button>
                        <button className="btn" onClick={() => void act("duplicateLesson", { lessonId: lesson.id }, `lesson-${lesson.id}`)}>Duplicate</button>
                        <button className="btn danger"
                          onMouseEnter={() => { void warmDeleteImpact(`lesson:${lesson.id}`, `lessonId=${encodeURIComponent(lesson.id)}`); }}
                          onFocus={() => { void warmDeleteImpact(`lesson:${lesson.id}`, `lessonId=${encodeURIComponent(lesson.id)}`); }}
                          onClick={() => void confirmDeleteLesson(lesson)}>Delete</button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="lesson-body">
                        <Field label="Title"><input value={d.title} onChange={(e) => setDraft(lesson.id, { title: e.target.value })} /></Field>
                        <Field label="Outcome"><input value={d.outcome} onChange={(e) => setDraft(lesson.id, { outcome: e.target.value })} /></Field>
                        <Field label="Content"><textarea rows={4} value={d.content} onChange={(e) => setDraft(lesson.id, { content: e.target.value })} /></Field>
                        <div className="field-row">
                          <Field label="Video URL"><input value={d.videoUrl ?? ""} onChange={(e) => setDraft(lesson.id, { videoUrl: e.target.value })} /></Field>
                          <Field label="Est. minutes"><input type="number" value={d.estimatedMinutes ?? ""} onChange={(e) => setDraft(lesson.id, { estimatedMinutes: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                        </div>
                        <Field label="Tool deep-link">
                          <select value={d.toolDeepLink ?? ""} onChange={(e) => setDraft(lesson.id, { toolDeepLink: e.target.value })}>
                            {TOOL_KEYS.map((k) => <option key={k} value={k}>{k || "(none)"}</option>)}
                          </select>
                        </Field>
                        <div className="assign-block">
                          <span className="kv-label">Assignment</span>
                          <p className="muted">Optional — but a lesson with no assignment can never be submitted or marked complete, so learners get stuck on it. Leave the title blank to keep this lesson without one.</p>
                          <Field label="Assignment title"><input value={a.title} placeholder="e.g. Capture your baseline" onChange={(e) => setAssignmentDraft(lesson, (x) => ({ ...x, title: e.target.value }))} /></Field>
                          <Field label="Instructions"><textarea rows={3} value={a.instructions} placeholder="What the learner should do before submitting" onChange={(e) => setAssignmentDraft(lesson, (x) => ({ ...x, instructions: e.target.value }))} /></Field>
                          <Field label="Evidence prompt"><textarea rows={2} value={a.evidencePrompt} placeholder="What they should paste in as evidence" onChange={(e) => setAssignmentDraft(lesson, (x) => ({ ...x, evidencePrompt: e.target.value }))} /></Field>
                          <div className="field">
                            <span className="kv-label">Checklist</span>
                            {a.checklist.map((item, i) => (
                              <div className="field-row" key={item.id}>
                                <input style={{ flex: 1 }} value={item.label} placeholder="Checklist item" aria-label={`Checklist item ${i + 1}`}
                                  onChange={(e) => setAssignmentDraft(lesson, (x) => ({ ...x, checklist: x.checklist.map((c) => (c.id === item.id ? { ...c, label: e.target.value } : c)) }))} />
                                <button className="btn danger" aria-label={`Remove checklist item ${i + 1}`} onClick={() => setAssignmentDraft(lesson, (x) => ({ ...x, checklist: x.checklist.filter((c) => c.id !== item.id) }))}>Remove</button>
                              </div>
                            ))}
                            <button className="btn" onClick={() => setAssignmentDraft(lesson, (x) => ({ ...x, checklist: [...x.checklist, { id: uid(), label: "" }] }))}>+ Add checklist item</button>
                          </div>
                        </div>
                        <button className="btn primary" disabled={busy === `lesson-${lesson.id}`}
                          onClick={() => {
                            const checklist = a.checklist.map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label);
                            const assignment = a.title.trim()
                              ? { id: a.id || uid(), title: a.title.trim(), instructions: a.instructions.trim(), evidencePrompt: a.evidencePrompt.trim(), checklist }
                              : null;
                            void act("updateLesson", {
                              lessonId: lesson.id, title: d.title, outcome: d.outcome, content: d.content,
                              videoUrl: d.videoUrl ?? "", toolDeepLink: d.toolDeepLink ?? "", estimatedMinutes: d.estimatedMinutes,
                              assignment,
                            }, `lesson-${lesson.id}`);
                          }}>
                          {busy === `lesson-${lesson.id}` ? "Saving…" : "Save lesson"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="field-row" style={{ marginTop: 10 }}>
                <input placeholder="New lesson title" value={newLessonTitle[stage.id] ?? ""} onChange={(e) => setNewLessonTitle((m) => ({ ...m, [stage.id]: e.target.value }))} />
                <button className="btn" disabled={!newLessonTitle[stage.id]?.trim() || busy === `newlesson-${stage.id}`}
                  onClick={() => { void act("addLesson", { stageId: stage.id, title: newLessonTitle[stage.id] }, `newlesson-${stage.id}`); setNewLessonTitle((m) => ({ ...m, [stage.id]: "" })); }}>
                  Add lesson
                </button>
              </div>
            </section>
          ))}

          <section className="card">
            <h2>New stage</h2>
            <div className="field-row">
              <input placeholder="Stage title" value={newStageTitle} onChange={(e) => setNewStageTitle(e.target.value)} />
              <button className="btn primary" disabled={!newStageTitle.trim() || busy === "newstage"}
                onClick={() => { void act("addStage", { title: newStageTitle }, "newstage"); setNewStageTitle(""); }}>
                Add stage
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const CSS = `
.ca-root{max-width:960px;margin:0 auto;padding:28px 20px 80px;color:var(--ds-text-primary);font-family:var(--ds-font);}
.ca-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.ca-header h1{font-size:22px;font-weight:700;margin:2px 0 0;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);}
.header-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;background:var(--ds-surface);border:1px solid var(--ds-border-default);color:var(--ds-text-primary);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;text-decoration:none;}
.btn:hover{border-color:var(--ds-border-strong);}
.btn:disabled{opacity:.6;cursor:default;}
.btn.primary{background:var(--ds-brand-solid);border-color:var(--ds-brand-solid);color:var(--ds-brand-contrast);font-weight:500;}
.btn.danger{color:var(--ds-danger);border-color:color-mix(in srgb, var(--ds-danger) 45%, transparent);}
.card{background:var(--ds-surface);border:1px solid var(--ds-border-subtle);border-radius:12px;padding:16px 18px;margin-bottom:14px;}
.card h2{font-size:15px;margin:0 0 10px;}
.muted{color:var(--ds-text-tertiary);}
.pad{padding:20px 0;}
.link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font-size:inherit;}
.notice{border-color:color-mix(in srgb, var(--ds-danger) 45%, transparent);background:var(--ds-danger-soft);}
.msg{padding:8px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);}
.status-chip{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:3px 8px;border-radius:999px;}
.status-published{background:var(--ds-success-soft);color:var(--ds-success);}
.status-draft{background:var(--ds-warning-soft);color:var(--ds-warning);}
.stage-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;}
.stage-title{font-size:16px;font-weight:700;border:none;background:transparent;flex:1;padding:2px 0;}
.stage-title:focus{outline:1px solid var(--ds-brand);border-radius:4px;}
.stage-outcome{width:100%;box-sizing:border-box;border:1px solid var(--ds-border-subtle);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--ds-text-secondary);resize:vertical;min-height:32px;margin-bottom:10px;}
.row-actions{display:flex;gap:6px;flex-wrap:wrap;}
.lesson{border-top:1px solid var(--ds-border-subtle);padding:8px 0;}
.lesson-head{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;}
.lesson-title{font-size:13px;font-weight:500;}
.lesson-body{margin-top:10px;display:flex;flex-direction:column;gap:8px;}
.assign-block{border-top:1px dashed var(--ds-border-subtle);margin-top:2px;padding-top:10px;display:flex;flex-direction:column;gap:8px;}
.field{display:flex;flex-direction:column;gap:3px;flex:1;}
.field-row{display:flex;gap:8px;flex-wrap:wrap;}
.kv-label{font-size:10px;font-weight:700;color:var(--ds-text-tertiary);letter-spacing:.3px;text-transform:uppercase;}
input,textarea,select{font:inherit;border:1px solid var(--ds-border-default);border-radius:6px;padding:6px 8px;font-size:13px;box-sizing:border-box;background:var(--ds-surface);color:var(--ds-text-primary);}
input:focus,textarea:focus,select:focus{outline:1px solid var(--ds-brand);}
`;
