import Link from "next/link";
import { redirect } from "next/navigation";
import { listWeeklyReviews } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateWeeklyReviewForm } from "./create-weekly-review-form";
import { ScorecardSnapshot } from "./scorecard-snapshot";

/**
 * Phase 9 Review slice: the first real Review destination page. Review
 * covers "scorecards, financial results, evidence, reflections and
 * insights" (README primary navigation); this slice does weekly reviews -
 * the reflection-and-cadence surface, and the one Review area with a
 * clean create action plus a history to read back. Each saved review
 * freezes a full scorecard snapshot, so this doubles as the point-in-time
 * "what changed" record the Review area is meant to answer, showing the
 * deeper scorecard fields the Today page omits.
 *
 * Built entirely on the existing Phase 7 weekly-review domain layer - no
 * domain or API changes. Experiment analysis, constraint diagnosis,
 * progress summaries, evidence and decision history each have a tested
 * domain layer already and are deferred to their own later Review slices.
 */
export default async function ReviewPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const reviews = await listWeeklyReviews(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your weekly reviews - wins, challenges, and next-week focus, each with a snapshot of your
          scorecard that week. Experiment analysis, constraint diagnosis and progress trends are
          coming to Review in later slices.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href={`/workspaces/${params.workspaceId}/review/financials`}
            className="text-blue-600 hover:underline"
          >
            View financial results &rarr;
          </Link>
        </p>
      </div>

      <CreateWeeklyReviewForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
        {reviews.length === 0 ? (
          <EmptyState
            title="No weekly reviews yet"
            description="Save your first weekly review above to start building a history of what changed."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
              >
                <p className="text-sm font-semibold text-gray-900">
                  Week of {review.weekStartDate.toISOString().slice(0, 10)}
                </p>
                <dl className="flex flex-col gap-2 text-sm">
                  {review.wins.trim() !== "" && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Wins
                      </dt>
                      <dd className="whitespace-pre-wrap text-gray-900">{review.wins}</dd>
                    </div>
                  )}
                  {review.challenges.trim() !== "" && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Challenges
                      </dt>
                      <dd className="whitespace-pre-wrap text-gray-900">{review.challenges}</dd>
                    </div>
                  )}
                  {review.focusNextWeek.trim() !== "" && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Focus next week
                      </dt>
                      <dd className="whitespace-pre-wrap text-gray-900">{review.focusNextWeek}</dd>
                    </div>
                  )}
                </dl>
                <ScorecardSnapshot snapshot={review.scorecardSnapshot} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">More</h2>
        <p className="text-sm">
          <Link
            href={`/workspaces/${params.workspaceId}/review/decisions`}
            className="text-blue-600 hover:underline"
          >
            Decision log &rarr;
          </Link>
        </p>
      </section>
    </div>
  );
}
