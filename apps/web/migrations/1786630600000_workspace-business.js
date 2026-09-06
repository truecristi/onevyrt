/**
 * The business-OS layer: one jsonb blob per workspace holding the strategic
 * operating systems (Business Reality Map first; then driver tree, growth
 * constraint, growth drivers, etc. — each a key in `data`). Its own table so
 * it's independent of the brand profile, and new systems never need another
 * migration. Original ONEVYRT systems inspired by general business-management
 * concepts — no external course material is stored.
 */
exports.up = (pgm) => {
  pgm.createTable("workspace_business", {
    workspace_id: { type: "text", primaryKey: true },
    data: { type: "jsonb", notNull: true, default: "{}" },
    created_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_business");
};
