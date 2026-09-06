/**
 * Fifteenth migration: programme enrollment/progress (see lib/enrollments.ts).
 * Was one file per workspace holding a single Enrollment object (nested
 * lessons/submissions) — kept as one jsonb blob per workspace_id here, same
 * shape as tracking_journeys, since every call site already reads/mutates/
 * writes the whole object under one in-process lock and there's no reason
 * to normalize submissions into their own table for this slice.
 */
exports.up = (pgm) => {
  pgm.createTable("enrollments", {
    workspace_id: { type: "text", primaryKey: true },
    enrollment: { type: "jsonb", notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("enrollments");
};
