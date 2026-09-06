/**
 * Business-OS step progress — the pure logic behind each numbered step's
 * status on the Business hub. Extracted from app/business/page.tsx so it can be
 * unit-tested in isolation.
 *
 * The important distinction this module enforces: `started` means the step has
 * been *touched* (some data exists), while `done` means it is *meaningfully
 * complete* — a stricter bar. Keeping the two apart stops the hub's progress
 * bar and "Continue here" pointer from marking a barely-started step finished
 * and skipping past unfinished work.
 */

export interface Status { done: boolean; started: boolean; stat: string; }
export type StatusMap = Record<string, Status>;

export function parseNum(s: unknown): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim(); if (!t) return NaN;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[%$,\s]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}

export function computeStatus(key: string, d: unknown): Status {
  const empty: Status = { done: false, started: false, stat: "" };
  if (!d || typeof d !== "object") return empty;
  const o = d as Record<string, unknown>;
  try {
    if (key === "reality") {
      const now = (o.now ?? {}) as Record<string, string>;
      const hasNow = Object.values(now).some((v) => typeof v === "string" && v.trim());
      const started = !!(o.targetRevenue || o.businessIn || o.businessReallyIn || hasNow);
      const done = !!o.targetRevenue && hasNow; // a target AND a real snapshot
      const stat = o.targetRevenue ? `Target: ${o.targetRevenue}` : hasNow ? "Snapshot captured" : "";
      return { done, started, stat };
    }
    if (key === "drivers") {
      const drivers = (Array.isArray(o.drivers) ? o.drivers : []) as { label?: string; current?: string; target?: string }[];
      let topLabel = "", topF = 1;
      for (const dr of drivers) { const c = parseNum(dr.current), t = parseNum(dr.target); if (Number.isFinite(c) && Number.isFinite(t) && c !== 0 && t / c > topF) { topF = t / c; topLabel = dr.label ?? ""; } }
      // Done only when at least one driver has BOTH a current and a target set.
      const complete = drivers.some((dr) => Number.isFinite(parseNum(dr.current)) && Number.isFinite(parseNum(dr.target)));
      return { done: complete, started: drivers.length > 0, stat: drivers.length ? (topLabel ? `Top lever: ${topLabel}` : `${drivers.length} drivers`) : "" };
    }
    if (key === "constraint") {
      const areas = (Array.isArray(o.areas) ? o.areas : []) as { area?: string; severity?: number }[];
      let top = "", sev = 0;
      for (const a of areas) { if ((a.severity ?? 0) > sev) { sev = a.severity ?? 0; top = a.area ?? ""; } }
      const chosen = typeof o.chosen === "string" ? o.chosen : "";
      const started = !!(chosen || sev > 0);
      const done = !!chosen; // done only when a constraint is actually chosen
      return { done, started, stat: chosen ? `Focus: ${chosen}` : top ? `Likely: ${top}` : "" };
    }
    if (key === "execution") {
      const goals = (Array.isArray(o.goals) ? o.goals : []);
      const sprints = (Array.isArray(o.sprints) ? o.sprints : []);
      const tasks = (Array.isArray(o.tasks) ? o.tasks : []) as { status?: string; weight?: number }[];
      let dw = 0, tw = 0; for (const t of tasks) { const w = t.weight || 1; tw += w; if (t.status === "done") dw += w; }
      const pct = tw === 0 ? 0 : Math.round((dw / tw) * 100);
      const started = goals.length > 0 || tasks.length > 0;
      const done = goals.length > 0 && tasks.length > 0; // both a goal and tasks
      return { done, started, stat: started ? `${pct}% done · ${sprints.length} sprint${sprints.length === 1 ? "" : "s"}` : "" };
    }
    if (key === "launches") {
      const launches = (Array.isArray(o.launches) ? o.launches : []) as { name?: string; readiness?: { done?: boolean; hardBlocker?: boolean; weight?: number }[] }[];
      if (launches.length === 0) return empty;
      const l = launches[0]!;
      const items = l.readiness ?? [];
      let dw = 0, tw = 0; let blocked = false;
      for (const it of items) { const w = it.weight || 1; tw += w; if (it.done) dw += w; if (it.hardBlocker && !it.done) blocked = true; }
      const pct = tw === 0 ? 0 : Math.round((dw / tw) * 100);
      const go = items.length > 0 && !blocked;
      // Done only when the launch actually has a readiness checklist, not just
      // a named launch with nothing filled in.
      return { done: items.length > 0, started: true, stat: `${launches.length} launch${launches.length === 1 ? "" : "es"} · ${pct}% ${go ? "GO" : "NO-GO"}` };
    }
    if (key === "review") {
      const cycles = (Array.isArray(o.cycles) ? o.cycles : []) as { period?: string }[];
      return { done: cycles.length > 0, started: cycles.length > 0, stat: cycles.length ? `${cycles.length} cycle${cycles.length === 1 ? "" : "s"} · last: ${cycles[0]?.period || "—"}` : "" };
    }
  } catch { /* fall through */ }
  return empty;
}
