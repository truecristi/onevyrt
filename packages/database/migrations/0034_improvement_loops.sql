-- Phase 7 schema (seventh and final slice): improvement loops.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE improvement_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN (
    'constraint_diagnosis', 'overdue_tasks', 'untested_assumptions', 'lagging_metric'
  )),
  related_id text,
  title text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  baseline_value double precision,
  close_value double precision,
  improved boolean,
  outcome_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX improvement_loops_workspace_id_idx ON improvement_loops(workspace_id);
