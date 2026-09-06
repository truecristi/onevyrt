/**
 * Add workspace_why_creed table for storing user's "Why" and "Creed"
 *
 * Motivation: Every user needs to connect with their deeper purpose.
 * The "Why" and "Creed" display prominently on the dashboard to inspire
 * daily work and create emotional energy around business activities.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    "workspace_why_creed",
    {
      id: "id",
      workspace_id: {
        type: "text",
        notNull: true,
        references: '"workspaces"(id)',
        onDelete: "cascade",
      },
      why: {
        type: "text",
        default: "",
        notNull: true,
      },
      creed: {
        type: "text",
        default: "",
        notNull: true,
      },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("now()"),
      },
      updated_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("now()"),
      },
      deleted_at: "timestamp",
    },
    {
      constraints: {
        unique: [["workspace_id"]],
      },
    }
  );

  pgm.createIndex("workspace_why_creed", "workspace_id");
  pgm.createIndex("workspace_why_creed", "deleted_at");
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_why_creed");
};
