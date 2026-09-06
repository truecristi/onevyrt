import { and, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import type { FormulaResult, UnitEconomicsReport } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { getFormulaImplementation } from "./formula-registry";
import { OfferNotFoundError, OfferPriceRequiredError } from "./errors";

/**
 * PRD-NUMBERS-004 vertical slice: unit economics (README "Numbers and
 * modeling" -> "Unit economics", fourth slice of Phase 4). A composite
 * report combining several formula-registry.ts calculations against a
 * single Phase 2 offer's price - the same "tie new Phase 4 machinery to
 * a real existing business record" pattern lesson applications used for
 * curriculum.
 *
 * This calls formula-registry.ts's getFormulaImplementation directly
 * rather than going through computeFormula (formula-use-cases.ts):
 * computeFormula requires a platform admin to have created and
 * *published* a formula_definitions row first, which is the right gate
 * for the general "run any published formula by key" API but would make
 * this specific, always-the-same composite report depend on unrelated
 * admin setup work. Unit economics always uses these five formulas at a
 * fixed version, so it talks to the registry - the actual code - not
 * the publishable metadata layer above it.
 */

const FORMULA_VERSION = 1;

function runFormula(key: string, unit: string, inputs: Record<string, number>): FormulaResult {
  const impl = getFormulaImplementation(key, FORMULA_VERSION);
  if (!impl) {
    throw new Error(
      `Unit economics requires a "${key}" v${FORMULA_VERSION} formula implementation`,
    );
  }
  return {
    formulaKey: key,
    formulaVersion: FORMULA_VERSION,
    value: impl.compute(inputs),
    unit,
    inputs,
    valueOrigin: "calculated",
    computedAt: new Date().toISOString(),
  };
}

export interface CalculateUnitEconomicsInput {
  actorUserId: string;
  workspaceId: string;
  offerId: string;
  costPerUnit: number;
  acquisitionSpend: number;
  customersAcquired: number;
  averageOrderValue: number;
  purchaseFrequencyPerYear: number;
  customerLifespanYears: number;
}

export async function calculateUnitEconomics(
  db: Database,
  input: CalculateUnitEconomicsInput,
): Promise<UnitEconomicsReport> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const offer = await db.query.offers.findFirst({
    where: and(
      eq(schema.offers.id, input.offerId),
      eq(schema.offers.workspaceId, input.workspaceId),
    ),
  });
  if (!offer) throw new OfferNotFoundError(input.offerId);
  if (offer.priceCents === null) throw new OfferPriceRequiredError(input.offerId);

  const price = offer.priceCents / 100;

  const grossProfit = runFormula("gross_profit", offer.currency, {
    revenue: price,
    cost: input.costPerUnit,
  });
  const contributionMargin = runFormula("contribution_margin", "ratio", {
    price,
    variableCostPerUnit: input.costPerUnit,
  });
  const customerAcquisitionCost = runFormula("customer_acquisition_cost", offer.currency, {
    acquisitionSpend: input.acquisitionSpend,
    customersAcquired: input.customersAcquired,
  });
  const customerLifetimeValue = runFormula("customer_lifetime_value", offer.currency, {
    averageOrderValue: input.averageOrderValue,
    purchaseFrequencyPerYear: input.purchaseFrequencyPerYear,
    customerLifespanYears: input.customerLifespanYears,
  });
  const ltvToCacRatio = runFormula("ltv_to_cac_ratio", "ratio", {
    customerLifetimeValue: customerLifetimeValue.value,
    customerAcquisitionCost: customerAcquisitionCost.value,
  });

  return {
    offerId: input.offerId,
    price,
    costPerUnit: input.costPerUnit,
    grossProfit,
    contributionMargin,
    customerAcquisitionCost,
    customerLifetimeValue,
    ltvToCacRatio,
  };
}
