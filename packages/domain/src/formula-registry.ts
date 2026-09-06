/**
 * PRD-NUMBERS-001: the actual computations behind the versioned formula
 * library (schema.ts's formulaDefinitions doc comment explains why this
 * is plain code, not a stored/evaluated expression string). Each
 * (key, version) pair implemented here is what formula-use-cases.ts's
 * computeFormula dispatches to once it has validated the caller's inputs
 * against the matching formulaDefinitions row.
 *
 * This is the seed set covering the first handful of calculations named
 * in the spec's business-modeling section (price/revenue/cost/gross
 * profit/contribution margin/break-even/CAC/LTV/conversion rate) -
 * funnel mathematics and unit-economics-specific formulas are added by
 * later Phase 4 slices, following the same registerFormula call.
 */

export interface FormulaImplementation {
  key: string;
  version: number;
  compute: (inputs: Record<string, number>) => number;
}

const registry = new Map<string, FormulaImplementation>();

function registryKey(key: string, version: number): string {
  return `${key}@${version}`;
}

/**
 * computeFormula (formula-use-cases.ts) already validates the caller's
 * inputs against the published definition's inputSchema before ever
 * reaching a compute() function, but each implementation still reads its
 * named inputs through this helper rather than a bare index - defense in
 * depth against a formula being called directly (e.g. from a future
 * internal caller that skips computeFormula), and it's what satisfies
 * strict noUncheckedIndexedAccess without scattering non-null
 * assertions through every formula body.
 */
function requireInput(inputs: Record<string, number>, name: string): number {
  const value = inputs[name];
  if (value === undefined) {
    throw new Error(`Missing required formula input "${name}"`);
  }
  return value;
}

function registerFormula(impl: FormulaImplementation): void {
  const rk = registryKey(impl.key, impl.version);
  if (registry.has(rk)) {
    throw new Error(`Formula implementation ${rk} is already registered`);
  }
  registry.set(rk, impl);
}

export function getFormulaImplementation(
  key: string,
  version: number,
): FormulaImplementation | undefined {
  return registry.get(registryKey(key, version));
}

registerFormula({
  key: "gross_profit",
  version: 1,
  compute: (inputs) => requireInput(inputs, "revenue") - requireInput(inputs, "cost"),
});

registerFormula({
  key: "contribution_margin",
  version: 1,
  compute: (inputs) => {
    const price = requireInput(inputs, "price");
    return (price - requireInput(inputs, "variableCostPerUnit")) / price;
  },
});

registerFormula({
  key: "break_even_point",
  version: 1,
  compute: (inputs) => {
    const price = requireInput(inputs, "price");
    const variableCostPerUnit = requireInput(inputs, "variableCostPerUnit");
    return requireInput(inputs, "fixedCosts") / (price - variableCostPerUnit);
  },
});

registerFormula({
  key: "customer_acquisition_cost",
  version: 1,
  compute: (inputs) =>
    requireInput(inputs, "acquisitionSpend") / requireInput(inputs, "customersAcquired"),
});

registerFormula({
  key: "customer_lifetime_value",
  version: 1,
  compute: (inputs) =>
    requireInput(inputs, "averageOrderValue") *
    requireInput(inputs, "purchaseFrequencyPerYear") *
    requireInput(inputs, "customerLifespanYears"),
});

registerFormula({
  key: "conversion_rate",
  version: 1,
  compute: (inputs) => requireInput(inputs, "conversions") / requireInput(inputs, "totalVisitors"),
});

/** Used by unit-economics-use-cases.ts's composite report - a common health check (>3 is typically considered healthy) that only makes sense once both halves exist. */
registerFormula({
  key: "ltv_to_cac_ratio",
  version: 1,
  compute: (inputs) =>
    requireInput(inputs, "customerLifetimeValue") / requireInput(inputs, "customerAcquisitionCost"),
});
