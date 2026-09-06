"use client";
/**
 * Objections and hooks (the persuasion library) + mindfulness notes, extracted
 * from funnel-studio.tsx. AI generation of hooks stays in the component (it
 * needs the AI connection); these are just the list state + add/remove.
 */
import { useCallback, useState } from "react";
import type { ObjectionEntry, HookEntry, MindfulnessEntry, MindfulnessKind } from "@onevyrt/engine";

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function usePersuasion() {
  const [objections, setObjections] = useState<ObjectionEntry[]>([]);
  const addObjection = useCallback((objection: string, response: string) => {
    if (!objection.trim() || !response.trim()) return;
    setObjections((os) => [...os, { id: rid("obj"), objection: objection.trim(), response: response.trim(), createdAt: new Date().toISOString() }]);
  }, []);
  const removeObjection = useCallback((id: string) => setObjections((os) => os.filter((o) => o.id !== id)), []);

  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const addHook = useCallback((hook: string, angle?: string) => {
    if (!hook.trim()) return;
    setHooks((hs) => [...hs, { id: rid("hook"), hook: hook.trim(), createdAt: new Date().toISOString(), ...(angle?.trim() ? { angle: angle.trim() } : {}) }]);
  }, []);
  const removeHook = useCallback((id: string) => setHooks((hs) => hs.filter((h) => h.id !== id)), []);

  const [mindfulness, setMindfulness] = useState<MindfulnessEntry[]>([]);
  const addMindfulness = useCallback((kind: MindfulnessKind, text: string) => {
    if (!text.trim()) return;
    setMindfulness((ms) => [...ms, { id: rid("mf"), kind, text: text.trim(), createdAt: new Date().toISOString() }]);
  }, []);
  const removeMindfulness = useCallback((id: string) => setMindfulness((ms) => ms.filter((m) => m.id !== id)), []);

  return {
    objections, setObjections, addObjection, removeObjection,
    hooks, setHooks, addHook, removeHook,
    mindfulness, setMindfulness, addMindfulness, removeMindfulness,
  };
}
