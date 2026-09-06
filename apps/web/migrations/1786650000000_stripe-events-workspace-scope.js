/**
 * Scope the Stripe e-commerce webhook log to a workspace.
 *
 * `stripe_events` was a single global table: every workspace's checkout
 * events landed in one capped log, so tenants evicted each other's rows,
 * and the aggregate read endpoint returned instance-wide revenue to any
 * caller. This adds `workspace_id` so each workspace's events are isolated
 * and the read can be scoped to (and authorized for) one workspace.
 *
 * Nullable, because pre-existing rows have no workspace attribution and
 * events whose Stripe object carries no client_reference_id / metadata
 * workspaceId still can't be attributed — those simply never surface in a
 * workspace-scoped view (which is the safe outcome, not a leak).
 */
exports.up = (pgm) => {
  pgm.addColumn("stripe_events", {
    workspace_id: { type: "text" },
  });
  pgm.createIndex("stripe_events", ["workspace_id", "received_at"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("stripe_events", ["workspace_id", "received_at"]);
  pgm.dropColumn("stripe_events", "workspace_id");
};
