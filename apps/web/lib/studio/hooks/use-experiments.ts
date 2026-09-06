"use client";
/**
 * Assumptions, experiments and goals — the "what are we betting on and testing"
 * cluster from funnel-studio.tsx. Extracted verbatim into a hook so the studio
 * component holds less state directly; callers destructure the same names, so
 * downstream JSX and serialization (applyDoc/toDoc) are unchanged.
 */
import { useCallback, useState } from "react";
import type {
  AssumptionEntry, AssumptionConfidence,
  ExperimentEntry,
  GoalNode, GoalLevel,
} from "@onevyrt/engine";

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function useExperiments() {
  const [assumptions, setAssumptions] = useState<AssumptionEntry[]>([]);
  const addAssumption = useCallback((text: string, confidence: AssumptionConfidence, category?: string, linkedNodeId?: string) => {
    if (!text.trim()) return;
    setAssumptions((as) => [...as, { id: rid("assum"), text: text.trim(), confidence, status: "untested", createdAt: new Date().toISOString(), ...(category?.trim() ? { category: category.trim() } : {}), ...(linkedNodeId ? { linkedNodeId } : {}) }]);
  }, []);
  const updateAssumption = useCallback((id: string, patch: Partial<Omit<AssumptionEntry, "id" | "createdAt">>) => {
    setAssumptions((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const removeAssumption = useCallback((id: string) => setAssumptions((as) => as.filter((a) => a.id !== id)), []);

  const [experiments, setExperiments] = useState<ExperimentEntry[]>([]);
  const addExperiment = useCallback((hypothesis: string, linkedAssumptionId?: string, linkedNodeId?: string) => {
    if (!hypothesis.trim()) return;
    setExperiments((es) => [...es, { id: rid("exp"), hypothesis: hypothesis.trim(), status: "planned", createdAt: new Date().toISOString(), ...(linkedAssumptionId ? { linkedAssumptionId } : {}), ...(linkedNodeId ? { linkedNodeId } : {}) }]);
  }, []);
  const updateExperiment = useCallback((id: string, patch: Partial<Omit<ExperimentEntry, "id" | "createdAt">>) => {
    setExperiments((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);
  const removeExperiment = useCallback((id: string) => setExperiments((es) => es.filter((e) => e.id !== id)), []);

  const [goals, setGoals] = useState<GoalNode[]>([]);
  const addGoal = useCallback((level: GoalLevel, title: string, parentId?: string, linkedNodeId?: string) => {
    if (!title.trim()) return;
    setGoals((gs) => [...gs, { id: rid("goal"), level, title: title.trim(), status: "not_started", createdAt: new Date().toISOString(), ...(parentId ? { parentId } : {}), ...(linkedNodeId ? { linkedNodeId } : {}) }]);
  }, []);
  const updateGoal = useCallback((id: string, patch: Partial<Omit<GoalNode, "id" | "createdAt">>) => {
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);
  const removeGoal = useCallback((id: string) => {
    // Removing a goal that has children would orphan them silently — instead
    // pull each child up to the removed goal's own parent, so the chain
    // above them stays connected rather than snapping.
    setGoals((gs) => {
      const target = gs.find((g) => g.id === id);
      const rehomed = gs.map((g) => (g.parentId === id ? { ...g, parentId: target?.parentId } : g));
      return rehomed.filter((g) => g.id !== id);
    });
  }, []);

  return {
    assumptions, setAssumptions, addAssumption, updateAssumption, removeAssumption,
    experiments, setExperiments, addExperiment, updateExperiment, removeExperiment,
    goals, setGoals, addGoal, updateGoal, removeGoal,
  };
}
