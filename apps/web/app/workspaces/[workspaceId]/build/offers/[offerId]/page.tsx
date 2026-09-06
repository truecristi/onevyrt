import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listOffers } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { OfferEditForm } from "./offer-edit-form";
import { OfferArraysForm } from "./offer-arrays-form";
import { UnitEconomicsCalculator } from "./unit-economics-calculator";
import { formatPrice } from "../../format";

/**
 * Phase 9 Build slice: a single offer. There's no single-offer getter in
 * the domain layer (only listOffers), so this finds it in the caller's
 * own scoped list - the same "list then find, notFound() otherwise"
 * pattern the Learn program/lesson pages use, and which is also what
 * keeps a guessed offer id from another workspace from resolving here.
 */
export default async function OfferDetailPage({
  params,
}: {
  params: { workspaceId: string; offerId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const offers = await listOffers(db, { workspaceId: params.workspaceId, actorUserId: user.id });
  const offer = offers.find((candidate) => candidate.id === params.offerId);
  if (!offer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/build`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Build
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{offer.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {formatPrice(offer.priceCents, offer.currency)} · {offer.status}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Offer details
        </h2>
        <OfferEditForm
          workspaceId={params.workspaceId}
          offerId={offer.id}
          offer={{
            name: offer.name,
            description: offer.description,
            priceCents: offer.priceCents,
            currency: offer.currency,
            status: offer.status,
            problemStatement: offer.problemStatement,
            desiredOutcome: offer.desiredOutcome,
            positioningStatement: offer.positioningStatement,
            valueProposition: offer.valueProposition,
            guarantee: offer.guarantee,
            riskReversal: offer.riskReversal,
          }}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Components, bonuses &amp; objections
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            The offer&rsquo;s building blocks - what the buyer gets, the extras that raise perceived
            value, and the objections you answer. Add, edit and remove them here.
          </p>
        </div>
        <OfferArraysForm
          workspaceId={params.workspaceId}
          offerId={offer.id}
          initial={{
            offerComponents: offer.offerComponents,
            bonuses: offer.bonuses,
            objections: offer.objections,
          }}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Unit economics
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            A deterministic, auditable calculation over this offer&rsquo;s price. Every result
            carries its formula key, version and origin.
          </p>
        </div>
        <UnitEconomicsCalculator
          workspaceId={params.workspaceId}
          offerId={offer.id}
          hasPrice={offer.priceCents !== null}
        />
      </section>
    </div>
  );
}
