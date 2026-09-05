-- Phase 7 schema (second slice): weekly reviews.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date timestamptz NOT NULL,
  wins text NOT NULL DEFAULT '',
  challenges text NOT NULL DEFAULT '',
  focus_next_week text NOT NULL DEFAULT '',
  scorecard_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reviews_workspace_id_week_start_date_key UNIQUE (workspace_id, week_start_date)
);
CREATE INDEX weekly_reviews_workspace_id_idx ON weekly_reviews(workspace_id);
