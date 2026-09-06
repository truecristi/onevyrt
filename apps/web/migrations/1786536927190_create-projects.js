/**
 * Fourth migration in the JSON-file -> Postgres move: `projects`. Unlike
 * sessions/users/workspaces (each one file holding a whole array, migrated
 * by preserving that same full-read/full-write contract), projects were
 * already one-file-per-project on disk — a naturally per-row shape — so
 * this domain gets targeted SQL per operation instead of the array trick.
 * Primary key is (scope_key, id): id is only unique within its scope
 * (a workspace), matching how the file store already worked (one directory
 * per scope, filenames unique within it, not globally).
 */
exports.up = (pgm) => {
  pgm.createTable("projects", {
    scope_key: { type: "text", notNull: true },
    id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
    doc: { type: "text", notNull: true },
  });
  pgm.addConstraint("projects", "projects_pkey", { primaryKey: ["scope_key", "id"] });
  pgm.createIndex("projects", "scope_key");
};

exports.down = (pgm) => {
  pgm.dropTable("projects");
};
