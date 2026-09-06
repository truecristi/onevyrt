import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listCustomerProfiles } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CustomerProfileEditForm } from "./customer-profile-edit-form";

/**
 * Phase 9 Build slice (customer profiles): a single profile. Like the
 * offer detail page there's no single-profile getter in the domain layer
 * (only listCustomerProfiles), so this finds it in the caller's own scoped
 * list - the same "list then find, notFound() otherwise" pattern used
 * across the Build and Learn detail pages, which also keeps a guessed id
 * from another workspace from resolving here.
 */
export default async function CustomerProfileDetailPage({
  params,
}: {
  params: { workspaceId: string; customerProfileId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const profiles = await listCustomerProfiles(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const profile = profiles.find((candidate) => candidate.id === params.customerProfileId);
  if (!profile) {
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
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{profile.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Who you sell to - their pain, the outcome they want, and how you&rsquo;re positioned for
          them.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Profile details
        </h2>
        <CustomerProfileEditForm
          workspaceId={params.workspaceId}
          customerProfileId={profile.id}
          profile={{
            name: profile.name,
            description: profile.description,
            painPoints: profile.painPoints,
            desiredOutcome: profile.desiredOutcome,
            emotionalConsequence: profile.emotionalConsequence,
            uniqueMechanism: profile.uniqueMechanism,
            proof: profile.proof,
            callToAction: profile.callToAction,
            positioningStatement: profile.positioningStatement,
          }}
        />
      </section>
    </div>
  );
}
