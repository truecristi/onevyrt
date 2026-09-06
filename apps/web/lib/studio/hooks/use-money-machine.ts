"use client";
/**
 * Money Machine config, targets and ledger — the Freedom-Plan cluster from
 * funnel-studio.tsx, extracted as a hook. Same value/setter/action names as the
 * inline version, so serialization and JSX are unchanged.
 */
import { useCallback, useState } from "react";
import { DEFAULT_MONEY_MACHINE_CONFIG, type MoneyMachineConfig, type MoneyMachineTargets, type LedgerEntry, type LedgerBucket, type LedgerKind } from "@onevyrt/engine";

export function useMoneyMachine() {
  const [moneyMachineCfg, setMoneyMachineCfg] = useState<MoneyMachineConfig>(DEFAULT_MONEY_MACHINE_CONFIG);
  const patchMoneyMachine = useCallback((patch: Partial<MoneyMachineConfig>) => setMoneyMachineCfg((c) => ({ ...c, ...patch })), []);

  const [moneyMachineTargets, setMoneyMachineTargets] = useState<MoneyMachineTargets>({});
  const patchMoneyMachineTargets = useCallback((patch: Partial<MoneyMachineTargets>) => setMoneyMachineTargets((t) => ({ ...t, ...patch })), []);

  const [moneyMachineLedger, setMoneyMachineLedger] = useState<LedgerEntry[]>([]);
  const addLedgerEntry = useCallback((bucket: LedgerBucket, kind: LedgerKind, amount: number, note?: string) => {
    if (!(amount > 0)) return;
    setMoneyMachineLedger((ls) => [...ls, { id: `ldg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, bucket, kind, amount: Math.round(amount), createdAt: new Date().toISOString(), ...(note?.trim() ? { note: note.trim() } : {}) }]);
  }, []);
  const removeLedgerEntry = useCallback((id: string) => setMoneyMachineLedger((ls) => ls.filter((l) => l.id !== id)), []);

  return {
    moneyMachineCfg, setMoneyMachineCfg, patchMoneyMachine,
    moneyMachineTargets, setMoneyMachineTargets, patchMoneyMachineTargets,
    moneyMachineLedger, setMoneyMachineLedger, addLedgerEntry, removeLedgerEntry,
  };
}
