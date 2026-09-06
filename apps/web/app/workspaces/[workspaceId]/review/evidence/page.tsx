import Link from "next/link";
import { redirect } from "next/navigation";
import { listEvidence } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateEvidenceForm } from "./create-evidence-form";

/**
 * Phase 9 Review depth slice: evidence (README Review -> "evidence"). A
 * workspace-scoped collection of the evidence gathered - each with a title,
 * an optional description and source link, and a strength (weak / moderate
 * / strong). Built on the existing Phase 2/5 evidence domain layer - no
 * domain or API changes. Linking a piece of evidence to a specific
 * assumption / decision / experiment is a later slice.
 */

const STRENGTH_STYLES: Record<string, string> = {
  weak: "bg-gray-100 text-gray-900",
  moderate: "bg-blue-600 text-white",
  strong: "bg-green-700 text-white",
};

export default async function EvidencePage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const evidence = await listEvidence(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 text-sm text-gray-600">
          The evidence you&rsquo;ve gathered - what it shows, where it came from, and how strong it
          is. Strong evidence should carry more weight than weak when you decide.
        </p>
      </div>

      <CreateEvidenceForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All evidence
        </h2>
        {evidence.length === 0 ? (
          <EmptyState
            title="No evidence yet"
            description="Record your first piece of evidence above to start building the case."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-gray-500 p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                      STRENGTH_STYLES[item.strength] ?? STRENGTH_STYLES.moderate
                    }`}
                  >
                    {item.strength}
                  </span>
                  <span className="font-medium text-gray-900">{item.title}</span>
                </div>
                {item.description.trim() !== "" && (
                  <p className="whitespace-pre-wrap text-sm text-gray-600">{item.description}</p>
                )}
                {item.sourceUrl.trim() !== "" && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {item.sourceUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
