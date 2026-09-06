"use client";
/**
 * A few more isolated data clusters lifted out of funnel-studio.tsx — retargeting
 * loops, the readiness checklist, the 7-Systems program (definition + force
 * actions + lesson progress), per-block ops, and the profit-driver / client-value
 * inputs. Each is a self-contained hook returning the same names the component
 * used inline, so serialization (applyDoc/toDoc) and JSX are unchanged.
 *
 * The checklist's "preset for all blocks" action stays in the component because
 * it reads the live canvas nodes; the hook exposes setChecklist for it.
 */
import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_PROFIT_DRIVER_INPUTS,
  type RetargetingLoop, type ChecklistItem,
  type BusinessDefinition, type ForceActionItem, type ForceNumber,
  type BlockOpsEntry,
  type ProfitDriverInputs, type ClientPromise, type RavingFansInputs,
} from "@onevyrt/engine";

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function useRetargetingLoops() {
  const [retargetingLoops, setRetargetingLoops] = useState<RetargetingLoop[]>([]);
  const addRetargetingLoop = useCallback((fromNodeId: string, fromPort: RetargetingLoop["fromPort"], toNodeId: string, decayRate: number) => {
    if (!fromNodeId || !toNodeId) return;
    setRetargetingLoops((ls) => [...ls, { id: rid("loop"), fromNodeId, fromPort, toNodeId, decayRate }]);
  }, []);
  const removeRetargetingLoop = useCallback((id: string) => setRetargetingLoops((ls) => ls.filter((l) => l.id !== id)), []);
  return { retargetingLoops, setRetargetingLoops, addRetargetingLoop, removeRetargetingLoop };
}

export function useChecklist() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const addChecklistItem = useCallback((text: string, linkedNodeId?: string, parentId?: string) => {
    const t = text.trim();
    if (!t) return;
    setChecklist((cs) => [...cs, {
      id: rid("chk"), text: t, done: false, createdAt: new Date().toISOString(),
      ...(linkedNodeId ? { linkedNodeId } : {}),
      ...(parentId ? { parentId } : {}),
    }]);
  }, []);
  const toggleChecklistDone = useCallback((id: string) => {
    setChecklist((cs) => cs.map((c) => (c.id === id ? { ...c, done: !c.done, doneAt: !c.done ? new Date().toISOString() : undefined } : c)));
  }, []);
  const removeChecklistItem = useCallback((id: string) => setChecklist((cs) => cs.filter((c) => c.id !== id && c.parentId !== id)), []);
  return { checklist, setChecklist, addChecklistItem, toggleChecklistDone, removeChecklistItem };
}

export function useProgram() {
  const [definition, setDefinition] = useState<BusinessDefinition>({});
  const patchDefinition = useCallback((patch: Partial<BusinessDefinition>) => setDefinition((d) => ({ ...d, ...patch })), []);
  const [forceActions, setForceActions] = useState<ForceActionItem[]>([]);
  const addForceAction = useCallback((force: ForceNumber, principle: string, actionItem: string, dollarValue?: number, deadline?: string, owner?: string) => {
    if (!actionItem.trim()) return;
    setForceActions((arr) => [...arr, {
      id: rid("fa"), force, principle: principle.trim(), actionItem: actionItem.trim(),
      status: "open", priority: "medium", createdAt: new Date().toISOString(),
      ...(dollarValue && dollarValue > 0 ? { dollarValue } : {}),
      ...(deadline ? { deadline } : {}),
      ...(owner?.trim() ? { owner: owner.trim() } : {}),
    }]);
  }, []);
  const patchForceAction = useCallback((id: string, patch: Partial<ForceActionItem>) => {
    setForceActions((arr) => arr.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const removeForceAction = useCallback((id: string) => setForceActions((arr) => arr.filter((a) => a.id !== id)), []);
  const [visitedLessons, setVisitedLessons] = useState<string[]>([]);
  const onVisitLesson = useCallback((key: string) => setVisitedLessons((v) => (v.includes(key) ? v : [...v, key])), []);
  const [introSeen, setIntroSeen] = useState(false);
  const [graduationSeen, setGraduationSeen] = useState(false);
  const program = useMemo(() => ({ definition, forceActions, visitedLessons, introSeen, graduationSeen }), [definition, forceActions, visitedLessons, introSeen, graduationSeen]);
  return {
    definition, setDefinition, patchDefinition,
    forceActions, setForceActions, addForceAction, patchForceAction, removeForceAction,
    visitedLessons, setVisitedLessons, onVisitLesson,
    introSeen, setIntroSeen, graduationSeen, setGraduationSeen, program,
  };
}

export function useBlockOps() {
  const [blockOps, setBlockOps] = useState<BlockOpsEntry[]>([]);
  // Every block-ops field write goes through this: it lazily creates the entry
  // for a node on its first edit rather than requiring a separate "start
  // operating this block" step.
  const updateBlockOps = useCallback((nodeId: string, patch: Partial<Omit<BlockOpsEntry, "id" | "linkedNodeId" | "createdAt">>) => {
    setBlockOps((list) => {
      const now = new Date().toISOString();
      const existing = list.find((b) => b.linkedNodeId === nodeId);
      if (existing) return list.map((b) => (b.id === existing.id ? { ...b, ...patch, updatedAt: now } : b));
      const created: BlockOpsEntry = {
        id: rid("bops"), linkedNodeId: nodeId,
        checklist: [], kpis: [], approvalStatus: "not_required", integrationStatus: "planned",
        createdAt: now, updatedAt: now, ...patch,
      };
      return [...list, created];
    });
  }, []);
  return { blockOps, setBlockOps, updateBlockOps };
}

export const DEFAULT_RAVING_FANS: RavingFansInputs = { retentionRate: 0, referralRate: 0 };

export function useClientValue() {
  const [profitDrivers, setProfitDrivers] = useState<ProfitDriverInputs>(DEFAULT_PROFIT_DRIVER_INPUTS);
  const patchProfitDrivers = useCallback((patch: Partial<ProfitDriverInputs>) => setProfitDrivers((d) => ({ ...d, ...patch })), []);
  const [clientPromises, setClientPromises] = useState<ClientPromise[]>([]);
  const addClientPromise = useCallback((promiseText: string) => {
    if (!promiseText.trim()) return;
    setClientPromises((ps) => [...ps, { id: rid("pr"), promise: promiseText.trim(), delivered: false, createdAt: new Date().toISOString() }]);
  }, []);
  const toggleClientPromise = useCallback((id: string) => setClientPromises((ps) => ps.map((p) => (p.id === id ? { ...p, delivered: !p.delivered } : p))), []);
  const removeClientPromise = useCallback((id: string) => setClientPromises((ps) => ps.filter((p) => p.id !== id)), []);
  const [ravingFansInputs, setRavingFansInputs] = useState<RavingFansInputs>(DEFAULT_RAVING_FANS);
  const patchRavingFans = useCallback((patch: Partial<RavingFansInputs>) => setRavingFansInputs((r) => ({ ...r, ...patch })), []);
  return {
    profitDrivers, setProfitDrivers, patchProfitDrivers,
    clientPromises, setClientPromises, addClientPromise, toggleClientPromise, removeClientPromise,
    ravingFansInputs, setRavingFansInputs, patchRavingFans,
  };
}
