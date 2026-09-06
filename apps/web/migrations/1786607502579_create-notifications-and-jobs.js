/**
 * Twentieth domain: in-app notifications (bell icon) and the job-run log
 * that drives them. Two tables:
 *  - notifications: one row per recipient per event. dedupe_key is unique
 *    and nullable — a job computes a deterministic key (e.g.
 *    "cohort_session:<sessionId>:<userId>") so ON CONFLICT DO NOTHING makes
 *    re-running a job harmless; user-facing notifications with no natural
 *    dedupe key just leave it null (a unique index allows many NULLs).
 *  - job_runs: last-run timestamp per job key, so the cron-hit endpoint
 *    (app/api/cron/tick) can skip a job that already ran within its
 *    interval instead of re-scanning every tick.
 */
exports.up = (pgm) => {
  pgm.createTable("notifications", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text", notNull: true },
    workspace_id: { type: "text" },
    type: { type: "text", notNull: true },
    title: { type: "text", notNull: true },
    body: { type: "text", notNull: true },
    link_url: { type: "text" },
    dedupe_key: { type: "text", unique: true },
    created_at: { type: "timestamptz", notNull: true },
    read_at: { type: "timestamptz" },
  });
  pgm.createIndex("notifications", ["user_id", "created_at"]);

  pgm.createTable("job_runs", {
    job_key: { type: "text", primaryKey: true },
    last_run_at: { type: "timestamptz", notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("job_runs");
  pgm.dropTable("notifications");
};
