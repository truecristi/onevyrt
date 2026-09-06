/**
 * Launch Checklist: a plain, ordered list of readiness items a team checks off
 * before calling a funnel "live" — tracking wired up, offer reviewed, pages
 * written, checkout tested. Deliberately dumb (no dependencies, no due dates):
 * the point is a fast yes/no readiness signal, not a project-management tool.
 * Items can optionally link to a node (e.g. "Sales Page copy reviewed").
 */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
  linkedNodeId?: string;
  /** Id of the item this is a sub-item of. Absent means top-level. One level of nesting. */
  parentId?: string;
}

export interface ChecklistSummary {
  total: number;
  done: number;
  remaining: number;
  pct: number; // 0..1, 0 when there are no items
  ready: boolean; // true only when there's at least one item and all are done
}

export function summarizeChecklist(items: ChecklistItem[]): ChecklistSummary {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return {
    total,
    done,
    remaining: total - done,
    pct: total === 0 ? 0 : done / total,
    ready: total > 0 && done === total,
  };
}

/** Returns a copy of the item toggled done/undone; stamps or clears doneAt. Pure — never mutates. */
export function toggleChecklistItem(item: ChecklistItem, done: boolean, doneAt = new Date().toISOString()): ChecklistItem {
  return done ? { ...item, done: true, doneAt } : { ...item, done: false, doneAt: undefined };
}
