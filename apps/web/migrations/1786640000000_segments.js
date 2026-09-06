/**
 * Contact segments — saved, composable filters over a workspace's leads/contacts
 * (people who became leads, people who booked/converted, SMS-reachable, from a
 * given creative, etc.) that feed conversion workflows: export, copy an email or
 * SMS list, or a call list. The filter itself is a nested AND/OR rule tree stored
 * as jsonb; the columns it references live on the leads table. No PII stored here
 * beyond the workspace's own filter definition.
 */
exports.up = (pgm) => {
  pgm.createTable("segments", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    description: { type: "text" },
    rules: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("segments", ["workspace_id", "updated_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("segments");
};
