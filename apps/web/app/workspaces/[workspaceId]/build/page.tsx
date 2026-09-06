import Link from "next/link";
import { redirect } from "next/navigation";
import { listOffers } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateOfferForm } from "./create-offer-form";
import { formatPrice } from "./format";

/**
 * Phase 9 Build slice: the first real Build destination page. Build
 * covers "offers, funnels, pages, scripts, plans and other business
 * artifacts" (README primary navigation); this slice does offers - the
 * headline of that list and the one Build domain that also carries a real
 * deterministic calculation (unit economics, on each offer's detail
 * page). Funnels, customer profiles, scenarios and artifact versioning
 * each have a tested domain layer already and are deferred to their own
 * later Build slices rather than half-built here.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-700 text-white",
  draft: "bg-gray-100 text-gray-900",
  archived: "bg-gray-500 text-white",
};

export default async function BuildPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const offers = await listOffers(db, { workspaceId: params.workspaceId, actorUserId: user.id });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Build</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your offers - what you sell, its positioning, and its unit economics. Funnels, customer
          profiles and scenarios are coming to Build in later slices.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Offers</h2>

        {offers.length === 0 ? (
          <EmptyState
            title="No offers yet"
            description="Create your first offer to start shaping what you sell and modelling its economics."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => (
              <li key={offer.id}>
                <Link
                  href={`/workspaces/${params.workspaceId}/build/offers/${offer.id}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3 hover:border-blue-600"
                >
                  <div>
                    <p className="font-medium text-gray-900">{offer.name}</p>
                    <p className="text-sm text-gray-600">
                      {formatPrice(offer.priceCents, offer.currency)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                      STATUS_STYLES[offer.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {offer.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <CreateOfferForm workspaceId={params.workspaceId} />
      </section>
    </div>
  );
}
