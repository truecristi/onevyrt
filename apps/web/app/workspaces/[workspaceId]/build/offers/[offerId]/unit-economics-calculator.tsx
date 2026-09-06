"use client";

import { useState } from "react";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface FormulaResult {
  formulaKey: string;
  formulaVersion: number;
  value: number;
  unit: string;
  valueOrigin: string;
  computedAt: string;
}

interface UnitEconomicsReport {
  offerId: string;
  price: number;
  costPerUnit: number;
  grossProfit: FormulaResult;
  contributionMargin: FormulaResult;
  customerAcquisitionCost: FormulaResult;
  customerLifetimeValue: FormulaResult;
  ltvToCacRatio: FormulaResult;
}

interface CalcBody {
  report?: UnitEconomicsReport;
  error?: string;
}

// Each field maps to a calculateUnitEconomicsRequestSchema key, carrying
// the same nonnegative/positive constraint the server enforces so the
// input's own min attribute matches what the API will accept.
const FIELDS: {
  key: keyof CalcInputs;
  label: string;
  min: number;
  positive: boolean;
}[] = [
  { key: "costPerUnit", label: "Cost per unit ($)", min: 0, positive: false },
  { key: "acquisitionSpend", label: "Acquisition spend ($)", min: 0, positive: false },
  { key: "customersAcquired", label: "Customers acquired", min: 1, positive: true },
  { key: "averageOrderValue", label: "Average order value ($)", min: 0, positive: false },
  { key: "purchaseFrequencyPerYear", label: "Purchases / year", min: 0, positive: false },
  { key: "customerLifespanYears", label: "Customer lifespan (years)", min: 1, positive: true },
];

interface CalcInputs {
  costPerUnit: string;
  acquisitionSpend: string;
  customersAcquired: string;
  averageOrderValue: string;
  purchaseFrequencyPerYear: string;
  customerLifespanYears: string;
}

const EMPTY: CalcInputs = {
  costPerUnit: "",
  acquisitionSpend: "",
  customersAcquired: "",
  averageOrderValue: "",
  purchaseFrequencyPerYear: "",
  customerLifespanYears: "",
};

const METRIC_LABELS: { key: keyof UnitEconomicsReport; label: string }[] = [
  { key: "grossProfit", label: "Gross profit" },
  { key: "contributionMargin", label: "Contribution margin" },
  { key: "customerAcquisitionCost", label: "Customer acquisition cost (CAC)" },
  { key: "customerLifetimeValue", label: "Customer lifetime value (LTV)" },
  { key: "ltvToCacRatio", label: "LTV : CAC ratio" },
];

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Phase 9 Build slice: the deterministic unit-economics calculator. Each
 * returned metric is a full FormulaResult provenance envelope
 * (formula key + version, unit, valueOrigin, computedAt) - the spec's
 * "every important number must retain its source, unit and formula
 * version" principle (§40), surfaced literally rather than shown as a
 * bare number. Nothing here is persisted; the report is re-derived on
 * each submit from the offer's current price plus these inputs.
 */
export function UnitEconomicsCalculator({
  workspaceId,
  offerId,
  hasPrice,
}: {
  workspaceId: string;
  offerId: string;
  hasPrice: boolean;
}) {
  const [inputs, setInputs] = useState<CalcInputs>(EMPTY);
  const [report, setReport] = useState<UnitEconomicsReport | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!hasPrice) {
    return (
      <p className="text-sm text-gray-600">
        Set a price on this offer above before modelling its unit economics - the calculation needs
        one.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body: Record<string, number> = {};
    for (const { key } of FIELDS) {
      const raw = inputs[key].trim();
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) {
        setError("Enter a number for every field.");
        return;
      }
      body[key] = value;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CalcBody>(
        `/api/workspaces/${workspaceId}/offers/${offerId}/unit-economics`,
        body,
      );
      if (!outcome.ok || !outcome.data.report) {
        setError(outcome.data.error ?? "Could not calculate. Please check your inputs.");
        return;
      }
      setReport(outcome.data.report);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, min }) => (
            <Input
              key={key}
              label={label}
              type="number"
              min={String(min)}
              step="0.01"
              value={inputs[key]}
              onChange={(event) =>
                setInputs((current) => ({ ...current, [key]: event.target.value }))
              }
              disabled={submitting}
              required
            />
          ))}
        </div>
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Calculating..." : "Calculate unit economics"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </form>

      {report && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-500 text-left text-gray-500">
                <th className="py-2 pr-4 font-semibold">Metric</th>
                <th className="py-2 pr-4 font-semibold">Value</th>
                <th className="py-2 font-semibold">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_LABELS.map(({ key, label }) => {
                const result = report[key] as FormulaResult;
                return (
                  <tr key={key} className="border-b border-gray-200 align-top">
                    <td className="py-2 pr-4 font-medium text-gray-900">{label}</td>
                    <td className="py-2 pr-4 text-gray-900">
                      {formatValue(result.value)}{" "}
                      <span className="text-gray-500">{result.unit}</span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {result.formulaKey} v{result.formulaVersion} · {result.valueOrigin}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
