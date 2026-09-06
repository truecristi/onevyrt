import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { listWorkspacesForUser } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

/**
 * Phase 9 second UI slice: the five-destination shell (Today, Learn,
 * Build, Execute, Review) the spec names as the actual product
 * navigation. Only "Today" has a real page behind it so far - Learn,
 * Build, Execute and Review are honest "not built yet" placeholders
 * (see their own page.tsx files) rather than 404s or, worse, silently
 * omitted links that would make the five-destination shape a lie.
 *
 * Membership is re-checked here via listWorkspacesForUser rather than
 * trusting the URL's workspaceId - a user who isn't a member of this
 * workspace gets redirected to their own dashboard rather than seeing
 * any indication the workspace exists (§4's tenancy boundary, applied
 * at the UI layer the same way every API route already applies it).
 */

const DESTINATIONS = [
  { slug: "today", label: "Today" },
  { slug: "learn", label: "Learn" },
  { slug: "build", label: "Build" },
  { slug: "execute", label: "Execute" },
  { slug: "review", label: "Review" },
] as const;

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const workspaces = await listWorkspacesForUser(db, user.id);
  const workspace = workspaces.find((w) => w.id === params.workspaceId);
  if (!workspace) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-500">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:underline">
              ONEVYRT
            </Link>
            <span className="text-sm font-semibold text-gray-900">{workspace.name}</span>
          </div>
          <nav className="flex gap-4">
            {DESTINATIONS.map((destination) => (
              <Link
                key={destination.slug}
                href={`/workspaces/${params.workspaceId}/${destination.slug}`}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 hover:underline"
              >
                {destination.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
