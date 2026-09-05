-- Phase 4 schema (third slice): funnel mathematics.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  conversion_rate double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funnel_stages_workspace_id_order_index_key UNIQUE (workspace_id, order_index)
);
CREATE INDEX funnel_stages_workspace_id_idx ON funnel_stages(workspace_id);
