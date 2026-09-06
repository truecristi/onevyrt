/**
 * Add free-access mode flag to workspaces. When enabled, all lessons and
 * chapters are unlocked, all gating is bypassed, and submissions don't require
 * coach approval. Used for demo/trial workspaces like goldmanadvertising.
 */
exports.up = (pgm) => {
  pgm.addColumn("workspaces", {
    free_access_mode: { type: "boolean", notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("workspaces", "free_access_mode");
};
