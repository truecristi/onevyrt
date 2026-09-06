/**
 * Lead follow-up state (§322): who owns the lead, what the next action is, and
 * when it's due. The lifecycle stage says *where* a lead is; these say *who's
 * on it* and *what happens next* — the difference between a working inbox and a
 * list you forget about. All nullable: an unassigned lead with no next action
 * is the normal starting state.
 *
 *  - assignee_id: a workspace member's user id (no FK — members live in the
 *    workspaces JSON; the API validates membership on write).
 *  - next_action: a short free-text "what to do next".
 *  - due_at: when the next action is due.
 */
exports.up = (pgm) => {
  pgm.addColumns("leads", {
    assignee_id: { type: "text" },
    next_action: { type: "text" },
    due_at: { type: "timestamptz" },
  });
  pgm.createIndex("leads", ["workspace_id", "assignee_id"]);
  pgm.createIndex("leads", ["workspace_id", "due_at"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("leads", ["workspace_id", "due_at"]);
  pgm.dropIndex("leads", ["workspace_id", "assignee_id"]);
  pgm.dropColumns("leads", ["assignee_id", "next_action", "due_at"]);
};
