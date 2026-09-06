/**
 * Scalability: a GIN index on workspaces.members (jsonb) so the per-user
 * membership lookup (lib/workspaces.ts listForUser) can use the jsonb
 * containment operator `members @> [{"userId": …}]` instead of a full-table
 * scan with jsonb_array_elements. Membership is checked on effectively every
 * workspace-scoped request, so at thousands of users this is the difference
 * between an index probe and scanning every workspace row each time.
 */
exports.up = (pgm) => {
  pgm.createIndex("workspaces", "members", { method: "gin", name: "workspaces_members_gin" });
  // Same pattern for cohort membership (lib/cohorts.ts listCohortsForWorkspace).
  pgm.createIndex("cohorts", "member_workspace_ids", { method: "gin", name: "cohorts_member_ws_gin" });
};

exports.down = (pgm) => {
  pgm.dropIndex("workspaces", "members", { name: "workspaces_members_gin" });
  pgm.dropIndex("cohorts", "member_workspace_ids", { name: "cohorts_member_ws_gin" });
};
