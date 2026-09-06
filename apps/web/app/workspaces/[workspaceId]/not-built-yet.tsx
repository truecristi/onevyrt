import { EmptyState } from "@onevyrt/design-system";

/**
 * Shared honest placeholder for the destinations that don't have a real
 * page behind them yet (Learn, Build, Execute, Review) - a real link in
 * the nav, not a 404, but never claiming a screen exists before it does
 * (root README's "must never claim that a command, module or feature
 * exists before it's present in the repository", applied to page-level
 * navigation rather than just the README's own prose).
 */
export function NotBuiltYetPage({ destination }: { destination: string }) {
  return (
    <EmptyState
      title={`${destination} isn't built yet`}
      description="This destination's backend/API layer may already exist and be tested - see the repository README and ADR-0022 for what's actually done versus still outstanding. The page itself hasn't been built."
    />
  );
}
