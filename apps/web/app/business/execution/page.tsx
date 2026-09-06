"use client";
/**
 * Execution OS — the Execution Centre. The EXECUTE layer of the operating loop:
 * turn the plan (Reality Map → constraint → 90-day goals) into sprints and
 * weighted tasks with a Definition of Done, and watch weighted progress move.
 *
 * The whole execution document is edited locally and saved at once (PUT to
 * /api/business/execution). Styled with the shared design-system tokens, so
 * it follows the user's light/dark theme like the rest of the product.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { GroundingChips } from "../../../components/campaign/GroundingChips";

type TaskStatus = "todo" | "doing" | "blocked" | "done";
type SprintStatus = "planned" | "active" | "done";

interface ExecGoal { id: string; title: string; metric: string; target: string; horizon: string; constraint: string; }
interface Sprint { id: string; name: string; focus: string; startsAt: string; endsAt: string; status: SprintStatus; }
interface ExecTask { id: string; title: string; sprintId: string; goalId: string; owner: string; due: string; status: TaskStatus; weight: number; definitionOfDone: string; notes: string; }
interface ExecutionData { goals: ExecGoal[]; sprints: Sprint[]; tasks: ExecTask[]; updatedAt?: string; }

// Status hues reference theme-aware design-system tokens (not raw hex) so a
// status pill stays legible — and keeps its meaning (blue = in progress,
// red = blocked, green = done) — in both the light and navy dark theme.
const TASK_STATUS_META: Record<TaskStatus, { label: string; hue: string; soft: string }> = {
  todo: { label: "To do", hue: "var(--ds-text-tertiary)", soft: "var(--ds-bg-subtle)" },
  doing: { label: "In progress", hue: "var(--ds-info)", soft: "var(--ds-info-soft)" },
  blocked: { label: "Blocked", hue: "var(--ds-danger)", soft: "var(--ds-danger-soft)" },
  done: { label: "Done", hue: "var(--ds-success)", soft: "var(--ds-success-soft)" },
};
const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "doing", "blocked", "done"];
const SPRINT_STATUS_META: Record<SprintStatus, { label: string; hue: string; soft: string }> = {
  planned: { label: "Planned", hue: "var(--ds-text-tertiary)", soft: "var(--ds-bg-subtle)" },
  active: { label: "Active", hue: "var(--ds-success)", soft: "var(--ds-success-soft)" },
  done: { label: "Done", hue: "var(--ds-info)", soft: "var(--ds-info-soft)" },
};

function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }
function progressOf(tasks: ExecTask[]): { pct: number; done: number; total: number } {
  let dw = 0, tw = 0, done = 0;
  for (const t of tasks) { const w = t.weight || 1; tw += w; if (t.status === "done") { dw += w; done += 1; } }
  return { pct: tw === 0 ? 0 : Math.round((dw / tw) * 100), done, total: tasks.length };
}

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

/** A task row. Declared at module scope (not inside the page component) so its
 *  component identity is stable across renders — otherwise every keystroke
 *  remounts the row and the focused input loses focus. */
function TaskRow({ t, open, goals, sprints, onCycle, onUpdate, onRemove, onToggle }: {
  t: ExecTask; open: boolean; goals: ExecGoal[]; sprints: Sprint[];
  onCycle: () => void; onUpdate: (patch: Partial<ExecTask>) => void; onRemove: () => void; onToggle: () => void;
}) {
  const st = TASK_STATUS_META[t.status];
  const goal = goals.find((g) => g.id === t.goalId);
  return (
    <div className={`trow ${t.status === "done" ? "is-done" : ""}`}>
      <div className="trow-main">
        <button className="status-dot" style={{ background: st.soft, color: st.hue }} title={`${st.label} — click to advance`} aria-label={`Status: ${st.label}. Click to advance.`} onClick={onCycle}>{t.status === "done" ? "✓" : t.status === "blocked" ? "!" : t.status === "doing" ? "▸" : ""}</button>
        <input className="trow-title" value={t.title} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Task…" aria-label="Task title" />
        <select className="mini-select" value={t.status} onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })} style={{ color: st.hue, background: st.soft }} aria-label="Task status">
          {TASK_STATUS_ORDER.map((s) => <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>)}
        </select>
        <input className="trow-owner" value={t.owner} onChange={(e) => onUpdate({ owner: e.target.value })} placeholder="Owner" aria-label="Owner" />
        <input className="trow-due" type="date" value={t.due} onChange={(e) => onUpdate({ due: e.target.value })} title="Due date" aria-label="Due date" />
        <select className="mini-select w" value={t.weight} onChange={(e) => onUpdate({ weight: Number(e.target.value) })} title="Weight — effort/impact, 1 (light) to 5 (heavy)" aria-label="Task weight, 1 to 5">
          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>W{w}</option>)}
        </select>
        <button className="tool" title="Details / Definition of Done" aria-expanded={open} aria-label={open ? "Hide task details" : "Show task details"} onClick={onToggle}>{open ? "▾" : "▸"}</button>
        <button className="tool danger" title="Remove task" aria-label="Remove task" onClick={onRemove}>×</button>
      </div>
      {open && (
        <div className="trow-detail">
          <label className="mini"><span>Definition of Done — how you'll know it's really finished</span>
            <textarea className="ta" value={t.definitionOfDone} onChange={(e) => onUpdate({ definitionOfDone: e.target.value })} placeholder="e.g. Landing page live, tracking fires, 1 test lead captured." />
          </label>
          <div className="cols">
            <label className="mini"><span>Linked 90-day goal</span>
              <select value={t.goalId} onChange={(e) => onUpdate({ goalId: e.target.value })}>
                <option value="">— none —</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title || "(untitled goal)"}</option>)}
              </select>
            </label>
            <label className="mini"><span>Move to sprint</span>
              <select value={t.sprintId} onChange={(e) => onUpdate({ sprintId: e.target.value })}>
                <option value="">Backlog</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name || "(sprint)"}</option>)}
              </select>
            </label>
          </div>
          <label className="mini"><span>Notes</span>
            <textarea className="ta" value={t.notes} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="Anything useful…" />
          </label>
          {goal && <p className="linkline">↳ drives <strong>{goal.title}</strong>{goal.metric ? ` · ${goal.metric}` : ""}</p>}
        </div>
      )}
    </div>
  );
}

export default function ExecutionCentrePage() {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<ExecutionData>({ goals: [], sprints: [], tasks: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiKey, setAiKeyState] = useState("");
  const [aiModel, setAiModelState] = useState("openai/gpt-4o-mini");
  const [g, setG] = useState<Grounding | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => { setAiKeyState(getAiKey()); setAiModelState(getAiModel()); }, []);
  // Display-only: what "AI draft tasks" is grounded in, for the GroundingChips
  // next to that button — so the grounding loadGrounding() applies at
  // generation time (in aiDraftTasks, untouched below) is visible up front,
  // not invisible. Loaded once on mount; not reused for the actual request.
  useEffect(() => { void loadGrounding().then(setG); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/execution${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as ExecutionData;
      setData({ goals: d.goals ?? [], sprints: d.sprints ?? [], tasks: d.tasks ?? [], updatedAt: d.updatedAt });
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };
  const mutate = (fn: (d: ExecutionData) => ExecutionData) => { setData((prev) => fn(prev)); setDirty(true); };

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/execution${wsQuery}`, {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify(latest.current),
      });
      const b = await r.json() as ExecutionData & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      // Adopt the server's sanitised document so the UI always reflects exactly
      // what was stored (any cap/clamp is visible immediately, never silent).
      setData({ goals: b.goals ?? [], sprints: b.sprints ?? [], tasks: b.tasks ?? [], updatedAt: b.updatedAt });
      setDirty(false); flash("Saved.");
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  // --- goal ops ---
  const addGoal = () => mutate((d) => ({ ...d, goals: [...d.goals, { id: uid(), title: "", metric: "", target: "", horizon: "", constraint: "" }] }));
  const updateGoal = (id: string, patch: Partial<ExecGoal>) => mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const removeGoal = (id: string) => mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id), tasks: d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: "" } : t)) }));

  // --- sprint ops ---
  const addSprint = () => mutate((d) => ({ ...d, sprints: [...d.sprints, { id: uid(), name: `Sprint ${d.sprints.length + 1}`, focus: "", startsAt: "", endsAt: "", status: "planned" }] }));
  const updateSprint = (id: string, patch: Partial<Sprint>) => mutate((d) => ({ ...d, sprints: d.sprints.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSprint = (id: string) => mutate((d) => ({ ...d, sprints: d.sprints.filter((s) => s.id !== id), tasks: d.tasks.map((t) => (t.sprintId === id ? { ...t, sprintId: "" } : t)) }));

  // --- task ops ---
  const addTask = (sprintId: string) => mutate((d) => ({ ...d, tasks: [...d.tasks, { id: uid(), title: "", sprintId, goalId: "", owner: "", due: "", status: "todo", weight: 1, definitionOfDone: "", notes: "" }] }));
  const updateTask = (id: string, patch: Partial<ExecTask>) => mutate((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removeTask = (id: string) => mutate((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  const cycleStatus = (t: ExecTask) => {
    const order: TaskStatus[] = ["todo", "doing", "done"];
    const i = order.indexOf(t.status);
    updateTask(t.id, { status: t.status === "blocked" ? "todo" : order[(i + 1) % order.length] });
  };

  // AI: break the 90-day goals (and the current constraint) into concrete
  // sprint tasks with a weight and a Definition of Done, added to the backlog.
  const aiDraftTasks = async () => {
    if (getAiProvider() === "manual") { setAiOpen(true); setErr("Connect an AI provider first (the ⚙ AI button)."); return; }
    setAiBusy(true); setErr("");
    try {
      const d = latest.current;
      let constraint = "";
      try { const cr = await fetch(`/api/business/constraint${wsQuery}`, { credentials: "include" }); if (cr.ok) { const cj = await cr.json() as { chosen?: string }; constraint = cj.chosen || ""; } } catch { /* optional context */ }
      const goalsTxt = d.goals.map((g) => `${g.title}${g.metric ? ` (${g.metric} → ${g.target})` : ""}`).filter(Boolean).join("; ") || "(no goals set — infer sensible growth tasks)";
      const system = "You are an operator breaking goals into concrete, shippable sprint tasks. Return ONLY JSON: { tasks: [{ title, weight, definitionOfDone }] } with 4-8 specific tasks. weight is 1-5 effort. Titles are short imperatives; definitionOfDone is one concrete, checkable outcome.";
      const user = `90-day goals: ${goalsTxt}\n${constraint ? `Current constraint to attack: ${constraint}\n` : ""}Draft the tasks now.`;
      const g = await loadGrounding();
      const reply = await callOpenRouter(aiKey, aiModel, system, withGrounding(g, user), 600);
      const j = extractJson(reply) as { tasks?: { title?: string; weight?: number; definitionOfDone?: string }[] };
      if (Array.isArray(j.tasks) && j.tasks.length) {
        const drafted = j.tasks.slice(0, 12).map((t): ExecTask => ({
          id: uid(), title: String(t.title ?? ""), sprintId: "", goalId: d.goals[0]?.id ?? "", owner: "", due: "",
          status: "todo", weight: Math.max(1, Math.min(5, Math.round(Number(t.weight) || 2))), definitionOfDone: String(t.definitionOfDone ?? ""), notes: "",
        }));
        mutate((dd) => ({ ...dd, tasks: [...dd.tasks, ...drafted] }));
        flash(`AI drafted ${drafted.length} tasks into your backlog.`);
      } else setErr("The AI didn't return tasks — try again.");
    } catch (e) { setErr(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(false); }
  };

  const overall = useMemo(() => progressOf(data.tasks), [data.tasks]);
  const backlog = useMemo(() => data.tasks.filter((t) => !t.sprintId), [data.tasks]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading your execution plan…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Execution Centre." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your execution plan." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="ex-header">
        <div>
          <div className="eyebrow">Execution OS</div>
          <h1>Execution Centre</h1>
          <p className="sub">Turn the plan into sprints and weighted tasks — and watch real progress move toward your 90-day goals.</p>
        </div>
        <div className="header-right">
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI settings" aria-expanded={aiOpen} aria-controls="ex-ai-panel"><MarketingIcon name="gear" size={14} /> AI</button>
          <a href="/business/reality" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Reality Map</a>
          <a href="/business/drivers" className="btn ghost sm"><MarketingIcon name="tree" size={14} /> Driver Tree</a>
          <a href="/business/constraint" className="btn ghost sm"><MarketingIcon name="plan" size={14} /> Constraint</a>
          <a href="/business/launches" className="btn ghost sm"><MarketingIcon name="rocket" size={14} /> Launches</a>
          <a href="/business/review" className="btn ghost sm"><MarketingIcon name="refresh" size={14} /> Review</a>
          <a href="/business" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a>
          <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>
        </div>
      </div>

      {aiOpen && (
        <div className="panel ai-panel" id="ex-ai-panel">
          <div className="cols">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Your key is saved to your account (encrypted) and sent straight to the AI provider. Used across the whole app&apos;s AI.</p>
        </div>
      )}
      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      {/* Overview */}
      <div className="panel">
        <div className="ov-head">
          <div>
            <span className="ov-eyebrow">Where you stand</span>
            <p className="hint">Weighted by effort, so one heavy win moves this more than several light ones. Clear anything ⚑ blocked first — it&apos;s usually what&apos;s standing between you and a client promise.</p>
          </div>
          {data.tasks.some((t) => t.status === "blocked")
            ? <span className="pill pill-danger"><MarketingIcon name="warning" size={11} /> {data.tasks.filter((t) => t.status === "blocked").length} blocked</span>
            : overall.total > 0 && overall.pct >= 100
              ? <span className="pill pill-success"><MarketingIcon name="check" size={11} /> All caught up</span>
              : null}
        </div>
        <div className="ov-body">
          <div className="ov-stat">
            <div className="ov-ring" style={{ background: `conic-gradient(var(--ds-brand) ${overall.pct * 3.6}deg, var(--ds-border-default) 0)` }}>
              <span>{overall.pct}%</span>
            </div>
            <div>
              <div className="ov-title">Overall progress</div>
              <div className="ov-sub">{overall.total > 0 ? `${overall.done}/${overall.total} tasks done · weighted` : "Add your first task below to start tracking"}</div>
            </div>
          </div>
          <div className="ov-metrics">
            <div className="ov-metric kind-goals"><span className="ov-n">{data.goals.length}</span><span className="ov-l">90-day goals</span></div>
            <div className="ov-metric kind-active"><span className="ov-n">{data.sprints.filter((s) => s.status === "active").length}</span><span className="ov-l">active sprints</span></div>
            <div className="ov-metric kind-progress"><span className="ov-n">{data.tasks.filter((t) => t.status === "doing").length}</span><span className="ov-l">in progress</span></div>
            <div className={`ov-metric kind-blocked ${data.tasks.some((t) => t.status === "blocked") ? "is-active" : ""}`}><span className="ov-n">{data.tasks.filter((t) => t.status === "blocked").length}</span><span className="ov-l">blocked</span></div>
          </div>
        </div>
      </div>

      {/* 90-day goals */}
      <div className="sec-head">
        <div><h2 className="sec-title">90-Day Goals</h2><p className="hint">The few outcomes this quarter is really about. Each should name the number it moves.</p></div>
        <button className="btn sm" onClick={addGoal}>+ Add goal</button>
      </div>
      {data.goals.length === 0 && (
        <div className="panel center muted-panel">
          <MarketingIcon name="plan" size={22} />
          <p style={{ margin: 0 }}>No goals yet — add the 1–3 outcomes that define the next 90 days. Everything below points back to one of these.</p>
        </div>
      )}
      <div className="goal-grid">
        {data.goals.map((g) => (
          <div key={g.id} className="goal-card">
            <div className="goal-top">
              <input className="goal-title" value={g.title} onChange={(e) => updateGoal(g.id, { title: e.target.value })} placeholder="Goal — e.g. 30 booked calls / month" aria-label="Goal title" />
              <button className="tool danger" title="Remove goal" aria-label="Remove goal" onClick={() => removeGoal(g.id)}>×</button>
            </div>
            <div className="cols">
              <label className="mini"><span>Metric</span><input value={g.metric} onChange={(e) => updateGoal(g.id, { metric: e.target.value })} placeholder="Booked calls" /></label>
              <label className="mini"><span>Target</span><input value={g.target} onChange={(e) => updateGoal(g.id, { target: e.target.value })} placeholder="30 / mo" /></label>
              <label className="mini"><span>By</span><input type="date" value={g.horizon} onChange={(e) => updateGoal(g.id, { horizon: e.target.value })} /></label>
            </div>
            <label className="mini"><span>Constraint it attacks</span><input value={g.constraint} onChange={(e) => updateGoal(g.id, { constraint: e.target.value })} placeholder="e.g. not enough qualified traffic" /></label>
          </div>
        ))}
      </div>

      {/* Sprints */}
      <div className="sec-head">
        <div><h2 className="sec-title">Sprints</h2><p className="hint">Short focused cycles. Each sprint attacks one thing; its bar is weighted by task effort.</p></div>
        <button className="btn sm" onClick={addSprint}>+ Add sprint</button>
      </div>
      {data.sprints.length === 0 && (
        <div className="panel center muted-panel">
          <MarketingIcon name="bolt" size={22} />
          <p style={{ margin: 0 }}>No sprints yet — add one and start pulling tasks into it. Think of a sprint as a short cycle built around one focus.</p>
        </div>
      )}
      {data.sprints.map((s) => {
        const tasks = data.tasks.filter((t) => t.sprintId === s.id);
        const p = progressOf(tasks);
        const ss = SPRINT_STATUS_META[s.status];
        return (
          <div key={s.id} className="sprint">
            <div className="sprint-head">
              <input className="sprint-name" value={s.name} onChange={(e) => updateSprint(s.id, { name: e.target.value })} placeholder="Sprint name" aria-label="Sprint name" />
              <select className="mini-select" value={s.status} onChange={(e) => updateSprint(s.id, { status: e.target.value as SprintStatus })} style={{ color: ss.hue, background: ss.soft }} aria-label="Sprint status">
                {(["planned", "active", "done"] as SprintStatus[]).map((st) => <option key={st} value={st}>{SPRINT_STATUS_META[st].label}</option>)}
              </select>
              <input className="sprint-date" type="date" value={s.startsAt} onChange={(e) => updateSprint(s.id, { startsAt: e.target.value })} title="Start" aria-label="Sprint start date" />
              <input className="sprint-date" type="date" value={s.endsAt} onChange={(e) => updateSprint(s.id, { endsAt: e.target.value })} title="End" aria-label="Sprint end date" />
              <button className="tool danger" title="Remove sprint" aria-label="Remove sprint" onClick={() => removeSprint(s.id)}>×</button>
            </div>
            <input className="sprint-focus" value={s.focus} onChange={(e) => updateSprint(s.id, { focus: e.target.value })} placeholder="Focus — the one thing this sprint is about" aria-label="Sprint focus" />
            <div className="prog">
              <div className="prog-bar"><span style={{ width: `${p.pct}%` }} /></div>
              <span className="prog-lbl">{p.pct}% · {p.done}/{p.total}</span>
              {tasks.some((t) => t.status === "blocked") && <span className="pill pill-danger"><MarketingIcon name="warning" size={11} /> {tasks.filter((t) => t.status === "blocked").length} blocked</span>}
            </div>
            <div className="tasks">
              {tasks.map((t) => <TaskRow key={t.id} t={t} open={!!expanded[t.id]} goals={data.goals} sprints={data.sprints} onCycle={() => cycleStatus(t)} onUpdate={(patch) => updateTask(t.id, patch)} onRemove={() => removeTask(t.id)} onToggle={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))} />)}
            </div>
            <button className="btn ghost sm add-task" onClick={() => addTask(s.id)}>+ Add task to {s.name || "sprint"}</button>
          </div>
        );
      })}

      {/* Backlog */}
      <div className="sec-head">
        <div><h2 className="sec-title">Backlog</h2><p className="hint">Unscheduled tasks. Assign them to a sprint from the ▸ details.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn sm" style={{ color: "var(--ds-brand)", borderColor: "var(--ds-brand)" }} onClick={() => void aiDraftTasks()} disabled={aiBusy}>{aiBusy ? "Drafting…" : <><MarketingIcon name="spark" size={13} /> AI draft tasks</>}</button>
          <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
          <button className="btn sm" onClick={() => addTask("")}>+ Add to backlog</button>
        </div>
      </div>
      <div className="sprint">
        <div className="tasks">
          {backlog.length === 0 ? <p className="muted-panel" style={{ padding: "6px 2px" }}>Backlog is empty — nice and tidy. New tasks land here until you assign them to a sprint.</p> : backlog.map((t) => <TaskRow key={t.id} t={t} open={!!expanded[t.id]} goals={data.goals} sprints={data.sprints} onCycle={() => cycleStatus(t)} onUpdate={(patch) => updateTask(t.id, patch)} onRemove={() => removeTask(t.id)} onToggle={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))} />)}
        </div>
      </div>

      <div className="step-bar">
        <div className="step-count">
          <span className={`save-dot ${dirty ? "warn" : data.updatedAt ? "ok" : ""}`} aria-hidden="true" />
          {dirty ? "Unsaved changes" : data.updatedAt ? "All changes saved" : "Nothing saved yet"}
        </div>
        <div className="step-actions">
          <button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save plan"}</button>
        </div>
      </div>
    </Shell>
  );
}


function Shell({ children }: { children: ReactNode }) {
  return <div className="ex-root"><style>{CSS}</style>{children}</div>;
}

const CSS = `
.ex-root{
  /* Theme-aware colour tokens inherited from the shared design system — not
     hardcoded here (hardcoding froze the page in light mode). */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ring:0 0 0 3px rgba(10,158,110,.2);--ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:1000px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .ex-root{
  /* Softer, black-based shadows read better on the navy dark surface. */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.ex-root *{box-sizing:border-box;}
.ex-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.ex-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;line-height:1.6;}
.header-right{display:flex;gap:8px;align-items:center;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.btn:active{transform:translateY(0);}
.btn:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.btn:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;align-items:center;justify-content:center;gap:10px;min-height:120px;text-align:center;color:var(--muted);flex-direction:column;}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.muted-panel{color:var(--muted);font-size:13px;}
.lock{font-size:34px;}
input,textarea,select{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s,background-color .15s;}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:54px;resize:vertical;}
.cols{display:flex;gap:10px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:120px;}
.mini{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:500;color:var(--muted);}

/* AI panel — a soft brand-tinted card so it visually reads as "AI", matching
   the accent-card treatment used for AI surfaces elsewhere in the app. */
.ai-panel{background:linear-gradient(180deg,var(--ds-brand-soft),var(--ds-surface-subtle) 65%);}

/* Status pill — small tinted badge for a count that needs to stand out
   (blocked tasks, all-clear) without a whole banner. */
.pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;flex:none;}
.pill-danger{background:var(--ds-danger-soft);color:var(--ds-danger);}
.pill-success{background:var(--ds-success-soft);color:var(--ds-success);}

/* Overview */
.ov-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
.ov-eyebrow{display:block;margin-bottom:2px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ds-brand-active);}
.ov-head .hint{margin-top:3px;max-width:56ch;}
.ov-body{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.ov-stat{display:flex;align-items:center;gap:14px;}
.ov-ring{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;flex:none;}
.ov-ring span{background:var(--surface);width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:15px;}
.ov-title{font-weight:700;font-size:15px;}
.ov-sub{font-size:12.5px;color:var(--muted);}
.ov-metrics{display:flex;gap:10px;flex-wrap:wrap;}
.ov-metric{display:flex;flex-direction:column;padding:4px 14px;border-left:2px solid var(--border);transition:border-color .15s var(--ds-ease);}
.ov-metric.kind-goals{border-left-color:color-mix(in srgb,var(--ds-brand) 45%,transparent);}
.ov-metric.kind-active{border-left-color:color-mix(in srgb,var(--ds-success) 45%,transparent);}
.ov-metric.kind-progress{border-left-color:color-mix(in srgb,var(--ds-info) 45%,transparent);}
.ov-metric.kind-blocked.is-active{border-left-color:var(--ds-danger);}
.ov-metric.kind-blocked.is-active .ov-n{color:var(--ds-danger);}
.ov-n{font-size:22px;font-weight:700;letter-spacing:-.5px;}
.ov-l{font-size:11.5px;color:var(--muted);font-weight:500;}

/* Section heads */
.sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:20px 2px 12px;}
.sec-title{font-size:18px;margin:0;letter-spacing:-.3px;}

/* Goals */
.goal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}
.goal-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px;display:flex;flex-direction:column;gap:9px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.goal-card:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-md);}
.goal-top{display:flex;gap:8px;align-items:center;}
.goal-title{font-weight:700;font-size:14px;}

/* Sprints */
.sprint{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px;margin-bottom:12px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s var(--ds-ease);}
.sprint:hover{border-color:var(--ds-border-strong);}
.sprint-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.sprint-name{font-weight:700;font-size:15px;flex:1;min-width:140px;}
.sprint-date{flex:0 0 140px;min-width:120px;}
.sprint-focus{margin-top:9px;font-size:13px;color:var(--muted);}
.prog{display:flex;align-items:center;gap:10px;margin:11px 0 4px;flex-wrap:wrap;}
.prog-bar{flex:1;min-width:80px;height:8px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;}
.prog-bar span{display:block;height:100%;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));border-radius:99px;transition:width .3s var(--ds-ease);animation:exProgFill .5s var(--ds-ease) both;}
.prog-lbl{font-size:12px;font-weight:700;color:var(--muted);flex:none;}
@keyframes exProgFill{from{width:0 !important;}}
.tasks{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
.add-task{margin-top:8px;}

/* Task rows */
.trow{border:1px solid var(--border);border-radius:var(--ds-radius-md);background:var(--ds-surface-subtle);transition:border-color .15s var(--ds-ease);}
.trow:hover{border-color:var(--ds-border-strong);}
.trow.is-done{opacity:.72;}
.trow-main{display:flex;align-items:center;gap:7px;padding:7px 9px;}
/* Soft tint + saturated glyph (not a solid fill behind white text) so every
   status dot stays AA-legible in the dark theme, where --ds-danger/-info/
   -success are brightened for on-surface text rather than tuned as a fill. */
.status-dot{width:22px;height:22px;border-radius:50%;border:1.5px solid currentColor;font-size:12px;font-weight:700;cursor:pointer;flex:none;display:grid;place-items:center;line-height:1;transition:transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.status-dot:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.status-dot:active{transform:translateY(0);}
.status-dot:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.trow-title{flex:1;min-width:120px;border-color:transparent;background:transparent;font-weight:500;}
.trow-title:hover{background:var(--surface);}
.trow-title:focus{background:var(--surface);border-color:var(--accent);}
.trow.is-done .trow-title{text-decoration:line-through;color:var(--muted);}
.mini-select{flex:0 0 122px;font-weight:500;font-size:12px;}
.mini-select.w{flex:0 0 62px;}
.trow-owner{flex:0 0 100px;min-width:80px;}
.trow-due{flex:0 0 140px;min-width:120px;}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;flex:none;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.tool:hover{border-color:var(--ds-border-strong);color:var(--text);transform:translateY(-1px);}
.tool:active{transform:translateY(0);}
.tool:focus-visible{outline:2px solid var(--ds-brand);outline-offset:1px;}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);}
.trow-detail{border-top:1px solid var(--border);padding:11px 12px;display:flex;flex-direction:column;gap:10px;}
.linkline{font-size:12px;color:var(--muted);margin:0;}
.linkline strong{color:var(--text);}

.step-bar{position:sticky;bottom:14px;margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:var(--ds-shadow-md);}
.step-count{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:var(--muted);}
.save-dot{width:7px;height:7px;border-radius:50%;background:var(--ds-text-disabled);flex:none;}
.save-dot.warn{background:var(--ds-warning);}
.save-dot.ok{background:var(--ds-success);}
.step-actions{display:flex;gap:9px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce){ .ex-root *:not(.spinner){transition:none!important;animation:none!important;} }
`;
