/**
 * Migration: Add 90-day reflection checkpoints table
 *
 * Creates workspace_90day_reflections table to store quarterly purpose
 * evolution reflections. Captures how the user's Why and Creed have
 * evolved over 90-day periods.
 */

exports.up = async (pgm) => {
  pgm.createTable("workspace_90day_reflections", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    workspace_id: {
      type: "text",
      notNull: true,
      references: '"workspaces"(id)',
      onDelete: "CASCADE",
    },
    user_id: {
      type: "text",
      notNull: true,
      references: '"users"(id)',
      onDelete: "CASCADE",
    },
    previous_why: {
      type: "text",
      notNull: true,
      default: "",
    },
    previous_creed: {
      type: "text",
      notNull: true,
      default: "",
    },
    why_evolution: {
      type: "text",
      notNull: true,
    },
    creed_evolution: {
      type: "text",
      notNull: true,
    },
    key_insights: {
      type: "text",
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
  });

  // Indices for fast queries
  pgm.createIndex("workspace_90day_reflections", ["workspace_id", "created_at"]);
  pgm.createIndex("workspace_90day_reflections", ["user_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_90day_reflections", { cascade: true });
};
