import { redirect } from "next/navigation";
import Link from "next/link";
import { listWorkspacesForUser } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

/**
 * Phase 9 first UI slice: the first real authenticated page. Server
 * Component - resolves the session and queries workspaces directly
 * through the same domain functions the API routes call, rather than
 * fetching its own API over HTTP (no reason to round-trip through
 * Next.js's own server for data already available in the same process).
 *
 * Deliberately not the five-destination Today/Learn/Build/Execute/Review
 * shell yet - that's real navigation this document is honest about not
 * having built. This page's job is narrower: prove register -> login ->
 * an authenticated, workspace-aware page -> logout works end to end with
 * a real UI, the same "prove the wiring works" scope the Phase 0/1
 * landing page had for the monorepo itself.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const workspaces = await listWorkspacesForUser(db, user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">ONEVYRT</h1>
        <LogoutButton />
      </div>

      <p className="text-gray-600">
        Signed in as <span className="font-medium text-gray-900">{user.email}</span>.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Your workspaces
        </h2>
        <ul className="flex flex-col gap-2">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link
                href={`/workspaces/${workspace.id}/today`}
                className="flex items-center justify-between rounded-md border border-gray-500 px-4 py-3 hover:border-blue-600"
              >
                <span className="font-medium text-gray-900">{workspace.name}</span>
                <span className="text-xs uppercase text-gray-500">{workspace.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-gray-500">
        Open a workspace to see its Today dashboard - the full five-destination product experience
        (Today, Learn, Build, Execute, Review) has a real nav now, but only Today has a real page
        behind it so far; see the repository README and ADR-0022 for what remains.
      </p>
    </main>
  );
}
