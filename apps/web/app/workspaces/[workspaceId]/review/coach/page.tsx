import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CoachAskForm } from "./coach-ask-form";

/**
 * Phase 9 Review depth slice: the AI coaching interface. Ask a question and
 * the coach answers it, grounded in this workspace's business profile,
 * goals, assumptions and decisions (assembled server-side in the
 * /coaching/ask route). Coaching is stateless - the answer is shown, not
 * stored - so this page is just the ask box; the route does the work.
 * Built on the existing Phase 6 coaching domain and API layer.
 */
export default async function CoachPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ask a question and get an answer grounded in this workspace&rsquo;s profile, goals,
          assumptions and decisions. Set an AI provider key for real answers; without one
          you&rsquo;ll get a labeled placeholder so the flow still works.
        </p>
      </div>

      <CoachAskForm workspaceId={params.workspaceId} />
    </div>
  );
}
