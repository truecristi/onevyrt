import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinancialDashboard } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

/**
 * Phase 9 Review depth slice: financial results (README Review ->
 * "financial results"). A read-only render of the Phase 4 financial
 * dashboard aggregation (PRD-NUMBERS-005) - summary counts plus the active
 * offers and business metrics behind them. It invents no numbers: every
 * figure comes straight from getFinancialDashboard, which itself only
 * aggregates each already-scoped list use case. Assumptions, funnel stages
 * and scenarios appear as headline counts here; their detailed views are
 * later slices.
 */

function formatMoney(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

function formatNumber(value: number | null): string {
  return value === null ? "-" : new Intl.NumberFormat("en-US").format(value);
}

const cellClass = "px-3 py-2 text-sm text-gray-900";
const headClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gray-300 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default async function ReviewFinancialsPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const dashboard = await getFinancialDashboard(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const { summary } = dashboard;
  const activeOffers = dashboard.offers.filter((offer) => offer.status === "active");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Financial results</h1>
        <p className="mt-1 text-sm text-gray-600">
          A read-only snapshot aggregated from your offers, metrics, assumptions, funnel stages and
          scenarios. Nothing here is estimated - every figure is derived directly from those
          records.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile
          label="Active offers"
          value={String(summary.activeOfferCount)}
          hint={`${summary.offerCount} total`}
        />
        <Tile
          label="Active offer value"
          value={formatMoney(summary.totalActiveOfferValueCents, "usd")}
          hint="Sum of active offer prices"
        />
        <Tile
          label="Assumptions validated"
          value={`${summary.validatedAssumptionCount}/${summary.assumptionCount}`}
        />
        <Tile label="Business metrics" value={String(summary.businessMetricCount)} />
        <Tile label="Funnel stages" value={String(summary.funnelStageCount)} />
        <Tile label="Scenarios" value={String(summary.scenarioCount)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Active offers
        </h2>
        {activeOffers.length === 0 ? (
          <p className="text-sm text-gray-500">
            No active offers yet. An offer counts here once its status is set to Active.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className={headClass}>Offer</th>
                  <th className={headClass}>Price</th>
                </tr>
              </thead>
              <tbody>
                {activeOffers.map((offer) => (
                  <tr key={offer.id} className="border-b border-gray-200">
                    <td className={cellClass}>{offer.name}</td>
                    <td className={cellClass}>
                      {offer.priceCents === null
                        ? "-"
                        : formatMoney(offer.priceCents, offer.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Business metrics
        </h2>
        {dashboard.businessMetrics.length === 0 ? (
          <p className="text-sm text-gray-500">No business metrics yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className={headClass}>Metric</th>
                  <th className={headClass}>Baseline</th>
                  <th className={headClass}>Current</th>
                  <th className={headClass}>Target</th>
                  <th className={headClass}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.businessMetrics.map((metric) => (
                  <tr key={metric.id} className="border-b border-gray-200">
                    <td className={cellClass}>{metric.name}</td>
                    <td className={cellClass}>{formatNumber(metric.baselineValue)}</td>
                    <td className={cellClass}>{formatNumber(metric.currentValue)}</td>
                    <td className={cellClass}>{formatNumber(metric.targetValue)}</td>
                    <td className={cellClass}>{metric.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
