-- Phase 5 schema (sixth slice): experiments.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  hypothesis text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'completed', 'abandoned')),
  assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz,
  result text NOT NULL DEFAULT '',
  decision text
    CHECK (decision IS NULL OR decision IN ('adopt', 'iterate', 'retest', 'stop', 'insufficient_evidence', 'reject')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX experiments_workspace_id_idx ON experiments(workspace_id);
