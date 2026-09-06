"use client";
/**
 * Risk register state + actions, lifted out of funnel-studio.tsx so that giant
 * component owns a little less. Behaviour is unchanged: the hook returns the
 * same value + setter + action names the component used inline, so callers
 * destructure with identical names and nothing downstream changes.
 */
import { useCallback, useState } from "react";
import type { RiskRegisterEntry, RiskRegisterStatus } from "@onevyrt/engine";

export function useRiskRegister() {
  const [riskRegister, setRiskRegister] = useState<RiskRegisterEntry[]>([]);

  const addRiskEntry = useCallback((label: string, description: string, severity: RiskRegisterEntry["severity"], linkedNodeId?: string) => {
    setRiskRegister((rs) => [...rs, {
      id: `risk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(), label, description, severity, status: "open",
      ...(linkedNodeId ? { linkedNodeId } : {}),
    }]);
  }, []);

  const cycleRiskStatus = useCallback((id: string) => {
    const next: Record<RiskRegisterStatus, RiskRegisterStatus> = { open: "mitigated", mitigated: "accepted", accepted: "open" };
    setRiskRegister((rs) => rs.map((r) => (r.id === id
      ? { ...r, status: next[r.status], resolvedAt: next[r.status] === "open" ? undefined : new Date().toISOString() }
      : r)));
  }, []);

  const removeRiskEntry = useCallback((id: string) => setRiskRegister((rs) => rs.filter((r) => r.id !== id)), []);

  return { riskRegister, setRiskRegister, addRiskEntry, cycleRiskStatus, removeRiskEntry };
}
