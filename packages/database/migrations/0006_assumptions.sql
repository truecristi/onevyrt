-- Phase 2 schema (seventh slice): assumptions.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  statement text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'validated', 'invalidated')),
  unit text NOT NULL DEFAULT '',
  value double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assumptions_workspace_id_idx ON assumptions(workspace_id);
