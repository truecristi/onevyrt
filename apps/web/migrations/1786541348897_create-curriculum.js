/**
 * Thirteenth migration: the admin-editable programme curriculum (see
 * lib/curriculum-store.ts). Two global stores, same shape as users/
 * workspaces/cohorts — every function does full read/mutate/write under
 * one in-process lock (mostly through the shared `mutate` helper), so only
 * readAll/writeAll (and their tombstone-file counterparts) branch on
 * dbConfigured(). Each programme/tombstone-set is a single jsonb blob per
 * id/programme, matching the deeply nested ProgrammeTemplate shape as-is.
 */
exports.up = (pgm) => {
  pgm.createTable("curriculum", {
    id: { type: "text", primaryKey: true },
    programme: { type: "jsonb", notNull: true },
  });
  pgm.createTable("curriculum_deletions", {
    programme_id: { type: "text", primaryKey: true },
    stage_ids: { type: "jsonb", notNull: true, default: "[]" },
    lesson_ids: { type: "jsonb", notNull: true, default: "[]" },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("curriculum_deletions");
  pgm.dropTable("curriculum");
};
