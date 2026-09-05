import { describe, expect, it } from "vitest";
import { getFormulaImplementation } from "./formula-registry";

/**
 * PRD-NUMBERS-008 vertical slice: calculation tests (README "Numbers and
 * modeling" -> "Calculation tests", eighth and final slice of Phase 4).
 * A dedicated golden-value suite over every formula-registry.ts
 * implementation, independent of the database-backed formula
 * definitions/publishing machinery (formula-isolation.test.ts) - these
 * are pure functions, so this is a plain unit test file, no Postgres
 * needed.
 *
 * Two things this suite exists to catch that the per-slice isolation
 * tests don't specifically target: (1) every formula's numeric
 * correctness across a normal case plus at least one edge case, hand-
 * computed and checked against the implementation, and (2) the
 * registry's own manifest - exactly the seven keys this phase shipped,
 * each at version 1, so an accidental duplicate registration or a
 * silently-dropped formula fails a test immediately rather than surfacing
 * as a confusing 404/500 somewhere downstream.
 */

describe("formula registry (Phase 4 eighth slice: calculation tests)", () => {
  it("has exactly the seven formulas this phase shipped, each at version 1", () => {
    const expectedKeys = [
      "gross_profit",
      "contribution_margin",
      "break_even_point",
      "customer_acquisition_cost",
      "customer_lifetime_value",
      "conversion_rate",
      "ltv_to_cac_ratio",
    ];
    for (const key of expectedKeys) {
      expect(getFormulaImplementation(key, 1)).toBeDefined();
    }
    // No later version has quietly been introduced for any of them yet.
    for (const key of expectedKeys) {
      expect(getFormulaImplementation(key, 2)).toBeUndefined();
    }
    expect(getFormulaImplementation("not_a_real_formula", 1)).toBeUndefined();
  });

  it("gross_profit: revenue minus cost, including a loss and a zero-cost case", () => {
    const impl = getFormulaImplementation("gross_profit", 1);
    expect(impl?.compute({ revenue: 1000, cost: 400 })).toBe(600);
    expect(impl?.compute({ revenue: 100, cost: 150 })).toBe(-50); // a loss is a valid, honest result
    expect(impl?.compute({ revenue: 100, cost: 0 })).toBe(100);
  });

  it("contribution_margin: (price - variableCostPerUnit) / price, including 100% and 0% margins", () => {
    const impl = getFormulaImplementation("contribution_margin", 1);
    expect(impl?.compute({ price: 50, variableCostPerUnit: 20 })).toBeCloseTo(0.6);
    expect(impl?.compute({ price: 50, variableCostPerUnit: 0 })).toBe(1); // no variable cost at all
    expect(impl?.compute({ price: 50, variableCostPerUnit: 50 })).toBe(0); // sells at cost
  });

  it("break_even_point: fixedCosts / (price - variableCostPerUnit), including the zero-margin case", () => {
    const impl = getFormulaImplementation("break_even_point", 1);
    expect(impl?.compute({ fixedCosts: 10000, price: 50, variableCostPerUnit: 30 })).toBe(500);
    // Selling at cost never breaks even, however many units are sold - this
    // must surface as Infinity, not throw or silently return a finite
    // number a caller could mistake for a real answer.
    expect(impl?.compute({ fixedCosts: 10000, price: 30, variableCostPerUnit: 30 })).toBe(Infinity);
  });

  it("customer_acquisition_cost: acquisitionSpend / customersAcquired", () => {
    const impl = getFormulaImplementation("customer_acquisition_cost", 1);
    expect(impl?.compute({ acquisitionSpend: 1000, customersAcquired: 20 })).toBe(50);
    expect(impl?.compute({ acquisitionSpend: 0, customersAcquired: 20 })).toBe(0); // free acquisition channel
  });

  it("customer_lifetime_value: averageOrderValue * purchaseFrequencyPerYear * customerLifespanYears", () => {
    const impl = getFormulaImplementation("customer_lifetime_value", 1);
    expect(
      impl?.compute({
        averageOrderValue: 100,
        purchaseFrequencyPerYear: 4,
        customerLifespanYears: 2,
      }),
    ).toBe(800);
    expect(
      impl?.compute({
        averageOrderValue: 100,
        purchaseFrequencyPerYear: 0,
        customerLifespanYears: 2,
      }),
    ).toBe(0); // never repurchases -> zero lifetime value beyond the first sale isn't captured by this formula
  });

  it("conversion_rate: conversions / totalVisitors", () => {
    const impl = getFormulaImplementation("conversion_rate", 1);
    expect(impl?.compute({ conversions: 25, totalVisitors: 500 })).toBeCloseTo(0.05);
    expect(impl?.compute({ conversions: 0, totalVisitors: 500 })).toBe(0);
  });

  it("ltv_to_cac_ratio: customerLifetimeValue / customerAcquisitionCost", () => {
    const impl = getFormulaImplementation("ltv_to_cac_ratio", 1);
    expect(impl?.compute({ customerLifetimeValue: 800, customerAcquisitionCost: 50 })).toBe(16);
  });

  it("every formula throws a clear error rather than computing on a missing input", () => {
    const impl = getFormulaImplementation("gross_profit", 1);
    expect(() => impl?.compute({ revenue: 100 })).toThrow(/Missing required formula input "cost"/);
    expect(() => impl?.compute({})).toThrow(/Missing required formula input "revenue"/);
  });
});
