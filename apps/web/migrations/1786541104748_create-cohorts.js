/**
 * Twelfth migration: cohorts (see lib/cohorts.ts). One global store, like
 * users/workspaces, with every function doing full read/mutate/write of
 * the whole record set under one in-process lock — so readAll/writeAll
 * keep that exact contract (full read, transactional full-table sync on
 * write) rather than rewriting ~10 call sites to targeted SQL, same
 * reasoning as the users/workspaces cutovers. Nested arrays
 * (memberWorkspaceIds/sessions/announcements) stay jsonb.
 */
exports.up = (pgm) => {
  pgm.createTable("cohorts", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    start_date: { type: "text", notNull: true },
    end_date: { type: "text", notNull: true },
    coach_user_id: { type: "text", notNull: true },
    coach_email: { type: "text", notNull: true },
    programme_id: { type: "text", notNull: true },
    member_workspace_ids: { type: "jsonb", notNull: true, default: "[]" },
    sessions: { type: "jsonb", notNull: true, default: "[]" },
    announcements: { type: "jsonb", notNull: true, default: "[]" },
    created_at: { type: "text", notNull: true },
    stage_access_limit: { type: "integer" },
  });
  pgm.createIndex("cohorts", "coach_user_id");
};

exports.down = (pgm) => {
  pgm.dropTable("cohorts");
};
