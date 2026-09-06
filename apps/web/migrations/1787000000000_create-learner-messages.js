/**
 * learner_messages — in-app messages a coach/mentor (or platform admin) sends to
 * a learner from the engagement console's "Reach out" action. One row per
 * message, scoped to the learner's workspace (ws_id), shown to that workspace's
 * members next time they're on the platform. The paired email (lib/mailer.ts)
 * is what reaches a learner who ISN'T logging in; this in-app copy is what they
 * see when they come back. read_at NULL = unread (drives the unread banner).
 */
exports.up = (pgm) => {
  pgm.createTable("learner_messages", {
    id: { type: "text", primaryKey: true },
    ws_id: { type: "text", notNull: true },
    from_email: { type: "text", notNull: true },
    from_name: { type: "text" },
    subject: { type: "text" },
    body: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    read_at: { type: "timestamptz" },
  });
  pgm.createIndex("learner_messages", ["ws_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("learner_messages");
};
