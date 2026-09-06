/**
 * Adds the `plan_metadata` jsonb column `lib/free-access-mode.ts` has always
 * expected on `workspaces` but that was never actually created.
 *
 * There are two separate, non-communicating "free access" implementations in
 * this codebase:
 * - The simple boolean `workspaces.free_access_mode` (added by
 *   1788378476000_add-free-access-mode.js), read/written by lib/workspaces.ts
 *   and app/api/admin/enable-free-access/route.ts — a plain on/off flag.
 * - The richer, time-bounded lib/free-access-mode.ts (checkFreeAccessMode,
 *   enableFreeAccessMode, bypassGatesIfFreeAccess, etc., with its own
 *   in-process cache), which stores `{ free_access_until: <ISO date> }` in
 *   `workspaces.plan_metadata` — a column that no migration ever created.
 *   Every call into that module has been throwing
 *   `column "plan_metadata" does not exist` in production.
 *
 * This migration only adds the missing column so the richer implementation
 * — the one with actual business logic (gate-bypass, auto-approve, coach
 * notification skip) — works. It does NOT reconcile the two implementations;
 * that's a real design decision (which one is canonical, or how they merge)
 * left for a deliberate follow-up, not assumed here.
 */
exports.up = (pgm) => {
  pgm.addColumn("workspaces", {
    plan_metadata: { type: "jsonb", notNull: true, default: "{}" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("workspaces", "plan_metadata");
};
