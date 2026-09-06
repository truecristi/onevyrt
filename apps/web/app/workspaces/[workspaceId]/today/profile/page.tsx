import Link from "next/link";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { BusinessProfileForm } from "./business-profile-form";

/**
 * Phase 9 Today depth slice: business profile. The workspace's identity -
 * name, vision, mission, industry and stage - and the same business_profile
 * the AI coaching context is assembled from. One editable record per
 * workspace (upsert). Built on the existing Phase 2 business-core profile
 * domain and API layer.
 */
export default async function BusinessProfilePage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const profile = await getBusinessProfile(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/today`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Today
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Business profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Who this business is and where it&rsquo;s headed. This is the context the AI coach draws
          on, so keeping it current sharpens every suggestion.
        </p>
      </div>

      <BusinessProfileForm
        workspaceId={params.workspaceId}
        initial={{
          name: profile?.name ?? "",
          vision: profile?.vision ?? "",
          mission: profile?.mission ?? "",
          industry: profile?.industry ?? "",
          stage: profile?.stage ?? "idea",
        }}
      />
    </div>
  );
}
