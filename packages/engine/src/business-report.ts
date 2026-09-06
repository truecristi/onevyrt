/**
 * Business Report: the M6 "read across everything" layer. Every section here
 * is already computed by an existing pure function (program, money-machine,
 * profit-drivers, raving-fans) — this module does no new math, it just
 * stitches those results into one object so the UI/exports have a single,
 * stable shape to render instead of assembling five calls inline.
 */
import { buildTransformationBrief, summarizeForceActions, type BusinessDefinition, type ForceActionItem, type TransformationBrief, type ForceActionSummary } from "./program.ts";
import { projectMoneyMachine, type MoneyMachineConfig, type MoneyMachineProjection } from "./money-machine.ts";
import { simulateProfitDrivers, type ProfitDriverInputs, type ProfitDriverResult, type ProfitDriverBaseline } from "./profit-drivers.ts";
import { computeRavingFansScore, type ClientPromise, type RavingFansInputs, type RavingFansScore } from "./raving-fans.ts";
import { computeReadiness, type ReadinessScore } from "./readiness.ts";
import { summarizeLedger, type LedgerEntry, type MoneyMachineTargets, type LedgerSummary } from "./money-machine-ledger.ts";
import type { GoalNode } from "./goals.ts";
import type { AssumptionEntry } from "./assumptions.ts";
import type { ExperimentEntry } from "./experiments.ts";

export interface BusinessReport {
  generatedAt: string;
  brief: TransformationBrief;
  moneyMachine: MoneyMachineProjection;
  profitDrivers: ProfitDriverResult;
  ravingFans: RavingFansScore;
  forceActionSummary: ForceActionSummary;
  readiness: ReadinessScore;
  moneyMachineLedger: LedgerSummary;
}

export function buildBusinessReport(
  definition: BusinessDefinition,
  forceActions: ForceActionItem[],
  monthlyProfit: number,
  moneyMachineCfg: MoneyMachineConfig,
  driverBaseline: ProfitDriverBaseline,
  profitDriverInputs: ProfitDriverInputs,
  clientPromises: ClientPromise[],
  ravingFansInputs: RavingFansInputs,
  generatedAt = new Date().toISOString(),
  goals: readonly GoalNode[] = [],
  assumptions: readonly AssumptionEntry[] = [],
  experiments: readonly ExperimentEntry[] = [],
  moneyMachineLedger: readonly LedgerEntry[] = [],
  moneyMachineTargets: MoneyMachineTargets = {},
): BusinessReport {
  return {
    generatedAt,
    brief: buildTransformationBrief(definition, forceActions, generatedAt),
    moneyMachine: projectMoneyMachine(monthlyProfit, moneyMachineCfg),
    profitDrivers: simulateProfitDrivers(driverBaseline, profitDriverInputs),
    ravingFans: computeRavingFansScore(clientPromises, ravingFansInputs),
    forceActionSummary: summarizeForceActions(forceActions),
    readiness: computeReadiness(goals, assumptions, experiments),
    moneyMachineLedger: summarizeLedger(moneyMachineLedger, moneyMachineTargets),
  };
}
