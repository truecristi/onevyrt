/**
 * Lead activity timeline (§ leads): an append-only log of what has happened to
 * a lead — created, stage moved, assigned, next action set, due date set — so
 * the drawer shows a real history instead of just the current state. Kept
 * separate from the app-wide app_events so it's cheap to read per lead and
 * scoped to the workspace for tenant isolation.
 *
 *  - kind: a short machine key ('created', 'stage', 'assignee', 'next_action',
 *    'due', 'contacted').
 *  - detail: small JSON payload for rendering (e.g. { to: 'booked' }).
 *  - actor_email: who did it (null for system/public-funnel events).
 */
exports.up = (pgm) => {
  pgm.createTable("lead_events", {
    id: { type: "text", primaryKey: true },
    lead_id: { type: "text", notNull: true },
    workspace_id: { type: "text", notNull: true },
    kind: { type: "text", notNull: true },
    detail: { type: "jsonb" },
    actor_email: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("lead_events", ["lead_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("lead_events");
};
