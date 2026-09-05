/**
 * Honest Phase 1 placeholder (README §"canonical repository README": "must
 * never claim that a command, module or feature exists before it's present
 * in the repository"). The real five-destination navigation (Today, Learn,
 * Build, Execute, Review) is Phase 4+; this page exists to prove the
 * monorepo, Tailwind and design-system wiring work end to end.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">ONEVYRT</h1>
      <p className="text-gray-600">
        This is the Phase 0/1 foundation scaffold - identity, tenancy and the design-system
        primitives. The full product experience (Today, Learn, Build, Execute, Review) has not been
        built yet.
      </p>
      <p className="text-sm text-gray-500">
        See{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">
          docs/ONEVYRT_Deep_Product_Learning_AI_Implementation_Master_Spec.md
        </code>{" "}
        and the repository README for the full plan.
      </p>
    </main>
  );
}
